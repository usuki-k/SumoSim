Task-ID: ACTION-10A-PUSH-CHARGE-INVESTIGATION
Result: PASS (Investigation complete) — **User Decision Required before ACTION-10B** (charge length: 3x travel vs. whiff self-ring-out; see §0)
Branch: develop
Source-Baseline: 0897776142e854c0a91bc5a79ed6db25426a93ba
Agent-Start-Head: 60f3d72c53bdd23519045895185985f0e4db686c
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

Production Changes: NONE（commitするのはこのReportだけ。測定はscratchpadの、commitしないSimulationのコピーで行った）

# 0. 結論（先に）

## 推奨はOption B

- ArrowUpで、押下時のfacingに向けて固定の方向へ走る（charge）
- **最初の接触から8 tickの「impact window」** のあいだだけ、Push力をかける
- windowが終わればrecoveryへ。外せば、charge tickの最後まで走り切ってrecoveryへ
- 移動の長さとPush力の長さを分けるので、次のものは**現在と完全に同じ**になる:
  - 接触からのshove: 0.5325 m、force 8 tick
  - Counter（Bestを含む）
  - Push vs Tsuppariの連結の長さ
  - Push同士の打ち消し
  - ACTION-09BのKuzushi follow-up

## ただし、要求の中に矛盾がある（User Decisionが必要）

- 押下時のPush方向は、FREEのfacing（＝相手を向く）から決まる
- そのため、相手の中心は **0.70 m（半径の和）以上前方の、土俵の内側** にいる
- 空振りで攻撃側が外へ出るには、**0.70 m + 相手から縁までの余裕** 以上の移動が要る
- 「現在の約3倍」の移動は0.386 mなので、**どの配置でも空振りの自滅ring-outは起こらない**（測定で確認した）

| 方針 | `PUSH_CHARGE_TICKS` | 自由空間の合計移動 | 現在比 | 縁で空振りして外へ出るか |
|---|---|---|---|---|
| 3倍を優先 | 14 | 0.386 m | 3.05x | **出ない**（どの配置でも） |
| 自滅ring-outを優先（推奨案） | **24** | 0.938 m | 7.41x | 出る。押下時の距離0.8 mで、相手が縁から0.1 m以内なら外へ（recovery中に越える） |
| もっと長く | 28 | 1.138 m | 8.99x | 出る。相手が縁から0.2 mでも外へ（active中に越える） |

- 長さは、`PUSH_CHARGE_TICKS` という1つの値で決まる
- それ以外の設計は、どの値でも同じ
- Userに選んでほしいのは、**14（3倍）と24（自滅ring-outあり）のどちらにするか**

# 1. Current Sourceの確認（推測ではなく、sourceと計測で確かめた）

- 定数:
  - `PUSH_STARTUP_TICKS = 6`、`PUSH_ACTIVE_TICKS = 8`、`PUSH_RECOVERY_TICKS = 10`
  - `FORWARD_ACCELERATION = 10`、`MAX_SPEED = 3`、`STOP_DECELERATION = 24`
  - `PUSH_EXTERNAL_ACCELERATION = 26.25`、`EXTERNAL_DECELERATION = 8`
  - `BODY_RADIUS = 0.35`、`CONTACT_SLOP = 0.002`
- Pushの開始: FREE + idle + stable のときだけ受け付ける。`direction = (cos facing, sin facing)` を保存する
- 移動: `effectiveMove` がactiveのときだけ、保存した `direction` で歩く（`applyGroundedVelocity`）。startup / recoveryは入力0で制動
- 力: `resolveForces` → `resolvePush`。条件は「`isPushActive`（phase active）+ 実際のcontact」
- 接触: `resolveContact` は円同士
  - 内向きのself velocityを取り除き、接線方向の成分は残す
  - 動いている側だけを押し戻す。外力は2人で共有する
