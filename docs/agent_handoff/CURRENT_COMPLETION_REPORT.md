Task-ID: ACTION-09A-KUZUSHI-SWEAT-VISUAL-GATE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 6c6a3f0cc2fcaffa2cef26d057713a8e783bf9c7
Agent-Start-Head: 0b3f85cce8f96bee242791334725a97fb66f2a63
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 40 / 40 PASS（GPU）。汗だけでKuzushiが読み取れるかは、User Visual Gateで判断する）。

- 既存の `WrestlerVisualState.pose === 'kuzushi'` と `kuzushiStrength` だけを使って、頭の脇にpresentation専用の汗の滴を2つ重ねた
- 次のものは変えていない:
  - Kuzushi / CounterTransitionのgameplay
  - 体のsprite、Product art、Counterの35°の回転
- 体の揺れ、専用のKuzushi sprite、timerは足していない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `6c6a3f0`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `6c6a3f0..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `0b3f85c`

# 実装

## 形と描き方

- 手続き的な涙形（先端が上の、漫画の汗）を1つだけtextureにした
  - `Graphics.generateTexture`。大きい滴の4倍のresolutionで1回だけ描く
  - 2つの滴（Phaserの `Image`）で共有する
  - 色:
    - 本体はpale cyan（`#AEE8FF`）
    - 縁は濃い青（`#2A78C0`）
    - 白いhighlightを1つ入れた
  - 文字・星・感嘆符・赤い点滅は無い
- depth **2.5**: 体（2）より上で、debugのoverlay（3）とHUD / text（4）より下（下記のDesign Deviation参照）
- 滴の形は、画面に対して常に先端が上
  - 回すのは、置く位置だけ（canonical facing）
  - 汗のiconとして読みやすいようにした
- particle、effect framework、画像assetは足していない

## 位置と大きさ（R単位、wrestler-local: +forward = FRONT、+lateral = wrestlerの右）

| 滴 | forward | lateral（red） | lateral（blue） | width | height |
|---|---|---|---|---|---|
| 大 | +0.90 R | **+0.62 R** | **−0.62 R** | 0.20 R | 0.34 R |
| 小 | +0.78 R | **−0.13 R** | **+0.13 R** | 0.15 R | 0.26 R |

- 置く位置は、canonicalなparticipantの中心と `participant.facing` から求める
  - `kuzushiSweatOffsetPx`: `(f·cos − l·sin, f·sin + l·cos) · R`
  - Counterの±35°の体の回転は使わない
- 推奨値から変えた理由（Taskが「頭から明らかに離れるなら、R単位で最小限に調整」を認めている）:
  1. 受理済みのidle spriteで頭（髪）の重心を測ると、**red (+0.584 R, +0.419 R)**、**blue (+0.584 R, −0.419 R)** だった
     - blueはredの反射なので、頭の横の位置が逆になる
     - 推奨値を色で固定すると、redでは小さい滴が、blueでは大きい滴が、頭の中心から約1.0 R離れて肩や腕の上に乗った（頭の半径は約0.47 R）
  2. そこで、lateralの符号をartの反射に合わせて色ごとに反転した（どちらの色でも、頭に対する置き方が同じになる）
  3. さらに、小さい滴だけをlateral −0.58 → **−0.13 R** にして、頭の反対側の縁へ寄せた
  4. 大きい滴、forward、大きさは推奨値のまま
  5. 比較のsheetを4案作り、2つの滴が頭の両脇に付く案を選んだ（scratchpadの `sweat_preview2.png`）
  - PNGごとのpixel座標は使っていない

## alphaの規則

- `alpha = clamp(kuzushiStrength, 0, 1)`
  - `kuzushiStrength` は既存のもの（`min(1, ticksRemaining / KUZUSHI_TICKS)`）
- `visible = alpha > 0`
- pose ≠ kuzushiなら、alphaは0で非表示
- 壁時計、render delta、timer、点滅、上下の揺れは使わない

