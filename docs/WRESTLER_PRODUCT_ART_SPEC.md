# WRESTLER_PRODUCT_ART_SPEC — Product力士artの仕様と制作計画

Status: Product力士artの正本。**現在の採用方針は §0**（描いた1枚のred masterと、そこから決定的に作ったblueの、2枚の全身spriteを剛体として使う。ACTION-ART-03AでPhaserへ統合、ART-WRESTLER-04Bでred master方式へ移行）。§1〜§21のうち、部位の組み立て・腕の2関節を前提にした記述は、**履歴**（ACTION-ART-03の設計時点の案）であり、現在の実装方針ではない。

この文書で使う区分：
- **Accepted**: 承認済み
- **Recommended / Provisional**: 推奨する値。後続のTaskやUser Visual Checkで変えてよい
- **Deferred**: 本仕様では決めない

長さの単位は、断りがない限り **R = 力士の体の半径（runtime px）** とする。
- 現在は `BODY_RADIUS 0.35 m × 400/2.275 px/m` ≈ **61.5 px**
- 表示上の直径は約123 px（Accepted。変更しない）

---

## 0. 現在の採用方針（ACTION-ART-03A → ART-WRESTLER-04A / 04B User Visual Gate）

**Accepted（現在のprototype）**
- 2枚の全身sprite（赤まわし・青まわし）を、剛体として使う
  - `public/assets/action/wrestler/red.png` / `blue.png`
  - `tools/wrestler_art/export_runtime_wrestlers.py` が、決定的に書き出す（手での加工はしない）
- **描いたidleのmasterは、redの1枚だけ**（ART-WRESTLER-04B）
  - red: レビュー済みのred sourceを、sprite全体を1回だけ回転してlocal +X = 前にそろえ、明示したbody-coreを2Rに正規化したもの
  - blue: 正規化したred runtimeを、**local X軸について反射**（`(x, y) → (x, H − y)`。前 = +Xはそのまま、力士の左右だけが入れ替わる。pivotとbody-coreの点も同じ写像）し、**まわしだけを決定的に塗り替えた**もの（色相の帯 + 最大の連結成分のマスク。陰影の並びを保つ）
  - 正規化・反射・塗り替えの値の正本は `runtime_wrestler_recipe.json`（1か所）
  - 両方とも通常のruntime PNGとして書き出す。runtimeでの反転や動的な塗り替えはしない
  - まわしの縁の、ごく細いアンチエイリアスの残りは、runtimeのサイズで許容した（User Visual Gate）
- 「blueとredは別々に描き、反転しない」という以前の決定（ART-WRESTLER-03A）は、**撤回した**。03Aの2枚のsourceと `dual_rigid_recipe.json` は、履歴 / 比較用として残す
- runtimeでは、次のとおりに描く
  - 位置: canonicalなparticipantの位置に、明示したpivotを置く
  - 向き: canonicalな `participant.facing` で、sprite全体を連続的に回転する
  - 表示scale: `2 × bodyRadiusPx / bodyCoreDiameterPx`（現在は約1.0）
- idle・移動・push・counter・grip・組み・drive・崩し: すべて同じspriteを使う
  - 動きは、canonicalな位置の移動（平行移動）だけ。これを最小の基準とする
  - presentation専用のよろけのoffsetや回転は、足さない
- 影は手続き的な、ほぼ円形のもの（world上で右下へずらす）
- 割り当て（presentation）: `wrestler-a` → blue、`wrestler-b` → red

**Deferred**
- push・接触・grip・組みの専用pose: runtimeのUser Play Testで必要とわかったときだけ、後の混合poseのTaskで足す
- 8方向のsprite、animationのframe数、poseの数、skeletal rig、手足ごとのanimation: 決めない・作らない

**履歴**
- 03Aの別々に描いた2枚（反転なし）: ART-WRESTLER-04Bで、red masterの方式に置き換えた（比較用のtoolとして残す）
- 02Aの部位の組み立て: 不採用
- 02Bの1枚の候補: 作り直し
- 以下の§1〜§21にある部位の組み立て・2関節の腕・mawashiの色の別版などは、設計時点の案として残す

## 1. Purpose / Accepted baseline（履歴: ACTION-ART-03時点。現在は§0）

