Task-ID: ACTION-ART-01-BACKGROUND-SPEC
Result: PASS
Branch: develop
Source-Baseline: 1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6
Agent-Start-Head: dd8b5d5b49574cf483642c63d73e43df376faaad
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Specification only）。

- Product用の背景と土俵について、次の内容を、実装やasset生成の前に確定できる形で定義した
  - 構図、解像度、Simulationとの厳密な幾何対応、layer構成、asset表、art brief、安全領域、responsiveな表示、形式と配置、作成手順、受け入れ基準、HUDとwrestlerへの引き継ぎ
- Gameplay（土俵の半径、Ring-outの基準）、cameraの方式、Production sourceは変更しない
- 論理解像度の変更は、後続の統合Taskでのpresentationの変更として扱える
- BLOCKEDになる点はない
- Userの決定が必要な事項は、推奨既定値とともに列挙した
  - 特に、俵のどの線をRing-outの境界にするか（UD-A3）と、真上視点か（UD-A2）は、画像を作る前に決める必要がある

Production Source / package / lockfileは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `1c5b033`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `1c5b033..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `dd8b5d5`
- 読んだもの: AGENTS.md、`package.json`、`src/main.ts`、`src/style.css`、`index.html`、`BoutScene.ts`、`DohyoView.ts`、`WrestlerView.ts`、`BoutTypes.ts`、`BoutSimulation.ts`、ARCHITECTURE.md、GAME_CONCEPT.md、VISUAL-01AのReview（`2b8d903`）

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Recommendation**: 本仕様の推奨
- **User Decision (UD)**: 画像を作る前にUserが決める事項
- **Deferred**: 後続Task

# Current Rendering Facts（Current Fact）

| 項目 | 値 |
|---|---|
| Phaserの論理size | 640×640（`main.ts`）、`Scale.FIT`、`CENTER_BOTH`。cameraは固定 |
| page | `#app`はviewportいっぱい。背景色は`#1c1c22`（css）/ `#2b2b33`（Phaser） |
| 土俵の半径（Simulation） | **2.275 m**（`PROTOTYPE_SETUP.arena.radius`）。実際の土俵の内径4.55 mの半分に相当する |
| 描画の倍率 | `RING_FILL_RATIO = 0.9`、土俵の半径 = 320 × 0.9 = **288 px**、つまり**約126.6 px/m** |
| 土俵の中心 | canvasの中心（320, 320） |
| 体の半径 | 0.35 m = **約44 px**（直径約89 px） |
| 初期位置 | (±0.7 m, 0) = 中心から±約89 px |
| Ring-outの判定 | **中心基準**: `hypot(center) > 2.275 m`ならOUT。境界ちょうどはIN（ACTION-06A、Accepted） |
| 現在の俵 | `DohyoView`が判定半径を**中心線**として描き、幅は`max(6, 0.09 m)`（約11 px）。蛇の目は外側へ+0.2 m、仕切り線は±0.35 m、長さ0.8 m |
| UI / debug | 左上: mode行（12, 10）、debug時のengagement（12, 30）。上部中央（y = 40）: 結果text。debug時は頭上にlabelとphase text |
| 力士 | 起動時に生成するGraphics textureの部品をContainerで回転（VISUAL-01A）。影は右下へ（+0.07R, +0.12R） |
| asset | なし（`public/`もない） |

640×640は暫定値であり、最終的な仕様ではない。

# Recommended Product Composition（Q1）— **16:9の横長**

- CrazyGames / desktopブラウザの標準的な表示領域は横長なので、正方形では左右が黒帯になって無駄になる
- 土俵を中央に置いて全体を見せ、左右の余白を将来のHUD（東西の力士の情報）と会場の雰囲気に使える
- Actionの読みやすさに必要なのは、土俵の周囲（押し出された後に体が見える範囲）。横長にしても上下の余白は確保できる
- mobileの縦画面は最終的な目標ではない（Deferred）

# Logical vs Authored Resolution（Q2）

