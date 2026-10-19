Task-ID: ACTION-05B-GRAPPLED-ORIENTATION-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 61a1a493a54a02cc7d171f3c70d722a6640f871f
Agent-Start-Head: 191b79e152bf28aa0c28cf9c8ec42e83b6229170
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。

- 側面・背後の優位は、新しいstateを保存せずに表現できる。canonicalな`position` / `facing` / `engagement`だけから導ける
- 必要なのは「GRAPPLED中のfacingを即時ではなく一定速度の旋回にする」ことと「準備完了を角度誤差から導く」ことだけ
- FREEのfacingの既存挙動もGrapple bondも変更不要
- ACTION-05Aのrelease semanticsとの衝突が1点ある。これはUser Decision（UD-3）として明示し、推奨既定値を付けた。それ以外にBLOCKEDになる点はない

Production Source / package / lockfileは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 3`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `61a1a49`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `61a1a49..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `191b79e`
- 読んだもの: AGENTS.md、`BoutTypes.ts`、`BoutSimulation.ts`、`BoutGrip.test.ts`、`BoutCounter*.test.ts`、`BoutScene.ts`、ARCHITECTURE.md、Review / Play Testの記録（`1da33cc`、`7b7adfc`）

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Recommendation**: 本Reportの推奨（未実装）
- **User Decision**: 実装前にUserが決める事項
- **Deferred**: 後続Task

角度は画面座標（+y下）で、正の回転は**画面上で時計回り**。

# Current Source Findings / Q1（Current Fact）

`step()`の順序: posture timer → release → FREE action開始 → move / 積分 → contact → bond（GRAPPLED）またはCounter → Grip → Push（FREE）→ action timer → `updateFacing()`。

- **Kuzushiのfacing**: Counter成功tickの末尾から、`updateFacing`がKuzushiの攻撃側をskipする。そのため攻撃側のfacingは、成功の直前のtick末尾の値（防御側の移動前の位置を向いた値で、ほぼlocked `d`）で固定され、Kuzushiの間（30 tick）は側面・背後のずれが見える
- **Kuzushiの消費**: Grip成立tickの`resolveGrip()`内（FREE時の解決段階）で、targetのpostureをstableにしてから`enterGrapple()`を呼ぶ
- **bond**: `enterGrapple()`の中の`resolveGrappleBond()`は、2人を**中心軸に沿って**対称に動かすだけ。そのため互いへの方位（bearing）は変わらない。GRAPPLED中の外力は両者で同じなので平行移動になり、ここでも方位は変わらない
- **優位が消える箇所**: Grip成立tickの**末尾の`updateFacing()`**。この時点でtargetはもうstableなので、即座に相手を向く
  - Grip成立tickのSnapshotの時点で、側面・背後のずれはすでに0
  - tick内では`resolveGrip`から`updateFacing`までの間だけ元のfacingが残るが、外からは観測できない
- **FREEのfacing**: stableな者は毎tick末に即座に相手を向く。正面からのGrip直前の誤差は、1 tick分の相対移動による小さな角度だけ（最大でも約0.14 rad）

# Recommended Alignment Formula（Q2）

```ts
// Pure helpers (Simulation-owned module, Phaser-free), shared by Simulation and Scene.
function normalizeAngle(a: number): number // -> (-π, π]
function grappleFacingError(self: Vec2, facing: number, opponent: Vec2): number {
  const bearing = Math.atan2(opponent.y - self.y, opponent.x - self.x)
  return normalizeAngle(bearing - facing) // signed, (-π, π]
}
isGrappleReady = Math.abs(error) <= GRAPPLE_FACING_TOLERANCE
```

- `normalizeAngle`は結果を`(-π, π]`に正規化する（ちょうど−πは+πにする）
- **±πのtie（重要）**: Best（背後）では、誤差が**ちょうど±π**になるのが標準の状況（例: 対称配置でBのfacing = π、背後のAへの方位 = 0）。浮動小数の誤差で旋回方向が変わらないよう、`|error| >= π − GRAPPLE_TIE_EPSILON`（例 1e-9）のときは**固定で+方向（画面時計回り）**に回る。決定的で、randomは使わない
- tolerance: 名前付きの1定数`GRAPPLE_FACING_TOLERANCE`。暫定π/12（15°）（UD-2）
- 同一中心（方位が定義できない）: 誤差0、つまり準備完了とする（`facingToward`のfallbackと同じ考え方）

# Recommended Turn Rule（Q3、Q4、Q12）