- 目的: 暫定の手続き的な力士（`WrestlerView.ts`）を、受理済みのarenaと同じ品質の、**部位ごとの画像を組み合わせた** Product力士に置き換えるための仕様と制作順を決める
- Accepted
  - 様式化したpainted 2D
  - 厳密な真上視点
  - 1920×1080 logical
  - R ≈ 61.5 px（直径約123 px）の表示scale
  - 部位の画像を組み合わせる方式（part-based composition）→ **§0で置き換えた**（2枚の剛体sprite）
  - 制作の順序: 背景 → HUD → 力士の部位
- 変えないもの: `bodyRadius`、meterからpixelへの写像、接触・Gripの範囲・Pushなどgameplayのすべて
- 力士artはpresentationである。経路は次のとおりで、poseの判断・animationの時間・spriteやassetの状態をSimulationへ移さない

```
BoutSimulation / BoutSnapshot
        ↓
wrestlerVisualState.ts（pure。pose / phase / role / turning / frozen …）
        ↓
Product WrestlerView（Phaser。asset、pose、animation）
```

## 2. Current Source findings（`WrestlerView.ts` / `wrestlerVisualState.ts`）

**部位**（`Graphics.generateTexture` で起動時に作るtexture）

| 部位 | 形（R単位） | 備考 |
|---|---|---|
| shadow | 楕円 2.25×2.0、α0.28 | world上で (+0.07R, +0.12R)（右下）へずらし、facingで回転する。depth 1 |
| foot ×2 | 楕円 0.5×0.32 | 同じtextureを左右で使う |
| torso | 楕円 前後1.6 × 肩幅2.0、腹の影 | 中心 = participant center |
| mawashi | 後ろ半分の帯 + 後ろの結び目。白いtextureをtintする | torsoと同じ中心と大きさ |
| arm ×2 | 肩からのcapsule（長さ1.2R、太さ0.34R）+ 先端の手（半径0.24R） | origin = 肩。**`setScale(reach, 1)`** |
| head | 髪（後ろ）+ 額の肌（前）+ 髷（後ろ） | torsoの中心から (0.3R, 0) |

**root**
- Containerの中は [footL, footR, torso, mawashi, armL, armR, head] の順
- `setRotation(participant.facing)`
- depth 2（両力士とも同じ。作成順で、`wrestler-a` が下）

**ローカル座標**: +x = facing（前）、+y = 力士の右側。

**Pose parameter**（`PoseParams`）
- 項目: lean、torsoRot、crouch（torsoの一様scale）、spreadL / R（腕の開き角）、reachL / R（腕の長さの係数）、stance、footL / R
- 目標のposeへ、指数で滑らかに近づける（18/s）
- 歩くときの足は移動距離で進め、旋回中とDrive中は時間で足を踏み替える
- Morozashi holderのmawashiは明るくtintする

**腕のreachの範囲**
- 0.5（PUSH_STARTUP）〜 1.55（MOROZASHI_HOLDER）
- 肩から手までの距離にすると、およそ **0.6R〜1.86R**

## 3. Product visual goals

- arenaと同じ品質で、すぐに力士だとわかる
- 直径約123 pxで読める（細かすぎる模様を避ける）
- 連続したfacingで回転しても読める
- 現在のActionのsilhouette（押し、組み、もろ差し）を保つ
- ゴムのように伸びて見えない
- 縁は透明で、きれいに抜けている
- 肌・髪・まわし・手足の区別が明確

## 4. 現在のvisual stateのcoverage

| state（`wrestlerVisualState`） | 現在の表現 | Productでの表現 |
|---|---|---|
| idle | IDLEのpose + crouchの呼吸（±1.2%） | 部位のtransform（同じ） |
| move | IDLE + 足の歩幅（移動距離で進める） | 同じ |
| push startup / active / recovery | PUSH_STARTUP → ACTIVE → IDLEへmix（lean、腕を前へ） | 同じ。腕は2関節で解く（§13） |
| counter | 腕を大きく開く、やや後ろへ | 同じ |
| kuzushi | 時間で揺れる（torsoRot、腕を開く、足が乱れる）、kuzushiStrengthで減衰 | 同じ |
| grip reach / recovery | GRIP_REACH → IDLE | 同じ（手の差し替えはDeferred） |
| grapple turning | TURNING（腕が定まらず横） | 同じ |
| grapple neutral | 片腕は上手（広め）、片腕は下手（深い） | 同じ |
| morozashi holder | 両腕とも深く内側 | 同じ。明るいmawashiの代わり（§15） |
| morozashi disadvantaged | 両腕とも外・上 | 同じ |
| drive | 組みのpose + lean / crouch / stance + 踏み替え | 同じ |
| frozen（勝敗確定） | 時間で動く表現を止める | 同じ |

