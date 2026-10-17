# AGENTS.md — SumoSim Primary Development Guide

このFileはSumoSim Repository全体のRuleのSource of Truthである。
Codex / Claude Code等のAgentは、Task開始時に必ず最後まで読むこと。

## 1. Project Overview

SumoSimはCrazyGames等のWeb配信を想定した、
相撲の育成・相撲部屋経営Simulation + 見下ろし型相撲Action Gameである。

開発順序：

1. 超小型Gameplay Loopを早期に成立させる
2. 相撲Action部分を重点的に作り込む
3. Actionが成立した後にSimulation / Managementを拡張する

超小型Loop：

Stable → Training → Bout → Result / Reward → Stable

（Bootstrap時点では未実装。Taskで指示されるまで実装しない。）

詳細: `docs/GAME_CONCEPT.md`, `docs/ARCHITECTURE.md`

## 2. Current Technology Stack

導入済み（Current Sourceで確認済み）：

- Node.js 24.22.0（`.nvmrc`）
- pnpm 12系
- Vite 8
- TypeScript 6
- Phaser 4.2.1（dependencyのみ。Game bootstrapは未実装）
- VSCode / Codex / Claude Code
- Git / GitHub

将来候補（**未導入**。導入済みとして扱わないこと）：

- Vitest
- Playwright
- Aseprite
- Tiled
- CrazyGames SDK v3

## 3. Development Priorities

1. Gameplayが成立すること（小さく動くLoopを優先）
2. 相撲Actionの手触り
3. Testしやすく壊れにくい構造
4. 後続Simulation / Managementへの拡張余地

先回りの汎用化・最適化・装飾は優先しない。

## 4. Architecture Rules

ゲームルールと描画を分離する。

```
Pure TypeScript Game / Simulation
        ↓
State / Results
        ↓
Phaser Rendering / Input / Animation
```

- Phaser SceneをGameplay RuleのSource of Truthにしない。
- 例 `BoutSimulation`: 相撲ルール、移動結果、stamina、balance、押し計算、ring-out / 勝敗条件、必要に応じてCPU判断の入力。
- 例 `BoutScene`: input、rendering、sprite、animation、camera、sound、presentation。
- Sceneのframe/updateに重要なGameplay Formulaを埋め込まない。
- 同じ意味のStateのSource of Truthを複数持たない。
- 長期Management Stateとbout runtime stateは分離する方向。
- Platform連携（CrazyGames SDK等）はadapter境界を介し、gameplay coreへ散らさない。
- 初期PrototypeでFramework、ECS、DI Framework、Global Event Bus、汎用Rule Engine等を先回り導入しない。Small explicit designを優先する。

## 5. Source / Directory Responsibilities

Current:

- `src/` — Game source（現状はVite initial sampleのまま。整理は後続Task）
- `public/` — static assets
- `docs/GAME_CONCEPT.md` — 確定したGame方針のみ
- `docs/ARCHITECTURE.md` — 確定したArchitectureのみ
- `docs/agent_handoff/` — Agent Handoff（§13）

ディレクトリ構成（simulation/scene等）は後続Taskで決める。Taskで指示がない限り新設しない。

## 6. Scope Discipline

- Taskに書かれた範囲だけを変更する。
- Task範囲外の修正、refactor、cleanup、先回り実装をしない。
- 範囲外の問題を見つけたらCompletion ReportのUnexpected Scopeに記録し、直さない。
- Task-owned fileだけを変更・stageする。

## 7. Investigation / Design / Implementation / Verification

- Investigation Task: 調査のみ。Production Fixを実装しない。
- Design Task: 設計・文書化。Production sourceを変更しない。
- Implementation Task: 承認済みの範囲を実装する。
- Verification Task: 検証のみ。修正はしない。
- 重要・高リスクTaskは Investigation → ChatGPT Review → Implementation → Verification → ChatGPT Review と分離できる。
- Current Source / SPECとMaterial Conflictがあれば、推測で進めずSTOPして報告する。

## 8. Coding Principles

- TypeScript strictを前提とし、`any`を避ける。
- 小さく明示的な関数・型で書く。過剰な抽象化をしない。
- Gameplay logicはPure TypeScriptに置き、deterministic / testableにする。
- frame rate依存のgameplay計算を避ける（fixed step / delta time方針は後続Action Designで決定）。
- Magic numberはGameplay tuning値として名前を付けて一箇所にまとめる。
- 周辺Codeのnaming・comment密度・idiomに合わせる。

## 9. Verification Policy

**Lean**
- TypeScript typecheck
- task-owned focused checks
- `pnpm build`

**Standard**
- Lean
- 関連する自動Test
- browser smoke / relevant runtime verification

