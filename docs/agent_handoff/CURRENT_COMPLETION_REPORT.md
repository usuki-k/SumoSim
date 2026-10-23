Task-ID: ACTION-12B-GRAPPLE-WASD-ROTATION-IMPLEMENTATION
Result: PASS WITH USER PLAY TEST REQUIRED
Branch: develop
Source-Baseline: bdc016064be076a592dca3428ebb33d87dc1e742
Agent-Start-Head: ab9168ac2871759194269be5153c585c449662eb
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER PLAY TEST REQUIRED:

- Technical PASS（Heavy）
  - B1–B19をすべて自動testでPASS（NOT RUNなし）
  - `pnpm test` 31 files / 542 PASS、`pnpm build` PASS、`git diff --check` clean
  - Browser Smoke 11 / 11 PASS（GPU、実際のkeyboard入力）
- 手触りの受け入れは、User Play Testで判断する

ACTION-12AのOption Aを、そのまま実装した。

- GRAPPLEDで両者がREADYのとき、既存の`ParticipantIntent.move`（WASD）のうち接線成分だけが、ペアを中点の周りに回す
- 中点の平行移動・押し・impulseは無い
- 0.70 mのbond、Drive、Grappled Orientation、ring-outの持ち主は変わらない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `bdc0160`（ancestor）、Handoff-Mode GITHUB
- `bdc0160..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `ab9168a`
- ACTION-12Aのreport（`af45d5d`）以降、`src/`の変更は無い。Current SourceはACTION-12Aの設計と一致

# 変更したfile

| file | 変更 |
|---|---|
| `src/game/sumo/BoutSimulation.ts` | `GRAPPLE_MANUAL_ROTATION_RATE = Math.PI / 2`。純関数`grappleManualRotationIntent`、`rotateGrappledPair`（export、test用）。`step()`の回転block。commentの修正（stepの順序、組み中のWASD抑制、`updateGrappledExternal`の軸） |
| `src/game/sumo/BoutTypes.ts` | `ParticipantIntent.move`のcomment（FREE = locomotion、GRAPPLED + 両者READY = footworkの接線成分だけ、TURNING = 無視） |
| `src/game/scenes/BoutScene.ts` | debugの操作説明を`WASD move/rotate`に（gameplayの式は無い） |
| `src/game/sumo/BoutGrappleRotation.test.ts`（新規） | 純関数のtest 2件 + B1–B19 |
| `src/game/sumo/BoutGrip.test.ts` | T103: 組み中の逆向きWASDの入力を、半径方向（軸に沿って離れる向き）に変えた。「不動」の主張はそのまま |
| `src/game/sumo/BoutOrientation.test.ts` | T127: WASDを押したまま、どちらかがTURNINGのtickでは毎tick軸が固定、を見る形に変えた。TURNINGのtick数が40より多いことも確認 |
| `docs/ARCHITECTURE.md` | 組み中のWASDの1文を修正。Grapple footworkの項目を追加 |
| `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` | このreport |

変更していないもの:

- `src/game/input/`（`movementVector` / `pushDummyController`）
- `src/game/presentation/`、`public/`、`tools/`（diff 0）
- `grappleOrientation.ts`（`GRAPPLE_TURN_RATE` / `GRAPPLE_FACING_TOLERANCE`）
- Driveの定数
- Grip VFX（ACTION-11N）
- `PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

既存testの扱い:

- T104（組み中のPush / Counter edgeとWASDではactionもexternalも変わらない）は、回転がactionと勢いを変えないので、そのまま通る
- 削除したtestは無い

# 関数の持ち主と式

- 持ち主: `BoutSimulation.ts`（Driveの定数・関数の隣）。`grappleOrientation.ts`はreadinessの意味だけを持つので、そこには置かなかった
- 速度: `GRAPPLE_MANUAL_ROTATION_RATE = Math.PI / 2`（90°/s、60 Hzで1.5°/tick）。`GRAPPLE_TURN_RATE`とは別の暫定値（User Play Test対象）

```
r      = (A.position - B.position) / 2        // A - midpoint;  B - midpoint = -r (exact)
c_A    = dot(sanitizeMove(move_A), (-r.y,  r.x) / |r|)
c_B    = -dot(sanitizeMove(move_B), (-r.y,  r.x) / |r|)     // B's own tangent is -(A's)
intent = clamp(c_A + c_B, -1, +1)
Δ      = intent * GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS
if Δ !== 0:  both positions rotate about the midpoint by Δ; both facings = normalizeAngle(facing + Δ)
```