- ring-out: `resolveArenaRingOut`。中心が許される境界（円 + Tokudawaraの窓）を厳密に越えたらOUT。壁やclampは無い
- facing: FREEの `updateFacing` は、Kuzushi以外の参加者を**毎tick、相手の方向へ瞬時に向ける**。Push中も同じ

# 2. Current Baseline（自由空間、静止から、接触なし）

| Metric | Current |
|---|---:|
| startup ticks | 6 |
| active ticks | 8 |
| recovery ticks | 10 |
| 受付からidleまでのtick数 | 24 |
| startup中の移動 | 0.000000 m |
| active中の自走（active-only self travel） | **0.100000 m** |
| recovery / 惰性での移動 | 0.026667 m |
| 自由空間でのPushの合計移動 | **0.126667 m** |
| idleの後の移動 | 0 |
| peak self speed | 1.333333 m/s |
| 接触からの、力のかかるtick数 | 8 |
| 接触からのshove（静止した受け手） | attacker / receiver / pair とも 0.5325 m。receiverのpeak external 2.566667 m/s |

予想（active約0.10 m、合計約0.13 m）と一致した。

# 3. 候補の比較

## 各案の中身

- A: activeを14 tickにする（移動と力が同じphase）
- B: active（=charge）を14 tickにし、最初の接触から8 tickのimpact windowのあいだだけ力をかける。windowが終わればrecovery。B24は、chargeを24 tickにしたもの
- C: activeは8 tickのまま、Push専用の加速度を22.5 m/s²にする（`MAX_SPEED` 3は変えない）

## 比較表

| Metric | Current | Option A | Option B (14) | Option B (24) | Option C |
|---|---:|---:|---:|---:|---:|
| 自由空間の合計移動 | 0.1267 m | 0.3861 m | 0.3861 m | 0.9383 m | 0.3883 m |
| 現在比 | 1.00x | 3.05x | 3.05x | 7.41x | 3.07x |
| charge中の移動 | 0.100 | 0.2917 | 0.2917 | 0.775 | 0.225 |
| chargeの長さ | 8 tick | 14 tick | 最大14 tick | 最大24 tick | 8 tick |
| peak self speed | 1.333 | 2.333 | 2.333 | 3.0 | 3.0（8 tickで上限） |
| 受付からidleまで（空振り） | 24 | 30 | 30 | 40 | 24 |
| 接触で力がかかる長さ | 8 tick | 最大14（実測10） | 8 tick（window） | 8 tick | 8 tick |
| 接触からの受け手の移動 | 0.5325 | **0.957（1.80x）** | 0.5325（同じ） | 0.5325（同じ） | 0.5325（同じ） |
| 受け手のpeak external | 2.567 | 3.0（clamp） | 2.567 | 2.567 | 2.567 |
| 横への回避の読みやすさ | 走りが短く、読む前に終わる | 0.8〜1.0 mで早い読みなら避けられる | Aと同じ | 1.0〜1.1 mは開始時の反応でも避けられる。charge 0.4 s | 0.8 mだと完璧な読みでも当たる。速すぎる |
| 空振りの自滅ring-out | 出来ない | 出来ない（0.386 < 0.70） | 出来ない | **出来る** | 出来ない |
| 設計の複雑さ | — | 最小（定数1つ） | 小（Push stateに1つのcounter、`counterTier` の入力） | Bと同じ | 小（Push専用の加速度定数） |

## 不採用

- **A**:
  - shoveが1.8倍になる
  - Push vs Tsuppariの連結が14 tickに広がる
  - Counterで捕まえられる押下の範囲が広がる
  - 走ってから当たるとBestになり得ない
  - Pushの衝撃が変わってしまう
- **C**:
  - 133 msで3 m/sに達する
  - 0.8 mでは、完璧な読みでも避けられない（HIT）
  - 「読める突進」にならない
  - 3倍でも自滅ring-outは出来ない

