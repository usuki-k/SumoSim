Task-ID: FOUNDATION-01-PHASER-BOOTSTRAP
Status: READY
Task-Type: IMPLEMENTATION / PHASER FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 594786bdbca81a30c33d6f3f963510f209dc7711
Handoff-Mode: GITHUB

# FOUNDATION-01 — Phaser Game Foundation

## 1. Purpose

SumoSimの最初のProduction Source Taskとして、現在のVite初期サンプルを最小のPhaser 4 Game Foundationへ置き換える。

このTaskはGameplay実装ではない。

成立させる技術経路：

Node.js / pnpm
→ Vite
→ TypeScript
→ Phaser 4
→ Browser Canvas

Browser上では、見下ろし型の円形土俵、Player placeholder、CPU placeholderまでを表示する。

移動、入力、Physics、押し合い、CPU、ring-out、勝敗等は実装しない。

## 2. Current Baseline

- Source-Baseline: `594786bdbca81a30c33d6f3f963510f209dc7711`
- Node.js 24.22.0
- pnpm 12系
- Vite 8
- TypeScript 6
- Phaser 4.2.1 dependency導入済み
- `src/` はVite initial sample
- Phaser Game bootstrap未実装
- Vitest / Playwright / CrazyGames SDK未導入

新しいDependencyを追加しないこと。

## 3. Required Reading

作業開始前に必ず読む：

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_TASK.md`
- 直前の `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

GitHub Handoff Preflightは `AGENTS.md` をSource of Truthとする。

## 4. Architecture Constraints

最重要原則：

Pure TypeScript Game / Simulation
→ State / Results
→ Phaser Rendering / Input / Animation

ただし、このTaskではGameplay Simulation自体を作らない。

Phaser SceneはPresentation Foundationだけとする。

このTaskでSceneへ入れない：

- stamina計算
- balance計算
- push計算
- movement rule
- ring-out rule
- 勝敗rule
- CPU decision
- gameplay state machine
- Physics

`update()` に将来のGameplay Logicを先回り実装しない。

## 5. Implementation Direction

### 5.1 Vite starter removal

Current Sourceを確認し、Vite starter専用のUI、counter、logo / hero assets、starter用public assetsを削除する。

Taskと無関係なFileは削除しない。

### 5.2 Minimal source structure

基本構造：

```
src/
├─ game/
│  └─ scenes/
│     └─ BoutScene.ts
├─ main.ts
└─ style.css
```

Gameplay Logicがまだ無いため、空のSimulation / Domain / Service / Manager / Interface等を先回り作成しない。

### 5.3 main.ts

Phaser Game bootstrapの入口とする。

最低限：

- Phaser import
- `BoutScene` import
- GameConfig
- `new Phaser.Game(...)`

Gameplay Logicを書かない。

### 5.4 BoutScene.ts

Phaser Presentation Foundationとして、最低限以下を表示：

- 円形土俵
- Player placeholder
- CPU placeholder

Player / CPUは単純なGraphics図形でよい。
必要なら短いText Labelを置いてよい。

画像Assetは不要。

色、位置、寸法はPrototype用の仮値であり、Game Design上のAccepted値にしない。

### 5.5 Canvas / Scale

Browser viewportへ収まりやすい最小のScale設定を行う。

`Phaser.Scale.FIT`、`Phaser.Scale.CENTER_BOTH` 等を使ってよい。

logical sizeはFoundation用の暫定値として扱う。
最終Resolutionを確定しない。
Docへ最終Resolutionとして記録しない。

### 5.6 CSS / index.html

Vite starter CSSを最小のgame canvas用CSSへ置き換える。

最低限：

- body margin除去
- canvasが正常表示される
- 不要なscrollを避ける
- 単純な背景

`index.html` は必要に応じてstarter favicon参照等を削除し、titleを `SumoSim` にしてよい。

Localization / final product metadataには踏み込まない。

## 6. Scope

変更を許可する主な対象：

- `src/main.ts`
- `src/style.css`
- `src/game/scenes/BoutScene.ts`（新規）
- Vite starter専用の `src/` sample files / assetsの削除
- Vite starter専用の `public/` assetsの削除
- `index.html`
- `docs/ARCHITECTURE.md` のCurrent State同期
- `AGENTS.md` のCurrent Stateに関する時間依存記述のみ、必要なら最小同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

`AGENTS.md` を変更する場合、Workflow / Verification / Architecture Rule自体は再設計しない。

## 7. Scope Out

実装しない：

- Player movement / Keyboard input / Touch input
- CPU movement / AI
- Collision / Arcade Physics / Matter.js
- push / stamina / balance
- ring-out / victory
- tachiai / clinch / throw / kimarite
- Training / Stable management / Reward / Money
- Save / Load
- CrazyGames SDK
- React / Zustand
- Vitest / Playwright
- Aseprite / Tiled
- Audio / Camera effects / Animation system
- Asset pipeline
- final responsive design
- final resolution decision

