Task-ID: ACTION-07A-TSUPPARI-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 7357788bd9b9091e50ef44859874cec4ae128671
Agent-Start-Head: c2e1ce946bd08dee1b2a46f34df7bdf942129e1f
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation / Design only。Production sourceは変更していない。Repositoryの変更はこのReportだけ）。

- Current Sourceを直接読み、現在のPushの数値モデルを**実測**した（scratchpad上のcopyで計測。Repositoryは無変更）
- Tsuppariの実装設計を決めた。要点:
  - Tsuppariの力は、**命中tickに1回だけ、受け手だけに入るimpulse**（`TSUPPARI_IMPULSE` = 2.13 m/s）。受け手の変位は、現在のPushとほぼ同じ（0.266 m / 0.267 m）
  - 新しいPushは `PUSH_EXTERNAL_ACCELERATION` 20 → **26.25**。代表fixtureで変位が**ちょうど2.00倍**（0.267 → 0.533 m）。clampとdecayは変えない
  - Pushが接触中にactiveのtickだけ、2人を1つの組として扱う（Tsuppariは半分の `J/2` だけPushを打ち消す）。それ以外のtickでは、Tsuppariは受け手だけに入る
- 設計の主要部分は、scratchpadの試作で実際に動かして確かめた（同じtickのTsuppari同士、閾値の同時命中、Push対Tsuppari、Push-onlyのbit一致、Counter、ring-out、cooldownの時系列）
- Stop Conditionには、どれも当たらない（大きな物理の書き直しは不要。Pushの受理済みCounter semanticsも変えない）
- **Implementation: READY**（gameplay / input / debug表示まで。Tsuppariのpose artは、別のArt Visual Gateを通してから）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `7357788`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `7357788..origin/develop` と `HEAD..origin/develop` の変更は、どちらも `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` → `c2e1ce9`

# Current Source Findings

読んだもの: `AGENTS.md`、`CLAUDE.md`、`CURRENT_TASK.md`、前回の `CURRENT_COMPLETION_REPORT.md`、`docs/ARCHITECTURE.md`（Push / Counter / Grip / Drive / Ring-out / Product art）、`docs/WRESTLER_PRODUCT_ART_SPEC.md` §0、`BoutTypes.ts`、`BoutSimulation.ts`（全体）、`ringOut.ts`、`grappleOrientation.ts`（export）、`pressLatch.ts`、`pushDummyController.ts`、`BoutScene.ts`、`wrestlerVisualState.ts`、`WrestlerView.ts`、`productWrestlerArt.ts`、関連Testの構成と、intentを作るhelper。

Taskが確認を求めた事実は、すべてCurrent Sourceと一致した:

- Simulationは60 Hzの固定step（`SIMULATION_HZ = 60`。`step()`は1 tickだけ進める）
- Push: startup 6 / active 8 / recovery 10 tick。開始時のfacingで方向を固定する。activeの間は、固定方向へ自分の足で踏み込む（grounded rule）
- Pushの力: 接触中にactiveのPushについて、`net = [A push] − [B push]`。`dv = net · PUSH_EXTERNAL_ACCELERATION(20) · s · dt` を、接触法線（A→B）の方向へ、**2人のexternalVelocityに同じ量**加える（2人は組として一緒に動く。同時Pushは打ち消し合う）。`s` は押される側がKuzushiのとき1.5（`KUZUSHI_PUSH_SUSCEPTIBILITY`）。その後、それぞれをclampする（`MAX_EXTERNAL_SPEED` = 3 m/s）。externalは毎tick、積分の前に `EXTERNAL_DECELERATION` = 8 m/s²（0.1333 m/s/tick）で、0まで一定の減速をする
- Counter: window 12 tick。「相手のPushがactive × そのtickに実際に接触」で成功する。tier（best: active経過0〜2 / success）は、横 / 後ろへの移動先とCounterTransition（90 tick）の選択にだけ使う。Failは使用者自身がKuzushi（30 tick）
- Kuzushiの入口は `enterKuzushi()` だけ（actionをidleにする。不変条件: kuzushi ⇒ action idle）
- 同じtickのIntent優先順: Push > Counter > Grip（FREEかつidleかつstableのときだけ開始。負けたedgeは捨てる。queueしない）
- `ArrowLeft` / `ArrowRight` はどこにも割り当てられていない（移動はWASD。ArrowUp = Push / Drive、ArrowDown = Counter、Shift = Grip）
- 力士の見た目は、剛体のsprite 1枚（`WrestlerView`）。pivot、scale = 2R / body core、rotation = facing。poseの切り替えはまだ無い
- `resolveCounter()` の戻り値（tier）は、呼び出し側で使われていない
- `resolvePush()` は、接触しているtickだけ呼ばれる（`if (contact && free)`）

Accepted decisionと矛盾するCurrent Sourceは無かった。

# Exact Current Push Model（実測）

計測方法: scratchpadに `BoutSimulation.ts` などをcopyし、Node 24で直接実行した（`PUSH_EXTERNAL_ACCELERATION` だけを環境変数で差し替えた）。Repositoryのsourceには触れていない。

代表fixture **F1**: A(−0.35, 0)、B(+0.35, 0)（ちょうど接触）、半径50 mの土俵、AがPushを1回押すだけ（他の入力は無し）。押したtickから、externalが0に戻るまでのBの変位を測る（歩いて接触してから押すfixture F2も、値は同じ）。

| `PUSH_EXTERNAL_ACCELERATION` | Bの変位 | 倍率 | 最大external速度 | 0に戻るまで |
|---|---|---|---|---|
| **20（現在）** | **0.267 m** | 1.00 | 1.733 m/s | 31 tick |
| 25 | 0.472 m | 1.77 | 2.400 | 32 |
| 26 | 0.520 m | 1.95 | 2.533 | 33 |
| **26.25（提案）** | **0.533 m** | **2.00** | 2.567 | 33 |
| 26.5 | 0.545 m | 2.04 | 2.600 | 33 |
| 27 | 0.570 m | 2.14 | 2.667 | 34 |
| 30 | 0.709 m | 2.66 | 3.000（clamp） | 36 |
| 40（= 力を2倍） | 0.767 m | 2.87 | 3.000（clamp） | 36 |

