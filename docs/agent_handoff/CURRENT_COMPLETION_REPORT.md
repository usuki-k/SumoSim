Task-ID: ACTION-08A1-COUNTER-ART-CANDIDATE-REFRESH
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: bc95f7117dbadf57cceee9d2a0b2a67e6fd10b56
Agent-Start-Head: 395136266c490523605b7f1d12cea6eb881fb475
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 20 / 20 PASS。新しいCounter / 引き・捌きの候補が十分かは、User Visual Gateで判断する）。

- 暫定のCounter Visual-Gateの画像を、Userの新しい候補（腕を横へ払う構図）に差し替えた
- 07Cから続くlandmarkの方法で正規化し直し、`counter-gate/red.png` / `blue.png` を作り直した
- Taskが認めた範囲で、Counter gateのrecipeの `max_missed_px` だけを60 → 80にした
- 次のものは変えていない:
  - 塗り替えの規則、idle / Tsuppariのmaskの上限
  - presentationの経路（`pose === 'counter'` → `selectWrestlerPoseArt`）
  - gameplay、idle / Product Tsuppari art

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `bc95f71`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `bc95f71..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `3951362`
- この開始指示の前に、2回STOPしている。どちらもrepositoryには何も書いていない
  1. 1回目: 当時の指定画像（`11d5157b…`）は、まわしが2つに分かれていて、mask（missed 175）が上限を超えたため、BLOCKEDとして報告した
  2. 2回目: Userが画像を差し替えたが、当時のTaskの指定hashと合わなかったため止めた。そのとき、scratchpadで事前診断だけをした
  - 今回のTaskは、その差し替えた画像と、事前診断で分かったmaskの上限を反映している

## Source（`tools/wrestler_art/input.local/candidate_red_counter.png`、commitしない）

| 項目 | 期待値 | 実測 |
|---|---|---|
| size / mode | 1265×1244 RGBA | 1265×1244 RGBA |
| decoded RGBA pixel SHA-256 | `5429d02f6f7ffad36754cbd5958c77bb1197027cce45572f81c825d1a02c37b8` | 一致 |
| file SHA-256（参考） | `a62f4f5e…fa46` | `a62f4f5e69605079d4cba3fd7ac3c40cdcd4ee673f708e80fd20db9ef5a1fa46` |
| 08Aの旧画像 `eb0f2e60…e040` と違う | 違う | 違う |
| 08A1で不採用の画像 `11d5157b…9e85` と違う | 違う | 違う |

# Normalization（新しい候補。旧値は流用していない）

- 方法は08Aと同じ: `measure_tsuppari_pose.measure_landmarks` / `normalization` を、この候補に1回実行した
- 髪とまわしの重心を、1/2 BOXのscaleで測り、受理済みのidle red masterに合わせる
- 正規化のalgorithmは変えていない

| 項目 | 08A（旧） | 08A1（新） |
|---|---|---|
| source size | 1254×1254 | **1265×1244** |
| hair centroid / px | (543.7, 494.4) / 63152 | (659.3, 405.8) / 73976 |
| mawashi centroid / px | (992.6, 597.3) / 70984 | (1118.3, 582.2) / 57052 |
| 回転差 / scale s | +10.004° / 1.1712 | **+18.115° / 1.163** |
| `source_front_deg` | 170.7 | **178.8**（実測178.815） |
| `root_source_px` | (750, 608) | **(863, 553)**（実測862.66, 552.68） |
| `body_core_source_px` | (678, 170)–(798, 899) | **(853, 111)–(868, 846)**（front軸との直交のずれは約0.03°） |

- 頭が体より大きく描かれているため、2つの面積比が食い違う（√比で、髪1.317、まわし1.009）
  - 既存の方法どおり、sは2つの平均にした（`measurement_evidence.note` に記録した）
  - 体がidleよりやや小さく見える可能性があり、User Visual Gateで確認してほしい点になる
- clipはない
- idleの輪郭との重ね合わせ（scratchpadの `counter_alignment.png`）で確かめた:
  - 頭と胴体はidleとほぼ同じ位置に重なる
  - 腕は前方へまっすぐではなく、斜め横へ払う向き
  - 反対の腕は胴体へ引き寄せている
- 手で調整したoffsetは無い

# Runtime（Visual-Gate asset。pathは変えていない）

| path | size | pivot | body core | 旧pixel SHA-256（08A） | 新pixel SHA-256 | 新file SHA-256 |
|---|---|---|---|---|---|---|
| `public/assets/action/wrestler/counter-gate/red.png` | 203×190 → **210×207** | (79, 96) → **(74, 115)** | 123.0769 px | `ac2a6ca8…0da1` | `83b96783ebdd741ab07e435d25ce7a4ce6557b734d40c8873560bab2b630d5d3` | `a6128071c1a4137d7fbab66e8d51b90e72fe3ebe187c85ac73bd17fcfd2a6b4e` |
| `public/assets/action/wrestler/counter-gate/blue.png` | 203×190 → **210×207** | (79, 94) → **(74, 92)**（= redを反射） | 123.0769 px | `4d563d82…d198` | `1dec7025670ba375287166078cbb52dd3b6701fa52618646107fd4f50153e439` | `3aa893ce83621b66071fe77fd20c4b577b9fc22ef17d944e6768217448b457f3` |

- runtimeのtextureは、この2枚だけ
- `src/game/presentation/counterGateArt.ts` のsize / pivotを更新した

# Recolor / Mask

- 塗り替えのalgorithmと共通の規則（`runtime_wrestler_recipe.json`）は変えていない
- idle / Tsuppariのmaskの上限（60）も変えていない（testで確かめている）
- **Counter gateだけの許容**: `counter_gate_recipe.json` の `mask_limits.max_missed_px` を60 → 80にした（Taskが明記した許容。image-specificで、Product全体の基準ではない）
- 80を超えれば、引き続きfail closedで止まる

| 最終の値（実際に正規化してexportした後） | 値 |
|---|---|
| mask px | 1724 |
| missed band px | **70**（上限80）。そのうち69 pxはalpha < 128の半透明な輪郭の縁 |
| fringe px | 75（上限120） |

- 事前診断（scratchpad）の値と完全に一致した
- まわしは、つながった1つの帯になっている（08A1で最初に不採用だった画像のような、前側の別の塊は無い）
- `counter_mask.png` を目視した。skin、hair、腕への混入は無く、blueに目立つ赤の残りも無い

# Presentation Integration

08Aの経路のままで、変えていない:

- 経路: `BoutSimulation / Snapshot → WrestlerVisualState.pose === 'counter' → selectWrestlerPoseArt() → counter-gate texture → WrestlerView`
- 状態もtimerも足していない。キー入力から推測もしない
- 変えたのは、metadataの数値（size / pivot）だけ

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_counter_gate.py`（focused） | 16 tests OK（Counterだけ80、idle / Tsuppariは60のtestを追加。sourceのhash / size、maskの期待値を更新） |
| wrestler-art全suite | 167 tests OK |
| presentationのtest / `pnpm test` | 23 files / 358 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| Counterのexport: 決定的な再実行 / `--check` | 再実行でbyteが同じ（file SHA-256は上の表のとおり）/ exit 0 |
| `export_runtime_wrestlers.py --check`（idle） / `export_tsuppari.py --check`（Product Tsuppari） | どちらもexit 0（idle / Tsuppariは不変） |
| `src/game/sumo/` / `src/game/input/` | `bc95f71` から差分0行 |