# 4. Dodge matrix（通常のMoveだけ。攻撃側は (0,0) で+x、防御側は (s,0)、押下からの指定tickで+yへ動き続ける）

形式: HIT / MISS・最初の接触tick・最小の中心距離・最接近時の防御側の横移動（m）。forceは、Push力が実際にかかったか。

| s | 反応 | Current | Option A | Option B (14) | Option B (24) | Option C |
|---|---|---|---|---|---|---|
| 0.8 | 押下と同時 | MISS · – · 0.758 · 0.292 | MISS · – · 0.749 · 0.425 | MISS · – · 0.749 · 0.425 | MISS · – · 0.749 · 0.425 | **HIT** · 12 · 0.700 · 0.253 |
| 0.8 | 最初のactive tick（6） | HIT · 14 · 0.700 · 0.125（forceなし: recoveryで接触） | HIT · 14 · 0.700 · 0.125 · force | HIT · 14 · force | HIT · 14 · force | HIT · 11 · force |
| 0.8 | active + 3 | HIT · 13 · force | HIT · 13 · force | HIT · 13 · force | HIT · 13 · force | HIT · 11 · force |
| 0.8 | active + 6 | HIT · 13 · force | HIT · 13 · force | HIT · 13 · force | HIT · 13 · force | HIT · 11 · force |
| 0.9 | 押下と同時 | MISS · 0.852 | MISS · 0.832 · 0.475 | MISS · 0.832 | MISS · 0.832 | MISS · 0.705 |
| 0.9 | 最初のactive | MISS（届かない） | HIT · 18 · 0.253 | HIT · 18 | HIT · 18 | HIT · 13 |
| 0.9 | active + 3 | MISS | HIT · 17 | HIT · 17 | HIT · 17 | HIT · 13 |
| 0.9 | active + 6 | MISS | HIT · 17 | HIT · 17 | HIT · 17 | HIT · 13 |
| 1.0 | 押下と同時 | MISS | MISS · 0.912 | MISS | MISS · 0.912 · 0.575 | MISS |
| 1.0 | 最初のactive | MISS | MISS · 0.752 · 0.378 | MISS · 0.752 | **MISS · 0.708 · 0.475** | HIT · 16（forceなし） |
| 1.0 | active + 3 | MISS | HIT · 21（recoveryで接触、forceなし） | HIT · 21（forceなし） | HIT · 20 · force | HIT · 15（forceなし） |
| 1.0 | active + 6 | MISS | HIT · 20（forceなし） | HIT · 20（forceなし） | HIT · 20 · force | HIT · 15（forceなし） |
| 1.1 | 押下と同時 | MISS | MISS | MISS | MISS · 0.989 | MISS |
| 1.1 | 最初のactive | MISS | MISS · 0.840 | MISS | MISS · 0.779 · 0.575 | MISS |
| 1.1 | active + 3 | MISS | MISS · 0.788 | MISS | HIT · 24 · force | MISS |
| 1.1 | active + 6 | MISS | MISS · 0.751 | MISS | HIT · 22 · force | MISS |

- Currentは、そもそも0.9 m以上に届かない（反応しなくてもMISS）
- B（14 / 24）とAは、早く読めば避けられ、遅い反応は当たる。Taskの意図どおり
- B24は1.0〜1.1 mでも届き、そこでも最初のactive tickで反応すれば避けられる
- 横移動は、通常のMoveの加速（10 m/s²）なので、必要な横移動（0.25〜0.6 m）には12〜18 tickかかる。chargeが長いほど読み合いが成り立つ
- 回避専用の状態や、無敵は無い
- 接触の判定は、既存の円の接触だけ

# 5. Homingしないことの証明（Current、0.8 m、防御側は押下と同時に+yへ）