新しいgameplayのactionは作らない。全stateを、**部位のtransformだけ**で表せる（§13）。

## 5. 推奨する部位（履歴。現在の方式ではない: §0）

**Option B（腕を2つに分ける）を推奨する。**

| 部位 | 個数 | 内容 |
|---|---|---|
| `shadow` | 1 | 柔らかい楕円の影（world上でずらす） |
| `foot` | 1（左右は反転） | 足 + わずかな足首・脛の付け根（足と脚を1枚にした） |
| `torso` | 1 | 肩・背中・胸・腹のふくらみ（真上から） |
| `mawashi` | 1 + 色の別版 | 腰の帯と後ろの結び目。torsoと同じcanvas・pivot |
| `upper_arm` | 1（左右は反転） | 肩の付け根から肘まで |
| `forearm` | 1（左右は反転） | 肘から手まで（手を含む） |
| `head` | 1 | 頭頂、髪、髷、耳、額 |

- 右側だけを描き、左は反転（local y方向のflip）して使う。真上からの体はほぼ左右対称で、光も中立にする（§16）ので、反転しても破綻しない
- 1体分の固有の画像は **7枚**（mawashiの色の別版を除く）

**腕を分ける理由**
- reachの範囲は0.6R〜1.86R（約3.1倍）。1枚の画像を伸縮すると、筋肉・手・指が歪む
- 加えて、Userの決定で、身長による見た目のreachの変化（§18）がある
- 上腕と前腕に分け、肘の角度を余弦定理で解く（2関節の解析解。middlewareは不要）と、伸縮なしで全範囲を表せる
  - 上腕 L1 ≈ 0.85R、前腕と手 L2 ≈ 0.95R（Provisional）
  - 伸ばし切ると L1 + L2 = 1.8R（最大1.86Rは、伸ばし切りに近い）
  - 最短は |L1 − L2| = 0.1R（< 0.6R なので、十分に曲げられる）

## 6. 採用しない / 代替の分け方

| 案 | 評価 |
|---|---|
| A. 現在の粗い分け方（腕1枚） | 実装の変更は最小。ただし0.5〜1.55倍の伸縮と、身長による変化で、描いた腕が明らかに歪む。**不採用** |
| A'. 腕1枚 + reachごとの腕の画像を数枚 | 画像の数が増え、変化の途中で切り替わるときに跳ねる。2関節より劣る |
| C1. 手を別の部位にする | Gripで手の形を変えたいときに有効。v1では、前腕に手を含める。**手の差し替えはDeferred** |
| C2. 脚（太もも・脛）も部位にする | 真上からは腹の下にほとんど隠れる。足の位置だけで十分。IKは不要。**不採用** |
| skeletal animationのmiddleware | 不要。**不採用** |

## 7. ローカル座標とpivotの約束（座標の約束 +X = 前、+Y = 右は有効。部位ごとのpivotは履歴: §0）

- 共通
  - root = participantの正確な中心
  - root全体を `participant.facing` で回転する
  - ローカルの +x = 前、+y = 力士の右側（現在と同じ）
- すべての画像は、**部位の軸を +x 方向に向けて** 描く
- pivotは、画像の寸法から推測しない。tool（§12）が書く **`parts.json` の明示的な値** を使う
- 透明の余白は、各辺に最低で master 16 px（runtime 4 px）。回転したときに、縁で欠けや滲みが出ないようにするため

| 部位 | pivot（画像内の原点） | どこに付くか（root local、R単位） | 向き / 左右 |
|---|---|---|---|
| shadow | 楕円の中心 | world上で中心から (+0.07R, +0.12R)。world上でずらす（rootの回転に依存しない） | 楕円がほぼ円形なので回転しても問題ない |
| torso | 体の中心（= participant center） | lean と torsoRot の位置（現在の `at(0, 0)`） | +x = 腹側。左右対称 |
| mawashi | torsoと同じ（同じcanvasの寸法） | torsoと同じtransform | 結び目は −x（背中） |
| upper_arm（右） | 肩関節の中心 | 肩 `at(0.1, ±0.8·crouch)`（右は +y） | 肩 → 肘を +x 方向へ。左は反転 |
| forearm（右） | 肘関節の中心 | upper_armの先（肘）。肘の位置は2関節で解く（§13） | 肘 → 手を +x 方向へ。左は反転 |
| head | 頭の中心（首の付け根） | `at(0.3 (+0.08 push active), 0)` | +x = 顔側、髷は −x |
| foot（右） | 足の中心 | `(footR, +stance)`（左は `(footL, −stance)`） | つま先が +x。左は反転 |

