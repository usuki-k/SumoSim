Task-ID: TOKUDAWARA-01A-RINGOUT-CORE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 0842987418a386df9ce9ce52bf3bd502e2f7bde3
Agent-Start-Head: 908b09f171876cbbeea451cfb6c56ce4ede79df2
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS。

**実装したこと**
- Tokudawara-aware Ring-out（中心基準、窓の閉区間、境界はIN、最も早いIN→OUT）を、Pure TypeScriptで実装した
- Prototype Setupに受理済みの値（radius 2.275 / depth 0.1194375 / halfAngle π/20）を入れた
- 暫定の `DohyoView` と、debug表示の境界線を同じ幾何にそろえた

**円の扱い**
- 徳俵がない場合は、既存の円のhelperへ明示的に分岐する
- 既存のT151–T172は **無変更でPASS**。円のhelperの出力が `Object.is` で一致することも追加testで確認した

**検証**
- `pnpm test` 237件PASS（新規28件）
- `pnpm build` PASS
- `git diff --check` PASS

**Known Untested**
- 実ブラウザでの描画smokeは **NOT RUN**（この環境にブラウザ操作の手段がない）
- 代わりにdev serverで、`/`、`main.ts`、`BoutScene.ts`、`DohyoView.ts`、`ringOut.ts` のVite変換（HTTP 200）だけを確認した
- **User Play Test: REQUIRED**

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `0842987`（ancestor）、Handoff-Mode GITHUB
- `0842987..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `908b09f`
- Current Sourceは、Reviewで受理されたRing-outの意味論（中心基準、境界IN、resolved stateの直線補間、epsilon 1e-9、確定後no-op、壁なし、Counterは `R − bodyRadius`）と一致した。食い違いはない

# Accepted Tokudawara Geometry（再検討しない）

| 項目 | 値 |
|---|---|
| base radius R | 2.275 m |
| depth | **0.1194375 m**（= 2.275 · 42 / 800。Art master 42px / 800px） |
| halfAngle | **π/20**（9°） |
| 位置 | +x / +y / −x / −y の4つ、同じ形 |
| Art alignment | Candidate C（1.0952 / 5.48 / 95.28）。本Taskでは扱わない |

`BoutScene.ts` に、literalの `TOKUDAWARA_DEPTH = 0.1194375` と `TOKUDAWARA_HALF_ANGLE = Math.PI / 20` を置き、導出をcommentに書いた。

# Type / State Ownership

- `BoutTypes.ts`
  - `TokudawaraSetup { depth, halfAngle }` を追加した
  - `ArenaSetup.tokudawara?` は任意。無い場合は円のまま
- `BoutSimulation.ts`
  - `assertValidArena`: radiusの検証は従来どおり。tokudawaraがある場合は、depthが有限で > 0、halfAngleが有限で (0, π/4) の範囲
  - `copyArena`: Setupからdeep copyし、Snapshotでもcopyを返す
  - 円のときは `tokudawara` のkeyを作らない（既存のsnapshotの形を保つ）
- art pixelはgameplay stateに持たない

# Classifier（唯一の判定）

`ringOut.ts`

- `allowedArenaRadius(p, arena)`
  - 徳俵がない場合は `radius`
  - ある場合は、点を折り畳んで窓を判定する: `min(|x|,|y|) ≤ max(|x|,|y|)·tan(halfAngle)`
  - 窓の中（側端を含む）なら `radius + depth`、それ以外は `radius`
  - `atan2` は使わない。絶対値と入れ替えは厳密なので、4つの窓の8本の側端がbit単位で同じ計算になる
- `isOutOfArena(p, arena)`
  - 徳俵がない場合は `isOutOfRing(p, radius)`（従来の式そのもの）
  - ある場合は `hypot(p) > allowedArenaRadius(p, arena)`。境界ちょうどはIN
- 点の判定と、交差区間の分類は、どちらもこの `isOutOfArena` だけを使う

# Earliest IN→OUT Crossing

`firstArenaExitFraction(previous, current, arena)`

- 徳俵がない場合: `firstRingBoundaryCrossingFraction` をそのまま返す（**円の回帰を防ぐための分岐**）
- 徳俵がある場合
  - P0がOUTなら0
  - 候補 `{0, 1}` に、次の交点のうち (0, 1) にあるものを加える
    - 半径R、半径R+depthの円との交点（桁落ちしない形の2根）
    - 側端の直線4本（角度 ±H、π/2 ± H）との交点。1本の直線に、反対側の窓の側端も載っている
  - 昇順に並べ、長さが0でない各区間を中点で `isOutOfArena` にかける。**最初のOUT区間の始点**を返す
  - P1がINでも、途中で出ていれば値を返す。出ていなければnull
  - 防御: P1がOUTなのに区間で検出できなかった場合は `1 − ε`
- samplingは使わない
- **許容誤差も不要**（重複した候補は長さ0の区間になるだけ）。gameplayのepsilonは流用していない
- 返す値は有限で [0, 1)
- 円は凸なので、従来の「最後にINだった根」と「最も早いIN→OUT」は一致する

**解決**
- `resolveArenaRingOut(entries, arena)`: 先後とepsilon 1e-9によるRematchは従来と同じ
- 既存の `resolveRingOut(entries, radius)` は `resolveArenaRingOut(entries, { radius })` の薄いwrapperとして残した（既存testのAPIを保つため）

# BoutSimulation Integration

- `step()` の最後の判定を `resolveArenaRingOut([...], this.arena)` に変えた。呼ぶ位置や順序は変えていない
- Counterの位置移動は、**円の `arena.radius − bodyRadius` のまま**（徳俵の窓へは位置移動しない。testで固定した）
- Push / Counter / Grip / Driveの式、body半径、fixed timestep、epsilonは変更していない

# Provisional Visualization

`DohyoView.ts`
- `arenaBoundaryOutline(arena)`: 正確な境界を折れ線（m）にする
  - 窓では R+D の円弧、それ以外は R の円弧、窓の端では放射方向の線分
  - 円弧の分割（0.5°）は描画のためだけ。窓の端は厳密な頂点にしてある
- `drawDohyo(scene, center, ppm, arena)`
  - 粘土の外周は、この境界で塗る
  - 俵は、この境界を中心線にして太線で描く（従来の「俵 = Ring-outの線ちょうど」の規約を保つ）
  - 区切りの印は、窓の端を避けて半step offsetし、`allowedArenaRadius` の位置に描く
- `drawArenaBoundaryDebug`: debug（key `0`）の時だけ、正確な中心境界を赤い細線で表示する
- gameplayの判定はSceneで再実装していない。描くのはsnapshotのarenaから作る図形だけ

# Tests

新規 `src/game/sumo/BoutTokudawara.test.ts`（28件）。

**点の判定**
- 4方向の中心線: R、R+D/2、R+D はIN、R+D+ε はOUT
  - 厳密に表せる値を使ったfixture（R=5, D=0.25）でも確認した
- 通常の部分: 3-4-5の8点（全八分円）でRちょうどはIN、外はOUT。4象限の複数の角度で、円の判定と一致する
- 側端の8本: 窓の中（R < r ≤ R+D）はIN、`tan` を1e-9だけ超えるとOUT。R以内では窓は無関係
- 同じ半径でも、窓の中はIN、外はOUT
- 徳俵なし: 円の判定と一致する

**交差**
- 通常の円弧（4象限）、徳俵の外縁（4方向、軸上と軸外）、帯の中で止まる移動はnull
- 側端から出る（8本）: 解析解と1e-12まで一致し、直前はIN、直後はOUT
- 円の内側から側端を通って窓に入る（8本）: null
- 角の付近・接線
  - 角を通って帯へ入る場合: exitにならない（sub-ulpの断片以外）
  - 外縁の接線、3-4-5の接線: 即座にexit（値は ≤ 1e-12）
  - 内向きの移動: null
- P0がOUTなら0、移動なし・exitなしならnull
- **P0 IN / P1 IN の角切り（IN→OUT→IN）: 最初のexitを返す（8本）。resolverでも負けになる**
- **IN→OUT→IN→OUT: 最後のexitではなく最初のexitを返す（8本）**
- 決定的な疑似乱数1500区間で、密なsampling（2000点）のoracleと矛盾しない
  - exitありが100件超、再進入ありも含む
  - 返り値が有限で [0, 1)、直前はIN、直後はOUT
- 徳俵なし: 円のhelperと `Object.is` で一致し、`resolveArenaRingOut` は `resolveRingOut` と一致する

**解決**
- Player先 / CPU先、両者IN
- 鏡像でRematch（±x、±y、x↔y、側端8本の角切り）
- epsilonの内と外（0.5e-9 / 3e-9）
- 徳俵の外縁で出た者と、通常の円で出た者を比較
- 決定性、Phaserをimportしていないこと

**BoutSimulationへの統合**
- 4方向へ歩いて出る: Rを越えても残り、R+Dを越えたtickで負け
- 斜め4方向: Rで負け（Rを越えて残ることはない）
- FREE Push（+x）: Rを越えて残り、R+Dを越えて負け。円では従来どおりRで決まる
- 組んでのDrive（−x）: 判定がresolverの結果と一致する
- 壁なし、確定後no-op、再実行で同じ結果
- Setupとsnapshotのdeep copy。円では `tokudawara` のkeyがない
- 不正なSetup（depth 0 / 負 / NaN / ∞、halfAngle 0 / 負 / π/4 / NaN）を拒否する
- Counterの位置移動: 深いdepth（0.3）でも、円のarenaと同じ位置になる（rearは無効のまま）

**既存のtests**: T151–T172を含む13 fileが、すべて無変更でPASS。

# Verification

| 項目 | 結果 |
|---|---|
| `pnpm test` | **237 passed**（14 files） |
| `pnpm build` | PASS（chunkサイズの警告は以前からのもの） |
| `tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| Simulation helperがPhaserをimportしていない | `ringOut.ts` のsource test（T172と新規test） |
| 決定的な再実行 | Simulationのscenario再実行と、resolverの反復で一致 |
| Browser smoke | **NOT RUN**（ブラウザ操作の手段がない）。dev serverでのmodule変換だけ確認（HTTP 200、`DohyoView` が `allowedArenaRadius` を使っていること） |