| tick | phase | attackerの位置 (x, y) | 移動方向 | 保存した`direction` | canonical `facing` |
|---|---|---|---|---|---|
| 0 | startup | (0, 0) | – | 0° | 0.2° |
| 6 | active | (0.0028, 0) | 0° | 0° | 5.6° |
| 9 | active | (0.0278, 0) | 0° | 0° | 11.2° |
| 12 | active | (0.0778, 0) | 0° | 0° | 19.3° |
| 15 | recovery | (0.1244, 0) | 0° | 0° | 29.2° |
| 21 | recovery | (0.1267, 0) | – | 0° | 45.1° |
| 24 | idle | (0.1267, 0) | – | – | 50.8° |

- **移動は、押下時の方向に固定されている**（y = 0のまま、移動方向0°）。homingも、目標への吸い付きも無い
- 空振り / 通り過ぎ（B、0.8 m、押下と同時に避ける）:
  - 接触なし、力なし
  - 攻撃側は自由空間と同じ0.3861 m（B24では0.9383 m）を走り切ってrecoveryへ
  - 相手がいなくなっても止まらない

# 6. Facingの所見

- **移動方向**: 保存した`direction`に固定（上の表）
- **canonical facing**: FREEの `updateFacing` が、Push中も毎tick、相手の方向へ向き直る。避ける相手を追って、0° → 45°（Current）回った
- **見た目への影響**:
  - 体のspriteはfacingで回る
  - 「体は相手を向いたまま、0°の線を横滑りする」ように見える
  - 長いchargeほど目立つ（B24は0.4秒）
  - 「真っ直ぐ突っ込む」という読みやすさを、明確に損なう
- 次の3案を比べた（いずれも、facingの正本を二重にはしない）:

| 案 | 中身 | 評価 |
|---|---|---|
| 1. Push中はcanonical facingを凍結する（**推奨**） | `updateFacing` で、Kuzushiと同じく、`action.kind === 'push'` の参加者を飛ばす。押下時のfacing = `direction` なので、chargeのあいだ体は走る向きのまま | Simulationが向きの唯一の持ち主のまま。Kuzushiという前例がある。presentationは無変更。scratchでは、startupからrecoveryまで0°のまま、idleで相手へ向き直った（例: 69.8°に一気に） |
| 2. presentationが、Snapshotの `action.direction` から向きを作る | sourceは1つのまま（`direction` はすでにSnapshotにある） | canonical facingとspriteの向きが分かれる。facingを使う箇所（Tsuppariのart選択、Counterの35°、汗、debug marker）が、Push中だけ食い違う。採らない |
| 3. 変えない | — | 横滑りに見え、突進が読めない。採らない |

- 案1の注意点: recoveryの終わりで、facingが相手へ一気に向き直る（Kuzushiの回復と同じ既存の挙動）
- 気になれば、別のTaskで扱う（10Bの範囲外にしてよい）
- facingは、押下時の方向、接触の同心fallback、表示に使われる
- Push中のGripは、相手がidleでないと有効にならない
- Counterの移動は `direction` を使う
- したがって、凍結しても、ほかのgameplayの意味は変わらない

# 7. Edge matrix（自滅ring-out）

## 配置

- 攻撃側は、弦（y = y0）に沿って+xへ走る
- 防御側は同じ線の上で、縁から `margin` m内側にいる。攻撃側の0.8 m前方
- 防御側は押下と同時に、土俵の中心側（−y）へ避ける（防御側自身は外へ出ない）
- 必要な移動 = 0.8 + margin
- 判定は、既存の `resolveArenaRingOut` だけ