- 座標: +x右、+y下。正の角度 = atan2の増加 = 画面上で時計回り
- Bの`r`はAの`r`の符号反転そのもの。このため、等しい逆向きの入力は厳密に0になり、参加者の並びにbit単位で依存しない
- 最初はTaskの式どおり、中点からそれぞれ`r`を計算していた。その場合、逆向きの入力が丸めで1e−17程度残り、`intent !== 0`で回転blockが走ってしまった（B14で検出）
  - 数学的には同じ式なので、Design Deviationではない

# `step()`の順序（実装後）

1. Tsuppariのcooldown
2. CounterTransitionの別path
3. `previousA / previousB`の記録（ring-out用）
4. posture timer
5. tick開始のreadiness（`startEngagement`、`ready()`）
6. grappleのrelease
7. `grappled`の確定
8. grappled Driveの判断
9. **NEW: 手動回転**
   - `grappled && ready(a) && ready(b)`のときだけ
   - `ready()`は、回転より前に評価する
   - `intent !== 0`のときだけ回転する
10. 参加者ごとの処理: FREE actionの開始は無し。selfは`ZERO_MOVE`で制動
11. `updateGrappledExternal()`（回転後の軸を、その時点の位置から読む）
12. 積分
13. contact
14. bond
15. action timer
16. facing（自動の向き直り）
17. ring-out

# B1–B19 matrix（`BoutGrappleRotation.test.ts`、すべて自動）

| # | case | 結果 | 確認したこと |
|---|---|---|---|
| B1 | 片方の方向キー（水平、左のPlayerがW） | PASS | Δ = +1.5°。Aが上、Bが下。中点・bond（1e−12）。velocityは0。facing errorは < 1e−12 |
| B2 | 斜め W + D | PASS | Δ = 0.7071 × 1.5° |
| B3 | 半径方向（相手へのD、相手から離れるA） | PASS | 30 tickで、位置とfacingがbit単位で不変。velocity 0（押し / 引きなし） |
| B4 | pairの軸0 / 45 / 90 / 135° × W / A / S / D × 押す側（A / B） | PASS | 32通りすべてで、Δ = 接線成分 × 1.5°（式どおり）。押した本人は、押した向きへ動く |
| B5 | 2人が同じ回転の向き | PASS | clampで1人のときと同じ1.5° |
| B6 | 逆の回転の向き | PASS | 30 tickで、位置がbit単位で不変 |
| B7 | TURNING中 | PASS | 背後からの組み（Bが55 tick前後TURNING）。両者がWASDを押していても、毎tick入力なしのrunとSnapshotが完全一致（自動の向き直りも不変） |
| B8 | 最初の両者READYのtick | PASS | そのtickから回転（式どおり） |
| B9 | WASD + Drive | PASS | 同じtickで回転してからDrive。external velocityは回転後の軸の向き（角度Δ）、大きさは4 m/s² × dt。Driveだけのrunと大きさが同じ。60 tick続けると軸が回り続ける |
| B10 | Release + WASD | PASS | releaseが優先（FREE）。releaserはGrip recoveryで不動、相手はFREEの通常移動。WASDなしのreleaseと完全一致 |
| B11 | 縁の近くで片方がring-out | PASS | radius 1、pairは縁に接する向き。Wで回すとA（回した本人）が出て負け、Sで回すとBが出て負け。出た側の中心は外、勝った側は内 |
| B12 | 同時のring-out | **NOT APPLICABLE（証明 + 境界case）** | 純粋な回転では同時には出られない（下記）。境界の配置（両者が線の1e−9内側、r ⟂ m）で、どちら向きに回しても1 tickで片方だけが出る（outcomeはwin） |
| B13 | Morozashiのholder / disadvantaged | PASS | holderのW、disadvantagedの同じ向き（S）で、同じΔ、同じ最終位置。sourceに、Drive factorを回転へ掛ける記述が無い |
| B14 | WASDが0、半径方向だけ、相殺 | PASS | 背後の組み（TURNING → READY）の120 tick。0入力と相殺（W / W、同じ斜め）は、入力なしのrunとSnapshotが完全一致。実際の軸から浮動小数で作った半径方向の入力は、1e−12以内で一致 |
| B15 | fixed-stepの決定性 | PASS | 回転 / 斜め / Drive / releaseを混ぜたscriptを2回実行して、Snapshotが完全一致。`step(intents)`にrender deltaは無い |
| B16 | 参加者の並びを入れ替え | PASS | 3種類のscript × 20 tickで、idごとの位置・facingが一致（1e−12） |
| B17 | 長時間の回転 | PASS | 600 tick（向きを変えながら）。bond 0.70（1e−9）、中点のずれ < 1e−12、両者のfacing errorは常に15°以内（READY）、NaNなし |
| B18 | 自然な停止 | PASS | Wを押し続けると、1 tickの回転は単調に減り、逆転しない。「Aが真上」（π/2）を越えず、最終はπ/2に収束 |
| B19 | dummy | PASS | Mode 2（push）のdummyは、組み中も`move = (0, 0)`、Drive held。120 tickで軸が不変 |

