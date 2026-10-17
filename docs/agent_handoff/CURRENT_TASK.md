Task-ID: REPO-GH-HANDOFF-BOOTSTRAP-01
Status: READY
Task-Type: REPOSITORY / WORKFLOW BOOTSTRAP
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 4ebe840e029a0c8b7faa515934fbeea7e7e05acf
Handoff-Mode: BOOTSTRAP

# 目的

新規SumoSim RepositoryへGit運用・Agent Handoff運用・設計文書の骨格を導入する。

# Bootstrap Exception

File ownership確立前の一度限りの例外として、Agentが本Fileを新規作成した。また`main`から`develop`を作成しpushした。
このTask完了後、本FileはChatGPT所有となり、Agentは編集しない。

# 作成対象File

- AGENTS.md
- CLAUDE.md
- docs/GAME_CONCEPT.md
- docs/ARCHITECTURE.md
- docs/agent_handoff/README.md
- docs/agent_handoff/CURRENT_TASK.md
- docs/agent_handoff/CURRENT_COMPLETION_REPORT.md
- docs/agent_handoff/PROJECT_HANDOFF.md

# Source変更禁止

Viteサンプル、Phaser依存関係、package.json、pnpm-lock.yaml、src/をゲーム実装へ変更しない。Vitest/Playwright導入やScene作成は後続Task。

# Verification

- `pnpm build`
- `git diff --check`
- src/・package.json・pnpm-lock.yamlが未変更
- `main`が未変更

# Completion条件

上記Verification PASS後、1 commitで`origin/develop`へpushし、local HEAD == origin/develop・working tree cleanを確認する。