| 候補 | y0 | margin | 円 | Tokudawara | 越えたtick / phase |
|---|---|---|---|---|---|
| Current（0.127 m） | 1.0 | 0.02 / 0.1 / 0.2 | IN / IN / IN | IN / IN / IN | – |
| A / B（14、0.386 m） | 1.0 | 0.02 / 0.1 / 0.2 | IN / IN / IN | IN / IN / IN | – |
| C（0.388 m） | 1.0 | 0.02 / 0.1 / 0.2 | IN / IN / IN（接触あり） | IN / IN / IN | – |
| B18（0.638 m） | 1.0 | 0.02 / 0.1 / 0.2 | IN / IN / IN | IN / IN / IN | – |
| B20（0.738 m） | 1.0 | 0.02 / 0.1 / 0.2 | IN / IN / IN | IN / IN / IN | – |
| **B24（0.938 m）** | 1.0 | 0.02 / 0.1 / 0.2 | **OUT / OUT / IN** | **OUT / OUT / IN** | 31 / 33（recovery） |
| B28（1.138 m） | 1.0 | 0.02 / 0.1 / 0.2 | OUT / OUT / OUT | OUT / OUT / OUT | 30 / 32（active）、34（recovery） |

- OUTはすべて「攻撃側の負け（ring-out）」として、既存の仕組みが正しく宣言した
- 自滅専用の規則も、縁での自動の制動も要らない
- Tokudawara:
  - この弦（y0 = 1.0）は窓の外なので、円と同じ結果
  - 窓の中では、許される半径が0.119 m広い分、同じmarginでも外へ出にくい（特別な懸念は無い）
- 中央での空振り（Tokudawaraあり、攻撃側は−0.4 → 走り切る）:
  - 誤ってring-outにならない（ongoingのまま）
  - B24でも攻撃側は+0.54まで進んで止まる
- 参考（試験の配置の誤りから分かったこと）:
  - 半径方向（y0 = 0）の配置で防御側を縁に置き、横へ避けさせると、出るのは**避けた防御側**だった
  - これも既存のring-outどおり（縁では、横に避けるのも危ない）

# 8. Interaction findings

## Counter

- 防御側がCounterを押したtick（0〜26）ごとの結果
- 記号: B = Best、S = Success、f = Counter Fail、– = 捕えず

| 候補 | s = 0.7（接触から） | s = 0.8 | s = 0.9 |
|---|---|---|---|
| Current | `BBBBBBBBBSSSSSfff…` | `ffSSSSSSSSSSSSfff…`（**Bestになり得ない**） | すべてf（届かない） |
| A | `BBBBBBBBBSSSSSSSSSSSfff…`（捕えられる範囲が広い） | `ffSSSSSSSSSSSSSSSSSSfff`（Bestにならない） | `ffffffSSSSSSSSSSSSSSfff`（Bestにならない） |
| B（14 / 24） | `BBBBBBBBBSSSSSfff…`（**Currentと同じ**） | `ffBBBBBBBBBBBBBBSSSSSffffff` | `ffffffBBBBBBBBBBBBBBSSSSSff` |
| C | Currentと同じ | `SSSSSSSSSSSSSSfff…`（Bestにならない） | `ffSSSSSSSSSSSSfff…` |

- A / Cは、tierがactiveの経過tick（`PUSH_ACTIVE_TICKS − 残り`）で決まる
  - 走ってから当たると、すでに経過しているので、**Bestになり得ない**
  - Aは、捕えられる範囲も広がる
- B（試作）:
  - 捕えられるのは、impact windowが開いているあいだだけ
  - tierは「最初の接触からの経過tick」で決める（`counterTier(impact)`）
  - 接触から始めたPushでは、Currentと完全に同じ
  - 走ってから当たっても、最初の接触tickを捕えればBest
  - Counterの結果と遷移の意味（Kuzushi、CounterTransitionの経路、`COUNTER_BEST_TICKS` = 3）は変えない
  - 変わるのは、tierに渡す経過tickの起点だけ

## Push vs Tsuppari

- 防御側がTsuppariを撃ったtickごとの結果
- 記号: C = Pushと連結（pair delta）、H = 普通の命中

| 候補 | s = 0.7 | s = 0.8 |
|---|---|---|
| Current | C×8 | 1 tickだけC |
| A | **C×14（連結が広がる）** | C×7 |
| B | C×8（Currentと同じ） | C×8（windowの長さ） |
| C | C×8 | C×3 |

