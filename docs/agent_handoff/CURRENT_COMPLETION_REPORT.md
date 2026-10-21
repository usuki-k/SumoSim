Task-ID: ART-WRESTLER-02B-SINGLE-SPRITE-EVALUATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 9a3569ff376c4397daf1297083272af599300189
Agent-Start-Head: 03bde4c7a4d7156a32fa2069f9495832aa9f6153
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS。User Visual Gateは未実施）。

- `tools/wrestler_art/` に、1枚の全身spriteを評価する、小さな専用のpathを足した
  - `preview_single_wrestler.py`
  - `single_sprite_recipe.json`
  - test
- 処理の流れ
  - レビュー済みのspriteを検証する
  - sprite全体を1回だけ回転する（−8.8°）
  - 明示的なrootと、胴体の幅（body-core）を基準に、一様にscaleする
  - masterからruntimeへ、ちょうど1/4に縮小する
  - preview（16方向、arena、arena上の8方向、pivot guide）とmetadataを、ignoreされる `output-single.local/` に書く
- 結果
  - runtimeのbody-coreは **123.077 px**（2R）
  - 全体のalpha bboxは **179 × 219 px**
  - 16方向すべてで、rootは同じ位置。不透明部分の重心からrootまでの距離は 11.245〜11.258 px で一定（揺れなし）
  - 切れているtileは無い
- `docs/WRESTLER_PRODUCT_ART_SPEC.md` を最小限で訂正した
- 変更しなかったもの: `src/`、`public/`、package、gameplay、02Aのtool（`assemble_wrestler.py`）
- 未検証の項目: 見た目の承認（User Visual Gate）。自動testでは判定できない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `9a3569f`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- 変更の範囲
  - `9a3569f..origin/develop` の変更は、`docs/agent_handoff/CURRENT_TASK.md` のみ
  - HEAD（`b4608d2`）から `origin/develop` までも、同じfileのみ
- `merge --ff-only` → HEAD `03bde4c`

# Verified Source Identity

| 項目 | 値 |
|---|---|
| file | `tools/wrestler_art/input.local/wrestler_single.png` |
| size / mode | 1254×1254 RGBA（alphaは 0〜255） |
| file SHA-256 | `d806a24fdb4cd8fa90d53e86fbffabd3ae7c490b6c3221fa2000deb94472666d`（reviewedと一致。記録のみ） |
| decoded RGBA pixel SHA-256 | `b621d2f56efa80968b71dba1cc4e31bfcc3ad133968adcebb33864b89de5fdf3`（一致。照合の正） |

# Source Body Axis / Orientation Correction

- FRONT = 画像の右（+X）
  - 両手（左手の拳 約(1015, 330)、右手の拳 約(940, 1090)）
  - 両足（左足 約(1035, 515)、右足 約(960, 925)）
  - 顔と耳
- BACK = 画像の左（−X）: まわしの結び目（中心 約(300, 605)）
- 上半身と下半身の軸は一致している。体の軸は一意に決まる
- 対になる手足は、右側（+Y、画像の下側）ほど後ろにある。軸はやや時計回りに傾いている
  - 結び目の中心 (300, 605) → 両手両足の先の中点 (990, 712): **+8.81°**
  - 手の対からは約5.6°、足の対からは約10.4°（どれも同じ向き）
- **補正: sprite全体を1回、−8.8° 回転する**
  - recipeの `orientation_correction_deg`。根拠の点は `orientation_evidence` に記録した
  - source解像度で、rootを中心に、premultiplied bicubicで回転する
- 歪み・遠近の補正・部位の移動はしていない

# Root / Body-core Reference / Scale

- `root_source_px` = **(620, 655)**: 補正した軸の上で、胴体の前後の中央
  - 腰の後ろ端 約235 と、腹の前端 約1005 の中間
  - 画像の中心は使っていない
- `body_core_source_px` = **(908, 383) → (817, 971)**
  - 胸の断面で、両腕の間（両側に、腕との透明な隙間がある）
  - 補正後の+Xに対して、ちょうど垂直（toolは±3°以内であることを検証する）
  - 腕・手・足・頭・結び目を含まない
  - source距離は **595.0 px**。比較として、腰（まわし）の断面は 649 px
- 正規化の倍率
  - source → master: **0.827408**（縮小のみ。拡大はしない）
  - source → runtime: **0.206852**
- runtimeのbody-core: **123.0769 px**（= 2 × 0.35 × 400 / 2.275）
  - 実測でも同じ線上の胴体のalphaは 2R ± 3 px（実画像のtest）
- runtimeの寸法
  - `single_runtime.png` は 192×232、pivotは (92, 123)
  - 全体のalpha bboxは [6, 7, 185, 226] = **179 × 219 px**
  - rootから最も遠い画素までは 152.1 px
- master: `single_master.png` は 768×928、pivotは (368, 492)、R = 246.154 px

# Output Paths / Pixel Hashes

出力先: `tools/wrestler_art/output-single.local/`（ignore。commitしない）。

