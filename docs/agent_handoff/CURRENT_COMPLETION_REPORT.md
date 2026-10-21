Task-ID: ART-WRESTLER-02A-PARTS-ASSEMBLY-PREVIEW
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 1f89765e94490dd22aeec0cfbc812d9d5247d4d7
Agent-Start-Head: 2d08b38cb376759b556ba6b9b43b09020fba6358
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS。User Visual Gateは未実施）。

- 小さな専用のoffline tool `tools/wrestler_art/` を作った（Python 3.9.7 + Pillow 11.3.0。NumPyは使わない）
- 処理の流れ
  - レビュー済みの2画像を検証する
  - 明示的なregion / pivot / jointで、6部位を切り出す
  - master scale（R = 246.154 px = runtime × 4）へ正規化する
  - 右向きのidleを決定的に組み立てる
  - 必須の出力（部位6枚 + preview 5枚 + `parts.json` + `build_manifest.json`）を、ignoreされる `output-assembly.local/` に書く
- 出力の結果
  - 体の軸は1本: 前 = +X（顔・拳・つま先）、後ろ = −X（髷・まわしの結び目）
  - 実行時サイズのtorsoは **123.0 × 121.75 px**（受理済みの約123 pxと一致）
- `docs/WRESTLER_PRODUCT_ART_SPEC.md` を最小限で更新した（workflowの変更、候補の入力、staging）
- 変更しなかったもの: `src/`、`public/`、package、gameplay
- 未検証の項目: 見た目の承認（User Visual Gate）。自動testでは判定できない

# Preflight

- 1回目・2回目の開始は、入力の不一致で停止した（Repositoryへの書き込みなし）
  - 1回目: parts_sheetのfile SHAが不一致
  - 2回目: decoded pixel SHAも不一致
- 今回（3回目）
  - working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 0`
  - HEAD `2d08b38` は、前回のFF済みのremote先端と同じ
  - Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `1f89765`（ancestor）、Handoff-Mode GITHUB
  - `1f89765..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ

# Verified Sources

| source | size / mode | file SHA-256 | decoded RGBA pixel SHA-256 |
|---|---|---|---|
| `parts_sheet.png` | 1254×1254 RGBA | `3363eb77…27a44aa`（reviewedと一致） | `fecca718…538b7cbc`（一致） |
| `torso.png` | 1374×1145 RGBA | `8388ef8b…92a71f734`（reviewedと一致） | `8fe2791c…ee0183094`（一致） |

- 照合の正はdecoded pixel hash。file hashは記録のみ（manifestの `file_sha256_matches_reviewed`）
- 次のどれかに当たれば、exit 2で何も書かずに止まる
  - 入力が無い / 寸法が違う / alphaが無い / 全面が不透明
  - pixel hashが違う

# Extracted Regions（source px。`base_parts_recipe.json`）

| 部位 | source | crop box | pivot | joint / 軸 |
|---|---|---|---|---|
| torso | `torso.png` | [203, 81, 1185, 1074] | 体の中心 (694, 578) | 右肩 (757, 975)、head (837, 578)、mawashi (551, 578) |
| mawashi | sheet 中段左 | [75, 573, 644, 990] | 輪の中心 (390, 781) | 結び目は −X |
| upper_arm | sheet 中段右 | [800, 676, 1178, 973] | 肩 (735, 803) | 肘 (1138, 857)。軸の傾き 7.63° を +X へ補正 |
| forearm_hand | sheet 下段左 | [228, 1017, 604, 1227] | 肘 (300, 1117) | 手の中心 (515, 1113)。軸 −1.07° を補正 |
| head | sheet 左上 | [77, 103, 556, 500] | 頭の中心 (345, 301) | 顔 +X、髷 −X |
| foot | sheet 下段右 | [777, 1020, 1137, 1216] | 足首 (817, 1116) | つま先 (1122, 1116) |

