Task-ID: ACTION-11H-GRIP-SUCCESS-TONE-MATCH-GATE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 5938e76372ae0fc5a5099c4091defe630804a920
Agent-Start-Head: ee6c2787687d60fe06740329ddbbbd45f9c51a50
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / 全wrestler-art test、exporterの決定性と`--check`、`pnpm test`、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

Grip successの書き出しで、正規化した後のred runtimeの肌だけを、採用済みのidle red runtimeの明るさ分布へ合わせた。

- 方法: 決定的なtone補正（候補C: 肌の輝度P20 / P50 / P80によるlevels）
- 変えていないもの: 髪・まわし・輪郭・alpha・geometry
- blueは、補正済みのredから、既存の反射 + まわしの塗り替えで作る
- AIによる再生成はしていない。`input.local`のsourceも編集していない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `5938e76`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `5938e76..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `ee6c278`

# Reference / Source identity

| 項目 | 値 |
|---|---|
| tone reference | `public/assets/action/wrestler/red.png`（idle red runtime、158x178）、pixel SHA-256 `d66895bf7301cd3dc9573cea07db7dceca07f2114ba85bcc0be763334313cdaa` |
| referenceの検証 | `export_runtime_wrestlers.py --check` ok。recipeの`reference_pixel_sha256` = test fixtureの`ACCEPTED_RED_PIXELS`（test T2） |
| Grip success source | `input.local/candidate_red_grip_success.png`、1283 x 1226 RGBA、decoded `0cedde98…e566e`、file `aace9edc…cb1f679793`。編集なし。exporterがidentityを検証する（T1） |

# Skin mask

runtime解像度（160x183）で、次の条件をすべて満たす画素を肌とする（recipe `skin_tone_match.mask`）:

- alpha ≥ 250
  - runtimeの内部alphaは253前後。縁の半透明画素は対象外
- 採用済みのまわしmask（`runtime_wrestler_recipe.json`のrule、`im.mawashi_mask`）の外
- HSVで、hue 12–50°、saturation ≥ 0.2、value ≥ 0.35
  - 黒い髪・輪郭・白い元結・白いhighlightは、ここで落ちる

診断:

| 項目 | 値 |
|---|---|
| 肌の画素数（Grip success） | 11073 |
| 肌の画素数（idle red） | 11706 |
| まわしmaskとの重なり | 0（T4） |
| まわしmaskに隣接する肌の画素 | 32（境界。補正は明るさだけなので、色の混入は無い） |
| 暗い画素（max RGB < 90）に隣接する肌の画素 | 1073（輪郭の内側の縁。画素そのものは value ≥ 0.35） |
| 補正後のまわしmask（blue） | mask 2394 / missed 17 / fringe 47（補正前と同一、標準limit内） |

# Brightness statistics（relative luminance Y、linear-light sRGB、Rec.709の重み）

| | P05 | P20 | P50 | P80 | P95 | mean |
|---|---|---|---|---|---|---|
| idle red（目標） | 0.2170 | 0.3291 | 0.5346 | 0.5541 | 0.5661 | 0.4571 |
| A: 補正なし | 0.2660 | 0.4437 | 0.5554 | 0.5637 | 0.5913 | 0.5029 |
| B: gamma 1.065（P50を合わせる） | 0.2442 | 0.4193 | 0.5354 | 0.5435 | 0.5706 | 0.4822 |
| **C: levels P20 / P50 / P80（採用）** | 0.1972 | 0.3294 | 0.5354 | 0.5556 | 0.5830 | 0.4609 |

idleとの差（P20 / P50 / P80）とRMS:

| 候補 | P20 | P50 | P80 | RMS | clip |
|---|---|---|---|---|---|
| A | +0.1145 | +0.0208 | +0.0096 | 0.0674 | 0 |
| B | +0.0902 | +0.0007 | −0.0106 | 0.0524 | 0 |
| **C** | +0.0003 | +0.0007 | +0.0015 | **0.0010** | 0 |

分布の読み方:

- 補正前のsuccessは、明るい部分（P50 / P80）はidleとほぼ同じで、影（P20）が明るい。陰影が浅い絵だった
- Bは中間調しか動かせず、影の差が残る
- Cは影を深くし、P20 / P50 / P80をほぼ一致させる
- 目視（`tone_candidates.png`）でも、Cは白っぽく飛んだり平坦になったりせず、陰影の形は保たれた

# Selected method / parameters

- 候補C: 肌のY上の単調な折れ線
  - 通る点: (0, 0)、(0.44367 → 0.32912)、(0.55539 → 0.534612)、(0.5637 → 0.554119)、(1, 1)
  - 肌の各画素の線形RGBを Y' / Y 倍する（色度は保つ）。1でclipし、8-bit sRGBへ戻す
- recipe: `grip_success_gate_recipe.json`の`skin_tone_match`
  - 持つもの: reference、そのhash、輝度の定義、mask、method、`curve_points`、measurement_evidence
  - `load_recipe`が、端点(0, 0)–(1, 1)と、狭義単調増加を検査する
- pipeline: 正規化したred → 肌mask → tone補正 → 補正済みred → local-Y反射 → まわしの塗り替え → blue
  - tone補正は1回だけ（red）。blueでは再計算しない（T15）

色相 / 彩度（CIELAB、肌maskの中央値）:

| | chroma | hue angle |
|---|---|---|
| idle red | 43.65 | 62.20° |
| success 補正前 | 41.75 | 65.93° |
| success 補正後 | 41.50 | 65.89° |

- 画素ごとの色相の変化: 中央値0.37°、最大1.73°（8-bitへの丸め由来）。意図的な色相の変更はしていない
- 残っている差: successの肌は、idleより約3.7°黄色寄りで、彩度がわずかに低い。この差はTaskの方針（明るさだけを補正する）により残した

# Runtime textures

| file | size / pivot | pixel SHA-256 | file SHA-256 |
|---|---|---|---|
| `grip-success-gate/red.png` | 160 x 183 / (83, 98)（不変） | `5852751b85dae79826848bd6daec751fa3addc572b5943ff95047f22c1187221` | `d22fa82db6c760fa011aa7fc31e193477d7fa554706bb7ade3ce9f3ff0a362f6` |
| `grip-success-gate/blue.png` | 160 x 183 / (83, 85)（不変） | `624d2d51b9fba3a24aebcf6750335abc8054dd1fd5cfd239469daa679ee542e2` | `7aa9e544f8e95992724fee619fd8b7eea29bdf7f97b3de2b710120680d81c336` |

旧hash: red `afab5fbc…`、blue `2336e895…`。

# Invariants

- alpha: 補正前後で完全一致（T8、real / synthetic）
- 肌mask外の画素: 完全一致（T9、real / synthetic）。maskの中は過半数の画素が変わる
- clipping: 0画素。補正後の肌に、channelが0または255の画素は無い（T12）
- geometry: 寸法・pivot・body core 123.076923 px・FRONT 160.2°・root・body coreのsource点は不変（T16、`test_gate_pixels_sizes_and_pivots`、TS metadataとの一致test）
- `src/game/presentation/`の変更は無い（TSのmetadataの寸法・pivotは不変なので、更新不要）

# Tests

`tests/test_export_grip_success_gate.py`: 24 / 24 OK（ACTION-11Hで6件追加、2件を更新）

| ID | test |
|---|---|
| T1 | `test_user_source_identity`、`test_missing_or_changed_source_fails_closed` |
| T2 | `test_idle_reference_identity` |
| T3–T6 | `test_real_skin_mask_excludes_mawashi_hair_and_outline`（決定的、まわしとの重なり0、暗い画素なし、alpha ≥ 250、5000画素より多い） |
| T7–T9 | `test_tone_match_touches_only_skin_rgb`（synthetic）、`test_real_tone_match_improves_the_idle_match_without_clipping`（real） |
| T10 | `test_tone_curve_is_monotonic`、`test_invalid_recipes_fail`（非単調・端点違反・欠落でfail） |
| T11 | real: 補正後のquantile誤差 < 0.005、かつ補正前の1/10未満。evidenceの値は、新しく測った値と一致する |
| T12 | real: clip 0、0 / 255の画素なし |
| T13 / T14 | `test_red_is_the_tone_matched_normalized_pose_and_blue_its_reflected_recolor` |
| T15 | `test_tone_match_runs_once_on_red_only` |
| T16 | `test_gate_pixels_sizes_and_pivots`（新しいhash、寸法・pivotは不変） |

# Verification

| 項目 | 結果 |
|---|---|
| Grip success exporterのfocused test | 24 / 24 OK |
| wrestler-art suite全体 | 209 / 209 OK |
| Grip success exporterの決定性 | 書き出しを2回繰り返し、`--check`（pixel + PNG byte）が一致 |
| `export_grip_success_gate.py --check` | ok |
| `export_grip_attempt_gate.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` / `export_counter.py --check` | すべてexit 0 |
| `pnpm test` | 30 files、518 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/`と、`grip-success-gate/`以外のpublic wrestler assetのdiff | 0行（idle / Tsuppari / Counter / Grip attempt、ACTION-11Fの定数、ACTION-11Gのlimbのcode / geometryは不変） |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU、Vite dev server、1920x1080。ACTION-11Gのscript（27項目）を、新しいtextureで実行した。結果は **27 / 27 PASS**。