| file | size | mode | decoded pixel SHA-256 |
|---|---|---|---|
| single_master.png | 768×928 | RGBA | `7b097a342f486f4ffd3c380b5a1c56a8471b02b30f812060e98614284a763e00` |
| single_runtime.png | 192×232 | RGBA | `0e32ea9571bcbd3c5cac9d9875b3e8432a2aa1bc5b39411bfd9755ac5d9c645c` |
| single_pivot_guide.png | 1360×1360 | RGB | `7bf12c50c801fce153857e3fcd4af8c7d7978aa37b9a9a9a19147d6551f9113b` |
| single_runtime_16angles.png | 1296×1400 | RGBA | `46c4f27fefa13496aa5f49e2fcb8ca5d5111651c231518351f646e3cc634d7e9` |
| single_on_arena_1920.png | 1920×1080 | RGB | `cccbd0c31f6ed162769f09449d5994d9ec28971a79574ecd830ad2d312dcaf42` |
| single_on_arena_8facings.png | 1296×700 | RGB | `84f88aefd0bc671483a655c8bf98c85a12a639518b24a8bb87a6c6401dfedafb` |

- `single_sprite.json` SHA-256 `dc50ba8ffc939edae193245a19a02c5527860f95c870c78476719101b0d73d36`
- recipe canonical SHA-256 `223fd14e3baa42baeac9b83862a30d33f7fb0061f5500cbd5c6385f0a86b47bb`

# 16-angle Evidence

- tileは324 px四方。root (162, 162) は全角度で同じ
- 0°〜337.5° を22.5°刻みで、同じruntime spriteを、同じpivotで回転した（bilinear。Phaserの線形filterに相当）
- 各tileのalpha bboxはmetadataに記録した。tileの縁に触れていない（触れれば、toolは止まる）
- 不透明部分の重心からrootまでの距離は 11.245〜11.258 px で、全角度で一定
  - 回転中心が体に固定されていて、公転や揺れが無い

# Arena-root Mapping Evidence

- `single_on_arena_1920.png`
  - commit済みの `arena_base_1920.png` + `dohyo_ring_overlay_1920.png` を読むだけ（hashはmanifestに記録）
  - 2人を置いた
    - root (836.923, 540)、facing 0°
    - root (1083.077, 540)、facing 180°
    - = 960 ∓ 0.7 m × 175.824 px/m
  - 影はpreview専用で、ほぼ円形の手続き的なもの
    - 2.25R × 2.0R、α0.28、world上で (+0.07R, +0.12R)
    - 方向の強い形を、spriteと一緒に回さない
- `single_on_arena_8facings.png`
  - 同じarenaの切り取り（box [798, 378, 1122, 702]、中心は土俵の中心 (960, 540)）
  - 1人を 0°〜315° の45°刻みで置いた
  - 仕切り線という同じ世界の目印の上で、向きだけが変わる
- 透明なsprite（master / runtime / 16方向）には、影を付けていない

# Determinism Evidence

- 実画像で、CLIを2つの出力dirへ実行した
  - `build_single_manifest.json` と `single_sprite.json` は、バイト単位で同一（`cmp`）
  - manifestには、全画像のdecoded pixel hashが入っている
- test
  - 合成fixtureで、2回のbuildのmanifest / json / 全出力のpixel hashが同一
  - 実画像でも、2回のbuildのmanifestが同一
- timestampも乱数も無い（testで、日付・時刻の形の文字列や、time / date系のkeyが無いことを確認した）

# Tests

`tools/wrestler_art/.venv/Scripts/python -m unittest discover -s tools/wrestler_art/tests` → **62 tests OK**（02Aの既存34件 + 今回の28件。約35秒）。

Task必須の18項目との対応（`test_preview_single_wrestler.py`）:
1. missing source → `test_missing_source_fails`
2. wrong dimensions → `test_wrong_dimensions_fail`
3. wrong pixel SHA → `test_wrong_pixel_sha_fails`
4. alpha無し / 意味の無いalpha → `test_missing_alpha_fails`、`test_meaningless_alpha_fails`
5. 同じpixelのre-encode → `test_same_pixel_reencode_is_accepted`
6. root → `test_root_maps_inside_padded_image`
7. body-coreが0でない → `test_zero_body_core_fails`、`test_body_core_non_zero_and_runtime_scale`
8. runtime scale 123.08 → `test_body_core_non_zero_and_runtime_scale`、実画像の `test_runtime_body_core_is_accepted_scale`
9. 縁に触れない → `test_alpha_does_not_touch_sprite_edges`
10. pivotが全回転で同じ → `test_runtime_pivot_identical_across_rotations`、`test_rotated_tile_matches_direct_rotation`
11. 16方向 → `test_all_16_angles_generated_and_unclipped`
12. tileが切れない → 同上
13. arena 1920×1080 → `test_arena_preview_size_and_roots`
14. 開始位置のroot → 同上
15. 8方向のarena sheet → `test_eight_facing_arena_sheet_generated`
16. timestampなし → `test_manifest_has_no_timestamp`
17. 決定性 → `test_deterministic_rerun_identical`、`test_real_rerun_is_deterministic`
18. ignore → `test_local_input_and_outputs_are_git_ignored`

