Task-ID: TOKUDAWARA-RINGOUT-INVESTIGATION-01
Result: PASS
Branch: develop
Source-Baseline: 791fb16b1934a68d2840404809d1e17d32e70904
Agent-Start-Head: cc509e366567c202e0a3b67e7e224904a25ad340
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。BLOCKEDになる点はない。

**推奨: Level 2（Visual + Ring-outの境界）**。

**理由**
- 中心基準、tick末尾での判定、直線補間による先後判定、Rematch epsilonは、どれも変えずに済む
- 変更は `ringOut.ts` の局所的な拡張と、`ArenaSetup` への任意fieldの追加で収まる
- 徳俵を設定しない場合は、既存の円形の計算をそのまま通る。そのため既存のT151–T172は変わらない
- 規模: **MODERATE / manageable**（Simulation側は小さいが、Ring-outの核心ruleなので検証はHeavy）

**ただし、実装の前にUser Decisionが必要な重要な発見がある**
- 補正済みarena（scale 1.072 / offset 5.36, 77.72）では、ring外縁から下側の内側石枠までが **13 master px（runtime 6.5px、約0.037m）** しかない
- 徳俵を俵1本分（42 master px）外へ出すと、下側の徳俵が石枠と装飾ブロックに **約29px重なる**（一時実験で確認）
- 上側の余白は約44px、左右は約186pxで問題ない
- これはLevel 1でもLevel 2でも同じく起きる、Product artの制約。徳俵の深さとarena alignmentを合わせて決める必要がある（UD-3）

