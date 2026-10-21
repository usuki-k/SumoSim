Task-ID: ART-WRESTLER-04A-IDLE-MIRROR-WORKFLOW-VALIDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 8ffadc83167c917bdc54a97f052e9f9d5988142b
Agent-Start-Head: 7b635496b3a4d083f5e5db90ca11d05d676f720d
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（技術的な検証のみPASS。User Visual Gateは未実施）。

- 1枚のidle masterから、反転とまわしの決定的な塗り替えで相手側を作るpreview toolを足し、blue master / red masterの両方でpreviewを作った
- 前提の扱い
  - 以前の「blueとredは別々に描き、反転しない」という制約は、Userが再検討を許可した
  - 反転の方式は **Candidate / Pending User Visual Gate**
  - runtimeの基準（assets、metadata、WrestlerView、Simulation）は、何も変えていない
- 技術的には、両方のmasterとも成立した
  - FRONT / pivot / body-coreの約束を保てる
  - 塗り替えはまわしの中だけで、外の画素は反転しただけの画像と完全に一致する
- 見た目の採否はUserが判断する

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `8ffadc8`（ancestor）、Handoff-Mode GITHUB
- `8ffadc8..origin/develop`、HEAD → `origin/develop` の変更は、どちらも `CURRENT_TASK.md` のみ → `merge --ff-only` → `7b63549`

# Source Files Inspected

- `AGENTS.md`、`CLAUDE.md`、`CURRENT_TASK.md`、前回のCompletion Report
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（§0）、`docs/ARCHITECTURE.md`
- `tools/wrestler_art/` のREADME、`preview_dual_rigid_wrestlers.py`、`preview_single_wrestler.py`、`export_runtime_wrestlers.py`、`dual_rigid_recipe.json`、`tests/`
- `src/game/presentation/productWrestlerArt.ts`、`src/game/scenes/WrestlerView.ts`

# Mirror / Reflection Transform

- **local frameのX軸についての反射**: `(x, y) → (x, H − y)`（正規化した画像の上下反転）
  - local +X = FRONT（画像の右）は、そのまま。左右反転（screen-spaceのflip）ではない
  - local ±Y（力士の右 / 左）だけが入れ替わる。頭・手・足の左右の寄りが逆になる
- pivotとbody-coreの点も同じ写像: `(px, py) → (px, H − py)`
  - 既存の `assemble_wrestler.mirror_part` を再利用した
- runtimeは、これまでどおり「pivotを正本の位置に置き、facingでsprite全体を回す」。第2の向きの約束は作らない
- 画像の寸法は同じ。body-coreの長さは同じ（123.076923 px）なので、表示scale（`2·bodyRadiusPx / bodyCoreDiameterPx`）も同じ

# Recolor / Mask Method

- **マスク**（recipeの `recolor.*`）
  - 条件: alpha > 8、色相が元のまわしの帯にある、彩度・明度の下限以上
    - blue: 190〜250°、s ≥ 0.3、v ≥ 0.06
    - red: 330〜4°、s ≥ 0.5、v ≥ 0.06
  - さらに、**最大の4連結成分** に限る（体の輪郭に乗った色味の画素を除く）
- **塗り替え**（マスクの中だけ）
  - 色相 → 目標の値（blue → red: 358.2°、red → blue: 215.8°）
  - 彩度 × 1.0
  - 明度 → `v × gain + offset`（blue → red: ×1.409 + 0.070、red → blue: ×0.7095 − 0.0497。0〜1でclamp）
  - alphaは変えない
  - 目標の値は、authoredの相手側のまわしを測ったもの。明度は、元のp10 / p90が相手のp10 / p90に移る一次式
- マスクの外は、反転しただけの画像のまま（byte一致をtestで確認）
- 依存: Pillow + 標準の `colorsys` のみ（NumPy / OpenCV / MLは使わない）。手で塗ってはいない

**塗り替えの結果**（`idle_mirror.json`）

| | マスクの画素 | 平均の色相 | 明度 p10 / p50 / p90 | 相手（authored） |
|---|---|---|---|---|
| red（blueから） | 2550 | 358.18° | 0.318 / 0.729 / 0.855 | 358.19°、0.318 / 0.686 / 0.855 |
| blue（redから） | 2196 | 216.04° | 0.177 / 0.435 / 0.557 | 215.78°、0.177 / 0.467 / 0.557 |

- 縁の残り: マスクに入らず、元の色相が少し残った境界の画素（肌とのアンチエイリアス）
  - blue → red: 113画素、red → blue: 67画素
  - 1 px幅の縁。拡大したdiagnosticsでは確認できるが、runtimeのサイズで目立つかはUserの判断（Known Untested）
  - 混ざりをなくすためにマスクを広げると、肌を塗ることになるので、行っていない
- 肌・髪・体への混入: マスクの外は不変（test）。マスク内の全画素は、元の色相帯・彩度の条件を満たす（test）

# Master Candidates Tested

- **blue master** → 派生のred（authored blue + 派生red の組）
- **red master** → 派生のblue（派生blue + authored red の組）

