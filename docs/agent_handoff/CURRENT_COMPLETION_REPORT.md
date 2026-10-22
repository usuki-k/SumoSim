Task-ID: ACTION-08C-COUNTER-PRODUCT-ART-PROMOTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: b65ab9a2e01835dc955248d5d4f7492361b78c1c
Agent-Start-Head: 5411ab102e91dc5826f533d3fe8d918d767627c8
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 28 / 28 PASS（GPU）。昇格と整理で受理済みの見た目が変わっていないかは、最後のUser Regression Play Testで確認する）。

- User Play Testで受理されたCounter / 引き・捌き（ACTION-08A1のpose + ACTION-08Bの35°の体の回転）を、恒久のProductの契約に昇格した
  - 2枚のruntime texture: `public/assets/action/wrestler/counter/red.png` / `blue.png`
  - exporter: `export_counter.py` + `counter_recipe.json`
  - metadata / 選択 / 回転: `productCounterArt.ts`
- 2枚とも、受理済みの `counter-gate` textureと、**decoded pixelもPNG byteも同じ**（`git mv` で移した）
- 35°・sin曲線・red + / blue −の動きは、そのまま変えていない
- gameplayは変えていない（`src/game/sumo`、`src/game/input` は差分0行）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `b65ab9a`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `b65ab9a..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `5411ab1`
- 受理済みのsource: `input.local/candidate_red_counter.png`
  - 1265×1244 RGBA
  - decoded RGBA pixel SHA-256 `5429d02f6f7ffad36754cbd5958c77bb1197027cce45572f81c825d1a02c37b8`（一致）

# Gate → 恒久Productの昇格と、pixelが同じことの証明

| 受理済みのgate（移す前） | 恒久のProduct | size / pivot | pixel SHA-256（両方で同じ） | file SHA-256（両方で同じ） |
|---|---|---|---|---|
| `counter-gate/red.png` | `public/assets/action/wrestler/counter/red.png` | 210×207 / (74, 115) | `83b96783ebdd741ab07e435d25ce7a4ce6557b734d40c8873560bab2b630d5d3` | `a6128071c1a4137d7fbab66e8d51b90e72fe3ebe187c85ac73bd17fcfd2a6b4e` |
| `counter-gate/blue.png` | `public/assets/action/wrestler/counter/blue.png` | 210×207 / (74, 92) | `1dec7025670ba375287166078cbb52dd3b6701fa52618646107fd4f50153e439` | `3aa893ce83621b66071fe77fd20c4b577b9fc22ef17d944e6768217448b457f3` |

- 移した後に `export_counter.py --check` と再実行をした。新しいexportとpixelもbyteも一致した
- `tests/test_export_counter.py` の `ACCEPTED_COUNTER_PIXELS` で、この2つのhashを固定した
- body-coreは2枚とも123.076923 px
- 正規化の値（front 178.8、root (863, 553)、body core (853, 111)–(868, 846)）、pivot、sourceは変えていない

# 恒久の正本（Single Source of Truth）

| 何 | 正本 |
|---|---|
| 描いたsource | `input.local/candidate_red_counter.png` の1枚（commitしない。同一性はrecipeのpixel SHA-256） |
| 正規化の値、mask_limits | `tools/wrestler_art/counter_recipe.json`（`master`） |
| red → blueの規則 | `tools/wrestler_art/runtime_wrestler_recipe.json`（idle / Tsuppariと共有。複製しない） |
| 書き出し / `--check` | `tools/wrestler_art/export_counter.py`（`--out-dir`。既定は `public/assets/action/wrestler/counter/`） |
| runtimeのmetadata、選択、35°の回転 | `src/game/presentation/productCounterArt.ts`（`PRODUCT_COUNTER_ART`、`selectWrestlerPoseArt`、`counterVisualRotationOffset`、`COUNTER_VISUAL_MAX_ROTATION_RAD`） |
| 文書 | `docs/WRESTLER_PRODUCT_ART_SPEC.md` §0（Counterの節を新設）、`docs/ARCHITECTURE.md` |

# 名前を変えた / 消した一時的なgate（すべて `git mv` で、履歴を保っている）

| 旧（gate） | 新（Product） |
|---|---|
| `public/assets/action/wrestler/counter-gate/red.png` / `blue.png` | `public/assets/action/wrestler/counter/red.png` / `blue.png`（byteは同じ） |
| `src/game/presentation/counterGateArt.ts`（+ `.test.ts`） | `src/game/presentation/productCounterArt.ts`（+ `.test.ts`） |
| `tools/wrestler_art/counter_gate_recipe.json` | `tools/wrestler_art/counter_recipe.json` |
| `tools/wrestler_art/export_counter_gate.py` | `tools/wrestler_art/export_counter.py` |
| `tools/wrestler_art/tests/test_export_counter_gate.py` | `tools/wrestler_art/tests/test_export_counter.py` |

識別子の変更:

- `COUNTER_GATE_ART` → `PRODUCT_COUNTER_ART`
- `COUNTER_GATE_BODY_CORE_DIAMETER_PX` → `PRODUCT_COUNTER_BODY_CORE_DIAMETER_PX`
- `allCounterGateArts` → `allProductCounterArts`
- texture keyは `counter-gate-red/blue` → `product-counter-red/blue`
- exporterの `DEFAULT_GATE_DIR` / `--gate-dir` → `DEFAULT_COUNTER_DIR` / `--out-dir`
- 次は値も名前もそのまま: `counterVisualRotationOffset`、`COUNTER_VISUAL_MAX_ROTATION_RAD`、`selectWrestlerPoseArt`

履歴として残したもの:

- `counter_recipe.json` の `status`
- exporterのdocstring
- READMEのHistory
- SPEC §0

上の4か所に、08A / 08A1 / 08Bの `counter-gate` の経緯を書いた。現在の正本と二重にはなっていない。

# Mask（Counterだけの許容は維持）

- `counter_recipe.json` の `mask_limits.max_missed_px = 80` はそのまま
  - noteを「このCounterのsourceだけの、受理済みの狭い性質（全体の基準ではない）」に書き直した
- idle / Tsuppariの上限は60のまま（testで確かめている）
- 塗り替えのalgorithmと、共通の規則は変えていない

| 値 | 結果 |
|---|---|
| mask px | 1724 |
| missed | 70（上限80。うち69はalpha < 128の輪郭の縁） |
| fringe | 75（上限120） |

- 80を超えれば、引き続きfail closedで止まる
- 混入が無いことは、08A1でmaskの画像を目視して確かめた。pixelが同じなので変わらない

# 35°の動きを保つこと

`productCounterArt.ts` に、そのまま移した:

- `COUNTER_VISUAL_MAX_ROTATION_RAD = 35 · π / 180`
- `counterVisualRotationOffset = sign · sin(π · phaseProgress) · 35°`（red +1、blue −1）
- Counter以外では0

その他:

- `wrestlerVisualState.ts`（`progress(ticksRemaining, COUNTER_WINDOW_TICKS)`）は変えていない
- `WrestlerView` は、importとcommentだけを変えた
  - 体だけを `facing + offset` で回す
  - 影・位置・scaleは変えない
- 08Bのtest（曲線、35°、符号、0、Snapshot / facingは不変）は、すべて残してPASS

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| 受理済みgate → 恒久Productへの昇格 | `git mv` で、asset / module / exporter / recipe / testを恒久の名前へ移した | pixelとbyteのhashの一致（上の表）、`test_product_pixels_equal_the_accepted_counter_gate` |
| 恒久のruntime path | `public/assets/action/wrestler/counter/red.png` / `blue.png`（ちょうど2枚） | `test_exactly_two_files_from_the_one_red_pose`、TSの `two Product textures under counter/`、smokeのtexture読み込み |
| sourceの持ち主とhash | `counter_recipe.json` の `master`（pixel SHA-256 `5429d02f…`）。合わなければ止まる | `test_accepted_source_identity`、`test_missing_or_changed_source_fails_closed` |
| red → blueの導出 | local Y反射 + 共通のまわしの塗り替え（ruleはidle recipe） | `test_only_one_local_y_reflection`、`test_recolor_rule_is_owned_by_the_idle_runtime_recipe`、`test_red_is_the_normalized_pose_and_blue_its_reflected_recolor`（alpha、mask外が不変） |
| 受理済みpixelを保つ | 正規化の値もpivotも変えていない。byteが同じものを移した | `ACCEPTED_COUNTER_PIXELS`、`export_counter.py --check`、決定的な再実行 |
| Counterだけ `max_missed` 80 | recipeの値は維持、noteを更新。idle / Tsuppariは60 | `test_counter_only_missed_allowance`、`test_mask_limits_fail_closed`、`test_real_mask_covers_the_mawashi` |
| 明示したgeometry / pivot | `PRODUCT_COUNTER_ART`（210×207、(74, 115) / (74, 92)、123.076923） | `test_typescript_metadata_matches_the_export`、TSの `texture keys / paths are Product names; geometry …`、smokeのorigin = pivot |
| 35°の動きを保つ | 定数と関数をそのまま移した | TSの08Bのtest（曲線、35°、中間点、red / blueの符号、Counter以外は0、Snapshot / facingは不変）、smokeの観測値 |
| 一時的なgateの整理 | gateの名前、path、texture keyは、runtime / tool / testに残っていない | TSの `no temporary counter-gate runtime dependency remains`、smokeの「gate textureは0枚」、`counter-gate/` が無いことのtest |
| SPEC / ARCHITECTUREの更新 | SPEC §0に「Accepted: Counter / 引き・捌きのpose」を新設し、idle共通の記述の例外も直した。ARCHITECTUREの段落をProduct Counterに置き換えた | 文書の差分 |
| gameplayは不変 | `src/game/sumo`、`src/game/input` は差分0行 | `git diff b65ab9a -- src/game/sumo src/game/input` = 0行、sumoのtestは全PASS |

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_counter.py`（focused） | 17 tests OK |
| wrestler-art全suite | 168 tests OK |
| presentationのtest（`productCounterArt` / `wrestlerVisualState` などを含む） | 57 tests PASS |
| `pnpm test`（sumoのCounter / CounterTransitionのregressionを含む） | 23 files / 364 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter.py` の決定的な再実行 / `--check` | 再実行でbyteが同じ（red `a6128071…`、blue `3aa893ce…`）/ exit 0 |
| `export_runtime_wrestlers.py --check`（idle） / `export_tsuppari.py --check`（Tsuppari） | どちらもexit 0（idle / Tsuppariは不変） |
| `src/game/sumo/` / `src/game/input/` | `b65ab9a` から差分0行 |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ Chrome（CDP、GPU: ANGLE D3D11）
- 08Bのsmokeを、Productのtexture keyで実行した
- CPU redのCounterは、smoke scriptの中だけで `dummy.nextIntent` を一時的に包んで出した（ソースは変えていない）
- 結果: **28 / 28 PASS**

| 確認 | 結果 |
|---|---|
| Productの `product-counter-red/blue`（210×207）が読み込まれる。gateのtextureは0枚。Tsuppari / idleのsizeは変わらない | PASS |
| Enterで開始。ArrowDown → blueは全Counter frameで `product-counter-blue` | PASS |
| blueの回転（観測値）: −9.06 → −17.50 → −24.75 → −30.31 → −33.81 → **−35.00** → … → −9.06°（08Bと同じ） | PASS |
| red: `product-counter-red`。+9.06 → … → +33.81°でPushをBestで捕まえ、既存のCounterTransition（`active`）へ | PASS |
| pivotのまわりに回る。位置 = Snapshot center、scale 1.0、影 = facing、Snapshotのfacingは不変 | PASS |
| Counterの空振り → Fail / Kuzushi。Counter以外（CounterTransitionを含む）、Tsuppariは回転差0 | PASS |
| Tsuppariの左右はProductのまま。Push / Grip / 移動、R restart、console error / 失敗したrequestが無い | PASS |

screenshot（scratchpadの `smoke8/`、GPU）で、08Bと同じposeと回転を確かめた（`09_blue_early/peak/late`、`10_red_peak`、`11_after_red_counter`）。

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

NONE

# Known Untested Items

- 実機での最後のUser Regression Play Test

# Final User Regression Play Test: REQUIRED

pose・blueの版・35°の回転は、すでに受理済み。確認してほしいのは、昇格と整理で何も変わっていないことだけ:

- Counterのposeと、red / blueの見た目が同じか
- 35°の動きが同じか、Tsuppariと見分けられるか
- Success / Bestの遷移
- pivot / scaleの飛びや、gameplayの劣化が無いか

確認の手順:

1. `pnpm dev` → Enter → ArrowDown（blue）
2. CPUのPushをArrowDownで返す（dummy `2`）

# Git Delivery

- stageするのはTask-owned fileだけ。commit `refactor(art): promote counter product pose` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `input.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
