Task-ID: ART-TOOL-02-TOKUDAWARA-PREVIEW
Result: PASS
Branch: develop
Source-Baseline: 791fb16b1934a68d2840404809d1e17d32e70904
Agent-Start-Head: e2ad0d0e6c3a9f8a520cfcdf50720eacf9c2c539
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Technical）。**Product Visual Approvalは未了（User Gate）**。

- `tools/dohyo_art/` に、4方向の徳俵を厳密な幾何で描く機能を追加した
  - CLI `--tokudawara-depth` / `--tokudawara-half-angle-deg`。既定は無効
- 徳俵が無効のときは、旧compositorとpixel単位で同じ出力になる
  - 実Product: PNG 6ファイルがbyte一致
  - 合成fixture: 旧版で取ったhashをtestで固定した
- 実Productで3つの候補を生成した
  - **Candidate A**（depth 42 / 9° / 受理済みalignment）: **下側の徳俵が石枠と装飾ブロックに明確に重なる**
  - そのためCandidate B（depth 8）とCandidate C（depth 42 + 最小の再alignment）も作った
- Tests 50件PASS（新規15件）
- `src/`、Ring-out、package、lockfileは未変更。Product画像はcommitしていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `791fb16`（ancestor）、Handoff-Mode GITHUB
- `791fb16..origin/develop` の変更は `docs/agent_handoff/` の2ファイルのみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `e2ad0d0`
- 実入力2ファイルの存在を確認した
- Investigation Reviewで加わった修正（将来のRing-outは、最も早いIN→OUTの交差を使う）を確認した。本Taskでは実装しない
  - 本Taskの幾何は、その境界（R・R+Dの円弧と放射方向の側端）と同じ図形にしてある

# Changed Files

| File | 内容 |
|---|---|
| `tools/dohyo_art/compose_dohyo.py` | `Geometry.tokudawara_depth / tokudawara_half_angle_deg`、検証、`tokudawara_window_distance`（folding）、`render_tawara_ring_tokudawara`、guideの描画、manifest `tokudawara`（schema 3）、CLI |
| `tools/dohyo_art/tests/test_compose_dohyo.py` | `TokudawaraTests`（14件）、full sizeのCLI smoke、CLIのfail-closed 2ケース |
| `tools/dohyo_art/README.md` | Tokudawaraの節（目的、幾何、候補値と最終値、CLI、Candidate Aのcommand、比較方法）、defaults、fail-closed、tests |
| `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` | 本Report |

# Implemented Tokudawara Geometry

記号（master px）: R = `--outer-radius`、w = 俵の幅、D = depth、H = half angle。

- **4つの同じsection**を **+x / +y / −x / −y** に置く。窓は `|angle − k·90°| ≤ H`（閉区間）
- **通常の部分**（窓の外）: 帯 `[R − w, R]` で、従来のまま
- **徳俵の部分**（窓の中）: 帯 `[R + D − w, R + D]`。窓の中に通常の帯は残さない
- **側端の接続**: 窓の端の放射方向の線
  - 窓の判定は、点を第1八分円へ折り畳んでから行う: `ax=|dx|, ay=|dy|, along=max, across=min`、`s = along·sinH − across·cosH`（窓の中で s > 0）
  - 絶対値と入れ替えはIEEEで厳密なので、4つの窓と左右の側端（8本）がすべてbit単位で同じ計算になる
  - AAは `clip(s + 0.5)` で、通常の帯と徳俵の帯を混ぜる
  - 帯同士が隙間なく接するように、`D ≤ w` を必須にした
- **将来のgameplay境界と同じ図形**: 窓の外はR、窓の中はR+Dの円弧で、その間を、窓の端で R から R+D までの放射方向の線分でつなぐ
- **Texture**
  - `tawara_source.png` をそのまま再利用し、新しいassetは作っていない
  - 徳俵は、それぞれの軸からのlocalな角度でmapする（tile中心を軸に置く。`TOKUDAWARA_TEXTURE_PHASE = 0.5`）。4つとも回転に対して同じ見た目になる
  - 通常のringは、従来どおり連続したmappingのまま
  - phaseをCLIで変える必要はなかったので、定数にとどめた
