Task-ID: ACTION-11B-GRIP-LUNGE-CONTEST-INVESTIGATION
Result: PASS (INVESTIGATION COMPLETE, ONE ACTION-11C DESIGN RECOMMENDED)
Branch: develop
Source-Baseline: 89b2d631bdd74b65f93558678f24b1b599165f4a
Agent-Start-Head: d6ea165c4e36c442e8ef0245633b5246d5722121
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation Only）。

- Production Changes: NONE
- STOP条件には該当しない
  - 広いcombat frameworkは不要
  - CounterTransition、Tsuppariの命中semantics、全体のmovement tuning、同一参加者の入力優先順位は変えずに済む
  - presentationに時間を持たせる必要もない

ACTION-11Cに推奨する設計（詳細は「推奨するACTION-11Cの設計」）:

1. Grip reachを8 tickに延ばす（現在は6）
2. reachのあいだは、押下時のfacingに固定した方向へ、既存のgrounded movementで突進する
   - 自分の移動: reachの終わりまでに0.100 m、制動の惰性を含めて0.1267 m
3. reachのあいだは、canonical facingを固定する
4. 成功の境界を、既存の円の実接触（`resolveContact`の結果）にする
   - 0.79 mのmarginは使わない
5. 成功は、reachの経過が4 tick以上になってから（`GRIP_MIN_ATTEMPT_TICKS = 4`）
   - 接触した状態から押しても、attempt poseのSnapshotが最低4枚（約67 ms）出る
6. 新しい関係は、小さな純関数1つ（`resolveFreeGripContest`）で、resolverを呼ぶ前に決める
   - Tsuppari > Grip: Tsuppariの命中が、reach中のGripを取り消してrecoveryにする
   - Grip > Counter: window中のCounterをneutral grappleで取る。Counter側にKuzushiは無い
   - Push > Grip: Pushのimpactが、reach中のGripを取り消してrecoveryにする
   - Grip vs Grip: reach中の相手も取れる（neutral）