純関数のtest（追加）:

- `grappleManualRotationIntent`:
  - W = +1、S = −1、D / A（半径方向）= 0、BのW = −1
  - 同じ向き → 1、逆向き → 0
  - 並びの入れ替えで同値、centerが一致するときは0
- `rotateGrappledPair`:
  - 中点・距離・facing errorが不変
  - Δ = 0でも−πは+πに変わる。これが、step()がintent 0のときblockを飛ばす理由。sourceがそう書かれていることも確認

## B12の証明

A = m + r、B = m − rとすると、|A|² − |B|² = 4 m·r。2人の距離が等しいのは、r ⟂ mのときだけ。

回転で、rはm·(dr)だけ変わる。このとき|A|²は+2 m·dr、|B|²は−2 m·dr変わり、符号が逆になる。つまり、2人が同時に境界上にいる瞬間には、片方は外へ、もう片方は内へ動く。

例外はm·dr = 0、つまりm = 0（中点が土俵の中心）だが、その場合2人とも半径0.35 mの円の上にいて、外へは出ない。

純粋な回転で同時のring-outは起きない。Driveとの同時押しで2人とも外へ出る場合は、既存のsimultaneous / rematchのruleがそのまま判定する（新しいruleは無い）。

# Browser / Runtime Smoke（11 / 11 PASS）

- 環境: headless Chrome 156 + CDP、GPU（`--use-angle=d3d11`）、Vite dev server、1920x1080
- 入力: Playerは実際のkeyboard（CDPのkey event）
- 記録: `BoutSimulation.step`を読み取り専用でhookし、tickごとに入力と前後のSnapshotを記録した
- 判定: 組み → 組みの全tickで、観測した軸の回転が独立に計算した式（両者READYの判定 + 接線成分の和のclamp）と一致するかを照合した

| # | 確認 | 結果 |
|---|---|---|
| 1 | 正面のGrip → 組み（両者READY） | PASS |
| 2 | 半径方向のWASD（Dで相手へ / Aで離れる） | PASS: 76 tickすべてで位置がbit単位で不変（押し / 引き / 回転なし） |
| 3 | W押しっぱなしで回り込む | PASS: 43 / 106 tickで回転、合計54.29°。式との差は最大2.8e−16、bondの誤差1.1e−16。中点は不動、velocityは常に0 |
| 4 | 斜めのW + D | PASS: 30 tickで式どおり。最初のtickは1.4803°（最大1.5°未満。半径方向の成分は捨てている） |
| 5 | W + ArrowUp（Drive） | PASS: 同じtickで回転とDrive。最初のDriveのexternalの角度92.7635°が、回転後の軸92.7635°と一致（回転前は92.8378°） |
| 6 | 背後のGrip（TURNING）→ READY | PASS: Morozashi（holder = Player）。W押しっぱなしでも、TURNINGの55 tickは軸が完全に固定。最初の両者READYのtick（index 55）から回転（その後171 tick） |
| 7 | Release + W | PASS: releaseのtickでFREEになり、releaser（Grip recovery）は不動。回転なし |
| 8 | 縁の近くでの回転によるring-out | PASS: 実際の土俵（radius 2.275、Tokudawara付き）で、ペアの開始位置だけを45°方向の縁に接する向きに置いたSimulationをSceneに差し込んだ。Wでwrestler-bが外（\|c\| 2.2772）、Sでwrestler-aが外（\|c\| 2.2760）。既存のring-outで、どちらも決着 |
| 9 | Morozashiでの回転 | PASS: holder（PlayerのW）も、disadvantaged（CPUのmoveをSに差し替え）も、式どおりに回る。1 tickは最大1.5°以内 |
| 10 | Rでrestart | PASS |
| 11 | console error・例外・失敗request | PASS: 0件（既存の`/favicon.ico` 404は除外） |

smokeの補足:

- 最初の実行では8がFAILした。勝敗が決まった後のfrozenなtick（`step()`は何もしない）を、確認scriptの照合に含めていたため。照合から外して再実行した（productの問題ではない）
- 9でholderとdisadvantagedの1 tickの回転量が違う（1.5°と1.23°）のは、先にholderが回して軸が水平でなくなり、Sの接線成分が小さくなったため。各tickは式と一致している

