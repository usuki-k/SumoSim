# ACTION_HUD_PRODUCT_SPEC — Bout画面 Product HUD仕様

Status: Product HUDの正本（ACTION-ART-02）。常時表示のHUD shellは実装済み（ACTION-ART-02A / 02A1）。取組前の比較表示は未実装。
表示言語: **初回releaseは英語のみ**（Accepted）。Product HUDの見た目の調整は英語で行う。日本語は初回releaseに不要。将来の多言語化に備えた小さな文言の境界だけを持つ（§9）。
対象: 現在のAction Prototype（1920×1080 logical、Product背景を統合した後のBout画面）。

この文書で使う区分：

- **Accepted**: Userが承認した方針。実装はこれに従う
- **Recommended / Provisional**: 実装の出発点として推奨する値。User Visual Checkで変えてよい
- **Deferred / Unresolved**: 本仕様では決めない。後続のTaskで決める

ここに出てくる名前・番付・成績・数値は、すべて**表示の例**であり、内容として確定したものではない。

---

## 1. Purpose / Product goals（Accepted）

1. **相手をすぐに特定できる**: 東西それぞれの名前・番付・今場所の成績が、一目でわかる
2. **場所の文脈**: 今が場所の何日目かが常にわかる
3. **Actionが読みやすい**: 土俵・徳俵・力士の動きを主役にする。HUDは邪魔をしない
4. **情報を公開する**: 力士の公開パラメータは、隠さずに取組前に見せる
5. **Product背景の読みやすさを保つ**: 受理済みの暖色系arenaの上で読め、かつarenaを不必要に隠さない

## 2. Information hierarchy

| 層 | いつ見えるか | 内容 | 状態 |
|---|---|---|---|
| A. 常時表示のBout HUD | Action中ずっと | 東西の名前・番付・今場所の成績、日目 | Accepted（本仕様で定義） |
| B. 取組前の比較表示 | Actionが始まる前 | Aの内容に加えて、年齢・身長・体重・すべての公開パラメータ | Accepted（本仕様で定義） |
| C. Debug / Prototypeの情報 | 開発中のみ | 操作説明、Dummyのmode、engagement、phase、接触円など | 開発用。Productでは表示しない（§13） |
| D. Deferredのprofile情報 | 未定 | 出身地、顔の肖像など | Deferred（§11、§12） |

Bの情報（年齢・身長・体重・パラメータ）は、Action中に常時表示**しない**。

## 3. 常時表示のBout HUD（Accepted）

### 3.1 必須の項目

| 項目 | 東（画面の左） | 西（画面の右） | 表示例（英語。初回release） |
|---|---|---|---|
| 方位のlabel | 東 | 西 | `East` / `West` |
| 番付 | ○ | ○ | `Maegashira 15` |
| 四股名（ローマ字の表示名） | ○ | ○ | `Asuiryu` |
| 今場所の成績（勝-敗） | ○ | ○ | `2-0` |
| 日目（場所の文脈。中央に1つ） | — | — | `Day 3` |

- 東は画面の左、西は画面の右に置く。Current Sourceの配置（東 = `wrestler-a`、土俵の左側x = −0.7からstart）と一致する
- 左右の割り当ては、presentationで決める（§5）
- 成績は「勝ち数-負け数」を基本にする。休場などの扱いはDeferred（§15）

### 3.2 常時表示しないもの

- 年齢、身長、体重、公開パラメータ（Bでのみ表示）
- realtimeのstamina bar（§10）
- 顔の肖像（§11）
- 出身地（§12）
- Debugの文字列（§13）

### 3.3 プレイヤーが操作している力士の表示（User Decision）

現在のPrototypeでは、`PLAYER` / `CPU` のdebug labelでしか区別できない。Productでも、どちらを操作しているかを示す必要があるかもしれない。

- 推奨: 東西それぞれの識別ブロックに、小さな「操作中」の印（例: `YOU` / `自`）を置ける枠を用意する。表示するかどうか、どう表示するかはUserが決める
- 決まるまでは、その枠を空けたままでもレイアウトが成り立つようにする

## 4. 取組前の比較表示（Accepted）

### 4.1 必須の項目（東西それぞれ）

- 四股名
- 番付
- 今場所の成績
- 年齢
- 身長
- 体重
- **最終設計に存在するすべての公開パラメータ**

### 4.2 公開パラメータは件数が変わる前提で作る

公開パラメータの一覧は**未決**である。本仕様では、名前・件数・値の範囲・計算式・gameplayへの効果を一切決めない。

レイアウトは、件数が変わることを前提に次のように作る。

