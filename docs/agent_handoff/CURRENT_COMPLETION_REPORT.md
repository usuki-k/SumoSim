Task-ID: ACTION-ART-02A-HUD-SHELL
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 8bd9e0533d58fd6d06db687e8980ae7b80826f84
Agent-Start-Head: ece5d75b28a1c3d4375ce4e533196dad4d9ab0e5
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS。

**実装したこと**
- 常時表示のProduct HUD shellを実装した
  - 東西の識別ブロック: 方位tag「東 / 西」、番付、四股名、今場所の成績
  - 中央上部の日目chip
- データは、Phaser非依存のpure presentation context（明示的なprototype fixture）から供給する
- side / nameの正本は、このcontextの1つだけにした
- debug OFFのProduct表示では、Prototype / debugのtextをすべて隠した。key `0` では従来どおり表示する
- gameplayは未変更

**検証**: `pnpm test` 248件PASS、`pnpm build` PASS、`tsc --noEmit` PASS、`git diff --check` PASS

**Known Untested**
- 実ブラウザでの描画smokeは **NOT RUN**（ブラウザ操作の手段がない）
  - dev serverで、module変換とassetsの配信（HTTP 200）だけを確認した
  - 日本語fontの実際の描画は未確認
- **User Visual Check: REQUIRED**

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `8bd9e05`（ancestor）、Handoff-Mode GITHUB
- `8bd9e05..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `ece5d75`
- Current SourceとHUD specに食い違いはない（東 = `wrestler-a` = 左、西 = `wrestler-b` = 右）

# Presentation Context / View Model

`src/game/presentation/boutHudPresentation.ts`（新規、Phaser非依存）

- `BoutSide = 'east' | 'west'`
- `BoutHudWrestler { participantId, side, name, rankLabel, record { wins, losses } }`
- `BoutHudContext { day, wrestlers: [BoutHudWrestler, BoutHudWrestler] }`
- age / height / weight / publicParameters は入れていない（02Aでは不要）
- `assertHudContextMatches(context, participantIds)`: 東西が1人ずつで、participant idが一致することを確認する
  - Sceneの `create` で、snapshotのidと照合する
- `hudWrestlerBySide` / `hudWrestlerById`
- 表示のformatter（日本語の表示文字列を1か所に集めた。localization systemではない）
  - `formatSide` → `東` / `西`
  - `formatRecord` → `2-0`
  - `formatDay` → `3日目`
  - `formatOutcome` → `西 寿之富士 勝ち` / `同体 取り直し`
- `fitSingleLine(text, maxWidth, preferred, min, measure, step=2)`: 長いtextを1行に収める（下記）

HUDのmetadataは、`BoutSimulation` / `ParticipantState` / `BoutSnapshot` に入れていない（testで、BoutTypesにこれらの語がないことを確認）。

# Fixture Data

`PROTOTYPE_HUD_FIXTURE` は、sourceのcommentで「sample presentation data, not game content」と明記した。

| | participant | 番付 | 四股名 | 成績 |
|---|---|---|---|---|
| 東 | `wrestler-a` | 前頭十五枚目 | 朝翠龍 | 2-0 |
| 西 | `wrestler-b` | 前頭十六枚目 | 寿之富士 | 1-1 |

日目: 3

wrestlerのdatabase、番付のrule、場所の進行、永続化は作っていない。

# BoutScene Ownership Cleanup

- `PARTICIPANT_PRESENTATION` は、`id`、`controller`、`color`（暫定の力士色）、`label`（debug用の `PLAYER` / `CPU`）だけにした
  - `side` と `name` は削除した
  - 東西・四股名の正本は `PROTOTYPE_HUD_FIXTURE` だけになり、二重の所有がなくなった
- 結果の文言: `outcomeLabel` を削除し、`formatOutcome(snapshot.outcome, PROTOTYPE_HUD_FIXTURE)` を使う
  - 表示位置と、勝敗が決まったときだけ出る挙動は変えていない
  - 文言は `EAST PLAYER Win` / `Draw Rematch` から `東 朝翠龍 勝ち` / `同体 取り直し` に変わった
- `create`: Product土俵の後に、`assertHudContextMatches` → `createBoutHud(this, PROTOTYPE_HUD_FIXTURE)` を呼ぶ

# HUD View Implementation

`src/game/scenes/BoutHudView.ts`（新規）

- `createBoutHud(scene, context)` が、静的なHUD shellを作る
- Phaserの `Graphics`（角丸のパネル、枠、差し色）と `Text` だけを使う。画像assetは使わない
- depth 4（力士の影1・体2、debug overlay 3の上）
- Simulation stateは読まない（静的。更新は不要）
- 汎用のcomponent frameworkは作っていない

## 初期のlayout（Provisional。spec §7.2と同じ）

| Zone | x, y, w, h |
|---|---|
| East identity block | 24, 24, 440, 150 |
| West identity block | 1456, 24, 440, 150 |
| Day chip | 810, 10, 300, 44 |

- いずれも、Action critical circle（中心(960, 540)、半径483px）の外にある
- 識別ブロックの中
  - 行の中心は、上端から32 / 84 / 128px
  - 外側に差し色の帯（10px）、内側の余白16px
  - 方位tagは38pxの角丸の正方形
- 西は鏡像: 帯とtagは右端、textは右寄せ

## Visual Styling（Provisional）

| 要素 | 値 |
|---|---|
| パネル | 生成り `#F2E8D5`、不透明度0.93、角丸6、墨色の枠2px（α0.85） |
| 文字 | 墨色 `#1F1A16`。方位tagの文字は生成り `#F6EEDF` |
| 差し色 | 東: 藍 `#34507A`、西: 朱 `#A3452F`（彩度を抑えた） |
| Font | system fontのみ: `"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS PMincho", serif`。新しいfont assetや依存は追加していない |
| 文字の大きさ | 番付30（最小28）、四股名48 bold（最小36）、成績32、方位tag28、日目30 |

