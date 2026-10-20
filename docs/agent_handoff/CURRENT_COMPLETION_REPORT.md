Task-ID: ACTION-ART-03-WRESTLER-PRODUCT-SPEC
Result: PASS
Branch: develop
Source-Baseline: c937db6931a830b79d6110077cb1b5e1cf0ce577
Agent-Start-Head: 2c61c9a5ee0e3ce28b91f3a03a9a6d903dee7c14
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Design / Documentation only）。

- `docs/WRESTLER_PRODUCT_ART_SPEC.md`（§1〜§23）を、Product力士artの正本として作った
- 内容
  - 部位の構成: 腕は上腕・前腕の2つ。伸縮を2関節の解析解で置き換える
  - pivotとローカル座標の約束、layer、size（master 4倍 → runtime 1倍）
  - AI生成のworkflow（canonical → 部位sheet）、`tools/wrestler_art` の推奨
  - path / 命名、poseの対応、transformのリスク、mawashiの色、光と影、2人の重なり
  - 外見の変化（Userの決定を反映）、prompt、preview、段階
- `docs/ARCHITECTURE.md` に1行だけ追加した（今後の方向の注記）
- Production Source、assets、package / lockfileは未変更

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `c937db6`（ancestor）、Handoff-Mode GITHUB
- `c937db6..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `2c61c9a`
- Current Sourceは、部位を組み合わせる方向と矛盾しない
  - 全poseを、gameplay stateを変えずに表せる
  - middlewareは不要
  - STOP条件には該当しない

# Current WrestlerView Findings（spec §2）

- 部位
  - shadow（world上で右下へ +0.07R / +0.12R、depth 1）
  - foot ×2（同じtexture）
  - torso（前後1.6R × 肩幅2.0R）
  - mawashi（白をtint）
  - arm ×2（capsule 1.2R + 手、origin = 肩）
  - head（髪・額・髷、(0.3R, 0)）
- rootは1つのContainerで、`participant.facing` で回転する。depth 2は両者で共通（作成順）
- local +x = 前、+y = 右側
- R = 0.35 m × 400/2.275 ≈ **61.5 px**（直径約123 px）
- 腕のreachの係数は0.5〜1.55。肩から手まで **0.6R〜1.86R**

# Visual-state Coverage（spec §4、§13）

idle、move、push（startup / active / recovery）、counter、kuzushi、grip（reach / recovery）、grapple（turning / neutral / morozashi holder / disadvantaged）、drive、frozen のすべてを、**部位のtransformだけ**で表せる。
- 別の画像や姿勢全体の画像は不要
- 握る手の差し替えはDeferred

# Product Part Recommendation（spec §5）

- `shadow`、`foot`、`torso`、`mawashi`（+ 色の別版）、`upper_arm`、`forearm`（手を含む）、`head` の **7枚**
- 右側だけを描き、左は反転する
- 腕を分ける理由
  - 1枚の腕を伸縮すると、0.5〜1.55倍（約3.1倍の範囲）で歪む
  - 身長による見た目のreachの変化（User Decision）もある
- 2関節: L1 ≈ 0.85R、L2 ≈ 0.95R
  - 伸ばし切り1.8R（最大1.86Rに近い）、最短0.1R（< 0.6R）
  - 余弦定理で解く。肘は外側へ曲げる。middlewareは不要

# Segmentation Alternatives（spec §6）

- A（腕1枚）: 歪むので不採用
- A'（reachごとの腕の画像）: 切り替えが跳ねるので劣る
- 手を独立させる: Deferred
- 脚を部位にする: 真上からは隠れるので不採用。足に足首を含める
- skeletal middleware: 不採用

# Pivot / Coordinate Contract（spec §7）

- rootの約束は、現在のもの（+x = 前、+y = 右、facingで回転）を保持する
- 部位の画像は、軸を +x に向けて描く
- pivot / 取り付け位置 / 左右の扱いを、部位ごとに表にした
  - torsoとmawashi = 体の中心
  - 上腕 = 肩関節、前腕 = 肘関節
  - head = 頭の中心（0.3R前）
  - 足 = 足の中心
  - shadow = world上で右下
- 透明の余白は、master 16 px（runtime 4 px）以上
- pivotは画像の寸法から推測しない。toolが出す `parts.json` の値を使う

# Sizing（spec §9）

- master = runtimeの4倍（R_master ≈ 246 px）
- runtime export = 1倍（arenaの1920と同じ方針）。決定的に縮小する
- 生成された画像のscaleの差は、toolがtorsoの肩幅で正規化する
- 2倍のruntime exportはUser Decision（UD-2）

# AI Generation Workflow（spec §11、§19）

**C → B の2段階を推奨する**
1. Canonical wrestler（1人）を生成し、画風・体型を承認する
2. 承認画像を参照して、同じ画風の部位sheetを生成する（重なり分を描き足し、互いに離して並べ、透明背景）
3. 決定的に切り出す

部位ごとに別々に生成する案は、一貫性が崩れるので不採用。prompt recipe（共通 / canonical / 部位sheet）をspecに書いた。

# Offline Tool Recommendation（spec §12）

`tools/wrestler_art/` を、次の制作Taskで作ることを推奨する（dohyo_artの思想を引き継ぎ、codeは流用しない）。
- 人が書くregion / joint定義
- 切り出し、trim、余白
- master 4倍への正規化と、1倍への縮小
- mawashiの色を置き換えた別版
- `parts.json`、manifest（hash）、preview

atlasと汎用frameworkは作らない。

# Asset Paths / Naming（spec §10）

- Source: `tools/wrestler_art/input.local/`（ignore）
- 出力: `output*.local/`
- Runtime: `public/assets/action/wrestler/base/{torso,mawashi_<color>,upper_arm,forearm,head,foot,shadow}.png` と `parts.json`
- 左右は反転で扱い、`_l` / `_r` は付けない
- variantは `base` から始める

# Transform Risks（spec §14）

- **置き換える**
  - 腕の `setScale(reach, 1)` → 2関節の回転
  - mawashiの `setTint` → 色の別版
- **限られた範囲なら許容**
  - torsoの一様crouch（±7%）
  - 外見の係数による非一様scale（−10%〜+15%）
- **維持してよい**: 足のoffset、torsoRot、rootの回転、shadow

# Mawashi Strategy（spec §15）

- 推奨: 描いたmawashi 1枚から、offlineで輝度を保ったまま色を置き換えた別版（v1は2色）
- runtimeのtintは、陰影が沈むので採用しない
- 現在の青と赤は、最終的な色のruleではない
- Morozashi holderの「明るいまわし」は、Productでの扱いを統合Taskで決める（UD-4）

# Lighting / Shadow Strategy（spec §16）

- 部位に焼き込むのは、ほぼ真上からの中立な立体感だけ（部位は回転するので、方向のある光を焼き込まない）
- worldに対して一貫した光は、別の柔らかい影sprite（右下へ約0.1R、α0.25〜0.3）で出す

# Overlap / Layering Risk（spec §8、§17）

- **リスク**: 両者が同じdepthで固定順なので、組み・もろ差し・Driveでは、`wrestler-a` の腕が相手の体の下に隠れる
- 推奨: 統合Taskで、1人をdepthの帯3つ（体 / 腕 / 頭）に分ける。両者の体 < 両者の腕 < 両者の頭
- 動的な並べ替えは不要

# Future Variation Boundary（spec §18。User Decisionを反映）

- presentationだけで体型を変える。体重 → 幅とかさ、身長 → reach
- 真上視点では、身長は腕の長さ・足の幅・前後の長さで表す
- 入力は `bulk` / `stature` ∈ [−1, 1] で、そこから `bodyWidthFactor`（0.90〜1.15）/ `bodyDepthFactor`（0.92〜1.12）/ `upperArmLengthFactor` / `forearmLengthFactor`（0.90〜1.12）/ `stanceFactor`（0.92〜1.08）を出す
- kg / cmを直接scaleへ写さない。変換はprofile / Management側でDeferred
- 全体の一様scaleはしない
- gameplay（bodyRadius、接触、Grip、Push）は不変
- 身長と体重が将来の育成やパラメータに影響する可能性は、記録するだけ（式・stat名・数値は決めない）
- 2人目は、同じ部位 + mawashiの色 + 外見の係数で区別する
- 顔、肌、髪、体型の生成、肖像はDeferred

# Prompt Recipe Summary（spec §19）

- strict top-down（perspectiveなし）、成人の力士、様式化したpainted 2D、Product品質、暖色の伝統的な色調
- 中立なほぼ真上の光
- 透明背景（土俵、文字、logo、HUDは無し）
- chibi、写実、劇画調は避ける
- 部位sheetでは、部位の軸を右（+x）に向け、互いに離して並べ、重なり分を描き足し、影は描かない

# User Visual Approval Plan（spec §20）

1. canonical wrestler
2. 部位から組み立てたidle（arenaの上、runtime size）
3. 回転（0 / 45 / 90 / 180°）
4. pose（push active、grip reach、2人の組み neutral / もろ差し）
5. 外見の最小と最大

1はAI生成の段階で確認し、2〜5はtoolのpreviewで確認する。最終確認はPhaser統合のUser Play Test。

# Recommended Next Task Split（spec §21）

1. **ART-WRESTLER-01**: canonical wrestlerの生成 → User承認
2. **ART-WRESTLER-02**: 部位sheet + `tools/wrestler_art` + preview → User承認
3. **ACTION-ART-03A**: Phaserへの統合（asset、2関節、外見の係数、depthの帯、mawashiの別版）→ User Play / Visual Test

toolを先に作る案（Sequence B）は、生成画像が型どおりに並ぶ保証がないので採用しない。

# User Decisions Required

- **UD-1（腕の分け方）**: 上腕 + 前腕を推奨する。腕1枚なら制作は安いが、reachの範囲と身長による変化で歪みが目立つ
- **UD-2（runtime exportの倍率）**: 1倍を推奨する（arenaと揃える）。2倍は高DPIでくっきりするが、容量は4倍
- **UD-3（外見の変化の範囲）**: §18の係数の範囲を、まず ±10〜15% 程度に抑えることを推奨する。それを超える体型は、torsoの別版（Deferred）で扱う
- **UD-4（Morozashi holderの見た目の手がかり）**: Productでも残すかどうか、どう表現するか（統合Taskで決める）

# Deferred（spec §22）

手の別版 / 手を独立した部位にすること、atlas化 / 2倍export、色の体系、範囲を超える体型の別版、顔・肌・髪・年齢・国籍の変化、kg / cmからの変換、身長・体重がgameplayに与える影響、肖像、専用pose、Productの影のart。

# Design Deviations

Design Deviations: NONE

# Unexpected Scope（報告のみ）

- 両者が同じdepthで固定順に重なり、`wrestler-a` の腕が隠れる問題は、**現在の暫定viewにも既に存在する**（組みのときに、Playerの腕が相手の下になる）
  - 本Taskでは修正していない
  - Product統合のTaskで、depthの帯を分ける形で解決することを推奨した

# Verification

- Current Sourceを直接読んだ
  - `WrestlerView.ts`、`wrestlerVisualState.ts`、`BoutScene.ts`（力士の生成と同期）、`productArena.ts`、`BoutTypes.ts`、`BoutSimulation.ts`（`BODY_RADIUS`、`GRIP_RANGE_MARGIN`）
  - 方向の約束は、`grappleOrientation.ts` の扱いとして `ARCHITECTURE.md` で確認した
- すべてのvisual stateとposeの値を、specの表と照合した
  - reachの範囲 0.6R〜1.86R
  - idleは0.9R、push activeは1.56R、holderは1.86R
- Production Source、assets、package / lockfileは未変更
- `git diff --check`: PASS
- tests / build: 不要（Sourceは未変更）

# Git Delivery

- Commit: `docs: specify product wrestler art`
  - `docs/WRESTLER_PRODUCT_ART_SPEC.md` / `docs/ARCHITECTURE.md` / 本Report
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
