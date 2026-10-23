Task-ID: ACTION-11G-GRIP-SUCCESS-ARM-HAND-VFX
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: a88234c335218cc5dc409e80ced3c8fd506675b6
Agent-Start-Head: a4b0b5afd36fa4f69954a9d8e76d64bddd45010a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

Grip successのposeを表示しているあいだだけ、力士ごとに手続き的な前腕 + 丸い手を2本描く。presentationだけ。

- FARの腕: 体の下に描く
- NEARの腕: 体の上に描く

置き方:

- ACTION-11Fで表示上ずらした体の中心と、canonicalなfacingから置く
- ACTION-11Fのpair compression（+0.14 R / −0.20 R）、gameplay、Simulationの位置、bond、facing、asset、art toolingは変えていない

NEARの腕のgeometryは、Taskの初期値だと自分の頭に重なった。そのため、肩と手の位置を外側へ調整した（Design Deviationsを参照）。

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `a88234c`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `a88234c..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `a4b0b5a`

# Final VFX geometry（wrestler-local、R単位。+forward = FRONT、+lateral = 力士の右）

| limb | 肩（start） | 手（end） | 前腕の太さ | 手の半径 | 長さ |
|---|---|---|---|---|---|
| FAR | (0.18, +0.42) | (0.82, +0.25) | 0.20 R | 0.15 R | 0.662 R |
| NEAR | (0.22, −0.65) | (1.12, −0.58) | 0.22 R | 0.16 R | 0.903 R |

- 両者に同じlocal geometryを使う。正対したpairでは、ACTION-11Fのoffsetと同じく点対称になる
  - blueのNEARの腕は上側で、redの上側の肩・脇へ届く
  - redのNEARの腕は下側で、blueの下側の脇へ届く
- neutral / Morozashi holder / disadvantaged / Drive / turningで同じ形。Morozashi専用の形・印は無い

# Layers / depth

| 対象 | depth |
|---|---|
| 影 | 1（既存） |
| FARの腕 | **1.9**（`GRIP_LIMB_DEPTH.far`） |
| 体 | 2（既存） |
| NEARの腕 | **2.2**（`GRIP_LIMB_DEPTH.near`） |
| Kuzushiの汗 | 2.5（既存） |
| debug | 3（既存） |
| HUD | 4（既存） |

- 動的なdepth sortingは無い。depthが同じ物同士は、既存の生成順で並ぶ（A → B）
- smokeで、frameごとに順序が変わらないことを確認した（L3）

# Render method

- `WrestlerView`のconstructorで、腕ごとに`Phaser.GameObjects.Image`を1枚作る（力士あたり2枚、計4枚）。毎frameの生成・破棄は無い
- texture: `Graphics.generateTexture`で、腕ごと・Rごとに1回だけ作る
  - key: `grip-limb-far-<R>` / `grip-limb-near-<R>`
  - 2倍で描いて、scale 0.5で表示する
  - 形: 肩の丸い端 + 前腕の長方形 + 丸い手。まず輪郭色（`#231612`、幅0.035 R）で1回り大きく塗り、その上に肌色（`#f3b47c`、success textureの肌から採った色）を塗る
  - 指は無い。glow・particle・icon・textも無い
- `apply`のたびに次を行う:
  - `gripSuccessLimbsVisible(state)`で表示 / 非表示を決める
  - 表示中は`gripSuccessLimbPlacement`の肩の位置と、肩→手の角度を、imageの位置と回転にする
  - 表示上の体の中心は、ACTION-11Fで求めた`display`を足して作る（pair compressionの式は複製していない）
- `isGripSuccessPose`は、`gripSuccessGateArt.ts`の判定をexportしたものを共用する（success art・display offset・limbで1つ）

# ACTION-11F / gameplay unchanged