## Push vs Push

- すべての候補で、同時Pushは打ち消し合う（両者のexternalは0のまま）
- 正面からの同時の突進（s = 1.0 / 1.2）は、A / B / Cでは出会って打ち消し合う
  - Bの接触は18 tick（両者のwindowが同時に開いて、8 tickで同時にrecoveryへ）
  - Currentは届かない（s ≥ 1.0）

## Kuzushi（ACTION-09B）

- Kuzushiの受け手への接触Push（接触から）
- B（14 / 24）の結果は、Currentと完全に同じ:
  - 最初のforce tick: Δv 0.65625 = 26.25 × 1.5 / 60
  - 次のtick: Δv 0.304167 = 1.0倍 − 減衰
  - 消費: そのtick
  - 合計の移動: 0.629271 m
- 理由:
  - Bでは、forceは `resolvePush` の同じ経路を通る
  - `wasKuzushi` による1.5倍の判定と消費は、何も変わらない

## Grip / ring-out / 衝突のarchitecture

- Gripは変えない（Push中の相手には有効でない）
- 接触とring-outは、既存のpure Simulationだけで足りる
- 次のものは要らない:
  - Phaser Physics
  - 壁
  - 縁での自動の制動
  - 突進専用の衝突

# 9. 推奨するACTION-10Bの設計（Option B）

## Push stateの形

- `{ kind: 'push', phase, ticksRemaining, direction, impactTicksRemaining: number | null }`
- 新しく足すfieldは1つだけ
- `null` = まだ接触していない
- 汎用のstate machineは足さない

## timingの値（User Decision）

| 項目 | 値 |
|---|---|
| startup | `PUSH_STARTUP_TICKS = 6`（変えない） |
| charge（activeの最大の長さ） | 新しい `PUSH_CHARGE_TICKS`。**14**（3倍）または**24**（自滅ring-outあり）。推奨は、空振りの自滅を要件とするなら24 |
| impact window | 既存の `PUSH_ACTIVE_TICKS = 8` を、そのまま「力の長さ」として使う（名前は `PUSH_IMPACT_TICKS` に変えてよい。値は1つにする） |
| recovery | `PUSH_RECOVERY_TICKS = 10`（変えない） |

## 規則

- **移動**:
  - `effectiveMove` はactiveのあいだ（windowの中でも）保存した `direction` で歩く
  - 既存の `FORWARD_ACCELERATION` / `MAX_SPEED` / `STOP_DECELERATION`
  - Push専用の加速度は要らない
- **力のwindow**:
  - activeで最初に `resolveContact` が接触を返したtick（Counter / forceの解決の前）に、`impactTicksRemaining = 8` を開く
  - `isPushActive` = active かつ window > 0
  - 力は既存の `resolvePush`（接触しているtickだけ。Kuzushiのfollow-upはそのまま）
  - windowの中で接触が切れても、windowは数え続ける（Currentのactive 8 tickと同じ）
- **進め方**:
  - windowが開いていれば、windowを数え、0でrecoveryへ
  - 開いていなければ、chargeを数え、0でrecoveryへ（空振り）
- **Counter**:
  - 捕えるのは `isPushActive` + 接触のとき
  - tierは `counterTier(impactTicksRemaining)`（最初の接触からの経過）
  - 結果と遷移は変えない
- **facing**: `updateFacing` で、Push中（startup〜recovery）の参加者を、Kuzushiと同じく飛ばす。canonical facingの持ち主はSimulationのまま
- **接触**: 既存の円の接触のまま
  - 横から擦れると、接線方向の成分は残り、方向は変えない
  - homingは無い
