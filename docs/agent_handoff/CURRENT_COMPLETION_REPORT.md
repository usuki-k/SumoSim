Task-ID: ACTION-05C-GRAPPLED-DRIVE-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: f28542fce7b5996916a7769b9690905c41ca0608
Agent-Start-Head: cf5e8153c173c5214ed590702d3af2c8a365540a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。

Driveは、次の範囲の小さな追加で実装できる。
- Model Bのpair共有external velocityを使う
- 方向はpair軸に沿わせる
- 開始の可否は既存の`canActInGrapple`で判定する
- Morozashiはengagementの係数として読む

BLOCKEDになる点はない。

設計上の重要な所見が1つある（F3: 外力の減衰と連続加速の結合）。これに対する推奨rule（Q4 / Q13）はReview判断の対象として明示した。残る事項は推奨既定値付きのUser Decisionだけで、Ring-outは前提条件ではない（Q17）。

Production Source / package / lockfileは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 3`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `f28542f`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `f28542f..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `cf5e815`
- 読んだもの: AGENTS.md、`BoutTypes.ts`、`BoutSimulation.ts`、`grappleOrientation.ts`、`BoutGrip` / `BoutOrientation` / `BoutPush`のtest、`BoutScene.ts`、ARCHITECTURE.md、GAME_CONCEPT.md、Review / Play Testの記録（`2c77829`、`fc7517c`）

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Recommendation**: 本Reportの推奨（未実装）
- **User Decision**: 実装前にUserが決める事項
- **Review**: Reviewで判断する設計事項
- **Deferred**: 後続Task

数値はすべて暫定。

# Current Source Findings（Current Fact）

- F1 Sceneは、ArrowUpの`down` eventを`pushLatch`（edge）にだけつないでいる。held state（`isDown`）はSimulationへ渡していない。GRAPPLED中の`pushPressed`はFREE action開始の段階で無視される
- F2 GRAPPLED中の外力: `enterGrapple`で両者の外力を平均にそろえる。その後は両者に同じdecay（`EXTERNAL_DECELERATION = 8 m/s²`、積分の**前**）とclamp（`MAX_EXTERNAL_SPEED = 3`）が掛かるので、両者は等しいまま。bondは半径方向だけで、平行移動なら補正は0になる
- F3 **外力の減衰と連続加速の結合（重要）**: Pushの加速は`resolvePush`（積分の**後**）で足され、次のtickの積分の前にdecayが引かれる。この順序のまま加速`a`を毎tick足し続けると、次のようになる:
  - `a ≤ 8 m/s²`: 足した分がそのtickのdecayで消える。積分に使われる速度は常に`a·dt`以下にとどまり、**tick rateに依存した這い進み**になる
  - `a > 8 m/s²`: 実効`(a − 8) m/s²`で加速が止まらず、`MAX_EXTERNAL_SPEED = 3 m/s`（土俵半径2.275 mを1秒未満で横断する速度）まで達する
  - → Pushの「短い加速 + 減衰」をそのまま連続Driveに流用すると、「這う」か「暴走する」かのどちらかになる。Driveには上限速度を持つ規則が必要
- F4 `step()`の各participant loopは「self velocity → decay → 積分」をparticipantごとに完結させている。積分は相手を参照しないので、loopを「全員のvelocity更新」と「全員の積分」の2段に分けても、FREEの結果は変わらない
- F5 Dummyは、GRAPPLED中は`NO_INPUT`を返し、Gripもreleaseもしない。そのままでは、組み中に押し合う相手が存在しない
- F6 GRAPPLED中、2人の方位はbondと平行移動によって一定に保たれる。旋回（05B1）はDriveと独立に進む

# Recommended Input Semantics（Q1）

**Recommendation: A**。`ParticipantIntent`に`driveHeld: boolean`（held state）を1つだけ追加する。

