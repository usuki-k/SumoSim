Task-ID: ACTION-02-MOVEMENT-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 572990944674f82f31964f8c27b369eaf26faefc
Agent-Start-Head: 1f8de847db8a2981e67eef964265f1400ab05f5a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS。Movement Foundationを実装した。Movement feel / control feelのUser Play Testは**未実施（REQUIRED / NOT RUN）**で、Known Untested / pending acceptanceとしてResultに反映した。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 2
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Handoff-Mode GITHUB、Source-Baseline 5729909（Taskの期待値）
- Source-Baselineは origin/develop のancestor。Coordination Diff（5729909..origin/develop）は `docs/agent_handoff/` の `CURRENT_COMPLETION_REPORT.md` / `CURRENT_TASK.md` のみ
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head 1f8de84

# Changed Files

- 新規: `src/game/sumo/FixedStepAccumulator.ts`（+ `.test.ts`）, `src/game/input/movementVector.ts`（+ `.test.ts`）
- 変更: `src/game/sumo/BoutTypes.ts`, `src/game/sumo/BoutSimulation.ts`（+ `.test.ts`）, `src/game/scenes/BoutScene.ts`, `docs/ARCHITECTURE.md`, `AGENTS.md`（Directory / fixed-step記述の最小同期）, 本Report
- package.json / pnpm-lock.yaml: 未変更。新Dependencyなし

# Implemented Movement Architecture

- `ParticipantIntent { move: Vec2 }`: world-frame、semantic。`BoutSimulation.step(intents: ReadonlyMap<id, intent>)`が1 tickだけ進める。intentが無いparticipantはzero move。非有限値はzero扱い、長さ>1はSimulation側でclamp
- 速度モデル: intent → target velocity → 加速（intentあり）/減速（intentなし）で、1 tickあたりの最大変化量（rate×tick）以内でtargetへ近づく（overshootなし）→ position積分
- Auto-facing: 毎tick末に相手方向へ即時。座標系は +x右、+y下、facing 0 = +x、radian（`BoutTypes.ts`先頭にcomment）。同一点では直前のfacingを維持（NaNなし）。初期facingもconstructorで相手方向に設定
- Snapshotの`ParticipantState`に`velocity`と`facing`を追加（copy隔離は継続）

# Fixed-Step / Accumulator

- `FixedStepAccumulator.advance(deltaMs) → ticks`。Phaser非依存、`1e-6ms`のepsilonで浮動小数誤差を吸収
- 上限: 1 frame delta ≤ 250ms、1 frame ≤ 8 tick。tick上限に達したら残りの蓄積を破棄（spiral of death防止、slow motion化）
- Scene: `update(_, deltaMs)`で`advance`、得たtick数だけ`simulation.step(intents)`。Intentはframe冒頭で1回sampleし、そのframeの全tickで再利用。render interpolationなし

# Keyboard Adapter

- `movementVectorFromKeys({up,down,left,right})`: W=-y, S=+y, A=-x, D=+x（画面基準）、逆方向は相殺、斜めは`SQRT1_2`で正規化
- Phaserの`keyboard.addKey(KeyCodes.W/A/S/D)`をScene内で読み、上記Pure関数へ渡す。Simulationはkey codeを知らない。Touch / Gamepadなし

# State Ownership / Identity-Control Separation

- position / velocity / facingの正本は`BoutSimulation`のみ。SceneのGameObjectは毎frame Snapshotから一方向同期され、書き戻しはない。GameObjectは`create()`で1回だけ生成し、以後は更新のみ
- C-1解消: participant id（`wrestler-a`/`wrestler-b`、Simulation内では単なる識別子）と、controller（keyboard / stationary）・色・ラベルの対応は、Scene側の`PARTICIPANT_PRESENTATION`に分離。idが`player`/`cpu`である必要はない。小さな定数配列のみで、`BoutControlAssignment`等のFrameworkは作っていない

# Provisional constants and fixture values（暫定。Final balanceではない。User Play Testで調整）