`parts.json` に入れる値（tool → runtime）：
- 各部位の画像のpivot（px）
- 部位の長さ（upper_armは肩から肘、forearmは肘から手の中心）
- torsoの肩の位置
- 画像のscaleの基準（R = 何px）

runtimeは、これを読んでposeを組む。

## 8. Layering

**1人の中（下 → 上）**
1. shadow（別のlayer。両力士の影は体より下）
2. foot L / R
3. torso
4. mawashi
5. upper_arm L / R
6. forearm L / R
7. head

**2人の重なり（§17）**
- 「両者の体」→「両者の腕」→「両者の頭」の帯に分けることを推奨する

## 9. Runtime / master sizing（Recommended）

**runtimeの目安**（R ≈ 61.5 px）

| 部位 | 寸法の目安 |
|---|---|
| torso | 肩幅 約2.0R = 123 px、前後 約1.6R = 98 px（canvasは約2.2R四方） |
| 腕の太さ | 約0.34R = 21 px |
| 手 | 約0.48R = 30 px |
| head | 約0.84R = 52 px |
| foot | 約0.5R × 0.32R |

**master**: **runtimeの4倍**（R_master ≈ 246 px。torsoのcanvasは約540 px）

理由:
- 生成画像の解像度（1024〜1536 px）で、部位sheetに収まる上限に近い
- 描き込みを、縮小で安定して落とせる
- 将来、多少の拡大（§18の±15%）をしても品質を保てる

**runtime export**: **1倍**（logical pxと同じ。arenaの1920版と同じ方針）。決定的に縮小する（Lanczosなど。§12）。

- 2倍でexportする案（高DPIでくっきりする、容量は4倍）もある。ただしarenaが1920（1倍）なので、v1では揃えて1倍を推奨する（**UD-2**）
- arenaの2倍masterをそのまま使わない理由: 力士の部位は小さく、回転と縮小を受け、生成の解像度に依存するため。master 4倍のほうが安全
- 生成された画像のscaleはまちまちなので、toolがtorsoの肩幅を基準にmaster 4倍へ正規化する

## 10. Path / 命名（Recommended）

- Source（生成の原画。commitしない）
  - `tools/wrestler_art/input.local/`（例: `canonical_wrestler.png`、`parts_sheet.png`）
  - dohyo_artと同じく、`*.local` でignoreされる
- Master / 確認用の出力: `tools/wrestler_art/output*.local/`
- Runtime（commitする）
  - `public/assets/action/wrestler/<variant>/`
  - 例: `public/assets/action/wrestler/base/`
  - ファイル: `torso.png`、`mawashi_<color>.png`（例: `mawashi_indigo.png`、`mawashi_vermilion.png`）、`upper_arm.png`、`forearm.png`、`head.png`、`foot.png`、`shadow.png`、`parts.json`
- 左右: 右側の画像1枚を、runtimeで反転する。ファイル名に `_l` / `_r` は付けない
- `<variant>`: 最初は `base` の1体。将来の別の体（髪、肌など）は別のvariant dirにする（Deferred）

## 11. AI生成のworkflow（Recommended）

| 案 | 評価 |
|---|---|
| A. 部位ごとに別々に生成 | 体つき・肌・光・筆致がばらばらになる。**不採用** |
| B. 1枚の部位sheet（部位を離して並べる） | 一貫性は高い。ただし部位の寸法や関節の対応がずれることがある |
| C. 完全な1人を生成して、編集で部位を切り出す | 重なっている部分（腕の下の胴、腕の付け根）が欠けるので、描き足しが必要 |

**推奨: C → B の2段階**
1. **Canonical wrestler**（Cの1枚）を生成し、画風・体型・肌・まわし・真上視点をUserが承認する（安く何度でも試せる）
2. 承認したimageを参照にして、同じ画風の **部位sheet**（B）を生成する
   - 関節の重なり分を描き足した部位を、互いに離して並べる
   - 背景は透明（できない場合は、無地の明るい灰色で、部位の色と被らないもの）
3. toolで決定的に切り出す（§12）

ChatGPTの画像生成と、localの決定的な処理だけで実行できる。