- **行の一覧（table）として表示する**: 1つのパラメータを1行にし、`東の値 | 項目名 | 西の値` の3列で並べる。項目名は中央の列に1回だけ書く
- 行の並び順、groupの見出し（例: 「体格」「技術」）は、データ側から渡す。表示側で固定しない
- 行が多すぎて1画面に入らない場合の扱い（2段組、ページ送り、scroll）は、**パラメータ一覧が決まってから決める**（Deferred）。それまでのPrototypeでは、目安として最大で約12行を1画面に入れる（§8）
- 値の比較bar（どちらが上かを示す棒）は、値の範囲が決まっていないのでDeferred。最初は数値（または表示用の文字列）だけを出す
- 「確定した数値ではない」sampleの行を使う場合は、fixtureであることがわかる名前にする（§16）

## 5. Data ownership

**原則（Accepted）**: HUDのために、長期のwrestler / tournamentのmetadataを `BoutSimulation` や `ParticipantState` に入れない。

```
Management / Wrestler / Tournament State   （将来。未実装）
        ↓
Bout presentation context / view model     （将来。pure TypeScript）
        ↓
Phaser HUD

BoutSimulation → BoutSnapshot → Action rendering   （既存。HUDのmetadataは通らない）
```

| 項目 | 現在のsource（Current Source） | 将来の持ち主 | 備考 |
|---|---|---|---|
| participant id | `BoutSetup` / `BoutSnapshot`（既存） | 同じ | HUDと力士を結び付ける唯一のkey |
| 東西 | `BoutScene` の `PARTICIPANT_PRESENTATION.side`（presentationの暫定値） | Tournamentの取組（将来） | Simulationには入れない |
| 画面の左右 | 東 = 左、西 = 右（presentation） | presentation | 東西から決まる |
| 四股名 | 無し（`name` は未設定で、`PLAYER` / `CPU` をfallbackにしている） | Wrestler profile（将来） | |
| 番付 | 無し | Management / 番付（将来） | 表示用の文字列はlocalizationで作る |
| 今場所の成績 | 無し | Tournament state（将来） | 集計のruleはDeferred |
| 日目 | 無し | Tournament state（将来） | 15日制などの場所のruleはDeferred |
| 年齢・身長・体重 | 無し | Wrestler profile（将来） | 体格がgameplayに影響する場合も、profileの値を `BoutSetup` へ**変換して渡す**（ARCHITECTUREの方針）。HUDはprofileの値を表示し、Snapshotからは読まない |
| 公開パラメータ | 無し | Wrestler / Management（将来） | 一覧はUnresolved |
| 勝敗の結果 | `BoutSnapshot.outcome`（既存） | 同じ | Simulationが正本 |
| engagement / action / posture | `BoutSnapshot`（既存） | 同じ | 現在はdebug表示のみ |
| 操作者（Player / CPU） | `BoutScene` の `controller`（presentation / input） | 入力の割り当て（presentation） | Simulationには入れない |
| 表示の文言（ラベル・数字の書式） | Sceneに直書き（英語） | localization（presentation） | §9 |
| 出身地 | 無し | Wrestler profile（Deferred） | §12 |
| stamina | 無し | 公開パラメータになった場合のみ、その値 | §10 |

「将来」と書いたsystemは、**どれも未実装**である。

## 6. Product visual direction（Accepted）

- 受理済みのarenaに合う、暖色系の伝統的な相撲の意匠
- パネルは温かみのある生成り色・和紙のような地（例: `#F2E8D5` 前後）
- 文字は墨のような濃い色で、高いcontrastにする（例: `#1F1A16` 前後）
- 東西の差し色は控えめな赤と青（例: 藍に近い青、朱に近い赤）。彩度を抑えて、背景と喧嘩させない
- 様式化したgame UIにする。テレビ中継の画面を写さない（配置・枠の形・書体・色の組み合わせを真似しない）
- sponsorやlogoの表示は無し
- 顔の肖像は不要（§11）
- 色の値はすべてRecommended。最終値は実装時のUser Visual Checkで決める

## 7. 1920×1080 layout zones（Recommended / Provisional）

### 7.1 守る領域（幾何から導いたもの）

art中心は (960, 540) で、Current Sourceでは次の位置になる。
- 基本の土俵半径: 400px
- 徳俵の外縁: 421px
- 力士の半径: 約62px

| 領域 | 定義 | 範囲 |
|---|---|---|
| **Action critical circle** | 徳俵の外縁 421 + 力士の半径 62 = 中心から **483px** | 境界の上にいる力士の体まで含む。**HUDは入らない** |
| Protected presentation radius | 背景specで受理済みの約532px | 大きなパネルはこの外に置くことを推奨する |
| 土俵の正方形の台 | 描かれた台はおよそ x 370–1550 | 台の上に被せるのは、上の角まわりの小さな要素だけにする |

