Task-ID: ACTION-03A-CONTACT-SEPARATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 29073732a123163bb11e81d7b4b82ac7ffeb5bbd
Agent-Start-Head: c63505280c0aadec31d332c9af28431879914256
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS。Contact & Separationを実装した。Contact FeelのUser Play Testは**未実施（REQUIRED / NOT RUN）**。

**要確認の発見（Design Deviationではない）**: Taskが指定した順序（積分 → contact解決 → 対称な位置補正）に従うと、静止している相手に歩き込み続けた時に、相手が約0.083 m/sでじわじわ押し出される（位置補正のcreep）。Push（外力）は実装していないが、見た目上は「ゆっくり押される」挙動になる。詳細は「Findings」。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 2
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Handoff-Mode GITHUB、Source-Baseline 2907373（期待値）
- Source-Baselineは origin/develop のancestor。Coordination Diffは `docs/agent_handoff/` の `CURRENT_COMPLETION_REPORT.md` / `CURRENT_TASK.md` のみ
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head c635052

# Changed Files

- `src/game/sumo/BoutTypes.ts`（`ParticipantState.bodyRadius`）
- `src/game/sumo/BoutSimulation.ts`（`BODY_RADIUS`、`CONTACT_SLOP`、`resolveContact()`、Snapshotへ`bodyRadius`）
- `src/game/sumo/BoutSimulation.test.ts`（T19〜T25、T28 + 補助Test）
- `src/game/scenes/BoutScene.ts`（`BODY_RADIUS_METERS`を削除し、Snapshotの`bodyRadius`で描画）
- `docs/ARCHITECTURE.md`（Current State）
- 本Report
- AGENTS.md / package / lockfile / Accumulator / Input: 未変更

# Contact Geometry

- 各participantが同値の円（`BODY_RADIUS` = 0.35 m、暫定）を持つ。Simulation所有で、Snapshotに`bodyRadius`として出る。Sceneは描画にこの値を使うだけ
- Height / Weightは未導入、`BoutSetup`への追加もなし
- Setup時点で重なっているCaseは、最初の`step()`で解決される（constructorは補正しない）

# CONTACT_SLOP provisional value

`CONTACT_SLOP = 0.002 m`（2 mm、暫定）。`distance <= rA + rB + CONTACT_SLOP`をcontactとする。SLOP内で離れているだけの状態は位置補正しない（隙間を作らない、押しもしない）。

# Contact normal / same-center fallback

- 法線は A→B、`n = delta / distance`
- `distance <= 1e-9`（同一点）のfallbackは **A（participants[0]）のfacing方向**。facingは常にfiniteなので、NaNは出ない。facingの初期値は0（+x）。乱数なし

# Separation behavior

積分後に`distance < rA + rB`なら、`overlap/2`ずつA（−n）とB（+n）へ移動する（等質量の対称、1回の射影、反復なし）。結果は`distance == rA + rB`（数値誤差内）。質量重み付けなし。

# Closing velocity handling

contact（SLOP含む）の時、Aのself velocityのうち`+n`方向（Bへ向かう）の成分、Bの`−n`方向（Aへ向かう）の成分だけを除去する。接線成分は保持し、全体のzero化も反発もない。非接触時は何もしない（ACTION-02Bの移動と同一）。

# Step order（Taskどおり）

1. intent sanitize、2. grounded self velocity更新、3. position積分、4. `resolveContact()`、5. facing更新

# Tests（T19〜T28 + regression）

`pnpm test`: 45 tests PASS（既存31 + 14追加）。

- Snapshot `bodyRadius`のisolation（T26）
- T19 exact touch（補正なし、120 tickで不動）、SLOP内（隙間を作らず押し出さない）
- T20 微小重なり（対称に分離、距離 = 半径和）
- T21 同一点（決定的、有限、+xのfallbackで分離）
- T22 正面から最高速で接近：両者が歩き込む、片方が静止相手へ歩き込む、400 tick貫通・入れ替わりなし、contact時の法線速度が除去されている。速度invariant（`2·MAX_SPEED·TICK < 半径和`）
- T23 かすめ接触：接線方向に移動し続ける、法線成分はなし。接触で速度が全zero化されない
- T24 向かい合って歩き込み続ける：200 tickで落ち着き、さらに300 tick位置がびくともしない（<1e-9）
- T25 非接触時：近い相手と遠い相手（1000 m）で、位置・velocityが完全一致（ACTION-02B regression）
- T28 5方向×80 tickの両者移動：決定的、すべて有限、常に非重なり
- T27 Phaser非依存：既存のsource検査Testが継続してPASS
- 既存T1〜T18（movement、fixed-step、grounded）: PASS（修正なし）

