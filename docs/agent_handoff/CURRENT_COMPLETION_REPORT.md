Task-ID: ACTION-07C1-TSUPPARI-RIGHT-POSE-REFRESH
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: e30d6b407c3c98f086f4765a0847f3f74038fe0f
Agent-Start-Head: e01d75ad130412bef2680595cf679068743da416
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 47 / 47 PASS。新しいright poseが見た目として良いかは、User Visual Gateで判断する）。

- red right Tsuppariの候補を、Userが差し替えた新しい画像に入れ替えた
- 07Cと同じ方法で測り直して正規化し、red-right由来の6枚のruntime textureを作り直した
- red-left、SEPARATEのblue-right、MIRROR-Lの4枚、idleの `red.png` / `blue.png` は、pixelもPNG byteも変わっていない
- 打突の向き（pivotから一番遠い不透明画素の方向。FRONTから測る）は、**46.1° → 27.8°** になった。旧候補より前向き
- gameplay（`src/game/sumo/`、`src/game/input/`、`src/game/scenes/`）の差分は0行

```
SEPARATE is still a User preference, not yet promoted to permanent Product baseline.
```

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `e30d6b4`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `e30d6b4..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `e01d75a`

## Local input（`tools/wrestler_art/input.local/`、commitしない）

| file | file SHA-256 | decoded RGBA pixel SHA-256 | 07Cとの比較 |
|---|---|---|---|
| candidate_red_tsuppari_right.png（新） | `8f255caa95842483f1d8893e4a1616db55a6f299a950c89bf4106c19e1e25ea5` | `3db3260bc3d90a88694bb65959c83919f148985847c4575c104394261e92cace` | **変更あり**（旧 `d0e6070e…d33b`） |
| candidate_red_tsuppari_left.png | `24a00ca6…b917af` | `219d66dc…cb84b3` | 同じ |
| candidate_blue_tsuppari_left.png | `1b476336…5f2b` | `060bfbf4…8e77` | 同じ |
| candidate_blue_tsuppari_right.png | `b5a9d8ef…9345` | `17782b11…1071` | 同じ |

- 新しいrightも1254×1254のRGBA
- `input.local/` にある `candidate_red_tsuppari_right_backup1.png` は、旧07C rightとpixelが同じ（`d0e6070e…`）。runtimeでは使っていない。下の測定方法の校正にだけ使った

# Red-Right Normalization（新）

方法は07Cの `measurement` と同じ:

- 髪の重心Hとまわしの重心Bを使い、承認済みのidle red masterに合わせる
- 回転差、scale `s`、idleのroot / body coreを `s·Rot` で運ぶ
- `source_front_deg` = 160.7 + 回転差

## 測定方法の再現について

07Cの測定scriptはcommitされていなかった。そこで、recipeに書かれた手順から測定を組み立て直した。

- まわしの値: 07C値と完全に一致（idle、left、旧rightのすべて）
- 髪の値: 書かれた通りの「7 px erosion」だけでは、07Cの面積に届かなかった
  - 「1/2 BOX縮小、max(RGB) < 80、alpha > 200、7 px opening（erosionの後にdilation）、最大成分」が最も近かった
  - idleの基準も同じ方法で測り直した。結果は (428.7, 542.7)、42652 px
- 校正: 旧rightに同じ方法を使うと、07Cの値がほぼ再現できた
  - 回転差: −0.617（07Cは −0.611）
  - s: 1.0093（同じ）
  - front: 160.1（同じ）
  - root: (768, 641)（07Cは (768, 640)。1 source px = 0.25 runtime pxの差）
  - body core: (637, 281)–(854, 880)（同じ）
- leftの差も、どの点でも1 source px以内だった

正規化のalgorithm（`export_tsuppari_gate.py` / `ps.normalize_sprite`）は変えていない。recipeの `red_right` の値だけを更新した。red-leftの値とsource identityは変えていない。

| 項目 | 旧07C right | 新07C1 right |
|---|---|---|
| hair centroid / px | (557.5, 576.5) / 42680 | (590.2, 628.8) / 48696 |
| mawashi centroid / px | (989.3, 593.7) / 57884 | (1051.9, 628.9) / 66208 |
| 回転差 | −0.611° | −2.885° |
| scale s | 1.0093 | 1.0778 |
| source_front_deg | 160.1 | **157.8** |
| root_source_px | (768, 640) | **(818, 688)** |
| body_core_source_px | (637, 281)–(854, 880) | **(663, 310)–(920, 940)** |
| runtime size / pivot | 197×205 / (79, 88) | **209×167 / (79, 87)** |

- 新しい画像は、旧画像より体が大きく描かれている（s = 1.078）。そのため、body coreを2Rに合わせると、旧画像より縮小率が大きくなる
- body coreとfront軸の直交check、clipのcheck、body core 123.0769 pxは、どれもPASS
- hand: 腕を伸ばしているのは画面上側の手。正規化した後は+Y、つまりwrestlerのRIGHTになる（`hand_evidence` は07Cと同じ）

# Runtime Gate Textures（`public/assets/action/wrestler/tsuppari-gate/`）

## 変わった6枚（どれもred-right由来）

| file | 由来 | size | pivot | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|---|
| separate_red_right.png | red_right | 209×167 | (79, 87) | `c576134a69f41c641a61a8fbe4d0d350aa04a4510458ed0acafba2b8f16bcae7` | `03747e92…d23f` |
| mirror_r_red_right.png | red_right | 209×167 | (79, 87) | `c576134a…cae7`（separate_red_rightと同じ） | `03747e92…d23f` |
| separate_blue_left.png | red_right反転 + mawashi recolor | 209×167 | (79, 80) | `8389fbca13754273f7b166cfa29099b283219b61bed03dd40a7cb90d800e9e84` | `43f26f5a…3ef8` |
| mirror_r_blue_left.png | red_right反転 + mawashi recolor | 209×167 | (79, 80) | `8389fbca…9e84`（separate_blue_leftと同じ） | `43f26f5a…3ef8` |
| mirror_r_red_left.png | red_right反転 | 209×167 | (79, 80) | `898c41fc00832bf17989e0cc07dbff369df1aff5e900d587395570837de0778f` | `729b9946…475d` |
| mirror_r_blue_right.png | red_right + mawashi recolor | 209×167 | (79, 87) | `bf4fc4abd503e5a1237b724bdd5ee0c5a57ac39edc7224ea7bef94d1763750e1` | `398ea7db…4599` |

## 変わっていないことを確かめた6枚と、idleの2枚

export前とexport後で、pixel SHA-256とfile SHA-256の両方が一致した。

| file | pixel SHA-256 |
|---|---|
| separate_red_left.png | `ab5043bf…2f3f` |
| separate_blue_right.png | `c9369b4b…b1ef` |
| mirror_l_red_left.png | `ab5043bf…2f3f` |
| mirror_l_red_right.png | `b5ee0bfb…0833` |
| mirror_l_blue_left.png | `11625cc7…b194` |
| mirror_l_blue_right.png | `c9369b4b…b1ef` |
| idle red.png | `d66895bf…cdaa` |
| idle blue.png | `9d5feead…a2a6` |

`src/game/presentation/tsuppariGateArt.ts` では、変わった6件のsize / pivotだけを更新した。

# Recolor / Mask（新red right）

承認済みのrecolor ruleは変えていない（ruleの持ち主は `runtime_wrestler_recipe.json`）。

| pose | mask px | missed band px（上限60） | fringe px（上限120） |
|---|---|---|---|
| red_right（新）/ 反転 | 2276 | 11 | 67 |
| red_left / 反転（不変） | 2239 | 17 | 48 |

- `mawashi_mask_diagnostics.png` を目視した。maskはまわしの帯だけにかかっていて、skin、hair、腕への混入はない
- recolor後のHSV: mean hue 216.0°、sat 0.867
- 「alphaが変わらない」「mask外の画素が変わらない」は、既存のtest（`test_geometry_and_recolor_per_variant`、`test_real_masks_cover_the_mawashi`）でPASSした

# Offline Preview（`tools/wrestler_art/output-tsuppari-gate.local/`、git-ignored）

既存のtoolでまとめて作り直した:

- `pivot_guide_red_right.png`（新）と、ほかのpivot guide 3枚
- `mode_separate / mode_mirror_l / mode_mirror_r.png`
- `idle_tsuppari_alignment.png`: 新rightとSEPARATE blue-leftの体は、idleのoutlineと重なっている。中心やscaleの飛びは見えない
- `rotations_*.png`、`faceoff_*.png`（0.70 m / 0.875 m）
- `mawashi_mask_diagnostics.png`、`blue_reference_vs_derived.png`、`tsuppari_gate.json`、`build_tsuppari_gate_manifest.json`

MIRROR-Lのsheetも作り直したが、元になるtextureはpixelが変わっていない。

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_tsuppari_gate.py`（focused） | 19 tests OK |
| wrestler-art全suite | 144 tests OK |
| `export_tsuppari_gate.py --check` | exit 0（12枚。pixelもbyteも、新しいexportと一致） |
| `pnpm test` | 22 files / 347 tests PASS（`tsuppariGateArt.test.ts` を含む） |
| `pnpm build` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| idleの `red.png` / `blue.png` | pixelもbyteも変わっていない |
| `src/game/sumo`、`src/game/input`、`src/game/scenes` | `e30d6b4` からの差分0行 |

