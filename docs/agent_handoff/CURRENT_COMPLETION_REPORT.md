Task-ID: ART-WRESTLER-03A-DUAL-SPRITE-RIGID-MOTION-VALIDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: a4ed20e05cd64e374692dc69a631063e4a80ed9a
Agent-Start-Head: ddc18129bc5690b5fbb8656e3f66759496190f79
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS。User Visual Gateは未実施）。

技術的な評価:
- **rigid rotation: technically valid**
  - 両spriteとも、16方向でrootは同じ位置。重心からrootまでの距離は一定で、tileも切れない
- **rigid translation: technically valid**
  - すべてのGIFのframeは、(root, facing) だけから再描画したものとpixelが一致する
- **visual acceptance: pending**（Outcome A / B / C はUserが判定する）

作ったもの・変えたもの:
- `tools/wrestler_art/` に、小さな検証path（`preview_dual_rigid_wrestlers.py` + `dual_rigid_recipe.json` + test）を足した
  - 02Bの正規化・回転sheet・pivot guideのhelperを再利用した
- `docs/WRESTLER_PRODUCT_ART_SPEC.md` を最小限で更新した
- 変更しなかったもの: `src/`、`public/`、既存の02A / 02Bのtool、package

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `a4ed20e`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- 変更の範囲
  - `a4ed20e..origin/develop` の変更は、`CURRENT_TASK.md` のみ
  - HEAD（`735466b`）から `origin/develop` までも、同じfileのみ
- `merge --ff-only` → HEAD `ddc1812`

# Verified Source Identities / Input Placement