**変更（ART-WRESTLER-02A、User Accepted）: 上の C → B の段階は廃止する**
- 全身（canonical / 組み立てガイド）を何度生成しても、上半身と下半身の体の軸が約180°食い違った（body-axis inversion）
- 現在の制作workflow: **AIは独立した部位だけを描き、人体の組み立ては決定的なtoolが持つ**
  - 独立した部位 → 明示的なregion / pivot / joint → 決定的なPythonの組み立てpreview → User Visual Approval → poseと外見の変化のpreview → Phaser統合
  - 全身の解剖をAI生成に解かせない
- 現在の入力は、どちらも組み立てpreviewの **候補**（Product承認はまだ）
  - `parts_sheet.png`: head、mawashi、上腕、前腕と手、足を使う。sheet内のtorsoは **不採用（使わない）**
  - `torso.png`: 置き換え用の単独のtorso
- toolは `tools/wrestler_art/`（README参照）。pivot / scaleの値はProvisional

**訂正（ART-WRESTLER-02B）: 部位を組み立てる方式はProduct baselineにしない**
- ART-WRESTLER-02Aの組み立てtoolは、Technical PASS
  - ただしUser Visual Gateで **不採用**: 体・手足・まわしが、1人の描かれた人物として読めなかった
  - 組み立てた出力はProduct baselineではない。tool（`assemble_wrestler.py`）は実験・参考として残す
- 現在の制作の実験: **1枚の描かれた全身sprite** に戻す
  - runtimeへ統合する前に、360°の回転（連続したfacing）で破綻しないかを確かめる（`preview_single_wrestler.py`）
  - toolで許すのは、透明な余白の切り取りと付与、sprite全体の1回の回転、一様なscale、決定的なresampleのみ。歪み・塗り直し・部位の移動はしない
- 現在の1枚の候補（`wrestler_single.png`）は有望。ただし、02BのUser Visual Gateまでは **未承認**
- **actionのposeの方式は未決定**
  - 全身のpose spriteを複数持つか、animationのframeか、限られた変形か、他の1枚の方式か
  - idleの検証の後も、未解決のまま残る
  - §5・§13の部位の2関節の方式は、この結論が出るまで前提にしない

**結果（ART-WRESTLER-03A User Visual Gate）**: 2枚の剛体sprite、反転なし、連続した全体の回転、位置の移動による最小の動きを、現在のprototypeで採用した（§0）。ACTION-ART-03AでPhaserへ統合した。専用のposeはDeferred。

**更新（ART-WRESTLER-03A）: 2枚の剛体spriteで、最小のanimationの方式を試す**
- 02Bの1枚の候補（`wrestler_single.png`）は、User Visual Gateで **不採用**（画像の作り直し）。1枚の方式そのものは、まだ有効
- 新しい実験では、相手と向き合うように **別々に描いた2枚**（青まわし・赤まわし）を使う
  - **反転（左右・上下）はしない**。2枚は別の画像のまま（この制約はART-WRESTLER-04Bで撤回した。§0）
- **最小のanimationの方式を、検証中**（未承認）
  - 向き = sprite全体の回転、移動・よろけ = sprite全体の平行移動（よろけに、ごく小さな剛体の回転を加える比較も行う）
  - 手足のanimation、frame、変形、spriteの差し替えは使わない
  - toolは `preview_dual_rigid_wrestlers.py`
- 接触や組みなどの専用のposeが必要かは、**未解決**
- 8方向のsprite、animationの数、poseの数、最終的な描画の構成は、決めない

## 12. 決定的な切り出しtool（Recommended）

次の制作Taskで、小さな **`tools/wrestler_art/`** を作ることを推奨する。
- dohyo_artと同じ思想: 生成artのsource → 決定的なoffline処理 → runtime assets
- dohyo_artのcodeは流用しない

**入力**
- 部位sheet
- 部位ごとの領域と、関節の点（肩・肘・手・首・足の中心）を書いた小さな **region / joint定義**
  - 人がsheetを見て一度だけ書く、JSON相当のもの
  - pivotを推測しない

**処理**
- 領域の切り出し、alphaのtrim、透明余白の付与
- torsoの肩幅を基準に、master 4倍へ一様にscaleを正規化する
- pivotを正規化し、1倍のruntimeへ決定的に縮小する
- mawashiの色の別版を作る（輝度を保ったまま色を置き換える。§15）

**出力**
- runtimeのPNG、`parts.json`（pivot、長さ、scaleの基準）
- manifest（入力と出力のhash、timestampなし）
- 確認用のpreview（§20）