- Pushでは2人が一緒に動く（Aの変位もBと同じ）
- **力の2倍は、変位の2倍にならない**: decayが一定の減速なので、惰性で進む距離はほぼ速度の2乗に比例する。加速度を2倍（40）にすると、最大速度がclamp（3 m/s）に当たり、変位は2.87倍になる
- 変位を2倍にするには、加速度は約1.31倍（26.25）で足りる。最大速度は2.57 m/sで、clampには届かない → **clampとdecayを変えずに、定数1つで2倍の変位が得られる**
- 感度: ±1 m/s² で、変位は約±0.05 m 変わる

# Proposed Constants（すべてProvisional / User Play Test）

| 定数 | 値 | 根拠 |
|---|---|---|
| `TSUPPARI_STARTUP_TICKS` | 6（100 ms） | Pushのstartupと同じ。同じtickにPushとTsuppariを押すと、Pushのactive初tickとTsuppariの命中tickが重なり、後述の「組の勝負」（Pushが勝つ）になる。startupを短くすると、同時押しで毎回Tsuppariが先に当たり、Pushのstartupを止めてしまう |
| `TSUPPARI_ACTIVE_TICKS` | 1 | 命中を判定するtick。力もこのtickだけ |
| `TSUPPARI_RECOVERY_TICKS` | 9（150 ms） | 合計16 tick（267 ms）。Pushの24 tick（400 ms）より軽い |
| `TSUPPARI_HAND_COOLDOWN_TICKS` | 60（1.0 s） | 左右それぞれ。受け付けたtickから数える（後述） |
| `TSUPPARI_HAND_REACH` | 0.525 m（1.5 R） | 攻撃側の中心から掌までの距離。命中条件は `中心距離 ≤ TSUPPARI_HAND_REACH + receiver.bodyRadius`（現在は0.875 m） |
| `TSUPPARI_IMPULSE` | 2.13 m/s | 受け手だけに入るΔv。F1でBの変位0.266 m（現在のPushは0.267 m）。最大2.13 m/sで、clampに届かない |
| `TSUPPARI_COUPLED_SHARE` | 0.5 | Pushが接触中にactiveのtick（組のtick）では、Tsuppariのimpulseを2人で分ける（`enterGrapple` の平均と同じ、同じ体格を仮定した正規化） |
| `TSUPPARI_KUZUSHI_BUILDUP` | 5 | 普通の命中5回のあと、6回目の命中でKuzushi |
| Kuzushiの長さ | `KUZUSHI_TICKS`（30）を再利用 | 6回目の命中も、Counterで捕えられた場合も、Push Counterと同じ |
| `PUSH_EXTERNAL_ACCELERATION` | 20 → **26.25** | F1の変位がちょうど2.00倍。Pushのtiming（6 / 8 / 10）は変えない |

変えない: `MAX_EXTERNAL_SPEED`、`EXTERNAL_DECELERATION`、`KUZUSHI_PUSH_SUSCEPTIBILITY`、Pushのtiming、Counter window、CounterTransition、Grip / Drive、ring-out。

# Proposed Tsuppari State Model

## Q1. ParticipantIntentの追加

```ts
// New Tsuppari press edges for this tick (the wrestler's own left / right hand), not held state.
// Same tick: Push > Tsuppari (Left > Right) > Counter > Grip; the losing edges are dropped (not queued).
readonly tsuppariLeftPressed: boolean
readonly tsuppariRightPressed: boolean
```

- 左右2つのedgeを、そのままSimulationへ渡す。「Left > Right」と「cooldown中の手」の判断は、Simulationがする（Sceneで先に1つに絞らない）
- 既存のfieldと同じく必須fieldにする。intentを作るhelperは、各Test fileに1つずつあるだけ（約13か所）なので、修正は機械的

## Q2. 同じ参加者の、同じtickの入力優先順（厳密）

開始できるのは、今と同じ「FREE、release tickでない、action idle、posture stable」のときだけ。その上で:

1. `pushPressed` → Push
2. それ以外で、`tsuppariLeftPressed` かつ左手のcooldownが0 → Tsuppari（left）
3. それ以外で、`tsuppariRightPressed` かつ右手のcooldownが0 → Tsuppari（right）
4. それ以外で、`counterPressed` → Counter
5. それ以外で、`gripPressed` → Grip
6. Move: 実効moveは、今と同じくactionがidleのときだけ使う（Tsuppariの全phaseでは0 = 制動）

- 負けたedgeと、開始できないedgeは捨てる（queueしない。cooldownも変えない）
- **cooldown中の手のedgeは「開始できないedge」として先に捨てる**。そのため、左手がcooldown中で左右を同時に押すと、右手が出る。左手がcooldown中で左とCounterを同時に押すと、Counterが出る（後述「Interpretive decisions」）

## Q3. Action Stateの形

```ts
export type TsuppariHand = 'left' | 'right'
export type TsuppariPhase = 'startup' | 'active' | 'recovery'
// pending until the active (hit) tick; then hit or whiff for the rest of the action.
export type TsuppariStrike = 'pending' | 'hit' | 'whiff'

// ParticipantActionState に追加
| {
    readonly kind: 'tsuppari'
    readonly hand: TsuppariHand
    readonly phase: TsuppariPhase
    // Ticks left in the current phase, including the next tick (always >= 1).
    readonly ticksRemaining: number
    readonly strike: TsuppariStrike
  }

// MutableAction に追加（同じ形の可変版）
| { kind: 'tsuppari'; hand: TsuppariHand; phase: TsuppariPhase; ticksRemaining: number; strike: TsuppariStrike }
```

- 方向は固定しない（Q9）。`direction` fieldは持たない
- `strike` は、命中したかどうかをStateとして明示するもの（Test、debug表示、将来の命中演出が、velocityから推測しなくてよい）。Counterで捕えられた場合は、Kuzushiでactionがidleになるので、`strike` は残らない

## Q4. 手ごとのcooldownの置き場所

`MutableParticipant` に、Bout runtimeの値として追加する（Simulationだけが正本）:

```ts
// Ticks until each hand can start a Tsuppari again (0 = ready). Bout-local.
tsuppariCooldown: { left: number; right: number }
// Ordinary successful Tsuppari hits since the last Kuzushi hit (0..TSUPPARI_KUZUSHI_BUILDUP). Bout-local.
tsuppariBuildup: number
```

- constructorで `{ left: 0, right: 0 }` と `0` にする。新しいBout = 新しい `BoutSimulation` なので、自動的に初期値に戻る（`BoutScene.restart()` はすでに作り直している）
- Management / 永続化には持たせない

