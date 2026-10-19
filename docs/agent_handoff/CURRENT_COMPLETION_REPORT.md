Task-ID: ACTION-05B1-GRAPPLED-ORIENTATION-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 61a1a493a54a02cc7d171f3c70d722a6640f871f
Agent-Start-Head: 02e3aa652d8f0b1c9368b6559ee341a640155da5
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 163/163、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**
- User Play Test: **REQUIRED / NOT RUN**

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `61a1a49`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `61a1a49..origin/develop` の変更は `docs/agent_handoff/` 配下のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `02e3aa6`

# Changed Files

- `src/game/sumo/grappleOrientation.ts`（新規、pure、Phaser非依存）: 定数`GRAPPLE_TURN_RATE` / `GRAPPLE_FACING_TOLERANCE`、`normalizeAngle` / `grappleFacingError` / `isGrappleReady` / `turnFacingTowardGrapple` / `canActInGrapple`
- `src/game/sumo/BoutSimulation.ts`: releaseに準備完了の条件を追加、GRAPPLED中の`updateFacing`を一定速度の旋回に変更
- `src/game/sumo/BoutOrientation.test.ts`（新規）: T115〜T129
- `src/game/scenes/BoutScene.ts`: `READY` / `TURNING n°`表示（共有helperを使用）
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更なし: `BoutTypes.ts`（canonical fieldの追加は不要）、既存test（**修正0件**で148件PASS）、Dummy、AGENTS.md。新規dependencyはなし。

# User Decisions Implemented

- UD-1: `GRAPPLE_TURN_RATE = Math.PI`（180°/s）
- UD-2: `GRAPPLE_FACING_TOLERANCE = Math.PI / 12`（15°）
- UD-3: TURNING中のShiftは無視（queueもrecoveryもなし）。READYの者だけがreleaseできる
- UD-4: participant起点のgrapple actionは、すべて`canActInGrapple`を通す。現時点の対象はreleaseだけ。受動的な旋回は継続する

# Angle Normalization / Exact π Tie

- `normalizeAngle`: `%`で剰余を取り、(−π, π]へ寄せる。ちょうど−πは+πになる
- `grappleFacingError = normalizeAngle(atan2(相手 − 自分) − facing)`。中心が一致する（≤1e-9）場合は0（READY）
- 旋回方向: `|error| >= π − 1e-9`なら固定で+方向（画面時計回り）、それ以外は誤差の符号。randomもparticipant順も使わない

# Turn Rate / Tolerance / Snap

GRAPPLED中だけ、`updateFacing`で各自が`maxTurn = π × (1/60)`（3°）ずつ回る。

- 残りの`|error| <= maxTurn`ならbearing（`atan2`）へぴったりsnapする
- 2人の次のfacingは同じ状態から計算してから書き込む（participant順に依存しない）
- 位置は動かさない（bondは半径方向だけで、変更なし）
- FREEは従来どおり即時（Kuzushiは固定）

# Tick Ownership

- readinessは**tickの先頭の状態**で判定する（release処理はposture timerの直後で、位置もfacingも直前のtick末と同じ）
- 旋回は**tickの末尾**で行う
- tick `t`の末尾でREADYになった者は、tick `t+1`から行動できる（T122）
- READY flagは保存しない

# Release Gate

- releaseできるのは`gripPressed && canActInGrapple(p, opponent, engagement)`を満たす者だけ
- 片側releaseの場合: engagementはFREE、releaseした側はGrip recovery
- READYの者が同時にreleaseした場合: 両者recovery
- READYとTURNINGが同時に押した場合: READYの側だけがreleaseし、TURNING側のedgeは効果なし（T125）
- release後のFREEの扱いはACTION-05Aどおり（そのtickはFREE actionを開始しない、FREEのfacingは即時）

# Side / Rear Integration（実測値）

Prototypeの対称配置（`B`が押し、`A`がCounterしてからGrip）:

