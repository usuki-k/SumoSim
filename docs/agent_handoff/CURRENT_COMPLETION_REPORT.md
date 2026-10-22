Task-ID: ACTION-07D-TSUPPARI-PRODUCT-ART-PROMOTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: df2575d8520f2bb05edfb1c4f2677b6af207c060
Agent-Start-Head: bded4124ecb51b99c57e3975d968ed1382ede225
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 33 / 33 PASS。昇格と整理で受理済みの見た目が変わっていないかは、最後のUser Play Testで確認する）。

- User Play Testで採用されたSEPARATEのTsuppari artを、恒久的なProductの契約に昇格した
  - runtimeのtextureは4枚: `public/assets/action/wrestler/tsuppari/{red,blue}_{left,right}.png`
  - exporterは1つ: `export_tsuppari.py`。値の正本は `tsuppari_recipe.json`
  - metadataは1つ: `productTsuppariArt.ts`
- 4枚は、受理済みのSEPARATEのgate textureと、**decoded pixelもPNG byteも完全に同じ**
- 一時的なVisual Gateの仕組みを外した
  - 12枚のgate texture
  - key `4`
  - `TsuppariArtMode`
  - `TSU ART` 表示
  - mode表
- 正規化の測定を、`measure_tsuppari_pose.py` で再現できるようにした。recipeの説明も、実装した方法（7 px opening）に合わせた
- gameplayは変えていない（`src/game/sumo`、`src/game/input` の差分は0行）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `df2575d`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `df2575d..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `bded412`
- 受理済みのred sourceの同一性（decoded RGBA pixel SHA-256）:

| source | 受理値 | 実測 |
|---|---|---|
| `candidate_red_tsuppari_left.png` | `219d66dcf13585e7149382f01c964fdd9074bf61e615b5d3f9bbb15b38cb84b3` | 一致 |
| `candidate_red_tsuppari_right.png` | `d7d5632f8357bd1e4427d2bcdcee5a6e74307fcd9d0caca2d86d102ec8719011` | 一致 |

# 現在の正本（Single Source of Truth）

| 何 | 正本 |
|---|---|
| 描いたsource | `input.local/candidate_red_tsuppari_left.png` / `_right.png` の2枚だけ（commitしない。同一性はrecipeのpixel SHA-256） |
| 正規化の値、mask_limits | `tools/wrestler_art/tsuppari_recipe.json`（`masters`） |
| red → blueの規則（反射 + まわしの塗り替え） | `tools/wrestler_art/runtime_wrestler_recipe.json`（idleと共有。tsuppariのrecipeには複製しない） |
| 4枚の対応（手の割り当て） | `export_tsuppari.OUTPUTS`: red L = red L、red R = red R、**blue L = red Rを反射 + 塗り替え**、**blue R = red Lを反射 + 塗り替え** |
| 書き出し / `--check` | `tools/wrestler_art/export_tsuppari.py` |
| 正規化の測定の再現 | `tools/wrestler_art/measure_tsuppari_pose.py`（`--check`） |
| runtimeのmetadataと、どのposeを出すか | `src/game/presentation/productTsuppariArt.ts`（`PRODUCT_TSUPPARI_ART`、`selectWrestlerArt(idle, state)`） |
| 文書 | `docs/WRESTLER_PRODUCT_ART_SPEC.md` §0、`docs/ARCHITECTURE.md` |

# Gate → 恒久assetの対応と、pixelが同じことの証明

削除する前に、gateの12枚をscratchpadへ退避してから比べた。

| 恒久asset | 元のgate texture | size / pivot | pixel SHA-256（両方で同じ） | file SHA-256（両方で同じ） |
|---|---|---|---|---|
| `tsuppari/red_left.png` | `separate_red_left.png` | 198×177 / (83, 94) | `ab5043bf8aa8fe20a0b12c45095bba62214a73d4816762966a7e2730b7773f2f` | `3b772efc…1f19` |
| `tsuppari/red_right.png` | `separate_red_right.png` | 193×163 / (79, 87) | `0859a8c4d3c629f5ea00fc27a9ba97b5e0af8848daba5de77eb846d56aee0de8` | `b26187cc…6774` |
| `tsuppari/blue_left.png` | `separate_blue_left.png` | 193×163 / (79, 76) | `bed6fa024e51d9ca17a75fd243554b4fa7f052f204e4fa679ea00a34dd68bb53` | `424fa293…5d57` |
| `tsuppari/blue_right.png` | `separate_blue_right.png` | 198×177 / (83, 83) | `c9369b4b1b5edcdd46008735032fe8e95e0894797993ec2089d66b8a924bb1ef` | `9a2c9500…236e` |

- body-coreは4枚とも123.076923 px
- この4つのpixel hashは、`tests/test_export_tsuppari.py` に `ACCEPTED_SEPARATE_PIXELS` として固定した
- 正規化はやり直していない。recipeの値（front、root、body-core）は、07C / 07C2で記録した値のまま

# Measurement Helper（`measure_tsuppari_pose.py`）

方法（recipeの `measurement.method` にも同じ内容を書いた）:

- sourceを1/2に縮小する（BOX）
- 髪 H: max(R, G, B) < 80、alpha > 200。7 px opening（erosionの後にdilation）、最大の4連結成分
- まわし B: 受理済みの塗り替えのhue band（saturation / valueの下限つき）。最大成分の5%以上の4連結成分すべて
- 重心は画素の中心（source px）、面積は1/2のscaleで数えて ×4
- 回転差 = angle(H→B) − idleのangle(H→B)
- s = mean(√髪の面積比, √まわしの面積比)
- idleのroot / body-coreを、H/Bの中点を中心に s·Rot で運ぶ。front = 160.7 + 回転差
- NumPyやOpenCVは使わない（Pillowだけ）。出力は決定的
- recipeやimageは書かない

結果（`--check` の許容差: front 0.1°、各座標1 source px。許容差の値はrecipeの `measurement.tolerance` が持つ）:

| pose | 記録値（exporterが使う） | helperの値 | 最大の差 |
|---|---|---|---|
| red_left front / root / core | 160.7 / (704, 620) / (575, 253)–(790, 864) | 160.677 / (704.00, 619.81) / (574.52, 252.41)–(789.29, 864.07) | 0.023° / 0.71 px |
| red_right front / root / core | 157.8 / (818, 688) / (663, 309)–(920, 940) | 157.842 / (818.01, 688.09) / (663.09, 309.38)–(920.17, 939.90) | 0.042° / 0.41 px |
| idle reference | — | hair (428.7, 542.7) 42652 px、mawashi (878.6, 565.5) 56028 px | — |

- `measurement_evidence` は、helperの出力そのもの（完全一致で検証する）
- red_leftの記録値は、07Cのcommitされていない旧実装（7 px erosionだけ）で作ったもの。helperとの差は0.71 source px（runtimeで0.18 px）で、material mismatchではない。そのため、受理済みのpixelは動かしていない（recipeの `measurement.history` に記録した）
- 07C2のcalibration（07C1のrightを測り直すと、記録値と完全に一致）も、このhelperと同じ手順

# Recolor / Mask

ruleは変えていない。

| source | mask | missed（上限60） | fringe（上限120） |
|---|---|---|---|
| red_left 反射（→ blue_right） | 2239 | 17 | 48 |
| red_right 反射（→ blue_left） | 2264 | 20 | 83 |

- 次のことはtestで確かめた:
  - alphaが変わらない
  - mask外の画素が変わらない
  - 反射はlocal Yについてだけ
- maskは目視でもまわしの帯だけにかかっていて、混入はない（07C2と同じpixel）

# Visual-Gateの整理

## 削除したもの

- `public/assets/action/wrestler/tsuppari-gate/` の12枚（SEPARATE / MIRROR-L / MIRROR-R × red / blue × 左右）
- runtime: `TsuppariArtMode`、`TSUPPARI_ART_MODES`、`TSUPPARI_ART_MODE_LABEL`、`nextTsuppariArtMode`、gateのmode表、`tsuppariGateArt(mode, …)`
- `BoutScene`: key `4` の登録、`cycleTsuppariArtMode`、`tsuppariArtMode` field、debug行の `TSU ART: …`、helpの `4 tsu art`
  - `BoutScene.ts` は、07C以前（`e30d6b4~1`）と差分0行に戻った
- `WrestlerView.apply` のmode引数。preloadは、idleの2枚 + Productの4枚だけになった
- 3 modeの設定（recipeの `modes`、READMEの3 modeの表）
- ローカルの `tools/wrestler_art/output-tsuppari-gate.local/`（git-ignoredで、作り直せる）

## 名前を変えて残したもの（git mvで履歴を保っている）

| 旧 | 新 | 中身 |
|---|---|---|
| `export_tsuppari_gate.py` | `export_tsuppari.py` | 12枚 / 3 mode → 4枚 / 固定のSEPARATE対応 |
| `tsuppari_gate_recipe.json` | `tsuppari_recipe.json` | `modes` を削除。Productの状態、実装した測定方法、許容差、historyを記載 |
| `preview_tsuppari_gate.py` | `preview_tsuppari.py` | 4枚のreview用preview（mode別のsheetを、Productの1枚のsheetにした） |
| `tests/test_export_tsuppari_gate.py` | `tests/test_export_tsuppari.py` | 恒久の契約のtest |
| `src/game/presentation/tsuppariGateArt.ts`（+ test） | `productTsuppariArt.ts`（+ test） | Phaser非依存の、恒久のmetadataと選択 |

## 履歴として残したもの

- authored blueの2枚: recipeの `references` に残した（previewの参照用だけ。runtimeのsourceにはならない）
- MIRROR-L / MIRROR-Rが不採用だった理由: SPEC §0、READMEのHistory、git historyに記録した
- gateのexporter / recipe / 12枚の実体: git history（`df2575d` 以前）にだけある。現在の正本と二重にならないように

# Runtime Metadata（`src/game/presentation/productTsuppariArt.ts`）

- `PRODUCT_TSUPPARI_ART[id][hand]`
  - texture key: `product-tsuppari-<id>-<hand>`
  - path: `assets/action/wrestler/tsuppari/<id>_<hand>.png`
  - width / height / pivot（上の表のとおり）
  - `bodyCoreDiameterPx` 123.076923
- `allProductTsuppariArts()`: preloadの4枚
- `selectWrestlerArt(idle, state)`: 選ぶ材料は `WrestlerVisualState` のpose = tsuppariとtsuppariHandだけ。それ以外の状態ではidleを返す
- `WrestlerView`: textureごとのpivot（origin）とbody-core scaleで、canonicalな位置・facingを保つ。poseは行動全体（startup / active / recovery）のあいだ保持する

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| 受理済みのSEPARATEを昇格 | 固定の `OUTPUTS`（SEPARATEの対応）、4枚を出力 | `test_fixed_separate_mapping_preserves_semantic_hand`、`test_product_pixels_equal_the_accepted_separate_gate` |
| red left / rightのsourceの持ち主 | recipeの `masters`（pixel SHA-256）、exporterはred 2枚だけを読む | `test_accepted_red_source_identities`、`CommittedProductTests`（red 2枚だけのdirでexport）、`test_missing_or_changed_source_fails_closed` |
| blueの導出 | blue L = red Rを反射 + 塗り替え、blue R = red Lを反射 + 塗り替え（ruleはidleのrecipe） | `test_every_texture_shows_its_semantic_hand`、`test_geometry_and_recolor_per_variant`、`test_only_local_y_reflection`、`test_recolor_rule_is_owned_by_the_idle_runtime_recipe`、TSの `hand mapping` test |
| runtime assetの4つのpath | `public/assets/action/wrestler/tsuppari/{red,blue}_{left,right}.png` | TSの `exactly four textures`、smokeの「4 Product textures loaded」 |
| 受理済みpixelの保持 | 正規化をやり直さない。記録値のまま | pixelとfileのSHA-256の一致（上の表）、`ACCEPTED_SEPARATE_PIXELS` |
| pivot / body-coreのmetadata | `productTsuppariArt.ts` | `test_typescript_metadata_matches_the_export`、TSの `accepted geometry`、smokeのorigin = pivot |
| 決定的なexport / check | `export_tsuppari.py`（atomicな書き込み、`--check` は何も書かない） | `test_deterministic_export`、`test_check_writes_nothing_and_detects_changes`、実際の再実行でbyteが同じ |
| 測定helper / 手順 | `measure_tsuppari_pose.py`、recipeの説明と許容差 | `RealMeasurementTests`（記録値を許容差内で再現、evidenceは完全一致、決定的）、`MeasurementTests`（合成画像: outlineの除去、平行移動で剛体に運ぶ、許容差の境界）、`test_measurement_prose_names_the_implemented_method` |
| Visual-Gateのruntimeの整理 | mode / key 4 / label / gate assetを削除 | TSの `no Visual-Gate art mode remains`、`test_product_textures_are_not_ignored_and_the_gate_is_gone`、smoke（key 4は効果なし、TSU ART無し、gate textureは0枚） |
| gameplayは不変 | `src/game/sumo`、`src/game/input` は差分0行 | `git diff df2575d -- src/game/sumo src/game/input` = 0行、Tsuppariのtestは全PASS、smokeのreach |
| SPEC / ARCHITECTUREの更新 | SPEC §0にTsuppariのAccepted節、ARCHITECTUREにProduct Tsuppari pose artの段落 | 文書の差分（Changed Files） |

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_tsuppari.py`（focused） | 26 tests OK |
| wrestler-art全suite | 151 tests OK |
| `productTsuppariArt.test.ts` など、presentationのtest | 45 tests PASS |
| `pnpm test` | 22 files / 352 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_tsuppari.py --check` | exit 0 |
| exporterの再実行 | 4枚ともbyteが同じ（file SHA-256はgateの元ファイルと一致） |
| `export_runtime_wrestlers.py --check`（idle） | exit 0。idleの `red.png` / `blue.png` は不変（testでもpixelを固定） |
| `measure_tsuppari_pose.py --check` | exit 0 |
| `src/game/sumo` / `src/game/input` | `df2575d` から差分0行 |

# Browser Smoke

`pnpm dev`（port 5199）+ headless Chrome（CDP）。結果: **33 / 33 PASS**

- 2回目のFAILは、空振り側を確かめる手順がscript側の問題（キーのタップが行き過ぎて0.897 mまで寄った）。直してから再実行した

| 確認 | 結果 |
|---|---|
| Productの4枚が受理済みのsizeで読み込まれ、gateのtextureは0枚 | PASS |
| pre-boutでSimulationが進まない。key 4は何も起こさない（Snapshotは同じ、art modeのstateも無い） | PASS |
| Enterで開始。debug行に `TSU ART` が無い。helpに `4 tsu art` が無い | PASS |
| ArrowLeft / ArrowRight（2回ずつ、2回目は直前にkey 4を押す）: 行動の全frame（startup / active / recovery）で `product-tsuppari-blue-<hand>` を表示し、終わるとidleに戻る | PASS（4 / 4） |
| origin = pivot。全frameで位置 = Snapshot center、rotation = facing、scale 1.0 | PASS |
| dummy 3: CPU redで、手ごとに `product-tsuppari-red-left` / `-right` が出る。Tsuppari以外はidleの `product-wrestler-red` | PASS |
| reach: 実行中のmoduleで0.55 / 0.90 m。0.86〜0.899 mで命中、0.901 / 0.91 mで空振り | PASS |
| in-game: 0.8733 / 0.8942 mで命中（0.875〜0.90の帯も含む）、1.16 mで空振り。すべての打撃が「命中 ⇔ 距離 ≤ 0.90」に従う | PASS |
| Push / Counter / Grip、idle / moveのsprite、R restart | PASS |
| console error、失敗したrequestが無い | PASS |

screenshot（`03_blue_left` / `03_blue_right` / `06_reach_band`）でも、受理済みのposeが描かれていることを確かめた。

# Changed Files

- 追加
  - `tools/wrestler_art/measure_tsuppari_pose.py`
  - `public/assets/action/wrestler/tsuppari/` の4枚
- 名前を変えて書き換え（git mv）
  - `tools/wrestler_art/export_tsuppari.py`
  - `tools/wrestler_art/preview_tsuppari.py`
  - `tools/wrestler_art/tsuppari_recipe.json`
  - `tools/wrestler_art/tests/test_export_tsuppari.py`
  - `src/game/presentation/productTsuppariArt.ts` / `.test.ts`
- 変更
  - `src/game/scenes/WrestlerView.ts`
  - `src/game/scenes/BoutScene.ts`（07C前の状態に戻した）
  - `tools/wrestler_art/README.md`
  - `docs/WRESTLER_PRODUCT_ART_SPEC.md`
  - `docs/ARCHITECTURE.md`
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- 削除
  - `public/assets/action/wrestler/tsuppari-gate/` の12枚

## 変更していないgameplayのファイル

- `src/game/sumo/`（`BoutSimulation.ts`、`BoutTypes.ts`、testを含む）
- `src/game/input/`
- `src/game/presentation/wrestlerVisualState.ts`
- idleの `red.png` / `blue.png` / `runtime_wrestler_recipe.json` / `export_runtime_wrestlers.py`
- `PROJECT_HANDOFF.md`、`CURRENT_TASK.md`、`main`

# Design Deviations

Design Deviations: NONE

（metadataの名前は、Taskの例 `productTsuppariArt.ts` のとおり。assetのpathとファイル名も、Taskの推奨どおり）

# Unexpected Scope

- `docs/ARCHITECTURE.md` の力士visualの段落には、07Cの時点から「Tsuppariの専用poseはまだ無く…」という古い記述が残っていた。Taskの範囲（ARCHITECTUREの更新）の中で、正しい記述に直した。それ以外の範囲外の問題は見つけていない

# Known Untested Items

- 実機での最後のUser Play Test（下記）。headlessのsmokeが確かめたのは、textureの選択・配置とreachの規則まで

# Final User Play Test: REQUIRED

見た目とreachは、すでに受理済み。確認してほしいのは、昇格と整理で何も変わっていないことだけ:

1. `pnpm dev` → Enter →（必要ならdebug `0`）
2. ArrowLeft / ArrowRightで打つ。dummy `3` にすると、CPU redの左右の打撃も見られる

見てほしい点:

- 左右のpose、右腕の長さのつり合い、blueの版が、07C2で受理したSEPARATEと同じに見えるか
- 0.55 mのreachの感触が同じか
- textureやpivotの飛び、gameplayの劣化が無いか
- key `4` を押しても何も起きないか（Visual Gateが消えていること）

# Git Delivery

- stageするのはTask-owned fileだけ（上のChanged Files）。commit `refactor(art): promote tsuppari product poses` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `input.local/`、`output-*.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