- **Guide**: 有効なときだけ、徳俵の外縁の円弧と側端8本を黄色で追加する。無効のときのguideは従来と同じ

# CLI Contract

```
--tokudawara-depth D            master px, 0 = disabled (default 0), must be <= tawara width
--tokudawara-half-angle-deg H   (0, 45) degrees, required when D > 0
```

次の場合はfail closedする（exit 2、何も書かない）。
- depth < 0、または非有限
- depth > 俵の幅
- half angleがない、範囲外、または非有限
- R + D がcanvasからはみ出す

既存のCLI呼び出しはそのまま動く。

# Backwards-Compatibility Evidence

- 実Product: 新しいtoolを無効のまま（受理済みalignmentで）実行し、既存の `output-aligned.local/` と比べた
  - arena / overlay / guide / composite / overlay_1920 / preview の **6ファイルすべてがbyte一致**
- 合成fixture: 旧版（HEADの `compose_dohyo.py`）と新版で、overlay / guide / compositeのpixel hashが一致した
  - test `test_disabled_reproduces_legacy_circle_pixels` に定数として固定した（depth=0とhalf=9の組み合わせも同じ）
- manifestだけは、`tokudawara: {"enabled": false}` が加わるので変わる（schema 2 → 3）

# Candidate A（主候補）

- 値: `--tokudawara-depth 42 --tokudawara-half-angle-deg 9`、`--arena-scale 1.072 --arena-offset-x 5.36 --arena-offset-y 77.72`
- 出力: `tools/dohyo_art/output-tokudawara-a.local/`
  - 3840×2160が4つ、1920×1080が2つ、manifest schema 3
- 実際のoverlayの幾何
  - alpha bbox = `(1078, 238, 2762, 1922)`（= 1920 ± 842、1080 ± 842）
  - 4つの中心線の上で、徳俵の帯（r ≈ 821）はalpha 252（sourceのalpha）、窓の中の基準帯（r ≈ 779）は0
  - r ≥ 842.5 は全域でalpha 0

**Agentによる暫定の目視評価**（最終判断はUser）

| # | 観点 | 評価 |
|---|---|---|
| 1 | 徳俵として読めるか | 読める。4つの俵が外へずれた段差になる |
| 2 | 対称で意図的に見えるか | 4つとも同じ形と模様で、対称 |
| 3 | 外へのずれは意味のある量か | 俵1本分なので明確 |
| 4 | **下側が石枠に当たるか** | **当たる**。徳俵の外縁 y=1922 が、石枠の上端 ≥1892.5 を越える（約29px重なる）。装飾ブロックの上にも乗る |
| 5 | 上・左右は自然か | 上: 外縁238 / 石枠236.5で、ほぼ接するが重ならない。左右: 約130pxの余白があり自然 |
| 6 | 摩耗模様 | 変化なし。問題はない |
| 7 | 側端でtextureが歪むか | 歪みはない。各sectionの端は俵の小口が切れた見え方で、tieが端に来ない部分がある（Artのtuningの余地） |
| 8 | 隙間・重なり・継ぎ目 | 側端で帯同士は隙間なく接する（testで確認）。継ぎ目は目立たない |
| 9 | 本物の土俵らしいか | 4つの膨らみではなく、局所的な段差として読める |
| 10 | gameplay境界の正本にできるか | 幾何は正本にできる（円弧と放射方向の線分）。ただしAは背景と衝突する |

# Lower-frame Collision

**実際に起きる**（推定ではなく実測）。

- 測定方法: alignment後のarena masterで、徳俵の窓のx範囲（1788–2052）を4px間隔で調べた
- 各列でluminanceの勾配が最大になるyを石枠の縁とし、中心に最も近い値を採用した
  - 下側の石枠の上端 ≥ **1892.5**
  - 上側の石枠の下端 ≤ **236.5**

