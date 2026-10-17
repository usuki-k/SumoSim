Task-ID: FOUNDATION-02-BOUT-SIMULATION-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / PURE TYPESCRIPT SIMULATION FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: d0b81c29bb10af0ba05863f38643d73ca234f170
Handoff-Mode: GITHUB

# FOUNDATION-02 — BoutSimulation Foundation

## 1. Purpose

SumoSimの相撲Actionを将来作り込んでも、Phaser SceneとGameplay Ruleが密結合して破綻しないよう、最小のPure TypeScript BoutSimulation境界を実装する。

同時に、将来のManagement / Training側から育成済み力士をBoutへ渡す場合も、Management StateそのものをBout Runtimeの正本にしない構造を作る。

このTaskはGameplay Rule実装ではない。

今回成立させる境界：

Management / future game state
→ BoutSetup（明示的な入力境界）
→ BoutSimulation（canonical bout runtime ownership）
→ read-only Snapshot / State
→ Phaser BoutScene rendering

初期版は小さく保つが、将来stamina / balance / push / movement / ring-out / CPU等を追加するときに同じ境界を拡張できる構造にする。

過剰なFrameworkや将来機能の空実装は作らない。

## 2. Current Baseline / Review Handoff

Accepted Source Baseline:

`d0b81c29bb10af0ba05863f38643d73ca234f170`

Previous FOUNDATION-01 Review:

- Phaser bootstrap / independent `BoutScene` はAccepted
- 現在の640x640、色、位置、寸法は暫定値でありFinal Designではない
- Gameplay Simulation / Input / Movement / Physics / CPU / stamina / balance / ring-out / victoryは未実装
- Pure TypeScript Simulation → State / Results → Phaser Presentationを維持
- Physicsを先回り導入しない
- Correction: `public/` は現在存在しないのにAGENTS.mdのCurrent directory listに残っている。空Directoryを作らず、今回AGENTS Current Stateを同期する際に修正してよい

Current developにはChatGPT Review coordination commitが上にあるため、AGENTS.mdのGitHub Handoff Workflowに従い、Source-BaselineからのCoordination Diffが`docs/agent_handoff/`のみであることを確認してからFF-onlyすること。