**入力の置き場所について（重要）**
- 開始時、`tools/wrestler_art/input.local/` に `wrestler_blue.png` / `wrestler_red.png` が無かった
- `C:\Users\Kazu\Downloads\` にある、1254×1254の全PNGのdecoded pixel SHAを照合した。次の2つが、Taskの期待値と **file SHA / pixel SHAとも完全に一致** した
  - `ChatGPT 画像 2026年10月21日 20_16_04-1.png` → blue
  - `ChatGPT 画像 2026年10月21日 20_16_05-2.png` → red
- この2つを、指定の名前でbyte単位のまま `input.local/` にcopyした（ignoreの対象。commitしない）
- 別の画像への差し替えではない（レビュー済みの原本と、bytesが同一）

| sprite | size / mode | file SHA-256（記録のみ） | decoded RGBA pixel SHA-256（照合の正） |
|---|---|---|---|
| blue | 1254×1254 RGBA | `ede9ffd2…1781dbb4`（一致） | `0de729df…9adf65dd`（一致） |
| red | 1254×1254 RGBA | `98f9465a…5c9792fa9`（一致） | `a212dbfe…9b25dafe7`（一致） |

# Axis / Root / Body-core Metadata（source px。`dual_rigid_recipe.json`。Provisional）

| 項目 | blue | red |
|---|---|---|
| 名目の正面 | 画像の右（+X） | 画像の左（−X） |
| 軸の根拠（結び目の中心 → 両手の中点） | (365, 515) → (875, 715) = 21.41° | (915, 515) → (380, 702.5) = 160.69° |
| `source_front_deg` | **21.4** | **160.7** |
| 正規化の回転（1回だけ） | −21.4°（名目からの補正 −21.4°） | −160.7°（名目180°からの補正 +19.3°） |
| root（結び目と両手の中点の真ん中） | **(620, 615)** | **(648, 609)** |
| body-core（背中の縁 → まわしの下の縁。軸に垂直） | **(741, 308) → (544, 808)** = 537.41 px | **(522, 251) → (731, 847)** = 631.58 px |

- body-coreは、rootを通って軸に垂直な、胴体の断面
  - 上端: 背中の輪郭
  - 下端: まわしの下の縁。その先の脚と足を含まない
  - 腕・手・頭・結び目も含まない
  - 垂直からのずれは、blue 0.1°、red 0.0°（toolは±3°以内であることを検証する）
- 2枚は同じ解剖・鏡像とは仮定せず、それぞれ別の値にした

# Normalization

| | blue | red |
|---|---|---|
| source → master | 0.916075（縮小のみ） | 0.779482（縮小のみ） |
| source → runtime | 0.229019 | 0.194871 |
| runtimeのbody-core | **123.077 px** | **123.077 px** |
| runtimeの画像 / pivot | 167×181 / (84, 87) | 158×178 / (82, 95) |
| runtimeの全体のalpha bbox | 153 × 169 px | 146 × 166 px |
| rootから最も遠い画素まで | 120.4 px | 119.9 px |

- masterは `R = 246.154 px`（runtime × 4）。runtimeは、ちょうど1/4に縮小（Lanczos、premultiplied）
- 全体のalpha bboxは、scaleの基準にしていない
- 体格の差は保った（正規化したのは、body-coreの幅だけ）

# No-mirror Evidence

- dual pathの変換は、sprite全体の回転、sprite全体の平行移動、1つの一様なscaleだけ
- testで、反転していないことを2通りで確認した
  1. `Image.Image.transpose` / `ImageOps.mirror` / `ImageOps.flip` を、呼ばれたら例外を投げるものに差し替えて、build全体が成功することを確認した（`test_build_never_flips_or_mirrors`）
  2. dual moduleのASTに、`transpose`、`FLIP_*`、`mirror`、`flip`、`mirror_part`、`ImageOps` が無いことを確認した
- recipeの検証で、blueとredが別のfileであることを要求する

# 16-angle Evidence

- `blue_runtime_16angles.png`（tile 260）、`red_runtime_16angles.png`（tile 256）
- 0°〜337.5° を22.5°刻みで描いた。各tileでrootは同じ位置
- 不透明部分の重心からrootまでの距離（揺れの指標）
  - blue: 2.9014〜2.9103 px
  - red: 2.3317〜2.3400 px
  - 差は0.01 px以下。公転や揺れは無い
- 切れているtileは無い（tileのalpha bboxが縁に触れていない。触れればtoolは止まる）

# Faceoff Geometry Evidence

- `dual_faceoff_arena_1920.png`（1920×1080）
  - blueはroot (836.923, 540)、facing 0°
  - redはroot (1083.077, 540)、facing 180°
  - = 960 ∓ 0.7 m × 175.824 px/m
- `dual_faceoff_variants.png`（3×2、各560 px）
  1. 開始の距離 4R
  2. 接触の前 2.8R
  3. 接触の直前 / 押し 2.05R
  4. 線を+30°
  5. 線を−30°
  6. 横の位置（線64°）
  - 4〜6はいずれも2.8R
- 全ケースで、facingと「相手のrootへの方向」の内積が **1.0**（9桁まで）
  - 各力士は、相手のrootを幾何学的に正確に向いている
  - offsetを試すケースは無い
- 反転も、手足ごとの調整も無い

# Motion Recipe Values（preview専用。gameplayの値ではない）

- frame: 50 ms、GIFの視野: 760×420（土俵の中心を中心にした、arenaの切り取り）
- **advance**
  - 両者が自分のfacingの方向へ、各0.95R進む（4R → 2.1R、ease-in-out）
  - 内訳: 開始で8 frame止まる、20 frameで進む、10 frame止まる
- **stagger**
  - 接触の距離2.1Rから、よろける側が後ろへ0.8R、自分の+Yへ0.25R、6 frameで動く（ease-out）
  - 頂点で4 frame止まり、14 frameで戻る（後ろ0.3R / 横0.08R まで）
  - 開始で6 frame、終わりで8 frame止まる。相手は静止したまま
- **stagger + rotation**: 同じ経路に、剛体の回転を足す。0 → **+5.0°**（`rotation_max_deg`）→ 0
- **push**
  - 4Rから2.0Rまで16 frameで近づき、4 frame止まる
  - 接触したまま、2人がまとめて +0.3R → −0.25R → +0.15R → 0 と動く（各8 frame）
  - 最後に6 frame止まる

# Translation-only Stagger Evidence

- `blue_stagger_translation_only.gif` / `red_stagger_translation_only.gif`: 38 frame
- 全frameでfacingは一定（blue 0°、red 180°）。rootだけが動く
  - blue: (895.38, 540) → 頂点 (846.15, 555.38) → (876.92, 544.92)
  - red: (1024.62, 540) → 頂点 (1073.85, 524.62) → (1043.08, 535.08)
- testで、facingの値が1種類だけであること、rootが複数の位置をとることを確認した

# Translation + Rotation Stagger Comparison

- `*_stagger_translation_plus_rotation.gif`: 同じ経路で、facingは0°から最大+5.0°まで（blue）、180°から最大185°まで（red）
- testで、最大値がちょうど5.0°で、それを超えないことを確認した
- 比較用の静止画: `rigid_motion_contact_sheet.png` の9枚目（stagger peak、+5°の剛体回転）と、7枚目（同じ頂点、平行移動のみ）を並べた

# Close-contact / Push Perception Evidence

- `dual_push_contact.gif`: 59 frame
  - 中心の間の距離2.0R（= 体の円が接する距離）で、2人の画像が重なる
  - blueのxの範囲: 836.92 → 最大916.92
- 描く順は blue → red。重なる部分では、redが上になる
- 同じ2枚のままで、poseの差し替えも手足の動きも無い

# Output Paths / Hashes

出力先: `tools/wrestler_art/output-dual-rigid.local/`（ignore。commitしない）。

| file | size | mode | decoded pixel SHA-256 |
|---|---|---|---|
| blue_runtime_16angles.png | 1040×1144 | RGBA | `e6c79a28b57e8590166ab713e19c18e818420201d70ba94c65d2da8745332f4a` |
| red_runtime_16angles.png | 1024×1128 | RGBA | `ff2996ddb86d4901d62922efe4e3341dba704a55f92d2df414ba27bed6725689` |
| blue_pivot_guide.png | 1104×1104 | RGB | `c080508745158d4ac5eea41f8cc904755fa2f1730c88b9ece3f91290e639c92d` |
| red_pivot_guide.png | 1104×1104 | RGB | `e384e79a6163405bce716cc1a19946c601bcb37e6335672c08ed080ebb7e160e` |
| dual_faceoff_arena_1920.png | 1920×1080 | RGB | `a0805fed6ca658c39d6fe147f1b3902c248c8892dc96ccb890a0ee6be8e24de5` |
| dual_faceoff_variants.png | 1680×1120 | RGB | `fef6922864e3be085aca94b418b1e285741268027539713824aa80b1129eab4a` |
| rigid_motion_contact_sheet.png | 1920×1200 | RGB | `b8eb029edd7f6694ec2c3f1085f62947bd250de1ab347c2b218bb20d63b2b1f6` |

| GIF | frame数（論理） | file SHA-256 | decoded frames SHA-256 |
|---|---|---|---|
| dual_advance.gif | 38 | `65c0a6db…a35b97399` | `bc96c746…8a5736` |
| blue_stagger_translation_only.gif | 38 | `efcf0eb4…f12544` | `ec0dbc32…4dc36e` |
| red_stagger_translation_only.gif | 38 | `ddfa4a60…e73e5` | `b098fb10…4807` |
| blue_stagger_translation_plus_rotation.gif | 38 | `7d2033ba…149684` | `ec2a8106…7c70` |
| red_stagger_translation_plus_rotation.gif | 38 | `c4724b7c…150c1` | `8955faa9…95fd1` |
| dual_push_contact.gif | 59 | `1fa7dba6…f28381` | `e0c47475…52468` |

- 完全なhashは `build_dual_rigid_manifest.json` にある
- `dual_rigid.json` SHA-256 `537746cd66c423ee6e199a21c8ba85d709eb5ebfed5c234b74eb7a6072f9129d`
- recipe canonical SHA-256 `42a6cc321cf80def497b121a56fe573e1c08f9473dc5c92350595fcedf75fc25`
- GIFはPillowだけで書いた（adaptive palette、loop）。新しい依存は無い
- Pillowは、同じ内容の連続frame（静止の部分）を1つにまとめ、表示時間を足す。総再生時間 = 論理frame数 × 50 ms は保たれる（testで確認した）

# Determinism

- 実画像で、CLIを2つの出力dirへ実行した。**15 fileすべてがbyte単位で同一**（PNG / GIF / JSON、`cmp`）
- test
  - 合成fixtureで、2回のbuildのmanifest、json、全fileのbytesが同一
  - 実画像でも、2回のbuildのmanifestが同一
- timestampも乱数も無い（testで、日付・時刻の形の文字列や、time / date系のkeyが無いことを確認した）

# Tests

`tools/wrestler_art/.venv/Scripts/python -m unittest discover -s tools/wrestler_art/tests` → **96 tests OK**（既存の02A / 02B 62件 + 今回の34件。約65秒）。

Task必須の25項目との対応（`test_preview_dual_rigid_wrestlers.py`）:
1. blueが無い → `test_missing_blue_fails`
2. redが無い → `test_missing_red_fails`
3. 寸法 → `test_wrong_dimensions_fail`
4. pixel SHA → `test_wrong_pixel_sha_fails`
5. alpha → `test_alpha_validation`
6. re-encode → `test_same_pixel_reencode_accepted`
7. root → `test_root_must_be_on_source`、`test_roots_inside_normalized_images`
8. body-coreが0でない → `test_zero_body_core_fails`、`test_body_core_scale`
9. 123.077 px → `test_body_core_scale`、実画像の `test_runtime_body_core_scale`
10. 切れない → `test_no_sprite_or_tile_clipping`
11. 16方向 → `test_sixteen_angles_for_both`
12. pivotの安定 → `test_pivot_stable_through_rotation`
13. 反転なし → `test_build_never_flips_or_mirrors`、`test_dual_module_has_no_mirror_operation`
14. 相手を向く → `test_faceoff_points_toward_opponent`、`test_real_faceoff_points_toward_opponent`
15. 1920×1080 → `test_faceoff_arena_size`
16. variants → `test_required_faceoff_variants`
17. GIF → `test_outputs_written_and_gifs_readable`
18. GIFのframeは剛体のみ → `test_gif_frames_are_rigid_renders_of_the_runtime_sprites`
    - 経路の関数から作ったframeと、記録したframeが一致する
    - 各frameは、(root, facing) だけから再描画したものとpixel hashが一致する
19. 平行移動のみのstagger → `test_translation_only_stagger_has_no_rotation`
20. 回転の上限 → `test_rotation_stagger_respects_max_angle`、recipeの `test_stagger_rotation_limit`
21. 連続写真のsheet → `test_contact_sheet_generated`
22. timestampなし → `test_metadata_has_no_timestamp`
23. 決定性 → `test_deterministic_rerun_identical`
24. ignore → `test_local_inputs_and_outputs_are_git_ignored`
25. `git diff --check` → PASS（commitの前に実行した）

その他: 垂直でないbody-core、同じfileの指定、CLIのfail-closed / 成功。

`pnpm test` / build: Taskの指示により実行していない（`src/` は未変更）。

# SPEC Sync

`docs/WRESTLER_PRODUCT_ART_SPEC.md`（最小限）:
- Status行: 現在の実験は、2枚の剛体sprite。02Aと02Bの1枚の候補は不採用
- §11に「更新（ART-WRESTLER-03A）」を足した
  - 02Bの1枚の候補は、User Visual Gateで不採用（1枚の方式そのものは有効）
  - 相手と向き合うように別々に描いた2枚。反転しない
  - 剛体の回転と平行移動を、最小のanimationの方式として **検証中**（未承認）
  - 接触や組みの専用poseが必要かは未解決
  - 8方向、animation / poseの数、描画の構成は決めない
- §21のstaging: 02Bの結果と03Aを足し、番号を振り直した
- 剛体のanimationを「承認済み」とは書いていない

# User Visual Check Required

**Required。** 次を確認してください（すべて `tools/wrestler_art/output-dual-rigid.local/`）。
1. `blue_runtime_16angles.png`
2. `red_runtime_16angles.png`
3. `dual_faceoff_arena_1920.png`
4. `dual_faceoff_variants.png`
5. `rigid_motion_contact_sheet.png`（GIFの表示が不便なときは、これで判断できる）
6. `dual_advance.gif`
7. `blue_stagger_translation_only.gif`、`red_stagger_translation_only.gif`
8. `blue_stagger_translation_plus_rotation.gif`、`red_stagger_translation_plus_rotation.gif`
9. `dual_push_contact.gif`
10. `blue_pivot_guide.png`、`red_pivot_guide.png`

確認してほしい点（Taskの質問）:
- 本当に向き合って見えるか
- カメラの向きが、spriteと一緒に回って見えないか
- どちらがより回転に強いか
- 平行移動だけの前進や、よろけで足りるか
- 小さな回転は、よろけを良くするか、それとも回っているだけに見えるか
- 接近したときに、押し合いに見えるか
- 最初に破綻するのはどの状態か
- 専用のartが必要なら、接触やactionだけで済むか

Outcome（A. 剛体で十分 / B. 一部だけ専用poseの混合 / C. 剛体の360°は構造的に不可）は、Userが判定する。

# Agent Visual Observations（判断の材料。判定ではない）

- **向き合い（線0°）**
  - 両者とも、頭が体の軸より画面の上側にある（blueは自分の左 = −Y側、redは自分の右 = +Y側に頭がある）
  - 水平に向き合うと、2つの頭が上側で寄り合う構図になり、「向き合って構える」ように読みやすい
  - 2枚が、この向き合いのために描き分けられていることがわかる
- **線を±30° / 64°にしたとき**
  - 幾何的には相手を向いている
  - ただし両方とも「後ろ上から見た背中と頭頂」の画のまま回る。描き込まれたカメラが、体と一緒に回る印象がある
  - 線0°に比べて、頭の寄り合いの対称性が崩れる
- **2枚の差**
  - 外形の寸法と、回転したときの見え方は近い（runtimeのbbox: blue 153×169、red 146×166）
  - どちらかが明らかに回転に強い、という差はAgentには見えない
- **前進（平行移動のみ）**: 体が滑るように進む。足の踏み出しは無い
- **よろけ**
  - 平行移動だけだと、後ろへ滑るように見える
  - +5°の剛体の回転は小さく、静止画では差がわずか
- **接触（2.0R）**
  - 画像どうしが大きく重なる（頭が重なり、redが上に描かれる）
  - 押し合いに見えるか、専用poseが必要になる最初の状態かは、Userの判断が必要
- 数値（root、body-core、軸）はすべてProvisional。recipeを直して再実行すれば変えられる

# Design Deviations

Design Deviations: NONE

（別の画像の使用、反転、塗り直し / 歪み / 手足ごとの変換、gameplay / runtime sourceの変更、未承認のpose assetの追加、8方向の制作への転換は、どれもしていない。）

# Unexpected Scope（報告のみ）

- **入力の配置**: 必須の入力が `input.local/` に無かった。DownloadsにあったSHAが完全一致する原本を、そのままcopyした（上の「Verified Source Identities」を参照）。Repositoryには影響しない
- `tools/wrestler_art/README.md`: 冒頭の表に03Aを足し、03Aの節を加えた（同じtool dirの説明の更新）
- 範囲外の修正: なし。02A / 02Bのtool、recipe、testは変更していない

# Known Untested Items

- 見た目の承認（User Visual Gate）。自動testは、幾何・剛体変換・scale・決定性だけを検証する
- 検証した環境はWindows x64 / Python 3.9.7 / Pillow 11.3.0 のみ（manifestにversionを記録）

# Changed Files

- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`（新規）
- `tools/wrestler_art/dual_rigid_recipe.json`（新規）
- `tools/wrestler_art/tests/test_preview_dual_rigid_wrestlers.py`（新規）
- `tools/wrestler_art/README.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`tools: validate dual rigid wrestler sprites`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- 入力のsprite、出力のPNG / GIF / JSON、`.venv` / cacheはignoreされ、untracked
- `main` は変更しない