## Q5. Cooldownの規則と時系列

- **受け付けたtickから数える**（start-at-accept）: 受け付けたtickで、その手を60にする
- 毎tickの先頭（`step()` の、outcomeの確認の直後。CounterTransitionの分岐より**前**）で、0より大きければ1減らす。Kuzushi中も、組み中も、CounterTransition中も、他のaction中も減る。勝敗が決まった後は `step()` が何もしないので止まる
- 受け付けたtickを `t0` とすると、`t0 + 60` のtick先頭で0になり、そのtickにまた受け付けられる（ちょうど1.0秒）
- start-at-endより単純で（actionの状態に依存しない）、左右を交互に使うと1秒に2回、片手だけなら1秒に1回になる。交互に使う意図はそのまま保てる

時系列の例（試作で確認。左右を毎tick同時に押し続けた場合と、左だけを押し続けた場合）:

| tick | 左右を同時に押し続ける | 左だけを押し続ける |
|---|---|---|
| 0 | L受付（L cd = 60） | L受付 |
| 0–5 / 6 / 7–15 | L startup / 命中判定 / recovery | 同左 |
| 16 | Lはcd中 → **R受付**（R cd = 60） | Lはcd中 → 何もしない |
| 32 | L cd = 28、R cd = 44 → 何もしない | — |
| 60 | L cd = 0 → **L受付** | **L受付** |
| 76 | R cd = 0 → **R受付** | — |
| 120 / 136 / 180 / 196 … | L / R / L / R | 120 / 180 / 240 … |

→ 交互なら60 tickごとに2回、片手なら1回（試作の実測: `0:L 16:R 60:L 76:R 120:L 136:R 180:L 196:R 240:L` と `0 60 120 180 240`）。

## Q6 / Q7. Timingと命中tick

- startup 6 / active 1 / recovery 9（合計16 tick）
- 受け付けたtick `t0` は、startupの1 tick目（Pushと同じ数え方。そのtickの最後に `advanceAction` が残りを減らす）
- **命中を判定するのは `t0 + 6` のtickだけ**（active = 1 tick）。Tsuppariの力が入るのも、このtickだけ
- recoveryは `t0 + 7 … t0 + 15`。`t0 + 16` でidleに戻り、そのtickから次のactionを受け付ける
- WASDは、16 tickのあいだずっと無効（入力0として制動。Push / Counterと同じ `effectiveMove` の扱い）
- 一枚poseのアニメーションは、gameplayの正本ではない（Q24）

## Q8. Reach（Provisional / User Play Test）

```
hit  ⇔  |receiver.center − attacker.center| ≤ TSUPPARI_HAND_REACH + receiver.bodyRadius
TSUPPARI_HAND_REACH = 0.525 m（1.5 R）  →  現在の値で 0.875 m
```

- 「中心どうしの距離を固定のしきい値と比べる」のではなく、「攻撃側の手の届く距離 + 受け手の体の半径」にする。今は半径が同じなので、外から見た挙動は固定の0.875 mと同じ。将来、参加者ごとに半径が変わっても、意味（掌が相手の体の表面に届く）が保たれる
- 比較: 接触は0.70 m（+ slop 0.002）、Gripの範囲は0.79 m、Prototypeの開始位置は1.40 m（届かない。近づく必要がある）
- 根拠: 体の中心から掌まで1.5 Rは、一般的な腕の長さとして妥当。参考として、Userの候補画像（`tools/wrestler_art/input.local/*_tuppari.png`。git-ignore。Repositoryには取り込んでいない）を、**正規化せずに**ざっと測った。idleのred masterと同じcanvasの配置と大きさだと仮定し、同じ前方向（160.7°）と根元（648, 609）を使った結果、掌の前方への張り出しは約1.3〜1.7 R だった（idleは1.14 R）。**この値は正規化した計測ではなく、根拠には使っていない**。1.5 R と矛盾しないことを確かめただけ
- 境界の浮動小数: 試作では、中心距離がちょうど0.875のfixtureが、浮動小数の誤差でwhiffになった。Implementationでは、`TSUPPARI_HAND_REACH` を計算式ではなく数値（0.525）で書き、Testの境界は `reach − 1e-6`（hit）/ `reach + 1e-6`（whiff）で確かめる（ちょうどの値で厳密に比べるTestは書かない）
- poseを正規化した後の調整方法: Art Visual Gateで、採用したpose画像に、idleと同じくroot（pivot）とbody-coreを注記して正規化する。pivotから掌の先までの、+X方向の張り出し `e`（R単位）を測る。掌が相手の体の縁に少し重なって見えるように、`TSUPPARI_HAND_REACH ≈ (e − 0.05〜0.1) · R` にする。式は中心基準のままで、spriteの重なりは使わない

## Q9. 向き / 方向

- Tsuppariは方向を固定しない。命中の判定と力の方向は、**命中tickの、攻撃側の中心 → 受け手の中心の軸**（中心が一致した場合は、攻撃側のfacing。`resolveContact` と同じ予備の方向）
- FREEでは、Kuzushiでない参加者は毎tick相手の方を向く（`updateFacing`）。Tsuppariの使用者は、開始の時点でstableで、Kuzushiに入ればactionが消える。そのため、Tsuppari中のfacingは常に相手を向いている → 角度の判定（扇形の範囲）は不要
- 将来、facingが相手からずれる規則ができたら、そのときに角度の判定を加える

## Q10. 体が接触していなくても当たるか

当たる。命中は「中心距離 ≤ 0.875 m」だけで決まり、体の接触（0.702 m）は要らない。接触中（重なりを含む）でも当たる。

## Q11. Tsuppariの力

- **命中tickだけに入るimpulse**: `receiver.externalVelocity += n · TSUPPARI_IMPULSE`（n = 攻撃側 → 受け手。その後、受け手をclampする）。攻撃側には何も入れない（攻撃側は前に出ない）
- `KUZUSHI_PUSH_SUSCEPTIBILITY` は、Tsuppariには掛けない（6回目の命中も「普通のTsuppariの押し + Kuzushi」にするため。すでにKuzushiの受け手にも、普通の量だけ入る）
- 力はexternal velocityとして入り、次のtickから既存のdecay / clamp / 積分 / ring-outの流れに乗る。新しい速度や位置のStateは作らない
- 実測（F1。受け手はidleで入力なし）: Bの変位は **0.266 m**（現在のPushは0.267 m）。Aは0.000 m。最大2.13 m/s。中心距離0.85 m（接触していない）でも同じ0.266 m
- 時間の形は現在のPushと違う: Pushは8 tickかけて加速するが、Tsuppariは命中した瞬間に2.13 m/sになり、惰性で止まる（「叩く」感触。User Play Testで確認する）

