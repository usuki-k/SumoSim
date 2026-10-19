Task-ID: ACTION-05-GRIP-ENGAGEMENT-MOROZASHI-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: d72f43b0887203095eebe3f1c7efb1d1193a188d
Agent-Start-Head: 771e3e7628c38c20e912eaeb9bd2606f877f8463
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。

- pair-levelのEngagement 1 field で、FREE / GRAPPLED（neutral / morozashi + holder）/ 将来のLIFTEDを、重複したSource of Truthなしに表現できる
- Current Source（action / posture / Contact / Model B）とMaterial Conflictはない
- 実装前に必要なUser決定はすべて§User Decisions Requiredに挙げ、各項目に推奨既定値を付けた。BLOCKEDになる点はない

Production Source / package / lockfile / AGENTS / ARCHITECTURE / GAME_CONCEPTは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 3`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `d72f43b`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `d72f43b..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `771e3e7`
- 読んだもの: `BoutTypes.ts` / `BoutSimulation.ts` / 各test / `pressLatch.ts` / `pushDummyController.ts` / `BoutScene.ts` / ARCHITECTURE / GAME_CONCEPT / AGENTS / 直前のReviewとPlay Test記録（`bbed10b`）

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Recommendation**: 本Reportの推奨（未実装）
- **User Decision**: 実装前にUserが決める事項
- **Deferred**: 後続Task

数値はすべて暫定案。

# Current Source Findings（Current Fact）

- F1 participantのcanonical stateは `position / selfVelocity / externalVelocity / action / posture / facing / bodyRadius`。2者の**関係**を表すstateは存在しない
- F2 Contactは円同士の判定（`distance <= R + CONTACT_SLOP`、`CONTACT_SLOP = 2 mm`）。体同士を束縛する仕組みはなく、WASDで自由に離れられる
- F3 `resolveCounter`は`[a,b]`、`[b,a]`の順で調べるが、成立し得る組み合わせは常に1つなので、配列順による有利はない。新しいpair ruleでもこの性質を保つ必要がある
- F4 `updateFacing`は毎tick相手へ即座に向く（Kuzushi中だけskip）
- F5 action開始はidleかつstableのときだけで、edgeはqueueしない。同じtickの優先順は Push > Counter
- F6 **Counter成功直後のContact喪失**（計算値）:
  - Best成功tickの終わりで、防御側は背後の距離`R`ちょうどにいる
  - 次のtick、攻撃側はovershoot（減衰後0.867 m/s、0.0144 m/tick）で離れ、隙間がslop 2 mmを超えるので**すぐにContactを失う**。最終的な隙間は約0.0625 m（= 1.0² / (2 × 8)）
  - Successの側面では接線方向へ離れるので、約6 tick後にContactを失う。最終的な隙間は約3 mm
  - → 「Contactのみ」をGrip範囲にすると、Counter → Kuzushi → Gripの報酬に、ほぼframe単位の入力が必要になる（Q3、Q12）
- F7 `PushDummyController`は`action` / `posture`だけを見る。Engagementを追加した場合、GRAPPLED中も無視されるPush edgeを出し続け、解除直後にすぐPushする。Foundation Taskで小修正が必要
- F8 Ring-out / BoutOutcomeは未実装。寄り切りDriveは、勝敗条件がないと「押し出して何が起きるか」を評価できない（Q22の順序に影響）

# Recommended Engagement State（Q1）

**Recommendation**: `BoutSimulation`がpair-levelのfieldを1つだけ持つ。

```ts
type GrappleAdvantage =
  | { kind: 'neutral' }
  | { kind: 'morozashi'; holderId: ParticipantId }

type BoutEngagement =
  | { kind: 'free' }
  | { kind: 'grappled'; advantage: GrappleAdvantage }
  // future (not now): | { kind: 'lifted'; lifterId: ParticipantId; resumeAdvantage: GrappleAdvantage }
```