# Preview Output Paths（`tools/wrestler_art/output-idle-mirror.local/`、git-ignored）

| file | 内容 |
|---|---|
| `idle_mirror_comparison.png` | A: authored blue、authored red、派生red（blueから）、派生blue（redから）。local frame、pivot中心、体の円R |
| `derived_red_from_blue_rotations.png`、`derived_blue_from_red_rotations.png` | B: 0 / 45 / 90 / 180 / 270° |
| `idle_mirror_faceoff_arena.png` | C: 3組（authored / blue master / red master）× 4配置（開始4R、接触の直前2.05R、斜め2.8R・30°、横2.8R・64°）。Product arena |
| `diagnostics_blue_master.png`、`diagnostics_red_master.png` | D: 元の画像、反転のみ、まわしのマスク、反転 + 塗り替え、pivot / body-core / +X |
| `derived_red_from_blue.png`、`derived_blue_from_red.png` | 派生sprite（runtimeのサイズ） |
| `idle_mirror.json`、`build_idle_mirror_manifest.json` | metadataとhash（timestampなし） |

- E（任意の動きのGIF）は作っていない（必須ではなく、静止画のA〜Dで判断できるため）

# Blue-master vs Red-master Comparison

- 技術的には同等
  - どちらもFRONT / pivot / body-coreが成立し、マスクはまわしの連結成分1つ
  - 縁の残りは、red master（67）の方がblue master（113）より少ない
- Agentが目で見た所見（判断ではない）
  - どちらの派生も、相手側のauthoredと同じ側（頭が+Y側か−Y側か）に頭・手・足が来る
    - 向かい合い（開始 / 接触の直前）で、頭が中央に寄り合う構図は、authoredの組と同じに見える
  - 派生の組は、**左右対称の「同じ絵の力士2人」** になる
    - authoredの組の「別の体格・別の描き方」の違いはなくなる（同じ人物の色違いに見える）
  - blue master: authored blueの方が、やや小柄で丸い体型。派生redも同じ体型になる
  - red master: authored redの方が、やや大柄。派生blueも同じ
  - 光と陰影: 反転しても、描き込まれたハイライトの向きが上下で入れ替わるだけ
    - 画面上で回転して使うspriteなので、もともと光の向きは体と一緒に回る（02B / 03Aで受け入れ済み）
    - 目立つ光の逆転は、Agentには見えない
  - 結び目: 背中（−X）のまま。反転で、上下の寄りだけが入れ替わる。不自然には見えない
- 推奨: **EITHER（技術的にはどちらでも可）。最終的な見た目の選択はUserの判断**
  - 縁の残りが少ない点ではred master、元の画像の小ささ（runtimeの画像が167×181）ではblue masterが、わずかに有利
  - 決め手になる差ではない

# Pivot / Body-core Evidence

| | 寸法 | pivot | body-core |
|---|---|---|---|
| authored blue | 167×181 | (84, 87) | 123.076923 |
| authored red | 158×178 | (82, 95) | 123.076923 |
| 派生red（blueから） | 167×181 | (84, 94) = (84, 181 − 87) | 123.076923 |
| 派生blue（redから） | 158×178 | (82, 83) = (82, 178 − 95) | 123.076923 |

- recipeの寸法 / pivot / body-coreは、`productWrestlerArt.ts` と一致する（test）
- 派生のpivotは `(x, H − y)`。FRONTの範囲（不透明部分のx方向の範囲）は、元と同じ（test）
- 回転のpreviewと土俵上の向かい合いは、どちらも体の円の中心 = pivot。runtimeの位置や大きさの跳びは、仕組み上起きない

# Deterministic Output Evidence

- 同じ入力とrecipeで2回実行した。**出力の10 fileすべてが、byte単位で一致**（`cmp`）
- testでも、2回のbuildのmanifest / jsonが一致することを確認した
- 出力の画素のSHA-256（manifestより）
  - `derived_red_from_blue.png` 167×181 `3ed0aafb9a26196a36da844bf05b0e1aff82abbfc49e5d61bedacfd1dce2decd`
  - `derived_blue_from_red.png` 158×178 `9d5feead362870543d2bc0d54517dc2b67318b817afd60ed9748c3d3b155a2a6`
  - `idle_mirror_comparison.png` `0c7a17b0…`、`idle_mirror_faceoff_arena.png` `82b379a6…`
  - `diagnostics_blue_master.png` `d848f546…`、`diagnostics_red_master.png` `ee6b42ab…`
  - `derived_red_from_blue_rotations.png` `56e06d78…`、`derived_blue_from_red_rotations.png` `2a3a9fd6…`

# Focused Test Results

