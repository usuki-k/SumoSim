Task-ID: ACTION-ART-02A1-HUD-ENGLISH-LOCALIZATION-BASELINE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 59761c1ba3e035e9def2e73097634ee6455f4fe9
Agent-Start-Head: 96f718e252761fb3ac45430a1103d8e44bd46c6a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS。

**変更したこと**
- 通常表示のProduct HUDを、英語の初回release baselineに切り替えた
  - 表示: `East` / `West`、`Maegashira 15 / 16`、`Asuiryu` / `Toshinofuji`、`Day 3`、`East Asuiryu Wins` / `Rematch`
- 固定のUI文言を、Phaser非依存の小さな境界 `boutHudCopy.ts`（`BoutHudCopy` / `ENGLISH_BOUT_HUD_COPY`）の1か所に集めた。将来の多言語化に備えたもの
- 方位のtagは、単語を略さない横長のpillにした（文字幅を測って幅を決める）
- fontは、日本語fontに依存しないLatin用のsystem serif（Georgia系）にした
- 英語のみの方針を、HUD spec / GAME_CONCEPT / ARCHITECTUREに最小限で記録した

**作らなかったもの**: localization framework、言語選択、locale検出、日本語のrelease resource、新しいdependency

**検証**
- `pnpm test` 249件PASS、`pnpm build` PASS、`tsc --noEmit` PASS、`git diff --check` PASS
- gameplayは未変更

**Known Untested**
- 実ブラウザでの描画smokeは **NOT RUN**
- 代わりに、Windowsの実際のGeorgia fontの寸法で、すべての英語の文字列が推奨サイズで枠に収まることを確認した（下記）
- **User Visual Check: REQUIRED**

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `59761c1`（ancestor）、Handoff-Mode GITHUB
- `59761c1..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `96f718e`
- Current Sourceと本Taskに食い違いはない（02AのHUD shell、fixture、formatterは、Reportに書いたとおりに存在した）

# Localization-ready Boundary

`src/game/presentation/boutHudCopy.ts`（新規、Phaser非依存）

```ts
interface BoutHudCopy {
  readonly east: string
  readonly west: string
  readonly rematch: string
  formatDay(day: number): string
  formatWin(side: BoutSide, wrestlerName: string): string
}
ENGLISH_BOUT_HUD_COPY = { east: 'East', west: 'West', rematch: 'Rematch',
  formatDay: (d) => `Day ${d}`, formatWin: (side, name) => `${East|West} ${name} Wins` }
sideLabel(copy, side)
```

- HUD view（`BoutHudView.ts`）と結果の文言（`formatOutcome`）は、copyを引数で受け取る
  - viewやSceneに、言語ごとの固定文言は残っていない（Sceneはdebug用の英語textのみ）
- `BoutScene` が `ENGLISH_BOUT_HUD_COPY` を明示的に渡す（初回releaseは英語のみ）
- 意味のdataとUI文言を分けた
  - `formatRecord` は数値の `2-0` で、言語に依存しないのでpresentation側に残した
  - 四股名と番付はlocale解決済みの表示文字列として、contextのfixtureに入れる
  - 番付のenumや番付のruleは作っていない
- 型のimportは、`boutHudCopy.ts` ↔ `boutHudPresentation.ts` の相互参照だが、どちらも `import type` だけで、実行時の循環はない

# English Fixture（`PROTOTYPE_HUD_FIXTURE`）

source commentで「sample English presentation data, not game content」「sample romanized display names (no shikona generation or romanization rules)」と明記した。

| | participant | rankLabel | name | record |
|---|---|---|---|---|
| East | `wrestler-a` | Maegashira 15 | Asuiryu | 2-0 |
| West | `wrestler-b` | Maegashira 16 | Toshinofuji | 1-1 |

day: 3（`Day 3`）。

presentation contextはSimulationの外のままで、結合keyはparticipant idだけ。

# HUD View Changes（`BoutHudView.ts`）

- 外枠のzoneは変更なし: East (24, 24, 440, 150)、West (1456, 24, 440, 150)、Day chip (810, 10, 300, 44)
- 方位の表示: 38pxの正方形の「東 / 西」から、**単語を略さない差し色のpill** に変えた
  - 高さ36、横の余白12、最小幅76、文字28px（生成り色）
  - 幅は実際の文字幅から決める
  - 番付との間隔は12px
  - 西は鏡像（pillは右端、textは右寄せ）
- Font: `Georgia, "Times New Roman", Times, serif`（system fontのみ。assetや依存の追加はない。Provisional）
- 色、パネル、行の配置、文字サイズ（番付30→28、四股名48 bold→36、成績32、日目30）は、02Aから変更していない

## English Fit（Windows Georgiaで実測。PILで計測）

| 文字列 | 実測の幅 | 使える幅 | 結果 |
|---|---|---|---|
| `East`（28px） | 54px → pill 78px | — | 単語のまま |
| `West`（28px） | 63px → pill 87px | — | 単語のまま |
| `Maegashira 15 / 16`（30px） | 190 / 191px | 308 / 299px（pillを除く） | 推奨サイズのまま |
| `Asuiryu`（48px bold） | 194px | 398px | 推奨サイズのまま |
| `Toshinofuji`（48px bold） | 288px | 398px | 推奨サイズのまま |
| `Day 3`（30px） | 76px | 300px | 余裕あり |

E / Wに略す必要はなかった。

# Long-text Robustness

`fitSingleLine`（推奨サイズ → 2px刻みで最小サイズまで縮める → 省略）は変更していない。英語用のtestを追加した。

- 推奨サイズのまま: `Maegashira 15 / 16`、`Asuiryu`、`Toshinofuji`
- 縮小
  - `Wakatakakageumi` → 44
  - `Kotoshoryunoyama` → 40
  - 長い番付 `Komusubi (Sekiwake)` → 28
- 省略
  - `Kotoshoryunosukenoumi-Fujinohana` → 36pxで、収まる最長のprefix + `…`
  - `Maegashira 15 East (Makuuchi Division)` → `Maegashira 15 Ea…`
- surrogate pairを分けない場合と、省略記号だけになる場合

# Result Text

挙動は同じ。
- ongoing → 空
- 勝ち → `East Asuiryu Wins` / `West Toshinofuji Wins`
- 同時 → `Rematch`

結果画面の設計はしていない。

# Tests

`boutHudPresentation.test.ts` を英語のbaselineに更新した（9件）。

- fixtureが2人で、participant idと東西の対応が正しい。BoutSceneのsetupと同じid
- 不一致のcontextを拒否する
- copy: `East` / `West`、`Day 3` / `Day 15`、数値の成績、勝ち（両側）/ 同時 / 進行中
- **出荷されるHUDの言語の回帰**
  - 実際のcopyの出力、fixtureの文字列、成績、結果の文言を集めた
  - CJK / かなの文字がないことを確認した
  - 02Aの日本語の文言（`東`、`西`、`前頭十五枚目`、`朝翠龍`、`日目`、`勝ち`、`取り直し` など）がないことを確認した
  - repository全体のチェックではない。docsやcommentは対象外
- architecture
  - copyとpresentationのmoduleがPhaser非依存である
  - `BoutTypes.ts` と `BoutSimulation.ts` に、HUDのmetadataの語（`rankLabel`、`BoutHud`、`day`）がない
- text fit: 上記の英語のcaseと、従来のcase

| 項目 | 結果 |
|---|---|
| `pnpm test` | **249 passed**（16 files） |
| `pnpm build` | PASS（chunkサイズの警告は以前からのもの） |
| `tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| 新しいdependency | なし |