# Candidate B（現行alignmentで安全な最大のdepth）

- 導出: 下側の余白 1892.5 − 1880 = 12.5px。見える余白として4pxを残し、**depth = 8**（runtime 4px、約0.023 m）
- 値: `--tokudawara-depth 8 --tokudawara-half-angle-deg 9`。alignmentは受理済みのまま
- 出力: `tools/dohyo_art/output-tokudawara-b.local/`
- 評価: 石枠には当たらない。ただし段差は俵の幅の約2割で、**ほとんど徳俵として読めない**（わずかな折れに見える）
- このためCandidate Cの条件を満たした

# Candidate C（depth 42を保ち、最小の再alignment）

- 導出
  - 恒等の正規化（`output.local/arena_base_master.png`）で、窓の範囲の石枠を測った: 上 ≤ 220.5、下 ≥ 1765.5（半高772.5、中心993）
  - 上下とも、徳俵の外縁842 + 余白4 を確保する条件は `772.5·S ≥ 846` → **S = 1.0952**（最小）
  - 石枠の中心を1080へ合わせて **offset_y = 87·S = 95.28**。xは従来の土俵中心1915を保ち **offset_x = 5·S = 5.48**
  - canvasを覆う条件は `1 + 95.28/1080 = 1.0882 ≤ 1.0952` で満たす
- 値: `--arena-scale 1.0952 --arena-offset-x 5.48 --arena-offset-y 95.28 --tokudawara-depth 42 --tokudawara-half-angle-deg 9`
- 出力: `tools/dohyo_art/output-tokudawara-c.local/`
- 実測した余白: 上 3.5px、下 4.5px（石枠: 上 ≤ 234.5、下 ≥ 1926.5）
- 評価
  - 徳俵がはっきり読め、4つとも石枠の内側に収まる
  - 背景の拡大は1.072倍から1.0952倍になり、左右の観客や床が少し多く切れる。目視で構図の破綻はない
  - 受理済みalignmentは上書きも再定義もしていない。比較用の別案にすぎない
- overlayはAとbyte一致する（alignmentはoverlayに影響しない）

# Recommended User Choice（受理扱いにはしない）

**Candidate C** を推奨する。
- 俵1本分の徳俵が明確に読め、背景とも衝突しない
- Aは下側の衝突がはっきり見え、Bは徳俵として弱すぎる

Cを選ぶ場合、alignmentを1.072から1.0952へ変えることの承認と、徳俵の値（depth 42 = 0.1195 m、half 9°）の確定が、次のRing-out core Taskの前提になる。

# Tests

`python -m unittest discover -s tools/dohyo_art/tests` → **Ran 50 tests, OK**。

Task要求の対応：

| # | 要求 | Test |
|---|---|---|
| 1 | 無効時は旧hashと一致 | `test_disabled_reproduces_legacy_circle_pixels` |
| 2 | 4つが存在する | `test_four_cardinal_sections_present_and_base_band_absent`（4つすべてと、窓のすぐ外の通常の帯も確認） |
| 3–5 | X / Y の鏡像、x↔y（alpha） | `test_alpha_geometry_is_symmetric`（x↔yではshikiriを除外）。RGBの90°回転は `test_sections_share_identical_rgb_under_rotation`（±1以内） |
| 6–8 | 通常の帯 R、徳俵の外縁 R+D、内縁 R+D−w | `test_normal_and_shifted_radii_are_exact`、`test_section_center_line_outer_radius` |
| 9 | 側端に隙間がない | `test_side_connections_have_no_alpha_gap`（4つ × 両側 = 8本） |
| 10 | 窓の中に基準帯が残らない | 2、6–8のtestで確認 |
| 11 | 外側は透明 | `dist ≥ R+D+0.5` で全域alpha 0 |
| 12 | shikiriが不変 | `test_shikiri_unchanged` |
| 13 | alignmentがoverlayに影響しない | `test_arena_alignment_does_not_affect_overlay` |
| 14 | manifest | `test_manifest_records_tokudawara` |
| 15 | depth=0は無効 | `test_depth_zero_is_disabled_in_manifest` と 1 |
| 16 | 不正な値は失敗する | `test_invalid_tokudawara_fails`（8ケース）、CLIのfail-closed（half angleなし / 深すぎる） |
| 17 | 決定性 | `test_tokudawara_is_deterministic` |
| 18 | full sizeのCLI smoke | `test_cli_smoke_full_size_tokudawara_candidate_a`（4つの中心線、bbox） |
| 19 | 既存のtests | すべてPASS（manifest schemaの参照以外は変更していない） |

