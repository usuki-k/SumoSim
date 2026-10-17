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
- Phaser 4.2.1（`src/main.ts`からGame起動。表示のみのFoundation）
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

- `src/` — Game source（`main.ts`、`game/scenes/BoutScene.ts`。表示Foundationのみ）
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
- Resultは以下のいずれか：
  - `PASS`: 必須Acceptance CriteriaとVerificationを満たした
  - `PASS WITH KNOWN UNTESTED ITEMS`: 必須Gateは満たしたが、明示的な非Blocking未検証項目がある
  - `PARTIAL`: Taskの一部のみ完了。通常は成功Taskとして扱わない
  - `BLOCKED`: 外部判断・Material Conflict・Prerequisite等で安全に続行できない
  - `FAIL`: 必須要件またはVerificationに失敗した
- 通常、commit/pushするのは`PASS` / `PASS WITH KNOWN UNTESTED ITEMS`のみ。`PARTIAL` / `BLOCKED` / `FAIL`のProduction変更は通常成功Commitとしてpushしない。無理に直さず報告する。
- 例外は§13のInvestigation-only Report Commit Exceptionのみ。
- Git Safety / Preflight STOPではCompletion Reportも書かない（§13参照）。

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

#### Remote Task Metadata Gate

`git merge --ff-only`の**前**に、`git show origin/<branch>:docs/agent_handoff/CURRENT_TASK.md`から以下をすべて明示的に検証する（欄が存在するだけでは不十分）：

- Task-ID: Userが開始指示で指定したTask-IDと一致する
- Status: `READY`である
- Target-Branch: 現在のBranchおよびTaskのTarget Branchと一致する
- Source-Baseline: 記載されており、Taskが期待するBaselineと一致し、`origin/<branch>`のancestorである
- Handoff-Mode: 記載されており、`GITHUB`である

#### Coordination-only Diff Gate

`Source-Baseline..origin/<branch>`の変更Fileがすべて`docs/agent_handoff/`配下である場合だけ、`git merge --ff-only origin/<branch>`を許可する。
Source、SPEC、AGENTS.md、CLAUDE.md、package等が1つでも混ざっていればFFせずSTOPする。

### STOP Conditions

A. Git Safety / Preflight STOP：

- dirty working tree
- wrong branch
- local ahead
- diverged
- remote task missing
- Task-ID mismatch
- Status != READY
- Target-Branch mismatch
- Remote TaskにSource-Baselineが無い
- Source-Baselineが期待値と異なる
- Source-Baselineが`origin/<branch>`のancestorでない（baseline invalid）
- Handoff-Modeが無い、または`GITHUB`でない
- unexpected coordination diff
- FF-only failure

この場合はRepositoryへ何も書かない（Completion Reportも変更しない）。Report Commitを作らず、pushせず、Chatで状態だけ日本語で報告する。

B. Investigationの結果としてのBLOCKEDは、Preflightが正常な場合の結果であり、上記Aとは別物（下記Exception参照）。

### Investigation-only Report Commit Exception

通常Rule「成功したTaskだけcommit/pushする」は維持する。そのうえで、以下を**すべて**満たす場合のみ狭い例外を許可する：

1. GitHub Handoff Task（Investigation / Readiness / Design Investigation等）である
2. Remote-Task-First Preflightが正常に成功している
3. 調査がReport可能な結論まで完了している
4. TaskがProduction / Source変更を許可していない
5. 実際にProduction / Source変更をしていない
6. Repositoryで変更するFileが`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`だけである

この場合、`CURRENT_COMPLETION_REPORT.md`だけのReport-only Commit / Pushを許可する（例: `docs(agent): report <Task-ID>`）。`Result: BLOCKED`（Material Conflict、User Decision要、未決設計、必須Prerequisite不足など）でもよい。

これは失敗した実装をcommitしてよいという意味ではない。Implementation Taskの FAIL / BLOCKED / PARTIAL / Verification FAIL / 実装途中 / Blocking Acceptance Criteria未完了 / 未承認Material Design Deviation では、Production変更をcommit / pushしない。

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