- **pair-levelにする理由**: 「誰が誰と組んでいるか」を両participantに持たせると食い違う可能性がある。field 1つなら食い違いは構造的に起こらない
- **Snapshot**: `BoutSnapshot.engagement`（topレベルのcopy）として公開する
- **setup / reset**: constructorは常に`free`。`BoutSetup`には入れない（将来、立合いで組んだ状態から始める場合に拡張する）。Sceneの`R`は新しいSimulationを作るので自然に`free`になる
- **不変条件**（Foundation）:
  1. `holderId`は実在するparticipant id
  2. grappledの間、両者のactionはFREE用のpush / counter / gripではない
  3. grappledの間、両者のpostureはstable（Q6でAを採用した場合）
  4. grappledの間、2者の中心距離は`R`（Q7）
- 遷移は`enterGrapple(advantage)` / `releaseGrapple(releaserIds)`の2関数だけで行う

不採用: participantごとの`grappledWith` / `isHolder`（2箇所が食い違い得る）、汎用relationship framework / ECS。

# Normal Grip Semantics（Q2）

**Recommendation: C**。FoundationではstableなtargetへのGripも決定的に成功する（有効な範囲 + 有効なtimingなら必ず通常の組み）。

- 結果は1つの純関数`gripOutcome(attacker, target)`で決める: `'neutral' | 'morozashi'`（将来は`| 'fail'`も）
  - target postureがkuzushiならmorozashi（holder = attacker）
  - それ以外はneutral
- 将来のstat / 確率による判定はこの関数の中に入れ、そのときにseed付きPRNG（ACTION-04 Q19の境界）を使う
- 不採用:
  - A（範囲判定 + 入力だけで、timingの条件を持たない）: Q4のwhiff commitmentとQ16のPush Active制約が抜ける
  - B（仮の成功判定）: PRNGもstatもない段階で確率を作ることになる
- User Decision: UD-1

# Valid Grip Geometry（Q3）

**Recommendation**: 範囲は`distance <= R + GRIP_RANGE_MARGIN`（暫定で約0.08〜0.1 m、名前付きの1定数、Simulationが所有）。

- Contactだけ（2 mm）では不十分（F6）。Best背後の後の隙間は約6 cmになる。Foundationの判定は「Contact + 短い明示的なmargin」の距離だけで行う
- 相対facingの条件（正面からしか組めない等）は入れない。Deferred（directional ruleと同時に検討）
- Kuzushiでもこの範囲判定は省略しない（D1）
- 代案（User Decision UD-6）: Contactのみとし、防御側が歩いて詰める操作を要求する。報酬を取るのに追い足が必要になり、Gripのwhiffが増える
- 不採用: 腕のhitbox / reach geometry（過剰）

# Grip Input（Q4）

**Recommendation**: 専用のGrip edge（`gripPressed`）。Push / Counterと対称のdiscrete actionにする。

```ts
| { kind: 'grip'; phase: 'reach' | 'recovery'; ticksRemaining: number }
```

- 1回の押下で1回の試行。holdでのrepeatなし。queueなし
- `reach`（暫定約4〜6 tick）: steering抑制、実効move 0。範囲内かつ有効なtargetになった最初のtickで成功する
- 成立しないままreachが切れたらwhiffで、`recovery`（暫定約12 tick、steering抑制）へ入る。連打して「接触したら自動で組む」hold動作になるのを防ぐ
- 開始できるのはidleかつstableかつFREEのときだけ
- 同じtickの優先順: **Push > Counter > Grip**（既存のPush > Counterを保ち、新しいGripを最下位に置く固定rule）
- GRAPPLED中のGrip edgeは**release**（Q14）
- 入力は`PressLatch`の3個目のinstanceを使う（新規codeは不要）
- **暫定keyはUser決定（UD-7）**。本Reportでは決めない

# Kuzushi → Morozashi Timing（Q5）

**Recommendation**: 判定は**Grip成立tickでのtargetのpostureだけ**で行う（試行開始時点の状態は記憶しない）。

`step()`内の位置（提案順序）:

```
posture timers → intents（release / action開始）→ effective move → self velocity →
external decay → integrate → contact → grapple bond（GRAPPLED時）→ resolveCounter →
resolveGrip → resolvePush → action timers → facing
```