- `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14` / `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.2`はそのまま（test O3、smoke 7）
- `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiffは0行
- Snapshotは不変、bondは0.70 m（test O1 / O2、smoke 6 / 16b）
- success / attemptのtextureは不変（diff 0、smoke 4 / 14）

# Tests

`src/game/presentation/gripSuccessLimbVfx.test.ts`（新規）: 13 / 13 PASS

| ID | 内容 |
|---|---|
| geometry | 上のFAR / NEARの値（R単位）を固定 |
| G1–G3 | idle / move / push / tsuppari / counter / kuzushi / gripでは非表示。grapple / driveでは表示 |
| G4 | facing 0: 前 → +x、右 → +y、角度 |
| G5 | facing π/2・π・−π/2: 肩・手・角度が剛体として回る。長さは不変 |
| G6 | 長さ・太さ・手の大きさがRに比例 |
| G7 | NEAR = 左、FAR = 右で、反対側。どちらも前へ伸びる |
| G8 | 決定的 |
| S1–S4 | neutral（両者）/ Morozashi holder / disadvantaged / Drive 40 tickで表示。Drive中のflickerは無い |
| S5 / S6 | Grip attempt中、releaseのtick、recovery 12 tickで非表示 |
| S7 | idle / Push / Tsuppari / Counter / Kuzushiで非表示 |
| anchor | 肩の位置 = canonical + ACTION-11Fのoffset + limbのlocal点 |
| O1–O3 | Snapshot不変、bond 0.70 m、ACTION-11Fの定数不変 |
| ownership | Phaser / Simulationに依存しない。WrestlerViewのdepth 1.9 / 2 / 2.2と、表示上の中心からの配置（source assertion） |

# Verification

| 項目 | 結果 |
|---|---|
| limb VFXのfocused test | 13 / 13 PASS |
| Grip successのfocused test（`gripSuccessGateArt.test.ts`） | 19 / 19 PASS（変更なし） |
| `pnpm test`（Grip attempt、Grip / Grapple / Drive / Orientationのgameplay、Counter / Tsuppari / Kuzushi / Pushのpresentationを含む） | 30 files、518 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/assets/action/wrestler/`・`tools/wrestler_art/`のdiff | 0行 |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU（`--use-angle=d3d11`）、Vite dev server、1920x1080。ACTION-11Fのscript（18項目）に、limbの確認L1–L9を足した。

- limbの確認は、全frameで、4枚のimageの表示 / 位置 / 回転 / depthを、期待値と比べる
- CPUの入力は、Morozashi（Counterの空振り）とturning（Pushを1回）のときだけ差し替えた

結果は **27 / 27 PASS**。

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 / L1 | Grip attempt中は、offset 0、limb無し | PASS |
| 3 / 4 / L2 | neutral grappleの最初のframeから、両者にFAR + NEARのlimb。肩 = 表示上の体の中心 + local点、角度 = facing + local角（誤差 < 1e-6 px / 1e-9 rad） | PASS |
| 5–10 | ACTION-11Fのcompression（中心間108.671 px、canonicalは123.077 px）、facing、bond 0.70 m、scale、pivot、影は不変 | PASS |
| 7b / L3 | 描画順が安定: FAR 1.9 < 体 2 < NEAR 2.2。display listの順序もframe間で不変 | PASS |
| 11 / L4 | Drive（281 frame）で、limbが常に表示・追従する | PASS |
| 12 / L5 | Morozashi（217 frame）で、limbが常に表示・追従する | PASS |
| 16b / L6 | turning（639 frame、そのうちturningは132）: 全frameで、limbが現在のfacingに追従する。瞬間移動は無い | PASS |
| 13 / L7 | releaseの最初のfree frameから、recoveryのあいだ、limb無し | PASS |
| 14 / L8 | release後の新しいGrip attemptにlimbは残らず、成功で再び表示される | PASS |
| 15 / L9 | Push / Tsuppari / Counter / Kuzushi（600 frame）でlimb無し。art・35°・汗は不変 | PASS |
| 16 | Rでrestartできる | PASS |
| 17 | console error・例外・失敗requestが無い | PASS（既存の`/favicon.ico` 404はこの判定から除外。Task外） |

## Screenshots

ローカルのscratchpad、commitしない:

