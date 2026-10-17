# PROJECT_HANDOFF

新しいChatGPT Thread / Modelが最初に読む入口。Userが明示依頼したTaskでのみ更新する。

## Project概要

SumoSim: CrazyGames等のWeb配信を想定した、相撲の育成・相撲部屋経営Simulation + 見下ろし型相撲Action Game。

## Repository

- Remote: https://github.com/usuki-k/SumoSim.git
- Local path: `E:\develop\CrazyGames\SumoSim`

## Branch Policy

- `develop`: normal development
- `main`: stable / release（明示Release TaskまたはUser指示がある場合のみ変更）

## Current Technology

Node.js 24.22.0 / pnpm 12系 / Vite 8 / TypeScript 6 / Phaser 4.2.1 / VSCode / Codex / Claude Code / Git・GitHub

## Current Development Phase

Repository bootstrap完了後。Gameplay実装は未着手。

## Development Order

1. 超小型Gameplay Loop（Stable → Training → Bout → Result / Reward → Stable）を早期に成立させる
2. 相撲Actionを重点的に作り込む
3. Actionが成立した後にSimulation / Managementを拡張する

## Reading Order

1. `AGENTS.md`（Rule全般のSource of Truth）
2. `docs/GAME_CONCEPT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/agent_handoff/CURRENT_TASK.md`
5. `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## Current State

- Vite + TypeScript scaffold済み
- Phaser 4.2.1 dependency導入済み
- SourceはVite initial sampleのまま
- Phaser Game bootstrapは未実装
- Vitest未導入
- Playwright未導入
- CrazyGames SDK未導入
- Aseprite/Tiled未導入
- gameplay source未実装

## GitHub Handoffの使い方

ChatGPTが`CURRENT_TASK.md`を`develop`へ置き、AgentがRemote-Task-First Preflightの上で実行し、`CURRENT_COMPLETION_REPORT.md`を書いてpushし、ChatGPTがReviewする。詳細は`AGENTS.md`の「GitHub Handoff Workflow」を参照。