東西は、方位tagの文字・左右の位置・差し色の3つで示す（色だけに頼らない）。肖像の枠、操作中の印、staminaは置いていない。

# Long-Text Behavior

`fitSingleLine`
1. 推奨サイズで収まればそのまま
2. 収まらなければ2px刻みで縮め、最小サイズまでで最初に収まるサイズを使う
3. 最小サイズでも収まらなければ、末尾を `…` で省略する（code point単位で、surrogate pairを分けない）

- 実際の幅は、viewが `Phaser.Text` の `width` で測る
- 適用している範囲
  - 四股名: 幅398px、48 → 36
  - 番付: 幅348px（方位tagの分を除く）、30 → 28
- 成績と日目は短い数値なので、固定サイズにした
- scrollやmarqueeはない

# Prototype / Debug Text Cleanup

| 要素 | debug OFF（Product表示） | debug ON（key `0`） |
|---|---|---|
| Dummy mode + 操作説明（1行にまとめた） | **非表示** | 左下 (24, 1030) |
| engagement / `pair v` | 非表示（従来どおり） | 左下 (24, 986) |
| 頭上の `PLAYER` / `CPU` label、phaseの文字列 | 非表示（従来どおり） | 表示 |
| 接触円、向き、組みの線、境界線 | 非表示（従来どおり） | 表示 |
| Product HUD | 表示 | 表示（隠さない） |
| 結果の文言 | 勝敗が決まったら表示 | 同じ |

- debug textは、左上のEast blockと重ならないように左下へ移した
  - Action critical circleの外にある（下端の境界は y 1023。engagementの行は中心から約570px）
- 1 / 2（Dummy mode）、R（restart）、0（debug）の機能はそのまま残した

# Gameplay Preservation

入力、移動、Push / Counter / Grip / Drive、Ring-out / Tokudawara、fixed step、Dummyの挙動、restartは未変更。
- HUDは読み取り専用のpresentation
- participantのspawn位置と東西の割り当ては変更していない

# Tests

