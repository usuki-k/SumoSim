Task-ID: ACTION-03A2-CONTACT-CREEP-CORRECTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 02a4047328e560a986d677ea13c890a43607b381
Agent-Start-Head: 417cec630b82e37b675fae04ad8537ea8d2e31c5
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS。接触による暗黙の位置Push（creep）を除去した。Contact FeelのUser Play Testは**未実施（REQUIRED / NOT RUN）**。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 2
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Handoff-Mode GITHUB、Source-Baseline 02a4047（期待値）
- Source-Baselineは origin/develop のancestor。Coordination Diffは `docs/agent_handoff/CURRENT_TASK.md` のみ
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head 417cec6

# Changed Files

- `src/game/sumo/BoutSimulation.ts`（`resolveContact()`の補正配分、`INWARD_EPSILON`）
- `src/game/sumo/BoutSimulation.test.ts`（creep Testを置換、T29〜T34）
- `docs/ARCHITECTURE.md`（contact記述の1行）
- 本Report
- BoutTypes / Scene / AGENTS / package: 未変更

# Root Cause

重なり補正が常に50/50の対称だったため、静止した相手へ歩き込み続けると、毎tickの食い込み（約0.0028 m）の半分が静止側へ移り、約0.083 m/sで押し出されていた（ACTION-03Aで報告したFinding 1）。

# Corrected Penetration Ownership Rule

`resolveContact()`の内部順序（Taskの推奨どおり）：

1. 法線A→B（変更なし）
2. **closing velocityを除去する前に**、各participantのinward contributionを取る
   - `inwardA = max(0, v_A·n)`、`inwardB = max(0, −v_B·n)`
3. closing normal velocityを除去（変更なし。接線成分は保持）
4. `overlap > 0`なら、`shareA = inwardA / (inwardA + inwardB)`で配分する
   - AはShare分を`−n`へ、Bは(1−share)分を`+n`へ戻す
   - Case A（Aだけ）→ Aに全量、Case B（Bだけ）→ Bに全量、Case C（両方）→ 寄与の比、equalなら50/50

# Fallback behavior（Case D）

- 寄与の合計が`INWARD_EPSILON`（1e-9 m/s）以下の場合は50/50が基本（setup時の重なり、同一点で動きなし）
- **Case Dの小さな精緻化（下記Design Deviationsに記載）**：寄与が無くても片方だけが動いている（speed > epsilon）場合は、動いている側だけを戻す。両方動いている、または両方とも動いていない場合は50/50のまま

# Design Deviations

**Planned**: Case D（有意なinward寄与なし）は常に決定的な50/50で分離する（Task §3 Case D）。

**Implemented**: Case Dのうち「片方だけが動いている」場合は、動いている側へ全量を配分する。それ以外のCase D（setup時の重なり、同一点、両方動いている、両方静止）は仕様どおり50/50。

**Reason**: 仕様どおりの純粋な50/50だと、相手の周りを回り込む（circling）時に曲率の影響で「重なっているが接近方向の速度成分はほぼ0」というtickが発生し、静止している側が約1 cm/30秒ずつ動いてしまうことが実測で判明した（T34のcircling Test、0.00996 m）。Taskの目的（「ContactだけでStationary participantを動かさない」）と、§3 Case Dの文言が、この具体Caseで衝突していた。

**Semantics changed?**: 仕様のCase A〜Cとsetup時の重なりCaseには変更なし。Case Dの中の「片方だけ動いている」サブケースだけを、目的に沿う側へ寄せた。ChatGPT Reviewで異論があれば、`BoutSimulation.ts`のこの分岐（約6行）を削除すれば純粋な50/50へ戻せる。

# Tests

`pnpm test`: 51 tests PASS（前回45から、creep Testを削除して6つ追加）。

- T29 静止相手へ600 tick歩き込む：Bの位置・速度が毎tick厳密に不変、Aは接触位置で停止、停止後の位置が不動（creepが無いことをassert）
- T30 反転した配置（BがAへ歩き込む）：Aが不変
- T31 対称な正面歩き込み：中点を保って落ち着き、落ち着いた後に位置が動かない
- T32 非対称な寄与（A = 0.1667 m/s、B = 0.12 m/s）：補正量が寄与の比で配分され、寄与が大きいAのほうが多く戻る
- T33 setup時の重なり（動きなし）と同一点：50/50で、NaNなし
- T34 かすめ接触：接線成分を保持し静止側は不動。**30秒（1800 tick）のcircling**でも静止側が一切動かない（精緻化前は約1 cm動いた）
- T35 非接触時のACTION-02B regression：既存T25がそのままPASS
- T36 既存のCONTACT_SLOP / exact touch / 高速接近 / 決定性 / 有限性 / Phaser非依存：PASS
- 既存のmovement / fixed-step / grounded Test：変更なしでPASS

# Verification

- `pnpm test`: PASS（51/51）
- `pnpm build`: PASS
- `git diff --check`: PASS
- 新Dependencyなし。Push / externalVelocity / mass / Ring-outなし

# Browser Smoke

Chrome headless（専用profile）+ DevTools実キーイベント、Screenshot確認。

- Canvas起動、runtime errorは0件
- D長押しで接触し、静止CPUが**初期位置のまま動かない**（前回Smokeでは右へずれていた）
- 接触中に揺れなし、W+Dで接触したまま回り込めた
- 非接触の移動は変更なし。ring外へは出られる（Ring-out未実装）
- 反転配置はUnit Test（T30）で確認

# Acceptance Criteria

AC-01〜AC-15, AC-17: PASS。AC-16: User Play Testは REQUIRED / NOT RUN。

# Implementation Evidence

1. 静止体のcreepなし：T29（600 tickでB不変）、T34（30秒circling）
2. mirrored：T30
3. 比例配分：T32、T31
4. 50/50 fallback：T33
5. closing velocity除去は維持：T22、T23の既存Test
6. 接線成分の保持：T23、T34
7. movement / contact regression：T25と既存Test
8. Push scope creepなし

# Unexpected Scope

なし。

# Known Untested Items

- **User Play Test: REQUIRED / NOT RUN**
- 長時間の実機Play、60Hz以外のdisplay、Mobile
- 両者が同時に同方向へ動くCase（追随など）の体感

# User Play Test

REQUIRED / NOT RUN。確認項目：すり抜けない、静止相手が動かない、接触時の隙間、揺れ、回り込み、粘り、非接触移動が基準のまま、Pushがまだ無くてよいこと。

# Git delivery

`fix: prevent contact separation creep` を1 commitで`origin/develop`へpush。mainは未変更。