7. 参加者の順序と役割を入れ替えても、結果は変わらない
   - Gripを含む全sweep、598 cell × 4通りで確認した

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `89b2d63`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `89b2d63..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `d6ea165`

# 調査の方法

- `BoutSimulation.ts`をscratchpadへcopyした（`Proto.ts`、importは絶対path）
- 切り替えflag（`CFG`）だけを足した。flagの内容: lunge、facingの固定、境界、最小attempt、contest、`gripTakesReach`、Grip専用の加速
- **flagが既定値のProtoは、Productionと完全に一致する**
  - random入力60 bout、68,195 tickでSnapshotの不一致0
- **推奨profileのProtoは、Gripを使わない既存pairでProductionと完全に一致する**
  - Push/Push、Push/Tsuppari、Push/Counter、Tsuppari/Tsuppari、Tsuppari/Counter、Counter/Counter
  - 距離4種 × offset 25種 × 140 tick = 84,000 tickで、Snapshotの差0
- すべて固定stepの決定的な実験。Phaserもwall-clockも使っていない
- Production source、test、docsは変更していない

# Current Sourceで確認したこと

| 項目 | Current Source |
|---|---|
| 定数 | `GRIP_REACH_TICKS = 6`、`GRIP_RECOVERY_TICKS = 12`、`GRIP_RANGE_MARGIN = 0.09`、`BODY_RADIUS = 0.35` → 成功距離 0.79 m |
| 開始条件 | FREE + action idle + stable。同一参加者の優先順位 Push > Tsuppari（Left > Right）> Counter > Grip |
| reach中の移動 | `effectiveMove`はGripに`ZERO_MOVE`を返す → その場で制動し、自分は動かない |
| facing | FREEでは毎tick相手を向く（Kuzushi中とPush中だけ固定） |
| 成功 | `resolveGrip`: 距離 ≤ 0.79 で、両者がreach中かつstableならneutral。片方がreach中なら、相手の`action.kind === 'idle'`のときだけ成功（Kuzushiの相手ならMorozashiでKuzushiを消費、それ以外はneutral）。Counter / Tsuppari / Push / Grip recovery中の相手は掴めない |
| 押下tickでの成功 | 範囲内なら押下tickに成功する。Snapshotはすぐgrappledになり、reachのSnapshotは0枚（ACTION-11Aの問題） |
| grapple突入 | `enterGrapple`が両者をidleにし、external速度を平均し、`resolveGrappleBond`で距離を0.70 mに合わせる |
| FREE 1 tickの順序 | posture → 行動開始 → 移動の意図 → 速度 → 積分 → `resolveContact` → `openPushImpact` → `resolveCounter` → `resolveGrip` → `resolveForces`（grapple突入後は飛ばす）→ `advanceAction` → `updateFacing` → ring-out |

TaskのCurrent Baselineの記述と一致する。

# Current Gripのbaseline（実測）

| 項目 | 値 |
|---|---|
| 成功距離 | 0.79 m（0.70 / 0.75は押下tickに成功。0.80はwhiff） |
| 範囲内で押してから成功まで | **0 tick**（押下tick）。reachのSnapshotは**0枚** |
| 少し範囲外（0.82）で、相手がreach中に歩いて入ってくる | tick 4で成功。reachのSnapshotは4枚。bond前の距離0.7783 m |
| whiff | reachのSnapshot 5枚 + recoveryのSnapshot 12枚。tick 17でidle |
| 自分の移動 | 0 m |
| grapple突入時のbondによる位置補正 | 1人あたり (gap − 0.70) / 2。gap 0.75 → 0.025 m、0.77 → 0.035 m、最大0.045 m |

# Lunge候補（開けた場所、相手は遠い、facing固定、方向 = 押下時のfacing）

表の値の定義:

- 突進の距離: reachの終わりまでの移動 / 制動の惰性を含めた合計の移動
- 最大の掴める距離: 止まった相手に接触境界で成功する最大のgap（1 mm単位）
- 接触からの成功tick: 最小attemptを0にしたときの値

| 候補 | reach / startup | 突進の距離 | 最高速度 | whiffの長さ（idleに戻るtick） | 最大の掴める距離 | 接触からの成功tick |
|---|---|---|---|---|---|---|
| A6 | 6 / 0 | 0.0583 / 0.0717 m | 1.000 m/s | 17 | 0.760 m | 0 |
| **A8** | **8 / 0** | **0.1000 / 0.1267 m** | **1.333 m/s** | **19** | **0.801 m** | 0 |
| A9 | 9 / 0 | 0.1250 / 0.1600 m | 1.500 m/s | 20 | 0.827 m | 0 |
| A10 | 10 / 0 | 0.1528 / 0.1972 m | 1.667 m/s | 21 | 0.854 m | 0 |
| B（加速17.14） | 6 / 0 | 0.1000 / 0.1476 m | 1.714 m/s | 17 | 0.801 m | 0 |
| B2（加速14.0） | 6 / 0 | 0.0817 / 0.1117 m | 1.400 m/s | 17 | 0.783 m | 0 |
| C2 | 8 / 2 | 0.1000 / 0.1267 m | 1.333 m/s | 21 | 0.801 m | 2 |
| C3 | 8 / 3 | 0.1000 / 0.1267 m | 1.333 m/s | 22 | 0.801 m | 3 |

候補ごとの判断:

- **A8**
  - 目標の0.10〜0.13 mにちょうど入る
  - 旧Pushのactive 8 tickと同じ距離・速度（0.100 / 0.1267 m）
  - 新しい移動の式も、定数も要らない
  - 止まった相手を掴める最大距離0.801 mは、現在の0.79 mとほぼ同じ → Gripの射程のbalanceはほとんど変わらない
  - whiffは2 tickだけ長くなる（17 → 19）
- A6は短すぎる
- A9とA10は目標を超える
  - 射程が0.83 / 0.85 mに伸び、whiffも長い
- Bは、Grip専用の加速という新しい定数が要る
  - 最高速度1.71 m/sで「一瞬で出る」感じが強い
  - 惰性を含めると0.148 mで、目標の上限を超える
- C（独立したstartup）は、遠くからのGripの成功を2〜3 tick遅らせる
  - 新しいphaseが要り、presentationの判断も増える
  - 見えることの保証は、下記の最小attemptで、新しいphaseを作らずに得られる

# Attemptの見え方（A8、facing固定、接触境界）

表の各cellは「成功tick / 成功前のreach Snapshot数」。

| 規則 | gap 0.70（接触） | 0.705 | 0.72 | 0.75 | 0.78 | 0.80 | 0.802 |
|---|---|---|---|---|---|---|---|
| Telegraph A（押下tickで成功可） | 0 / **0** | 1/1 | 3/3 | 5/5 | 7/7 | 7/7 | whiff |
| Telegraph B（次のtickから） | 1 / **1** | 1/1 | 3/3 | 5/5 | 7/7 | 7/7 | whiff |
| C: 最小attempt 2 | 2/2 | 2/2 | 3/3 | 5/5 | 7/7 | 7/7 | whiff |
| C: 最小attempt 3 | 3/3 | 3/3 | 3/3 | 5/5 | 7/7 | 7/7 | whiff |
| **C: 最小attempt 4** | **4/4** | **4/4** | **4/4** | 5/5 | 7/7 | 7/7 | whiff |
| C: 最小attempt 5 | 5/5 | 5/5 | 5/5 | 5/5 | 7/7 | 7/7 | whiff |
| 参考: startup 2 + lunge 8 | 2/2 | 3/3 | 5/5 | 7/7 | 9/9 | 9/9 | whiff |
| 参考: startup 3 + lunge 8 | 3/3 | 4/4 | 6/6 | 8/8 | 10/10 | 10/10 | whiff |

各規則の評価:

- Telegraph Aは、接触からだと0枚（ACTION-11Aの問題が残る）
- Telegraph Bは1枚（16.7 ms、60 Hzの1 frame）で、知覚できるとは言えない
- 最小attempt 4にすると:
  - 接触から押しても4枚（約67 ms）になる
  - 0.72 mから突進したときに自然に当たる時間（3〜4 tick）とそろう
  - 遠い開始（0.75 m以上）は自然な接触tickのまま遅れない
  - Push / Tsuppariのstartup（6 tick）よりは短いので、Gripは「近い相手に最も早くつながる行動」のまま
- 入力の応答性: 4 tick（67 ms）は人が反応できる時間（約200 ms以上）より十分短い。相手がこの間に反応して勝つことは、実際にはできない
- Gripのphaseは増えない。presentationは今の`gripPhase === 'reach'`のまま、attemptを表示できる

# 範囲（0.79 m）と実接触の比較（A8、facing固定、最小attempt 4）

| 開始時のgap | 範囲0.79 | 実接触 | 現在（突進なし、範囲） |
|---|---|---|---|
| 0.700 | t4、掴んだときのgap 0.7000、補正 0 | t4、補正 0 | t0、補正 0 |
| 0.720 | t4、0.7000、補正 0 | t4、補正 0 | t0、補正 0.0100 |
| 0.750 | t4、**0.7083**、補正 0.0042 | t5、補正 **0** | t0、補正 0.0250 |
| 0.770 | t4、0.7283、補正 0.0142 | t6、補正 0 | t0、補正 0.0350 |
| 0.790 | t4、0.7483、補正 0.0242 | t7、補正 0 | whiff |
| 0.800 | t4、0.7583、補正 0.0292 | t7、補正 0 | whiff |
| 0.830 | t4、**0.7883**、補正 **0.0442** | whiff | whiff |
| 0.860 | t6、0.7822、補正 0.0411 | whiff | whiff |
| 0.890 | whiff | whiff | whiff |

- 範囲0.79と突進を組み合わせると、射程が0.86 mまで伸びる
  - 最大8.8 cmの「見える隙間」から掴める
  - grapple突入時に1人あたり最大4.4 cmの位置補正（snap）が出る
- 実接触なら、掴むのは常に体が触れた瞬間（bond前の距離は0.7000 m）
  - snapは0
  - 「手が届いて掴む」突進の見た目と一致する
- **推奨は実接触（Boundary B）**。Grip専用のcolliderは作らず、`resolveContact`の結果をそのまま使う
- 斜めにかすめる接触（gap 0.78で相手が+yへ横歩き、開始t0〜t6）:
  - どれもt7で成功する。接触法線は突進方向から6.3°以内
  - 接触は`resolveContact`の既存の扱い（近づく速度を除き、接線方向は残す）で、新しい特例は要らない
- 動いている相手:
  - 近づいてくる相手（gap 0.8 / 0.9）: t5 / t7で成功（現在は0.8でt2、0.9はwhiff）
  - 離れていく相手、+y方向へ回り込む相手（gap 0.8〜1.0）: すべてwhiff（現在も同じ）
- 成功前に相手は動かされない
  - gap 0.70 / 0.75で、grapple直前の相手の移動は0.0000 m
  - 接触の補正は、内側へ動いた側（突進するGrip側）だけに入るため
  - grappleに入るtickの位置補正も0

# 方向とfacing

| 方式 | reach中のfacing（gap 1.0、相手が+yへ横歩き） | reach終わりのGrip側のy |
|---|---|---|
| **固定（推奨）** | 0.00°のまま | 0.0000 m |
| 固定しない（方向は固定） | 0.16 → 4.82°（体は回るが、進路はまっすぐ） | 0.0000 m |
| 固定しない（方向もfacingに追従） | 0.16 → 4.66° | **+0.0026 m**（隠れたhoming） |

- facingを毎tick追従させると、次のどちらかになる:
  - 見た目と移動がずれる（体だけが回る）
  - 方向も追従させると、相手を追う隠れたhomingになる（8 tickでは数mmだが、0ではない）
- **推奨**: 押下時のfacingから方向を取り、reachのあいだだけcanonical facingを固定する
  - Push（ACTION-10B）と同じ、Simulationが唯一の持ち主の規則
  - recoveryでは通常の向き直りに戻す
  - Gripのrecoveryはgrappleの解除からも入るため、ここを固定すると既存の解除の挙動が変わってしまう。それを避けるため

# 推奨したcontestの規則（prototypeで実装して測定）

- Gripの成功に必要なこと（すべて必要）:
  - FREE
  - Grip reach中
  - stable
  - reachの経過が`GRIP_MIN_ATTEMPT_TICKS`（4）以上
  - そのtickに実接触している
  - 相手が掴める状態にある
- 掴める相手:
  - action idle（Kuzushiの相手 → Morozashi、Kuzushiを消費）
  - **Counter window中**（neutral。Counterは`enterGrapple`でidleになり、Kuzushiは無い）
  - **Grip reach中**（eligibleでなくてもよい。neutral）
- 掴めない相手（変更なし）: Push（startup / charge / impact / recovery）、Tsuppari（startup / 命中tick / recovery）、Grip recovery
- reach中のGripが**取り消されて**Grip recovery（12 tick）に入るのは、そのtickに次のどちらかが起きたとき:
  - (a) 相手のTsuppariの命中tickで、Grip側がreachの中にいる
    - 命中そのものは`resolveForces`でそのまま解決する（impulse、buildup、6発目のKuzushi）
  - (b) 実接触していて、相手のPushのimpact windowが開いている（開くtickも含む）
    - Pushの力はそのまま
- 掴むか、取り消されるかは、`openPushImpact`の後、`resolveCounter`の前に、1つの状態から決める
  - `resolveCounter`と`resolveForces`は、Gripの関係を変えない
  - Counterが捕えるのはPush / Tsuppariの攻撃側だけで、その相手はGripをしていない
  - Gripの相手でPush / Tsuppariを使える者は、掴めない相手に入っている

# 全pairの表（推奨設計、ACTION-11C）

tickは、そのinteractionが実際に起きる論理tick。

| Pair | 推奨する結果 | Trigger Tick | 負けた側 / その後の状態 |
|---|---|---|---|
| Push / Push | 変更なし。接触でそれぞれのimpact windowが開き、両方が開いているあいだはnet 0で力が打ち消し合う | 突進の最初の接触 | 負けなし。それぞれwindowの終わりにrecovery 10 |
| Push / Tsuppari | 変更なし。命中tickがPushのimpact中の接触と重なると、命中は連結される（impulseの半分 = 1.065 m/sをpairのdeltaに、Pushと逆向きで足す）。Pushの力は8 tick続く。pairの押し出しは0.5325 → **0.2914 m**で、Tsuppari側へ動く。Tsuppari側のbuildupは+1。Pushのstartup中、接触前、impactの後の命中は、pusherへの普通の命中（2.13 m/s、buildup） | 命中tick × impact中の接触 | Tsuppari側が押される（Pushの勝ち）。Kuzushiは無い（buildupの規則は別） |
| **Push / Grip** | **新規。Pushのimpact中の接触で、reach中のGripを取り消す。** Pushのstartup / 接触前の突進 / recoveryは、掴めない相手（Gripは突進とreachを続けるだけで、grappleにはならない）。**「勝つPush」とは、実際にimpactを持つPushだけ** | Pushのimpactが開いているtick（開くtickを含む）× 接触 | Grip → **Grip recovery 12**。Pushの力は、idleの相手に当たったときと1 tickごとに同じ（dv −0.4375、以後−0.3042 m/s） |
| Push / Counter | 変更なし。Counter window × 接触 × impact中 → Best（impactの経過0〜2）/ Success。pusherはKuzushi。CounterTransition（候補が無ければovershoot fallback） | impact中の接触tick | pusherはKuzushi 90。window切れのCounter → Counter側がKuzushi |
| Tsuppari / Tsuppari | 変更なし。両方の命中を、それぞれのimpulseで解決する | 各命中tick | 互いに押し合う。buildup / 6発目のKuzushiはそのまま |
| **Tsuppari / Grip** | **新規。Tsuppariの命中（Grip側がreachの中）で、reach中のGripを取り消す。命中そのものは変えない。** Tsuppari中（どのphaseでも）の相手は掴めないので、Gripが命中より先に決まることは無い。Tsuppariが押される前に、idleの相手をGripが掴めば、grappleになる（Tsuppariは始まらない） | Tsuppariの命中tick | Grip → **Grip recovery 12** + 普通の命中（2.13 m/s、buildup +1）。Kuzushiの罰は追加しない |
| Tsuppari / Counter | 変更なし。window中に、reachの中で命中tick → 攻撃側がKuzushi、防御側はidle。impulse / buildupの変化は無く、CounterTransitionも無い | 命中tick | Tsuppari側はKuzushi 90 |
| Grip / Grip | 少なくとも片方がeligible、両方が実接触、もう片方がGrip reach中 → neutral。両方eligibleでもneutral | 最初の条件成立tick | どちらも負けない（neutral grapple） |
| **Grip / Counter** | **新規。eligibleなGripが、window中のCounter側に実接触 → neutral grapple。Counterは`enterGrapple`でidleになる。** Counterが先にwindow切れでKuzushiになっていれば、既存どおりMorozashi | Gripの成功tick | Counter → 取り消し（**Kuzushiなし、CounterTransitionなし**）。Kuzushiの罰を与えないのは、時間切れではなく、Gripに積極的に負けたため |
| Counter / Counter | 変更なし。捕える攻撃が無いので、windowはそれぞれ独立に進み、時間切れで両者Kuzushi | それぞれのwindow切れ | 両者Kuzushi 90 |
| Idle / Grip | eligible（4以上）+ 実接触 → neutral | 成功tick | grapple、両者idle |
| Kuzushi / Grip | eligible + 実接触 → **Morozashi**（Gripした側）。Kuzushiは成功tickにだけ消費する | 成功tick | Kuzushiが消える（突進中や接触だけでは消費しない） |

# Timing sweepの結果（推奨profile vs Current。0 = Gripを押したtick、d = 相手が押したtick）

## Grip vs Counter（gap 0.70 / 0.75 / 0.80、d = −14..+7）

- 推奨:
  - Counterのwindow中にGripが成功するd（0.70: −6..+4、0.75: −6..+5、0.80: −4..+7）→ すべて`neutral (beats counter)`
    - 成功tickは4 / 5 / 7（Gripの自然な接触tickか、最小attemptの4）
    - Counter側はKuzushiにならず、CounterTransitionも無い
  - Counterが先に押されていて、Gripの成功前にwindowが切れるd（0.70: ≤ −8、0.80: ≤ −6）→ Kuzushi → Morozashi（既存）
  - Counterが早くても遅くても、「重なったのが接触の時点だけ」でも、結果はGripの成功tickの状態だけで決まる
- Current:
  - window中の相手は掴めない（reachが6 tickなので、Kuzushiになる前にwhiffする）
  - Gripを先に押すと、押下tickにneutral

## Grip vs Tsuppari（gap 0.70 / 0.75 / 0.80 / 0.85、d = −17..+8）

- 推奨:
  - 命中tickがGripのreach（tick 0〜7）と重なるd（−6..+1）→ 命中tickに`A grip-cancel` + `tsu-hit`
    - 押下tickに命中が来る場合（d = −6）は、押下tickのうちに取り消される
  - Tsuppariが、Gripの成功より前に押されて、命中がreachの後になるd（+2..+4）→ Gripは掴めずwhiffし、recovery中に命中を受ける
  - Gripが先に成功するd（0.70 / 0.75でd ≥ +6、0.80でd = +8）→ neutral grapple（Tsuppariは始まらない）
  - 0.85では、どのdでもTsuppariが勝つ（Gripは届かず、Tsuppariのreach 0.90の内側）
  - **どのoffsetでも、Gripの成功とTsuppariの命中が同じtickに両立することはない**
  - 「素朴なresolverの順序だと、命中の直前にGripが成功する」ケースは、Tsuppari中の相手を掴めない規則によって起きない
- Current: 命中はGripを取り消さない。Tsuppari中の相手は掴めない

## Grip vs Push（gap 0.70 / 0.75 / 0.80 / 1.2 / 1.6、d = −30..+8）

- Pushのimpactの接触がGripのreachと重なる → `push-impact` + `A grip-cancel`
  - Pushが先に押された場合: 0.70でd = −12..+1、1.2でd = −30..−16
  - impactが開くtickと、Gripが接触するtickが同じ場合も含む
- Pushのstartup / recovery中にGripが接触 → 掴めない
  - 例: 0.70でd = −16 / +2..+4
  - Gripはそのままwhiffし、Pushのimpactはその後（Gripのrecovery中）に当たる
- Pushが終わった後か、Gripが先に成功する → neutral grapple
  - 例: 0.70でd ≤ −20 / ≥ +6
- 遠い（1.6）: Pushが届かないか、Gripが届かない
- Current: Pushのimpactは、Gripを取り消さない（Pushの力だけ受け、reachはそのまま）

## Grip vs Grip（gap 0.70 / 0.75 / 0.80 / 0.90、d = −9..+9）

- `gripTakesReach`なし（成功の条件は「相手がidle」と「両方eligible」だけ）だと、**空白**ができる
  - 0.70 / 0.75でd = ±4、0.80でd = ±4 / ±6
  - 片方が先にeligibleでも、相手はreach中なので掴めない。両方がeligibleになる前に、先の側のreachが終わる
  - → どちらも掴めない
- 推奨（reach中の相手も取れる）では、全offsetで空白が無い
  - d = 0は`neutral(both)`
  - それ以外は、先にeligibleになった側のneutral
  - 0.90は、同時の突進（d = 0）だけが届く（t7、`neutral(both)`）
- 既存の挙動として観察したこと（範囲外なので変えていない）:
  - 掴まれた側が、その後にGripを押すと、READYなら即座に解除（release）になる
  - 例: 0.70、d ≥ 5でfreeに戻る
  - Currentでも同じ（d ≥ 1で解除）

## Grip vs Kuzushi（Counterの空振り → Kuzushi、gap 0.70 / 0.75 / 0.80 / 0.90）

- 推奨:
  - grapple直前のtickまで、相手はKuzushiのまま（例: 89 → 86 → … と減る）
    - 突進中や接触だけでは消費しない
  - 成功tickにだけ消費 → Morozashi（Gripした側）
  - 0.80（Currentでは届かない）もMorozashiになる
  - 0.90は届かない（whiff）
  - Kuzushiが成功前に切れる場合（d = 89 / 90）→ neutral
- 90 tickと1.5倍のfollow-upの規則は変えていない（Gripを使わないpairはProductionと完全に一致）

# 参加者の順序

各cellを4通りで実行した:

- 通常
- 役割を入れ替え（Gripする側をbに）
- 配列の順序を入れ替え
- 両方を入れ替え

結果のtimelineを、Gripする側の視点に直して比べた。

| sweep | 一致 |
|---|---|
| Grip vs Counter | 108 / 108 |
| Grip vs Tsuppari | 152 / 152 |
| Grip vs Push | 210 / 210 |
| Grip vs Grip（3 profile） | 228 / 228 |
| 合計 | **0件の不一致** |

# Ring-out / 衝突

- 相手がring内にいる状態で、Gripの突進そのものによるring-outは0件
  - ring 2.275 + tokudawara、Grip側の半径2.20〜2.274、相手の方向と距離を総当たり、相手は静止・横歩き、2,436 run
  - 外向きの移動は最大0.1 mm
  - 理由: 方向は、押下時に相手（ring内）を向いたfacingで固定される
  - 突進の0.127 m は、相手までの距離（0.70 m以上）より短い
  - そのため、Grip側は常にring内の線分の上を動く
- 相手をring外へ出したり、押したりすることもない（接触の補正は動いた側だけに入る）
- bondによる位置補正: 実接触なら0
  - 範囲0.79と突進を組み合わせると、最大0.044 m / 人
- 参考: 最初の`m1`で、相手を最初からring外に置いたsetupになっていた
  - 相手がring外に置かれたため、ring-outが即座に決まった。突進とは関係ない結果
  - 相手をring内に置き直して測り直した（上記の2,436 run）

# Resolverの構造の比較

| 案 | 内容 | 評価 |
|---|---|---|
| 1. 現在のresolverの順序 + 個別の例外 | `resolveCounter` / `resolveGrip` / `resolveForces`の中に、例外を足していく | 不採用。Tsuppariの命中は`resolveForces`の中で決まる（Gripの後）。Gripを取り消す判定をそこに書くと、呼び出しの順序が勝敗を決めてしまう |
| **2. 小さな純粋なpairのcontest helper** | `openPushImpact`の後、`resolveCounter`の前に、`resolveFreeGripContest(a, b, contact)`を1回呼ぶ。返り値は`{ cancelled, grapple: GrappleAdvantage \| null }` | **採用** |

採用した案2の詳細:

- helperが使うのは、既存の純粋な述語だけ
  - `isGripReaching`、`isTsuppariHitTick`、`inTsuppariReach`、`isPushActive`、`contact`
  - eligible（経過 ≥ 4）、掴める相手かどうか
- a / bを対称に評価する
- 適用の順序: 取り消し → `resolveCounter`（変更なし）→ grapple（Kuzushiの消費 + `enterGrapple`）→ 力（grapple中なら飛ばす、変更なし）
- 呼び出しの順序を後で入れ替えても、Tsuppari vs GripとGrip vs Counterの勝者は変わらない
  - 勝敗は、helperが1つのSnapshotから決めるため
  - prototypeでは、既存のresolverとのあいだに相互作用が無い（理由は上の「推奨したcontestの規則」の節）
- Rule engine、ECS、event bus、汎用のframeworkは要らない

# 推奨するACTION-11Cの設計

## Gripのtiming

- `GRIP_REACH_TICKS`: 6 → **8**（reach = 突進）
- `GRIP_RECOVERY_TICKS`: 12（変更なし）
- 新規: `GRIP_MIN_ATTEMPT_TICKS = 4`
  - reachの経過 = `GRIP_REACH_TICKS − ticksRemaining`。押下tickが0
  - 成功できるのは経過4以上のtick → 最も早い成功はtick 4
- 見えることの保証: 成功の前に、reachのSnapshotが必ず4枚以上ある（接触から約67 ms、遠い開始では自然な接触tickまで）
  - 例外: 押下tickに相手のTsuppariの命中やPushのimpactで取り消された場合は、負けがその場で見える
- whiff: reachのSnapshot 7枚 + recovery 12枚（tick 19でidle）
- 新しいGripのphaseは作らない（`reach` / `recovery`のまま）。ACTION-11Aのattemptの選択は変更不要

## Gripの移動

- 方向: 押下時の`(cos facing, sin facing)`を、Gripのactionに`direction`として保存する
  - Pushと同じ形。`BoutTypes`の`grip`にも1 field足し、Snapshotにcopyする
- `effectiveMove`: reach中は`direction`を返す
  - 既存のgrounded rule（`FORWARD_ACCELERATION` 10、`MAX_SPEED`）のまま
  - WASDは無視
  - recovery中は`ZERO_MOVE`（制動）
- facing: reach中は`updateFacing`で飛ばす（Push / Kuzushiと同じ）。recoveryでは通常に戻す
- 予想される移動: reachの終わりで0.100 m、合計0.1267 m、最高速度1.333 m/s。homingしない

## 成功の境界

- 実接触: `resolveContact()`の結果が非null
- `GRIP_RANGE_MARGIN`は、Gripの成功に使わない
  - 削除するか未使用にするかは、11Cで決める
  - Kuzushiでもこの境界を迂回できない点は維持する
- 掴める最大距離（止まった相手）: 0.801 m

## Contestの表

- 上の「全pairの表」のとおり
- Gripを含まない6 pairは、Productionと完全に一致することを確認済み（84,000 tick）

## 負けたときの結果

- TsuppariにGripが負ける → **Grip recovery 12**。命中は普通に解決（impulse、buildup）。Kuzushiの罰は無い
- PushにGripが負ける → **Grip recovery 12**。Pushの力は普通に解決
- GripにCounterが負ける → **Counterを取り消す（`enterGrapple`でidle）、neutral grapple**。Kuzushiは無く、CounterTransitionも無い

## Resolverの構造

FREEの1 tickは次の順序にする:

```
resolveContact
→ openPushImpact
→ const gc = resolveFreeGripContest(a, b, contact)   // 純関数、対称
→ gc.cancelled をGrip recoveryへ
→ resolveCounter（変更なし）
→ gc.grappleがあれば Kuzushiの消費 + enterGrapple
→ engagementがfreeなら resolveForces（変更なし）
→ advanceAction（reachの経過は ticksRemaining から導く）
→ updateFacing
```

- 既存の`resolveGrip`の距離判定は、helperに置き換える
- Grip vs Gripは「両方eligible」または「eligible + 相手がreach中」→ neutralで、participantの順序は勝敗に関わらない

## 維持すること

- Push: startup 6、charge 24、impact 8、recovery 10、力、facingの固定、Counterの捕え方（impactから数えるtier）は変更なし
  - Gripに関わる変化は「impactでreach中のGripを取り消す」だけ
- Tsuppari: 命中の判定、reach 0.55、impulse 2.13、連結、buildup、cooldownは変更なし
  - 変化は「命中でreach中のGripを取り消す」だけ
- Counter: window 12、Best 3、Push / Tsuppariを捕える規則、CounterTransition、時間切れのKuzushiは変更なし
  - 変化は「window中にGripに掴まれると、取り消されてneutral」だけ
- Kuzushi: 90 tick、1.5倍のfollow-up、消費の規則は変更なし（Gripでは成功tickにだけ消費）
- Grip / Drive / Grapple: `enterGrapple`、bond、解除、Grappled Orientation、Driveは変更なし
- 同一参加者の入力優先順位 Push > Tsuppari > Counter > Gripは変更なし（衝突は無い）

# 不採用にした案

- A6、A9、A10、B、B2、C2、C3（理由は「Lunge候補」の節）
- Telegraph A（0枚）、Telegraph B（1 frame）
- 最小attempt 2 / 3（3は許容範囲の代案。4の方がはっきり見える）
- 最小attempt 5（0.75 mの自然な接触tickと同じになり、それより近い開始が遅くなる）
- 範囲0.79の境界（見える隙間から掴める、snapが最大4.4 cm）
- facingの追従、方向の追従（見た目のずれ、隠れたhoming）
- 「相手がidle」だけで判定し、`gripTakesReach`を入れない案（Grip vs Gripに空白ができる）
- resolverの順序 + 個別の例外（呼び出しの順序で勝敗が決まる）
- 負けたGripにKuzushiの罰を与える案（必要な理由が無い）
- 負けたCounterにKuzushiを与える案（時間切れの失敗ではない）

# User Decisions Required

設計を止めるものは無い。11Cの前に、次の3点を確認してほしい（どれも推奨値をそのまま使える）:

1. `GRIP_MIN_ATTEMPT_TICKS`: **4（推奨、約67 ms）**か、3（約50 ms）か
2. GripがCounterに勝ったときの結果: **neutral（推奨）**か、Morozashiか
   - 補足: Counterが先に時間切れになれば、既存の規則で既にMorozashiになる
3. Push / Tsuppariのrecovery中の相手は、現在どおり掴めないままにする（推奨: 11Cでは変えない）
   - 空振りへの罰を、Gripでも取れるようにするかどうかは、将来のTaskで決める

# Production Changes: NONE

- `git diff --check`: clean
- 変更したのは、このCompletion Reportだけ
  - `src/`、test、`docs/`のSPEC、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`は変更していない
- scratchの実験はcommitしていない
  - 置き場所: `C:\Users\Kazu\AppData\Local\Temp\claude\e--develop-CrazyGames-SumoSim\aff3b535-26b3-4cb9-b884-eb9a4750387f\scratchpad\proto11b\`
  - 中身: `Proto.ts`、`equiv.mjs`、`m1_grip.mjs`、`m2_contest.mjs`、`m3_extra.mjs`と、その出力

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

なし。

調査の途中で、次の2点を見つけて記録した。どちらも直していない:

- Grip vs Gripの空白
  - 最小attemptを入れたときに生じる
  - 推奨設計の`gripTakesReach`で解消する
- grapple中のGripの押下による即時の解除
  - 既存の挙動

# Git Delivery

- stageするのはCompletion Reportだけ
- 手順: commit `docs(investigation): analyze grip lunge contest rules` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`は変更しない