- 押下時にtargetがKuzushi → reach中の成立tickでもKuzushiならMorozashi
- 押下前のSnapshotで`kuzushi, ticksRemaining 0` → そのtickの先頭（`advancePosture`）でstableに戻るので、通常の組み。A1の「0 = 次のtickの先頭で回復」と同じ意味
- 同じtickにtargetが回復する → 通常の組み（回復はtick先頭で済んでいる）
- Kuzushi終了の直前に押し、reach中に回復 → 成立tickの状態で判定するので通常の組み
- Counter成功でKuzushiに入ったtickと同じtickのGrip → Counter使用者はcounter actionの最中なのでGrip中ではあり得ない（衝突しない）
- 「Kuzushi中の相手を組めた」は常に「成立した瞬間にKuzushiだった」と同値になり、決定的でtestしやすい

# Kuzushi Consumption（Q6）

**Recommendation: A**。Morozashiが成立したら、targetのKuzushiを即座に消費する（posture → stable）。優位はengagementの`morozashi`として残る。

- 二重化を避ける: Kuzushiの行動不能が組んだ後も続くと、targetはreleaseも抵抗もできない「凍結した相手」になり、報酬が過剰に積み重なる
- 所有の明確さ: posture = FREEでの安定性、advantage = 関係。それぞれ1つの意味に保つ
- 押されやすさの係数はFREEのPushにだけ効く。GRAPPLED中のKuzushiには意味がない
- 将来: Balanceで「組んだまま崩れる」を作るなら、そのとき明示的にpostureへ入れる
- B（timer継続）: 組んだ直後の数tickだけ相手が無抵抗になる。報酬は強いが、隠れたtimerが残る
- C（別posture）: 現段階では不要
- 主観的な判断を含むので、User Decision（UD-2）とする

# GRAPPLED Spatial / Facing Invariant（Q7、Q8）

**Recommendation**（Foundation）:

1. **成立時**
   - 両者のactionをidleにする（相手のcounter / push startup / recoveryもcancel）
   - 両者の`externalVelocity`をpairの平均にそろえる。同じ質量を仮定した運動量保存で、Counterのovershootを含む既存momentumを消さずにpairで共有する
2. **GRAPPLED中**
   - 両者のWASD steeringを抑制する（実効move 0で制動）
   - FREE用のPush / Counter / Grip開始も無効（Grip edgeはreleaseになる）
   - pairを動かすのは将来のDriveなどのgrapple actionだけ
3. **bond**
   - `resolveContact`の後に`resolveGrappleBond`を置く。中心距離が`R`でなければ、法線方向へ**両者に半分ずつ**位置補正する（対称で、配列順の有利なし）
   - 外力が共通でself velocityが制動されるので、実際の補正は残った小さなずれだけ
   - constraint solverは作らない
   - 成立時にmargin分（最大約0.1 m）離れていた場合は、最初のtickで`R`まで寄せる（読み取れる「組みついた」吸着になる）
4. **facing**: 既存のauto-facing（互いに相手へ向く）。距離`R`に保たれるので、pairは常に共通の軸の上で向き合う。Morozashiはfacingを変えない。Kuzushiは成立時に消費する（Q6 A）ので、facing freezeとは衝突しない

GRAPPLED中のWASD（2人で回る、寄り合う動き）はDeferred / User Decision（UD-5）。turn-rateは導入しない。

# Morozashi Ownership（Q9）

- `holderId`は単一fieldなので、両者が同時にholderになることは構造的に起こらない
- 通常の組み（neutral）は対称で、holderを持たない
- Foundationではholderは変わらない（差し手争い・巻き替えは作らない）。変わるのはreleaseしてから組み直したときだけ（組み直し時にtargetがstableならneutral）

# Morozashi Drive Boundary（Q10）

**Recommendation**: Grappled Drive（↑）はModel Bのまま、Pushと同じ「pairで共有するexternal加速」とする。加速は**1つの解決関数**で決める:

```
grappleDriveAcceleration(driver, target, engagement) =
  GRAPPLE_DRIVE_BASE × advantageFactor(engagement, driver) × [future: power / weight / lowerBody / balance terms]
```

- `advantageFactor`: neutralは1。driverがholderなら`> 1`、driverがholderにされている側なら`<= 1`。数値はUser / Drive Taskで決める
- 適用先はexternal加速の大きさ。self速度やtractionを別系統で作らない
- 将来、抵抗（Weight / LowerBody）は同じ関数の分母側の項になる
- 数値は決めない

# Morozashi Throw Boundary（Q11）

**Recommendation**: 将来の`resolveThrow(thrower, target, engagement, direction, rng)`（pure）が、成功率の**入力の1つ**としてengagementのadvantageを読む（throwerがholderなら有利、targetがholderなら不利）。

- 「Morozashi専用の投げ分岐」はhard-codeしない
- 乱数はSimulationが所有するseed付きPRNGからだけ取る（ACTION-04 Q19）。同じseedと同じintent列で再現できる
- Throw / PRNGは今は実装しない

# Interaction with Counter Reward（Q12）

- 最初の設計では、Morozashiを保証する条件は**Kuzushiだけ**とする。背後・側面の位置そのものはMorozashiの条件にしない（背後なら常にMorozashi、のようなruleは作らない。別のDeferred候補）
- 背後・側面の価値: 自分は相手の近くにいて、相手は向き直れず動けない。そのため、範囲判定をmargin付きにすれば（Q3）、追加の歩きなしでGripできる（F6）
- 組んだ時点でKuzushiを消費し、auto-facingに戻るので、背後・側面の幾何的な優位はMorozashiという関係の優位に**変換**される

# Interaction with Directional Push Advantage（Q13）

Deferred候補「側面・背後からのPushを強くする」はFREEのPush ruleであり、Gripには混ぜない。

Source of Truthはそれぞれ1つ:
- 方向の優位: canonical position / facingから、解決時に**計算するだけ**（保存しない）
- Morozashi: engagementに保存
- Kuzushi: postureに保存

各解決関数（resolvePush、将来のDrive / Throw）はこれらを独立した入力として掛け合わせ、どこにも2重に保存しない。GRAPPLED中は両者が向き合うので方向の係数は常に正面相当になり、Grapple内の優位は実質的にMorozashiが担う。

# Release Semantics（Q14）

**Recommendation**（Foundation）:

- GRAPPLED中のGrip edge → そのtickのintent段階で**即座にFREE**へ戻る
- releaseした側は`grip recovery`（Q4と同じ暫定約12 tick、steering抑制）に入る。releaseしてすぐ組み直す連打を抑えるため
- releaseされた側はすぐに動ける
- 両者が同じtickにreleaseした場合: 両者がrecoveryに入る（対称）
- 位置・速度・facingはそのまま（距離`R`でContactしたまま、通常のFREE Contactへ戻る）
- Morozashiはreleaseで消える（組み直しは、そのときのtargetのpostureで判定）
- 誰がreleaseできるかには**User Decision（UD-4）**が必要:
  - 推奨: 両者ともrelease可能（releaseした側がrecoveryを払う）
  - 懸念: Morozashiを取られた側がreleaseしてから組み直すと、2回の押下でneutralに戻せる。ただし、その間のrecoveryは相手のPushやGripに対して無防備になる
  - 代案: Morozashi中はholderだけがreleaseできる

# Simultaneous Grip（Q15）

- **両者stable**で、同じtickに両者のreachが成立 → neutral（対称。配列順に依存しないよう、両者の成立可否を先に評価してから結果を決める）
- **一方がKuzushi**: Kuzushi側はGripを開始できない（行動不能）。stable側だけが試行するのでMorozashi（holder = stable側）
- **両者Kuzushi**: どちらも開始できない → 何も起きない
- 成立tickがずれた場合は、先に成立した方で組みが決まる。成立時に両者のactionをidleにするので、遅れた側のreachは消える