| 区分 | 推奨 |
|---|---|
| **Phaserの論理size（runtime）** | **1920×1080**（Scale.FITのまま）。presentationの変更として、後続の統合Taskで切り替える |
| **実行時の画像** | 論理sizeと**1:1**の1920×1080。拡大縮小の補正を考えずに済み、座標をそのまま使える |
| **masterの画像（作業解像度）** | **3840×2160（2倍）**。将来の高DPI化や大きな表示にも描き直さずに対応できる |
| CSS / ブラウザでの表示 | FITで縮小・拡大する（ブラウザ側の仕事） |

- 1280×720の論理sizeは軽いが、画像を後で1920へ描き直す危険がある。2倍のmasterから書き出せば、どちらにも対応できる
- 論理sizeが変わるとtextの大きさや位置も変わる。これはpresentationだけの変更で、gameplayには影響しない

# Exact Dohyo Geometry Mapping（Q3、Q4）

**以下の数値はすべて、実行時の1920×1080での値。masterの値は×2。**

| 項目 | 値 |
|---|---|
| 土俵の中心（Simulationの原点） | **(960, 540)** |
| 判定半径（Simulationの2.275 m） | **400 px**（→ **175.82 px/m** = 400 / 2.275）。master: 中心(1920, 1080)、半径800 px |
| 体の直径（0.7 m） | **約123 px**（master約246 px） |
| 初期位置（±0.7 m） | (960 ± 123, 540) |
| 仕切り線（推奨の参照） | x = 960 ± 62（±0.35 m）、y = 540 ± 70（長さ0.8 m） |

**Ring-outの境界をどの線にするか（UD-A3）— 推奨: 判定半径 = 俵の外縁**
- 現在の描画（俵の中心線）では、俵に乗った状態でも中心がわずかに外へ出ると負けになり、「俵の上は内」という相撲の感覚と合わない
- 内縁を判定半径にすると、俵の上がすべてOUTになり、さらに合わない
- **外縁**にすると、「俵の上はIN、俵を越えて外の砂へ出たらOUT」という相撲の見た目と一致する。外縁は「明るい砂と俵」の境界なので、画像上でもいちばんくっきりした線になり、厳密に合わせやすい
- 俵の幅は**0.12 m（約21 px）**で、外縁 = 400 px、内縁 = 約379 px
- 見た目の土俵の内側（俵の内縁の内側）は、判定半径より少し小さく見えるが、gameplayの半径は変わらない（2.275 m）
- これはpresentationの変更だけで、`DohyoView`の俵を内側へ寄せる。Ring-outの規則は変えない

**中心基準との見た目の整合（Q4、Play Testで確認する危険）**
- 中心基準なので、負けの瞬間には体の約半分（最大0.35 m ≈ 62 px）が外縁より外へ出ている
- 外縁を境界にすると「完全に俵を越えた」と見えるので、早すぎる負けには見えにくい
- 逆に「少し遅い」と感じられる可能性がある
- 絵の側で「足が俵の外の砂に触れたら負け」を強く示唆する表現（足跡の線や、俵の外側の強調）は避ける。判定基準の見直しはACTION-06AでのDeferred（「代表的な絵ができたら見直す」）として、背景の統合後にPlay Testで確認する

# Background Layer Model（Q5、Q7）

1枚の絵ではなく、**会場と土俵の土台（描いた絵）+ 厳密な幾何の俵のoverlay**の2層を基本にする。

1. **`arena_base`**（不透明、全画面）
   - 描くもの: 会場、床、客席の暗がり、土俵の土台（台形の盛り土）と土の面、蛇の目の砂
   - **俵と仕切り線は描かない**（または、上のoverlayで完全に隠れる程度のぼかした下地だけ）
2. **`dohyo_ring_overlay`**（透過）
   - 描くもの: 俵の輪、外縁の陰と内縁の陰、仕切り線
   - **厳密な幾何**（中心 / 半径 / 幅）で作る。描いた絵の質感を、厳密なmaskで切り抜いたもの（Q25）