- Sceneは同じArrowUpから2つの値を作る: `pushPressed`（edge、既存のlatch）と`driveHeld`（`isDown`）。engagementによる分岐はSceneで**行わない**
- **Simulationが文脈で解釈する**: FREEでは`driveHeld`を無視し、GRAPPLEDでは`pushPressed`を無視する（既存どおり）
- FREE Pushの意味と既存testは不変。CPUやtouchも同じsemanticな値を出すだけで済む
- 不採用:
  - B（汎用のprimary action）: 入力の大きな再設計になる
  - C（GRAPPLED中に`pushPressed`をDriveとして流用）: edgeでは連続Driveを表せず、意味も混ざる

# Continuous vs Discrete（Q2、Q9）

**Recommendation: 連続（↑を押している間Drive）**。

- 寄りは持続的な圧力で読みやすい。Userが好む「広く単純なtiming」に合い、touchでもhold buttonで済む
- 将来のstaminaは、Drive中のtickごとの消費として足すだけで済む
- 押し合いは`net`の連続値で自然に表せる
- startup / recoveryは**なし**。↑を離したtickから寄与がなくなり、pairの外力は既存の減衰で止まる（0.6 m/sなら約0.08秒）
- 不採用（Deferred）: 離散的なDrive pulse（がぶり寄りのような律動）。phaseとtimerが必要で、Foundationには過剰

# Drive Direction（Q3）

**Recommendation**: pair軸（driverの中心 → 相手の中心）。

- bondにより軸は常に正確に定義される。Aの軸 = −（Bの軸）なので、同時Driveで**ちょうど相殺**する
- facingを使うと、READYのtolerance（最大15°）だけ横成分が混ざり、等しいDrive同士で横に滑る。不採用
- 開始時に方向を保存する方式: 連続Driveでは不要。不採用
- 横回転させる寄り（pairを回す）はDeferred

# Pair Movement Model（Q4、Q5、Q12、Q13）

**Recommendation**: Model Bのまま、**pair共有の`externalVelocity`の軸方向成分だけ**をDriveで動かす。

```
n = unit(B − A)                                   // tick start (bond keeps it exact)
net = s(A)·[A driving] − s(B)·[B driving]          // signed along n (Q6, Q7)
if net ≠ 0:
  dir = sign(net)·n ; target = GRAPPLE_DRIVE_SPEED·|net| ; rate = GRAPPLE_DRIVE_ACCELERATION·|net|
  u = v·dir                                         // shared external, along drive direction
  if u < target: u = min(target, u + rate·dt)       // accelerate toward the drive speed
  else:          u = max(target, u − EXTERNAL_DECELERATION·dt)  // overspeed still bleeds by the existing decay
  perpendicular part of v: existing decay
else:
  v: existing decay (unchanged behaviour)
both participants' externalVelocity = v  (then existing MAX clamp)
```

- **Review判断（F3への対処）**: 「Drive中は、軸方向の加速と減衰を合わせて1つの規則で扱う」
  - 減速はこれまでどおり`EXTERNAL_DECELERATION`だけで行う（減衰の出どころは1つのまま）
  - ただし、目標速度へ向けて加速しているtickでは、軸方向のdecayを重ねて引かない
  - こうすることで、F3の這い進みと暴走が起きず、tick rateにも依存しない
  - 代案（単純に加速を足す。Taskの推奨原則どおり）は、F3の問題がそのまま残るのでRejectedとした
- 既存のmomentum（Counterのovershootの平均など）は消さない。Drive方向に目標速度より速ければ既存の減衰で落ち、逆向きなら加速で打ち消してから進む
- `MAX_EXTERNAL_SPEED`は全体の上限として残す（目標速度はそれより小さい）。Driveに別のcapは不要で、目標速度がDriveの上限になる。FREE Pushは一切変えない
- **片側だけのneutral Drive（Q5）**: AだけがDriveすると、両者の外力が`+n`方向へ目標速度0.6 m/s（暫定）まで上がり、Bは後退する
  - 変わるのは両者の`externalVelocity`だけ
  - `selfVelocity`はWASD抑制のため0（制動のみ）
  - bondの補正は平行移動なので約0
