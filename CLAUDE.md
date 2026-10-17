# CLAUDE.md — Repository Entry Guide

RuleのSource of Truthは [AGENTS.md](AGENTS.md)。ここにRuleを複製しない。

1. 最初に`AGENTS.md`を完全に読む。
2. Current Taskに必要なSPEC（`docs/`）とCurrent Sourceを読む。
3. Task Scope外を変更しない。
4. GitHub Handoff Taskは`AGENTS.md`のGitHub Handoff Workflowに従う。local `CURRENT_TASK.md`を先に信用せず、Remote-Task-First Preflightを行う。
5. `docs/agent_handoff/CURRENT_TASK.md`は編集しない。
6. 完了時は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`を書く。
7. Userへの返信は日本語。
8. Visual / Game FeelはUser Play Testが最終Gate。自動Test PASSで受理済みとしない。