# Docs Sync

- `docs/ACTION_HUD_PRODUCT_SPEC.md`（最小限）
  - Status行: shellは実装済み、**初回releaseは英語のみ**、日本語は不要、英語で見た目を調整する
  - §3.1の例を英語にした（`East / West`、`Maegashira 15`、`Asuiryu`、`2-0`、`Day 3`）
  - §7.2の配置図、§7.3、§8の配置図のlabelを英語にした
  - §9に「言語の方針」を追加した
    - 意味のdata / locale解決済みの表示文字列 / 固定のUI文言を分けること
    - copy境界のmodule
    - 作らないもの（言語選択、catalog、i18n library、日本語pack、locale検出、CrazyGames SDK）
  - §9のfontの記述をLatin system fontに更新した
  - §14の「色だけで区別しない」を `East / West` に更新した
  - §17のDeferredに、追加の配信言語、言語選択、locale連携、ローマ字化のruleを加えた
- `docs/GAME_CONCEPT.md`: 確定事項に1行追加した
  - 「初回releaseの表示言語は英語のみ。将来の多言語化ができる構造にしておく（追加の配信言語はDeferred）」
- `docs/ARCHITECTURE.md`
  - HUD shellの項目を02A / 02A1にした（英語、copyの境界、frameworkは無い）
  - 結果の文言の説明を英語の文言に更新した

# Prototype / Debug

- 02Aから変更なし（debug OFFでは非表示、key `0` で左下に表示）
- debugのtextはもともと英語

# Browser Runtime Smoke

**NOT RUN**（Phaserのcanvasを表示して操作する手段がない）。

- dev serverで、`/`、`BoutScene.ts`、`BoutHudView.ts`、`boutHudPresentation.ts`、`boutHudCopy.ts` がHTTP 200
- 配信されたmoduleに、英語のfixture（`Asuiryu`、`Maegashira 15`）が含まれていることを確認した
- 描画の見た目、操作、debugの切り替え、console errorは、User確認で見ていただく必要がある

# User Visual Check — REQUIRED

`pnpm dev`（screenshotをお願いします）

1. `East` / `West` のpillが自然に見える
2. `Maegashira 15 / 16` が読める
3. 四股名が収まっていて、最も目立つ
4. `Day 3` の釣り合い
5. 外枠の大きさ
6. pillが番付を窮屈にしていない
7. 英語の字体がarenaに合う
8. 日本語のHUD textが残っていない
9. Actionの見やすさは従来どおり
10. 動作の重さは従来どおり

key `0` では、debug情報が出て、HUDは英語のまま表示され、gameplayは変わらないこと。

# Changed Files

- `src/game/presentation/boutHudCopy.ts`（新規）
- `src/game/presentation/boutHudPresentation.ts`
- `src/game/presentation/boutHudPresentation.test.ts`
- `src/game/scenes/BoutHudView.ts`
- `src/game/scenes/BoutScene.ts`（copyを渡すだけ）
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

補足（Taskで予期されていた、英語に合わせた小さな変更）：
- 方位のtagを、正方形から実測幅のpillに変えた
- fontをGeorgia系のLatin serifにした
- 外枠のzoneと階層は変更していない

# Unexpected Scope（報告のみ）

- 結果の文言（y = 110、64px、sans-serif）は、02Aと同じ位置と字体のまま
  - 結果の表示の設計はDeferredなので、変更していない
- Georgiaがない環境では、Times New Roman / serifのfallbackになる
  - 文字幅は実行時に測るので、fitの処理はfont差を吸収する

# Git Delivery

- Commit: `feat: switch product HUD to English baseline`（task-ownedの9ファイルのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