3. **`arena_ambient`**（透過、任意）
   - 描くもの: 周辺を暗くする効果、照明のむら
   - **力士の下**に置く（力士を暗くしない）

理由:
- 土俵の位置ずれ（Simulationとの不一致）をoverlayだけで直せる。全体を描き直す必要がない
- 会場違い（将来の別の場所）では`arena_base`を差し替えるだけで済み、overlayは使い回せる
- 力士より手前に重ねるforeground（柱、屋根など）は置かない。俵、Ring-outの領域、力士を隠すため（Q9）
- 実装も、画像3枚をdepth順に並べるだけで済む

# Exact Background Asset List（Q6）

すべて実行時は1920×1080。master（2倍、3840×2160）は別に保管する（Q20〜Q22）。

| file（実行時） | 用途 | 寸法 | alpha | 位置合わせ | depth（runtime） | v1で必須か |
|---|---|---|---|---|---|---|
| `arena_base.webp` | 会場、床、土俵の土台、土、蛇の目 | 1920×1080 | 不透明 | 左上を(0, 0)に合わせ、土俵の中心が(960, 540) | 0（最背面） | **必須** |
| `dohyo_ring_overlay.webp` | 俵（外縁 = 判定半径400 px、幅21 px）、仕切り線 | 1920×1080（中心が(960, 540)） | 透過 | 同上 | 0.5（baseの直上、力士の影より下） | **必須** |
| `arena_ambient.webp` | 周辺を暗くする効果、照明のむら | 1920×1080 | 透過 | 同上 | 0.8（力士の影より下） | 任意 |

- 力士の影（1）、体（2）、debug（3）、text / HUD（4以上）は、現在のdepthの順を継承する
- overlayはfileの大きさを抑えるため、800×800程度（中心が(400, 400)）のcrop版にしてもよい
  - その場合は「左上を(560, 140)に置く」ことを仕様として固定する（どちらにするかは統合Taskで決めればよく、絵の作成には影響しない）

# Safe Areas（Q8、Q9）

**HUDの安全領域**（背景は細部を抑え、明るさのむらを少なくして、暗めで均一な調子にする）:

| 領域 | 矩形（x, y, w, h） | 将来の用途の想定 |
|---|---|---|
| 左上 | (0, 0, 560, 200) | 東の力士の情報 |
| 右上 | (1360, 0, 560, 200) | 西の力士の情報 |
| 上中央 | (760, 0, 400, 110) | 取組の情報・題（使う場合） |
| 左下 | (0, 920, 480, 160) | 補助の情報 |
| 右下 | (1440, 920, 480, 160) | 補助の情報 |

**gameplayの安全領域**（装飾で覆わない、細部も控えめにする）:
- **保護する円**: 中心(960, 540)、半径**532 px**（土俵の400 px + Ring-outで外に出た体0.35 m + overshootの余裕約0.4 m ≒ 0.75 m ≒ 132 px）
  - y = 8〜1072、x = 428〜1492の範囲に収まり、HUDの領域とは重ならない
  - 上中央のHUD領域（y ≤ 110）は、土俵の上端（y = 140）より上で、保護する円の上端とわずかに重なる。上中央にHUDを置く場合は、y ≤ 100程度の細い帯に限る
- 行司（将来、決着後に表示する）、FX、力士の影も、この円の中で表示する
- この円の中には、背景の焼き込みによる人物や文字を置かない

# Officials / Crowd / Venue Scope（Q10、Q11）

| 区分 | 内容 |
|---|---|
| **Required（v1）** | 土俵の土台（真上から見た四角い盛り土。縁の斜面は細い帯として見える）、土の面、蛇の目、土台の周囲の床（板張りか土の地面）、四隅の控えの空間（塩の箱 / 水桶は小さな物として任意） |
| **Optional（v1）** | 保護する円の外にいる、暗く簡略な客席のsilhouette、審判（勝負審判）の座っているsilhouette（静止）、房の色（四隅の色の手がかり） |
| **Deferred** | 吊り屋根（真上視点では土俵を覆ってしまう）、動く観客、照明の演出、横断幕・文字、季節や会場の違い |

