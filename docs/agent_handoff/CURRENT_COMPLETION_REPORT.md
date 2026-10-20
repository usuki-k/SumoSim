Task-ID: ACTION-ART-02B-PREBOUT-COMPARISON
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: f8ac92652a876b1ec82fe358ad9ed12e88fb91b7
Agent-Start-Head: 3245cb8d76fea8a7832fa2c83cae0f5146e061b6
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS。

**実装したこと**
- 取組前の比較表示を実装した。英語のfixtureで、東西の見出し、Age / Height / Weight、公開パラメータの全行を表示する
- Scene所有のpresentation phase（`'pre-bout' | 'active'`）を追加した
  - 待機中はSimulationを進めず、時間もためない
  - Enterで開始する。押下latchを消し、accumulatorを作り直す
  - Rで比較表示へ戻る
- Action HUD（02A1）は、待機中は隠し、開始後に変更なしで表示する
- 比較のデータは、presentation context（Simulationの外）にだけ置いた
- 公開パラメータは、明らかに仮の `Sample Stat A`〜`G`（7行）にした

**検証**
- `pnpm test` 257件PASS、`pnpm build` PASS、`tsc --noEmit` PASS、`git diff --check` PASS
- `BoutSimulation` / gameplayは未変更

**Known Untested**
- 実ブラウザでの描画と操作のsmokeは **NOT RUN**（ブラウザ操作の手段がない）
- 代わりに、Georgiaの実際の文字幅で、すべての文字列が推奨サイズで収まることを確認した
- **User Visual Check: REQUIRED**

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `f8ac926`（ancestor）、Handoff-Mode GITHUB
- `f8ac926..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `3245cb8`
- Current Sourceと本Taskに食い違いはない。`BoutSimulation` の変更も不要だった

# Presentation Context Extension（`boutHudPresentation.ts`）

- `BoutHudWrestler` に `ageYears`、`heightCm`、`weightKg` を追加した
  - presentationの値だけで、bodyRadius / Push / gameplayとは結び付けていない
- `PublicParameterComparisonRow { key, label, values: Record<BoutSide, string>, group? }` を追加した
  - 表示用の、locale解決済みの行
  - stat enum、範囲、計算式、効果は無い
- `BoutHudContext.publicParameterRows` を追加した。件数の上限は無い
- `buildComparisonRows(context, copy)`: Age / Height / Weight の3行の後に、供給されたすべての公開パラメータ行を順番どおり並べる
- `comparisonRowPitch(count, available, preferred, min)`: 収まれば行間48。収まらなければ下限32まで詰めるが、行は省かない（さらに多い場合の扱いはDeferred）

# Fixture Data

| | Age | Height | Weight |
|---|---|---|---|
| East / Asuiryu | 26 | 175 | 120 |
| West / Toshinofuji | 29 | 183 | 148 |

- 公開パラメータは、`Sample Stat A`〜`Sample Stat G` の7行（key `sample-stat-a`〜`g`）
- 値は例えば `72` / `64` のような表示用の文字列
- sourceのcommentに「Prototype comparison-layout data; not final game parameters」と明記した
- Power / Technique / Balance / Stamina のような、最終的なstatに見える名前は使っていない

# English Copy（`boutHudCopy.ts`）

- 固定の文言: `Age`、`Height`、`Weight`、`Press Enter to Start`
- formatter: `26 yrs`、`175 cm`、`120 kg`
- 公開パラメータのlabelと値は、contextから受け取る（すでにlocale解決済みの文字列）
- 言語選択、catalog、i18n library、locale検出、日本語のresourceは追加していない

# Views

- `src/game/scenes/HudStyle.ts`（新規）: HUDと比較表示が共有するstyle
  - palette、Georgia系のfont、紙のパネル、`inkText`、`setFitted`、`sidePill`
  - 値は02A1のものをそのまま移した
- `src/game/scenes/BoutHudView.ts`: 共有styleを使うように整理した
  - **見た目、zone、文字サイズは不変**
  - `createBoutHud` は、depth 4のContainerを返すようにした（`setVisible` で切り替える）
  - 毎frame作り直すことはしない
- `src/game/scenes/PreBoutComparisonView.ts`（新規）: `createPreBoutComparison(scene, context, copy)` は、depth 10のContainerを返す

## 比較表示のLayout（Provisional）

- 暗幕: 1920×1080の黒、α0.55。arenaは透けて見える。blurは使わない
- パネル: (240, 70, 1440, 940)。紙のパネル（HUDと同じ）
- 見出し（パネル上端からのoffset）
  - Day 3（46、32px）
  - 東西の列（中心 x 600 / 1320、幅560）に、side pill（108）/ 番付（156、32→28）/ 四股名（214、60 bold→40）/ 成績（272、34）
  - その下に、差し色の帯（312、高さ6）
- 比較表: 336から、`East値 | 項目名 | West値`
  - 項目名は中央の列（幅380、30→28）
  - East値は中央へ向けて右寄せ、West値は左寄せ（34→28）
  - 各行に薄い区切り線。Weightの後（公開パラメータの前）は濃い線
- 開始の案内: 墨色の角丸pillに生成りの文字 `Press Enter to Start`（下端から56、34px）
- 肖像、出身地、stamina、比較bar、sponsor / logoは無い
- groupの見出し: 型には `group?` があるが、**表示はDeferred**（fixtureに使わず、仮のgroup名も作らない）

## 実際のfont幅での確認（Windows Georgia）

| 文字列 | 幅 | 枠 |
|---|---|---|
| 四股名 60 bold | 245 / 358 | 560 |
| 番付 32 | 203 / 204 | 560 |
| 項目名 30（最長 `Sample Stat A/G`） | 187 | 380 |
| 値 34 | 最大107 | 452 |
| 開始の案内 34 | 293 | — |

長い文字列は、既存の `fitSingleLine`（縮小してから省略）で処理する。

# Pre-bout Flow（`BoutScene.ts`）

- `create`: 比較表示とHUDを作り、`enterPreBout()` を呼ぶ（比較表示を表示し、HUDを隠す）
- `update`: pre-boutの間は `syncViews(deltaMs)` だけを行って `return` する
  - **`accumulator.advance()` と `simulation.step()` を呼ばない**
  - 待機中に時間がたまって、開始後にまとめて進むことはない
- Enter（`KeyCodes.ENTER` の `down`）→ `startBout()`。pre-boutのときだけ有効
  1. 比較表示を隠す
  2. HUDを表示する
  3. Push / Counter / Gripの押下latchを消す
  4. accumulatorを作り直す
- `R` → `restart()`: 新しいBoutを作り、latchを消し、`dummy.reset()`（modeは保持）を呼んでから、`enterPreBout()` へ戻る
- 押しっぱなしの状態（WASD、Up = Drive）は、従来どおり開始後の各tickで読む。キューされたedgeではない

**BoutSimulationの変更は無い。**

Key `0`（debug）はそのまま。pre-bout中にONにしても、debugの表示は比較表示（depth 10）の下になるだけ。

# Tests

新規 `src/game/presentation/preBoutComparison.test.ts`（8件）

- fixtureの年齢・身長・体重
- 公開パラメータ: 6〜8行、keyが一意、labelが `Sample Stat X`、東西の値がある
- 英語のcopy: Age / Height / Weight、`26 yrs` / `175 cm` / `120 kg`、`Press Enter to Start`
- 行の順序: Age → Height → Weight → 公開パラメータを順番どおり
- **件数可変**: 0 / 1 / fixture（7）/ 12行で、行数、順序、label、値がすべて保たれる（省略しない）
- 行間: 3行と10行は48、15行は32.8（詰める）、40行は下限32、0行は48
- 出荷されるcopyと行の文字列にCJK文字が無い
- architecture
  - `BoutTypes.ts` / `BoutSimulation.ts` に、`ageYears` / `heightCm` / `weightKg` / `publicParameter` / `BoutHud` / `Comparison` の語が無い
  - viewは行を `forEach` で回す
  - Sceneはpre-boutのときに早期returnする

既存の `boutHudPresentation.test.ts`: 不正なcontextのfixtureに `publicParameterRows: []` を足しただけで、すべてPASS。

| 項目 | 結果 |
|---|---|
| `pnpm test` | **257 passed**（17 files） |
| `pnpm build` | PASS（chunkサイズの警告は以前からのもの） |
| `tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| 新しいdependency | なし |

