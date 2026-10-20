Task-ID: ACTION-ART-02-HUD-PRODUCT-SPEC
Result: PASS
Branch: develop
Source-Baseline: dc3df77c9d8e7463c53292b46b7d8e1c3d5bf4ae
Agent-Start-Head: 0d30e1044e997a60af6da7fa2d4fa8529be55e66
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Documentation only）。

- `docs/ACTION_HUD_PRODUCT_SPEC.md` を新しく作り、Product HUDの正本とした
- 内容
  - 常時表示と取組前の比較表示を分けた情報の階層
  - 各項目のdata ownership
  - 1920×1080のzone案（推奨値。幾何から導いた禁止領域を含む）
  - 肖像・出身地・staminaの扱い
  - 既存のdebug textの分類
  - 将来のdata contract
  - 実装の段階
- 公開パラメータは一切決めていない。件数が変わる前提の構造だけを定めた
- `docs/ARCHITECTURE.md` に、HUDのmetadataをSimulationに入れないという1項目だけを追加した
- Production Source / assets / package / lockfileは未変更

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `dc3df77`（ancestor）、Handoff-Mode GITHUB
- `dc3df77..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `0d30e10`
- 既存の正式なHUD specはない（`docs/` にあるのはARCHITECTURE、GAME_CONCEPT、agent_handoffのみ）。衝突はない

# Source Findings Relevant to HUD

- `src/main.ts`: logical 1920×1080、`Scale.FIT`
- `productArena.ts`: art中心 (960, 540)、基本半径400px、徳俵21px
  - 徳俵の外縁は421px、力士の直径は約123px（半径約62px）
- `BoutScene.ts` の `PARTICIPANT_PRESENTATION`
  - `wrestler-a` = keyboard / 青 / `PLAYER` / **EAST**、spawnは x = −0.7（画面の左）
  - `wrestler-b` = dummy / 赤 / `CPU` / **WEST**（画面の右）
  - `name` は未設定で、結果の文言は `PLAYER` / `CPU` をfallbackにしている
- 画面のtext
  - modeText（Dummyのmodeと操作説明）、engagementText（debug）、頭上のlabel（debug）、phaseText（debug）、resultText（勝敗）
  - 加えて、debugの図形（接触円、向き、組みの線、境界）
- `BoutTypes.ts`
  - `ParticipantState` にprofileやtournamentの情報はない
  - `BoutSnapshot` = arena / participants / engagement / outcome
- 東 = 左、西 = 右というTaskの前提は、Current Sourceと一致する。食い違いはない

# Created / Changed Docs

- `docs/ACTION_HUD_PRODUCT_SPEC.md`（新規。§1–§17）
- `docs/ARCHITECTURE.md`（「Product HUD」の1項目を追加）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Accepted Product Decisions Captured

- 常時表示: 東西の四股名・番付・今場所の成績と、日目
- 取組前の比較表示: 四股名・番付・成績・年齢・身長・体重・すべての公開パラメータ（件数は可変）
- 公開の方針: パラメータは隠さずに見せる
- 顔の肖像: v1では不要。肖像に依存しないlayoutにする
- 出身地: Optional / Deferred
- Stamina: realtimeのbarは置かない。公開パラメータになった場合は、その基本値を比較表示に出す
- 意匠: 暖色、生成りのパネル、墨色の文字、控えめな赤と青。テレビ中継の写しやsponsor / logoは無し
- 力士の大きさ（約123px）と、metersからpixelsへのscaleは変更しない

# Always-visible HUD Summary（spec §3、§7）

- 左上に東、右上に西の識別ブロック（Recommended (24, 24, 440, 150) / (1456, 24, 440, 150)）
  - 内容: 方位tag + 番付 / 四股名 / 成績 + 操作中の印の枠
- 中央上部に、小さなDay chip（Recommended (810, 10, 300, 44)）
- **Action critical circle**: 中心から483px（徳俵の外縁421 + 力士の半径62）にはHUDを入れない
  - 境界の上にいる力士の体まで含めて隠さないための制約
  - zone案の配置は検算済み（East blockの角は616px、Day chipの下端は486px）

# Pre-bout Comparison Summary（spec §4、§8）

- 全画面のoverlayで、`東の値 | 項目名 | 西の値` の3列の表にする
- 項目名は中央に1回だけ書く
- 肖像の代わりに、方位tagと差し色の帯を使う
- 行の高さは48px、パラメータは約12行（Prototypeの目安）
  - それを超えた場合の扱いや比較barは、パラメータ一覧が決まってからにする（Deferred）
- groupの見出しと行の順は、データ側から渡す

# Data Ownership Matrix（spec §5の要約）

| 項目 | 現在 | 将来の持ち主 |
|---|---|---|
| participant id | BoutSetup / Snapshot（既存） | 同じ |
| 東西 | BoutSceneのpresentation（暫定） | Tournamentの取組（未実装） |
| 四股名 / 年齢 / 身長 / 体重 | 無し | Wrestler profile（未実装） |
| 番付 | 無し | Management / 番付（未実装） |
| 成績 / 日目 | 無し | Tournament state（未実装） |
| 公開パラメータ | 無し | Wrestler / Management（一覧は未定） |
| 勝敗 / engagement / action | BoutSnapshot（既存） | 同じ |
| 操作者 | BoutScene（presentation / input） | 同じ |
| 表示の文言 | Sceneに直書き | localization（presentation） |

原則: HUDのmetadataは `BoutSimulation` / `ParticipantState` に入れない。体格がgameplayに影響する場合も、`BoutSetup` へ変換して渡す。

# Layout / Wireframe Summary

- spec §7にASCIIの配置図、zone表、識別ブロックの中身（文字サイズの目安）を書いた
- spec §8に比較表示の配置図を書いた
- pixelの値はすべて **Recommended / Provisional**

# Portrait / Birthplace / Stamina Decisions

- 肖像: 不要。ランダム生成はDeferred（§11）
- 出身地: 常時表示でも比較表示でも必須にしない。任意のprofile項目としてDeferred。生成ruleや国籍ruleは作らない（§12）
- Stamina: realtime表示はしない。値は公開パラメータになった場合のみ比較表示に出す。計算式などはDeferred（§10）

# Prototype Debug Text Classification（spec §13）

- Debug / 開発専用: Dummyのmode、engagement、`pair v`、頭上の `PLAYER` / `CPU`、phaseの文字列、debugの図形
- 暫定の操作説明: `WASD move ...`。Productの操作説明はDeferred
- 実際のProduct情報（表示形式は暫定）: `EAST ... Win` / `Draw Rematch`（勝敗）

これらを隠したり削除したりしても、gameplayには影響しない。

# Deferred（spec §17）

- パラメータの最終一覧、値の範囲、計算式
- 四股名や番付の名称
- 番付の昇降、場所の進行、成績の集計、日程
- 出身地、国籍、肖像
- staminaのgameplay、realtime表示
- 比較表示で行が多い場合の扱い、比較bar
- 結果画面、決まり手、演出
- 操作説明・tutorial
- mobile / touchのlayout
- localization system、font
- 音、animation

# Recommended Implementation Sequence（spec §16）

1. **ACTION-ART-02A**: HUD shell（pure view model + fixture + 識別ブロック・Day chip + debug textの整理）→ User Visual Check
2. **ACTION-ART-02B**: 取組前の比較表示（fixtureで、仮であることが明確な行。件数を変えても崩れないことを確認）→ User Visual Check
3. Management / Tournamentができてから、fixtureを実データに置き換える

# User Decisions Required

- **UD-1（§3.3）**: プレイヤーが操作している力士を、Productでどう示すか
  - 現在はdebugの `PLAYER` / `CPU` labelだけ
  - 推奨: 識別ブロックに小さな「操作中」の印の枠を用意し、表示するかどうかと表記はUserが決める
  - 決まるまでは枠を空けたままでもlayoutが成り立つ
  - HUD shellの実装（02A）の前に決めることが望ましいが、決まっていなくても始められる

# Design Deviations

Design Deviations: NONE

# Unexpected Scope（報告のみ・未修正）

- `docs/GAME_CONCEPT.md` の確定事項にある「ドット絵・簡素な2D Presentationを基本方向とする」は、受理済みのProduct arena（描き込んだ暖色の背景）と方向が異なって見える
  - また「Resolution」は未決事項に残っているが、ARCHITECTUREでは1920×1080がProductの基準になっている
  - GAME_CONCEPTの更新はScope外なので、変更していない。整理が必要かどうかは、ChatGPTとUserで判断していただきたい

# Verification

- Current Sourceを直接読んだ（AGENTS.md、CLAUDE.md、ARCHITECTURE.md、GAME_CONCEPT.md、CURRENT_TASK / 直前のREPORT、`main.ts`、`BoutScene.ts`、`productArena.ts`、`BoutTypes.ts`）
- 文書の整合を確認した
  - 東西と左右の対応
  - 幾何（421 / 62 / 483px）と、zoneの距離の検算
  - Accepted / Recommended / Deferredの区分
  - Task要求の§1–§16をすべて含めた
- Production Source、assets、package / lockfileは未変更
- `git diff --check`: PASS
- tests / build: 不要（Sourceは未変更）

# Git Delivery

- Commit: `docs: specify product bout hud`
  - `docs/ACTION_HUD_PRODUCT_SPEC.md` / `docs/ARCHITECTURE.md` / 本Report の3ファイル
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