上下の余白は狭い。上の徳俵の上端は y = 119 で、そこに立つ力士の体の上端は約 y = 58 になる。そのため、**中央上部に置けるのは高さ約45pxまでの小さな要素だけ**である。

### 7.2 Zone（Recommended / Provisional）

| Zone | 位置（x, y, w, h） | 内容 |
|---|---|---|
| East identity block | (24, 24, 440, 150) | 東の識別ブロック（左上） |
| West identity block | (1456, 24, 440, 150) | 西の識別ブロック（右上。左右を鏡像にする） |
| Day chip | (810, 10, 300, 44) | 日目。中央上部の小さなchip |
| 操作中の印（UD） | 識別ブロックの中の小さな枠 | §3.3 |
| Prototypeの操作説明（暫定） | 左下 (24, 1020) 付近の1行 | Productでは削除または差し替え（§13） |

検算（中心からの最短距離）：
- East blockの内側の角 (464, 174) は約616px
- Day chipの下端の中央 (960, 54) は486px
- どちらも critical circle（483px）の外にある

```
 x:0        464             810   1110             1456        1920
 y:0  +-----------+         +-------+           +-----------+
      |[East] Rank|         | Day 3 |           |Rank [West]|
      | Name      |         +-------+           |      Name |
      | 2-0  (自)  |                             | (自)  1-1  |
 174  +-----------+     .-----------------.     +-----------+
                      .'  (徳俵 上 y≈119)   '.
                     /                       \
                    |      土俵 (R=400)       |      <- Action critical
                    |   東 ●         ● 西     |         circle r=483
                     \                       /          にHUDは入らない
                      '.                   .'
                        '-----------------'
 1020  操作説明（Prototypeのみ）
 1080 +--------------------------------------------------------------+
```

### 7.3 識別ブロックの中身（Recommended）

- 1行目: 方位label（`East` / `West`。単語の幅に合わせた差し色のpill）と番付。番付は小さめの文字（目安28–32px）
- 2行目: 四股名。最も大きい文字（目安44–48px）
- 3行目: 今場所の成績（目安36px）と、操作中の印の枠
- 西のブロックは、要素を右寄せにした鏡像にする
- 背景のパネルは不透明度 ≥ 0.9 にして、arenaの細かい模様の上でも読めるようにする
- 将来の力士Product artとの共存
  - 力士は土俵の内側を動くので、識別ブロック（四隅）とは重ならない
  - 力士の頭の上にlabelは付けない（debugのPLAYER / CPU labelは廃止する。§13）

## 8. 取組前の比較表示のlayout（Recommended）

- 全画面のoverlayにする。背景のarenaを暗くするかぼかし、その上にパネルを置く
- Actionが始まる前に表示する。遷移のanimationはDeferred
- 構成（肖像は使わない）

```
 +----------------------------------------------------------------+
 |                         Day 3                                  |
 |   [East]  Maegashira 15                  Maegashira 12  [West]   |
 |           Asuiryu                                 (Name)        |
 |         2-0                                      1-1           |
 |   ------------------------------------------------------------ |
 |          25        |      Age        |        29               |
 |         182 cm     |     Height      |       178 cm            |
 |         148 kg     |     Weight      |       161 kg            |
 |   ---------------- | [public params] | ----------------        |
 |          (値)      |    (項目名)     |       (値)              |
 |          ...       |      ...        |       ...   (件数可変)   |
 +----------------------------------------------------------------+
```

- 名前の欄は、肖像の代わりに、方位tagと控えめな差し色の帯で東西を示す
- 項目名は中央の列に1回だけ書く。東の値は右寄せ、西の値は左寄せにして、中央へ向けて読む
- 行の高さの目安は48px。パラメータ部分には約12行を入れる（§4.2）
- 長い名前と長い番付への対応は§9、§14に従う

## 9. Localization / text robustness

CrazyGamesで国際的に配信するので、特定の言語の固定幅のラベルに依存しない。

**言語の方針（Accepted、ACTION-ART-02A1）**
- 初回releaseの表示言語は**英語のみ**。Product HUDの見た目の調整は英語で行う。日本語は初回releaseに含めない
- 将来の多言語化を難しくしない: 意味のdata（数値、id、side）と、locale解決済みの表示文字列と、固定のUI文言を分ける
- 固定のUI文言（`East` / `West`、`Day N`、勝敗の文言）は、小さなpure module（`src/game/presentation/boutHudCopy.ts` の `BoutHudCopy` / `ENGLISH_BOUT_HUD_COPY`）の1か所に置く。他の言語は、同じ形のcopyを渡せば足りる
- 四股名と番付は、Management / 番付systemが無いので、locale解決済みの表示文字列としてcontextに入れる（番付のenumなどは作らない）
- 作らないもの: 言語選択、locale設定画面、翻訳catalog / JSON、外部i18n library、日本語の翻訳pack、browserやplatform（CrazyGames SDK）のlocale検出。これらと追加の配信言語はDeferred