# Verification

- `pnpm test`: PASS（45/45）
- `pnpm build`: PASS
- `git diff --check`: PASS
- 新Dependencyなし。Push / externalVelocity / mass / Ring-outなし

# Browser Smoke

Chrome headless（専用profile）+ DevTools実キーイベント、Screenshot確認。

- Canvas起動、runtime errorは0件
- D長押しでPLAYERがCPUに接触し、重ならずに止まる（接触中も静止、見た目に揺れなし）
- W+D（斜め）で接触を保ったままCPUの周りを回り込む
- Aで離れる
- CPUは静止の設定だが、上記creepで少しずつ動く（Findings）
- ringはまだ判定なし（Playerはring外へ出られる）。Vite starter UIなし
- 非接触時の移動は変更なし（T25）。体感の同一性はUser Play Testで確認

# Findings

1. **Position correctionによるcreep（約0.083 m/s）**
   - 状況：静止しているBへ、Aが前進入力を続ける
   - 流れ：積分でAが毎tick約0.0028 m進み、重なりが出る。対称な分離により、Bも毎tick約0.0014 m（0.083 m/s）押し出される
   - 実測：`BoutSimulation`でAが前進し続けた場合、Bは約0.0833 m/s（`FORWARD_ACCELERATION×TICK/2`相当）で後退する（Testに範囲assertionを置いた）
   - Task記述との整合：仕様の順序・対称補正をそのまま実装した結果で、逸脱ではない。ただし「静止相手はまだ押されない」というUser Play Test項目7とは見た目が一致しない
   - 03Bへの含意：Push導入後は、この補正が押しの一部として混ざる。Push側で明示的な力にまとめるか、補正を質量重み付き（03B/03D）にするか、設計時に整理が必要
   - 判断をUser / ChatGPTに委ねる点：現状のcreepを許容するか、03Aの時点で補正を静止側へ寄せる（例：自己移動していない側を動かさない）か。Agentは勝手にSemanticsを変えていない
2. 立合い等の将来のhigh-speed Stateでは、速度invariantの再検討（またはCCD）が必要。現状は6 m/s相対でも1 tick 0.1 m < 半径和0.7 m

# Acceptance Criteria

AC-01〜AC-17、AC-19: PASS（AC-10: T24、AC-17: ARCHITECTURE同期）。AC-18: User Play Testは REQUIRED / NOT RUN。

# Implementation Evidence

1. Simulation-owned body radius: `BODY_RADIUS`、Snapshot `bodyRadius`
2. deterministic normal: `distance > 1e-9`なら実距離、その他はAのfacing（T21）
3. symmetric separation: T20
4. closing-normal removal: T22、T23
5. tangential preservation: T23
6. no-contact regression: T25（位置・velocityが完全一致）
7. no Push/externalVelocity scope creep: `mass`、`pushForce`、`press`、`externalVelocity`は存在しない
8. Scene reads Snapshot geometry: Sceneに`BODY_RADIUS_METERS`が残っていない

# Design Deviations

NONE（ただしFinding 1を参照）

# Unexpected Scope

なし。

# Known Untested Items

- **User Play Test: REQUIRED / NOT RUN**
- 接触の体感（固さ、粘り、回り込み）、creepの見え方
- Browserでの長時間の押し続け、実機の60Hz以外、Mobile
- 追加のdummy controller（歩いて寄る相手）は、Task方針（不要なら追加しない）に従い未追加。接触の確認は静止相手で行える

# User Play Test

REQUIRED / NOT RUN。確認項目（Taskの8項目）に加えて、**静止した相手がじわじわ動く感じ（Finding 1）が許容できるか**を見てほしい。

# Git delivery

`feat: add bout contact separation` を1 commitで`origin/develop`へpush。mainは未変更。