却下した案: 「8 tickのactiveのあいだ、`a = 20` で受け手だけを加速する」（受け手の軌跡は、現在のPushと**bit単位で一致**した。試作で確認）。しかし、同じtickに両者の6回目の命中が起きると、それぞれのKuzushiが相手のTsuppariを1 tick目で止めてしまう。そのため、両者が0.004 mしか下がらず、「6回目 = 普通の押し + Kuzushi」が成り立たなかった。impulse案では、両者とも0.266 mずつ離れ、両者ともKuzushiになる（試作で確認）。

## Q12 / Q13. Pushの変更と、clamp / decayとの関係

- `PUSH_EXTERNAL_ACCELERATION` を 20 → 26.25 にするだけ。Pushの式も、timingも、clamp / decayも変えない
- F1で 0.267 → 0.533 m（2.00倍）、最大速度は 1.733 → 2.567 m/s（< 3。clampに届かない）
- Kuzushiの受け手（s = 1.5 → 39.4 m/s²）は、以前より早くclamp（3 m/s）に届く。既存の規則のままで、変えない
- Tsuppari 2.13 m/s もclampに届かない。すでに速く動いている受け手に加わると、clampが効く（既存の規則）
- 「力を2倍（40）」にしない理由: clampに当たり、変位が2.87倍になる。Userの目的は変位 / 感触なので、変位で2倍にした。最終的な感触はUser Play Test
- Implementationでは、定数の値ではなく、**代表fixtureでの実際の変位**を確かめる（Test計画を参照）

## Q14. Tsuppari同士（同じtick）

- 先に、両者の命中判定を**同じ状態から**行う（どちらの命中も、相手のimpulseやKuzushiより前に決まる）→ その後で両方の力を入れる → 最後に、6回目の命中によるKuzushiを入れる
- 受け手ごとに入れるので、等しい力が打ち消し合わない: Aは `−n·J`、Bは `+n·J`。実測で、両者とも0.266 mずつ離れる
- 速度のStateは、今の各参加者の `externalVelocity` だけ。組の値も、二重の正本も作らない
- 両方の命中が、それぞれの攻撃側のbuildupを増やす
- 片方だけが6回目の命中: 両方のimpulseが入り、6回目を受けた側だけがKuzushiになる（その側のactionは消える）。実測では、両者とも0.266 m下がり、片方だけがKuzushi
- 両方とも6回目の命中: 両方のimpulse、両方のbuildupを0、両方がKuzushi。実測で、両者とも0.266 m下がり、両者ともKuzushi
- 参加者の並び順に依存しない（判定 → 力 → Kuzushi の順で、各段階で両者を対称に扱う）

## Q15. Push対Tsuppariの力の勝負

規則（1か所で、並び順に依存しない）:

- **組のtick**: 接触していて、どちらかのPushがactive（= 今 `resolvePush` が力を入れるtick）
  - `dv = netPush · P · s · dt + netStrike · J · TSUPPARI_COUPLED_SHARE`（向きはA→Bの接触法線。netStrike = [Aが命中] − [Bが命中]）
  - 2人のexternalに同じ量を入れ、それぞれをclampする（今のPushと同じ形）
  - Tsuppariの使用者がPushの使用者を叩くと、組の速度が `J/2` = 1.065 m/s だけ戻される。Pushは毎tick `P·dt` = 0.4375 m/s で押し続けるので、全体ではPushが勝つ
- **それ以外のtick**: Tsuppariは受け手だけに入る（Q11）

実測（A = Push、B = Tsuppari、接触から開始。`k` = AがPushを押してから、BがTsuppariを押すまでのtick数）:

| 場面 | Bの変位（Pushの方向が正） | 2人は離れたか |
|---|---|---|
| Pushだけ（抵抗なし） | 0.533 m | — |
| k = 0（同じtickに押した。命中はPushのactive初tickと重なる） | **0.291 m**（55%）。命中tickに組が −0.63 m/s まで一瞬戻され、その後Pushが押し切る | 離れない |
| k = 2 / 4 / 6（Pushのactive中に命中） | 0.223 / 0.217 / 0.253 m | 離れない |
| k = 8（命中はPushのactiveが終わった後） | 0.533 m（Pushは全部入った）。その後、Tsuppariで押した側が0.266 m下がる | 離れる |
| k = −1 / −3 / −6（命中がPushのstartup中） | 0（Pushは空振り）。Pushした側が0.139 m下がる | 離れる |

- 同じtick、またはPushのactive中の勝負では、Pushが勝つ（Tsuppariの使用者が押し下げられる）。Tsuppariは、押される距離を約半分に減らす → 「弱いTsuppariの圧力を、Pushが押し切る」
- Pushのstartup中に先に当たると、Pushの使用者は押し返され、Pushは空振りする（「先に当てた方が勝つ」）。同じtickに押した場合はこうならないように、Tsuppariのstartupを6にした
- 組のtickでは、命中tickに組全体が少し戻されるので、Tsuppariの使用者が1〜2 tickのあいだ、組と一緒にわずかに（約1 cm）前へ動く。組として動く規則の結果で、Tsuppariによる前進ではない。User Play Testで確認する
- 組のtickに6回目の命中が当たると、Pushの使用者がKuzushiになり、そのPushは終わる（6回目でPushを崩せる）

## Q16. Push対Pushの同一性

- Tsuppariが無いtickでは、`dv` の計算式も、加える順序も、今と同じ（Tsuppariの項は、`netStrike !== 0` のときだけ加える。0を足す処理も行わない）。`net === 0` かつTsuppariが無いときは、今と同じく何もしない（clampも呼ばない）
- 試作で、同じ `PUSH_EXTERNAL_ACCELERATION` のまま、現在のsourceのcopyと、Pushだけの3つのscenario（片方だけPush、同時Push、歩いて接触してからPush）を比べた。150 tickのpositionとexternal velocityの差は、**0（bit単位で一致）**
- Implementationでは、既存の `BoutPush.test.ts` をそのまま通し、さらに「Tsuppariを入れた後も、Pushだけのtickの結果が今と同じ式になる」ことを確かめる