- 部位の連結成分は6つ（alpha > 16）。互いに離れていて、きれいに分けられる
- 各部位の画像は、Task契約どおり軸が +X 向き
  - head: 顔が右、髷が左
  - mawashi: 結び目が左
  - 上腕: 肩 → 肘が右向き
  - 前腕: 肘 → 拳が右向き
  - 足: 踵 → 足指が右向き
- 置き換え用のtorsoのFRONT / BACK
  - 右半分に胸と腹のふくらみ、左半分に陰になった背中がある。上下の±Yに肩のcap
  - よって、前 = +X と一意に決まる

# Rejected Original Torso

- sheet右上の成分（bbox x 612–1206, y 47–596）。recipeの `rejected_regions` に [602, 37, 1217, 607] と明記した
- 使わないことを、3段で保証している
  1. recipeの検証: torsoのsourceは `torso.png` 以外を許さない
  2. 実行時の検査: どの部位のcropも、rejected領域の可視pixel（alpha > 8）を含まない
     - mawashiのcropはrejectedのboxと矩形では重なるが、重なり部分はすべて透明であることを確認した
  3. test: 合成fixtureの不採用torsoを純赤にし、どの出力にもその色が無いことを確認した

# Joint Caps（関節の断面）

- 部位sheetの上腕・前腕・足には、AIが描いた筒の断面（暗い楕円）がある
- そのまま組むと、肩と肘で断面が上に見えて「貼り付けた」見た目になった（初回のpreviewで確認）
- 塗り直しはせず、**crop / placementだけ** で処理した
  - 上腕の肩側の断面は、crop（x ≥ 800）で外した
    - 回転中心の肩pivotは、断面の中心 (735, 803) に残した。この点はcropの外にあり、torsoの三角筋のcapの中にある
  - 前腕の肘側の断面も、crop（x ≥ 228）で外した
    - 前腕のpivotを (300, 1117) にして、前腕が肘から約0.17R後ろまで伸びるようにした
    - これで、上腕の肘の断面が前腕の下に隠れる
  - 足首の断面は、torsoの下（layer 1）に隠れる
- toolは、pivotがcropの外にあっても、正規化した画像の内側に必ず入るようにcanvasを作る

# Normalization / Master Scale

- `R_runtime = 0.35 × 400 / 2.275 = 61.538 px`、`R_master = 246.154 px`（× 4）
- 各部位は一様のscaleだけで正規化する（Lanczos、premultiplied）。基準は次のとおり

| 部位 | scaleの基準 | target | scale |
|---|---|---|---|
| torso | alphaの高さ（肩から肩） | 2.0R | 0.51605 |
| mawashi | alphaの高さ | 1.3R | 0.80605 |
| upper_arm | 2点の距離：肩の断面の中心 → 肘の断面の中心 | 0.85R | 0.51458 |
| forearm_hand | 2点の距離：肘の断面の中心 (183,1118) → 手 | 0.95R | 0.70428 |
| head | alphaの高さ（耳から耳） | 0.9R | 0.58453 |
| foot | 足首 → つま先 | 0.6R | 0.48424 |

- 上腕と前腕の比率をspec（L1 0.85R / L2 0.95R）にすると、肘の断面の直径がほぼ一致する（83 / 84 master px）
- masterの寸法とpivotは4の倍数。runtimeは各部位をちょうど1/4に縮小（Lanczos）し、pivotも1/4にする
- **source / master / runtimeの対応**
  - torsoのsource 954 px（肩から肩）× 0.51605 = master 492.3 px = 2.0R → ÷4 = runtime 123.08 px
  - 実測: `torso_master.png` のalpha bboxは 487 × 492 px → runtime **121.75 × 123.0 px**

# Pivot / Joint Recipe（master px / R）

| 部位 | master size | pivot | joint |
|---|---|---|---|
| torso | 536×544 | (268, 272) | 右肩 (300.51, 476.87)、head (341.79, 272)、mawashi (194.21, 272) |
| mawashi | 496×372 | (272, 184) | — |
| upper_arm | 276×188 | (24, 92) | 肘 (233.23, 92)、L1 = 209.23 px = **0.85R** |
| forearm_hand | 312×188 | (80, 92) | 手 (231.45, 92)、L2 = 151.45 px = **0.615R** |
| head | 320×272 | (176, 136) | — |
| foot | 216×140 | (40, 68) | つま先 (187.69, 68) = 0.6R |