`tools/dohyo_art/`、package / lockfile、Product画像は未変更。

# Changed Files

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/ringOut.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutTokudawara.test.ts`（新規）
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `docs/ARCHITECTURE.md`（Tokudawara Ring-outの1項目を追加）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Gameplay Semantic Changes

- 4つの窓（各18°）の中だけ、中心が R+D（+0.119 m）まで残れる。その他は従来どおりR
- 窓の外へ横に出る場合は、側端を越えた時点でOUT
- 非凸の区間では最も早いIN→OUTを使う。終点がINでも、途中で窓の角を切って外へ出ていれば負けになる
- 東西の窓はshikiriの軸上にあるので、まっすぐの押しや寄りで「徳俵で残る」場面が増える
- 変えていないもの: 中心基準、epsilon、確定後no-op、壁なし、Counterの位置移動の条件

# Design Deviations

Design Deviations: NONE

補足（Taskの範囲内で選んだ細部）：
- 候補の重複は「長さ0の区間を飛ばす」だけで扱い、技術的な許容誤差は導入していない（Taskでは「必要なら」とされていた）
- 円のAPI（`isOutOfRing` / `firstRingBoundaryCrossingFraction` / `resolveRingOut`）はそのまま残し、arena版を追加した。既存testのAPIと結果を変えないため

# Unexpected Scope（報告のみ）

- BoutSceneのscale（`RING_FILL_RATIO` 0.9をRに対して適用）では、徳俵の外縁が画面の半分の約0.947倍の位置に来る
  - 画面には収まっている
  - Product背景を統合するときに、scaleの対応（R = 400 / 540）を見直す必要がある（既知のDeferred）

# User Play Test — REQUIRED

`pnpm dev` で起動し、必要ならkey `0` のdebug表示（赤い細線が正確な境界）を使って確認してください。

1. +x（右）の徳俵へ歩く、または押し出す: 徳俵の中では残り、外縁を越えると負け
2. −x（左）
3. +y（下）
4. −y（上）
5. 斜め（通常の円の部分）: 従来どおり円の線で負け
6. 暫定の俵の線と、実際の勝敗が見た目で一致すること
7. 同時の決着や縁での挙動に、明らかな矛盾がないこと

（Product artの承認ではなく、gameplay ruleの受け入れ確認）

# Git Delivery

- Commit: `feat: add tokudawara ring-out boundary`（Task-ownedの8ファイルのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