## Q17 / Q18. Buildupと、6回目の命中

```
命中したとき（whiffとCounterで捕えられた場合は、何もしない）:
  if (attacker.tsuppariBuildup >= TSUPPARI_KUZUSHI_BUILDUP) { 6回目の命中: 普通のimpulse + 受け手をKuzushi; buildup = 0 }
  else { 普通の命中: 普通のimpulse; buildup += 1 }
```

- 初期値0。命中1〜5回目は普通。6回目は普通のimpulseとKuzushi（`enterKuzushi`、`KUZUSHI_TICKS`）。その後0に戻り、次の周期が始まる
- whiffは、増やしもせず、0にも戻さない（5回命中 → whiff → 次の命中は、やはり6回目でKuzushi）
- Kuzushiは、そのtickのimpulseの**後**に入れる（受け手の、そのtickのPush / Tsuppariの寄与は、すでに計算済み）。受け手のactionは、`enterKuzushi` で消える
- すでにKuzushiの受け手への6回目の命中では、`enterKuzushi` がtimerを30に戻す
- 試作の実測: `t6: 0→1`、`t39: 1→2`、… `t135: 4→5`、`t167: 5→0`（受け手がKuzushi）、`t214: 0→1`
- 所有: 定数（`TSUPPARI_IMPULSE`、`TSUPPARI_KUZUSHI_BUILDUP`）+ 参加者ごとの `tsuppariBuildup`（Bout runtime）。どちらの定数も、読むのはSimulation内の1か所だけにする。将来、参加者ごとのパラメータが必要になったら、既存の入力境界 `ParticipantSetup` に任意のfieldを足し、constructorで `MutableParticipant` へcopyすればよい（今は作らない。能力値の枠組みも作らない）

## Q19 / Q20. Counter対Tsuppari

`resolveCounter(contact)` を、FREEのtickで毎回呼ぶ（今は接触時だけ）。各組（defender, attacker）について:

- defenderのCounter windowが開いていて、**attackerのTsuppariが命中tick（active、strike pending）で、reachの内側**なら、捕える:
  - `enterKuzushi(attacker)`。**その場で**（位置も速度も変えない。既存の勢いはそのまま減衰する）
  - 横 / 後ろへの移動なし、CounterTransitionなし、overshootなし、tierの計算なし
  - Tsuppariは当たらない（impulseなし、buildupは変えない）
  - Kuzushiの長さは `KUZUSHI_TICKS`（30）。Push Counterと同じ
- それ以外のPushの分岐は、今のまま（「接触中」の条件は、Pushの分岐の中で確かめる）
- 1人のattackerは、PushかTsuppariのどちらか1つしか持たないので、2つの分岐の順序は結果に影響しない

Counter tier: **Tsuppariには意味を持たせない（計算しない）**。tierの役割は、移動先とCounterTransitionの選択だけで、Tsuppariにはどちらも無いため。`CounterTier` の型は変えない。

Counterの使用者の、捕えた後の状態: 捕えたtickにidle / stableへ戻る。位置と速度は変えない。次のtickから操作できる（例: Gripを押すと、Kuzushiの相手に対してMorozashiになる。既存のCounter → Grip → Morozashiの流れ）。

| 状況 | 結果 |
|---|---|
| Counter window中に、左手のTsuppariが命中tickにreach内 | 攻撃側がその場でKuzushi、Counterの使用者はidle |
| 同上、右手 | 同上（手は関係ない） |
| Counter window中に、命中tickがreach外（whiff） | 捕えない。windowは続く（そのまま切れればFailで、使用者がKuzushi） |
| 命中tickにwindowが開いていない | 普通の命中（Counterの使用者にも当たる）。window中の普通の命中では、windowは続く。6回目の命中なら、Kuzushiでwindowが消える |
| 命中tickと同じtickにCounterを押した | Push Counterと同じく捕える（開始はtickの先頭、判定はその後） |
| 試作の実測 | 攻撃側がKuzushi、位置は−0.400のまま。Counterの使用者はidle、0.400のまま。buildupは0のまま。transition none |

## Q21. 他の状態でのTsuppari

すべて、既存の開始条件（FREE、release tickでない、idle、stable）で決まる。入力は捨てる（queueしない。cooldownは変えない）:

| 状態 | 扱い |
|---|---|
| 組み中 | 開始しない（組み中にTsuppariは無い） |
| release tick | 開始しない（他のFREE用edgeと同じ） |
| CounterTransition中 | `step()` がintentを読まないので開始しない。cooldownは減る |
| Kuzushi | 開始しない |
| 他のaction中（Push / Counter / Grip / 自分のTsuppariのrecoveryを含む） | 開始しない |
| 勝敗が決まった後 | `step()` が何もしない |

- 進行中のTsuppariが、組みに入ることは起きない: Gripの対象はaction idleでなければならず、Tsuppariの使用者自身はGripできない。`enterGrapple` も、両者のactionをidleにする
- 受け手の状態は問わない（Grip reach中、Counter window中、Push中、Kuzushi中でも当たる。Counterの扱いはQ19）

## Q22. Ring-out

- Tsuppariのimpulseは、受け手のexternal velocityに入るだけ。次のtickからの積分と、毎tickの `resolveArenaRingOut`（Tokudawaraを含む、中心基準、先に出た方の負け、同時ならRematch）が、そのまま決める。新しい規則は無い
- 試作の実測（半径2.275 m。Aが土俵の内側から、Bを外へ叩く）: Bが1.9 m → 2.166 m（in）、2.0 m → 2.266 m（in）、2.1 m → ring-out（Aの勝ち）
- 土俵際で互いにTsuppariを当てた場合: 両者にimpulseが入り、既存の判定が先後 / 同時を決める

# Force Interaction Matrix

n = A→B。P·dt = 0.4375 m/s/tick（提案値）。J = 2.13 m/s。

| A ＼ B | idle / Counter / Grip / Kuzushi | Pushがactive（接触中） | Tsuppariの命中tick |
|---|---|---|---|
| **idle / その他** | なし | 組: 2人に `−P·s·dt`（今のまま） | Aだけに `−J` |
| **Pushがactive（接触中）** | 組: 2人に `+P·s·dt`（今のまま） | 組: net 0（今のまま。打ち消し合う） | 組: 2人に `+P·dt − J/2` |
| **Tsuppariの命中tick** | Bだけに `+J` | 組: 2人に `+J/2 − P·dt` | Aに `−J`、Bに `+J`（離れる） |