- `SIMULATION_HZ` = 60
- `MAX_SPEED` = 3 m/s
- `ACCELERATION` = 12 m/s²（約0.25秒で最高速）
- `DECELERATION` = 15 m/s²（約0.2秒で停止）
- Fixture: ring半径 2.275 m、spawn x = ±0.7 m（y=0）、body半径 0.35 m（presentationのみ）、canvasに対するring比率 0.9
- Accumulator: `MAX_FRAME_MS` = 250、`MAX_STEPS_PER_FRAME` = 8
- 参加者間の能力差なし。Rikishi attributesなし

# T1〜T11

`pnpm test`: 3 files / 24 tests PASS。

- T1 決定性 / T2 zero intent（静止・既存velocityの減速） / T3 4方向の軸 / T4 斜め・過大入力のclamp（定常速度がMAX_SPEED） / T5 段階的加速（1 tick目 = ACCELERATION×tick、MAX_SPEEDへ到達しそれ以上にならない） / T6 減速（単調減少、方向反転・NaNなし、exactに0で停止し以後移動しない） / T7 accumulator（60/144/30fps・jitter分割で同tick数、16+17 = 33、巨大delta clamp、tick上限と超過破棄、非正・非有限delta無視） / T8 auto-facing（初期、移動後の更新、同一点でNaNなし） / T9 setup alias・snapshot隔離（velocity/facing含む） / T10 Simulation・Types・Accumulator・movementVectorにPhaser依存なし（`?raw`で検査） / T11 W/S/A/D、相殺、斜め正規化

# Verification

- `pnpm test`: PASS（24/24）
- `pnpm build`（tsc含む）: PASS
- `git diff --check`: PASS
- 新Dependencyなし、Phaser Physics / Matter未使用、collision/push/ring-out/tachiai等なし
- Agent Task Diff（1f8de84..Implementation-Commit）は上記Changed Filesのみ

# Browser Smoke

Chrome headless + DevToolsプロトコルで実キーイベント（W、D+S）を送り、Screenshotで確認した。Dependency追加なし。

- Phaser Canvas起動、console errorとuncaught exception: 0件
- Vite starter UIなし
- 初期: PLAYERとCPUのfacing markerが互いを向いている
- W押下: PLAYERが画面上方向へ移動し、移動中もCPU方向にmarkerが向く。離すと停止する（以後の位置は変化しない）
- D+S同時押下: 画面右下へ移動。斜め移動が極端に速いようには見えない（定量はT4）
- CPUは静止、Sceneの描画はSnapshotに追従
- 注意: collisionもring境界もないため、PLAYERはring外へ出られ、CPUを通り抜けられる（Taskのexpected）
- 実時間での体感（応答性、加減速の重さ）はAgentでは判断できない → User Play Test

# Acceptance Criteria

AC-01〜AC-18: PASS。AC-19: User Play Testは REQUIRED / NOT RUN として報告。

# Implementation Evidence

1. semantic Input boundary: `ParticipantIntent`、`movementVector.ts`。Simulationにkey codeなし
2. canonical movement ownership: `BoutSimulation`が position/velocity/facing を保持
3. fixed timestep: `step()`は1 tick、dt引数なし
4. accumulator: T7のpartition独立性
5. auto-facing: Simulation内、T8
6. Scene一方向同期: `syncViews()`はSnapshot読取のみ
7. identity/control分離: `PARTICIPANT_PRESENTATION`
8. scope creepなし: collision/push/ring-out/tachiai/grapple/CPU/attributes未実装

# Design Deviations

NONE

# Unexpected Scope

なし。

# Known Untested Items

- **User Play Test（movement feel / control feel）: REQUIRED / NOT RUN**（Agentは受理扱いにしない）
- `pnpm dev`（HMR）、実機の60Hz以外のdisplay（144Hz等）での体感、Mobile / touch
- tab切替・background復帰時の実ブラウザ挙動（accumulatorのclampはUnit Test済みだが実ブラウザでは未確認）
- 実フレームレートでのkeyDown/keyUpのsampleタイミング（短いタップがtick間に失われないか。現実装は「frame冒頭のisDown」をsampleする。1 frame未満の押下は拾えない可能性あり）

# User Play Test

REQUIRED / NOT RUN。確認項目: 画面基準WASDの直感性、auto-facingしながらの横移動・後退、加速・減速の感覚、斜め移動、反応速度、60Hz fixed-stepでの違和感。

# Git delivery

`feat: add bout movement foundation` を1 commitで`origin/develop`へpush。mainは未変更。