# Changed Files

- `src/game/presentation/kuzushiVisualEffect.ts`（新規。pure、Phaser非依存）
  - `KUZUSHI_SWEAT_DROPS`
  - `kuzushiSweatVisual(id, state)`
  - `kuzushiSweatOffsetPx(drop, facing, R)`
- `src/game/presentation/kuzushiVisualEffect.test.ts`（新規。11 tests）
- `src/game/scenes/WrestlerView.ts`
  - 汗のtexture（`ensureSweatTexture`）
  - 2つのImage（depth 2.5）
  - `apply` での表示 / alpha / 位置
  - 体・影・pivot・scale・回転は変えていない
- `docs/ARCHITECTURE.md`（暫定のVisual Gateであることを1行で記した）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## 変更していないもの

- `src/game/sumo/`、`src/game/input/`（`6c6a3f0` から差分0行）
- `wrestlerVisualState.ts`、`productCounterArt.ts`、`productTsuppariArt.ts`、`productWrestlerArt.ts`、`BoutScene.ts`
- `public/`、`tools/`（差分0行。idle / Tsuppari / Counterのasset、recipe、exporterは不変）
- `WRESTLER_PRODUCT_ART_SPEC.md`（Acceptedにはしていない）、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Kuzushiに入る経路（A〜E）

すべて、Simulationを通したunit testと、browser smokeで確かめた。

| 経路 | unit test（`kuzushiVisualEffect.test.ts`） | browser smoke |
|---|---|---|
| A. Counter Fail | Kuzushiに入ると、alpha 1。tickごとに `ticksRemaining / 30` と一致し、単調に減る。最後は1/30以下、回復すると0。相手は非表示 | S1: blue、76 frame。alpha 1.00 → … → 0.50 → … → ほぼ0、回復で非表示 |
| B. CounterがTsuppariを捕まえる | 攻撃側にalpha 1、Counterを使った側は非表示 | （unitで確かめた） |
| C. Tsuppariの6回目の命中 | 6回目の命中のtickで、受け手にalpha 1。それまでは、受け手がKuzushiのときだけ表示 | （unitで確かめた） |
| D. PushのCounter Best | CounterTransitionの全tick（pusherのtimerは止まっている）でalpha 1、Counterを使った側は非表示。終わると新しく30 tick、そこから単調に薄くなり、回復で非表示 | S2: CounterTransition 90 tick、pusher（blue）の汗は292 frameで位置もalphaも正しい。full 220 frameの後に薄くなり、最後は0.00。red（Counterを使った側）には出ない |
| E. GripがKuzushiを消す | Gripのtickでmorozashiになり、汗は非表示 | S3: blueのCounter Fail → redのGrip（smokeの中で注入）→ Morozashi（holder red）。次のframeからblueの汗は非表示 |

# Verification