screenshot（scratchpadの`smoke12b\`、commitしない）:

- `01_front_before_rotation`
- `02_front_after_W`
- `03_w_plus_drive`
- `04_turning_w_held`
- `05_after_ready_rotated`
- `06_morozashi_rotation`
- `07_edge_W`、`07_edge_S`
- 一覧: `sheet12b.png`

描画も正常だった。回り込むと、Grip successのart（ACTION-11N）がcanonicalなfacingに付いて一緒に回る。縁の例では、片方が俵の外へ出ている。

# Ring-outの観察

- 特別なruleは無い（`resolveRingOutFrom(previousA, previousB)`のまま）
- 回転を含む、tick開始 → 最終の直線補間で判定する
- 縁に接する向きのペアでは、回す向きで「自分が出る」か「相手を出す」かが決まる（B11、smoke 8）
- 縁の近くでの減速は入れていない（Taskどおり）

# Drive + 回転の観察

- 回転 → 回転後の軸でDrive（Ordering 1）
- Driveの値（0.6 m/s、4 m/s²、Morozashi 1.5倍）と、net / strengthの計算は不変
- 既存のexternal velocityは回さない（world-frameのまま）。Driveが毎tick、そのときの軸の成分を更新する

# Zero入力の回帰

- WASD = 0、半径方向（離散方向が軸と一致する場合）、等しい逆向きの相殺では、回転blockを飛ばす。従来とbit単位で同一（B3 / B6 / B14、smoke 2）
- 既存のtestは、意図して変えたT103 / T127以外、すべて不変でPASS
  - Grip / Orientation / Drive / RingOut / Tokudawara / inputのfocusedで9 files / 152 PASS

# Implementation Evidence

| Design Requirement | 実装 | 検証 |
|---|---|---|
| 1. 接線への射影だけ | `BoutSimulation.ts`の`grappleManualRotationIntent`。上記の式（半径方向は寄与0、clamp） | B1–B6、B18、純関数test、smoke 2–4 |
| 2. 中点の周りの剛体回転 / bondの保存 | `rotateGrappledPair`（位置を中点の周りに回転、facing += Δを正規化） | B1、B17、純関数test、smoke 3 |
| 3. 両者READYのgate | `step()`でDriveの判断の直後、`grappled && ready(a) && ready(b)`。tick開始の`ready()`を回転より前に評価 | B7、B8、smoke 6 |
| 4. Driveより前の回転 | 回転block → `updateGrappledExternal()`（その時点の位置から軸を取る） | B9、smoke 5 |
| 5. velocity / impulseの持ち主は不変 | 回転は`position`と`facing`だけを書く。`selfVelocity` / `externalVelocity` / Snapshotの`velocity`には触れない | B1（velocity 0）、B9（Driveの大きさが同じ）、smoke 3（全tickでvelocity 0） |
| 6. ring-outは既存のまま | 新しいruleは無い | B11、B12（証明 + 境界case）、smoke 8 |
| 7. 参加者の並びに依存しない | 対称な和。Bの`r = −r_A`で、bit単位で反対称 | B16、純関数test、B6 / B14の完全一致 |

# Design Deviations

Design Deviations: NONE

- 式はTaskどおり（`r = p − m`、`t̂ = (−r̂.y, r̂.x)`、`clamp(c_A + c_B)`）
- 実装では、Bの`r`をAの`−r`として計算する。数学的には同一で、浮動小数でも逆向きの入力が厳密に0になる

# Unexpected Scope

- 無し
- 参考: `rotateGrappledPair`をtest用にexportした（Simulationの外からstateは変えない）

# Known Untested Items

- 実機のTouch入力 / gamepad（Taskの範囲外。moveを出せば同じように動く設計）
- smoke 8は、Sceneの実際の土俵・Tokudawara・step loopで行ったが、ペアを縁へ運ぶところは操作ではなく、開始位置の差し込みで作った
  - 操作だけで「縁に接する向き」まで運ぶのは、Drive + 回転で可能だが、自動で再現するのが不安定なため
  - 同じ判定の流れは、B11のunit testでも確認した

# User Play Test: REQUIRED

- 回転速度90°/s
- WASDのworld-frameの意味（押した向きへ回り込む）と、斜めの感触
- 半径方向（相手への / 相手から）の入力で何も起きないこと
- WASD + Driveの手触り
- 縁でのrisk / reward（回して相手を出す / 自分が出る）
- Morozashiで回転の権限が同じこと
- 回転が、滑る・押すではなく、足さばきに感じられるか

Technical PASSは、gameplayの受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(gameplay): add grapple wasd rotation`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