`tests/test_preview_idle_mirror_workflow.py`: **14 tests OK**
- 反射: FRONTを保つ、pivotとbody-coreの写像、長さが不変
- マスク: 帯の最大成分だけを選ぶ（合成画像。肌・髪・離れた色味の点を除く）
- 塗り替え: マスクの中だけを変える、alphaを保つ、決定的
- 実際のasset
  - recipeとTSのmetadataが一致する
  - マスクの外の画素が、反転しただけの画像と一致する
  - マスクの画素がすべて元の帯にある
  - pivot / FRONT / scaleが保たれる
  - 塗り替え後の色調が、相手のauthoredに合う（色相 < 1°、p10 / p90 ±0.02）
  - runtimeのassetが読み取り専用（hashが不変）
  - buildが決定的
  - 出力が揃う
- fail-closed: runtime spriteの画素が違うとexit 2、recipeが不正、出力はgit-ignored

# Existing wrestler_art Suite

`python -m unittest discover -s tools/wrestler_art/tests`: **121 tests OK**（既存107 + 新規14）

# Files Changed

- `tools/wrestler_art/preview_idle_mirror_workflow.py`（新規）
- `tools/wrestler_art/idle_mirror_recipe.json`（新規）
- `tools/wrestler_art/tests/test_preview_idle_mirror_workflow.py`（新規）
- `tools/wrestler_art/README.md`（節を追加）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Files Explicitly NOT Changed

- `public/assets/action/wrestler/blue.png`（file SHA `cf61c777…`、変わらず）、`red.png`（`147dda89…`、変わらず）
- `src/` のすべて（`productWrestlerArt.ts`、`WrestlerView.ts`、`BoutScene.ts`、Simulation、input）
- `preview_dual_rigid_wrestlers.py`、`dual_rigid_recipe.json`、`export_runtime_wrestlers.py`、既存のtest
  - dualのpathの「反転なし」のtestは、そのまま有効
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（反転を承認済みとは書いていない）、`CURRENT_TASK.md`
- TypeScript / runtimeのfileを変えていないので、`pnpm test` / `pnpm build` は実行していない

# Answers to the Investigation Questions

1. 反射 + 塗り替えで相手側を作れるか: 技術的には可能。見た目の承認はUser
2. どちらのmasterがよいか: 技術的には同等（EITHER）。上の比較を参照
3. 反転による問題: 髷・手足・肩・結び目・光の、明らかな破綻は、Agentには見えない。最大の変化は、「別人の2人」が「左右対称の同じ人の色違い」になること
4. 回転: 0 / 45 / 90 / 180 / 270°で、pivotと体の円は安定している
5. 向かい合い: 開始 / 接触の直前 / 斜め / 横の4配置を、Product arenaで作った（判断はUser）
6. 塗り替えの決定性と陰影の保持: 決定的。明度の並びを保つ一次式で、陰影の構造は残る
7. まわしに限れるか: 限れる（マスクの外は不変）。ただし1 px幅の境界の残り（113 / 67画素）がある
8. pivot / scale: 変わらない。gameplayとruntimeの位置にも影響しない
9. 制作の負担
   - これからのposeの画像（例: 突っ張り）は、1人分を描けば、もう1人は反転 + 塗り替えで作れる
   - 別々に生成すると「同じ人物として描き分ける」必要があるので、その分の生成と確認が減る
10. 採用する場合の推奨workflow
    - master 1枚（各pose）を描く
    - 既存の決定的な正規化（FRONT = +X、pivot、body-core = 2R）
    - 本toolの反射 `(x, H − y)` + まわしの塗り替え（recipeに帯と目標の値）
    - exporterで2枚を書き出す（`productWrestlerArt.ts` のmetadataは、派生側のpivotを `(x, H − y)` にする）
    - 既存の「反転なし」のtest / SPEC §0を、そのときに置き換える

# Recommendation

**EITHER**（blue master / red masterのどちらでも、技術的には成立する）。

- 反転の方式を採用するか、どちらのmasterにするかは、previewを見てUserが決める（**USER VISUAL DECISION REQUIRED**）
- 反転の方式を採用する場合、Agentは次のどちらかを判断材料として挙げる
  - 縁の残りが少ないred master
  - 体型の好みで選ぶ

# User Visual Gate

**REQUIRED。** 確認してほしい点:
- 派生の組が「同じart familyの2人」に見えるか（「左右対称の色違い」で問題ないか）
- 解剖・髷・手足・結び目に、不自然な点がないか
- 光の逆転が気にならないか
- まわしの縁の1 px幅の残りが、runtimeのサイズで目立たないか
- 回転と向かい合いで、自然に見えるか
- blue masterとred masterのどちらがよいか

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- なし
- runtimeとSPECは変えていない。dualのtool / testの「反転なし」の記述も、そのまま残した（採用が決まったら、別のTaskで置き換える）

# Known Untested Items

- User Visual Gate（見た目の採否、masterの選択）
- runtimeのサイズでの、まわしの縁の残り（113 / 67画素）の見え方
- 任意のE（動きのGIF）は作っていない
- 実機のGPUでの表示（previewはPillowで描いた静止画）

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`test(art): validate mirrored idle wrestler workflow`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- previewの出力（`*.local`）はcommitしない
- `main` と `CURRENT_TASK.md` は変更しない