**Recommendation**: FREEは現行の即時auto-facingを維持する。**GRAPPLED中だけ**、各参加者は相手への方位へ1 tickあたり最大`GRAPPLE_TURN_RATE × TICK_SECONDS`だけ、最短方向（tieは+方向）へ回る。残りの誤差が1 step以下ならsnapする（行き過ぎない）。

- **自動旋回**を推奨: ACTION-05AでWASDは抑制済みで、回転の入力もない。操作は単純なまま「回り込まれた側は向き直るまで待つ」という読みやすい開きになる
  - Game Feel: 不利側は数百msのあいだ無力になり、この時間がそのまま優位の大きさになる。時間は方位差に比例するので、側面は短く、背後は長い
- 比較:
  - 固定timerによる硬直: 実際の向きと無関係な隠れた時間になる。Review方針で不採用
  - 側面・背後の分類を保存: 位置とfacingから導ける内容の重複になる。不採用
  - 手動の旋回入力: 新しい入力が必要で、Userの「単純な操作」と食い違う。Deferred
- **facingだけを回す**（位置は動かさない）。準備完了の判定には十分で、表示も既存のfacing markerが体の周りを回るので読める。回り込む軌道（orbit）は導入しない
- `GRAPPLE_TURN_RATE`は暫定π rad/s（180°/s）（UD-1）

# Action Readiness Rule（Q5、Q7、Q8）

- `canActInGrapple(snapshotOrState, id) = engagement.kind === 'grappled' && isGrappleReady(...)`（pure helper）
- 参加者ごとに独立に評価する:
  - 掴んだ側が準備完了でtargetが旋回中 → 掴んだ側だけが行動できる
  - 両者準備完了 → 通常
  - 両者旋回中 → 準備完了になった側から行動できる
- **封じるもの**（推奨）: 将来のGRAPPLED actionすべて（Drive、Throw、Lift、差し手争い）と、**release（UD-3）**
- **封じないもの**: 自動旋回そのもの（受動的に進む）
- 優位側の行動: 将来の通常のGrapple action systemをそのまま使う。「一方的な攻撃」用の別stateは作らない（不利側の準備が整っていないだけ）
- 優位側の行動が相手の旋回をresetすることはない
  - Drive（pairの平行移動）では方位が変わらないので、旋回はそのまま続く
  - 幾何を変えるThrowなどは、そのTaskで明示的に扱う

# Release Conflict Analysis（Q6）— User Decision Required

ACTION-05Aでは、どちらの参加者もいつでも即座にreleaseできる。背後を取られた側がreleaseすると、次のようになる:

1. FREEに戻る
2. FREEのauto-facingで即座に相手を向く
3. releaseした側はGrip recovery（12 tick）に入る
4. 失う時間は12 tickだけ。背後からの旋回には約55 tickかかる（暫定値の場合）ので、優位をほとんど**安く回避できてしまう**

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | releaseもgrapple actionとして準備完了を条件にする（旋回中はreleaseできない） | 1つのruleで「何もできない」が成り立つ。正面の組みは成立した瞬間から両者準備完了なので、ACTION-05Aの挙動はそのまま。変わるのは「旋回中のrelease」だけ |
| B | releaseは常に可能で、旋回中ならrecoveryを延ばすなどの罰を付ける | 新しい罰の調整が必要。FREEで即座に向き直れるので、優位は結局罰の長さに置き換わる |
| C | release後もFREEのfacingを段階的にする | Accepted FREEのfacing（Push lock、Contactのfallback、Kuzushiの固定）に広く影響する。変更が大きい |
| D | 旋回中のreleaseはKuzushiになる | 罰が強すぎ、意味も混ざる |

推奨はAとする。ただしAccepted 05Aのrelease semanticsを（旋回中に限って）変更するので、**User Decision（UD-3）**。

- 既存test T105の「Morozashiの不利側がreleaseする」は、正面で成立したMorozashi（誤差ほぼ0）なのでAでもPASSする（確認済み）
- 優位側（準備完了）は、いつでも自分の意思でreleaseできる

# Morozashi vs Orientation Separation（Q9）

- **Morozashi** = engagementに保存される持続的な優位（`advantage.holderId`）
- **Orientation** = 毎回導出する準備状態（`isGrappleReady`）。保存しない
- 将来の解決関数は、これらを**独立した入力**として読む:
  - Drive: 開始の可否 = `canActInGrapple`、大きさ = `advantageFactor(engagement, driver)` × 将来のstat
  - Throw: 開始の可否 = `canActInGrapple`、成功率の入力 = advantage（+ Deferredで相手の向きの誤差）
- 「背後のMorozashi」「側面のMorozashi」のような組み合わせstateは作らない

# Counter Success / Best Integration（Q10）