# Browser Smoke

`pnpm dev`（port 5199）+ headless Chrome（CDP）。08Aのsmokeを、新しいsize / pivotで実行した。

- CPU redのCounterは、smoke scriptの中だけで `dummy.nextIntent` を一時的に包んで出した。ソースは変えていない
- 結果: **20 / 20 PASS**

| 確認 | 結果 |
|---|---|
| Counterの2枚（210×207）が読み込まれる。Tsuppariの4枚とidleの2枚のsizeは変わらない | PASS |
| pre-bout → Enter | PASS |
| ArrowDown: blueが、counterの全frame（13 frame）で新しい `counter-gate-blue` を表示 | PASS |
| origin = pivot、位置 = Snapshot center、rotation = facing、scale 1.0（idle → Counter → 次の状態で、飛びは無い） | PASS |
| Counter以外の状態では表示しない | PASS |
| Counterの空振り → 既存どおりFail / Kuzushi → idleのsprite | PASS |
| red CPUのCounter（`counter-gate-red`）。PushをBestで捕まえ、既存のCounterTransition（`active`）になる | PASS |
| Tsuppariの左右はProductのまま。Push / Counter / Grip、移動、R restart | PASS |
| console error、失敗したrequestが無い | PASS |

screenshot `09_blue_counter_pose.png` / `10_red_counter_pose.png`（scratchpad）で、新しいposeが描かれていることを確かめた。

# Changed Files

- `tools/wrestler_art/counter_gate_recipe.json`（sourceの同一性、測定値、evidence、`max_missed_px` 80）
- `public/assets/action/wrestler/counter-gate/red.png` / `blue.png`
- `src/game/presentation/counterGateArt.ts`（size / pivot）
- `src/game/presentation/counterGateArt.test.ts`（期待するgeometry）
- `tools/wrestler_art/tests/test_export_counter_gate.py`（source、maskの期待値、Counterだけの許容のtest）
- `tools/wrestler_art/README.md`（Counter gateの節の値）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## 変更していないもの

- `src/game/sumo/`、`src/game/input/`、`wrestlerVisualState.ts`、`WrestlerView.ts`、`BoutScene.ts`
- `runtime_wrestler_recipe.json`、`tsuppari_recipe.json`
- idle / Tsuppariのasset
- `WRESTLER_PRODUCT_ART_SPEC.md`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Design Deviations

Design Deviations: NONE（`max_missed_px` 60 → 80は、Taskが明記した許容）

# Unexpected Scope

NONE

# Known Untested Items

- 実機でのUser Visual Gate

# User Visual Gate: REQUIRED

確認の手順:

1. `pnpm dev` → Enter → ArrowDownで、blueのCounterを見る
2. redのCounterは、CPUのPushをArrowDownで返す場面で見る。CPUはdummyではCounterを押さない

判断してほしい点:

- 引き・捌き（横へ払う）に見えるか。Tsuppariと見分けられるか
- 頭と体の位置
- 見た目の大きさ（頭が大きく描かれているため、体がやや小さく見える可能性がある）
- red / blueの両方
- idle → Counterへの切り替え
- 約12 tickの静止poseが読み取れるか

Technical PASSは、恒久の受理ではない。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `art(action): refresh counter pose candidate` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `input.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
