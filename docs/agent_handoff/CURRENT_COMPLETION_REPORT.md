Task-ID: ART-WRESTLER-04B-RED-MASTER-RUNTIME-PROMOTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 89b1e7c86402229d0489849637b7920f8560d8df
Agent-Start-Head: 3bea9ca9bed738d00f825b0eb39f332d22a2056f
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Runtime Smoke PASS。User Visual Checkは未実施）。

- runtimeのidle wrestlerを、**red master 1枚** の方式に移した
  - `red.png`: 正規化したred master。**byteも含めて従来と同一**
  - `blue.png`: そのredを反射して、まわしを塗り替えたもの。**04Aで承認された候補と、画素が同一**
- exporterは、redのsourceだけで書き出し / 照合できる。別に描いたblueのsourceは不要
- `productWrestlerArt.ts` のblueのmetadataを、書き出しの結果に合わせて更新した
- SPEC §0とARCHITECTUREを、現在の方式に合わせた
- Simulation / gameplay / Scene / WrestlerViewは変更していない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `89b1e7c`（ancestor）、Handoff-Mode GITHUB
- `89b1e7c..origin/develop`、HEAD → `origin/develop` の変更は、どちらも `CURRENT_TASK.md` のみ → `merge --ff-only` → `3bea9ca`

# Current Source Delta

- 新規 `tools/wrestler_art/runtime_wrestler_recipe.json`: 現在の唯一の正本
  - `master`: red（source identity、向き、root、body-core）
  - `derived`: blue（`reflection: local_y`、`recolor` = 04Aの `red_to_blue`）
- `export_runtime_wrestlers.py`
  - このrecipeだけを読む
  - red: 03Aの正規化 → ちょうど1/4に縮小
  - blue: そのred runtimeに `im.derive`（04Aの反射 + マスク + 塗り替えの実装そのもの）
  - blueのsourceは読まない
  - `--check` は書き込まずに照合する
- `preview_idle_mirror_workflow.py`（04A、履歴 / 比較用に変更）
  - `red_to_blue` の規則を、runtime recipeから読む
  - 「別に描いたblue / red」は、ローカルの03A sourceから作り直す（runtimeのblueは、もう別に描いたものではないため）
- `idle_mirror_recipe.json`: 自分の `red_to_blue` と `sprites` を削除し、`runtime_recipe` への参照と、履歴の `blue_to_red` だけを残した
- `productWrestlerArt.ts`: blueのwidth / height / pivotと、説明のコメント
- `public/assets/action/wrestler/blue.png`: 書き出しで置き換え（`red.png` はbyteが同一なので、gitの差分なし）
- docs: SPEC §0、ARCHITECTURE、tool README
- test: export / 04A / TS metadataのtestを更新・追加

# Final Recipe / Source-of-Truth Ownership

| 内容 | 正本 |
|---|---|
| masterはred（source identity、向き、root、body-core、2R） | `runtime_wrestler_recipe.json` の `master` |
| 反射の規則 `(x, y) → (x, H − y)` | `runtime_wrestler_recipe.json` の `derived.reflection: local_y`（実装は `assemble_wrestler.mirror_part`） |
| blueのまわしのマスク / 目標の値 | `runtime_wrestler_recipe.json` の `derived.recolor`（1か所だけ） |
| マスク / 塗り替えのアルゴリズム | `preview_idle_mirror_workflow.py` の `mawashi_mask` / `recolor` / `derive`（exporterとpreviewが共有） |
| runtimeのpivot / body-core | exporterの出力（反射で導く）→ `productWrestlerArt.ts`（testで一致を強制） |

- `idle_mirror_recipe.json` は、`red_to_blue` を持たない（testで確認）
- 履歴の `dual_rigid_recipe.json` には、red masterと同じ正規化の値が残っている（03Aのpreview用）
  - runtime recipeと一致することをtestで強制し、ずれないようにした
  - runtimeの書き出しは、`dual_rigid_recipe.json` を読まない

# Red Master Export Path

- `input.local/wrestler_red.png`
  - 1254×1254 RGBA、pixel SHA `a212dbfe…`
  - 照合: 寸法、alpha、decoded RGBA pixel SHA-256
- → 1回の全体の回転（source front 160.7°）、root (648, 609)、body-core (522,251)–(731,847) = 2R
- → master × 4 → ちょうど1/4に縮小 → `red.png`

# Blue Derivation Path

1. 正規化したred runtime（158×178、pivot (82,95)）
2. local X軸についての反射 `(x, y) → (x, H − y)`（`FLIP_TOP_BOTTOM` 1回だけ。左右の反転はしない）
3. pivotとbody-coreを同じ写像で移す
4. まわしのマスク: 色相 330〜4°、s ≥ 0.5、v ≥ 0.06、最大の4連結成分
5. マスクの中だけ塗り替える: 色相 → 215.8°、彩度 × 1.0、明度 × 0.7095 − 0.0497。alphaは変えない
6. `blue.png`