- Pushがactiveでも接触していない（近づいている途中、startup中）: 組のtickではないので、Tsuppariは受け手（Pushの使用者）だけに `J` で入る
- `s`（Kuzushiの受けやすさ）はPushの項だけ。組のtickでTsuppariが関わる場合、Pushの受け手はTsuppariの使用者でstableなので、常に `s = 1`

# State Ownership

| State | 正本 | 備考 |
|---|---|---|
| Tsuppariのaction（hand / phase / ticksRemaining / strike） | `MutableParticipant.action` | 既存のunionに1つ追加 |
| 手ごとのcooldown | `MutableParticipant.tsuppariCooldown` | Bout runtime。tickの先頭で減る |
| Kuzushiのbuildup | `MutableParticipant.tsuppariBuildup` | Bout runtime |
| 受けた勢い | 既存の `externalVelocity` | 新しい速度のStateは無い |
| Kuzushi | 既存の `posture`（`enterKuzushi`） | |
| ArrowLeft / ArrowRightのedge | `BoutScene` の `PressLatch` ×2 | presentation / inputだけ |
| poseの選択 | `wrestlerVisualState` → `WrestlerView` | Snapshotを読むだけ |

# Q23. Snapshotの追加

- `ParticipantState.action` に `tsuppari{hand, phase, ticksRemaining, strike}`（copy）
- `ParticipantState.tsuppariCooldown: { readonly left: number; readonly right: number }`（copy）
- `ParticipantState.tsuppariBuildup: number`
- topレベルの追加は無い（Tsuppariには、組の状態が無いため）

# Q24. WrestlerVisualStateの追加

- `WrestlerVisualPose` に `'tsuppari'`
- `tsuppariHand: TsuppariHand | null`、`tsuppariPhase: TsuppariPhase | null`、`phaseProgress`（他のphaseと同じ計算。`TSUPPARI_*_TICKS` を読む）
- 優先順は今と同じ: kuzushi > FREEのaction（push / **tsuppari** / counter / grip）> …
- 推奨: Tsuppariの**action全体**（startup + active + recovery = 16 tick）で、一枚のposeを表示する。startup中にposeが見えるので、相手がCounterで反応する手がかりになる。activeだけに表示する案と比べるのは、User Play Testで行う
- 判断はすべて、Snapshotの `action` から行う（アニメーションが命中を決めることはない）

# Q25. BoutSceneの入力 / latchの変更

- `tsuppariLeftLatch` / `tsuppariRightLatch`（`PressLatch`）を追加する。`KeyCodes.LEFT` / `KeyCodes.RIGHT` の `down`（auto-repeatなし）で `press()` する
- 他のlatchと同じく、frameの最初のtickだけで消費し、`clearPressLatches()`（restart / 開始時）でclearする
- `collectIntents` に2つのfieldを渡す
- debug表示（key 0の時だけ）: phase textに `TSU L` / `TSU R`（startup / active）、`TSU REC`。User Play Testで6回目の規則を確かめやすくするため、各参加者のcooldownとbuildupを短く表示する（例: `TSU L 0.4s R ready  3/5`）
- help文に `Left/Right tsuppari` と、dummyのmode 3を加える
- Sceneには式を置かない（reach / 力 / 命中は、すべてSimulation）

# Q26. Dummy / Test harness

- `PushDummyController`（CPU AIではない）に、mode `'tsuppari'`（key 3）を追加する: harness専用の距離（例 `DUMMY_TSUPPARI_RANGE` = 0.85 m。Simulationのreachより内側）まで近づく。idleかつstableで、Snapshotの `tsuppariCooldown` で使える手があれば、その手のedgeを出す（左が使えれば左、だめなら右）
- 既存の `NO_INPUT` / `GRAPPLED_DRIVE` に、新しいfieldを入れる
- `stationary` / `push` modeは変えない
- これで、ブラウザ上で「PlayerのPush × dummyのTsuppari」と「PlayerのCounter × dummyのTsuppari」を確かめられる。逆向きは、Simulationが対称なので、unit testで確かめる

# Q27. Artのasset path / metadataの方針（実装しない）

- runtimeのasset: `public/assets/action/wrestler/{red,blue}_tsuppari_{left,right}.png`
- metadata: `productWrestlerArt.ts` を、art id × pose（`idle` / `tsuppariLeft` / `tsuppariRight`）にする。それぞれ `textureKey`、`assetPath`、`width`、`height`、`pivot`、`bodyCoreDiameterPx` を持つ
- poseのspriteは、idleと同じpivot（参加者の中心）と、同じbody-coreの大きさ（2R）に正規化する。textureを切り替えても、体の位置と大きさが動かないようにする
- `WrestlerView`: poseが変わったときだけ `setTexture` + `setOrigin` + `setScale` を行う（剛体のまま。runtimeでの反転や塗り替えはしない）
- 書き出し: `runtime_wrestler_recipe.json` に `poses` を足す。red masterのposeのsource（ピクセルのSHA-256、前方向、root、body-core）と、blueの導出（同じ反射 + 同じ塗り替え）
- **重要: local-Yの反射は、力士の左右を入れ替える**。redの左手のposeを反射すると、blueの**右手**のposeになる。したがって `blue.tsuppariRight = recolor(reflect(red.tsuppariLeft))`、`blue.tsuppariLeft = recolor(reflect(red.tsuppariRight))`
- まわしのマスク（色相の帯 + 最大の連結成分）は、腕がまわしに重なるposeでも成り立つか、pose画像で改めて確かめる

# Art Visual Gate Plan（gameplay実装の後、または並行して行う別Task）

1. 正規化: Userの候補（git-ignoreの `input.local`。Repositoryには取り込まない）のposeごとに、root / body-core / 前方向を注記し、idleと同じ1/4のProduct scaleに正規化する
2. 2つの案を、同じ条件で並べて比べる:
   - **A（左右を別に描く）**: red_left + red_right。blueは、手を入れ替えて導出する（上記）
   - **B（片手のmaster + 反射）**: red_leftだけ。red_right = reflect(red_left)。その結果、blue_left = recolor(red_left)（反射を2回）、blue_right = recolor(reflect(red_left))