- torsoのanchor（R、local）
  - 肩: (0.132, ±0.832)
  - head: (0.300, 0)
  - mawashi: (−0.300, 0)
- 数値はすべてProvisional。User調整の対象

# Idle Assembly Geometry（R、local。+X = 前、+Y = 右）

- torso (0, 0)、head (0.30, 0)、mawashi (−0.30, 0)
- 右腕
  - 上腕: 角度 95°。肩 (0.132, 0.832) → 肘 (0.058, 1.679)
  - 前腕: 角度 −10° → 手 (0.664, 1.572)
  - 肘は外側、手はやや前。伸ばしたposeではない
- 右足: 足首 (0.40, 0.70)、角度 0° → つま先 (1.00, 0.70)。腹の前から足指が見える
- 左はすべて (x, −y)、角度は符号を反転
- layer: 足 → torso → mawashi → 上腕 → 前腕と手 → head（spec §8のとおり）
- 腕は、明示的な角度による順運動学。reachのIKは実装していない（Taskの指示どおり）
- previewの外接寸法（runtime）: 横（前後）144 px × 縦（左右）244 px（肘の張り出しを含む）

# Mirroring Convention

- 右側 = sourceの向きのまま
- 左側 = 同じmaster画像を上下反転（`FLIP_TOP_BOTTOM`、local y → −y）
  - pivot / jointは (x, H − y)
  - local位置は (x, −y)、local角度は −θ
- 左右で別のartは作らない
- testで次を確認した
  - 2回反転すると元と同じ（pixel hash）
  - 反転後のhashが決定的
  - pivotの写像が正しい

# Output Paths / Pixel Hashes

出力先: `tools/wrestler_art/output-assembly.local/`（ignore。commitしない）。

| file | size | mode | decoded pixel SHA-256 |
|---|---|---|---|
| torso_master.png | 536×544 | RGBA | `701007842d058ef89557dd55e6e4ce6a3dee507263de72ce50de6bccdac3324c` |
| mawashi_master.png | 496×372 | RGBA | `1f95abb1b513b66bb3e563f58ae91153f7c9af20383d7221b4555f4c4c2b21b1` |
| upper_arm_master.png | 276×188 | RGBA | `c00f2f8f05eb8b9d296fbde39ca6751f4ffddd230b55491bec0a159eb44c1839` |
| forearm_hand_master.png | 312×188 | RGBA | `17a37f84ad44846c5640666132020bfdc944f7c20348cc05aff17f32af929bab` |
| head_master.png | 320×272 | RGBA | `1fd1b1ae7bc5a715d79c70b94003ba68ff876fc8d5d1d0be65f3f4923190e6ca` |
| foot_master.png | 216×140 | RGBA | `78bfcd6d57e08f12eb57b14124bbeee8d19e8fc4292cba78477584c20f319ae5` |
| idle_master.png | 1184×1184 | RGBA | `cdda6adc09218baa4c4f5a80db24fc5ff618be004747d46c894006efda9d6e8b` |
| idle_runtime.png | 296×296 | RGBA | `af2f20e8211518ec419e206ffa02300737a0fdbc8bcc0e60d55bee2970be92d3` |
| idle_runtime_4angles.png | 1184×326 | RGBA | `8005e36138886a8c9e1ac3a4da188d33085e1001a3d14f413e8ecb31613d86a0` |
| idle_on_arena_1920.png | 1920×1080 | RGB | `8d17a2196181c0edba0c966faada52b8003292e9e944c485c4e06c60cd9481f5` |
| pivot_guide.png | 1184×1184 | RGB | `9c7605b67eb464fd2b74e00600f188bee0e82aed6b7d417ba12a49e0e386f6b8` |

