Task-ID: ACTION-08A-COUNTER-ART-VISUAL-GATE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 85bdc89205189e056af56506084aacaacdca6d5c
Agent-Start-Head: a015e558235a48593507aad16741a2d6d3e67246
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 20 / 20 PASS。Counterの画像が今の候補として十分かは、User Visual Gateで判断する）。

- Userが用意した引き・捌き（ArrowDown / Counter）の画像を、**暫定のVisual Gate** としてruntimeに組み込んだ
  - red: 描いた1枚を正規化したもの
  - blue: そのredをofflineで反射し、まわしを塗り替えたもの
- 表示するのは、既存の `WrestlerVisualState.pose === 'counter'` のあいだだけ。独自のtimerは持たない
- Counterのgameplay、idle、Product Tsuppari artは変えていない
- Productの恒久の契約（`WRESTLER_PRODUCT_ART_SPEC.md` のAccepted）には入れていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `85bdc89`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `85bdc89..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `a015e55`
- source: `tools/wrestler_art/input.local/candidate_red_counter.png`（commitしない）

| 項目 | 期待値 | 実測 |
|---|---|---|
| size / mode | 1254×1254 RGBA | 1254×1254 RGBA |
| decoded RGBA pixel SHA-256 | `eb0f2e6058fe35c239ed571e1e576fc30b4648988c347b89d4e227a3a8b3e040` | 一致 |
| file SHA-256（参考） | `842900c1a41b4b06ed16f2c0d167f7e132bc7fbf6956865a4699ddcc77d9d979` | 一致 |

# Normalization（`counter_gate_recipe.json`）

測定は、Product Tsuppariと同じlandmarkの合わせ方（`measure_tsuppari_pose.measure_landmarks` / `normalization`）で、この候補に1回だけ実行した。

- 髪の塊とまわしの重心を、1/2 BOXのscaleで測り、受理済みのidle red masterに合わせる
- 測定の仕組みを汎用化するrefactorはしていない
- 記録値は丸めている（front 0.1°、各点1 px）

| 項目 | 値 |
|---|---|
| hair centroid / px | (543.7, 494.4) / 63152 |
| mawashi centroid / px | (992.6, 597.3) / 70984 |
| 回転差 / scale s | +10.004° / 1.1712 |
| `source_front_deg` | **170.7** |
| `root_source_px` | **(750, 608)** |
| `body_core_source_px` | **(678, 170)–(798, 899)**（front軸との直交のずれは0.05°） |

- この画像の胴体は、idleより約10°回り、約17%大きく描かれている
  - 髪とまわしの面積比のずれは、Tsuppariのposeより大きい（√比で、髪1.217、まわし1.126）
  - そのため、sは2つの平均にした（既存の方法のまま。evidenceのnoteに記録した）
- それでも、正規化はclipせずに通った
- 向きと大きさが合っていることは、idleの輪郭との重ね合わせで確認した（下記）
- 適当なoffsetを手で調整したりはしていない

# Runtime（Visual-Gate asset）

| path | size | pivot | body core | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|---|
| `public/assets/action/wrestler/counter-gate/red.png` | 203×190 | (79, 96) | 123.0769 px | `ac2a6ca89a147d30d5483360853084d53bbf613928b8de13684ab2bf59910da1` | `b798d328…2092` |
| `public/assets/action/wrestler/counter-gate/blue.png` | 203×190 | (79, 94)（= redを反射） | 123.0769 px | `4d563d82b9f33ac0ef26552099c71a4d9314de5a52ff6ec03a38c23162f0d198` | `1e44ba3a…ceaf` |

- runtimeは通常のPNGだけを使う（runtimeでの反転や塗り替えはしない）
- 恒久の `counter/` は作っていない

# Recolor / Mask

ruleの持ち主は `runtime_wrestler_recipe.json` で、tsuppari / counterのrecipeには複製していない。

| source | mask px | missed（上限60） | fringe（上限120） |
|---|---|---|---|
| 正規化したred Counterを反射（→ blue） | 2085 | 14 | 74 |

- 目視（maskのsheet）で、maskはまわしの帯だけにかかっていた。skin、hair、腕への混入はない
- 次のことはtestで確かめた:
  - alphaが変わらない
  - mask外の画素が変わらない
  - mask内は実際に色が変わる
- 確認用のsheet（scratchpad、commitしない）:
  - `counter_alignment.png`: 体と頭はidleの輪郭とほぼ重なる。腕は前方へ伸びる
  - `counter_mask.png`
  - `counter_rotations.png`

# Presentation Integration

- `src/game/presentation/counterGateArt.ts`（新規。Phaser非依存、Simulation非依存）
  - `COUNTER_GATE_ART.red` / `.blue`: texture key（`counter-gate-red` / `-blue`）、path、寸法、pivot、body-coreの直径
  - `allCounterGateArts()`: preload用
  - `selectWrestlerPoseArt(idle, state)`
    - `state.pose === 'counter'` → Counterの候補
    - それ以外 → 既存のProductの選択 `selectWrestlerArt`（Tsuppariのpose、またはidle）にそのまま渡す
- `src/game/scenes/WrestlerView.ts`: preloadにCounterの2枚を追加し、選択を `selectWrestlerPoseArt` にした。pivot / scale / 位置 / 回転の規則は変えていない
- 経路: `BoutSimulation / Snapshot → resolveWrestlerVisualState（pose = counter）→ selectWrestlerPoseArt → WrestlerView`
- Simulationに状態は足していない。Phaserでキー入力から推測もしない

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| sourceのpath / hash | `counter_gate_recipe.json` の `master`（file、pixel SHA-256）。`aw.load_source` が確かめ、合わなければ止まる | `test_accepted_source_identity`、`test_missing_or_changed_source_fails_closed`、実測hashの一致 |
| 正規化 / pivot / body-core | idleと同じ03Aの正規化（`et.normalize`）。front 170.7、root、body-coreを明示し、2R・/4 | `test_red_is_the_normalized_pose_and_blue_its_reflected_recolor`（body core 2R）、`test_committed_textures_match_a_red_only_fresh_export`、alignmentのsheet |
| red → blueの導出 | local Y反射 + idle recipeのまわしの塗り替え（1か所が持つ） | `test_only_one_local_y_reflection`、`test_recolor_rule_is_owned_by_the_idle_runtime_recipe`、alpha / mask外のtest、`test_real_mask_covers_the_mawashi` |
| 暫定のruntime path | `public/assets/action/wrestler/counter-gate/red.png` / `blue.png`（ちょうど2枚） | `test_exactly_two_files_from_the_one_red_pose`、TSのtest、smokeのtexture読み込み |
| metadataとexportの一致 | `counterGateArt.ts` | `test_typescript_metadata_matches_the_export`、TSの `explicit pivot / body core` |
| 決定的 / `--check` | atomicな書き込み。`--check` は何も書かない。古い・無いassetを検出する | `test_deterministic_export`、`test_check_writes_nothing_and_detects_stale_or_missing`、実際の再実行でbyteが同じ |
| Counter状態の表示 | `selectWrestlerPoseArt`: pose = counterのときだけ | TSのtest（counterの全tickで表示、window − 1 tickのあいだ保持、終わればidle）、smoke（blue / redの全counter frame） |
| idle / Tsuppariを保つ | idle、Tsuppariの4枚には触れない | `test_accepted_idle_and_tsuppari_textures_unchanged`、`export_runtime_wrestlers.py --check`、`export_tsuppari.py --check`、TSのTsuppari選択test、smoke |
| gameplayは不変 | `src/game/sumo`、`src/game/input` は差分0行 | `git diff 85bdc89 -- src/game/sumo src/game/input` = 0行、Counter / Tsuppari / Pushのtestは全PASS |

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_counter_gate.py`（focused） | 15 tests OK |
| wrestler-art全suite | 166 tests OK |
| presentationのtest（`counterGateArt.test.ts` 6件を含む） | 51 tests PASS |
| `pnpm test` | 23 files / 358 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter_gate.py --check` / 再実行 | exit 0。byteが同じ |
| `export_runtime_wrestlers.py --check`（idle） | exit 0 |
| `export_tsuppari.py --check`（Product Tsuppari） | exit 0 |
| `src/game/sumo/` / `src/game/input/` | `85bdc89` から差分0行 |

# Browser Smoke

`pnpm dev`（port 5199）+ headless Chrome（CDP）。結果: **20 / 20 PASS**

CPU redのCounterを観測する方法:

- dummyにはCounterのmodeが無い。そこでsmoke script側でだけ、ブラウザ内の `dummy.nextIntent` を一時的に包んだ
- playerのPushを見たら、1回だけ `counterPressed` を返す。終わったら元に戻した
- ソースは変えていない

| 確認 | 結果 |
|---|---|
| Counterの2枚（203×190）が読み込まれる。Tsuppariの4枚とidleの2枚のsizeは変わらない | PASS |
| pre-bout → Enterで開始 | PASS |
| ArrowDown: blueが、counterの全frame（11 frame）で `counter-gate-blue` を表示 | PASS |
| blue: origin = pivot、位置 = Snapshot center、rotation = facing、scale 1.0（飛びは無い）。counter以外の状態では使わない | PASS |
| blueのCounterが空振り → 既存どおりFail / Kuzushiになり、idleのspriteに戻る | PASS |
| red CPUのCounter: counterの全frameで `counter-gate-red` を表示。pivot / 配置も正しい | PASS |
| 捕まえた結果は既存のまま: tierは `best`、CounterTransitionは `active`。その後のredは既存のvisual（idle / move） | PASS |
| Pushした側（blue）にはCounterのtextureが出ない | PASS |
| Tsuppariの左右は、引き続き `product-tsuppari-blue-left / -right` | PASS |
| Push / Counter / Grip、idle / moveのsprite、R restart | PASS |
| console error、失敗したrequestが無い | PASS |

screenshot `09_blue_counter_pose.png` / `10_red_counter_pose.png` で、blue / redのCounter poseが実際に描かれていることを確かめた（scratchpad）。

# Changed Files

- 追加
  - `tools/wrestler_art/counter_gate_recipe.json`
  - `tools/wrestler_art/export_counter_gate.py`
  - `tools/wrestler_art/tests/test_export_counter_gate.py`
  - `public/assets/action/wrestler/counter-gate/red.png` / `blue.png`
  - `src/game/presentation/counterGateArt.ts` / `counterGateArt.test.ts`
- 変更
  - `src/game/scenes/WrestlerView.ts`
  - `tools/wrestler_art/README.md`（暫定Gateの節）
  - `docs/ARCHITECTURE.md`（暫定のCounter Visual Gateを1行）
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## 変更していないもの

- `src/game/sumo/`（Counter window、Success / Best / Fail、CounterTransition、Kuzushi、Push、Tsuppari）
- `src/game/input/`（ArrowDownのbinding、入力の優先順位）
- `src/game/presentation/wrestlerVisualState.ts`、`productTsuppariArt.ts`、`productWrestlerArt.ts`
- idle / Tsuppariのasset、recipe、exporter
- `WRESTLER_PRODUCT_ART_SPEC.md`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

NONE

# Known Untested Items

- 実機でのUser Visual Gate
- headlessのsmokeが確かめたのは、textureの選択・配置・表示の長さが、gameplayの状態に従っていることまで

# User Visual Gate: REQUIRED

確認の手順:

1. `pnpm dev` → Enter → ArrowDownで、playerのCounter（blue）を出す
2. redのCounterを見るには、CPUに押させて（dummy `2`）、playerがArrowDownで返す場面や、そのSuccess / Bestの後を見る。CPUはdummyではCounterを押さない

判断してほしい点:

- idle → Counter poseへの切り替え（頭と体の位置、見た目の大きさ）
- 腕の置き方と読みやすさ
- redの版と、derivedのblueの版
- ArrowDownが引き・捌きに見えるか
- 静止poseの長さ（Counter window = 12 tick）が読み取れるか
- Success / Bestの遷移が、poseの後でも分かりやすいか

Technical PASSは、この画像を恒久に受理したという意味ではない。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `art(action): add counter pose visual gate` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `input.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