3. 比べる画面: idle ↔ poseの切り替え（同じ位置で交互に表示）、相手が接触距離（0.70 m）にいる場合とreachの限界（0.875 m）にいる場合の向かい合わせ、8方向の回転、赤 / 青の両方
4. 見る点:
   - 非対称な細部（まわしの結び目、髷）が、idle → poseの切り替えで反対側へ飛ばないか。Bでは、red_rightのときに結び目の側がidleと逆になる
   - 掌が、reachの限界で相手の体に届いて見えるか
   - 前方向と大きさが一致しているか
   - まわしの塗り替えの縁
5. 出力は `*.local`（比較用の一枚の画像 + manifest）。Userが選ぶ → 選ばれた案でruntimeを書き出すTask → `TSUPPARI_HAND_REACH` を、正規化したposeの値で見直す（Q8の調整方法）

# Expected Changed Files（Implementation）

推奨する分け方: **07B = gameplay + input + debug表示**（このReportの設計。poseの画像は無く、idleのspriteとdebug labelで確かめる）→ **Art Visual Gate** → **poseのruntime統合**。

07B:

- `src/game/sumo/BoutTypes.ts`: Intentの2つのfield、`TsuppariHand` / `TsuppariPhase` / `TsuppariStrike`、action union、`ParticipantState` の2つのfield
- `src/game/sumo/BoutSimulation.ts`: 定数、`MutableAction` / `MutableParticipant`、開始の優先順、`effectiveMove`、cooldownのcountdown、`resolveCounter(contact)`、`resolvePush` → 力の解決（Push + Tsuppari）、6回目のKuzushi、`advanceAction`、`copyAction`、Snapshot。`PUSH_EXTERNAL_ACCELERATION` = 26.25
- `src/game/input/pushDummyController.ts`（+ test）: mode `'tsuppari'`、新しいfield
- `src/game/scenes/BoutScene.ts`: latch ×2、key、intent、debug label / readout、help、key 3
- `src/game/presentation/wrestlerVisualState.ts`（+ test）: `'tsuppari'` pose
- 新規Test: `src/game/sumo/BoutTsuppari.test.ts`（必要なら、勝負を `BoutTsuppariContest.test.ts` に分ける）
- 既存Testのintent helper（約13か所）: 新しいfieldの既定値
- `src/game/sumo/BoutCounterTransition.test.ts`: fixtureの位置だけを直す（下記）
- `docs/ARCHITECTURE.md`: Tsuppariの段落、Push定数、Intentの優先順、step順序

既存Testへの影響（scratchpadのcopyで、`PUSH_EXTERNAL_ACCELERATION` = 26.25 にして全Testを実行した。Repositoryは無変更）:

- 293件中290件がPASS、**3件がFAIL**。いずれも `BoutCounterTransition.test.ts`:
  - the Counter user can ring out mid-transition and loses immediately (no immunity)
  - every transition tick decides exactly what the shared resolver decides for both segments
  - a decided outcome freezes the deciding-tick state exactly (no completion warp)
- 原因: fixture `COUNTER_USER_OUT`（Success tierで捕える）は、捕えるまでのPushの押しに依存して位置を作っている。Pushが強くなると、Counterで捕える前に配置が変わり、`no Counter transition` になる
- 対処: Implementationで、fixtureの開始位置（`mid`）だけを置き直す。Testの意味（主張）は変えない。Counter / CounterTransitionの規則は変えない
- 他（Push / Ring-out / Tokudawara / Grip / Drive / Counterの位置）は、26.25でもPASS

# Boundary-Case Test Matrix（Implementationの必須Test）

| # | Case | 期待 |
|---|---|---|
| 1 | Left ready / Right ready、Leftを押す | Tsuppari left。L cd = 60、R cd = 0 |
| 2 | Left cd中 / Right ready、Leftを押す | 何も始まらない。edgeは捨てる。cdは変わらない |
| 3 | Left cd中 / Right ready、Rightを押す | Tsuppari right |
| 4 | Left ready / Right cd中、Rightを押す | 何も始まらない |
| 5 | 両方cd中 | 何も始まらない。Counter / Gripのedgeがあれば、そちらが始まる |
| 6 | Left + Right 同じtick（両方ready） | Left。Rightは捨てる（R cdは0のまま。queueしない） |
| 6b | Left（cd中）+ Right 同じtick | Right（Interpretive decision） |
| 7 | Push + Left 同じtick | Push。Lのcdは変わらない |
| 8 | Left + Counter 同じtick | Tsuppari left。Counterは捨てる |
| 9 | Left + Grip 同じtick | Tsuppari left |
| 10 | WASDを押しながらLeft | Tsuppari left。16 tickのあいだ実効move 0（制動）。その後WASDが戻る |
| 11 | Tsuppari whiff（中心距離 > reach） | impulseなし。buildupは変わらない。`strike: 'whiff'` |
| 12 | 普通の命中（接触 0.70 m、離れて 0.85 m） | 受け手だけ `J`。攻撃側の変位0。buildup +1 |
| 13 | reachの境界 | `reach − 1e-6` で命中、`reach + 1e-6` でwhiff |
| 14 | 5回目の普通の命中 | buildup 5。Kuzushiなし |
| 15 | 6回目の命中 | 普通のimpulse + 受け手がKuzushi（30）。buildup 0 |
| 16 | 5回命中 → whiff → 命中 | その命中が6回目（Kuzushi） |
| 17 | 新しいBout | cd 0 / 0、buildup 0 |
| 18 | CounterがLeftのTsuppariを捕える | 攻撃側がその場でKuzushi、位置と速度は変わらない、transitionなし、Counterの使用者はidle、buildupは変わらない |
| 19 | CounterがRightのTsuppariを捕える | 同上 |
| 20 | Counter window中のwhiff | 捕えない。windowは続き、切れればFail |
| 21 | Tsuppari同士、同じtick | 両方命中、両方buildup +1、両者がちょうど `J` ずつ離れる。参加者の順序を入れ替えても同じ |
| 22 | 6回目 × 普通、同じtick | 両方のimpulse。6回目を受けた側だけKuzushi |
| 23 | 6回目 × 6回目、同じtick | 両方のimpulse、両方Kuzushi、両方buildup 0 |
| 24 | Push対Tsuppari（同じtickに押す、active中に命中、startup中に命中） | 組の勝負（Pushの方向へ進むが、抵抗なしより短い）。startup中なら、Pushの使用者だけに `J` |
| 25 | 等しいPush対Push（変更後） | net 0。既存のPush Testがそのまま通る |
| 26 | 土俵際で、Tsuppariが受け手をring-outさせる | 次のtick以降に既存の判定で負け |
| 27 | 土俵際で、互いのTsuppariが同じtickに当たる | 既存の先後 / 同時（Rematch）の判定 |
| 28 | CounterTransition中に押す | 捨てる。cdは減り続ける |
| 29 | 組み中に押す | 捨てる |
| 30 | Kuzushi中に押す | 捨てる |
| 31 | 自分のTsuppari / Pushのrecovery中に押す | 捨てる（queueしない） |
| 32 | cooldownの時系列 | L受付 `t0` → `t0+59` で拒否、`t0+60` で受付。左右を同時に押し続けると `0 L, 16 R, 60 L, 76 R` |
| 33 | 代表変位（Provisional） | F1: Push 0.50〜0.57 m、Tsuppari 0.25〜0.285 m、比 1.8〜2.2。Tsuppariの攻撃側の変位は0 |
| 34 | 組のtickのTsuppari | 2人に `P·dt − J/2` が同じ量で入る |
| 35 | Snapshot | 新しいfieldはcopy。書き換えてもcanonical stateに影響しない |