- **行司は背景に描かない**（決着後に動く独立した存在になるため。Accepted）
- 力士・行司・FXは常に独立したlayerにする

# Art Brief（Q12、Q16〜Q18）

- **様式**: stylized、手描きの2D game art（painted）。写実ではないが、chibi（頭身の低いデフォルメ）でもない。形が明快で、質感はやわらかい筆致。輪郭は黒い太線ではなく、少し暗い同系色の細い線
- **雰囲気**: 落ち着いた伝統的な和の空間。暖かい照明
- **palette**:
  - 土俵の土: やや灰みを帯びた砂色の土（肌の色と**明度で分ける**。後述）
  - 俵: 乾いた藁の金色
  - 蛇の目: 明るい細かい砂
  - 会場の外周: 暗い漆塗りの木と、濃い藍の布
- **contrast（重要）**:
  - 力士の肌（暖かいベージュ）と土の色相が近いので、**土は肌より明度を1段下げるか彩度を落とす**（目安: 肌と土の明度差L\*で15以上）
  - まわしの色（暫定は青と赤、将来は多色）は、土・俵の色（橙〜黄土）から離す
  - 俵は外側の明るい砂と、内側の土の両方に対して見分けられるようにする（外縁に細い陰を入れる）
  - HUDの領域は暗く均一な調子にする
- **細部の密度**:
  - 細部は土俵の外（会場）に集め、低いcontrastにする
  - 土俵の周り（俵）は中程度
  - **土俵の中央は、低い周波数の土の肌理（きめ）だけにする**（Actionと競合させない）
  - 縮小表示（約50%）でも潰れない大きさの形にする
- **土の跡**:
  - 細かく低いcontrastの、刷毛で掃いたような質感だけにする
  - 足跡や引きずった跡のような、**gameplayの出来事に見える模様は描かない**
  - 仕切り線の周りにも、意味のある模様を描かない

# Perspective（Q13）— 推奨: **真上からの正投影**（UD-A2）

- Simulationは平面で、等方的な円（土俵、体の接触）。meter → pixelの変換も縦横で同じ
- 斜めから見下ろすと土俵が楕円になり、円の接触判定や、体を回転させる表現と食い違う
- 立体感は「真上から見て、縁の斜面がわずかに見える」程度にとどめる（盛り土の側面を細い帯として見せる、影で高さを示す）
- 力士の部品の画像も、**真上から見て、陰影で少しだけ丸みを出す**形にする（3/4の斜め視点にはしない）。部品を回転させても違和感が出ない

# Lighting / Shadows（Q14、Q15）

- **光源は1つ**: 画面の**左上**、高い仰角（約60°）からの、やわらかい照明。現在の影の向き（右下）と一致する
- 背景の陰影、力士、将来の行司は、すべてこの向きで描く
- **力士の影は背景に描かない**。独立したlayer（現在と同じ）にし、柔らかい楕円で、不透明度0.25〜0.35、右下へ体の半径の約7〜12%ずらす

# Responsive Strategy（Q19）

- **v1: 16:9のFIT（letterbox）**。切り取りはしない。letterboxの色は会場の外周の暗い色に合わせる
- 将来の切り取り（cover）に備えて、masterの`arena_base`は上下左右に約5%の余白（描き足し）を持たせておく（実行時の書き出しには含めない）
- **切り取ってはいけない領域**: gameplayの保護円（半径532 px）とHUDの安全領域
- **切り取ってよい領域**: 画面の外周（客席の暗がり）

# Format / Paths / Master（Q20〜Q22）

- **実行時**:
  - WebP（不透明の`arena_base`はlossy、品質85前後。透過のoverlayはalpha付きの高品質lossyまたはlossless）
  - 主要なブラウザはすべて対応している。PNGのfallbackは不要
- **master**:
  - 2倍（3840×2160）のlayerごとのPNG（lossless）
  - 道具固有の形式（PSD / Krita / Aseprite）は、道具を決めた場合だけ追加する（**UD-A6**。道具は決めない）