| 層 | 責任 |
|---|---|
| 意味のfield | view modelが持つ（例: `rank`、`wins`、`losses`、`day`） |
| 表示の文字列 | localizationが作る（初回releaseは英語: `Maegashira 15` / `Day 3` / `2-0`。将来の他言語の例: 日本語 `前頭十五枚目` / `3日目`） |
| layout | 文字列の長さが変わっても崩れないようにする（縮小、省略） |

- HUDのlayoutは、特定の言語の文字数を前提にしない
- 初回releaseの四股名はローマ字の表示名。ローマ字化のruleや四股名の生成はDeferred
- 本格的なlocalization systemは作らない（Deferred）。最初は、表示の文字列をpresentationの1か所に集めておくだけでよい
- Fontについて
  - 初回releaseは英語のみなので、HUDはLatin文字用のsystem font（serif系。font assetなし）を使う。日本語fontへの依存はない
  - Productのfontの選定（licenseを含む）はDeferred
  - 将来、CJKなどの言語を追加する場合は、その言語を表示できるfontが必要になる

## 10. Staminaの扱い（Accepted）

- 現在のProduct HUDには、**realtimeのstamina bar（減っていく表示）を置かない**
- 将来Staminaが公開パラメータとして存在する場合は、その**基本値**を、取組前の比較表示に他のパラメータと同じ形で出す
- staminaの計算式、最大値、減り方、回復、realtime表示は決めない（Deferred）

## 11. 顔の肖像の扱い（Accepted）

- Product v1のHUDに、**顔の肖像は不要**
- 肖像を前提にしたlayoutにしない（比較表示も識別ブロックも、肖像なしで成り立つ）
- ランダムな肖像の生成は、Product artの別featureとしてDeferred

## 12. 出身地の扱い（Accepted）

- 出身地は、常時表示のBout HUDには**不要**
- 将来のprofileの任意項目として扱う（Deferred）。外国出身の力士などを導入する際に検討する
- 取組前の比較表示の必須項目にもしない
- 出身地の生成や国籍のruleは作らない

## 13. Prototype debug textからの移行

Current Source（`BoutScene.ts`）の文字列と、その扱い：

| 現在の文字列 | 現在の表示 | 分類 | Productでの扱い |
|---|---|---|---|
| `DUMMY: STATIONARY / PUSH` | 常時（左上） | Debug / 開発専用 | Productでは表示しない（Dummyは検証用のharness） |
| `WASD move  Up push/drive ...  0 debug` | debug OFFのとき | 暫定の操作説明 | Productの操作説明・tutorialは別に設計する（Deferred）。それまでは左下へ移すか、debugのみにする |
| `(1: stationary / ...)` | debug ONのとき | Debug | debugのみ |
| `ENGAGE: FREE / GRAPPLED / MOROZASHI (...)`、`pair v` | debug ONのとき | Debug | debugのみ |
| 力士の頭上の `PLAYER` / `CPU` | debug ONのとき | Debug | debugのみ。Productの「操作中」の表示は§3.3 |
| 力士の頭上の `KUZUSHI`、`COUNTER`、`PUSH`、`READY`、`TURNING n°` など | debug ONのとき | Debug | debugのみ。崩しや反撃をProductでどう見せるか（演出）はDeferred |
| `EAST PLAYER Win` / `Draw Rematch` | 勝負が決まったとき | **実際のProduct情報**（勝敗）。表示形式は暫定 | 勝敗の伝え方（結果画面、決まり手など）はDeferred。四股名が入れば `PLAYER` / `CPU` のfallbackは消える |
| 接触円、向きの印、組みの線、Ring-out境界の線 | debug ONのとき | Debug | debugのみ |

Product HUDを実装しても、これらはgameplayに影響しない。表示を隠したり削除したりしても、gameplayは失われない。

## 14. Accessibility / readability

- **Contrast**: 濃い文字（墨色）を明るいパネルに置き、細かいarenaの上でも読めるようにする。パネルの不透明度は ≥ 0.9。文字を背景に直接置かない
- **文字の大きさ**
  - CrazyGamesの埋め込みでは、1920×1080が半分程度（例: 960×540）に縮小されて表示されることを想定する
  - Productの文字は、logical **28px以上**（表示上14px以上）にする
  - 名前や成績など重要な値は36px以上にする