その他:
- 垂直でないbody-core: `test_non_perpendicular_body_core_fails`
- rootがsourceの外: `test_root_off_source_fails`
- 補正の上限（±30°）: `test_large_orientation_correction_fails`
- 補正で軸が +X に乗る: `test_orientation_correction_moves_axis_to_plus_x`
- 出力名と、CLIの成功 / fail-closed

- `git diff --check`: 問題なし
- `pnpm test` / build: Taskの指示により実行していない（`src/` は未変更）

# SPEC Sync

`docs/WRESTLER_PRODUCT_ART_SPEC.md`（最小限）:
- Status行: 現在の実験は1枚のsprite。02Aは不採用
- §11に「訂正（ART-WRESTLER-02B）」を足した
  - 02AはTechnical PASSだが、User Visual Gateで不採用。出力はProduct baselineではない
  - 1枚の全身spriteに戻し、統合の前に360°の回転を検証する
  - 現在の候補は有望だが、02BのVisual Gateまで未承認
  - actionのposeの方式は未決定（複数のpose sprite / frame / 限られた変形 / 他）
- §21: stagingに02A（不採用）と02B、次の段階（poseの方式の調査は未決定）を記録した
- 古い仕様の他の部分は書き換えていない

# User Visual Check Required

**Required。** 次のfileを確認してください（すべて `tools/wrestler_art/output-single.local/`）。
1. `single_runtime.png`
2. `single_runtime_16angles.png`
3. `single_on_arena_1920.png`
4. `single_on_arena_8facings.png`
5. `single_pivot_guide.png`

確認してほしい点（Taskの質問）:
- どの回転でも、真上視点のspriteとして読めるか
- カメラの向きが、力士と一緒に回って見えないか
- 90° / 180° / 270° が、0°より目立っておかしくないか
- pivotが安定しているか
- 大きさ
- 実行時サイズでの読みやすさ
- arenaとの画風の一致
- 顔と胸の見え方

判定（A. 採用 / B. 画像の作り直し / C. 1枚の方式の不採用）はUserが行う。Agentは判定しない。

Agentが見た所見（判断材料。判定ではない）:
- **頭の位置**
  - 頭が体の軸より、力士の左側（−Y）へ寄っている（pivot guideで、頭はrootの軸より上にある）
  - 向かい合わせ（0° / 180°）では、片方の頭は画面の上寄り、もう片方は下寄りになり、2人が非対称に見える
- **光と陰影**
  - ハイライトと陰影はspriteに描き込まれている。そのため回転すると、光の向きも体と一緒に回る（spec §16のリスク）
- **カメラの偏り**
  - 背中と頭頂が主に見えていて、カメラはやや後ろ上方にある
  - 90° / 270° では、「背中を上から見下ろしている」印象のまま、画面上で横を向く
- **大きさ**
  - 胴体は約123 px で受理済みと一致する
  - 腕と脚を含めた全体は 179 × 219 px。02Aのpreview（144 × 244）と同程度
- body-core（胸の断面）とroot（620, 655）はProvisional。recipeを直して再実行すれば調整できる

# Design Deviations

Design Deviations: NONE

（入力の差し替え、塗り直し / 歪み、gameplayのscaleやsourceの変更、runtime assetのcommit、部位の組み立てへの回帰は、どれもしていない。sprite全体を−8.8°回転したのは、Taskが許す1回の明示的な補正で、recipeに記録した。）

# Unexpected Scope（報告のみ）

- 範囲外の修正: なし
- `tools/wrestler_art/README.md` の冒頭に、2つのtoolの位置づけ（02Bが現在、02Aは実験・参考で不採用）を足し、02Bの節を加えた（同じtool dirの説明の更新）
- 02Aの `assemble_wrestler.py` は削除も変更もしていない。02Bは、その小さなhelper（入力の検証、配置、影、hash）をimportして再利用している

# Known Untested Items

- 見た目の承認（User Visual Gate）。自動testは、幾何・scale・決定性だけを検証する
- 検証した環境はWindows x64 / Python 3.9.7 / Pillow 11.3.0 のみ（manifestにversionを記録）

# Changed Files

- `tools/wrestler_art/preview_single_wrestler.py`（新規）
- `tools/wrestler_art/single_sprite_recipe.json`（新規。補正の角度、root、body-core、根拠の点）
- `tools/wrestler_art/tests/test_preview_single_wrestler.py`（新規）
- `tools/wrestler_art/README.md`（2つのtoolの位置づけ、02Bの節）
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（Status行、§11の訂正、§21のstaging）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- 変更なし: `src/`、`public/`、`assemble_wrestler.py`、02Aのrecipe / test、package / lockfile、`CURRENT_TASK.md`

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`tools: add single wrestler sprite preview`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- `wrestler_single.png`、出力のPNG / JSON、`.venv` / cacheはignoreされ、untracked
- `main` は変更しない
