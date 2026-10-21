Task-ID: ACTION-04A5-COUNTER-TRANSITION-DURATION-TUNING
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: e91e4a3ed079500223afa16f8deed7105943be9a
Agent-Start-Head: 36f4f0b (origin/develop。`e91e4a3` + CURRENT_TASK.mdのみの更新)
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Runtime Smoke PASS。User Play Testは未実施）。

- `COUNTER_TRANSITION_TICKS` を **120 → 90**（約2.0秒 → 約1.5秒、60 Hz）に変更した。これだけ
- path、easing、距離、終点、入力lock、ring-out、Kuzushi、fallbackは変更していない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `e91e4a3`（ancestor）、Handoff-Mode GITHUB
- 変更の範囲: `e91e4a3..origin/develop` は `CURRENT_TASK.md` のみ → `merge --ff-only`

# Exact Duration Change

- `src/game/sumo/BoutSimulation.ts`: `COUNTER_TRANSITION_TICKS = 90 // ~1.5 s`
- pathは `u = ticksElapsed / COUNTER_TRANSITION_TICKS` のままなので、始点・終点・総変位は同じで、通過する時間だけが短くなる

# Changed Files

- `src/game/sumo/BoutSimulation.ts`（定数1つ）
- `src/game/sumo/BoutCounterTransition.test.ts`（`expect(N).toBe(120)` → `90`の1行）
- `docs/ARCHITECTURE.md`（120 / 約2.0秒 / u = k/120 / 120 tick目 → 90 / 約1.5秒 / k/90 / 90 tick目）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Tests Updated

- 120を直接書いていたtestは上の1行だけ。他のtestはすべて `COUNTER_TRANSITION_TICKS` から導出しているため、そのまま新しい長さで通った
- 既存のassertionは弱めていない

# Verification

- `pnpm test`: **PASS — 20 files / 292 tests**（定数だけ変えた時点では1件失敗 = 上の120の1行。修正後に全件PASS）
- `pnpm build`: PASS
- `git diff --check`: PASS

Task必須22項目（すべて既存のtestが、`N = COUNTER_TRANSITION_TICKS` を使って新しい長さで検証している）:
- 1・2・21: 「Success and Best captures start…」（`ticksRemaining = N = 90`）、T84
- 3: 「capture tick does not teleport」
- 4〜6: 「lasts exactly N transition ticks」（90回目の後に `none`、その1つ前までは `active`）
- 7・8: 「held movement acts on the first tick after completion…」、「ignores movement, Push, Counter, Grip and Drive…」
- 9〜12: 「D1 / D4…」、T78、T79、T85、T87、「pair never overlaps…」
- 13: 「D3…」、T84
- 14・15: 「velocities report…」、T86
- 16・17: 「D2…」、T89
- 18: T101、T108、「D2: after completion…」
- 19・20: 「a failed Counter…」、T81、「no valid target…」
- 22: 「same intent script reproduces…」

# Browser / Runtime Smoke

**PASS**（headless Chrome + CDP。A4と同じ方法。`step` を読むだけのwrapperで包み、ダミーのPushにDownを合わせた）。

| 確認 | Best | Success |
|---|---|---|
| 開始時の `ticksRemaining` | 90 | 90 |
| 遷移のtick数（active → none） | **90** | **90** |
| 最小距離 | 0.700000 | 0.700000 |
| pusherの移動 | (0,0) → (−0.35,0) | (−0.02,0) → (−0.37,0) |
| 終点 | Counter userはpusherの真後ろ (0.35,0) | 真横 (−0.37,−0.70) |
| 完了時のpusher | Kuzushi | Kuzushi |
| 完了直後のShift | Morozashi（holder wrestler-a） | Morozashi（holder wrestler-a） |
| R | 比較表示に戻り、遷移none、ongoing | 同左 |

- 実行時のerror / 例外: なし（favicon.icoの404のみ。以前から）
- 1.5秒 = 90 tick × 1/60 秒は、tick数で確認した（Simulationが固定60 Hzのため）
- 初回のBest実行は、smoke script側のhookの読み込みが間に合わず失敗した（gameのsourceではなく、Agentのscript）。再実行でPASS
- 遷移中の入力lock、pusherのKuzushi、teleportが無いことは、tick数以外の動作がA4から変わっていないため、testで確認した

# Preserved（変更していないもの）

- D1: `COUNTER_STAGGER_DISTANCE = BODY_RADIUS`（0.35 m）
- D2: 完了時に `KUZUSHI_TICKS = 30` を改めて与える
- D3: 開始時に2人のself / external velocityを0にする
- D4: Success = 真横、Best = 真後ろ（半径の和ちょうど）
- path / easing（`counterStaggerEase`、`counterWrapEase`）
- 入力lock、ring-out / Tokudawara（毎tick、2人とも。免除なし）、freeze
- 候補が無いときのACTION-04A2 fallback、失敗したCounter、Counterの窓 / tier

# Inherited A4 Known Untested Items（解消していない）

- 自然な配置で、同じtickに2人とも土俵を出る明示的なfixture
- Tokudawaraの窓の側線で、同じtickの中に出て戻る明示的なfixture
- 実機のGPUでの描画（smokeはSwiftShaderのheadlessのみ）
- そのほか、A4で報告した事項は同じ状態のまま
  - 土俵際でCounter userが遷移の途中で負けうる点
  - 崩しが終わる瞬間のpusherの向きの瞬時の回転

# User Play Test Required

**Required**。確認してほしい点:
- Success: 約1.5秒の横への動きが、より良くなったか。急すぎないか
- Best: 背後へ回り込む動きが、1.5秒でも読めるか。pusherのよろけが読めるか
- 遷移の後: 操作が戻るタイミング、Counter → Grip → Morozashiの機会

最終的な手触りの判断はUserが行う。

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

なし。

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`tune: shorten counter transition`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- `main` と `CURRENT_TASK.md` は変更しない