- **step順序（Q12）**: GRAPPLED中は次の順にする（F4により、FREEの結果は変わらない）:

  ```
  posture timers → release → 全員のself velocity → 全員のexternal decay → Drive適用 → 全員の積分 → contact → bond → action timers → facing
  ```

  - Pushのような1 tickの遅れはない（入力したtickから動く）
  - 判定（readiness / net）はtick先頭の状態で行う
- 不採用:
  - selfVelocityでのDrive（grounded ruleとWASD抑制に衝突し、bondと引っ張り合う）
  - targetだけを動かす（bondの対称補正で歪む）
  - 位置を直接書き換える

# Simultaneous Drive（Q6）

`net = s(A)·hA − s(B)·hB`を共通の軸`n`（A → B）上で計算する。符号付きで対称な式なので、participantの配列順による優先はない（鏡像の配置なら鏡像の結果）。

- 等しいneutral同士: `net = 0` → 減衰のみ → 拮抗（stalemate）
- 一方だけ: `|net| = s`
- 強さが違う: 差の分だけ、遅い速度で押し勝つ

# Morozashi Advantage（Q7）

```
driveStrength(driver, engagement) = (engagement is morozashi && holderId === driver.id) ? MOROZASHI_DRIVE_FACTOR : 1
```

- **holderにだけ係数を掛ける**。不利側は1.0のまま（罰則は付けない）。簡単で、効果も十分読み取れる
- 暫定`MOROZASHI_DRIVE_FACTOR = 1.5`。目標速度と加速の両方に効く:
  - holderだけがDrive: 0.9 m/s
  - holder対不利側の押し合い: `net = 0.5` → 0.3 m/sでholderが押し勝つ
  - neutral同士: 拮抗
- Morozashiはengagementのadvantageから読む。新しいaction typeや状態は作らない

# Readiness / Release Interaction（Q8、Q10、Q11、Q15）

- 寄与`[p driving] = driveHeld && canActInGrapple(p, opponent, engagement)`を、**tick先頭の状態**で毎tick評価する
- TURNINGの者は寄与しない。READYの者は、相手がTURNING中でも一方的に寄れる
- 相手は、READYになったtickから押し返せる
- READYになる前から↑を押していた場合: **READYになったtickから自動で寄与が始まる**。held stateは「押している間は有効」という意味で、edgeを溜めているわけではない（意図的な仕様）
- **Release（Q10）**: ACTION-05A / 05B1のsemanticsのまま
  - READYの者のShiftは、Drive中でも即座にreleaseできる
  - Driveはreleaseを妨げない
  - release tickはFREEなのでDriveは適用されない（Driveがcancelされる）
  - 共有の外力はそのまま残り、FREEの減衰で止まる
- **同じtickの優先順（Q15、将来互換）**:
  1. TURNINGの判定（何もできない）
  2. Release（Shift）
  3. 将来の離散的なgrapple action（← → Throw、↓ Lift）
  4. 連続Drive（↑）
  - 2人はそれぞれ独立に評価するが、releaseは両者をFREEにするので最初に処理する
- **旋回（Q11）**: Driveはpairを平行移動させるだけなので、方位は一定のまま。TURNINGは通常どおり進み、Driveがfacingの誤差をresetすることもない。pairは回転させない

# Drive as Action State（Q14）

**Recommendation**: `ParticipantActionState`に`{ kind: 'drive' }`（timerなし）を追加する。

- 毎tick、寄与がtrueなら`drive`、falseなら`idle`に置き換える
- 理由:
  - (1) Snapshotで見える（表示とtestに必要。intentはSnapshotに入らない）
  - (2) 将来のThrow / Liftと排他であることをaction unionで表せる
  - (3) 将来のstamina消費の判定点になる
- 同じ意味のstateは1つだけ（その時点の実際の寄与）
- ACTION-05Aの不変条件「GRAPPLED ⇒ action idle」は、「GRAPPLED ⇒ action ∈ {idle, drive}」へ広がる
- releaseで`drive`はidleになる（releaseした側はGrip recovery）