新規 `src/game/presentation/boutHudPresentation.test.ts`（8件）

- fixtureが2人で、participant idがBoutの参加者と一致する
  - BoutSceneの `PROTOTYPE_SETUP` にある `wrestler-a` / `wrestler-b` もsourceで確認した
- 東西が1人ずつで、正しく対応する（東 = `wrestler-a`）
- 不一致のcontextを拒否する（同じside、同じid、未知のid、参加者数）
- formatter: 方位、成績、日目、結果（勝ち / 取り直し / 進行中）
- Phaser非依存であること。BoutTypesにHUDのmetadataの語がないこと
- `fitSingleLine`: 推奨サイズのまま / 縮小 / 最小サイズ / 省略 / surrogate pair / 省略記号だけになる場合

**回帰**

| 項目 | 結果 |
|---|---|
| `pnpm test` | **248 passed**（16 files） |
| `pnpm build` | PASS（chunkサイズの警告は以前からのもの） |
| `tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| 新しいdependency | なし（package / lockfileは未変更） |

# Browser Runtime Smoke

**NOT RUN**（Phaserのcanvasを表示して操作する手段がない）。

代わりにdev serverで、`/`、`main.ts`、`BoutScene.ts`、`BoutHudView.ts`、`boutHudPresentation.ts`、Product背景の2枚がHTTP 200で配信されることを確認した。

未確認のもの:
- HUDの実際の描画
- 日本語fontの描画（Windowsでは游明朝の想定。fontがない環境では、serifのfallbackになるか、文字が表示できない可能性がある）
- 操作、debugの切り替え、console error

# User Visual Check — REQUIRED

`pnpm dev`

**debug OFF**
1. 東の識別ブロックが読める
2. 西の識別ブロックが読める
3. 日目chipが読める
4. 土俵と徳俵の攻防を隠していない
5. 生成りのパネルがProduct arenaに合う
6. 東西の差し色が、役に立つが派手すぎない
7. 四股名が番付や成績より目立つ
8. 力士の大きさは従来どおり
9. Dummyや操作説明が消え、debugのPrototypeに見えない
10. 動作が重くなっていない

**key `0`**
- debug情報（左下のmode / 操作説明 / engagement、頭上のlabel / phase、図形）が出る
- HUDは表示されたまま
- gameplayは変わらない

調整できる値（色、大きさ、位置）はすべてProvisional。

# Docs

`docs/ARCHITECTURE.md` を最小限で同期した（今回の変更で事実と異なる記述になったため）。
- Product HUDの項目の「仕様のみ・未実装」を外した
- 「HUD shell（ACTION-ART-02A）」の1項目を追加した（view model、fixture、描画、所有、debug textの扱い）
- Ring-outの段落にあった結果の文言の説明（`EAST|WEST <name> Win`、PLAYER / CPUのfallback）を、HUD contextを使う現在の文言に更新した

# Changed Files

- `src/game/presentation/boutHudPresentation.ts`（新規）
- `src/game/presentation/boutHudPresentation.test.ts`（新規）
- `src/game/scenes/BoutHudView.ts`（新規）
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

補足（Provisionalな選択として報告するもの）：
- 名前と番付の字体を明朝系のsystem fontにした（墨の文字という方向に合わせた）
- 四股名はboldにした
- 結果の文言を日本語にした（`東 朝翠龍 勝ち` / `同体 取り直し`）。結果画面の設計はしていない

# Unexpected Scope（報告のみ）

- 日本語fontのない環境（一部のLinuxなど）では、四股名や番付が表示できない可能性がある
  - 本Taskでは新しいfont assetを追加しないので、未対応
  - Productのfontの選定（licenseを含む）は、spec §9でDeferredとされている
- 結果の文言（y = 110、64px）は、勝敗が決まった後に上の徳俵の付近へ重なる（以前と同じ位置）
  - 結果の表示の設計はDeferredなので、変更していない

# Git Delivery

- Commit: `feat: add product bout hud shell`（task-ownedの6ファイルのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
