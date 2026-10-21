Task-ID: ACTION-04A3-COUNTER-TRANSITION-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 190c50b37ad217b9597a64323f357ad396ecb903
Agent-Start-Head: 3f4adb0e1aa460fa063d187c2931c62d4c63b40e
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation / Design。Production変更なし）。

**推奨: Candidate A — Simulationが持つpair-levelの `CounterTransition`**
- 120 tickの、決定的なpathによる移動
- Pusherの基準: 押した側（Pusher）の位置を基準にした、極座標のpath
- 入力: 完全にlockする
- 接触の補正: 2人の間では行わない
- Ring-out: 毎tick、既存の判定をそのまま使う

設計は実装Taskに渡せる粒度まで決めた。ただし実装の前に、**Userの判断が2つ必要**（D1: Pusherの前への距離、D2: 遷移の後の崩しとMorozashiの機会）。どちらも推奨案を付けたが、値や意味は勝手に決めていない（§User Decisions Still Needed）。

役割名の対応:
- Taskの用語: **counter user**（Downで捕えた側）/ **pusher**（Pushを捕えられた側）
- `resolveCounter()` の中の名前: counter user = **`defender`**、pusher = **`attacker`**
- 以下ではTaskの用語を使う

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 5`
- Remote CURRENT_TASK
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `190c50b`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- 変更の範囲
  - `190c50b..origin/develop`、HEAD（`f6f006d`）から `origin/develop` までのどちらも、`docs/agent_handoff/CURRENT_TASK.md` のみ
- `merge --ff-only` → HEAD `3f4adb0`
- source / SPEC / testは変更していない
  - 調査用のscript（scratchpadの `counter_probe.ts`）で、変更していないSimulationを実行した

# Current Counter Pipeline（`BoutSimulation.step`。source上の順序）

1. `outcome !== ongoing` なら、何もしない（freeze）
2. `previousA/B` を記録する
3. `advancePosture`: 崩しのtimerを1減らす。0なら次のtickでstableに戻る
4. 組みの解除 / Drive（組んでいるとき）
5. FREEのaction開始
   - `idle && stable` のときだけ始まる（Push > Counter > Grip）
   - 押しっぱなしの入力は無視され、溜められない
6. `applyGroundedVelocity(selfVelocity, effectiveMove)`、`decayExternal`
   - 崩し / Counter / Gripのときは、移動の意図が0になる
7. 積分: `position += (self + external) × dt`
8. `resolveContact()`: 近づく方向のself速度を消し、めり込みを分け合って直す。法線を返す
9. FREEかつ接触しているとき: **`resolveCounter()`** → `resolveGrip()` → `resolvePush(contact)`
10. `advanceAction`: Counterの窓が切れたら失敗 → `enterKuzushi`
11. `updateFacing`
    - FREE: 崩しでない者は、相手へ瞬時に向く
    - 崩しの者は、向きを固定する
12. `resolveArenaRingOut`: 直前と最終の中心を結ぶ線分で判定する。Tokudawaraに対応している

**`resolveCounter()`**（`BoutSimulation.ts:699-730`）
- 条件: counter userの `action.kind === 'counter'`、pusherがactiveのPush、接触している
- 処理
  1. `d` = pusherの固定されたPushの向き
  2. `tier = counterTier(ticksRemaining)`（activeの最初の3 tickがBest）
  3. `target = counterRelocationTarget(tier, pusher.position, d, combined, cu.position, radius − bodyRadius)`
  4. `enterKuzushi(pusher)`（Pushは取り消し、30 tick）
  5. `cu.action = idle`
  6. targetがあれば **`cu.position = target`**（同じtickのうちに直接代入）
  7. `pusher.externalVelocity += d × COUNTER_OVERSHOOT_SPEED(1.0 m/s)` → clamp
  8. 既存の外力の勢いは残す
- その後の同じtick
  - `resolveGrip`（何も起きない）
  - `resolvePush(contact)`: Pushは取り消されたので、net 0
  - `updateFacing`: counter userは新しい位置からpusherへ瞬時に向く。pusherは向きを固定する
  - Ring-out: 直前の位置からtargetへの直線で判定する

Taskの「既知の動作 1〜5」は、sourceと一致した。

# Current Instant-Relocation Evidence

変更していないSimulationで測った値（2人が接した状態から開始。Bが−x方向へ押す）:

| ケース | 捕えたtick | counter userの1 tickでの移動 | pusherの外力（捕えた直後） | pusherが前へ流れる距離（捕えた後） |
|---|---|---|---|---|
| Best（activeの1 tick目） | 6 | **1.400 m = 4.0R**（正面 → 背後） | 1.0 m/s | 0.054 m（0.16R） |
| Success（activeの4 tick目） | 10 | **0.981 m = 2.8R**（正面 → 横） | 1.8 m/s | 0.188 m（0.54R） |
| Success（activeの最後の tick） | 13 | 0.974 m = 2.8R | 2.4 m/s | 0.340 m（0.97R） |
| Success（counter userが+yへ寄る） | 10 | 0.957 m = 2.7R（+y側へ） | 1.8 m/s | 0.188 m |

- counter userは、1 tick（16.7 ms）で最大4R動く。これが、Userの見た瞬間移動の正体
- pusherが前へ流れる距離は、overshoot（1 m/s）と、Pushで溜まった2人の勢いを外力の減衰（8 m/s²）で止めたもの
  - **0.05〜0.34 m で、tierとタイミングによって変わる**。約0.1〜0.3秒で止まる
  - 「2秒かけて読み取れるほど前へよろける」には、明らかに足りない（→ D1）

# Affected State / Tests

**瞬間的な位置の移動とovershootに依存するtest**（実装時に、意図して書き換えが必要）:

| file | test | 依存していること |
|---|---|---|
| `BoutCounterPosition.test.ts` | T78、T79、T80（統合部分）、T81 / T82 の統合、T83 | 捕えた同じtickに、target（接する距離）にいる |
| 同 | T84（2件）、T85、T86、T87 | `COUNTER_OVERSHOOT_SPEED` による外力、前からの勢いが残る、減衰 |
| 同 | T88、T89、T91 | 失敗時の動作（維持）、tierの境界（維持）、再現性（期待値は変わる） |
| `BoutCounter.test.ts` | T67、T68、T69、T70、T76 | 捕えた後の崩しの長さ（D2で変わる）、入力の無視、向き、再現性 |
| `BoutGrip.test.ts` | **T101、T108** | **Counter成功の次のtickにGrip → Morozashi**（入力lock中は不可。→ D2） |
| `BoutOrientation.test.ts` | T117、T118、T119 | Counter → Gripの後のTURNINGの量（背後 / 横の幾何は保たれる。開始のtickがずれる） |
| `BoutRingOut.test.ts` | T165 | 土俵際でのtargetの有効性。fixtureの意図は保たれるが、判定はpathの全体になる |
| `BoutTokudawara.test.ts:538` | 移動はcircleの保守的な条件のまま | 維持する（同じ条件をpathの全点に適用） |
| `pushDummyController.test.ts` | T74 | 崩しの間、dummyは何も送らない（遷移中も同じ扱いが必要） |
| `wrestlerVisualState.test.ts` | 崩しの優先度と強さ | 崩しの長さがD2で変わると、強さの計算の分母に影響する |

**壊れる、または拡張が必要な不変条件**
1. FREEのactionは、`idle && stable` なら始められる → 遷移中のcounter userは `idle && stable` でも始められないようにする（新しいgate）
2. 位置は、積分・接触・組みの結合・Counterの移動だけで変わる → 遷移中は「決定的なpath」が唯一の情報源になる。積分と接触は止める
3. FREEでは毎tick、接触を補正する → 遷移中の2人には行わない
4. 外力は独立に減衰する → 遷移中は、pathで上書きする
5. Counterの移動は、同じtickの中の内部処理（ring-outのeventではない）→ 複数tickの移動になる。ring-outは毎tickの線分で判定する（既存の判定のまま）

# Candidate Designs

| 観点 | **A. pair-levelの遷移状態** | B. participantのaction / postureを拡張 | C. presentationだけの補間 |
|---|---|---|---|
| 正本が1つ | ◎ 2人の幾何をpairとして1か所に持つ（`engagement` と同じ考え方） | △ 2人の半分ずつを同期させる必要がある。相対pathは本来pairのもの | ✗ 正本の位置（瞬間移動後）と表示の位置が2つになる |
| 入力のlock | ◎ 遷移の有無で一括して判定する | ○ 2つの状態から判定する | ✗ Simulationは移動後すぐ入力を受け付ける。表示が遅れる |
| 決定性 / 固定step | ◎ tickの数で進める | ◎ | △ Sceneのdelta時間に依存する |
| Snapshotの分かりやすさ | ◎ `counterTransition` を1つ見ればよい | △ pusherとcounter userの状態を突き合わせる | ✗ 表示と接触円がずれる |
| 接触 / ring-out | ◎ 正本の位置が連続して動く。ring-outは実際の経路で判定する | ○ | ✗ ring-outは瞬間移動した位置で判定され、見た目と食い違う |
| 将来のCounterのart | ◎ tier、役割、進み具合をそのまま読める | ○ | △ |
| 実装の大きさ | 中（型1つ、stepに1つの分岐、開始と完了の処理） | 中〜大（各actionの分岐が増える） | 小。ただし要件を満たさない |

**推奨: A**。Cは、2つの要件（両者とも約2秒操作できない、決定的なtiming）を満たせない。また「正本の位置を2つ持たない」に反するので、却下する。

# Recommended Design

**推奨する状態の形**（Simulationの内部）:

```ts
type MutableCounterTransition =
  | { kind: 'none' }
  | {
      kind: 'active'
      tier: 'best' | 'success'
      counterUserId: ParticipantId
      pusherId: ParticipantId
      ticksElapsed: number            // 0 = 開始tickの終わり。1..N = 遷移のtick
      // 開始時に固定（以後は再計算しない）
      pusherStart: Vec2               // p0
      direction: Vec2                 // d（固定したPushの単位方向）
      staggerDistance: number         // L（D1）
      counterUserStartRel: { r: number; theta: number } // (d, perp) 系での極座標（pusherを中心）
      counterUserTargetRel: { r: number; theta: number } | null // null = 有効な候補なし（下記）
    }