**作らないもの**: atlasの詰め込み（v1は10枚程度なので、個別のPNGで十分。Deferred）、汎用のart framework

## 13. Pose / 関節の対応表（履歴。現在は全stateで同じspriteを使う: §0）

腕は、`spread` を腕の方向、`reach × 1.2R`（現在のcapsuleの長さ）を肩から手までの目標距離 d として、2関節で解く。
- L1、L2は §5の値 × 外見の係数（§18）
- d > L1 + L2 なら、伸ばし切りにする（長さは伸縮しない）
- 肘は、常に体の外側（その腕の側）へ曲げる
- 上腕の角度 = 腕の方向 −（外側の符号）× acos((L1² + d² − L2²) / (2·L1·d))
- 前腕は、肘から手の目標点へ向ける

| state | v1の表現 |
|---|---|
| idle / move | 部位のtransformのみ（d ≈ 0.9R、肘を軽く曲げる） |
| push startup / active / recovery | transformのみ（active は d ≈ 1.56R でほぼ伸ばす） |
| counter | transformのみ |
| kuzushi | transformのみ（揺れは従来の式） |
| grip reach / recovery | transformのみ。握る手の差し替えはDeferred |
| grapple turning / neutral | transformのみ |
| morozashi holder / disadvantaged | transformのみ（holderは d ≈ 1.86R で伸ばし切り） |
| drive | transformのみ |
| frozen | 時間による動きを止める（従来どおり） |

- 別の画像1枚 / 姿勢全体の画像: **不要**。焼き込みposeのsprite sheetは作らない
- `PoseParams` の値は、そのまま出発点にする。調整は統合Taskで、presentationの中だけで行う

## 14. Transformのリスク分類（現在のcode）

| transform | 分類 | Productでの扱い |
|---|---|---|
| 腕の `setScale(reach, 1)`（0.5〜1.55） | **置き換える（Product risk 最大）** | 2関節の回転。部位の長さを伸縮しない |
| torsoとmawashiの `setScale(crouch)`（0.93〜1.03） | 限られた範囲なら許容 | 一様で約±7%以内なら維持してよい |
| 外見の係数による非一様のscale（§18） | 限られた範囲なら許容 | 各軸で約 −10% 〜 +15% 以内 |
| 足のoffset（stance / foot / stride） | 維持してよい | 平行移動のみ |
| torsoRot（kuzushiの揺れ） | 維持してよい | 剛体の回転 |
| rootの回転（facing） | 維持してよい | 剛体の回転。光の条件あり（§16） |
| shadowのworld offsetと回転 | 維持してよい | ほぼ円形なので問題ない |
| mawashiの `setTint`（色、holderを明るく） | 置き換える | 色の別版。明るくする表現は別の方法で（§15） |

## 15. Mawashiの色

| 案 | 評価 |
|---|---|
| A. 灰色の画像を、runtimeでtintする | 安い。ただし、tintは乗算なので、描いた陰影・ハイライトが沈み、色も平板になりやすい |
| B. 色ごとに描き分けた画像 | 品質は最高。ただし生成のたびに色の一貫性がずれる |
| C. 1枚の描いたmawashiから、offlineで決定的に色を置き換えた別版を作る | 陰影を保ったまま、色の数を安く増やせる |

**推奨: C**（toolで作る。v1は2色）
- 東西の区別のため、例: 藍・朱
- 現在のdebug / playerの青と赤は、**最終的なまわしの色のruleではない**。色の割り当てはpresentationのmetadataで決める
- Morozashi holderを「明るいまわし」で示すのは、VISUAL-01Aの暫定の手がかり
  - Productでは、別の控えめな表現（例: 低いαの加算overlay）に替えるか、なくすか、統合Taskで決める（**Deferred / UD-4**）
- 最終的な色の体系（番付・部屋ごとの色など）はDeferred

## 16. 影と光

- arenaの光: 左上の高い位置から、柔らかい光。影は右下へ落ちる
- **部位に焼き込む光は、ほぼ真上からの中立な立体感にとどめる**
  - 中央をやや明るく、縁をやや暗く
  - 強い方向性のハイライトや、部位の中の影の落とし込みは描かない
  - 理由: 部位はfacingと一緒に回転するので、方向のある光を焼き込むと、回転したときに光の向きが体と一緒に回って不自然になる