**Heavy**
- Standard
- regression-sensitive cases
- 該当する場合E2E
- 明示列挙された境界Caseの網羅
- visual / game feelが絡む場合はUser Play Test gate

Taskが指定するLevelに従う。未導入のTool（Vitest/Playwright等）を使うVerificationは、導入Taskが完了するまで要求されない。

**Technical PASS != Gameplay Accepted**

## 10. User Play Test Policy

以下の最終GateはUser Play Testである。自動Test PASSで「受理済み」と判断しない：

- push / impact feel
- movement feel
- animation feel
- camera feel
- touch/control feel
- UI readability
- visual quality
- difficulty / balance
- 「もう一番やりたい」か等のgameplay fun

Completion Reportに User Play Test Required / Not Required を明記する。

## 11. Git Workflow

- `develop`: normal development
- `main`: stable / release

通常Taskは`develop`で行う。Agentが勝手にBranchを切り替えない。
`main`へのswitch / push / promotionは、明示されたRelease TaskまたはUserの明示指示がある場合のみ。

禁止：

- force push / `--force-with-lease`
- rebase
- `reset --hard`
- `commit --amend`
- history rewrite
- blind `git pull`
- unrelated file staging
- unrelated cleanup

通常成功Task：

1. Task-owned fileだけ明示的にstage
2. diff確認
3. verification
4. commit（1 Agent Task ≈ 1 Agent Task Commit）
5. fetch
6. fast-forward safety確認
7. push `develop`
8. remote SHA確認
9. clean working tree確認

remote ahead / divergence / unexpected WIPの場合はSTOPして報告する。

## 12. Completion Report

Taskの完了時に`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`を書く。

Header:

```
Task-ID:
Result:
Branch:
Source-Baseline:
Agent-Start-Head:
Implementation-Commit: THIS_COMMIT
Push-Target:
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT
```

本文はTaskに応じて以下を含める：
Result / Scope / Changed Files / Verification / Acceptance Criteria / Design Deviations / Unexpected Scope / Known Untested Items / User Play Test Required or Not Required / Git delivery

- Source-BaselineとAgent-Start-Headを区別する。
- Agent Task Diffは `Agent-Start-Head..Implementation-Commit` をReviewの正とする。
- Resultが成功の場合のみcommit/pushする。失敗・Safety STOPでは無理に直さずcommit/pushせず報告する。

## 13. GitHub Handoff Workflow

運用はChatGPT → Agent → ChatGPT のTurn-taking。

| File | Owner |
|---|---|
| `docs/agent_handoff/CURRENT_TASK.md` | ChatGPT（Agentは編集しない） |
| `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` | Codex / Claude Code |
| `docs/agent_handoff/PROJECT_HANDOFF.md` | 新Thread/Model向け入口。Userが明示依頼したTaskでのみ更新。毎Task自動更新しない |
| `docs/agent_handoff/README.md` | 短い案内 |

### Task Metadata

```
Task-ID:
Status: READY | REVIEWED
Task-Type:
Executor:
Target-Branch:
Source-Baseline:
Handoff-Mode: GITHUB
```

### Remote-Task-First Preflight

local CURRENT_TASKを最初から信用しない。blind `git pull`は使わない。

```
git status --short
git rev-parse --abbrev-ref HEAD
git fetch origin
git rev-list --left-right --count HEAD...origin/<branch>
git show origin/<branch>:docs/agent_handoff/CURRENT_TASK.md
git merge-base --is-ancestor <Source-Baseline> origin/<branch>
git diff --name-only <Source-Baseline>..origin/<branch>
git merge --ff-only origin/<branch>
git rev-parse HEAD
```

- Coordination Diff（Source-Baseline..origin/<branch>）は`docs/agent_handoff/`配下のみであること。
- Task-ID / Status: READY / Target-Branchをremote taskで確認してからff-onlyで取り込む。

### STOP Conditions

- dirty working tree
- wrong branch
- local ahead
- diverged
- remote task missing
- Task-ID mismatch
- Status != READY
- baseline invalid
- unexpected coordination diff
- FF-only failure

Preflight safety STOPの場合はRepositoryへ何も書かない（Completion Reportも変更しない）。Userへ日本語で報告する。

### Final Review Handoff Semantics

ChatGPT Review後のCURRENT_TASK（Status: REVIEWED）には、必要に応じて以下を保存する：

- Overall Result
- Accepted Baseline
- Accepted Decisions
- Corrections
- Do Not Reopen
- Deferred
- User Play Test
- Regression Risks
- Next Task Constraints

Agentは次Taskでこれを読み、Accepted事項を勝手に再設計しない。Current Source / SPECとMaterial ConflictがあればSTOPして報告する。

### 報告言語

Userへの報告・返信は日本語で行う。