- `parts.json` SHA-256 `f68f7c6419f4cab8a74cd750b60b1fab1e68745cc8645766f5edb2cc40a9583c`
- recipe canonical SHA-256 `15f3d47692b40d8d42be478268cfd472fd26f5ef8c8ed195224e9f28541350d4`

# Determinism Evidence

- 実入力で、CLIを2つの出力dirへ実行した
  - `build_manifest.json` と `parts.json` は、バイト単位で同一（`cmp`）
  - manifestには、全画像のdecoded pixel hashが入っている
- test
  - 合成fixtureで、2回のbuildのmanifest / parts.json / 全出力のpixel hashが同一
  - 実recipeでも、2回のbuildのmanifestが同一
- manifestにtimestampは無い。testで、日付・時刻の形の文字列や、time / date系のkeyが無いことを確認した
- 乱数は使わない

# Runtime Scale / Arena Composite Evidence

- `idle_runtime.png`: master部位を1/4にしたruntime部位を、bilinearで組み立てた（Phaserの線形filterに相当）
  - torsoの肩幅は約123 px
  - testで、root列のalphaの高さが 2R − 6 より大きいことを確認した
- `idle_runtime_4angles.png`: facing 0° / 45° / 90° / 180°。同じ組み立てを、rootごと回転した
- `idle_on_arena_1920.png`
  - commit済みの `arena_base_1920.png` + `dohyo_ring_overlay_1920.png` を読むだけ（変更しない。hashはmanifestに記録）
  - その上に、2人をprototypeの開始位置に置いた
    - x = 960 ∓ 0.7 m × 175.82 px/m = **836.92 / 1083.08 px**、y = 540
    - facingは 0° / 180°
  - 影はpreview専用の手続き的なもの
    - 現在の `WrestlerView` と同じ形状: 2.25R × 2.0R、α0.28、world上で (+0.07R, +0.12R)
    - 縁を2 pxぼかした
  - HUDは描かない

# Tests

`tools/wrestler_art/.venv/Scripts/python -m unittest discover -s tools/wrestler_art/tests` → **34 tests OK**（約23秒）。

Task必須の18項目との対応:
1. missing source → `test_missing_source_fails`
2. wrong parts-sheet SHA → `test_wrong_parts_sheet_pixels_fail`、`test_wrong_expected_hash_fails`
3. wrong torso SHA → `test_wrong_torso_pixels_fail`
4. wrong dimensions → `test_wrong_dimensions_fail`
5. missing alpha → `test_missing_alpha_fails`、`test_opaque_alpha_fails`
6. crop non-empty → `test_each_required_crop_is_non_empty`、`test_empty_crop_fails`
7. rejected torso → `test_torso_from_parts_sheet_is_rejected`、`test_crop_touching_rejected_pixels_fails`、`test_rejected_pixels_never_reach_outputs`、実recipeの `test_recipe_uses_replacement_torso_and_avoids_rejected_sheet_torso`
8. alpha → `test_normalized_parts_have_alpha`
9. pivots → `test_pivots_and_joints_inside_padded_images`
10. 上腕の長さ → `test_upper_arm_length_positive`
11. 前腕の長さ → `test_forearm_length_positive`
12. mirror → `test_mirrored_left_part_is_deterministic`、`test_left_side_geometry_is_mirrored`
13. 出力名 → `test_all_output_names_produced`、`test_cli_success`
14. runtime scale → `test_runtime_scale_matches_accepted_character_scale`、`test_runtime_torso_matches_accepted_scale`
15. 4 angles → `test_four_angle_preview_generated`
16. timestampなし → `test_manifest_has_no_timestamp`
17. 決定性 → `test_deterministic_rerun_identical`、`test_real_rerun_is_deterministic`
18. ignore → `test_local_inputs_and_outputs_are_git_ignored`

その他:
- re-encodeの受理: `test_reencoded_file_with_same_pixels_passes`
- 軸 +X: `test_axis_parts_point_plus_x`
- arena: `test_arena_composite_size_and_wrestlers`
- CLIのfail-closed: `test_cli_fail_closed_writes_nothing`
- import: `test_tool_imports_only_stdlib_and_pillow`

