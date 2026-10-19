Task-ID: ACTION-05C1-GRAPPLED-DRIVE-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: f28542fce7b5996916a7769b9690905c41ca0608
Agent-Start-Head: f752a9f06c16df5801a72ba26e8aafce991e468a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 182/182、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**
- User Play Test: **REQUIRED / NOT RUN**

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `f28542f`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `f28542f..origin/develop` の変更は `docs/agent_handoff/` 配下のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `f752a9f`

# Changed Files

- `src/game/sumo/BoutTypes.ts`: `ParticipantIntent.driveHeld`、`{ kind: 'drive' }` action
- `src/game/sumo/BoutSimulation.ts`:
  - 定数3つ
  - `grappleDriveStrength()` / `grappledExternalVelocity()`（pure、export）
  - `updateGrappledExternal()`
  - `step()`をvelocity更新と積分の2段に分割
  - releaseでDriveを解除
- `src/game/sumo/BoutDrive.test.ts`（新規）: T131〜T148、T150
- `src/game/input/pushDummyController.ts`: GRAPPLED中のMode 2は`driveHeld = true`だけを出す
- `src/game/input/pushDummyController.test.ts`: T110のassertionを意図どおりに更新（後述）、helperに`driveHeld: false`を追加
- `src/game/scenes/BoutScene.ts`: ArrowUpのKey参照（edge → Push latch、`isDown` → `driveHeld`）、`DRIVE`表示、`pair v`表示
- 他のtestのhelperに`driveHeld: false`を追加（BoutSimulation / Push / Counter / CounterPosition / Grip / Orientation / pressLatch。assertionは不変）
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

`grappleOrientation.ts`とAGENTS.mdは変更なし。新規dependencyはなし。

# User Decisions Implemented

- UD-1: 連続hold
- UD-2: `driveHeld`（同じArrowUp。Sceneは文脈で分岐しない）
- UD-3: `GRAPPLE_DRIVE_SPEED = 0.6`、`GRAPPLE_DRIVE_ACCELERATION = 4`
- UD-4: `MOROZASHI_DRIVE_FACTOR = 1.5`（holderだけ）、それ以外は1.0
- UD-5: READYの者のreleaseがDriveより優先
- UD-6: Ring-outなし

# driveHeld Input

- Sceneは`upKey`を1つだけ持つ: `on('down')` → 既存のPush latch、`isDown` → 毎tickの`driveHeld`
- key-downの連続からheld stateを合成することはしない
- FREE: `driveHeld`は読まない（T131: driveHeldの有無でSnapshotが完全に一致）
- GRAPPLED: `pushPressed`は従来どおり無視

# Drive Action

- GRAPPLED中、FREE action開始の段階で毎tick`action = driveHeld && ready(tick start) ? drive : idle`に置き換える
- timerなし
- `isDriving`のような重複stateはない
- TURNING中に押していても寄与しない。READYでtickを始めた最初のtickから自動で寄与する（T135）

# Pair Axis / Net

- `n` = tick先頭の位置でのA → B（同一中心ならAのfacingをfallback）。facingは使わない
- `net = strength(A)·[A drive] − strength(B)·[B drive]`で、`strength`は`grappleDriveStrength(engagement, id)`
  - Aだけ: +1
  - Bだけ: −1
  - neutral同士: 0
  - holder A対B: +0.5
  - holderだけ: +1.5
- 符号付きの対称な式なので、participantの配列順による優先はない（T147で順序を入れ替えて検証）

# Shared External Drive Update（必須ruleの根拠）

`updateGrappledExternal()`が1 tickに1回、両者のexternalの平均（GRAPPLED中は等しい）を`grappledExternalVelocity(v, n, net)`で更新し、両者へ**同じ値**をcopyする。

- `net = 0`: 既存の`decayExternal`
- `net ≠ 0`:
  1. 軸方向の成分 < 目標なら、`min(目標, 成分 + 4·|net|·dt)`。**軸方向の減衰は先に引かない**
  2. 目標を超えていれば、`max(目標, 成分 − 8·dt)`（既存の減衰率）
  3. 逆向きの成分は、Driveの加速で打ち消してから反転する
  4. 垂直方向の成分は`decayExternal`
  5. 最後に`clampExternal`（MAX 3 m/s）
- FREEの`decayExternal`とPushの式は変更していない
- **Correctionの根拠（T132 / T139）**: 加速4 < 減衰8のもとでも、k tick後の速度はちょうど`min(0.6, k·4/60)`になる（9 tick目で0.6に到達し、その後は一定）。這い進みの不具合（1 tick分の速度で止まる）は起きない

# Step Order（実装どおり）