- **配置**:
  - 実行時: **`public/assets/action/background/`**。Viteがそのまま配信し、Phaserのloaderで固定のURLで読める
  - master: **`art-source/action/background/`**。実行時の配信対象（public）にもbundleにも含めない
  - いずれのdirectoryも、統合Taskで明示的な許可が必要（AGENTS.md §5）
- 大きなmasterファイルが増えたら、Git LFSの採用を検討する（Deferred / UD）
- 実行時の書き出しとmasterの**両方**をrepositoryで管理する

# Generation / Revision Workflow（Q23、Q24）

全体の再生成を繰り返さないよう、承認を3段階に分ける。

1. **構図の承認**:
   - 本仕様の幾何（中心、半径、安全領域）を下敷きにした、低解像度のラフ（1枚）で、配置・明暗・会場の範囲を承認する
2. **仕上げの承認**:
   - 承認した構図に描き込み、2倍のmasterを作る
   - 修正は「部分の修正」で行う（全体を作り直さない）
3. **統合 / 切り取りの承認**:
   - 実行時の書き出しを統合し、ブラウザで確認する（幾何の確認用overlayを使う）

画像生成（AI）を使う場合に固定する条件:
- 真上の正投影
- **力士なし・行司なし・文字 / logo / HUDなし**
- 土俵は画面の中央で、指定の半径にする
- 安全領域を空けておく
- 光は左上から

画像生成では正確な幾何は保証されないので、**俵と仕切り線は生成画像に頼らず、厳密なoverlayとして別に作る**（Q25）。生成した`arena_base`に俵が描かれてしまった場合は、overlayで覆うか、手作業のmaskで消す。

# Exact Geometry Strategy（Q25）

**描いた土台 + 厳密なoverlay**:
- overlayは、正確な円（中心(960, 540)、外縁400 px、幅21 px）と仕切り線の矩形を**maskとして作り**、その形に藁の質感（描いたものを貼る）を流し込んで作る
- そのため、絵の質感を保ったまま幾何は1 pxの精度で一致する
- 土台の土の円は、overlayの内縁より大きめに描いておけば、多少ずれても隠れる

# Product Acceptance Checklist（Q26）

- [ ] Product品質に見える（試作ではなく、そのまま出せる）
- [ ] 後の力士の絵と同じ様式・視点・光で描ける（真上、左上の光）
- [ ] 一目で土俵と分かる
- [ ] **俵の外縁が、判定半径（中心(960, 540)、400 px）と1 px以内で一致する**（確認用overlayで検証）
- [ ] 仕切り線が仕様の位置にある
- [ ] contrast: 肌と土、まわしと土、俵と内外がはっきり見分けられる
- [ ] 力士・行司・文字・HUD・影が描き込まれていない
- [ ] HUDの安全領域が暗く均一で、保護円の中に装飾がない
- [ ] FITで表示したときに欠けがない。将来の切り取り用の余白がmasterにある
- [ ] 50%に縮小しても、細部が潰れて汚く見えない
- [ ] 土の跡が、gameplayの出来事に見えない

# Integration Handoff（Q27、Q28）

統合Taskで必要な作業:
- 論理sizeを1920×1080へ変更（`main.ts`）
- 倍率を「土俵の半径 = 400 px」に合わせる（`RING_FILL_RATIO`の代わりに、仕様の値から計算する）
- 3枚の画像のpreloadとdepth（Q6）
- 現在の`DohyoView`（Graphics）は、debugのfallbackとして残すか、確認用overlayへ置き換える
- textとUIの位置を新しい解像度に合わせて移す

**幾何の確認用overlay**（developer用。既定は非表示で、debugの`0`と一緒に表示する）:
- Simulationの中心（十字）
- 判定半径の円（細い線）
- 初期位置の円
- 仕切り線の参照位置
- 保護円とHUDの安全領域の枠

ブラウザで、俵の外縁が判定の円と重なることを目で確認する。

# HUD Handoff（Q29）