guideは、有効なときだけ黄色の線を描き、それがR〜R+Dの範囲に収まることを `test_guide_marks_tokudawara_only_when_enabled` で確認した。

# Deterministic Evidence

- Candidate Aを同じ引数で再実行し、`build_manifest.json` とPNG 6ファイルがすべてbyte一致した
- 合成fixtureで、2回のcomposeのpixel hashとmanifest textが一致した（test）

# Geometry Symmetry Evidence

- 合成fixture（不透明なtexture）で、alphaがX鏡像・Y鏡像・x↔yについて厳密に一致した
- 徳俵の帯のRGBは、90°回転に対して±1以内で一致した
- 実Productでは、4つの中心線上のalpha（252 / 0）と、bbox `1920±842 / 1080±842` が対称だった

# Manifest Changes

- `schema`: 2 → 3
- `tokudawara` を追加した
  - 無効: `{"enabled": false}`
  - 有効: `enabled, count 4, directions "cardinal (+x, +y, -x, -y)", depth, half_angle_deg, window, outer_radius, inner_radius, side_boundary, normal_band_inside_window, texture_mapping`

# Product Visual Check

**REQUIRED**。確認するファイル：
- `tools/dohyo_art/output-tokudawara-a.local/composite_preview_1920.png`
- `tools/dohyo_art/output-tokudawara-b.local/composite_preview_1920.png`
- `tools/dohyo_art/output-tokudawara-c.local/composite_preview_1920.png`
- 細部は、それぞれの `composite_master.png` と `geometry_guide_master.png`

Userに決めていただくこと：
- 最終的なdepth
- 最終的なhalfAngle
- 受理済みalignment（1.072）を保つか、Cの1.0952にするか
- どの幾何をRing-out coreへ進めるか

# Design Deviations

Design Deviations: NONE

補足（Taskの範囲内で選んだ細部）：
- `depth ≤ tawara width` を必須にした
  - 側端の接続を、別の部品を描かずに隙間なしで保証するため
  - Candidate Aの42 = 俵の幅はこの範囲に入る
  - これより深くするには、接続用の部品が必要になる
- 徳俵のtextureのphaseは、CLIではなく定数にした（Taskの「必要な場合のみ公開する」に従った）

# Unexpected Scope（報告のみ）

- Candidate Aと受理済みalignmentでは、下側の石枠と衝突する（上記）。alignmentを変えるかどうかはUserの判断
- 各sectionの端では、俵の小口がtieのない位置で切れる部分がある。必要なら、texture phaseの調整または専用の小口assetを、Artのtuningとして別に扱う

# Verification

- Python unit suite: 50 / 50 OK
- 実Product: 無効時の互換run（6ファイルbyte一致）と、Candidate A / B / Cを実行した
- Candidate Aの決定的な再実行が一致し、出力サイズ（3840×2160 / 1920×1080）とmanifestを確認した
- `git diff --cached --check`: PASS
- `src/`、`package.json`、`pnpm-lock.yaml` の変更なし。`input.local/` と `output*.local/` はignoreされていて、stageしていない
- `pnpm test` / `pnpm build`: 対象外（runtimeは未変更）

# Git Delivery

- Commit: `tools: add tokudawara product preview`
  - Task-owned 4ファイル: `compose_dohyo.py` / `tests/test_compose_dohyo.py` / `README.md` / 本Report
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