| 項目 | 結果 |
|---|---|
| `kuzushiVisualEffect.test.ts`（focused） | 11 tests PASS |
| `src/game/sumo` + `src/game/presentation`（Counter / Tsuppari / Grip / CounterTransition / `wrestlerVisualState` / Product art） | 21 files / 342 tests PASS（既存のtestは変えていない） |
| `pnpm test` | 24 files / 375 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` の `--check` | どれもexit 0（Product assetは不変） |
| `git diff 6c6a3f0 -- src/game/sumo src/game/input public tools` | 0行 |

Taskのtest項目との対応:

| Taskの項目 | 確かめた内容 |
|---|---|
| 1〜4 | 非表示、fresh 1、half 0.5、回復の直前は1/30、0とclamp |
| 5 | sourceに時間やdeltaの入力が無い |
| 6 / 8 | R単位の値が決まっていて、blueは鏡像。どちらの色も同じ規則 |
| 7 | facing 0 / π / π/2 / 任意の値で、正しく回る |
| 9〜11 | Kuzushiのときの体の選択はidle、Counterの回転は0。Counter / Tsuppari / idleのmetadataは不変 |
| 12〜16 | 上のA〜E |
| 17 | diff 0行 |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ Chrome（CDP、GPU: ANGLE D3D11）
- 08Cのsmoke（Product Counter / Tsuppari / 35°の回転 / Push / Grip / R）に、汗の場面S1〜S4を加えた
- logに、汗の `visible` / `alpha` / 位置 / depthと、`kuzushiStrength` を記録した
- 汗の場面はdebug OFF（Productの見え方）で撮った
- 結果: **40 / 40 PASS**

| 確認 | 結果 |
|---|---|
| Enterで開始。Kuzushi以外のframe（両者）には汗が無い | PASS |
| S1: Counter Failのblueに汗。alpha = kuzushiStrength、位置 = canonical center + R offsetをfacingで回したもの、depth 2.5 | PASS |
| S1: alphaは1から単調に減り、ほぼ0になる。回復すると非表示。redには出ない | PASS |
| S2: PushのCounter Best。CounterTransitionのあいだ、pairが動いてもpusherの汗が付いて回り、濃いまま。その後、新しい30 tickで薄くなる。Counterを使った側には出ない | PASS |
| S3: GripがKuzushiを消すと、汗はすぐ非表示 | PASS |
| S4: R restartで汗は非表示 | PASS |
| 08Cの確認（Product Counterの2枚、gate textureは0枚、blueの回転は−35°まで / redは+33.81°で捕獲、Counter Fail / Best / CounterTransition、Tsuppariの左右、Push / Grip / 移動、R restart、console error / 失敗したrequestが無い） | PASS |

screenshot（scratchpadの `smoke9/`、GPU、debug OFF）:

| file | 状態 | alpha |
|---|---|---|
| `20_sweat_fresh.png` | Counter Failの直後のKuzushi | 1.0 |
| `21_sweat_half.png` | 回復の途中 | 0.6 |
| `22_sweat_counter_transition.png` | CounterTransition中のpusher（blue）。横に回り込むred | 1.0 |

- どれでも、2つの滴が頭の両脇に付いていた
- halfでは、薄くなっていることを目視で確かめた

# Design Deviations

1. **汗の位置**: Taskが認める範囲で、R単位の位置を最小限に調整した（上の「推奨値から変えた理由」）。lateralを色ごとに反転し、小さい滴を −0.58 → −0.13 Rにした。大きさ、forward、大きい滴の位置は推奨値のまま
2. **depth**: 推奨の「3」ではなく、**2.5** にした
   - 既存のdebug overlay（facing marker、接触円）がdepth 3なので、3だと「debug UIより下」というTaskの意図が、作成順しだいになる
   - 2.5なら「体より上、debug / HUDより下」が必ず成り立つ

# Unexpected Scope

NONE

# Known Untested Items

- 実機でのUser Visual Gate（見た目、読みやすさ）

# User Visual Gate: REQUIRED

主な問い:

> 汗の重ね描きだけで、専用のspriteが無くても、Kuzushiがすぐ読み取れるか

判断してほしい点:

- gameの大きさで見えるか
- 頭に付いて見えるか
- damage / KO / 気絶に見えないか
- うるさくないか
- CounterTransitionのあいだ濃いままでよいか
- その後の0.5秒で薄くなるのが分かりやすいか
- red / blueの両方
- Tsuppari / Counterの見た目は、引き続き分かりやすいか

確認の手順:

1. `pnpm dev` → Enter → 離れた状態でArrowDown（Counter Fail → blueのKuzushi）
2. CPUのPushをArrowDownで返す（dummy `2`。CPUのKuzushiと、CounterTransition）
3. Tsuppariを6回当てる

汗だけでは足りなければ、次のTaskで「汗 + ごく小さな体の揺れ」を試す（このTaskでは足していない）。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `feat(presentation): add kuzushi sweat visual gate` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