testの変更は1か所だけ: `test_real_masks_cover_the_mawashi` のred_rightのmask期待値を、新しいposeの値（2276 / 11 / 67）に更新した。red_leftの期待値は変えていない。

# Browser Smoke

方法:

- `pnpm dev`（port 5199）+ headless Chrome（CDP、SwiftShader）
- 07Cのsmoke scriptを流用した。`WrestlerView.prototype.apply` を読み取りだけで包み、毎frameのtexture key、origin、位置、回転、scaleを記録した

07C1で足した確認:

- 読み込んだ12枚のtextureの実寸
- 表示したpose spriteのorigin × size = exportしたpivot
- dummy mode 3で、CPUのred **right** を確実に観測する

結果: **47 / 47 PASS**（3回目の実行）。

- 1回目は、pageの読み込みを待つ時間が足りなかった
- 2回目は、−πとπを別の角度として比べていた
- どちらもscript側の原因で、直してから再実行した

| 確認 | 結果 |
|---|---|
| 12枚が読み込まれ、実寸がexportと一致する（新right系は209×167、MIRROR-Lは198×177） | PASS |
| Enterで開始、debug `0`、`TSU ART: SEPARATE` | PASS |
| key 4: SEPARATE → MIRROR-L → MIRROR-R → SEPARATE。Snapshotは変わらない | PASS |
| 3 mode × Left / Right: Tsuppariの全frame（startup / active / recovery）で `<mode>_blue_<hand>` が出て、終わるとidleに戻る | PASS（6 / 6） |
| **SEPARATE ArrowLeft → `separate_blue_left`（新しいred-rightの反転）**。origin = (79, 80) / 209×167 | PASS |
| 全frameで、位置 = Snapshot center、rotation = facing、scale 1.0（idleもposeも）。中心やscaleの飛びはない | PASS |
| MIRROR-L: `mirror_l_blue_*` の実寸とpivotは07Cと同じ（198×177、(83, 94) / (83, 83)） | PASS |
| **dummy 3: CPU redで `separate_red_right` が出る**。origin = pivot、位置、facing、scale | PASS |
| Push / Counter / Gripが使える。idle / moveはidle sprite。R restart | PASS |
| console error、失敗したrequestが無い | PASS |