- **空振り**: chargeの最後まで走り切り、recoveryで制動して止まる
- **ring-out**: 既存の `resolveArenaRingOut` のまま。壁やclampは無い
- **予想される移動**:
  - 14: 0.386 m（3.05x）
  - 24: 0.938 m（7.41x）
  - 接触からのshoveは、どちらも0.5325 m（Currentと同じ）

## なぜ最小で安全か

- 変えるのは、state 1つのcounter、`isPushActive` / `advanceAction` / `counterTier` の入力、`updateFacing` の1条件だけ
- 移動の物理、接触、ring-out、Counter / Kuzushi / Tsuppariの規則は、そのまま
- 接触から始まるPushは、Currentと一致する（試作で、shove、Counterの押下の表、連結の長さが同じだった）

## 10Bで足すべきtest（参考）

- chargeの長さと移動（14 / 24）
- windowが最初の接触で開くこと
- 接触から始めたPushがCurrentと同じであること（shove、Counterの表、Tsuppariの連結）
- 空振りでrecoveryへ
- facingの凍結
- 縁での自滅ring-out（必要な移動の境界）
- 順序非依存

# 10. 却下した案

- **A**（activeを延ばすだけ）:
  - shoveが1.80x（0.957 m）、連結が14 tick
  - Counterで捕えられる範囲が広がり、走ってからだとBestになり得ない
  - 「Pushの衝撃をできるだけ保つ」に反する
- **C**（加速度を上げる）:
  - 8 tickで3 m/s
  - 0.8 mで、完璧な読みでも避けられない
  - 読める突進にならず、Push専用の加速度定数が増える
  - 3倍では自滅も出来ない
- **facing案2 / 3**: §6のとおり
- **専用のtackle衝突 / Phaser Physics / 回避の状態 / homing**: どれも要らない（既存の円の接触とring-outで、求める振る舞いが出た）

# 11. 検証

- 方法:
  - Node 24で、`src/game/sumo/*.ts` を直接import（type stripping）
  - scratchpadへコピーしたものだけを書き換え、variantを作った: base / A / B / B18 / B20 / B24 / B28 / C / Bfreeze
  - harnessも作った: `measure.mjs` / `measure2.mjs` / `measure3.mjs`
  - すべて決定的
  - baseのコピーで、Current Sourceの予想値（0.1 / 0.1267 / 1.333 / 24 tick）を再現した
- 必須のmatrixと、確かめた範囲:
  - 自由空間: すべての候補
  - 接触のshove: Current / A / B / B24 / C、Kuzushiの受け手も
  - dodge: 4つの距離 × 4つの反応 + 反応なし。Current / A / B / B24 / C
  - homingの追跡
  - 空振り / 通り過ぎ
  - edge: 円 / Tokudawara × 3つのmargin × 候補7つ
  - 中央での空振り
  - Counter: 押下tick 0〜26 × 3つの距離
  - Push vs Tsuppari: 撃つtick 0〜26 × 2つの距離
  - Push vs Push: 3つの距離
  - Kuzushiとの両立
- `git status`: clean（Productionの差分は0。commitするのはこのReportだけ）
- `git diff --check`: OK（このReportだけ）
- User Play Test: 不要（Investigation Only）

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- **要求の中の矛盾（§0）**: 「約3倍の移動」と「縁で空振りすると自滅ring-outし得る」は、両立しない
  - 押下時のfacingは、0.70 m以上前方の相手を向いている
  - そのため、空振りで外へ出るには0.70 m + 相手の余裕 以上の移動が要る
  - charge 24 tick（7.4x）なら両方の振る舞い（突進の読み合い + 自滅）が出る
  - Userに決めてもらう必要がある
- facingの所見（§6）は、10Bで直す候補として報告した（10Aでは直していない）
- ACTION-09BのARCHITECTUREにある古いGripの記述は、Taskの指示どおり触れていない

# Git Delivery

- stageするのは `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` だけ（Investigation-only Report Commit）。commit `docs(investigation): analyze push charge movement` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