確認できたこと:

- Grip attempt → success、neutral、Drive、Morozashi、turning、release → idleの選択・offset・limbは不変
- success textureは200で読み込まれる
- console error・例外は無い（既存の`/favicon.ico` 404は除外）

ACTION-11Gのlimb VFXは、Taskの指示どおり残してある（変更なし）。

目視（`smoke11h\pair_sheet.png`）:

- success中の肌は、ACTION-11Gの時点（`smoke11g\pair_sheet.png`）より影が深い
- release直後のidle（`05`）との明るさの差が縮まった
- 髪・まわし・輪郭は変わらない
- limbの肌色（`#f3b47c`、ACTION-11Gで固定）は、補正後の体より明るく見える。limbはこのTaskの対象外なので、変えていない

# Comparison artifacts（ローカルのscratchpad、commitしない）

- `tone_candidates.png`: idle red / A（補正なし）/ B / C を同じ縮尺で並べ、統計値をlabelに入れた
  - 1枚で、Taskが求める比較1–3を兼ねる
- `tone_chosen_pair.png`: idle red / success A / success C / idle blue / success blue（補正済みredから派生）
- in-game: `smoke11h\`の8枚と`pair_sheet.png`

# Changed Files

- `tools/wrestler_art/grip_success_gate_recipe.json`: `skin_tone_match`の節
- `tools/wrestler_art/export_grip_success_gate.py`:
  - 追加: `luminance` / `skin_mask` / `tone_curve` / `skin_quantiles` / `tone_match`、`load_recipe`の検査
  - 変更: `build_textures`で、正規化の直後にtone補正をかける
- `tools/wrestler_art/tests/test_export_grip_success_gate.py`: T1–T16
- `public/assets/action/wrestler/grip-success-gate/red.png` / `blue.png`: 再書き出し（tone補正済み）
- `tools/wrestler_art/README.md`: Grip successの節に、tone補正の説明を1項目
- `docs/ARCHITECTURE.md`: ACTION-11Dのnoteに、ACTION-11Hの補正を1文追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない
- 気づいた点（変更していない）: success textureのまわしの赤は、idleより明るく鮮やかに見える。まわしはTaskで保護対象なので、補正していない
- 気づいた点（変更していない）: ACTION-11Gのlimbの肌色は、補正後の体より明るい。limbは別のTaskの対象

# User Visual Gate: REQUIRED

主な問い: Grip successは、通常 / attemptの状態と同じ光の当たり方の、同じキャラクターに見えるか。successのposeの陰影は失われていないか。

- 肌の明るさの跳びは減ったか
- highlightは揃っているか、影は読めるか
- 肌の色相は自然か。残りの約3.7°の黄色寄りが気になるか
- まわし・髪・輪郭は変わっていないか
- blueも揃って見えるか
- idle / attempt → successの切り替えが、別の照明のイラストへの切り替えに見えなくなったか

まだ合わない場合は、残りの問題が明るさ・コントラスト・色相・highlightの位置のどれかを教えてほしい。

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`art(action): tone match grip success wrestler`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