- `git diff --check`: 問題なし
- `pnpm test` / build: Taskの指示により実行していない（Product Sourceは未変更）

# User Visual Check Required

**Required。** 次のfileを確認してください（すべて `tools/wrestler_art/output-assembly.local/`）。
1. `idle_master.png`
2. `idle_runtime.png`
3. `idle_runtime_4angles.png`
4. `idle_on_arena_1920.png`
5. `pivot_guide.png`

確認してほしい点（Taskの質問）:
- 体の軸が1本か
- 前 = 右か
- headがtorsoに属して見えるか
- 肩や腕が付いて見えるか
- 肘に無理がないか
- mawashiの位置
- 足の向き
- 実行時サイズでの画風
- torso / head / 腕 / 足の比率
- arenaとの画風の一致

Agentが見た所見（判断はUser）:
- **まわしの層順**
  - spec §8の層順（torsoの上にmawashi）では、輪の形のmawashiをtorsoの上に置くことになり、「体の上に輪が乗る」見た目になる
  - 対策として、1.3Rに縮め、−0.3R後ろへずらして、背中と結び目が主に見えるようにした
  - 比較のため、scratchで「mawashiをtorsoの下に置く（2.05R）」案も描いてみた。上から見た相撲取り（腹がまわしに被さる）として、より自然に読めた
  - commitした成果物は、specの層順のまま。変えるかどうかはUser / ChatGPTの判断（recipeの `layers` を変えるだけで切り替えられる）
- **画風の差**
  - 置き換え用のtorsoは、輪郭線が細く、肌がややピンク寄り
  - sheetの部位は、輪郭線が太く、肌がオレンジ寄り
  - 実行時サイズでは目立ちにくいが、拡大すると差がわかる
- **腕**
  - 部位の画が太い（上腕の太さ約0.56R）
  - idleでは肘が外へ張り出す（肘 y ≈ ±1.68R）
  - 角度はrecipeで調整できる

# Design Deviations

Design Deviations: NONE

（入力の差し替え、却下したtorsoの使用、体の軸の変更、gameplay geometryの変更、画像のcommit、不透明な / heuristicな組み立ては、どれもしていない。断面のcropと、cropの外にある肩pivotは、Taskが許す「明示的なcrop / placement」の範囲として扱った。）

# Unexpected Scope（報告のみ）

- **次のpose stepへの影響（直していない）**
  - 断面を隠すため、前腕のpivotを肘の断面より前に置いた。そのため、肘 → 手の実効長 L2 は **0.615R** になった
  - 肩から手の最大の到達は、L1 + L2 ≈ **1.465R**
  - spec §5 / §13の到達の範囲（最大約1.86R、push active 約1.56R）には足りない
  - pose previewのTaskで、前腕のscale、肩のanchor、到達の上限のどれかを決める必要がある
- その他の範囲外の修正: なし

# Known Untested Items

- 見た目の承認（User Visual Gate）。自動testは、幾何と決定性だけを検証する
- 検証した環境はWindows x64 / Python 3.9.7 / Pillow 11.3.0 のみ。他のPillow versionでのpixelの同一性は保証しない（manifestにversionを記録）

# Changed Files

- `tools/wrestler_art/README.md`（新規）
- `tools/wrestler_art/requirements.txt`（新規。`Pillow==11.3.0`）
- `tools/wrestler_art/assemble_wrestler.py`（新規）
- `tools/wrestler_art/base_parts_recipe.json`（新規。region / pivot / joint / idle / layerの明示）
- `tools/wrestler_art/tests/test_assemble_wrestler.py`（新規）
- `tools/wrestler_art/.gitignore`（新規。`.venv/`、`__pycache__/`）
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（Status行、§11の変更の注記、§21の現在のstaging）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- 変更なし: `src/`、`public/`、`docs/ARCHITECTURE.md`（注記は不要と判断）、package / lockfile、`CURRENT_TASK.md`

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`tools: add wrestler assembly preview`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- 入力画像、出力画像、`.venv` はignoreされ、untracked
- `main` は変更しない