# Browser / Runtime Smoke Plan

- `pnpm dev` + headless Chrome（CDP）。既知の問題: SwiftShaderでは、動いているspriteの三角形が崩れることがある（以前のTaskで確認済み。今回の変更とは無関係）
- 確かめる場面:
  - ArrowLeft / ArrowRight: Snapshotの `action` が `tsuppari`、手、phaseの変化
  - 接触 / 0.85 mでの命中: 受け手のexternalが約2.13 m/s。攻撃側は動かない
  - 1.0 m以上で押す: whiff
  - 同じframeに左右を押す → Left
  - 押し続ける → cooldownの時系列
  - 6回命中 → 6回目で相手がKUZUSHI（debug表示のbuildupで確認）
  - dummyのmode 3: dummyのTsuppariに、PlayerのPush（勝負）とCounter（その場でKuzushi）
  - Rでrestart → cd / buildupが0
  - consoleにerrorが無い
- art統合の後に限り: idle ↔ poseの切り替え、手の向き、色

# User Play Test Checklist

- Tsuppariの押しの感触（約0.27 m。一瞬で弾かれて、惰性で止まる）
- 新しいPushの感触（約0.53 m）と、ring-outまでにかかる押しの回数
- 左右を交互に使うと気持ちよいか。1.0秒のcooldownは長すぎ / 短すぎないか。両方を連打した場合
- reach 0.875 mで、命中とwhiffの違いが分かるか（poseが入った後は、掌が届いて見えるか）
- 6回目のKuzushiが分かるか（Product表示での合図が必要か）
- Push対Tsuppari: Pushが押し切って見えるか。命中tickの一瞬の戻りは気にならないか。startup中に先に当てるとPushが止まるのは妥当か
- CounterでTsuppariを捕える: 間に合うか（startup 6 tick + Counter window）。その場でのKuzushiと、続くGrip / Morozashi
- Tsuppari同士の打ち合い
- 土俵際
- poseを表示する期間（action全体 / activeだけ）

# Interpretive Decisions（Taskの範囲内で決めた。Reviewで確認してほしい）

1. 「Left wins」を、両方の手が使えるときの規則とした。左手がcooldown中なら、そのedgeは先に捨て、右手（または、より低い優先のCounter / Grip）が始まる
2. Counterで捕えられたTsuppariは、攻撃側のbuildupを変えない（増やさず、0にも戻さない）
3. Tsuppariは、`KUZUSHI_PUSH_SUSCEPTIBILITY` を使わない（6回目も、Kuzushiの受け手も、普通の押し）
4. 組のtickでは、Tsuppariのimpulseを半分（`TSUPPARI_COUPLED_SHARE` = 0.5）にする
5. 手のcooldownは、CounterTransition中も含めて、bout進行中は毎tick減る
6. poseの表示は、action全体を推奨する（User Play Testで決める）

# Design Deviations

Design Deviations: NONE

（Acceptedの決定はすべてそのまま。Pushのtimingは変えていない。active = 1 tickは、Taskが任せたtimingの設計の範囲。「Push Counterのtimingを参考にする」も、同じwindow（12 tick）、同じKuzushiの長さ、「actionがactiveの間に捕える」という同じ形で守られる。）

# Unexpected Scope

- `PUSH_EXTERNAL_ACCELERATION` を変えると、`BoutCounterTransition.test.ts` の3件のfixtureが位置を作れなくなる（上記）。Pushの変更はTaskの要求なので、ImplementationでTestのfixtureの位置だけを直す必要がある（規則の変更ではない）
- Intentに必須fieldを2つ足すため、各Test fileのintent helper（約13か所）と、dummy / Sceneのintent literalを機械的に直す必要がある
- reachの境界が、浮動小数で「ちょうど」にならない（Q8。Testは±1e-6で書く）
- 修正はしていない

# Unresolved Decisions

Blockingなものは無い。User Play Testで決めるもの: 上記のInterpretive Decisions 1〜6、すべての数値、Product表示での6回目の合図、Art案A / B。

# Verification

- Current Sourceを直接読んだ（上記のfile）
- 現在のPushの定数 / timing / clamp / decayを、sourceと実測の両方で確かめた
- scratchpadの試作（`C:\Users\Kazu\AppData\Local\Temp\claude\e--develop-CrazyGames-SumoSim\65456393-541d-4833-9a77-d0deac4a82e8\scratchpad\tsu\`。`proto_imp/` = 採用したimpulse案、`proto/` = 却下した8 tick案、`measure*.mjs` / `extra*.mjs` / `push.mjs`）で、このReportの数値を計測した。Repositoryには入れない。**Implementationの検証ではない**
- 関連Testを特定した（Push / Counter / CounterTransition / Ring-out / dummy / visual state）。Push = 26.25のときの既存Testへの影響を、scratchpadのcopyで調べた
- Production sourceの変更なし（`git status` は、このReportだけ）
- `git diff --check`: PASS

# User Play Test

Not Required（このTaskはInvestigation / Designだけ。Implementationの後で、上記のChecklistによるUser Play Testが必要）。

# Git Delivery

- 変更file: `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ
- commit: `docs(action): design tsuppari prototype`
- push先: `origin/develop`