# Grip During Actions（Q16）

| 状態 | Grip edge |
|---|---|
| 自分がPush / Counter / Grip中 | 無視、queueなし |
| 自分がKuzushi | 無視、queueなし |
| GRAPPLED | release（Q14） |
| 将来のLIFTED | 無視（Lift側がmovementを所有） |
| targetがidle / counter / push startup / push recovery / grip中 | 成立し得る。相手のactionはcancel |
| **targetがPush Active中** | **成立しない**（推奨。reachが残っていれば待ち、切れたらwhiff） |

Push Activeの扱いは**User Decision（UD-3）**:
- 推奨の場合、Push > Grip（Activeで弾く）、Grip > Counter（構えて動かない相手を組む）、Counter > Push（既存）という関係になる
- どの関係もtimingで決まるので、hardな三すくみにはならない（PushのActiveは8 tickだけ、Recovery中なら組める、Counterはwindowの間だけ）
- 代案: Push Active中でも組める。Counterを使う意味が薄れる

# Future LIFTED（Q17）

- engagement unionに`{ kind: 'lifted'; lifterId; resumeAdvantage: GrappleAdvantage }`を追加すれば、GRAPPLED → LIFTED → GRAPPLEDを表現できる
- 戻るときに元のadvantageを保持する場合も、neutralへ戻す場合も、どちらもfield 1つで実装できる
- どちらにするかはDeferred（UD-8）。Liftの前提はFoundationに入れない

# Presentation（Q18）

最小のPrototype表示（presentationのみ）:

- 組み中は2人の中心を線で結ぶ。neutralは白、Morozashiはholder色の太線
- 画面上部に`ENGAGE: FREE / GRAPPLED / MOROZASHI (PLAYER|CPU)`
- 各自のphase textに`GRIP`（reach）/ `GRIP REC`（recovery）を追加。`KUZUSHI`の優先は維持

Userが見分けられる必要があるもの:
1. Gripが空振りしたか、成立したか
2. 通常の組みか、Morozashiか、どちらがholderか
3. releaseされたか
4. Kuzushiが消費されたか（KUZUSHI表示が消える）

# Required Automated Tests（Q19、Foundation実装Task用）

1. FREE → neutral（stable target、範囲内）
2. Kuzushi target + 範囲内 → Morozashi（holder = attacker）、targetのpostureがstableになる（UD-2 A）
3. 範囲外ならKuzushiでも組めない。reachが切れたらwhiff → recovery
4. 範囲の境界（`R + margin`ちょうどとそれを超えた値）
5. 1 edge = 1回、holdでrepeatせずqueueもしない。同じtickの優先順 Push > Counter > Grip
6. Q5の時刻規則（Snapshotで`ticksRemaining 0` → neutral、reach中に回復 → neutral）
7. holderの識別と、両者が同時にholderにならないこと
8. 同時Grip（両者stable → neutral、配列順を入れ替えても同じ結果）
9. Push Active中のtargetには成立しない（UD-3推奨の場合）。Startup / Recovery中なら成立
10. 成立時に両者のactionがidleになり、externalVelocityがpairの平均になる（運動量保存）
11. GRAPPLED中、WASDで離れようとしても距離`R`を保つ（「離れているのにGRAPPLED」が起きない）
12. GRAPPLED中はPush / Counter edgeを無視する
13. release: 即座にFREE、releaseした側はrecovery、同時releaseは対称、Morozashiが消える
14. Counter → Kuzushi → Grip → Morozashiの統合（Best背後、Success側面の両方でmarginにより届く）
15. Engagementのsource of truthが1つ（Snapshotが独立したcopyであること、participant stateにengagementの重複がないこと）
16. 混在sequenceのreplay一致・finite・重なりなし
17. Gripを使わない場合、既存のPush / Counter / Contact / Movement / Dummy testが変更なしでPASS
18. Dummy: GRAPPLED中はedgeを出さず、cooldownを保持する（F7）

# User Play Test Plan（Q20）

最初にGrip / Engagement FeelがREQUIREDになるのは、Foundation実装Task（下記ACTION-05A）。