# Minimal Presentation（Q16）

- phase text: Drive中は`DRIVE`（READY表示を置き換える）。TURNING中は`TURNING n°`のまま
- ENGAGE行（既存）に加えて、debug用に`pair v: 0.62 m/s`程度の数値を表示
- neutralとMorozashiの線の区別は既存どおり

# Ring-out Prerequisite（Q17、Q18）

**Recommendation: A**（Driveを先に、変位だけで実装・評価する）。

- 技術面: Ring-outなしで完全に実装・testできる
- Game Feel面:
  - 「寄り切って勝つ」の手応えはRing-outが必要
  - ただしDriveの手応え（pairを押す圧力、拮抗、Morozashiの差、先手の報酬）は変位だけで評価できる
- Ring-outを先にすると、未決の判定基準（何をもって土俵外とするか、勝敗の流れ、restart）が全体をblockしてしまう
- **土俵端の扱い（Q18）**:
  - 壁やclampは**追加しない**（ring-outの判定基準を先取りしないため）
  - Play TestではUserが土俵線を目で見て`R`でrestartする
  - 自動testは`arena.radius = 100`のfixtureを使う
  - 「土俵外」を示す表示もしない

# Morozashi + Orientation Combined（Q19）

背後・側面へのCounter → Kuzushi → Grip → Morozashi → holderはREADY、被害側はTURNINGの状況で:

1. holderのDriveは`net = 1.5`で、相手の抵抗なしに通る（0.9 m/s）
2. 被害側がREADYになると押し返しが可能になり、`net = 0.5`になる（0.3 m/s、まだholder優勢）
3. 被害側が押さなければ`net = 1.5`のまま

この3段階は、独立した3つの要素（engagementのadvantage / 導出したreadiness / driveStrength）の組み合わせだけで決まる。「背後のMorozashi」のような組み合わせstateは作らない。

# Future Stats Boundary（Q20）

`grappleDriveNet(a, b, engagement, aDriving, bDriving)`という単一の関数で`net`を決める。

- 将来はこの関数の中で次の項を足す:
  - `driveStrength`に力（Power）と組みの技術
  - 不動の抵抗（Weight / LowerBody。Driveしていない側の踏ん張り）を差し引く項
  - 目標速度と加速を質量で割る項（将来）
- architectureは変わらない
- 式は今は決めない

# Required Automated Tests（Q21、05C1用）

1. READYの片側neutral Drive: 外力が`+n·0.6`へ単調に近づく（加速率ちょうど）。超えない。Bが後退し、距離Rを保つ
2. TURNINGの者のDriveは寄与しない（`action`はidleのまま）
3. 相手がTURNING中でも、READYの者のDriveは通る
4. READY前から↑を押していた場合は、READYになったtickから寄与する（tick境界ちょうど）
5. 等しいneutral同士の同時Drive → 外力0（拮抗）、jitterなし
6. Morozashiのholder単独 > neutral単独（目標速度1.5倍）
7. holder対不利側の押し合い → `net = 0.5`でholder方向
8. participantの順序を入れ替えた鏡像でも対称
9. ↑を離したtickから寄与がなくなり、既存の減衰で止まる
10. 既存のmomentumを保持する（目標より速ければ減衰で落ち、逆向きは打ち消してから進む）。`MAX_EXTERNAL_SPEED`は維持
11. bondの距離とpair軸が不変
12. Drive中もTURNINGの旋回が通常どおり進む
13. Drive中のrelease: READYの者は即座にrelease。外力は保持され、FREEで減衰する
14. Drive中にTURNINGの者がShiftを押す → 無視される
15. GRAPPLED中の`pushPressed`は無視（既存）、FREE中の`driveHeld`も無視
16. 混在sequenceのreplay一致・finite
17. Driveを使わない場合、既存の163件が変更なしでPASS（helperへの`driveHeld: false`追加を除く）
18. Ring-outの意味を持つcodeがない（土俵外でも何も起きないことのtest）
19. 2段loop化してもFREEの結果が同一（既存testで担保）