# Runtime / Browser Smoke

**NOT RUN**（Phaserのcanvasを表示して操作する手段がない）。

- dev serverで、`/` と、変更・追加した7つのmodule（`BoutScene`、`BoutHudView`、`HudStyle`、`PreBoutComparisonView`、`boutHudPresentation`、`boutHudCopy`）がHTTP 200であることを確認した
- 待機中にSimulationが進まないこと、Enterで開始すること、Rで戻ることは、Sceneのcodeとsourceのtestでは確認した
- 実際の操作での確認はUserにお願いする

# Docs Sync

- `docs/ACTION_HUD_PRODUCT_SPEC.md`: Status行だけを更新した
  - 常時表示のHUDは実装済みでUser受理（英語baseline）
  - 比較表示は02Bで実装済み（Visual Check待ち）
  - fixtureの公開パラメータは仮で、Productのstatの決定ではない
- `docs/GAME_CONCEPT.md`: 「（実装は未着手）」を「（常時表示のHUDと取組前の比較表示の最初の実装あり。データはprototype fixture）」に直した。英語のみの初回releaseの文は保持した
- `docs/ARCHITECTURE.md`: 「取組前の比較表示（ACTION-ART-02B）」の1項目を追加した
  - Scene所有のphase、待機中は進めない、Enter / R、context（Simulationの外）、行の扱い、Management無し