空の将来用Class / Interface / Frameworkを作らない。

## 8. Stop Conditions

以下ではScopeを広げずSTOP：

- Handoff Preflight失敗
- Current SourceとTask BaselineがMaterialに異なる
- Phaser 4.2.1がCurrent dependencyに存在しない
- Current Source / AGENTS / ARCHITECTUREにMaterial Conflict
- 新しいDependencyが必須
- Gameplay Ruleを決めないとFoundationが成立しない
- Task対象外の既存User変更
- Remote divergence
- Handoff metadata不一致

既存変更をrestore / reset / deleteして進めない。

## 9. Verification Level

Standard（Foundation / Phaser Presentation接続）

Vitest / Playwrightは未導入のため、このTaskでは導入しない。

Required Verification：

1. `pnpm build` PASS
2. `git diff --check` PASS
3. 変更FileがTask Scope内のみ
4. 新Dependency追加なし
5. `pnpm-lock.yaml` を不要に変更していない
6. Gameplay formula / Physics / Gameplay State Machine /先回りFrameworkがSceneへ入っていない

### Browser Smoke

可能なら `pnpm dev` で確認：

- page表示
- Phaser Canvas生成
- runtime errorなし
- 円形土俵表示
- Player placeholder表示
- CPU placeholder表示
- Vite starter UI非表示
- Canvasが通常のBrowser viewport内へ収まる

AgentにBrowser実行環境が無い場合：

- Browser automation dependencyを追加しない
- Known Untested Itemsに明記
- Technical GateがPASSしていれば `PASS WITH KNOWN UNTESTED ITEMS` 可
- 未実施なのにRUNTIME PASSと報告しない

## 10. Acceptance Criteria

AC-01: Vite starter UIがProduction Sourceから除去されている。
AC-02: Phaser 4 Gameが `main.ts` から起動する構造。
AC-03: `BoutScene` が独立したScene Fileとして存在。
AC-04: 見下ろし型の円形土俵を表示。
AC-05: Player / CPUを区別できる2つのplaceholderを表示。
AC-06: Gameplay Logic / Input / Physics / CPU AI / Movement / 勝敗判定を実装していない。
AC-07: Phaser SceneがGameplay RuleのSource of Truthになっていない。
AC-08: 新Dependencyを追加していない。
AC-09: `pnpm build` PASS。
AC-10: `git diff --check` PASS。
AC-11: Task Scope外の意図しない変更なし。
AC-12: Current State Docが実装後の状態と矛盾しない。

## 11. User Play Test

Task Acceptanceとしては NOT REQUIRED。

これはGame Feel Taskではなく、Phaser FoundationのTechnical Foundation Taskである。

Browser表示確認はTechnical Smokeであり、Game Feel Acceptanceではない。

## 12. Completion Report

`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` をこのTaskのReportとして上書きする。

最低限：

- Result
- Preflight
- Scope
- Changed Files
- Deleted Vite starter files
- Implemented Foundation
- Verification
- Browser Smoke
- AC-01〜AC-12
- Design Deviations
- Unexpected Scope
- Known Untested Items
- User Play Test: NOT REQUIRED
- Git delivery

Implementation Evidenceを簡潔に含める：

1. Phaser bootstrap
2. Scene分離
3. Gameplay LogicをSceneへ入れていない
4. Dependency追加なし
5. Vite starter removal / Browser foundation

Design Deviationsなし：

`Design Deviations: NONE`

変更がある場合は Planned / Implemented / Reason / Semantics changed? を報告し、Semantic変更を独断でAccepted扱いしない。

## 13. Git Delivery

`AGENTS.md` のGitHub Handoff Workflowに従う。

成功時：

- Task-owned Fileだけ明示Stage
- diff / staged diff / diff --check確認
- CURRENT_COMPLETION_REPORT.mdを同じTask Commitに含める
- 1 Agent Task ≈ 1 Commit
- `origin/develop` へpush
- push後にlocal HEAD == origin/develop
- working tree clean確認

Commit message例：

`feat: bootstrap Phaser game foundation`

mainへpushしない。

FAIL / PARTIAL / BLOCKEDではAGENTS.mdの通常Ruleに従う。

## 14. Final Instruction

このTaskではPhaser Foundationだけを実装する。

完了後、Player Movement / Input / Simulation / CPU / Physics / 超小型Gameplay Loopへ自主的に進まない。

Commit / Push / Completion Reportまで完了したら停止し、

「FOUNDATION-01-PHASER-BOOTSTRAP が完了し、ChatGPT Review待ちです」

と日本語で報告する。