Current Fact: 攻撃側のKuzushi中のfacing `f`はほぼlocked `d`（側面へ動いた場合などは小さくずれる）。移動先は`d`を基準に決まる。

- **Success（側面）**: 防御側は`P ± perp·R`にいる → 攻撃側から見た方位は`d ± 90°` → 誤差 ≈ **±90°**
- **Best（背後）**: 防御側は`P − d·R`にいる → 方位は`d + 180°` → 誤差 ≈ **180°**（上記のtie ruleで+方向に回る）
- Grip成立とbondは方位を変えない（中心軸に沿った対称な移動だけ）。Kuzushi中に防御側が回り込んでから組んだ場合も、その時点の幾何から導ける

同じ旋回速度なら、旋回時間は`(|誤差| − tol) / rate`に比例する。暫定値（π rad/s、15°）の場合:
- 側面: (90° − 15°) / 180°/s ≈ 0.42 s（約25 tick）
- 背後: (180° − 15°) / 180°/s ≈ 0.92 s（約55 tick）

**背後が自然に約2倍長くなる**。保存する分類や個別のtimerは不要。

注意: Kuzushi中の攻撃側はovershootで前方へ流れる。その間に防御側が歩いて回り込めば、組む時点の誤差は変わる。これは導出の性質として正しい振る舞い（実際の幾何に従う）。

# Neutral / Front Grip（Q11）

- FREEのauto-facingのため、通常のGrip直前の両者の誤差は1 tick分の小さな角度（最大でも約0.14 rad ≈ 8° < 15°）
- 成立tickの末尾の旋回では、誤差が1 step（3°）を超えていても許容範囲内なので、**成立した瞬間から両者準備完了**になる
- 組んだことだけを理由にした強制の硬直はない
- 正面で成立したMorozashi（例: 失敗Counterで崩れた正面の相手）も即座に準備完了。Morozashi自体が優位になる

# Tick Order（Q13）

**Recommendation**:

1. **準備完了の判定はtickの先頭の状態で行う**（前のtick末のfacingと、tick開始時の位置）。release判定とGRAPPLED action開始で使う。これは直前のSnapshotと一致するので、「画面にREADYと出ていれば、その次の入力が通る」
2. **旋回は`updateFacing()`（tickの末尾）で行う**。FREE（Kuzushiでなければ）は即時、GRAPPLEDは一定速度。Grip成立tickでもGRAPPLED側の規則で回る（成立tickの末尾から旋回を始める）
3. **off-by-one**: tick `t`の末尾で許容範囲に入った参加者は、**tick `t+1`から**行動できる。同じtickで行動できるようにしないのは、Snapshotとの一貫性、決定性、判定位置を1か所に保つため

# Snapshot / Presentation Boundary（Q14）

- **新しいcanonical stateは不要**。`position` / `facing` / `engagement`はすでにSnapshotにある
- Simulation側のpure module（例: `sumo/grappleOrientation.ts`。Phaser非依存）に`normalizeAngle` / `grappleFacingError` / `isGrappleReady`を置き、Simulationと**Sceneの両方が同じ関数を使う**。Sceneで式を複製しない
- debug表示: GRAPPLED中、各参加者のphase textに`TURNING` / `READY`（必要なら`TURNING 87°`）。既存のfacing markerが回る様子で旋回が見える

# Future Stats Boundary（Q15）

`grappleTurnRate(participant)`という単一の関数を経由させ、今は定数を返すだけにする。将来、能力値（例: 敏捷・技術・バランスのどれか。未決）が決まったら、この関数がそれを読む。`ParticipantSetup`への追加は能力値のsystemができてからにする（今は不要）。

# Directional Push Advantage（Q16）

- FREE Pushの方向による優位（Deferred）は、`resolvePush`の時点の幾何（Contact normalと受け手のfacing）から導く
- GRAPPLEDの準備状態は、各参加者自身の角度誤差から導く
- 共通の「側面・背後flag」は保存しない
- **所見（Current Fact）**: FREEのstableな参加者は常に即座に相手を向く。そのため、方向による優位が実際に効くのは、受け手がKuzushi中（facing固定）のときだけになる。方向によるPush優位のTaskでは、この点を前提として扱う必要がある（本Taskでは変えない）

# First Implementation Scope（Q17）

**Recommendation: ACTION-05B1 Grappled Orientation Foundation**だけを先に実装する。