# Generated Dimensions / Pivots / Body-core

| file | 寸法 | pivot | body-core |
|---|---|---|---|
| `red.png` | 158×178 | (82, 95) | 123.0769 |
| `blue.png` | 158×178 | (82, 83) = (82, 178 − 95) | 123.0769 |

（以前のblueは167×181、pivot (84, 87)。`productWrestlerArt.ts` を、書き出しの結果に合わせて更新した）

# Old vs New Runtime Asset Hashes

| file | 以前 file / pixel | 今回 file / pixel |
|---|---|---|
| `red.png` | `147dda89…` / `d66895bf…` | `147dda89…` / `d66895bf…`（同一） |
| `blue.png` | `cf61c777…` / `bbd34593…`（03Aの別に描いたblue） | `feb3223f0eb0f0f1d526ce5faabb914992ce4be76f872e1b5f453c3338f43566` / `9d5feead362870543d2bc0d54517dc2b67318b817afd60ed9748c3d3b155a2a6` |

# Proof Red Did Not Visually Change

- 新しいexporterで、redのsourceだけから書き出したred.pngは、commit済みのred.pngと **file SHAが同一**（`147dda89…`）
  - gitも変更なしと判定した
- test `test_red_pixels_unchanged_and_blue_is_the_accepted_candidate` で、pixel SHA `d66895bf…` を固定した

# Proof Blue Matches the Accepted Derived Candidate

- 04Aのpreviewの `derived_blue_from_red.png` の画素 = `9d5feead…`。新しいruntimeの `blue.png` の画素 = `9d5feead…`（同一）
- 04Aのpreviewは今回もローカルのsourceから同じ値を再現した（test `test_red_master_branch_is_the_runtime_blue`）
- マスク 2196画素、縁の残り 67画素は、04Aの診断と同じ（test）

# Tests

- Python（`tools/wrestler_art/.venv/Scripts/python -m unittest discover -s tools/wrestler_art/tests`）: **125 tests OK**（以前は121）
  - `test_export_runtime_wrestlers.py`（14件。作り直し）
    - redが唯一のsourceで、blueのsourceが無くても成功する
    - redが無い / 画素が違うと失敗する
    - recipeはred masterとlocal-Yを要求する
    - 書き出しが決定的
    - `--check` は書き込まず、red / blueの変更を検出する
    - blueは、反射したredでまわしだけを変えたもの（寸法、pivot、body-core、FRONTの範囲、alpha、マスクの外は一致）
    - 使う変換は `FLIP_TOP_BOTTOM` 1回だけ（左右反転なし）
    - dual recipeのredが、runtime masterと一致する
    - 実際のasset: redのsourceだけで照合できる、redの画素が不変、blueが承認済みの候補、マスク / 縁が不変、TSのmetadataと一致、寸法とpivot
  - `test_preview_idle_mirror_workflow.py`（15件）
    - 合成画像のtest
    - `red_to_blue` の正本が1つ
    - 履歴の比較（ローカルのsourceがあるとき）: previewのblue = runtimeのblue、runtimeは読み取り専用、決定的
    - ローカルのblue sourceが無いときのfail-closed、recipeが不正なとき
  - 既存のtest（02A / 02B / 03A）はすべてPASS（03Aのdualのpathの「反転なし」のtestも、そのまま有効）
- `pnpm test`: **PASS — 20 files / 293 tests**（`productWrestlerArt.test.ts` に「blue = redの反射」のtestを追加、originの期待値を更新）
- `pnpm build`: **PASS**（chunkの大きさの警告は、以前からあるPhaser由来のもの）
- `git diff --check`: **PASS**

Taskの必須22項目との対応:
- 1・2: `test_red_is_the_single_source_and_no_blue_source_is_needed`、実際のassetのclass（redだけをコピーした入力で照合）
- 3・4: `test_committed_red_and_blue_match_a_red_only_fresh_export`
- 5・6: `test_red_pixels_unchanged_and_blue_is_the_accepted_candidate`、`test_red_master_branch_is_the_runtime_blue`
- 7・19: `test_deterministic_export`
- 8: `test_check_writes_nothing_and_detects_changes`
- 9・10: `test_invalid_red_source_fails`、`test_missing_red_source_fails`
- 11〜13・16・17: `test_blue_is_the_reflected_red_with_mawashi_recolor_only`、`test_no_screen_space_flip`
- 14・21: `test_runtime_metadata_matches_typescript_contract`、TSの「blue = redの反射」test
- 15: TSのpivotは書き出しの値そのまま。`WrestlerView` は変更していない（offsetなし）
- 18: `test_accepted_mask_and_fringe_unchanged`
- 20: Browser smoke（両方のtextureが200で読み込まれた）
- 22: `src/game/sumo` などgameplayのfileは変更なし（下記）

# Browser / Runtime Smoke

**PASS**（headless Chrome + CDP。`step` を読むだけのwrapperで包む方法は、04A4と同じ）。