確認項目案:
1. Gripの成立と空振りが読み取れるか。空振りのrecoveryは妥当か
2. Counter → KUZUSHI → Grip → MOROZASHIの流れが報酬として読み取れるか
3. 組んだときの吸着（margin分を寄せる動き）は自然か
4. 組み中に勝手に離れない・滑らないか。操作できないことが不自然でないか（UD-5）
5. releaseが分かりやすく、悪用されないか（UD-4）
6. Push Active中に組めないことが納得できるか（UD-3）
7. 線と文字だけでneutralとMorozashiを区別できるか
8. Gripを使わないときの既存Feelが不変か

MorozashiがDrive差として「明確に有利」と感じられるかは、Drive Task（05B）で確認する。

# Rejected / Deferred

Rejected:
- participantごとのengagement field
- 汎用relationship framework / ECS
- Grip成功の仮確率（Q2 B）
- 腕のhitbox
- Kuzushi timerの継続（Q6 B）とMorozashi用の別posture（Q6 C）。いずれもUD-2の代案
- 背後・側面の位置だけでMorozashiを与えるrule
- constraint solver
- turn-rate
- 配列順による優先

Deferred:
- stat / 確率によるGrip成功
- 相対facingを使うGripの質
- GRAPPLED中のWASD移動・回転
- 差し手争い・巻き替え
- Drive係数、Throw確率
- PRNG
- Lift、Morozashiの持ち越し（UD-8）
- 方向によるPush優位
- 組みのアニメーション
- Ring-out / BoutOutcome（Driveの評価に必要。下記Sequence参照）

# User Decisions Required

| # | 決定事項 | 推奨 |
|---|---|---|
| UD-1 | stableなtargetへのGrip | Foundationでは決定的に成功（範囲 + timingのみ。stat / 確率はDeferred） |
| UD-2 | Morozashi成立時のKuzushi | 即座に消費（A） |
| UD-3 | Push Active中のtargetを組めるか | 組めない |
| UD-4 | release | 両者可、releaseした側がrecovery（代案: Morozashi中はholderだけ可） |
| UD-5 | GRAPPLED中のWASD | Foundationでは抑制し、pairは動かない |
| UD-6 | Grip範囲 | Contact + `GRIP_RANGE_MARGIN`（約0.08〜0.1 m）（代案: Contactのみ） |
| UD-7 | 暫定Grip key | User指定（本Reportでは決めない） |
| UD-8 | Lift後にMorozashiを保持するか | Deferred（Lift Taskで決める） |

同時Grip（Q15）は対称ruleで決定できるので、User決定は不要（確認だけ）。

# Next Implementation Sequence（Q22）

1. **ACTION-05A Grip / Engagement Foundation**
   - 内容: engagement field、Grip action（reach / recovery）、範囲、Kuzushi → Morozashi、Kuzushiの消費、bond、WASD抑制、release、同時Grip、Dummyの小修正、最小表示、Q19のtest
   - **User Play Test REQUIRED**（Grip Feelの最初のgate）
2. **ACTION-05B Grappled Drive / Yorikiri Prototype**
   - 内容: ↑ Drive（pairで共有するexternal加速）、neutralとMorozashiの暫定係数差
   - 注意: Ring-outが無いと「寄り切る」意味を評価しにくい。05Bの前か同時に、Ring-out / BoutOutcomeの最小Taskを置くかをReviewで判断する
3. Throw / Lift: Grappledでの移動がAcceptされてから、PRNG / BoutOutcomeの設計とあわせて調査する

Grip + Drive + Throw + Liftを1 Taskに束ねない。

# Design Deviations

なし（Investigationのみ）。

# Unexpected Scope

なし。F6（Counter後のContact喪失）とF7（Dummyの修正が必要）は設計上の所見であり、修正はしていない。

# Verification

- Q1〜Q22に回答済み。BLOCKEDになる点はない
- Current Fact / Recommendation / User Decision / Deferredを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはACTION-05A。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate grip and morozashi design`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