## 3. Required Reading

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_TASK.md`
- FOUNDATION-01 Final Review Handoff
- Current `src/main.ts`
- Current `src/game/scenes/BoutScene.ts`
- Current `package.json`

## 4. Architecture Contract

### 4.1 Canonical ownership

BoutのRuntime Stateの正本はPure TypeScript側に置く。

`BoutScene` がcanonical position等を別に所有しない。

Phaser Objectの `x/y` 等はPresentationであり、Gameplay Stateの正本ではない。

### 4.2 Setup と Runtime Stateを分ける

将来のManagement Stateを直接BoutSimulationへ持ち込まない。

明示的な `BoutSetup` / participant setup boundaryを設ける。

今回は未決の能力値を追加しない。

BoutSetupに必要な最小情報のみ：

- participant identity
- initial logical position
- arena/ring geometryとして必要な最小情報

将来Power / stamina / technique等を追加できるが、今回勝手に定義しない。

### 4.3 Simulation coordinate と Presentationを分ける

Simulationのposition / ring geometryはPhaser GameObjectやCanvas DOM値そのものに依存しないPure number dataとする。

Phaser SceneがSnapshotをCanvasへ描画する責務を持つ。

現在の座標単位・ring radius・spawn位置等はPrototype fixtureでありFinal Gameplay値ではない。

### 4.4 No time-step decision yet

fixed-step / variable delta / tick rateは未決。

このTaskでは `step(delta)`、simulation loop、time accumulator等を実装しない。

Movement Taskで設計判断する。

### 4.5 No speculative systems

導入しない：

- ECS
- DI
- Event Bus
- generic reducer framework
- command bus
- rule engine
- physics abstraction
- plugin architecture
- generic entity/component hierarchy

2人の力士に必要なsmall explicit designを優先する。

## 5. Implementation Direction

基本構造は以下を推奨する。Current Sourceを確認し、同じ責務をより小さく明確に実装できる場合は最小限の調整可。MaterialなDeviationはReportする。

```
src/
├─ game/
│  ├─ sumo/
│  │  ├─ BoutTypes.ts
│  │  ├─ BoutSimulation.ts
│  │  └─ BoutSimulation.test.ts
│  └─ scenes/
│     └─ BoutScene.ts
├─ main.ts
└─ style.css
```

### 5.1 BoutTypes

Pure TypeScriptのみ。

最小限の概念：

- logical 2D vector
- participant identity
- participant setup
- arena/ring setup
- bout setup
- participant runtime state
- bout snapshot/state

Phaser import禁止。

名前はTypeScriptとして自然な範囲で調整可。

### 5.2 BoutSimulation

Pure TypeScript classまたは同等に明確なsmall API。

最低限の責務：

- BoutSetupを受けてruntime stateを初期化
- canonical bout runtime stateを所有
- Phaser非依存のread-only snapshot / state viewを提供
- caller supplied setup objectをcanonical mutable stateとしてそのまま保持しない
- participant identityの重複など、Foundationとして明らかに不正なSetupを安全に拒否

現在はGameplay advancementを行わない。

No `update`, No `step`, No movement。

### 5.3 State isolation

Scene等のconsumerがSnapshotを変更しても、Simulation内部のcanonical stateが書き換わらない設計にする。

Readonly Typeだけでなく、runtime aliasingを避ける小さな実装とFocused Testを用意する。

ただしdeep-clone Framework等は導入しない。

### 5.4 BoutScene integration

現在の土俵とPlayer / CPU placeholderを、BoutSimulationのSetup / Snapshotを通して描画するよう変更する。

Scene内にcanonical participant positionを別途持たない。

Sceneは：

- Prototype BoutSetupを組み立てる
- BoutSimulationを生成
- Snapshotを読む
- Simulation logical coordinatesをPhaser canvasへpresentation mapping
- ring / participantsを描画

まで。

Prototype Setup値は仮値とコメント等で明示する。

Simulation logical coordinateを直接Canvas sizeの正本として設計しない。
Scene側に小さく明示的なpresentation transformを置いてよい。

### 5.5 Vitest

Pure TypeScript Simulationを継続的に検証できるよう、このTaskでVitestをdevDependencyとして導入する。

必要最小限：

- `vitest`
- package.jsonにnon-watch CI/focused実行用のtest script（例 `vitest run`）

Playwrightや他Test Frameworkは導入しない。

## 6. Required Focused Tests

最低限、以下を自動Testする。

T1. valid BoutSetupから2 participantのruntime snapshotを生成できる。

T2. initial logical positions / arena geometryがSetupから正しく反映される。

T3. participant ID重複など明らかにinvalidなSetupを拒否する。

T4. Simulationが入力Setupを直接canonical mutable stateとしてaliasしない。
作成後にcaller側Setup objectを変更してもSimulation snapshotが変わらない。

T5. 取得したSnapshot / nested position等をconsumer側で変更しようとしても、次のSnapshotのcanonical stateに影響しないこと。
TypeScript readonlyだけでなくruntime ownershipを確認する。

T6. Simulation module / TypesがPhaserに依存しないことをSource inspectionで確認。

TestのためだけにGameplay Ruleを作らない。

## 7. Scope

変更可：

- `src/game/sumo/` の必要最小File
- `src/game/scenes/BoutScene.ts`
- `package.json`
- `pnpm-lock.yaml`
- `docs/ARCHITECTURE.md` のCurrent State / accepted architecture synchronization
- `AGENTS.md` のCurrent Technology / Source Directory等の時間依存記述の最小同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

前回Correctionとして、AGENTS.md Current listに存在しない `public/` が残っている問題も、Current State同期の一部として修正する。
空の`public/`を再作成しない。

## 8. Scope Out

実装しない：

- movement
- keyboard / touch input
- simulation step / delta / fixed timestep
- velocity / acceleration（Movement Design前に勝手に決めない）
- collision / separation
- Arcade Physics / Matter.js
- push formula
- stamina / balance
- power / technique等の能力値
- CPU AI
- ring-out / victory
- tachiai / clinch / throw / kimarite
- Stable / Training / Management State
- actual Management→Bout conversion service
- Reward / Money
- Save / Load
- CrazyGames SDK
- Playwright
- React / Zustand
- audio / animation / camera effects
- generic framework / plugin system

Managementとの将来接続のために、未実装Management ClassやStoreを作らない。

## 9. Stop Conditions

以下ではSTOP：

- GitHub Handoff Preflight失敗
- Source / Review / SPECのMaterial Conflict
- Source-Baseline mismatch
- Vitest以外の新Dependencyが必須
- Foundationを作るために未決Gameplay Stat / Control / time-step semanticsの決定が必須
- SceneとSimulationのState ownershipを二重化しないと成立しない
- Task外User変更 / remote divergence
- Current Phaser API / TypeScriptで想定構造が成立しないMaterialな問題

Agent独断でGameplay設計を確定しない。

## 10. Verification Level

Standard。

Required：

1. `pnpm test`（またはTaskで追加したnon-watch test script）PASS
2. T1〜T6 PASS / evidence
3. `pnpm build` PASS
4. `git diff --check` PASS
5. `package.json` / lockfile変更がVitest導入に必要な範囲のみ
6. Simulation sourceにPhaser importなし
7. BoutSceneにGameplay advancement / Physics / Inputなし
8. Scope外変更なし

### Browser Smoke

Foundation integrationのRegression確認としてBrowser Smokeを行う。

最低限：

- Phaser Canvas起動
- runtime errorなし
- ring表示
- Player / opponent placeholders表示
- Vite starter UIが戻っていない
- current basic viewportでCanvas表示

既存Chrome等を使える場合は使用可。
Playwright等のDependencyをこのために追加しない。

## 11. Acceptance Criteria

AC-01: Pure TypeScriptのBoutSimulation boundaryが存在する。
AC-02: Simulation / TypesにPhaser依存が無い。
AC-03: BoutSetupとruntime state/snapshotが分離されている。
AC-04: 未決Management Stateを直接Bout runtimeの正本にしていない。
AC-05: Simulationがcanonical Bout runtime state ownerである。
AC-06: SceneはSimulation snapshotからring / participantsを描画し、canonical gameplay positionを二重所有しない。
AC-07: Simulation logical coordinatesとPhaser presentation mappingの境界がある。
AC-08: caller Setup mutation / snapshot mutationからcanonical stateが保護される。
AC-09: T1〜T6がPASS。
AC-10: Vitest以外の新Dependencyなし。
AC-11: Movement / Input / Physics / time step / gameplay formulaを実装していない。
AC-12: `pnpm build` PASS。
AC-13: Browser Smoke PASS。
AC-14: AGENTS / ARCHITECTURE Current Stateが実SourceとMaterialに一致する。
AC-15: 前Reviewの`public/` Current-state mismatchが解消される。
AC-16: Scope外変更なし。

## 12. User Play Test

NOT REQUIRED。

このTaskはState ownership / architectural boundary / test foundationであり、Game Feelを変更・評価しない。

Browser SmokeはTechnical Verification。

## 13. Completion Report

AGENTS.mdに従う。

最低限：

- Result
- Preflight
- Changed Files
- Architecture / State Ownership
- Vitest導入内容
- T1〜T6結果
- Browser Smoke
- AC-01〜AC-16
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: NOT REQUIRED
- Git delivery

Implementation Evidenceでは最低限：

1. Setup → Runtime ownership boundary
2. Phaser-free Simulation
3. State alias protection
4. BoutScene integration
5. Test foundation
6. No speculative Gameplay implementation

Design Deviationsがなければ：

`Design Deviations: NONE`

## 14. Git Delivery

AGENTS.mdのGitHub Handoff Workflowに従う。

成功時はTask-owned Files + CURRENT_COMPLETION_REPORTを1 Agent Task Commitにまとめ、`origin/develop`へpush。

Commit message例：

`feat: add bout simulation foundation`

mainは変更しない。

## 15. Final Instruction

このTask完了後、Movement / Input / Push / Physics / CPU等へ自主的に進まない。

Commit / Push / Report完了後停止し、

「FOUNDATION-02-BOUT-SIMULATION-FOUNDATION が完了し、ChatGPT Review待ちです」

と日本語で報告する。


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTION

## Accepted Baseline

- Accepted implementation commit: `572990944674f82f31964f8c27b369eaf26faefc`
- Agent-Start-Head: `e41f772974ea85591b943576ab88bc7d9942d507`
- Agent Task Diff is one implementation commit.
- `main` remains unchanged at `4ebe840e029a0c8b7faa515934fbeea7e7e05acf`.
- Vitest is now part of the Current Technology baseline (`pnpm test = vitest run`).

## Accepted Decisions

- Bout runtime canonical state is owned by Pure TypeScript `BoutSimulation`.
- `BoutSetup` is the explicit future Management / game-state → Bout boundary; Management State itself is not Bout runtime canonical state.
- `BoutSimulation` copies setup data and does not alias caller-owned mutable objects.
- `getSnapshot()` returns fresh data so consumer mutation cannot change canonical simulation state.
- `BoutTypes.ts` / `BoutSimulation.ts` have no Phaser dependency.
- `BoutScene` is presentation-only and reads a Simulation snapshot; it does not own canonical participant position.
- Simulation logical coordinates are separated from the Phaser canvas through a presentation mapping in the Scene.
- A bout currently requires exactly two participants. This is consistent with the sumo bout domain and may remain unless a future explicit requirement changes it.
- No movement, timestep, Physics, push, stamina, balance, CPU, ring-out or victory semantics have been prematurely defined.
- Current ring radius, positions, logical coordinate scale, colors and canvas mapping are Prototype values, not final accepted gameplay values.
- The previous stale `public/` Current-State entry in `AGENTS.md` has been corrected without recreating an empty directory.

## Corrections

### C-1 — Participant identity must not become presentation-role identity

The current Prototype Scene uses:

`PARTICIPANT_STYLE[participant.id]`

with the fixture IDs `player` / `cpu`.

This is acceptable for the current static Prototype, but it is **not an accepted long-term architecture contract**.

Future Management integration may use stable wrestler identities that are not literally `player` / `cpu`. Before arbitrary wrestler IDs are introduced, presentation role / side / styling must be separated from canonical participant identity, or otherwise mapped explicitly outside the Simulation.

Do not add a speculative role system now. Resolve this only when the next relevant input / participant / Management integration design requires it.

## Do Not Reopen

- Do not move canonical Bout state into Phaser GameObjects or Scene fields.
- Do not pass future Management State objects directly into the Simulation as shared mutable runtime state.
- Do not expose mutable canonical state to Presentation consumers.
- Do not add Physics, movement, velocity, fixed-step, delta-time semantics or push formulas without a dedicated design Task.
- Do not introduce ECS / DI / global Event Bus / generic rule engine / plugin architecture for this small simulation.
- Do not treat Prototype ring/spawn/scale/style constants as final game design.

## Deferred

- Player input and movement
- Fixed-step / delta-time / simulation cadence
- Collision / separation / Physics adoption
- Push interaction
- stamina / balance / wrestler stats
- CPU behavior
- ring-out / victory
- tachiai / clinch / throws / kimarite
- Management → Bout conversion and real wrestler identity integration
- Result / Reward / Stable / Training loop
- Playwright
- CrazyGames SDK
- Mobile / touch / multi-viewport verification

## User Play Test

NOT REQUIRED for FOUNDATION-02.

The Browser Smoke is accepted as Technical Verification only. No Game Feel has been accepted by this Task.

## Regression Risks

- Scene or Phaser GameObjects becoming a second canonical position/state source.
- Future Setup fields retaining mutable references from Management State.
- Returning live internal state instead of isolated snapshots.
- Conflating stable wrestler identity with Player/CPU presentation role.
- Choosing movement timestep / Physics architecture opportunistically inside an implementation Task.

## Next Task Constraints

The next high-risk Action step should not jump directly to a full push/collision implementation.

Before movement and pushing are implemented, explicitly design or investigate:
- player input intent boundary,
- simulation movement ownership,
- fixed-step vs delta-time semantics,
- coordinate/time units,
- Scene synchronization from Simulation,
- whether Phaser Physics is needed at all.

A small Investigation / design Task is preferred before implementing Movement / Collision / Push.

Do not add Management systems yet; Action foundation remains the current priority.