- `blue.png` / `red.png` / arenaは200。実行時のerrorなし（favicon.icoの404のみ。以前から）
- Enter → Bout。dummyのPushにBestのCounter: `counterTransition` が90 tickで完了
  - 完了直後のShiftでMorozashi
  - Rで、比較表示へ戻り、ongoing
- 派生のblueは、青いまわしで表示された。pivotはdebugの接触円の中心と一致し、facingで全体が回る
- 向かい合いの構図は、04Aの承認済みpreview（red master）と同じ
- headlessで動いているspriteの一部の三角形が崩れて写る現象は、04A4で、変更前のコードでも再現することを確認済みの既知の事象
  - 今回も遷移の途中のコマに写った。停止後のコマでは、2人とも正常

# User Visual Check Required

**Required**。実際のPhaserで確認してほしい点:
- red / blueの向かい合いが、承認したpreviewと同じか
- 派生のblueに、大きさやpivotの跳びがないか
- 青いまわしが自然か
- 回転が自然か
- textureのfilteringなどの新しい不具合がないか

問題がなければ、red masterの方式が統合済みのProduct baselineになる。

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| redが唯一のmaster | `runtime_wrestler_recipe.json` の `master.key = red`。exporterはこのsourceだけを読む | red-onlyの入力でのtest、実際のassetの照合 |
| 別に描いたblue sourceは不要 | exporterは `wrestler_blue.png` を読まない | 入力ディレクトリにredだけを置いたtest / 照合 |
| 反射の約束 | `local_y`: `(x, y) → (x, H − y)`、FRONTは不変 | `FLIP_TOP_BOTTOM` 1回だけ、pivot / 点の写像、FRONTの範囲 |
| まわしの塗り替えの正本 | runtime recipeの `derived.recolor`（1か所）。アルゴリズムは04Aの関数を共有 | 正本が1つのtest、マスクの外は一致 |
| redの画素を保つ | 同じ正規化。file / pixel SHAとも同一 | SHAの比較、test |
| 派生のblue | 04Aの候補と画素が同一（`9d5feead…`） | test、previewとの一致 |
| pivot / body-coreのmetadata | blueは158×178、(82,83)、123.076923 | TSのmetadataのtest ×2 |
| 決定的な書き出し / 照合 | 一時ディレクトリへ原子的に書く。`--check` は書かない | test |
| runtimeのpresentationは不変 | `WrestlerView` / `BoutScene` は未変更。texture key / pathも同じ | git diff、smoke |
| gameplayのsourceは未変更 | `src/game/sumo` / input / scenesは未変更 | git diff（下記） |

# Changed Files

- `tools/wrestler_art/runtime_wrestler_recipe.json`（新規）
- `tools/wrestler_art/export_runtime_wrestlers.py`
- `tools/wrestler_art/preview_idle_mirror_workflow.py`
- `tools/wrestler_art/idle_mirror_recipe.json`
- `tools/wrestler_art/tests/test_export_runtime_wrestlers.py`
- `tools/wrestler_art/tests/test_preview_idle_mirror_workflow.py`
- `tools/wrestler_art/README.md`
- `public/assets/action/wrestler/blue.png`
- `src/game/presentation/productWrestlerArt.ts`
- `src/game/presentation/productWrestlerArt.test.ts`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（Status、§0、§0の履歴、§11の03Aの記録に「04Bで撤回」）
- `docs/ARCHITECTURE.md`（Product力士artの1項目）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Files Explicitly Not Changed

- `public/assets/action/wrestler/red.png`（byteが同一。gitの差分なし）
- `src/game/scenes/WrestlerView.ts`、`BoutScene.ts`、`src/game/sumo/**`、input、HUD、arena
- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`、`dual_rigid_recipe.json`、`preview_single_wrestler.py`、`assemble_wrestler.py`
- `CURRENT_TASK.md`、`main`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- 04Aのpreview toolは、commit済みのruntimeのblue（別に描いたもの）を入力にしていた
  - そのblueがこのTaskで置き換わるため、ローカルの03A sourceから作り直す形に変えた（履歴 / 比較用。Taskの「historical tools may use the old blue source when available」に沿う）
  - そのため、04Aの比較testは、ローカルのsourceが無い環境ではskipする
- 履歴の `dual_rigid_recipe.json` に、red masterと同じ値が残る
  - 03Aのpreview用に残し、testで一致を強制した
  - これをruntime recipeへの参照に変えるのは、03Aのtoolの変更になるので行っていない

# Known Untested Items

- User Visual Check（実際のPhaserでの見た目）
- 実機のGPUでの表示（smokeはSwiftShaderのheadlessのみ。headlessの既知の描画の崩れあり）
- 以前のTaskから引き継いだ未確認の項目は、変わらず残っている（このTaskの範囲外）

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`refactor(art): derive blue wrestler from red master`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- previewの出力（`*.local`）とローカルのsourceはcommitしない