- 最終版: `smoke11g\`
  - `01_neutral_immediately_after_success`
  - `02_neutral_settled`
  - `03_drive_while_grappled`
  - `04_morozashi_grapple`
  - `05_immediately_after_release`
  - `06_turning_immediately_after_success`
  - `07_turning_mid`
  - `08_turning_settled`
  - 一覧（2倍拡大）: `pair_sheet.png`
- Taskの初期値で描いた比較: `smoke11g_pre\pair_sheet.png`
- offline比較: `limbs_a.png`、`limbs_b.png`

目視の所見（判断ではなく観察）:

- neutral / Drive / Morozashi:
  - 2本のNEARの腕が、それぞれ相手の外側の脇・肩口へ掛かる。体が重なっているだけの見た目から、腕を回して組んでいる見た目へ近づいた
  - 手はどちらも相手の胴の脇に届く。頭には重ならない
- FARの腕: 正対した状態では、両者の体にほぼ完全に隠れて見えない。Taskの層の設計どおりだが、正対では見た目への寄与はほぼ無い
- 腕の形: 単純なcapsule + 丸い手なので、ゲームの縮尺では「棒に丸い手」に見える。輪郭と肌色は、spriteにおおむね馴染んでいる。iconのようには見えない
- turning:
  - 開始時（`06`）: 背を向けたredのNEARの腕は、red自身の前（blueから離れる向き）へ伸び、何もない空間へ出る
  - 回り込みの途中（`07`）: 同じく、redの腕は外を向く
  - 正対すると（`08`）: neutralと同じ形に戻る
  - 層の切り替えやturning専用の処理は、Taskの指示どおり加えていない
- release（`05`）: limbは同じframeで消え、idle spriteに戻る

# Changed Files

新規:

- `src/game/presentation/gripSuccessLimbVfx.ts`: limbのgeometry（R単位）、表示の判定、canvasでの配置（Phaser非依存）
- `src/game/presentation/gripSuccessLimbVfx.test.ts`

変更:

- `src/game/presentation/gripSuccessGateArt.ts`: `isGripSuccessPose`をexportした（1行のcommentを含む。挙動は不変）
- `src/game/scenes/WrestlerView.ts`: `GRIP_LIMB_DEPTH`、limbの色・輪郭の定数、`ensureLimbTexture`、limbの4枚のimageの生成と配置。header comment
- `docs/ARCHITECTURE.md`: ACTION-11G（暫定）のnoteを1項目追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

- **NEARの腕のgeometryを、Taskの初期値から調整した**
  - Taskの値: 肩(0.20, −0.42) → 手(0.92, −0.28)
  - 最終値: 肩(0.22, −0.65) → 手(1.12, −0.58)
  - 理由: ACTION-11Fのoffsetで、各力士の頭は自分の左側にある。初期値だとNEARの腕が自分の頭の真上を横切り、頭の上に棒が浮いて見えた（`smoke11g_pre\pair_sheet.png`）。Taskが認める「初期geometryが明らかに浮く場合の小さな局所調整」と判断した
  - 4候補をoffline合成で比べ、頭を避けて相手の脇へ届く、最小の外側への移動を選んだ（`limbs_b.png`の候補C）
  - 太さ・手の大きさ・FARの腕・ACTION-11Fの定数は、Taskの値のまま

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない
- 検証のメモ: Vite dev serverの起動中にsourceを編集すると、HMRのtimestampで、smokeの計測hookが別のmodule instanceを掴む。dev serverを再起動して計測した。productの挙動には影響しない

# Known Untested Items

- 実機のTouch入力
- turningは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した

# User Visual Gate: REQUIRED

主な問い: 手続き的な腕・手で、ACTION-11Fの密着したpairが「互いに組み、つかんでいる」と、はっきり読めるか。

- 腕が相手の方へ回っているか。手が胴・脇をつかんでいるように見えるか
- 腕が浮いていないか。太さはキャラクターに合っているか
- iconのように見えないか
- neutral / Drive / Morozashiで一貫しているか
- turningの開始時に、背を向けた側の腕が外へ出る見え方は許容できるか
- releaseで消える瞬間に違和感が無いか

控えめすぎる、または繋がって見えない場合は、まずlimbのgeometry / 大きさ（`GRIP_SUCCESS_LIMBS`）だけを調整する。

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): add grip success arm hand vfx`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