- 内容: pure helper、GRAPPLED中の一定速度旋回、tie rule、準備完了の導出、行動の可否の境界（`canActInGrapple`）、UD-3に従ったreleaseの可否、TURNING / READY表示、Counter側面・背後との統合test
- Driveなしでも検証できる: 旋回の見え方、側面と背後の時間差、release可否（UD-3がAの場合）
- 限界: 「優位側だけが一方的に動ける」の実感はDrive（05C）で初めて得られる。05B1のPlay Testは旋回の読みやすさと時間差に絞る
- その後に**ACTION-05C Grappled Drive**: ↑ Drive、neutralとMorozashiの差、`canActInGrapple`による開始の可否

# Required Automated Tests（Q18、05B1用）

1. `normalizeAngle`: 範囲`(-π, π]`、−π → +π、±πのtieは+方向
2. 正面Grip → 成立tickの時点で両者準備完了
3. 側面Grip（Counter Success → Grip）→ 被害側は旋回中、掴んだ側は準備完了
4. 背後Grip（Best → Grip）→ 被害側の旋回tick数が側面より長い（およそ2倍で、式どおりのtick数ちょうど）
5. 最短方向の旋回（両方の符号）と、±πで固定の+方向
6. toleranceの境界ちょうど（`<=`）
7. 旋回速度ちょうど（1 tickあたりの変化量）、行き過ぎなし、最後のsnap
8. 準備完了はtick末尾で切り替わり、行動は次のtickから可能
9. side / rearを表すfieldが存在しない（Snapshotのkey集合の検査）
10. Morozashiのholderは旋回と無関係に維持される
11. UD-3に従ったrelease（Aの場合: 旋回中のreleaseは無視されqueueしない。準備完了なら可能。優位側はいつでも可能）
12. FREEのauto-facingは不変（既存test）。Kuzushiのfacing固定も不変
13. bondと旋回が干渉しない（距離R、位置不変）
14. 混在sequenceのreplay一致・facingがfinite
15. 既存148件は、Grappled actionを使わない範囲でPASS（UD-3がAでもT105は正面なのでPASS）

# User Play Test Plan（Q19）

最初にOrientation FeelがREQUIREDになるのはACTION-05B1。

確認項目:
1. 側面は短い隙、背後は長い隙として感じられるか
2. 被害側がsnapせず、目に見えて旋回するか
3. 正面の組みに不要な遅れがないか
4. 旋回速度が読みやすく、理不尽でないか
5. releaseのruleが分かりやすいか
6. neutralとMorozashiの区別が残っているか
7. bondやfacing markerがjitterしないか

「優位側が先に動ける」実感は05C（Drive）で確認する。

# User Decisions Required（Q20）

| # | 決定事項 | 推奨既定値 |
|---|---|---|
| UD-1 | 暫定の旋回速度 | π rad/s（180°/s。側面約0.42 s、背後約0.92 s） |
| UD-2 | facing tolerance | π/12（15°） |
| UD-3 | 旋回中のrelease | **A: 不可**（05Aのsemanticsを、旋回中に限って変更する） |
| UD-4 | 「何もできない」の範囲 | 将来のすべてのgrapple action（Drive / Throw / Lift / 差し手）とrelease。受動的な旋回は継続する |

技術的な決め事（User決定は不要）: ±πのtieは固定で+方向、準備完了はtickの先頭の状態で判定、facingだけを回す。

# Rejected / Deferred

Rejected:
- 固定timerによる硬直
- 側面・背後の分類やorientationAdvantageの保存
- Presentationだけの旋回
- FREEのfacingを段階的にする案（Q6 C）
- release失敗時のKuzushi（Q6 D）
- 回り込む軌道（orbit）
- 汎用state machine

Deferred:
- 手動の旋回入力
- turn-rateの能力値依存
- 優位側がpairを回す（相手の向きを崩す）技
- 旋回中の相手への投げ成功率補正
- 方向によるPush優位（FREEのfacingの扱いを含む）
- Drive / Throw / Lift
- 旋回のアニメーション

# Next Implementation Sequence

1. **ACTION-05B1 Grappled Orientation Foundation**: User Play Test REQUIRED（Orientationの最初のgate）
2. **ACTION-05C Grappled Drive / Yorikiri**: `canActInGrapple`による開始の可否、Morozashiの係数。Ring-out / BoutOutcomeの要否はReviewで判断
3. Throw / Lift: Driveが受理された後

# Design Deviations

なし（Investigationのみ）。

# Unexpected Scope

なし。

参考の所見（修正はしていない）:
- Bestでは誤差がちょうど±πになるので、tie ruleは実装の必須項目
- FREEのfacingが即時なので、方向によるPush優位はKuzushi中にしか効かない（Q16）

# Verification

- Q1〜Q20に回答済み。BLOCKEDになる点はない
- Current Fact / Recommendation / User Decision / Deferredを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはACTION-05B1。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate grappled orientation advantage`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