# User Visual Check — REQUIRED

`pnpm dev`（比較表示のscreenshotをお願いします）

1. arenaが暗幕の下に見えている
2. Action HUDと同じUIの家族に見える
3. 東西がすぐにわかる
4. 名前 > 番付 / 成績の階層
5. Age / Height / Weightが比べやすい
6. 7行の仮のパラメータが読める
7. 仮の行が、最終的なstat設計に見えない
8. 詰まりすぎていない
9. 開始の案内が明確
10. Enterで、すぐにきれいにActionへ移る

Enterの後は、HUDが変わっていないこと、gameplayが変わっていないこと、Rで比較表示に戻ることを確認してください。

# Changed Files

- `src/game/presentation/boutHudPresentation.ts`
- `src/game/presentation/boutHudCopy.ts`
- `src/game/presentation/boutHudPresentation.test.ts`
- `src/game/presentation/preBoutComparison.test.ts`（新規）
- `src/game/scenes/HudStyle.ts`（新規）
- `src/game/scenes/BoutHudView.ts`
- `src/game/scenes/PreBoutComparisonView.ts`（新規）
- `src/game/scenes/BoutScene.ts`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

補足（Provisionalな選択として報告するもの）：
- HUDと比較表示のstyleを `HudStyle.ts` にまとめた（見た目を一致させるための小さな共有。frameworkではない）
- 比較表示の寸法と色はProvisional
- groupの見出しはDeferred（型だけを用意した）
- 行が多い場合は、行間を下限まで詰めるだけ。paging / scroll / 省略はしない

# Unexpected Scope（報告のみ）

- 15行を超えると、行間の下限32pxで、表が開始の案内の領域まで伸びる
  - 意図どおり省略はしない。最終的な扱いはDeferred
  - 現在のfixture（3 + 7行）は余裕をもって収まる

# Git Delivery

- Commit: `feat: add pre-bout comparison screen`（task-ownedの12ファイルのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
