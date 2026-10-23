Task-ID: ACTION-12A-GRAPPLE-WASD-ROTATION-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 1fdf5b903bacf56e7a8e2f031a7f04190d0aae13
Agent-Start-Head: 7cd0d98a98da58bdde4356221d7f5f605c119f1a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation / Design、Production変更なし）

組み中（GRAPPLED）のWASDを、ペアの「回転だけ」にするruleを設計した。そのまま実装に入れる粒度にしてある。

- 推奨は**Option A（Tangential Projection / grapple footwork）**
- `ParticipantIntent.move`をそのまま使う
- 両者がREADYのときだけ、ペアをその中点の周りに剛体回転させる
  - 位置と、両者のcanonical facingを、同じ角度Δだけ回す
- 中点と0.70 mのbondは、そのまま保たれる
- Driveは、回転の後の軸で進める
- ring-outは、既存のruleがそのまま判定する
- 暫定の回転速度: `GRAPPLE_MANUAL_ROTATION_RATE = π/2 rad/s`

Current Sourceとの食い違いは無かった。Userの判断が要る項目もBLOCKERではなく、User Play Testで確かめる項目として残す（最後の節）。

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `1fdf5b9`（ancestor）、Handoff-Mode GITHUB
- `1fdf5b9..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `7cd0d98`
- このcommitは、AGENTS.md §13のInvestigation-only Report Commit Exceptionによる。変更は`CURRENT_COMPLETION_REPORT.md`だけ

# Current Source findings（前提1–12の確認）

| # | 前提 | Current Sourceの根拠 | 判定 |
|---|---|---|---|
| 1 | `ParticipantIntent.move`はWASDから作るworld-frameの正規化方向 | `BoutTypes.ts`の`move`（「World-frame movement direction. Length is clamped to at most 1」）。`movementVector.ts`の`movementVectorFromKeys`（上 = −y、右 = +x、斜めは1/√2）。`BoutScene.collectIntents`が毎tickこれを渡す | 一致 |
| 2 | FREEではgroundedな移動 | `step()`: `applyGroundedVelocity(p.selfVelocity, effectiveMove(p, move))` | 一致 |
| 3 | GRAPPLEDではWASDを`ZERO_MOVE`に抑える | `applyGroundedVelocity(p.selfVelocity, grappled ? ZERO_MOVE : …)`。comment「Grappled: ordinary WASD is suppressed for both (no grappled footwork yet)」 | 一致 |
| 4 | ArrowUpを押している間 → `driveHeld` | `BoutScene.collectIntents`: `driveHeld: this.upKey?.isDown` | 一致 |
| 5 | DriveはREADYのときだけ（`canActInGrapple`） | `step()`: `p.action = intents…driveHeld && ready(p) ? drive : idle`。`ready = canActInGrapple(p, other, startEngagement)` | 一致 |
| 6 | releaseはGripのedge + READY | `releasers = … gripPressed === true && ready(p)` | 一致 |
| 7 | Grappled Orientationは`GRAPPLE_TURN_RATE`で互いの方へ自動で向く | `updateFacing()` → `turnFacingTowardGrapple(…, GRAPPLE_TURN_RATE * TICK_SECONDS)`。`GRAPPLE_TURN_RATE = Math.PI` | 一致 |
| 8 | readinessは導出値で、保存しない | `grappleOrientation.ts`: 「Readiness is derived … nothing here is stored」。`isGrappleReady` = |facing error| ≤ 15° | 一致 |
| 9 | canonicalなbond = 0.70 m = 半径の和 | `resolveGrappleBond()`: 距離を`a.bodyRadius + b.bodyRadius`（各0.35）に対称に合わせる | 一致 |
| 10 | Driveはペアを平行移動し、軸は回さない | `updateGrappledExternal()`: tick開始時点の軸（A→B）に沿って、共有のexternal velocityを更新。位置は積分とbondだけ | 一致 |
| 11 | ring-outはcanonicalな位置から判定 | `resolveRingOutFrom(previousA, previousB)` → `resolveArenaRingOut`（tick開始 → 最終の直線補間、Tokudawara対応） | 一致 |
| 12 | 固定stepのSimulationが移動 / facingを持つ | `step()`は1 tick（`TICK_SECONDS = 1/60`）。Sceneは`FixedStepAccumulator`で駆動し、表示だけを行う | 一致 |

## 現在の`step()`の順序（GRAPPLEDに関わる部分）

1. Tsuppariの手のcooldown
2. CounterTransition中なら、別のstepにして終了
3. `previousA / previousB`を記録（ring-out用）
4. posture timer
5. tick開始時点のreadiness（`startEngagement`、`ready()`は`canActInGrapple`）
6. release（grappledで始まったtickのみ。READYのGrip edge）
7. `grappled`を確定。Driveの判断（READY + `driveHeld`）
8. 参加者ごとの処理: FREE actionの開始（grappledでは無し）、grounded self velocity（grappledでは`ZERO_MOVE`で制動）、FREEではexternalの減衰
9. grappledなら`updateGrappledExternal()`（この時点の位置から軸を取る）
10. 積分（self + external）
11. contact → grappledなら`resolveGrappleBond()`
12. action timer
13. `updateFacing()`（grappledでは自動の向き直り）
14. ring-out

## 関係する既存test（今回は変更しない。実行結果は下記）

- `BoutGrip.test.ts`
  - T103: 組み中に逆向きのWASD → 位置が完全に不変
  - T104: 組み中のPush / Counter / WASDは何もしない
  - T114: replay
- `BoutOrientation.test.ts`
  - T127: TURNING中にWASD → 軸が固定
  - T116–T126: readiness
- `BoutDrive.test.ts`
  - T132–T150: Drive、順序非依存、ring-out、replay
- `BoutRingOut.test.ts`、`src/game/input/*`
- 実行: 7 files、105 PASS（Current Sourceの挙動を確認）

# Option比較

| 観点 | **A: Tangential Projection（推奨）** | B: Desired World Bearing | C: 固定の時計 / 反時計ボタン |
|---|---|---|---|
| 意味 | 「押した方向へ、相手の周りを足で回り込む」。moveの接線成分だけを使い、半径方向は捨てる | moveを「自分が行きたい相手周りの方位」とみなし、その方位へペアを回す | 例えばA / D = 回転の向き、W / Sは無視 |
| 押さない保証 | 半径方向の成分を捨てるので、押す・引く入力は0になる | 方位の差を角速度にするので押さない | 押さない |
| WASDの一般性 | 4方向すべてが、今のペアの向きに応じて意味を持つ | 4方向すべてが意味を持つ | W / Sが死ぬ。Userの「WASDで回転」とずれる |
| 押し続けたとき | 押した方向が半径方向になる位置で、自然に止まる（安定な平衡）。行き過ぎない | 目標の方位で止まる | 押している間、回り続ける |
| 180°の曖昧さ | ちょうど反対側（自分が相手の真反対）では成分0で止まる（不安定な平衡）。長い遠回りは起きない | 真反対を押すと、どちら回りか決まらない。長い180°の回転が起きる | 無し |
| 2人の同時入力 | 2人の寄与の和を[−1, 1]にclamp。同じ向きでも倍にならず、逆向きは打ち消す | 2つの目標方位の合成が不自然（平均の方位？） | 単純な和 |
| 既存の入力との整合 | `movementVector`のworld-frameをそのまま使う。dummy / touch / gamepadも同じmoveを出せばよい | 同じmoveを使えるが、目標の計算が状態を持ちがち | 「回転の向き」という別の意味。keyの割り当てが別に要る |
| 実装量 | 小さい: 1つの純関数 + 剛体回転 | 中: 目標の方位、平衡、遠回りの扱い | 最小。ただしUserの要求に合わない |

推奨はA。理由:

- WASDの方向の意味（world-frame）を壊さずに、「押す成分」だけを機械的に0にできる
- 押し続けたときの到達点と停止が自然
- 180°の曖昧さとclampが単純な式で閉じる
- 既存の`move`をそのまま使える

# 推奨の入力の意味と、符号付きの回転式

座標はSimulationと同じcanvas座標（y下向き）。正の角度 = atan2の増加 = 画面上で時計回り。

```
m        = (A.position + B.position) / 2               // pair midpoint (tick-start, after release)
r̂_p      = normalize(p.position - m)                   // p's radial unit (r̂_B = -r̂_A)
t̂_p      = perp(r̂_p) = (-r̂_p.y, r̂_p.x)                // +angle tangent of p's orbit
c_p      = dot(sanitizeMove(intent_p.move), t̂_p)       // in [-1, 1]
intent   = clamp(c_A + c_B, -1, +1)
Δ        = intent * GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS
```

`d/dθ rotate(r, θ) = perp(r)`なので、Δ > 0のとき各参加者はそれぞれ自分の+t̂方向へ動く。c_p > 0は「pが押している向きに、p自身が回り込む」ことを意味する。

入力の例（scratchのscriptで確認。A = 左、B = 右の水平なpair、Aのfacing 0、Bのfacing π）:

| 入力 | intent | Δ/tick | 動き |
|---|---|---|---|
| AがW（上） | +1 | +1.5° | Aが上へ、Bが下へ（時計回り） |
| BがW | −1 | −1.5° | Bが上へ、Aが下へ（反時計回り） |
| AがD（相手の方 = 半径方向） | 0 | 0 | 動かない（押さない） |
| AがA（相手から離れる = 半径方向） | 0 | 0 | 動かない（引かない） |
| AがW + D（斜め） | +0.7071 | +1.0607° | 接線成分だけ |
| AがW + BがS（同じ回転の向き） | +1（clamp） | +1.5° | 倍にならない |
| AがW + BがW（逆の回転の向き） | 0 | 0 | 打ち消す |

## 参加者の並び順に依存しないことの証明

- mは対称式なので、並び順に依存しない
- t̂_pとc_pは、pの位置とm、pのmoveだけで決まる（index不要）
- intent = clamp(c_A + c_B)は和なので対称
- Δは、ペア全体に一様に当てる剛体回転
- 配列を入れ替えても、同じ物理的な結果になる
  - scratchで確認: Aが押す / 入れ替えてBの位置から同じ入力 → 最終位置が完全一致、Δ一致
- 一方だけの入力は、その参加者がAでもBでも、その本人が押した向きへ回り込む
- 同じ向きの協力は、clampで上限（±1）を超えない。等しい逆向きは0になる

# Pairの位置 / facingの更新（Simulation state、presentationではない）

```
if (Δ !== 0):
  m = (A.position + B.position) / 2
  for p in [A, B]:
    r = p.position - m
    p.position = m + rotate(r, Δ)            // (r.x cosΔ - r.y sinΔ, r.x sinΔ + r.y cosΔ)
    p.facing   = normalizeAngle(p.facing + Δ)
```

- 不変量:
  - mは前後で同じ
  - |A − B|は前後で同じ（= bond、0.70 m）
  - 各参加者のfacing error（相手への方位 − facing）は前後で同じ
- scratchで600 tick回し続けた結果:
  - |dist − 0.70|の最大は3.0e−15
  - 中点のずれは0
  - facing errorの最大は2.4e−15
- facingも同じΔだけ回すことが必要な理由:
  - 回さないと、毎tick facing errorがΔ（90°/sで1.5°）増える
  - 自動の向き直り（3°/tick）が毎tick追いかけて、READY / TURNINGの意味が「手動回転の追従」で汚れる
  - Δだけ回せば誤差は厳密に不変で、自動の向き直りは何もしない
- `Δ === 0`のときは、回転のblockを丸ごと飛ばす
  - `normalizeAngle`は −π を +π に写すので、facingが −π（`atan2(−0, −1)`）のときに、Δ = 0でも値が変わりうる
  - 飛ばせば、WASD = 0のときbitまで今と同一になる

# TURNING / READYの規則

```
manualRotationAllowed = grappledAfterRelease && ready(A) && ready(B)
```

- `ready`は、既存のtick開始時点の`canActInGrapple(p, other, startEngagement)`をそのまま使う
  - Release / Driveと同じsnapshot
  - 新しいstateは作らない
- どちらかがTURNINGなら、そのtickの手動回転は無効（両者のWASDとも）
  - 自動の向き直りと手動入力が干渉しない
  - 横・背後からのGripは、まず向き直りを終える
- 両者がtick開始でREADYになった最初のtickから回せる（Drive T135と同じ「次のtickから」）
- 評価の順番: `ready()`は、その時点のpositions / facingを読むclosure
  - 回転の前に、Driveの判断と同じタイミングで評価する（回転の後に呼ばないこと）
- Morozashi: holder / disadvantagedとも、同じ回転の権限を推奨（理由は最後の節）

# Drive + 回転の順序

| | Ordering 1（推奨）: 回転 → 回転後の軸でDrive → 積分 | Ordering 2: tick開始の軸でDrive → 積分 → 回転 |
|---|---|---|
| 応答 | 同じtickの回転が、そのtickのDriveの向きに反映される | Driveの向きが1 tick遅れる |
| WASD = 0のとき | Δ = 0で回転を飛ばすので、今と同一 | 同一 |
| 決定性 / 順序非依存 | どちらも決定的 | 同じ |
| externalVelocity | Driveは、回転後の軸で共有external velocityの軸方向成分を更新する（既存の`grappledExternalVelocity`をそのまま使う） | tick開始の軸の成分 |
| 実装 | 回転をDriveの判断の直後、`updateGrappledExternal()`の前に置くだけ。`updateGrappledExternal()`は呼ばれた時点の位置から軸を取るので、変更不要 | 積分の後に回転を置くので、ring-out直前の位置を更に動かす。bondの後の再bondが要るか検討が要る |

推奨: Ordering 1。

- `updateGrappledExternal()`の「tick-start pair axis」のcommentは、「回転後の軸」に直す必要がある（将来のImplementation）
- Driveの値（速度0.6 m/s、加速度4 m/s²、Morozashi 1.5倍）は変えない

# Velocityの扱い

推奨:

- 手動回転は、canonicalな位置とfacingだけを変える。速度・impulseは足さない
- `selfVelocity`: grappledでは既存どおり`ZERO_MOVE`で制動（実質0）。回転は書かない
- 共有`externalVelocity`: 回転させない（world-frameのまま）
  - Driveと残りの勢いは、world-frameのcanonical stateとして扱う
  - 回転のたびに勢いの向きを回すと、「回転で勢いが曲がる」別のgameplayになる
- Snapshotの`velocity`: self + externalのまま。回転による軌道上の移動（最大0.55 m/s）は含まない
  - CounterTransitionは、path変位を速度として報告している（`stepCounterTransition`）が、そこは位置の唯一の持ち主がpathの特殊ケース
  - 組み中のSnapshot velocityを読む既存の利用先を確認した:
    - presentation: `wrestlerVisualState`の`locomotionSpeed`は、grappledではposeがgrapple / driveなので使われない
    - dummy: 組み中はvelocityを読まない
    - HUD: pair vはexternalだけ
  - 実害は無い
- 現在の積分 / bondの順序で問題が出ないか:
  - 回転は積分の前で、Δ > 0でもbond距離は厳密に保たれる
  - その後の積分（共有externalなので2人とも同じ量）と`resolveGrappleBond()`は、従来どおり
  - 回転由来の距離の誤差は、浮動小数の丸めだけ（bondが毎tick吸収する）

# Ring-outの扱い

- 特別な扱い（免除）は無い。回転で中心が境界を越えれば、既存の`resolveArenaRingOut`が普通に判定する
- 既存の仕組みで足りる理由:
  - `previousA / previousB`はtick開始に記録している
  - 回転は同じtickの中の位置変化なので、previous → 最終の直線補間に含まれる
  - 補間は円弧ではなく弦。Δは1 tickで最大1.5°なので、弦と円弧の差はおよそr·Δ²/8 ≈ 0.35 × (0.026)² / 8 ≈ 3e−5 m
  - ring-outの「内部の解決ステップは別のイベントにしない」model（`ringOut.ts`のheader）とも整合する
  - Tokudawaraもそのまま効く
- gameplayとしての性質:
  - 中点を中心に回るので、片方が外へ出るとき、もう片方は内へ入る（1次近似）
  - つまり縁の近くでは、「相手を外へ回す」と「自分が外へ出る」が、回転の向きで決まるtradeoffになる。正当な技として成立する（暫定）
- 同時のring-out:
  - 2つの中心は、中点からの距離が同じ。片方が出るとき、もう片方は（1次では）入る
  - 2人が同じ瞬間に出るのは、退化した配置（中点がすでに縁の外寄り、など）に限られる
  - その場合も、既存のsimultaneous → rematchのruleが判定する
  - 新しいruleは不要

# 暫定の回転速度

`GRAPPLE_MANUAL_ROTATION_RATE = π/2 rad/s`（90°/s）を推奨する。User Play Testの調整値で、Accepted balanceではない。

| 比較 | 値 |
|---|---|
| 自動の向き直り`GRAPPLE_TURN_RATE` | π rad/s（180°/s） |
| 手動回転（推奨） | π/2 rad/s（90°/s）→ 1.5°/tick |
| 軌道半径（bond 0.70 mの半分） | 0.35 m |
| 足の接線速度 | 0.35 × π/2 ≈ **0.55 m/s** |
| 参考: Driveの目標速度 | 0.6 m/s（neutral）/ 0.9 m/s（Morozashi holder） |
| 参考: FREEの最高速度 | 3 m/s |
| 左（A）から上へ回り込む（W押しっぱなし、90°） | 約2.07 s（124 tick）。目標に近づくほど接線成分が減り、緩やかに止まる |

- 手動回転を自動の向き直りより遅くするのは、手動回転でTURNINGの意味を追い越さないため
- Driveと同程度の足の速さにした

# 入力 / Intentの持ち主

推奨: 既存の`ParticipantIntent.move`を使う（新しいfieldは足さない）。

- 理由:
  - moveは入力源に依存しないworld-frameの足の向き
  - 同じ物理的な入力が、Simulationの状態で意味を変える（FREE = 移動、GRAPPLED = 回り込み）だけ
  - 入力の状態を二重に持たない
  - raw keyのlogicをSimulationへ入れない
- 必要な変更（将来）:
  - `BoutTypes.ts`の`move`のcommentに、「GRAPPLED + 両者READYでは、接線成分だけがペアの回転になる（押さない）」を追記する
  - `step()`の「no grappled footwork yet」のcommentも直す
- touch / gamepad: 同じworld-frameのmoveを出せば、そのまま動く

# Dummy / CPU harness

- `PushDummyController`は、組み中は常に`GRAPPLED_DRIVE = { ...NO_INPUT, driveHeld: true }`を返す
- 「`move = {0, 0}`」を確認した。stationaryの`NO_INPUT`もmove 0
- このため、提案の設計でもdummyは回転しない（意図して回転を要求しない限り）
- harnessの変更は不要。CPU AIの設計はしていない

# 将来の変更fileの候補

| file | 変更 |
|---|---|
| `src/game/sumo/BoutSimulation.ts` | `GRAPPLE_MANUAL_ROTATION_RATE`（暫定、User Play Test）。純関数`grappleManualRotationIntent(a, b, moveA, moveB)`（またはそれに相当するもの）。`step()`の回転block。commentの修正（WASD抑制 / tick-start axis） |
| `src/game/sumo/grappleOrientation.ts`（任意） | 角度・接線のhelperを置くなら、ここ（`normalizeAngle`は既にある）。readinessの意味は変えない |
| `src/game/sumo/BoutTypes.ts` | `move`のcommentだけ |
| `src/game/sumo/BoutGrapple*.test.ts`（新規）または`BoutGrip.test.ts` / `BoutDrive.test.ts` | 下のmatrix |
| 既存testの更新（意図した挙動変更） | T103 / T104（READYのneutral pairで組み中にWASD → 今は不変を期待している。今後は回転するので、半径方向の入力だけで不変を見る形などに直す）。T127はTURNINGのまま入力しているので、gateで今も成立するはず（要確認）。T114 / T150のreplayは決定性のtestなので、値は変わっても成立 |
| `docs/ARCHITECTURE.md` | 組み中の操作の説明（WASD = 回転）。Implementation Taskで |
| `src/game/scenes/BoutScene.ts` | 変更不要（moveは既に毎tick渡している）。操作説明の文字列を変えるならそれだけ |

# 将来の実装の手順（`step()`の正確な順序）

1. Tsuppariのcooldown / CounterTransition / `previousA, previousB`（不変）
2. posture timer（不変）
3. tick開始のreadiness（`startEngagement`、`ready()`）（不変）
4. release（不変）。release tickは`grappled = false`になり、回転しない
5. `grappled`を確定。Driveの判断（不変）
6. **NEW: 手動回転**
   - `grappled && ready(A) && ready(B)`のとき:
     - `intent = clamp(c_A + c_B)`、`Δ = intent * GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS`
     - `Δ !== 0`なら、位置とfacingを中点の周りに剛体回転する
   - `ready()`は、ここで回転より前に評価する
7. 参加者ごとの処理（不変）: FREE actionの開始は無し。selfは`ZERO_MOVE`で制動
8. `updateGrappledExternal()`（不変）。回転後の位置から軸を取る（Ordering 1）
9. 積分（不変）
10. contact → `resolveGrappleBond()`（不変）
11. action timer（不変）
12. `updateFacing()`（不変）。READYのpairでは誤差が不変なので、実質何もしない
13. ring-out（不変）。回転を含むprevious → 最終で判定

WASD = 0（または半径方向だけ、または相殺）なら、6はΔ = 0で丸ごと飛ばす。現在の挙動とbitまで同一。

# Boundary-case verification matrix（将来のImplementation用、省略しない）

| # | case | 期待 |
|---|---|---|
| 1 | READYのneutral。片方が1方向（例: AがW、水平pair） | Δ = +RATE·dt（+1.5°/tick）。Aが上、Bが下。中点・距離は厳密に不変。external / selfは変わらない |
| 2 | 斜め（W + D） | intent = 0.7071、Δ = 1.0607°/tick |
| 3 | 半径方向（相手へ / 相手から） | Δ = 0、位置・facingはbitまで不変（押さない / 引かない） |
| 4 | 接線方向 | 4方向すべて、pairの角度ごと（0°、45°、90°、…）に、正しい符号 |
| 5 | 両者が同じ回転の向き | intent = 1（clamp）、速度は1人のときと同じ |
| 6 | 両者が逆の回転の向き | intent = 0、Δ = 0 |
| 7 | 片方がTURNING（横 / 背後のGrip直後） | 両者のWASDとも回転しない。自動の向き直りは従来どおり（T117 / T118の進み方が不変） |
| 8 | TURNING → 両者READY | READYで始まった最初のtickから回転する（それより前のtickは0） |
| 9 | WASD + Drive同時 | 同じtickで回転してから、回転後の軸でDrive。WASD = 0のDriveの値は、T132–T141と同一 |
| 10 | release + WASD同じtick | releaseが優先。そのtickは回転しない。FREEの移動は既存どおり（releaserはrecoveryで不動） |
| 11 | 縁の近くで回転 → 片方がring-out | 既存のruleで、出た側が負け。回転の向きを逆にすれば、相手側が出る |
| 12 | 縁の近くで同時のring-out（退化配置） | 交差の時刻が同じ（1e−9以内）ならrematch。それ以外は早い方が負け |
| 13 | Morozashiのholder / disadvantaged | 同じ回転の権限（READYのとき）。Drive factorは回転に掛けない |
| 14 | WASD = 0 | 既存のDrive / Orientation / Grip / RingOutのtestがすべて不変（T103 / T104だけは意図して更新） |
| 15 | fixed-step / frame-rate非依存 | Δは`RATE · TICK_SECONDS`だけ。Sceneのframe deltaは使わない。replay（T114 / T150と同型）が一致 |
| 16 | 参加者の並びを入れ替え | 同じ物理的な結果（位置・facingが対応して一致）。片方の入力で、その本人が押した向きへ回る |
| 追加 | 長時間の回転 | bond 0.70 m、中点不変、facing errorが不変（READYを保つ）、NaNなし |
| 追加 | 押し続けたときの停止 | 押した方向が半径方向になる位置で止まる。行き過ぎない |
| 追加 | dummy（Mode 2） | 組み中もmove 0で、回転しない |

# User Play Testで確かめる項目（BLOCKERではない）

1. 回転速度90°/s（暫定）の手触り
2. Morozashiで回転の権限を同じにすること
   - 推奨は同じ。権限に差をつけるなら、例えばholderのclamp上限を上げる、disadvantagedの寄与を下げる、などを後で検討する
3. 縁の近くで、回転で相手を外へ出せること
   - 推奨は「正当な技」として許すこと
   - 強すぎる場合は、後で回転速度か、縁の近くでの減速を検討する（このTaskでは新しいruleは作らない）
4. 真反対（自分が相手の真後ろ側）を押したとき、成分が0で動かないこと（不安定な平衡）が、違和感にならないか

# Design Deviations

Design Deviations: N/A（Investigation）

# Unexpected Scope

- 無し
- 参考: `updateGrappledExternal()`のcomment（「tick-start pair axis」）は、Ordering 1の実装時に直す必要がある（今回は変更していない）

# Verification

- source inspection:
  - `AGENTS.md`、`docs/ARCHITECTURE.md`（関連部分）
  - `BoutTypes.ts`、`BoutSimulation.ts`（`step`、`updateGrappledExternal`、`resolveGrappleBond`、`updateFacing`、`grappledExternalVelocity`、`effectiveMove`）
  - `grappleOrientation.ts`、`ringOut.ts`、`movementVector.ts`、`pushDummyController.ts`、`BoutScene.collectIntents`
- 既存testの読み込み:
  - `BoutGrip.test.ts`のT103 / T104 / T114
  - `BoutOrientation.test.ts`のT116–T129
  - `BoutDrive.test.ts`のT131–T150
- 既存testの実行: `BoutGrip` / `BoutDrive` / `BoutOrientation` / `BoutRingOut` / `src/game/input`で7 files、105 PASS
- scratch script（scratchpadの`rot12a.mjs`、commitしない）:
  - 符号、半径方向が0、斜め、clamp、相殺、並び順の入れ替え
  - 600 tickの不変量（距離 / 中点 / facing error）
  - 回り込みの時間
- Production / docs / tests / assetsの変更: なし（`git status`で確認）

# Git delivery

- Investigation-only Report Commit Exception（AGENTS.md §13）: 変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`だけ
- 1 commit（`docs(agent): report ACTION-12A-GRAPPLE-WASD-ROTATION-INVESTIGATION`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
- User Play Test: このInvestigationでは対象外。将来のImplementationでは、回転の手触り・速度・操作にUser Play Testが必須