1. posture timer
2. tick先頭のreadiness（`ready()`はtick開始時のengagementとstateで評価）
3. GRAPPLED中のrelease
4. FREE action開始
5. GRAPPLEDなら`drive` / `idle`を決定
6. 全員のself velocity
7. external（FREEは減衰、GRAPPLEDは共有のDrive更新）
8. 全員の積分
9. contact
10. bond / Counter → Grip → Push
11. action timer
12. facing

- velocity更新と積分を分けた2段のloopになるが、FREEは「各自の更新が相手を参照しない」ので結果は同一（既存の163件が不変で、T131でも一致を確認）
- Driveは、tick先頭でREADYの者について**そのtick**の移動に効く（Pushのような1 tickの遅れはない）。旋回でREADYになった場合は、次のtickから効く（05B1どおり）

# Release During Drive

- READYの者のGrip edgeでFREEに戻る
- 両者の`drive` actionをidleにし、releaseした側はGrip recovery
- そのtickはFREEなので、Driveの寄与はない
- externalは消さず、FREEの減衰で止まる（T142: release tickでも`v − 8·dt`）
- FREE中に`drive` actionは存在しない（T142 / T150で毎tick確認）
- TURNING中のShift + ↑は無視（T143）

# Drive / Orientation / Bond

- Driveでpairは平行移動するだけ。70 tickのあいだDriveしても、距離R・pair軸・旋回の単調減少は変わらない（T144）
- 背後Morozashiの組み合わせ: holderは一方的にDriveでき（T134）、被害側はREADYになってから押し返す（T135 / T146）

# Dummy

- Mode 2: FREE中は従来どおり。GRAPPLED中は`move 0`、edgeはすべてfalse、`driveHeld = true`で、Push cooldownを保持する
- Mode 1: 常に`driveHeld = false`
- GripもreleaseもしないAIではない
- T146:
  - 正面で組むと、Dummyは次のtickから押し返し、pairは−0.6 m/sで進む
  - 背後Morozashiでは、DummyがTURNINGの間は寄与せず、READYになった最初のtickから寄与する（そのtickの直前のSnapshotがREADYであることも確認）

# Presentation

- phase text: `DRIVE`。TURNINGの者は`drive`になり得ないので、`TURNING n°`が隠れることはない
- ENGAGE行に`pair v: x.xx m/s`（GRAPPLED中）
- 既存のENGAGE表示、READY / TURNING表示、Morozashiの線は維持

# Tests（182/182 PASS）

既存163件: helperに`driveHeld: false`を追加し、**意図した変更が1件**ある。

- T110 は「GRAPPLED中のDummyは何も出さない」→「`driveHeld = true`だけを出す」に変更（Task §Dummy Mode 2の仕様どおり）
- それ以外のassertionは不変（T149）

新規19件:

- T131 FREEは`driveHeld`を無視
- T132 / T139 片側Drive（`min(0.6, k·4/60)`ちょうど、単調増加、距離R）
- T133 B側の鏡像
- T134 TURNINGの者は寄与しない、READYの者は一方的にDrive
- T135 TURNING中から押していた場合の開始tick
- T136 neutral同士は加速0。既存のmomentumは毎tick`8/60`ずつ減衰（0に強制しない）
- T137 Morozashiのholderだけなら1.5倍（目標と加速）
- T138 holder対不利側は`net = 0.5`
- T139 helper: 減衰 > 加速でも目標に到達、目標超過分の戻し、MAXでのclamp
- T140 逆向きのmomentumの打ち消しと反転（helperと統合版）
- T141 垂直方向の成分は減衰
- T142 / T143 release
- T144 bond / orientation
- T145 ↑を離すとDriveが止まる
- T146 Dummy
- T147 順序の入れ替え
- T148 Ring-outなし（土俵半径2.275 mを1 m以上越えても、GRAPPLEDのまま0.6 m/s）
- T150 混在sequenceのreplay

# Browser Smoke

**NOT RUN（environment limitation）**。`pnpm build`は成功。

# Implementation Evidence

上記Testsの対応どおり。Ring-out、BoutOutcome、Throw、Lift、stamina、stat、質量、離散Drive、pairの回転、方向によるPush優位、tempo調整のcodeはない。

# Design Deviations

なし。

T110の更新は、Taskが指定したDummyの仕様変更に従ったもの。

# Unexpected Scope

なし。

Play Test向けの所見:
- 土俵を越えても何も起きない（Ring-outは未実装で、仕様どおり）。`R`でrestartする
- neutral同士の押し合いは完全に拮抗する（`net = 0`）。どちらも押し勝てないので、どちらかが↑を離すかreleaseするまで状況は変わらない

# Known Untested

- Browser Smoke（↑のhold、CPUの押し返し、拮抗、Morozashiの差、TURNING中の一方的なDrive、release、jitter、console error）
- Drive Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Taskの12項目）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add grappled drive foundation`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