Production Source / tool / package / lockfile / Product画像は未変更。Repositoryの変更は本Reportのみ。

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `791fb16`（ancestor）、Handoff-Mode GITHUB
- `791fb16..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `cc509e3`
- 読んだもの: AGENTS.md、CLAUDE.md、ARCHITECTURE.md、GAME_CONCEPT.md、CURRENT_TASK / 直前のREPORT、`BoutTypes.ts`、`BoutSimulation.ts`、`ringOut.ts`、`BoutRingOut.test.ts`、`BoutSimulation.test.ts`（arenaの部分）、`BoutScene.ts`、`DohyoView.ts`、`tools/dohyo_art/compose_dohyo.py`、`README.md`、補正済みの実出力 `output-aligned.local/`

# Q1 — Current Ring-out Source Findings

| 項目 | Current Source |
|---|---|
| 境界判定 | `ringOut.ts` `isOutOfRing(position, arenaRadius)`: `Math.hypot > radius` ならOUT。境界ちょうどはIN |
| 交差の割合 | `ringOut.ts` `firstRingBoundaryCrossingFraction(previous, current, radius)`: currentがOUTのとき、`\|P0 + t·d\| = R` の大きい方の根（＝最後にINだった時刻）を桁落ちしない形で計算する。currentがINならnull、previousがすでにOUTなら0。値域は [0, 1) |
| 位置の受け渡し | `BoutSimulation.step()` がtick先頭で `previousA/B` をcopyする。すべての位置解決とfacing更新の後に、`resolveRingOut([{id, previous, current}×2], this.arena.radius)` を1回呼ぶ |
| 同時の扱い | `resolveRingOut`: 両者の割合の差が `RING_OUT_SIMULTANEOUS_EPSILON = 1e-9` 以内ならrematch。それ以外は小さい方が負け。片方だけOUTならその者の負け |
| 半径の保存場所 | `BoutTypes.ArenaSetup { radius }`。`BoutSimulation` がconstructorで検証してcopyし、`getSnapshot().arena` でcopyを公開する。Sceneの値は `BoutScene.ts:26` の `radius: 2.275` |
| 半径の他の利用者 | `resolveCounter` の位置移動の有効条件 `\|target\| ≤ arena.radius − bodyRadius`（`BoutSimulation.ts:698`付近）。`BoutScene` の pixelsPerMeter 計算（`RING_FILL_RATIO`）と `drawDohyo` |
| 保護しているtests | `BoutRingOut.test.ts` T151–T172（境界ちょうど / 内 / 外、片方だけOUT、先後、深さを使わない、epsilon、helperの値域、体の大きさを使わない、Push / Drive / Counter、壁なし、凍結、resolved stateだけを使う、決定性、top-levelのoutcome）。`BoutSimulation.test.ts` のradius検証とcopyの分離 |

Accepted HandoffとCurrent Sourceの間に食い違いはない。

## Ring-out以外で幾何に関わる事実

- per-tickの最大移動量: self `MAX_SPEED` 3 m/s + external `MAX_EXTERNAL_SPEED` 3 m/s → 約0.1 m/tick（contactやbondの補正が加わる場合を除く）
- これは、徳俵の深さとして想定する値（約0.1 m）と同じ程度の大きさ。そのため、1 tickの直線区間が徳俵の角を横切ることはあり得る（Q5）

# Current Art-tool Geometry Findings

- `compose_dohyo.py` は、厳密な円環（中心は固定、外縁R = 800 master px、幅42）を、角度→u・半径→vのpolar mappingで描く
- 縁はanalyticな1px coverage × texture alphaで、shikiriは矩形
- 角度による例外（窓）を扱う仕組みはない
- 対応関係: 800 master px = 400 runtime px = **2.275 m**（約351.6 master px/m）
- 補正済みarenaで測った値（master、`output-aligned.local/arena_base_master.png`）

| 方向 | ring外縁 | 内側石枠の内縁 | 外向きの余白 |
|---|---|---|---|
| 上（−y） | 280 | ≈236 | **≈44** |
| 下（+y） | 1880 | ≈1893（その下 ≈1910 から中央の装飾ブロック） | **≈13** |
| 左右（±x） | 1120 / 2720 | ≈936–950 / 2891–2905 | ≈170–186 |

上下の余白が非対称なのは、01Aで報告した透視による基準のずれ（土俵上面と石枠の中心が約14px異なる）がそのまま残っているため。

# Q2 — Tokudawara Gameplay Abstraction

最小限のgameplay抽象を次のように定義する（史実の構造の細部は扱わない）。

- **4つ**の徳俵を、土俵中心から見て **+x（East）/ +y / −x（West）/ −y** の方向に置く（Simulation座標は +y = 画面の下）
  - East / West はshikiri軸の上にある
- それぞれを **基準円からの局所的な外向きの拡張** として扱う
  - 角度の窓 `|θ − k·π/2| ≤ halfAngle` の中では、許される半径が `R + depth`
  - 窓の外は `R`
  - 窓の両端（side edge）は放射方向の線分（半径 R〜R+depth）
- Product v1では、**4つとも同じ `depth` と `halfAngle` を共有**する
  - 位置（4方向）は固定のruleにし、設定可能にはしない
- 窓の中の基準俵は描かない（徳俵が外へずれて置かれている）
- gameplayの境界は、従来どおり **俵の外縁**
  - 窓の外は R、窓の中は R+depth、その間を放射方向の線分でつなぐ閉曲線になる
- **User / Art のtuning値**（本Taskでは決めない）
  - `depth`: 提案は俵1本分 = 42 master px = 0.1195 m。ただしUD-3の制約がある
  - `halfAngle`: 提案は9°（窓18°）。全周を20俵（勝負俵16 + 徳俵4）とした比率による

# Q3 — Visual-only（Level 1）

- **必要な変更**: `tools/dohyo_art` だけ（Q8）。Simulationは円のまま
- **ずれる場所**: 4つの窓の内側で、半径 R〜R+depth の帯
  - 徳俵の内側に見える中心が、すでにOUTになる
  - ずれの大きさは最大 `depth`（提案値で0.12 m = runtime 21px、body半径0.35 mの約1/3）
  - 逆に「通常の円の外に見えるのに、まだplay中」という状況は起きない（円の部分は一致している）
- **起きる場面**: East / Westの窓はshikiri軸の上にあるので、まっすぐの押し出しや寄り切りの多くがこの帯を通る
  - 「徳俵に足がかかっていて、まだ残っているように見えるのに負け」が、最も目立つ方向で起きる
- **評価**: Product品質としては **推奨しない**
  - 視覚と判定を直接対応させるというTaskの方針に、最も重要な方向で反する
  - Level 2のcostが小さいので、Level 1を選ぶ理由が弱い

# Q4 — Boundary Representation Comparison

| | A: `allowedRadius(θ)`（step） | B: 円弧 + 線分による閉境界 | C: Current Sourceからの最小拡張（推奨） |
|---|---|---|---|
| 内外の判定 | 単純（`r > allowedRadius(θ)`） | 一般的なpoint-in-polygon / 円弧の判定が必要 | Aと同じ判定。下記のfoldingで実装する |
| 側端の不連続 | stepの端をclosed（IN）にすれば、Bと同じ図形になる | 線分として明示する | Aのstepを「閉じた窓」とする |
| 交差の計算 | 角度の関数のままでは解析解がない | 円と線分の交点を区間ごとに求める | Bの区間交点を使う（Q5） |
| 決定性 | ○ | ○ | ○ |
| 保守性 | ○ | △（汎用の幾何に寄りがち） | ○（約80–120行のpure関数） |

**結論**: Aのstep関数と、Bの「円弧 + 放射方向の線分」は同じ図形を表している。
- 判定はA（`allowedRadius`）の形で書く
- 交差はBの区間交点で解く
- この組み合わせ（Option C）が最小。汎用のgeometry engineやpolygonの近似は不要

**窓の判定を厳密にする工夫（folding）**
- `ax = |x|, ay = |y|, u = max(ax, ay), v = min(ax, ay)` とし、`inWindow ⇔ v ≤ u · TAN_HALF`（`TAN_HALF` は事前に計算しておく）
- `atan2` を使わない
- 絶対値と入れ替えはIEEEで厳密な操作なので、4つの徳俵と左右の側端が、bit単位で同じ扱いになる（鏡像対称の保証）
- 判定: `r > R + depth`、または `r > R` かつ `!inWindow` ならOUT。境界ちょうど（外縁と側端）はIN

# Q5 — First-Crossing Interpolation

## 方式（解析的、samplingは使わない）

`P(t) = P0 + t·D`、`t ∈ [0, 1]` とする。

1. 区間の切れ目の候補を集める（最大12個）
   - 円Rとの根（2）、円R+depthとの根（2）
   - 側端8本の半直線との交点（各1）
     - 半直線の方向 `e`: `t = −cross(P0, e) / cross(D, e)`、条件 `dot(P(t), e) > 0`
2. 候補 `{0, 1}` ∪ `(0, 1)` 内の候補を昇順に並べる
3. 各区間を、中点で上記の判定にかけて分類する
4. 末尾から見て、OUTの区間が続いている最初の切れ目 t* を返す
   - t* は「最後にINだった時刻」。境界はINなので、t*そのものはIN
   - P1がINならnull、P0がすでにOUTなら0（現行と同じ）
   - 値域は現行と同じ [0, 1)

## 意味論の確認（Review対象）

- 円は凸なので、現行では「最初にOUTになる時刻」と「最後にINだった時刻」が一致する
  - Current Sourceのcommentと ARCHITECTURE.md は「最後にINだった時刻」と書いている
- 徳俵があると図形が非凸になり、1 tickの区間が IN → OUT（角）→ IN（徳俵）→ OUT と進む場合がある
  - 最大0.1 m/tickなので稀だが、起こり得る
- 推奨: **「最後にINだった時刻（最終的に出た時刻）」を保つ**。理由は次のとおり
  - 現行の文書化された意味と同じ
  - 「tickの途中の状態はRing-out eventではない」という、resolved stateのmodelと一貫する。端点がINなら、途中で出ていても負けにならない
  - 円の場合は値が変わらない
- Taskの文言「first t where P(t) becomes OUT」とは非凸の場合に限って異なるので、明示的にReviewしてほしい（UD-4）

## その他の確認

- **徳俵がない場合**: 既存の `firstRingBoundaryCrossingFraction` をそのまま呼ぶ分岐にする。円の結果はbit単位で同じになる
- **同時の判定**: 両者の割合を同じ関数で計算し、既存の `|ta − tb| ≤ 1e-9` で比べる
  - 鏡像の配置（x → −x、y → −y、x ↔ y）は、foldingと符号反転が厳密なので同じtになる → T159の型のRematchが保たれる
- **側端付近**: 側端を通って出る区間と、角をかすめる区間は、どちらも半直線との交点が切れ目になるので扱える
- **数値誤差**: 根の誤差（相対1e-15程度）が区間の長さより十分小さい限り、中点での分類は安定する
  - 接する場合は2つの根が一致し、長さ0の区間になって無害
  - 分類と判定は同じ `isOut` を使うので、判定と割合が食い違うことはない

# Q6 — State / Type Ownership

推奨（最小）：

```ts
export interface TokudawaraSetup {
  readonly depth: number      // m, > 0
  readonly halfAngle: number  // rad, (0, π/4)
}
export interface ArenaSetup {
  readonly radius: number
  readonly tokudawara?: TokudawaraSetup   // undefined = 円（現行）
}
```

- 移行のcostは小さい
  - 任意fieldなので、既存の `{ radius }` を使うSetup・tests・Sceneはすべてそのまま動く
  - discriminated unionにすると全callerの書き換えが必要になるので、不採用
- `BoutSimulation` で必要な変更
  - constructorでの検証（有限、`depth > 0`、`0 < halfAngle < π/4`）
  - arenaのdeep copy、snapshotのcopy
  - `resolveRingOut(entries, arena)` へのsignature変更（現在は `arenaRadius`）
- 4方向の配置は、ruleとして `ringOut.ts` に固定する
- **Counterの位置移動の有効条件**（`R − bodyRadius`）は、**変更しないことを推奨**
  - 円は許容領域の厳密な部分集合なので、安全側になる
  - 「位置移動で中心が土俵の外へ出ない」という既存の不変条件をそのまま保てる
  - 意味の変更は「徳俵の窓には位置移動しない」だけ
- SoTの重複は避ける
  - Simulationの値はSetupが唯一の正本
  - Sceneは `snapshot.arena` を読むだけ

# Q7 — Cross-language Geometry Contract

**推奨: 今はJSONの共有をせず、「文書化した定数の意図的な複製 + 両側のtest + manifestへの記録」とする。**

**理由**
- 共有する値は3つだけ（R、depth、halfAngle。位置はruleで固定）
- 単位も違う: Simulationはm、art toolはmaster px（800 px = 2.275 m）
- 今cross-languageのconfig基盤を作るのは過剰
- Product背景のPhaser統合（Product overlay PNGがruntime assetになる時点）で、JSON化を再評価する

**具体的な方法**
- 対応表を `docs/ARCHITECTURE.md`（または実装Taskで指定する場所）に1か所だけ書く
  - 例: `depth 0.1195 m ↔ 42 master px`、`halfAngle 9° ↔ 9°`
- Python側: art toolのdefault値がその表と一致することをtestで確認する。`build_manifest.json` に徳俵の値（pxと、Rに対する比率）を記録する
- TS側: Product Setup（現在は `BoutScene` の定数）が表と一致することをtestで確認する
- 角度は単位を変換せずに一致する。depthは比率 `depth / R` で比べると、単位の違いに左右されない

# Q8 — Art-tool Impact（実装しない）

- 既存の円環のpolar mappingは、**coverage関数を窓ごとに切り替えるだけ**で流用できる
  - 窓の中: 円環の範囲を `[R − w + depth, R + depth]` にずらす。v は `(R + depth − dist) / w`
  - 窓の外: 現行のまま
  - 側端: 放射方向の線までの距離（`dist·sin Δθ`）でanalyticに1px AAし、2つのcoverageを混ぜる
- `tawara_source.png` はそのまま再利用できる（窓の中も同じtileを使う）
  - 徳俵の両端の見え方（tieの位置、小口の陰影）はArtのtuning
  - 徳俵だけu=0から始める、などの小さなoptionで対応できる
- 追加するもの
  - CLI `--tokudawara-depth`（master px）、`--tokudawara-half-angle`（度）
  - 既定は「なし」にするか「有効」にするかは実装Taskで決める
  - manifestへの記録、guideへの徳俵の境界の描画、tests
- arena alignmentの値は変更不要。arenaを作り直す必要もない
  - **ただし下側の余白が13pxしかない（UD-3）**。Toolの側では、徳俵が石枠と重なること自体は検出できない（意味的な判断なので）

# Q9 — Phaser / Debug Impact

- Sceneに徳俵のruleを再実装する必要はない。Outcomeは引き続きSimulationが持つ
- 必要なpresentationの変更
  - 暫定の `DohyoView.drawDohyo` は「俵 = Ring-outの線ちょうど」と明記している。Level 2にしたら、徳俵の窓も描く（`snapshot.arena.tokudawara` を読む）
  - Product背景の統合後は、overlay PNGに置き換わる
- **debug表示（key `0`）で、実際の境界を描くことを推奨**
  - 円弧と放射方向の線分を、snapshotの値から描く
  - Product overlayとSimulationの一致を目視で確かめる手段になる
  - Sceneが描くのは図形だけで、判定はしない

# Q10 — Test Matrix（Level 2）

`isOutOfArena` と境界: 4つの徳俵すべてで確認する（foldingで対称性はcodeで保証されるが、Taskの要求どおり全方向をtestする）。

1. 円の部分（窓の外。例 45°、30°、各象限）: `r = R` はIN、`R + ε` はOUT
2. 徳俵の中心線（0、π/2、π、−π/2）: `r = R + depth` はIN、`+ε` はOUT、`R < r < R + depth` はIN
3. 両方の側端（`±halfAngle`、4か所×2）: 端ちょうどはIN（`R < r ≤ R + depth`）。角度が窓の外側にεずれるとOUT（`r > R`）
4. 窓の外 `R + depth/2` はOUT、窓の中の同じ半径はIN

`crossingFraction`:

5. IN → OUT（円の部分を横切る）: 現行の円の結果と一致する
6. IN → OUT（徳俵の外縁を横切る）: tの解析値と一致する
7. IN → OUT（側端の線分を横切る）
8. 角をかすめて IN → OUT → IN → OUT と進む区間: 最後にINだった時刻を返す（UD-4で決めた意味論に従う）
9. 端点がINで途中だけOUT: null
10. P0がすでにOUT: 0（出発時点でOUTの場合の不変条件を変えない）
11. 両者ともIN: ongoing

`resolveRingOut`:

12. Playerが先 / CPUが先（両方の順序）。同じtickで割合が異なる場合
13. 鏡像で等しい交差（East / Westの徳俵、上下の徳俵、窓の外）: Rematch
14. epsilonの内側と外側

その他:

15. 徳俵なし: 既存のT151–T172を変えずにPASS。円の割合がbit単位で一致する
16. BoutSimulationの統合
    - Push / Driveで東西にまっすぐ押すと、徳俵の分だけ遠くでOUTになる
    - 45°方向は従来どおり R でOUTになる
17. 決定性（同じscenarioで同じ結果）
18. Setupの検証（depth ≤ 0、非有限、halfAngle ≥ π/4、≤ 0）と、snapshotのcopyの分離
19. Counterの位置移動の有効条件が円のまま変わらないこと

# Q11 — Complexity Classification

**MODERATE / manageable**（コード量はSMALLだが、Ring-outの核心ruleの変更なので）。

**影響するファイル**
- `ringOut.ts`（判定と交差計算の拡張）
- `BoutTypes.ts`（任意field）
- `BoutSimulation.ts`（検証、copy、引数）
- `BoutRingOut.test.ts`（またはtest fileを新設）
- `BoutScene.ts`（Setupの定数）
- `DohyoView.ts`（暫定の描画と、任意でdebug表示）
- `docs/ARCHITECTURE.md`

**評価**
- `BoutSimulation` の大きな変更: **不要**
- 既存の交差helperは局所的に拡張できる（円の分岐は残す）
- 検証は **Heavy**（境界の網羅 + 回帰 + User Play Test）

**Regression risk**
- 円の分岐を残すので、既存の挙動のriskは低い
- 新しいriskは、非凸の区間の分類と、側端での浮動小数点の扱い
  - foldingとtestで抑えられる

# Q12 — Level Comparison

| Level | 内容 | 評価 |
|---|---|---|
| 1 | 見た目のみ | 安いが、最も目立つ東西の方向で、視覚と判定が最大0.12 mずれる。非推奨 |
| **2** | 見た目 + Ring-outの境界 | **推奨**。Simulationの変更は局所的で、既存の意味論をすべて保つ |
| 3 | + 俵との衝突や縁での相互作用 | 壁、足、接地のruleを新しく導入することになる。Deferred |

# Q13 — Recommended Implementation Split

推奨はTaskの案Aに近い形で、**先に決めること**を置く。

0. **User Decision**（UD-1〜UD-4）。特に depth、halfAngle と、下側の余白の解決方法
1. `TOKUDAWARA-01A-RINGOUT-CORE`（Simulation + 暫定の描画 + tests、Heavy）→ ChatGPT Review
2. （UD-3で再alignmentを選んだ場合）`ART-TOOL-01B` arena alignmentの再調整 → Visual Check
3. `ART-TOOL-02-TOKUDAWARA`（art toolで徳俵を描く。contractの値をtestで固定する）→ Product composite Visual Check

- 案B（1つのTaskで同時に実装）は推奨しない
  - Ring-outの核心と、Product artの目視判断のGateを混ぜることになる
- 1と2・3は値を共有するだけで、互いに独立している。UDで値が決まれば並行してもよい

# Q14 — Gameplay Semantic Changes（Level 2）

- 中心基準のまま。境界が円から「円 + 4つの外向きの窓」に変わるだけ
- 4つの窓（各 2·halfAngle）では、最大 `depth` だけ外側まで残れる
  - East / Westはshikiri軸の上にあるので、**まっすぐの寄りや押しで「徳俵で残る」ことが頻繁に起きる**
  - 決着までの距離が約5%（0.12 / 2.275）延びる
- 同じtickで両者がOUTになった場合、窓の付近では先後が円の場合から変わり得る
  - 一方だけが窓に入っている場合など。決定的なので問題はない
- 非凸の区間では「最後にINだった時刻」を使う（UD-4）
- Counterの位置移動は円の条件のまま（徳俵の窓へは位置移動しない）
- 導入しないもの: 足や接地による判定、俵との衝突、壁、clamp、深さによる勝敗

# User Decisions Required

| ID | 決めること | 推奨 |
|---|---|---|
| UD-1 | Level | **Level 2** |
| UD-2 | `depth` / `halfAngle` | 暫定で depth = 俵1本分（0.1195 m = 42 master px）、halfAngle = 9°（20俵の比率）。ただしUD-3に従う |
| UD-3 | 下側の余白13pxの解決方法 | 下記の (a) を推奨 |
| UD-4 | 非凸の区間の交差の意味 | 「最後にINだった時刻」（現行の文書と同じ） |

**UD-3の選択肢**（数値はすべて本Taskでの推定で、未生成・未検証）

- **(a) 推奨**: arenaのalignment基準を内側石枠の内縁に変える
  - 例: `--arena-scale ≈1.095 --arena-offset-x ≈5.5 --arena-offset-y ≈94.7`
  - 石枠の内縁の半高 ≈772.5 × 1.095 ≈ 846 → depth 42でも上下に約4pxの余白ができる
  - 拡大は9.5%
  - 01Aで受理済みの値を見直すことになるので、User判断が必要
- (b) depthを約12 master px以下にする（runtime約6px）
  - 徳俵がほとんど見えなくなる
- (c) 徳俵が石枠に重なるのを許容する（見た目の破綻）
- (d) arenaを再生成または修正する（非推奨）

# Deferred

- Level 3（俵との衝突、縁での相互作用、足や接地による判定）
- 共有JSONのgeometry contract（Product背景のPhaser統合のときに再評価する）
- BoutSceneのscale（`RING_FILL_RATIO` 0.9）と、Product art（R = 400 / 540 ≈ 0.741）の対応。Product背景の統合Taskで扱う

# Design Deviations

Design Deviations: NONE（Investigationのみ）

# Unexpected Scope（報告のみ）

- 01Aで受理済みのarena alignmentと、徳俵の外向きの余白が両立しない（下側13px）
  - 徳俵を検討する前に受理した値なので、矛盾ではなく新しい制約として報告する
- 暫定の `DohyoView` は、俵を半径ちょうどに描くことを前提にしている。Level 2の実装時に合わせて更新が必要

# Verification

- Sourceを直接読んだ。Ring-outのtests（T151–T172）、art toolの幾何、補正済みの実出力を確認した
- 一時実験（scratchpad。commitしていない）
  - 補正済みcompositeに、仮の徳俵（depth 42、窓18°）の輪郭を描いた
  - 石枠の位置を、luminanceの勾配で測った（上 ≈236、下 ≈1893）
- `src/`、`tools/dohyo_art/`、package / lock、Product画像は未変更
- Repositoryの変更は `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ
- `git diff --check`: PASS
- tests / build: 不要のため実行していない（Sourceの変更なし）

# Git Delivery

- Investigation-only Report Commit Exceptionに該当する
- Commit: `docs(agent): investigate tokudawara ring-out`（本Reportのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