screenshot（scratchpadの `smoke/`）:

- `03_separate_blue_left.png`: 新しい前向きの打突が描かれている
- `04_dummy3_separate_red_right.png`: 接触距離なので、redの腕がblueの体と重なり、見た目では判別しにくい。red-rightの見た目は、offline sheet（`mode_separate.png`、`faceoff_separate.png`）で確認した

# Design Deviations

- 測定scriptを組み立て直した（上の「測定方法の再現について」）
  - 07Cの髪landmarkの実装がrepositoryに無かった。recipeに書かれた手順に最も近い形（7 px opening）で組み立て直した
  - 旧rightで校正し、差は1 source px以内（runtimeでは0.25 px以内）だった
  - 新rightの測定値は、この組み立て直した方法で測った。recipeの `red_right.measurement_evidence.remeasured` に記録した
  - 測定helperは、scope外なのでrepositoryに追加していない（scratchpadのみ）
- 正規化のalgorithm、mode mapping、recolor rule、key 4の切り替え、gameplayは、どれも変えていない

# Unexpected Scope

- 07Cの測定helperがcommitされていないため、今回のようにposeを差し替えるたびに測定を組み立て直す必要がある。必要なら別Taskで、helperとして正式に追加することを検討してほしい（今回は追加していない）

# Changed Files

- `tools/wrestler_art/tsuppari_gate_recipe.json`（red_rightのsource identity、測定値、evidence）
- `public/assets/action/wrestler/tsuppari-gate/` の6枚（separate_red_right、separate_blue_left、mirror_r_*の4枚）
- `src/game/presentation/tsuppariGateArt.ts`（6件のsize / pivot）
- `tools/wrestler_art/tests/test_export_tsuppari_gate.py`（red_rightのmask期待値）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Known Untested Items

- 実機でのUser Visual Gate / Play Test
  - 新しいright poseの打突が十分に前向きで自然か
  - SEPARATEで、右手の打突と左手の打突の見た目がつり合っているか
- headlessのsmokeが確かめたのは、textureの選択と配置の正しさまで

# User Visual Gate: REQUIRED

見てほしい点:

- debug `0` → key `4` でSEPARATEにして、ArrowRightを押す。player blueはLeft / Rightの両方を見る
- dummy `3` にすると、CPU redの左右の打突も繰り返し見られる
- 新しい右手（red right / blue left）の打突が、旧候補（約46°）より前向き（約28°）に見えるか
- idle → pose → idleで、体の中心やscaleが飛ばないか

SEPARATE is still a User preference, not yet promoted to permanent Product baseline.

# Git Delivery

- stageするのはTask-owned fileだけ。commit `art: refresh right tsuppari candidate` → fetch → fast-forwardできることを確認 → push `origin/develop`
- `input.local/`、`output-*.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