- **東西を色だけで区別しない**: 方位label（`East` / `West`。略さない）、左右の位置、差し色の3つで示す
- **長い名前・長い番付**
  - 枠の幅を超える場合は、まずfontを最小値（名前36px、番付28px）まで縮める
  - それでも入らない場合は、末尾を省略（…）する
  - 取組前の比較表示では、省略しない全文をどこかに表示する
- **Actionを隠さない**: HUDはAction critical circle（§7.1）に入らない。土俵の縁と徳俵の上での攻防は常に見えるようにする
- 本格的なaccessibilityの仕組みは作らない

## 15. 将来のdata contractの方向（Recommended。実装しない）

最小のpresentation modelの例を示す。名前や型は、実装時にCurrent Sourceに合わせて最小化してよい。

```ts
// Pure TypeScript（Phaser非依存）。BoutSetup / BoutSnapshot とは別。
type BoutSide = 'east' | 'west'

interface PublicParameterView {
  readonly key: string        // 意味のkey（安定した識別子）
  readonly label: string      // 表示名（localization済み）
  readonly value: string      // 表示用に整形済みの値
  readonly group?: string     // 任意の見出し
}

interface BoutWrestlerPresentation {
  readonly participantId: ParticipantId   // BoutSetup / Snapshot と結び付ける唯一のkey
  readonly side: BoutSide
  readonly name: string
  readonly rankLabel: string              // 番付の表示文字列（番付systemは未定なので文字列で受ける）
  readonly record: { readonly wins: number; readonly losses: number }
  readonly ageYears: number
  readonly heightCm: number
  readonly weightKg: number
  readonly publicParameters: readonly PublicParameterView[]
  readonly controlledByPlayer?: boolean   // §3.3 のUser Decision次第
}

interface BoutPresentationContext {
  readonly day: number                    // 場所の何日目か
  readonly wrestlers: readonly [BoutWrestlerPresentation, BoutWrestlerPresentation]
}
```

- この形は `ParticipantState` に**入れない**
- `BoutScene` は、`BoutSetup` とは別の入力としてこれを受け取る。participant idで力士と結び付ける
- 現在の `PARTICIPANT_PRESENTATION` のうち `side` / `name` / `label` は、将来これに置き換わる。`controller` はinputの割り当てとしてSceneに残る
- 番付、成績の集計、日目を作るのは、将来のManagement / Tournamentの役目。それまではfixtureで作る

## 16. Implementation staging（Recommended）

Product visualの進行を、未実装のManagementで止めない。

1. **ACTION-ART-02A — HUD shell（fixture data）**
   - §15の最小view modelをpure TypeScriptで作り、fixture（例の名前・番付・成績・日目）を明示する
   - Phaserで、識別ブロック2つとDay chipを実装する（パネルはGraphicsまたは単純な画像。最終textureは後で）
   - Prototypeのdebug textを、§13の分類に従って整理する（gameplayは変えない）
   - Gate: User Visual Check（読みやすさ、arenaとの調和、Actionを隠さないこと）
2. **ACTION-ART-02B — 取組前の比較表示（fixture data）**
   - 比較表示のoverlayを作る。開始前に表示し、入力でActionへ進む最小の流れにする
   - 公開パラメータは、fixtureであることが明確な仮の行で、件数が変わっても崩れないことを確かめる
   - Gate: User Visual Check
3. **Management / Tournamentとの接続**
   - それらのsystemができてから、fixtureを実データに置き換える

立合いなどBout全体の流れや、結果画面の設計は、それぞれ別のTaskにする。

## 17. Deferred / Unresolved（本仕様では決めない）

- Simulationの公開パラメータの最終一覧、値の範囲、計算式、効果
- 最終的な四股名、番付の名称
- 番付の昇降、場所の進行、成績の集計（休場などを含む）、場所の日程
- 出身地の生成、国籍のsystem
- 顔の肖像の生成
- staminaのgameplay、realtimeのstamina表示
- 比較表示で行が多い場合の扱い（2段組、ページ、scroll）、値の比較bar
- 結果画面、決まり手の表示、崩しや反撃などの演出
- 操作説明・tutorialのProduct設計
- touch / mobileの最終layout
- 最終的なlocalization system、追加の配信言語、言語選択、browser / platformのlocale連携、四股名のローマ字化のrule
- Productのfont（licenseを含む）
- 最終的なUIの音、animation、遷移
- 操作中の力士の表示（§3.3。User Decision）