| | Grip直前の誤差 | READYまでの旋回更新（Grip tickを含む） |
|---|---|---|
| Success（側面） | 90.000° | **26** |
| Best（背後） | 180.000° | **56** |

- どちらもTask記載の「約25 / 約55」
- 理論値は`(90 − 15) / 3 = 25`ちょうどだが、境界ぴったりに来るため、浮動小数の誤差で1回多くなっている
- 背後の方が30回長い。分類のstateやtimerはなく、実際の幾何とfacingだけから導いている
- tierによる特別扱いはない

# Front Grip

正面のGripは、成立tickの時点で両者READY（T116）。強制の硬直はなく、次のtickからreleaseできる。

# Morozashi Separation

engagementの`morozashi{holderId}`は旋回の間も変わらない（T126）。

- Snapshotのtopレベルのkeyは`arena` / `engagement` / `participants`だけ
- participantのkeyも従来どおり（side / rear / orientation / stunなどはない）
- READY / TURNINGは毎回導出する

# Tests（163/163 PASS）

既存148件: 修正0件でPASS（T130）。新規15件:

- T115 `normalizeAngle`の範囲と、−π → +π
- T116 正面Grip → 即座に両者READY、release可能
- T117 側面: 掴んだ側はREADY、被害側はTURNING。毎tickちょうど3°ずつ減ってsnapする。旋回回数は初期誤差から計算した値と一致（24〜26の範囲）
- T118 背後: 54〜56回で、側面より25回超長い
- T119 両方の符号で最短方向、±πの継ぎ目をまたぐ場合、厳密なtieと浮動小数のtie（±1e-12）は+方向。統合版（背後の被害側の最初の更新が+3°）
- T120 1 tickあたり3°以下、行き過ぎなし、最後はbearingへぴったりsnap（誤差0）
- T121 toleranceの境界は含む側、±1e-9外はTURNING、中心一致はREADY、定数値の確認
- T122 tick `t`の末尾でREADY → tick `t`の押下は無効、`t+1`の押下でrelease
- T123 TURNING中のShiftを20 tick連打してもrelease・recovery・queueなし
- T124 READYのreleaseはACTION-05Aどおり（片側・同時）
- T125 READYとTURNINGが同時に押す → READY側だけがrelease
- T126 Morozashiの保持、保存されるstateがないこと、moduleのPhaser非依存
- T127 旋回中もbond距離とpair軸は不変（WASD入力ありでも）、NaNなし
- T128 FREEの即時facing、Kuzushiの固定は不変。holderがTURNING中にreleaseすると、被害側はFREEで即時に向き直る
- T129 正面 / 側面 / 背後のreplay一致、facingがfinite

# Browser Smoke

**NOT RUN（environment limitation）**。`pnpm build`は成功。

# Implementation Evidence

- 角度とtie: T115 / T119
- 旋回速度とsnap: T117 / T120
- tolerance: T121
- tick境界: T122
- release gate: T123〜T125
- 側面・背後の差: T117 / T118
- 正面: T116
- 分離と保存stateなし: T126
- bond: T127
- FREE regression: T128 + 既存148件
- 決定性: T129
- Drive / Throw / Lift / stat / 方向による優位のcodeはない

# Design Deviations

なし。

# Unexpected Scope

なし。

Play Test向けの所見:
- Dummy（CPU）はGripもreleaseもしないので、Userは常に「掴む側」になる。CPUが旋回する様子は見えるが、「TURNING中の自分はreleaseできない」ことはUserの操作では試せない（Simulation testで確認済み）
- 優位側が先に行動できる実感は、Drive（ACTION-05C）以降で得られる

# Known Untested

- Browser Smoke（旋回の見え方、正面で遅れがないこと、背後の方が長いこと、READYでのrelease、jitter、console error）
- Orientation Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Taskの11項目）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add grappled orientation readiness`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