```

**Snapshotに公開するもの**（pair-level。`engagement` と同じくtopに置く）:

```ts
export type BoutCounterTransition =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'active'
      readonly tier: 'best' | 'success'
      readonly counterUserId: ParticipantId
      readonly pusherId: ParticipantId
      readonly ticksRemaining: number // 1..N。次のtickを含む（既存のtimerと同じ約束）
    }
// BoutSnapshot に `counterTransition: BoutCounterTransition` を足す
```

- path（p0、d、L、極座標）は公開しない（正本の位置と向きが、すでに表示に足りる）
- 使い道
  - debugのlabel
  - dummyのharnessが待つ判定
  - 将来のCounterのart（tierと役割）

**名前つきの暫定定数**
- `COUNTER_TRANSITION_TICKS = 120`（60 Hzで2.0秒）
- `COUNTER_STAGGER_DISTANCE`（D1）
- `COUNTER_OVERSHOOT_SPEED` は、遷移で置き換えるので削除する（実装Taskで）

# Entry / Tick / Completion Semantics

**開始（entry）**: 既存の `resolveCounter()` の中で、捕えたtick（tick T）に置き換える
1. `d`、`tier` を取る（既存と同じ）。`enterKuzushi(pusher)`、`cu.action = idle`（既存と同じ）
2. counter userの位置は動かさない（**瞬間移動を削除する**）。overshootの外力も足さない
3. 2人の `selfVelocity` と `externalVelocity` を0にする（前からの2人の勢いは、遷移に吸収する。→ D3）
4. 候補を選ぶ（下記の「Path」）。遷移を `active`、`ticksElapsed = 0` にする
5. このtickの残り（Grip / Push / timer / 向き / ring-out）は、既存のとおり
   - Pushは取り消されているので、net 0
   - 誰もGripのreachをしていないので、Gripは起きない
   - 位置は捕えた時のまま

**遷移中のtick**（T+k、k = 1..N。stepの順序を、この分岐で置き換える）:
1. freezeの判定（既存）→ `previous` を記録（既存）
2. `advancePosture`: pusherの崩しのtimerは、遷移中は減らさない（D2(a)の場合）。counter userはstableのまま
3. **入力はすべて無視する**: 解除 / Drive / FREE actionの開始 / 移動。intentは読まない
4. `ticksElapsed += 1`、`u = ticksElapsed / N`
   - pusher: `P(u) = p0 + d · L · ease_p(u)`
   - counter user: `C(u) = P(u) + polar(r(u), θ(u))`（下記）
5. 速度は、報告用にpathの差分を書く（積分には使わない）
   - pusher: `externalVelocity = (P_k − P_{k−1}) / dt`、`self = 0`
   - counter user: `selfVelocity = (C_k − C_{k−1}) / dt`、`external = 0`
6. 接触 / 組みの結合 / Counter / Grip / Push の解決、`advanceAction` は行わない（2人ともidleのまま）
7. `updateFacing`（既存の規則のまま。下記）
8. Ring-out（既存の `resolveArenaRingOut`。`previous` → `current`）
9. `ticksElapsed === N` かつまだongoingなら、**完了**

**完了（tick T+N の終わり）**
- 位置: `P(1) = p0 + d·L`、`C(1)` = 既存の候補の式を `P(1)` で評価したもの（下記）
- action: 2人ともidle
- posture
  - pusher: 崩しをもう一度、`KUZUSHI_TICKS` から始める（D2(a)）
  - counter user: stable
- 速度: 2人とも、selfもexternalも0
- 向き: その時の値のまま（既存の規則）
- engagement: FREE
- 遷移の状態: `none`
- **入力は、tick T+N+1 から戻る**
  - 押しっぱなしのWASDは、T+N+1から効く
  - 押した瞬間の入力（Push / Counter / Grip）は、そのtickに新しく来たものだけが有効

# Success vs Best

**共通**
- tick数N、pusherのpath、入力のlock、接触の扱い、ring-out、向き、速度、崩し
- 候補の有効性の検査、候補が無いときの扱い

**違い**: counter userの目標の角度θ1と、候補の順序だけ（既存の `counterRelocationTarget` と同じ）
- Success: 好みの側 → 反対の側。θ1 = ±π/2
- Best: 背後 → 好みの側 → 反対の側。背後は θ1 = ±π
  - 回り込む向きは、好みの側と同じ符号
  - 好みの側の決め方は、既存の規則のまま: 横方向のずれの符号。同点なら土俵の中心に近い側、それも同じなら+

**Path（Agentの推奨。決定的で、最小限）**
- 基準の座標系: pusherの `(d, perp)`、`perp = (−d.y, d.x)`
- counter user: `polar(r, θ) = d·r·cosθ + perp·r·sinθ`
  - 開始: `r0 = |c0 − p0|`（≈ 接する距離）、`θ0 = atan2(perp·(c0−p0), d·(c0−p0))`（ほぼ正面なので ≈ 0）
  - 終わり: `r1 = combined`（接する距離）、θ1は上記
  - `θ(u) = θ0 + (θ1 − θ0)·s(u)`、`r(u) = r0 + (r1 − r0)·s(u)`、`s(u) = 3u² − 2u³`（smoothstep）
- pusher: `ease_p(u) = 1 − (1 − u)²`（まず大きく前へ出て、だんだん止まる）
- 最終の位置: `C(1) = P(1) + polar(combined, θ1)`
  - これは既存の候補の式（rear = p − d·R、side± = p ± perp·R）を、**pusherの最終の位置** `P(1)` で評価したものと一致する
  - Success = 横、Best = 背後、という最終の相対配置の意味は保たれる
- targetは **開始時に一度だけ** 選び、固定する（途中で選び直さない）
  - pusherの最終の位置も開始時に決まるので、最終の相対配置は厳密
- 2人の間の距離は常に `r(u) ≥ min(r0, combined) ≥ combined` で、重ならない
  - 正面から回り込むので、pusherの体を通り抜けない
  - Bestの「回り込んで背後へ」になる

# Input Lock Semantics

| 入力 | 遷移中（T+1〜T+N） | T+N+1 |
|---|---|---|
| WASD | 無視（移動の意図は使わない） | 押しっぱなしなら、すぐ効く（通常の加速） |
| Pushを押した瞬間 | 無視して捨てる（溜めない） | 新しく押したものだけが有効 |
| Counterを押した瞬間 | 同上 | 同上 |
| Gripを押した瞬間 | 同上（組みは起きない） | 同上 |
| Driveの押しっぱなし | FREEなので、もともと関係ない | 同上 |
| dummyのintent | Simulationが無視する | — |

- Sceneの `PressLatch` は、そのframeの最初のtickに渡されたあと、消費される
- 遷移中に押されたものは、そのtickで無視されて消える（既存の「action中の入力は溜めない」と同じ）
- **dummyのharness**: `snapshot.counterTransition.kind === 'active'` のときは、`NO_INPUT` を返し、cooldownを満杯に保つ（崩しのときと同じ）
  - こうしないと、counter user側のdummyが、遷移が終わった直後のtickにPushを始める
  - 小さな変更で済む

# Movement / Velocity Semantics

- 遷移中の位置は、pathだけが決める（積分しない）。正本の位置は1つで、毎tick連続して動く
- 速度は、pathの差分を報告用に書く
  - counter userは自分の足運びなので **self**
  - pusherは不本意な前への崩れなので **external**
  - Snapshotの `velocity` = self + external（位置の動きと矛盾しない）
  - presentationの `locomotionSpeed`（= velocity − external）: counter userは動いている、pusherは足運び0として、正しく扱われる
- 開始時: 2人のself / externalを0にする（D3）
- 完了時: 2人とも0
  - smoothstepとease-outは、u=1で微分が0。離散の最後の差分を残さないように、明示的に0にする

# Contact Semantics

**推奨: 遷移中は、2人の間の `resolveContact` を行わない**（積分と同時に止める）。

理由:
- pathはもともと `|C − P| ≥ combined` を保つ（重ならない）
- 接触の補正（近づくself速度の除去、めり込みの分配）を、path上の位置にかけると、位置を2つの源で決めることになる。jitterや、pathからのずれ（横・背後の配置の崩れ）が起きる
- 参加者は2人だけなので、それ以外との接触は存在しない

開始tickでは、既存のとおり、`resolveCounter` の前に接触の補正が済んでいる。そのため `r0` は、接する距離〜それに `CONTACT_SLOP` を足した範囲にある。

# Ring-out / Tokudawara Semantics

- **毎tick、既存の `resolveArenaRingOut` をそのまま使う**
  - `previous` → `current` は、pathの隣り合う2点を結ぶ線分
  - Tokudawaraに対応した最初の出る位置（`firstArenaExitFraction`）も、同じtickの中で出て戻る場合を扱える
  - **勝敗の意味は変えない**
- **pusherは、遷移の途中で負けうる**
  - 前へのよろけで外へ出たtickに、outcomeが決まる
  - 現在のovershootで外へ流れて負けるのと、同じ種類の結果
- **counter userは、遷移中に外へ出ない**
  - 候補の有効性を「pathの全点」に広げる
    - `k = 0..k_end` のすべての `C(k)` が、`|C| ≤ radius − bodyRadius`（既存の保守的な円の条件。Tokudawaraの張り出しは使わない）
    - `k_end` = N。ただし、pusherのpathが先に外へ出るなら、そのtick（そこでfreezeする）
    - この `k_end` は、開始時に `firstArenaExitFraction` をpusherの各tickの線分に当てて決める。決定的
  - 有効な候補の順序と、無いときの扱いは、既存と同じ
  - この拡張の理由: targetがpusherの最終の位置を基準にしたので、捕えた時の位置だけを検査すると、pathの途中や最後が外へ出うる
  - 最終の相対配置の意味（横 / 背後、接する距離）は変えない（Taskで止める条件ではない、と判断した。レビューで確認してほしい）
- **有効な候補が無いとき**（例: 土俵際で、横にも背後にも余地が無い）
  - Agentの推奨: 遷移はそのまま行う（2人ともN tick、入力lock、pusherは崩し）
  - ただし **2人とも動かない**（L = 0、counter userはその場）
  - 理由: counter userがよけられないと、pusherの前へのpathがcounter userと重なる
  - 現在の「移動しないが、overshootはする」とは少し違う。→ D1と一緒に確認する
- **同時に外へ出る場合**: counter userは外へ出ないので、遷移からは同時の出（rematch）は起きない
- **すでに勝敗が決まっている**: stepは何もしないので、遷移も始まらない、進まない
- **途中で勝敗が決まったとき**: そのtickでfreezeする
  - 遷移は途中のまま止まる（Snapshotには、`active` とその `ticksRemaining` のまま残る）
  - 既存の「勝敗が決まった後は、最終の状態をそのまま保つ」（T166 / T167）と同じ
  - 完了の処理は行わない

# Facing Semantics

**推奨: 既存の `updateFacing` の規則を変えない**（新しい規則を作らない）。

- pusher: 崩しなので、向きを固定する
  - 捕えた時の向きは、Pushの方向とほぼ同じ
  - 前へよろけながら、前を向いたまま
- counter user: FREEで崩しでないので、毎tick、pusherの中心へ瞬時に向く
  - 位置が連続して動くので、向きも連続して回る
  - 横へ回るとき、背後へ回り込むときも、相手を見続ける
  - 剛体のspriteには、そのまま使える
- 完了時: Bestでは、counter userはpusherの背中を見る。pusherは前を向いたまま（崩し）
- **既存の、範囲外の注意点**
  - 崩しが終わったtickに、pusherの向きはFREEの規則で、相手へ **瞬時に** 回る（Bestでは約180°が1 tickで）
  - これは現在もある挙動で、剛体のspriteでは目立つ可能性がある
  - この調査の範囲外なので、User Play Testで確認し、必要なら別のTaskで扱う（Unexpected Scopeに記録した）

# Kuzushi Interaction

- pusherは、既存のとおり捕えたtickに `enterKuzushi` する（actionはidle。崩しのときactionはidle、という不変条件はそのまま）
- 遷移中の入力lockは、遷移の状態から来る（崩しのpostureには頼らない。counter userは崩していないので）
- **崩しの長さ（D2）**: 遷移（120 tick）は、現在の崩し（30 tick）より長い
- 崩しがあると、Counter成功 → Grip → Morozashiの連携（T101、T108、T117〜T119）が成り立つ。遷移中は入力がlockされるので、選び方でこの連携が成り立つかどうかが変わる
  - (a) **推奨**: 遷移中は崩しを保ち、timerを止める。完了時に、`KUZUSHI_TICKS` から改めて始める
    - 操作が戻った後に、今と同じ約0.5秒の「崩しの間にGripすればMorozashi」の機会が残る
  - (b) 崩しを捕えた時から30 tick数える → 遷移の途中で切れる。Counter成功からのMorozashiの連携は、実質なくなる
  - (c) 遷移中もGripだけは受け付ける → 「両者とも操作できない」に反する
- **失敗したCounter → 崩し** は、`advanceAction` の別の経路で、遷移を作らない。意味は変わらない（T62、T65、T88を維持）

# Snapshot / Presentation

- 正本の位置と向きは、すでに剛体のspriteにそのまま渡されている → 遷移中も、追加の処理なしに連続して動いて見える（Phaserにtweenは不要）
- `snapshot.counterTransition` の使い道
  - debugのphase label（例: `COUNTER BEST` / `COUNTERED`）
  - dummyのharnessが待つ判定
  - 将来のCounter artの判定（counter userかどうか、tier）
- 進み具合は `ticksRemaining` から出せる（`wrestlerVisualState` と同じ約束）
- `wrestlerVisualState.ts`
  - 必須の変更は無い
  - pusherは崩しのpose、counter userは移動のpose（足運びの速度 > 0）になる
  - 将来のCounter artのためのfieldは、そのart Taskで足す

# Boundary Cases

| ケース | 動作 |
|---|---|
| 有効な候補が無い | 遷移は行う。2人とも動かず、入力lock、pusherは崩し（D1と一緒に確認） |
| 土俵際 | 候補の有効性は、pathの全点（pusherが外へ出るtickまで）で検査する。外へ出る候補は飛ばす |
| Tokudawaraの方向 | counter userは保守的な円の条件（張り出しを使わない。既存のtestを維持）。pusherの外への出は、各tickの線分をTokudawaraに対応した `firstArenaExitFraction` で判定 |
| 遷移中のring-out | 外へ出たtickにoutcomeが決まり、freeze。遷移は途中のまま止まる |
| 同時 / ほぼ同時に外へ出る | counter userは外へ出ないので起きない。候補が無い場合も、2人とも動かないので起きない |
| すでに勝敗が決まっている | 何もしない（遷移は始まらない） |
| 最後のtick T+N | 位置 = pathの最終値（相対配置は厳密）。同じtickでring-outを判定してから完了。T+N+1から入力が戻る |
| 遷移中のCounter / Push / Gripの入力 | 無視して捨てる |
| 開始tickのGrip / Push | 既存のとおり、何も起きない（Pushは取り消し、reachしている者はいない） |

# User Decisions Preserved

- Successの最終の相対配置 = **横**、Best = **背後**（接する距離。候補の順序と好みの側の規則も維持）
- 見て分かる遷移は **約2秒**（120 tick）
- 遷移中は **両者とも操作できない**
- pusherは **前へよろける**、counter userも自然に動く
- 基本の剛体spriteを、そのまま使う（新しいartは作らない）
- Counterを試すときのartは、別のTaskで扱う
- Counterのtimingの窓とtierの区分、失敗したCounterの罰、ring-outの勝敗の意味: **変更しない**

# User Decisions Still Needed（実装の前に必要）

**D1. pusherが前へよろける距離 L（と、候補が無いときの扱い）**
- 現在の実際の流れは 0.05〜0.34 m（0.16〜0.97R）で、tierとタイミングで変わる。約0.1〜0.3秒で止まる
- 2秒の読み取れるよろけには、新しい明示的な距離が必要。これはgameplayの意味の変更（土俵際では、Counter成功で押し出されやすくなる）
- 選択肢
  - (a) tierに関係なく、固定の距離（Agentの推奨。暫定値の例: 1.0R = 0.35 m。現在の最大値と同じくらい）
  - (b) tierごとに変える（例: Bestを長く）
  - (c) 現在と同じ「前からの勢い + overshoot」に応じて変える（2秒に引き伸ばすと、ほとんど動かない）
- 候補が無いときに「2人とも動かない」でよいか

**D2. 遷移の後の崩し / Morozashiの機会**
- (a) 推奨: 完了後に、崩しを改めて `KUZUSHI_TICKS` 与える（Counter成功 → GripでMorozashi、の連携を保つ）
- (b) 捕えた時から数える（連携は実質なくなる）

**D3（確認）. 捕えた時の2人の前からの勢いを捨てる**
- pathが動きを持つので、Pushで溜まった勢い（最大約2.4 m/s）は遷移に吸収する
- T85の「前からの勢いを保つ」は置き換わる
- pusherの距離はD1で決まる

（D4・任意: Bestで回り込む向きは、好みの側。これはAgentの推奨で、User Play Testの見た目で調整できる。）

# Expected Implementation Files

- `src/game/sumo/BoutTypes.ts`: `BoutCounterTransition`、`BoutSnapshot.counterTransition`
- `src/game/sumo/BoutSimulation.ts`
  - 遷移の状態
  - `resolveCounter` の開始の処理（瞬間移動とovershootを削除）
  - 候補の選択とpathの検査（`counterRelocationTarget` をpath版にするか、その周りに検査を足す）
  - `step` の中の遷移の分岐、完了
  - `getSnapshot` でのcopy
  - 定数: `COUNTER_TRANSITION_TICKS`、`COUNTER_STAGGER_DISTANCE`。`COUNTER_OVERSHOOT_SPEED` を削除
- `src/game/sumo/ringOut.ts`: 変更なし（export済みの `firstArenaExitFraction` を使う）
- `src/game/input/pushDummyController.ts`（+ test）: 遷移中は崩しと同じく待つ
- `src/game/scenes/BoutScene.ts`: 任意。debugのphase labelのみ
- test
  - 新しい `BoutCounterTransition.test.ts`
  - 書き換え: `BoutCounterPosition.test.ts`、`BoutCounter.test.ts`、`BoutGrip.test.ts`（T101 / T108）、`BoutOrientation.test.ts`（T117〜T119）、`BoutRingOut.test.ts`（T165）、`BoutTokudawara.test.ts`、`wrestlerVisualState.test.ts`（D2の場合）
- `docs/ARCHITECTURE.md`: Counterの段落と、stepの順序
- 変更しないもの: `wrestlerVisualState.ts`、`WrestlerView.ts`、`FixedStepAccumulator.ts`、`grappleOrientation.ts`、HUD、art

# Verification

- sourceを直接確認した
  - `BoutTypes.ts`、`BoutSimulation.ts`（全体）、`ringOut.ts`、`grappleOrientation.ts`、`FixedStepAccumulator.ts`、`pushDummyController.ts`、`wrestlerVisualState.ts`
  - `BoutScene.ts`（入力のlatchとsync）、`WrestlerView.ts`（正本の位置 / facingを直接描くこと）
  - 関係するtest（Counter / Counter Position / Grip / Orientation / Ring-out / Tokudawara / dummy / visual state）
- 測定: scratchpadの `counter_probe.ts` で、変更していない `BoutSimulation` をNode 24で実行した（結果は上の表）
- `pnpm test`（変更前のbaseline）: **262 passed**
- Production / source / test / SPECは変更していない。commitするのは `CURRENT_COMPLETION_REPORT.md` だけ

# Design Deviations

Design Deviations: NONE

（実装はしていない。Success / Bestの最終配置、ring-outの勝敗の意味、Counterの窓とtier、失敗の罰は、変更の提案もしていない。pusherの距離と崩しの延長は、勝手に決めずにD1 / D2とした。）

# Unexpected Scope（報告のみ）

- **崩しが終わったときの、向きの瞬時の回転**（既存の挙動）
  - 崩しが終わると、FREEの規則で相手へ1 tickで回る
  - Best（背後）では約180°の瞬間回転になり、剛体のspriteでは目立つ可能性がある
  - 今回の遷移の設計では変えていない。User Play Testで確認し、必要なら別のTaskで扱う
- **候補の有効性を「pathの全点」に広げる点**
  - 最終の配置の意味は変えないが、有効性の判定の範囲が広がる（土俵際で、現在は有効な候補が、新しい方式では無効になりうる）
  - レビューで確認してほしい

# Git Delivery

- Investigation-only Report Commit Exception（AGENTS.md §13）の条件をすべて満たす
  - GitHub HandoffのInvestigation / Design Task
  - Preflightは正常
  - 結論まで完了
  - Production変更は不許可で、実際に変更していない
  - 変更するfileは `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ
- report-onlyのcommit（`docs(agent): investigate counter transition`）→ fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- `main` は変更しない