- **worldに対して一貫した光は、別の影spriteで出す**
  - 中心から右下へ約0.1R
  - 柔らかい縁の楕円で、α0.25〜0.3
  - 回転しても形がほぼ変わらない
  - 生成で描かず、toolで決定的に作る（または現在と同じGraphics）
- これを妥協点として推奨する（world一貫の光と、体に相対的な光の中間）

## 17. 2人の重なり

- 現在: 両者のrootが同じdepth 2で、作成順に重なる（`wrestler-a` が常に下）
- 組み・もろ差し・Driveでは、`wrestler-a` の腕が相手の体の下に隠れる。**Productでは目立つリスクがある**
- **推奨（統合Taskで実装）**
  - 1人をdepthの帯に分けた3つのContainer（体 = foot / torso / mawashi、腕、頭）にし、同じ位置と回転を与える
  - 両者の体 < 両者の腕 < 両者の頭 の順に重ねる
  - 毎frameの動的な並べ替えは不要（固定の帯で足りる）
- 接触・Grip・Drive・もろ差しの重なりは、previewで確認する（§20）

## 18. 将来の外見の変化（User Decision: Accepted）

**Accepted**
- presentationだけで、体型を変えられるようにする
- 体重 → 見た目の幅とかさ
- 身長 → 見た目の長さとreach（特に腕）
- gameplay（接触、Gripの範囲、Push、bodyRadius、式）は変えない

**真上視点での制約**
- 身長は鉛直方向の量なので、真上からは直接見えない
- そのため、腕の長さ（reach）と、足の幅・体の前後の長さで表すことを推奨する

**外見のmodel（Recommended。presentation）**
- 入力は2つの正規化された値 `bulk ∈ [−1, 1]`（体重由来）と `stature ∈ [−1, 1]`（身長由来）
- そこから、次の係数を出す（clampの範囲はProvisional）

| 係数 | 対象 | 範囲の目安 |
|---|---|---|
| `bodyWidthFactor` | torsoとmawashiの横幅（肩・腹・腰）、肩の位置 | 0.90〜1.15 |
| `bodyDepthFactor` | torsoとmawashiの前後（腹のふくらみ） | 0.92〜1.12 |
| `upperArmLengthFactor` / `forearmLengthFactor` | L1 / L2 | 0.90〜1.12（部位の画像の長さも、同じ係数でわずかに伸縮する） |
| `stanceFactor` | 足の幅 | 0.92〜1.08 |

- 全体の一様なscaleはしない。見た目の外形は、衝突の円（約123 px）の近くに保つ
- kgやcmを、Phaserのscaleへ直接写さない。正規化した値への変換は、将来のprofile / Managementの側（Simulationの外）で行う（Deferred）
- 範囲を超える体型が必要になったら、torsoの別版（細身 / 標準 / 重量）を描いて切り替える（Deferred）
- 将来の可能性として記録するだけのもの: 身長と体重が、育成やパラメータの傾向（例: 体重と成長の傾向、身長と腕力・投げ）に影響するかもしれない
  - **式・stat名・数値は決めない。BoutSimulationにもつながない**

**2人目の扱い（現在のprototype）**
- 同じ `base` の部位を使う
- まわしの色の別版と、外見の係数（例: 東は標準、西はbulk +）で区別する
- 顔の生成、肌・髪・年齢・国籍などによる変化、体型の生成systemはDeferred
- 肖像（顔のclose-up）とは制作を切り離す（HUDは肖像を必要としない）

## 19. Prompt recipe（生成時の指針）

**共通**
- strict top-down（真上から見下ろす。perspective cameraではない。地平線も側面も見えない）
- 成人の力士1人、様式化したpainted 2Dのgame art、Product品質
- 暖色の伝統的な色調（受理済みのarenaに合わせる）
- 光は柔らかく、ほぼ真上からの中立なもの（強い方向性の影を焼き込まない）
- 透明（または無地）の背景。土俵・arena・文字・logo・HUDは入れない
- 避けるもの: chibi、写実、劇画調の陰影

**Canonical wrestler**
- 立った姿勢で、腕を軽く開いて肘を少し曲げる
- 真上から、頭頂・髷・肩・背中・腹のふくらみ・腰のまわし（後ろの結び目）・足先が見える
- 顔は前（画面の右 = +x）を向く
- 全身が画像に収まり、部位が他の物に隠れない

