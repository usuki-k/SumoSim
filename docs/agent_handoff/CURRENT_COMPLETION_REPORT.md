Task-ID: ACTION-02B-GROUNDED-MOVEMENT-FEEL-CORRECTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 8b9acf7444c13648ea36b603b9c642d7c07ca046
Agent-Start-Head: d282a51eae4f88e465a6125f596c64d416aa17d3
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS。Movement modelをgrounded方式へ修正した。**Movement FeelのAcceptはUser Play Testのみ**で、未実施（REQUIRED / NOT RUN）。Agentは「Feel改善」を判定していない。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 3
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Handoff-Mode GITHUB、Source-Baseline 8b9acf7（期待値）
- Source-Baselineは origin/develop のancestor。Coordination Diffは `docs/agent_handoff/CURRENT_TASK.md` のみ
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head d282a51

# Changed Files

- `src/game/sumo/BoutSimulation.ts`（velocity更新を差し替え）
- `src/game/sumo/BoutSimulation.test.ts`（定数名追従 + T12〜T17追加）
- `docs/ARCHITECTURE.md`（Movement model記述の最小同期）
- `AGENTS.md`（stale wordingの修正のみ）
- 本Report
- Scene / Input / Accumulator / package / lockfile: 未変更

# Root Cause / Previous Feel

旧modelは、velocity vector全体を「intent × MAX_SPEED」というtarget velocityへ、単一のrate（加速12 / 減速15 m/s²）で等方的に近づけていた。方向転換時に旧方向のvelocityが加速rateでしか減らず、横方向の成分が残って円弧を描いて滑る、いわば氷上の挙動になっていた。

# Implemented Grounded Movement Model

`applyGroundedVelocity`（module内の小さなPure関数、1tickの更新）。desired direction d（=intent方向）でvelocityを分解する：

- 入力なし: speedを`STOP_DECELERATION`で0まで減らす（方向は保つ、overshootなし、有限tickでexact 0）
- 垂直成分（d直交）: `LATERAL_DECELERATION`で強く減衰 → 方向転換時の横滑りを抑える
- 平行成分:
  - 逆向き（<0）: `REVERSE_BRAKING`で0へ制動（その1tickは0で止める。その後に新方向へ加速するので、1tickでの反転はしない）
  - 同方向で目標未満: `FORWARD_ACCELERATION`で段階的に加速
  - 目標超過（入力magnitudeが下がった時）: `STOP_DECELERATION`で目標まで制動
- 最後に全体speedを`MAX_SPEED`へclamp

**実装中の発見**: 平行成分と垂直成分の合成が、方向転換中にMAX_SPEEDを僅かに超えることがT16で判明（約3.009 m/s）。最終clampを追加して解消した（速度上限のinvariantを保持）。

velocityはcanonical stateのまま。position補正・Tween・Physicsは不使用。

# Provisional constants: before → after（暫定。Final balanceではない）

| 定数 | before | after |
|---|---|---|
| MAX_SPEED | 3 m/s | 3 m/s（変更なし） |
| 加速 | ACCELERATION 12 | FORWARD_ACCELERATION 10（発進をやや重く。約0.3秒で最高速） |
| 停止 | DECELERATION 15 | STOP_DECELERATION 24（約0.125秒で停止） |
| 横方向 | （なし） | LATERAL_DECELERATION 36（約0.083秒で横成分が消える） |
| 逆向き | （なし） | REVERSE_BRAKING 30（最高速からの制動は約0.1秒） |

SIMULATION_HZ = 60は変更なし。

# Direction-change behavior

- 90°転換: 旧方向成分が36 m/s²で減衰し、新方向成分が10 m/s²で増える（約0.1秒以内に横滑りは0）
- 逆向き: 最高速から約6 tickで0を通過し、その後に新方向へ加速する
- 斜め: 正規化済みintentで同様に動作し、速度上限を超えない

# Tests

`pnpm test`: 31 tests PASS（既存24 + 7追加）。

- T12 grounded stop: 単調減少、反転・NaNなし、`ceil(MAX/(STOP×tick))` tickでexact 0（瞬間停止でもない）
- T13 90°転換: 旧成分が毎tick減衰、新成分が増加、減衰量 = 3 tick × LATERAL×tick、有限tickで横成分0
- T14 逆向き: 1 tick目は`MAX − REVERSE×tick`（フル反転しない）、0を経由してから負へ、最終的に−MAX_SPEED、再実行で同一
- T15 同方向加速: 単調、1 tick目 = FORWARD×tick、MAX_SPEEDで停止
- T16 任意方向・過大・斜めintent: 有限、MAX_SPEED以下
- T17 同じtick intent列で同一結果（fixed-step構造は未変更。accumulatorのframe partition Testは既存のまま）
- 追加: 部分入力magnitudeで目標速度が比例
- 既存T1〜T11相当（決定性、zero intent、cardinal、clamp、facing、alias、Phaser非依存、keyboard vector）はexpected値の更新のみでPASS（T2/T5/T6は新しい定数名に追従）
- 挙動のinvariant（単調、非反転、有限、上限）と、暫定定数に紐づくassertion（1 tick目の値、tick数）を分けて記述した

# Verification

- `pnpm test`: PASS（31/31）
- `pnpm build`: PASS
- `git diff --check`: PASS
- 新Dependencyなし、Phaser依存なし

# Browser Smoke

Chrome headless（専用profile）+ DevToolsで実キーイベントを送り、Screenshotで確認した。

- Canvas起動、runtime errorは0件
- S: 画面下へ移動、離すと停止
- D → W: 右移動から上への90°転換が機能した
- D → A: 逆向き入力が機能した
- auto-facing維持（markerが相手方向を向く）、CPUは静止、collision / ring boundaryなし
- 上記はTechnical確認のみで、「人間らしくなった」等のFeel判定はしていない

# Acceptance Criteria

AC-01〜AC-16, AC-18: PASS。AC-17: User Play Testは REQUIRED / NOT RUN として報告。

# Implementation Evidence

1. fixed-step architecture preserved: accumulator / Scene / `step()`のsignatureは未変更
2. grounded stop: T12
3. lateral/turn grip: T13
4. reverse braking: T14
5. max speed / diagonal invariants: T4、T15、T16（最終clamp）
6. Simulation ownership preserved: velocity / position / facingは引き続きSimulationのみ
7. Collision/Push scope creepなし
8. docs Current State: ARCHITECTUREのmovement記述、AGENTSのstale wording

# Design Deviations

NONE

# Unexpected Scope

なし。T16で見つかった速度上限超過は、同じ関数内の最終clamp1つで対応した（Task Scope内）。

# Known Untested Items

- **User Play Test（上記8項目）: REQUIRED / NOT RUN**
- 実時間での体感（重さ、切り返しの responsiveness）
- 144Hz表示等、tab復帰、`pnpm dev`、Mobile / touch
- 短いキータップがframe間で取りこぼされる可能性（Task指示によりScope外）

# User Play Test

REQUIRED / NOT RUN。確認項目: スケートリンク感の減少、発進の重さ、踏ん張って止まる感じ、90°転換の不自然な横滑り、切り返しの重さと responsiveness、auto-facing中の横移動と後退、重すぎないか、「足で動いている」感。調整が必要な場合は上記5定数を動かす。

# Git delivery

`fix: ground bout movement feel` を1 commitで`origin/develop`へpush。mainは未変更。