HUDの設計が引き継ぐもの:
- 16:9、論理1920×1080（masterは2倍）
- 安全領域（上の表）
- 土俵の外接矩形: (560, 140)〜(1360, 940)
- 保護円: 半径532 px
- 視線の優先順位: 土俵上の力士 > 結果表示 > 東西の情報 > 補助情報

HUDの具体的な要素は、本仕様では決めない。

# Wrestler Handoff（Q30）

部品を組み合わせて作る力士の設計が引き継ぐもの:
- 画面上の体の直径: **約123 px**（実行時。masterは約246 px）
- 視点: 真上からの正投影 + 陰影による少しの丸み（3/4の視点にはしない）
- 光: 左上、高い仰角、やわらかい
- 影: 独立したlayer、右下へずらす、不透明度0.25〜0.35
- 色: 肌と土の明度差を守る。まわしは土・俵の色相から離す
- 動ける範囲: 保護円（半径532 px）の中
- 回転は任意の角度（Simulationのfacing）。部品は回転しても破綻しない描き方にする

# User Decisions Required（Q31）

| # | 決定事項 | 推奨既定値 |
|---|---|---|
| UD-A1 | 主な画面比率と解像度 | 16:9。論理1920×1080、実行時の画像1920×1080（1:1）、masterは3840×2160 |
| UD-A2 | 視点 | 真上からの正投影（縁と影で少し立体感を出す）。斜め見下ろしは、土俵が楕円になり判定と食い違うので採らない |
| UD-A3 | Ring-outの境界線 | **判定半径 = 俵の外縁**（俵の上はIN）。俵の幅は0.12 m |
| UD-A4 | 会場の豊かさ | Required: 土台、床、四隅。Optional: 保護円の外の暗い客席と審判のsilhouette。屋根や動く観客はDeferred |
| UD-A5 | 客席と審判を背景に描き込むか | 描き込む（静止した暗いsilhouetteとして、保護円の外に）。行司は描かない |
| UD-A6 | master / 道具 | 書き出し + 2倍のlayer PNGのmasterを両方管理する。道具固有の形式は、道具を決めた時に追加する |
| UD-A7 | 背景の作り手 | 画像生成（AI）か、artist / 手描きか。どちらでも本仕様で作れる。推奨は、構図ラフの承認を先に行うこと |

# Deferred

- mobile / 縦画面
- 屋根、動く観客、照明の演出
- 会場の違い
- Git LFS
- 道具の選定
- 中心基準のRing-outの見直し（統合後のPlay Test）
- HUDの具体的な要素
- 力士の部品の仕様
- 行司の素材

# Next Product-art Task Sequence（Q32）

1. **ACTION-ART-01 Spec Review / User Decisions**（本Report）
2. **ACTION-ART-01A** 背景の構図ラフ → 承認 → 仕上げ（2倍のmaster）→ 承認（User visual approval REQUIRED）
3. **ACTION-ART-01B** 実行時の書き出し（3 layer）と統合（解像度の変更、倍率、depth、確認用overlay）→ ブラウザで確認（User visual check REQUIRED）
4. ACTION-ART-02 HUDの仕様 → 作成 / 統合
5. ACTION-ART-03 力士の部品の仕様 → 作成 / 統合

HUDや力士の作成を背景のTaskに混ぜない。

# Design Deviations

なし（Specificationのみ）。

# Unexpected Scope

なし。

所見:
- 実際の土俵の内径の半分（2.275 m）がSimulationの判定半径と一致しているが、相撲の「俵の上はIN」と中心基準の組み合わせでは、境界線の選び方で見た目の整合が変わる（UD-A3）
- 現在の`DohyoView`の俵（中心線）は、この推奨とは異なる。統合Taskでpresentationだけを直す

# Verification

- Q1〜Q32に回答済み。BLOCKEDになる点はない
- Current Sourceを直接確認した（上記の数値）
- Current Fact / Recommendation / User Decision / Deferredを分けて記載
- asset表と、幾何の対応の節を含む
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Specification）。User visual approvalは、後続の背景作成Task（01A）でREQUIRED。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): specify product bout background`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