**部位sheet**
- 承認したcanonical wrestlerと同じ人物・画風・肌・光
- 次の部位を、互いに十分離して横向き（部位の軸を右向き = +x）に並べる
  - torso（腕なし。肩の付け根を描き足す）
  - mawashi（torsoと同じ大きさと位置で、別に1つ）
  - 右の上腕（肩から肘。肘の重なり分を描き足す）
  - 右の前腕と手（肘から手）
  - head（真上から、顔は右）
  - 右の足
- 部位の間は、最低でも部位の幅の半分以上あける
- 影は描かない

## 20. Userの視覚承認（previewの最小set）

1. **Canonical wrestler**（透明背景）: 画風・体型・真上視点の承認
2. **部位から組み立てたidle**: arenaの上に、runtimeの大きさ（直径約123 px）で置いたもの。部位の継ぎ目や縁の確認
3. **回転のsample**: 0° / 45° / 90° / 180°（光と読みやすさ）
4. **pose**: push active、grip reach、組み（2人の重なり。neutralともろ差し）
5. **外見の変化**: bulkとstatureの最小と最大

- 1はAI生成の段階で確認する
- 2〜5はtoolのpreview（Python）で、§13の2関節と代表的なpose値をpreview専用に写して作る
  - pose値の正本は、引き続きTypeScript
- Phaserでの最終確認は、統合TaskのUser Play Testで行う

## 21. Implementation staging（Recommended）

（Sequence C。描き直しを最小にする）

1. **ART-WRESTLER-01**: canonical wrestlerの生成 → User承認（preview 1）
2. **ART-WRESTLER-02**: 部位sheetの生成 + `tools/wrestler_art/`（region / joint定義、切り出し、正規化、縮小、mawashiの色の別版、`parts.json`、manifest、preview 2〜5）→ User承認
3. **ACTION-ART-03A**: Phaserへの統合
   - textureを生成する方式から、assetの読み込みへ替える
   - 腕を2関節にする
   - 外見の係数とfixture
   - depthの帯の3分割
   - mawashiの色の別版
   - → User Play / Visual Test

toolを先に作る案（Sequence B）は採用しない。生成画像が型どおりに並ぶ保証がないので、実際のsheetに合わせてregionを定義するほうが、やり直しが少ない。

**現在のstaging（ART-WRESTLER-02A以降。§11の変更による）**
1. ART-WRESTLER-01（canonical wrestler）は行わない（全身生成は廃止）
2. **ART-WRESTLER-02A**: 部位の候補 + `tools/wrestler_art/` で、切り出し・正規化・idleの組み立てpreview → Technical PASS、User Visual Gateで **不採用**
3. **ART-WRESTLER-02B**: 1枚の全身spriteの評価（正規化、16方向の回転、arena上のpreview）→ toolはPASS、候補の画像は作り直し
4. **ART-WRESTLER-03A**: 別々に描いた2枚の剛体sprite（反転なし）の、360°回転、向かい合い、最小の剛体の動き（前進、よろけ、接触）の検証 → User Visual Gate（剛体で十分 / 一部だけ専用pose / 剛体の360°は不可）
5. 次: 03Aの結果によって、actionのposeの方式を調べる（方式は未決定）
6. **ACTION-ART-03A**: 2枚の剛体spriteをPhaserへ統合した（§0）→ User Play Test。専用のposeは、その結果しだいで後の混合poseのTaskで扱う

## 22. Deferred / Unresolved

- 握る手などの手の別版、手を独立した部位にすること
- atlas化、2倍のruntime export（UD-2）
- 最終的なまわしの色の体系、Morozashi holderの見た目の手がかり（UD-4）
- 範囲を超える体型の別版（細身 / 標準 / 重量のtorso）
- 肌・髪・顔・年齢・国籍による変化、体型の生成system
- kgやcmから外見の係数への変換（profile / Management側）
- 身長・体重がgameplayや育成に与える影響（可能性として記録するのみ）
- 肖像（顔のclose-up）の生成
- 決まり手や倒れなどの専用pose
- Productの影のart（v1はtoolか、手続き的な楕円）

## 23. Do Not Reopen / 保持する制約

- `bodyRadius`（0.35 m）、meterからpixelへの写像、直径約123 pxの表示scale
- gameplay、接触、Gripの範囲、Push / Drive / Counter、Ring-out / Tokudawara
- poseの判断は `wrestlerVisualState.ts`（pure）が持ち、Simulationへ移さない
- facingは連続した値をそのまま使う（量子化しない）
- 受理済みのarena、HUD、取組前の比較表示