# User Play Test Plan（Q22）

最初にDrive FeelがREQUIREDになるのはACTION-05C1。

確認項目:
1. 片側のDriveがpairへの圧力に見えるか（滑っているように見えないか）
2. 等しい押し合いが拮抗に感じられるか
3. Morozashiがはっきり強く寄れるか
4. 相手のTURNING中に寄れることが先手の報酬になっているか
5. releaseが分かりやすいか
6. bondが安定しているか
7. Driveの方向が読めるか
8. 全体の速度は引き続きDeferred（blockしない限り調整しない）

押し合いを試すにはDummyの拡張が必要（F5）: Mode 2で、GRAPPLED中は常に`driveHeld = true`を出す。Simulationがreadinessで判定するので、CPUがTURNING中は寄与せず、READYになると押し返してくる。これを05C1の範囲に含めることを推奨する。

# User Decisions Required（Q23）

| # | 決定事項 | 推奨既定値 |
|---|---|---|
| UD-1 | Driveの方式 | 連続（↑を押している間） |
| UD-2 | 入力のsemantic | `driveHeld`を追加（ArrowUpの`isDown`。Simulationが文脈で解釈） |
| UD-3 | 暫定の値 | `GRAPPLE_DRIVE_SPEED = 0.6 m/s`、`GRAPPLE_DRIVE_ACCELERATION = 4 m/s²`（約0.15秒で目標速度に達する） |
| UD-4 | Morozashiの係数 | holderだけ`1.5`、不利側は罰則なしの`1.0` |
| UD-5 | Drive中のrelease | 現行どおり可能（READYの者のみ） |
| UD-6 | Ring-outとの順序 | Driveが先（変位だけ）。Ring-outは後続でInvestigation |

Review判断:
- Q4の、Drive中は軸方向の加速と減衰を1つの規則で扱う案（F3への対処）
- `drive` action variantの追加（Q14）
- Dummy Mode 2の拡張（F5）

# Rejected / Deferred

Rejected:
- Q1 B / C
- facing方向のDrive
- 開始時に方向を保存する方式
- selfVelocityでのDrive
- targetだけを動かす方式
- 位置の直接書き換え
- 単純に加速を足す方式（F3の這い進みと暴走）
- Morozashiの不利側への罰則（初期）
- Ring-outを先にする順序
- 見えない壁やclamp

Deferred:
- 離散Drive pulse（がぶり寄り）
- pairを回転させる寄り
- stamina
- stat項（Power / Weight / LowerBody）
- 質量
- Throw / Lift
- Ring-out / BoutOutcome（次の調査対象）
- 全体のtempo調整

# Next Implementation Sequence（Q24）

1. **ACTION-05C1 Grappled Drive Foundation**
   - 内容: `driveHeld`、`drive` action、pair軸のnet、軸方向の目標速度規則、Morozashi係数、readinessによる判定、2段loop、Dummy Mode 2のGRAPPLED中Drive、表示
   - **User Play Test REQUIRED**
2. **Minimal Ring-out / BoutOutcome Investigation**: 判定基準、勝敗、restartの決定事項を洗い出す
3. その実装 → Yorikiri Feelの評価（必要なら05C2で調整）
4. Throw / Lift

1つのTaskに束ねない。

# Design Deviations

なし（Investigationのみ）。

Q4の推奨は、Taskの「推奨原則」（加速を足す、既存の減衰を唯一の減衰源にする）を部分的に修正している。理由はF3で、Review判断として明示した。

# Unexpected Scope

なし。F3（減衰と加速の結合）とF5（DummyがGRAPPLED中に何もしない）は設計上の所見で、修正はしていない。

# Verification

- Q1〜Q24に回答済み。BLOCKEDになる点はない
- Current Fact / Recommendation / User Decision / Review / Deferredを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはACTION-05C1。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate grappled drive design`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
