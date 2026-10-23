Task-ID: ACTION-13A-GRAPPLE-THROW-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: fe27c90e63fe384edfe556669f3eb92d32019b83
Agent-Start-Head: aacc6a83f8c6df5b7ae75c58281b863de2ecfa9f
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation / Design、Production変更なし）

組み中のThrow（投げ）のv1を、実装に入れられる粒度で1つにまとめた。

| 項目 | 推奨 |
|---|---|
| 入力 | 専用の`throwLeftPressed` / `throwRightPressed` edge |
| eligibility | 投げる本人がREADY（相手はTURNINGでもよい） |
| 投げの軌道 | 相手（投げられる側）を、投げる本人の周りにbondの半径のまま、自分の左 / 右へ回す（**Geometry B**）。両者のfacingも同じ角度だけ回す |
| 時間 | 短い、Simulationが持つThrow遷移。CounterTransitionと同じ型 |
| 投げの後の組み | 組んだまま。投げた本人に短いrecovery |
| KOの判定 | 投げた本人のpre-bout seedと投げの回数で決まる、参加者ごとのcounter型の乱数（**RNG B**）。`roll < chance` |
| 同時の投げ | 逆のworld方向 = 引き分け（rollなし、移動なし、両者recovery）。同じworld方向 = ペアごとその方向へずれる（rollなし）。後で`throwPower`の比較に置き換えられる |
| 新しい決着 | `reason: 'fall'`（原因は`throw`として持つ） |
| KOとring-out | 先にKOを判定する。KOなら即決着（動かさない）、外れたら投げの軌道を動かし、既存のring-outが毎tick判定する |
| 優先順位 | Release > Throw > Drive > WASD回転 |

- Current Sourceとの重大な食い違いは無い
- 作業を止めるUserの判断も無い。User Play Testで見る項目は最後の節に挙げた

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `fe27c90`（ancestor）、Handoff-Mode GITHUB
- `fe27c90..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `aacc6a8`
- このcommitは、AGENTS.md §13のInvestigation-only Report Commit Exceptionによる。変更は`CURRENT_COMPLETION_REPORT.md`だけ

# Current Source findings（前提1–14）

| # | 前提 | 根拠 | 判定 |
|---|---|---|---|
| 1 | ArrowLeft / Rightは、Tsuppariのpress latchに入る | `BoutScene.ts`: `KeyCodes.LEFT/RIGHT` → `tsuppariLeftLatch/RightLatch.press()`。tickの先頭で`consume()`して`tsuppariLeftPressed/RightPressed`になる（最初のtickだけ、`NO_EDGES`） | 一致 |
| 2 | TsuppariはFREEでだけ始まる | `step()`: `if (!grappled && !released && p.action.kind === 'idle' && p.posture.kind === 'stable')`の中の`startTsuppari` | 一致 |
| 3 | GRAPPLEDでは、Tsuppariのedgeを無視 | 同上の条件で落ちる（queueしない）。手のcooldownは、組み中も減る（`advanceTsuppariCooldown`） | 一致 |
| 4 | GRAPPLEDではArrowUpの押しっぱなし = Drive | `driveHeld: this.upKey?.isDown`。`p.action = driveHeld && ready(p) ? drive : idle` | 一致 |
| 5 | Driveはtimerを持たず、毎tick決め直す | `BoutTypes`: `{ kind: 'drive' } // timerless; re-decided every tick` | 一致 |
| 6 | Releaseは`gripPressed` + READY | `releasers = … gripPressed === true && ready(p)` | 一致 |
| 7 | WASDの回転は、両者READYで | `if (grappled && ready(a) && ready(b))`（ACTION-12B） | 一致 |
| 8 | canonicalな位置 / facingは`BoutSimulation`にだけある | `participants`（mutable）。Snapshotはcopy | 一致 |
| 9 | bond = 0.70 m | `resolveGrappleBond()`、`BODY_RADIUS = 0.35` | 一致 |
| 10 | neutral / Morozashiは、pair-levelの`engagement`にだけある | `BoutEngagement.grappled.advantage` | 一致 |
| 11 | `BoutOutcome`の勝ち理由はring-outだけ | `BoutFinishReason = 'ring-out'`（「future finishes can be added」）、rematchは`'simultaneous-ring-out'` | 一致 |
| 12 | ring-outは、全部の位置変化の後に、tick開始と最終の位置から判定 | `resolveRingOutFrom(previousA, previousB)` → `resolveArenaRingOut` | 一致 |
| 13 | RNG / bout seed / Throwのparameterは、productionに無い | `src`に`Math.random` / seed無し（test除く）。`BoutSetup`はarenaと位置だけ | 一致 |
| 14 | 結果表示は、既存の理由だけを整形している | `boutHudPresentation.formatOutcome`は、`win`なら`reason`を見ずに`copy.formatWin(side, name)`、`rematch`なら`copy.rematch` | 実質一致（注） |

注（#14）:

- 現在の結果表示は、ring-outかどうかを区別していない（理由を読まない）
- `'fall'`を足してもそのまま「X wins」が出て、壊れない
- fallとring-outを区別して見せるには、13Bか13Cで`reason`を読む整形を足す（BC34）

Tsuppariの`left / right`は「力士自身の手」（`TsuppariHand`）。Throwの「自分の左 / 右」とも整合する。

既存のtest（実行）:

- Grip / Drive / Orientation / GrappleRotation / RingOut / Tsuppari / HUD presentation
- 7 files、145 PASS

# Part 1 — 自分の左 / 右とworldの向き

座標は+x右、+y下。READYのfacingは、相手へのatan2の方向。`f = (cos φ, sin φ)`のとき:

```
ownLeft  = ( f.y, -f.x)    // facing rotated by -90 deg (counter-clockwise on screen)
ownRight = (-f.y,  f.x)    // facing rotated by +90 deg (clockwise on screen) = ACTION-12B's + tangent sense
```

| facing | ownLeft | ownRight |
|---|---|---|
| 右（φ = 0） | (0, −1) 上 | (0, +1) 下 |
| 下（φ = +π/2） | (+1, 0) 右 | (−1, 0) 左 |
| 左（φ = π） | (0, +1) 下 | (0, −1) 上 |
| 上（φ = −π/2） | (−1, 0) 左 | (+1, 0) 右 |
| 右下（φ = +π/4） | (0.707, −0.707) | (−0.707, 0.707) |
| 30° | (0.5, −0.866) | (−0.5, 0.866) |

- 正しさの確認:
  - 画面のy軸は下向きなので、東を向いた力士の右手側は南（+y）
  - `ownRight = facing + 90°`は、ACTION-12Bの「+の角度 = 時計回り」、Kuzushiの汗の「+lateral = 力士の右」と同じ規約
  - scratchで、上下左右と斜めについて確認した
- 向きは、Throwのtickのcanonicalなfacingから毎回計算する。cacheしない（Part 15）

# Part 2 — 入力の持ち主

| | **Option I: 専用のThrow edge（推奨）** | Option II: Tsuppariのedgeを組み中に流用 | Option III: 汎用の左右action edge |
|---|---|---|---|
| 明確さ | `throwLeftPressed / throwRightPressed`。意味が型で読める | 組み中に`tsuppariLeftPressed`が「投げ」を意味する（名前と意味がずれる） | 「文脈で意味が変わるedge」という抽象が増える |
| edgeの重複 | Sceneは、同じArrowの押下を両方のfieldに入れる（同じlatchを1回consumeした値を、2つに書く）。Simulationは状態に合うほうだけを使う | 無し | 無し |
| queue / drop | どちらのfieldもedge。合わないほうはそのtickに捨てる（queueしない） | 同じ | 同じ |
| 将来のtouch / gamepad | 「投げボタン」を別に割り当てられる（Tsuppariと同じkeyである必要が無い） | Tsuppariとkeyが結合したまま | 汎用化が早すぎる |
| test | `throwLeft`と書ける | Tsuppariのtestと区別しにくい | — |
| scope | `ParticipantIntent`に2 field、Sceneで2行、dummyの`NO_INPUT`に2 field | 最小だが意味が混ざる | 型の改名で影響が広い |

推奨はOption I。

- raw keyはSimulationに入れない
- 1つの物理keyが状態で別のgameplayになるのは、Scene側の割り当ての問題として明示的に持つ
- FREEではThrow edgeを無視（Tsuppariが使う）、GRAPPLEDではTsuppari edgeを無視（既存）。二重に発動することは無い

# Part 3 / 16 / 17 — eligibilityと、同じtickの優先順位

Throwを始めてよいのは、次をすべて満たす参加者だけ（tick開始の状態で判定）:

1. このtickの開始時点で`engagement.kind === 'grappled'`で、このtickにreleaseが起きていない
2. `ready(p)`（既存の`canActInGrapple`、tick開始のsnapshot。Release / Driveと同じ）。相手のREADY / TURNINGは問わない
3. tick開始のactionが`drive`でない
   - 「Drive中は投げられない」。前のtickでDriveしていれば、そのtickのThrow edgeは捨てる
4. tick開始のactionが`throw`のrecoveryでない
5. `throwLeftPressed` XOR `throwRightPressed`
   - 両方そろったら両方を捨てる（S4）

同じtickの優先順位: **Release > Throw > Drive > WASD回転**

| 状況 | 結果 |
|---|---|
| Release（Shift）+ Throw edge | Releaseが勝つ（既存の順序で先に処理）。Throw edgeは捨てる。rollは使わない |
| ArrowUpを前のtickから押している + Throw edge | 投げられない（tick開始のactionがdrive）。edgeは捨て、Driveを続ける |
| ArrowUpとThrow edgeが同じtickに始まる | Throwが勝つ（前のtickはDriveしていなかったので「Drive中」ではない）。そのtickはDriveに寄与しない |
| 相手がDrive中、投げる本人はDriveしていない | 投げられる（制限は本人だけ）。Throw遷移が始まると、両者の入力は遷移の間は無視されるので、相手のDriveも止まる |
| 両者がDrive中 + 両者のThrow edge | どちらも投げられない（両者のedgeを捨てる）。Driveが続く |
| Throw + WASDが同じtick | Throwが始まったtickは、遷移が位置を持つので、手動回転はしない。向きはtick開始のfacingで決める |
| Throwのrecovery中 | Throw / Driveはできない。Release、WASD回転（両者READYの規則）は使える |
| Tsuppari（FREE） | 不変。Throw edgeはFREEでは無視 |

「本人だけがDriveしていないこと」を推奨する理由:

- Userの「Drive中に投げられない」は、本人の状態の話
- 相手がDriveで押してくる中で投げ返すのは、駆け引きとして自然
- 両者を条件にすると、押されている側が何もできない

# Part 4 — TURNING

| | Candidate A: 投げる本人がREADYのときだけ（**v1で推奨**） | Candidate B: TURNING中でも投げられる |
|---|---|---|
| 自分の左右の意味 | facingが相手を向いている（15°以内）ので、左右は「相手に対して左右」で曖昧さが無い | facingが相手を向いていない（例えば背後から組まれて90°以上ずれている）。左右をfacingから取るか、pairの軸から取るかで結果が変わる |
| 投げの軌道 | 相手は本人の前にいるので、「相手を自分の周りに回す」がそのまま成立する | 相手が横や後ろにいると、「左へ投げる」が相手を後ろへ回すことになりうる |
| ACTION-05B1との関係 | `canActInGrapple`を再利用。自動の向き直りは不変 | 投げが向き直りを中断するか、継続するかの規則が要る |
| 実装量 | 小さい | 向きの規則、中断の規則、test |

推奨はCandidate A（本人がREADYのときだけ）。READY / TURNINGは、Release / Driveと同じく参加者ごとの判定にする（ACTION-12Bの回転だけが「両者READY」）。

- このためv1でも、TURNINGのペアの「READYな側」は投げられる
  - 背後から組んだ側（Counter Best → Morozashi holder）は、相手がTURNINGの間も投げられる
  - Userの「TURNINGでも投げたい」の一部はここで満たされる
- TURNING中の本人の投げ（Candidate B）は、後で別Taskにする
- Play Testで見る点: 背後からのMorozashiの投げが強すぎないか
  - 強すぎるなら、「両者READY」を条件にする（ACTION-12Bと同じ`ready(a) && ready(b)`）のが最小の調整。v1の実装で、この切り替えを1行にしておく

# Part 5 — 投げの軌道（non-KO）

| | Geometry A: 相手だけを横へ平行移動 → bondで補正 | **Geometry B: 相手を投げる本人の周りに回す（推奨）** | Geometry C: ペアごと横へ（相手のほうが大きく） |
|---|---|---|---|
| bond | 平行移動で距離が崩れる。bondの補正で、投げた本人も勝手に引きずられる | 半径0.70 mの円の上を動くので、距離は厳密に保たれる | 2人の移動量が違えば、補正が要る |
| 「自分の左へ投げる」読み | 補正で向きがずれる | 本人の左右へ、本人の周りを回る。読みが明快 | ペアの平行移動に見え、Driveとの区別が弱い |
| 中点 | 補正次第 | 相手の移動の半分だけ動く（中点の移動 = 弦 / 2） | 動く |
| facing | 補正後に向き直りが要る | 両者のfacingを同じ角度だけ回せば、facing errorが変わらない（ACTION-12Bと同じ考え）。READY / TURNINGを保つ | 同じ |
| 組みの維持 | 可 | 自然に維持 | 可 |
| ring-out | 補正のせいで出る / 出ないが分かりにくい | 相手が円弧の上を通る。毎tick判定（Part 18） | 平行移動で判定 |

推奨（v1）:

1. 1人のnon-KO Throw = Geometry B
   - 本人は動かない。相手は本人の周りを、自分の左なら負の角度（画面上で反時計回り）、右なら正の角度で、`throwAngle`だけ回る
   - 両者のfacingも、各tickの回転量だけ回して正規化する
2. 同じworld方向の同時Throw（引き分けの「両方が動く」）: ペアの剛体平行移動
   - 両者を、共有のworld方向`d`（2人の要求方向の平均を正規化）へ`THROW_SHARED_SHIFT`だけ動かす
   - bondと、両者のfacingは不変
   - これは「誰も投げていない」状態なので、平行移動で表すのが正しい

物理エンジンは使わない。決まった経路だけ。

# Part 6 — 一瞬で解決するか、遷移にするか

| | 一瞬（1 tick） | **短い遷移（推奨）** |
|---|---|---|
| 実装量 | 最小 | CounterTransitionの型をそのまま使う（中くらい） |
| 見た目 | 1 tickで弦0.54 m（neutral 45°）〜0.85 m（Morozashi 75°）を飛ぶ。33〜55 m/s相当で、Play Testで手触りを判断できない | 18 tick（0.3 s）で1.8〜3.1 m/s。目で追える |
| ring-outの正しさ | 1 tickのprevious → finalの直線（弦）で判定するので、円弧が膨らむ分（75°で0.145 m。Tokudawaraの深さ0.119 mより大きい）、外に出たのを見逃しうる | 1 tickの弦の膨らみは0.17〜0.46 mmで、毎tick判定。円弧に十分近い |
| presentation | 補間の材料が無い | canonicalな位置そのものが動く。後で見た目を足せる |

推奨: 短い遷移を、13BのSimulationに入れる。

- Core（ring-outの正しさ）と、Play Testのために必要
- 本格的なアニメーション（投げのpose、倒れる動き）は13Cに回す

遷移のmodel（CounterTransitionと同じ考え）:

- pair-levelの`throwTransition`をSimulationが持つ
- 遷移中は、両者の入力を無視する（edgeは捨てる。queueしない）
- 位置とfacingの唯一の持ち主は経路
- 毎tick: facing → ring-out
- 最後のtickで、終点に厳密に合わせる
- 速度は、CounterTransitionと同じく経路の変位を報告する（投げられた側 = external、本人 = 0）。最後に両者を0にする
- 緩急: 角度 = `total × easeOut(u)`、`easeOut(u) = 1 − (1 − u)²`（暫定。速く入って、ゆっくり止まる）

# Part 7 — non-KOの後の組み

推奨はA: 組んだまま。

- Geometry Bでbondが厳密に保たれ、両者のfacingも一緒に回すので、READY / TURNINGの状態は投げの前と同じ
- 次のtickから、WASDの回転 / Drive / Release / （recoveryの後で）Throwを、その新しい配置から選べる
- 連打の対策: 投げた本人にrecovery（Part 8）。遷移 + recoveryの間は再び投げられない
  - これが無いと、0.3 sごとにKOの判定ができてしまい、例えば15%の6回連続で約62%の勝ちになる

# Part 8 — Throwのaction state / recovery

必要。最小の形は次のとおり。

```
BoutThrowTransition (pair-level, Snapshot):
  | { kind: 'none' }
  | { kind: 'active', mode: 'throw', throwerId, targetId, side: 'left' | 'right', ticksRemaining, totalTicks }
  | { kind: 'active', mode: 'shift', direction: Vec2, ticksRemaining, totalTicks }     // same-direction tie

ParticipantActionState += { kind: 'throw', side: 'left' | 'right', phase: 'recovery', ticksRemaining }  // thrower after the motion
```

- 動きはpair-levelの遷移に置く。参加者の`throw`のactionは、遷移の後のrecoveryだけを表す
- 入力のlock:
  - 遷移の間は、両者の入力をすべて無視
  - recoveryの間は、本人のThrow / Driveだけを禁止
    - Driveの判断が、recovery中の`throw`のactionを`idle`で上書きしないようにする（1つの例外）
- KO / 移動の解決のtiming:
  - Throwを始めたtickで、rollを1回引く
  - KOなら、そのtickで即決着（位置は動かさない）
  - non-KOなら、そのtickから遷移を始め、最初の遷移stepも同じtickに実行する（何もしないtickを作らない）
- recoveryの後も、組んだまま
- 引き分け（S1）: 両者とも`throw`のrecoveryに入る（両方が「仕掛けた」代償を払う）

# Part 9 — 試合前に決めたThrow能力の受け取り口

推奨はProfile A（すべて試合前に計算済みの値）。Simulationは、Managementのparameterを知らない。

```ts
// BoutTypes.ts (future)
interface ThrowProfile {
  readonly neutralKoChance: number        // [0, 1]; also used by a Morozashi-disadvantaged thrower
  readonly morozashiKoChance: number      // [0, 1]; when the thrower holds Morozashi
  readonly neutralThrowAngle: number      // rad, non-KO orbit of the target around the thrower
  readonly morozashiThrowAngle: number    // rad
  readonly koRollSeed: number             // uint32; this participant's own deterministic KO roll stream
}
interface ParticipantSetup { id; position; throw?: ThrowProfile }   // absent -> PROTOTYPE_THROW_PROFILE (+ a fixed seed)
```

- Profile Bを選ばない理由:
  - Morozashiの倍率をcoreに持つと、それが恒久的なbalanceの式になる
  - 「試合前に計算する」というUserの要求とも合わない
- 移動量は、角度で持つ（bondの円の上で動くので、角度が自然な単位）。表示用の横方向の距離は、`0.70 × sin(angle)`で導ける
- 将来の`throwPower`（同じ方向の同時Throw）:
  - v1の型には入れない（早すぎる）
  - 判定は1つの純関数`resolveSameDirectionThrow(powerA?, powerB?)`にしておく
  - v1は常に「同じ」（未定義）を返す → 両者が動く
  - 後で`throwPower?: number`をProfileに足し、大きいほうが通常の投げ（rollを引く）、同じなら両者が動く、にする。他は変えない（BC25）
- Managementは実装しない。`BoutScene`のPROTOTYPEの組み立てが、prototypeの値と固定のseedを渡すだけ

# Part 10 — 暫定の値（すべてUser Play Test対象、確定値ではない）

| 値 | 推奨（暫定） | 根拠 |
|---|---|---|
| neutralKoChance | 0.15（範囲0.10–0.20） | 組めば誰でも使えるので低め。recoveryと合わせて、連打で決まらない |
| morozashiKoChance | 0.35（範囲0.30–0.45） | 「KOしやすくなる」がはっきり体感できる差 |
| neutralThrowAngle | 45°（範囲35–55°） | 弧0.55 m、横0.50 m、中点の移動0.27 m。中央からでは出ず、縁の近くでは出せる（土俵の半径2.275 m） |
| morozashiThrowAngle | 75°（範囲60–90°） | 弧0.92 m、横0.68 m、中点の移動0.43 m。「大きく投げられる」がはっきりする |
| THROW_TRANSITION_TICKS | 18（0.3 s） | 1.8–3.1 m/s。Drive 0.6 m/s、手動回転0.55 m/sよりはっきり速く、FREEの最大3 m/s程度。1 tickの弦の膨らみはmm以下 |
| THROW_RECOVERY_TICKS | 30（0.5 s） | 連打の防止。相手がDrive / 回転 / 投げ返しで応じる時間 |
| THROW_SHARED_SHIFT（同じ方向の引き分け） | 0.30 m | neutralの中点の移動（0.27 m）と同程度。「2人ともそちらへ流れる」 |
| easeOut | `1 − (1 − u)²` | 速く入り、ゆっくり止まる |
| prototypeのseed | 例: wrestler-a = 0x5A17、wrestler-b = 0xB0B1（任意の固定値） | testで差し替えられる |

# Part 11 — 決定的なKOの判定

| | RNG A: coreが1本のPRNGを持つ | **RNG B: 参加者ごとのcounter型の乱数（推奨）** | RNG C: 結果の列を事前に渡す |
|---|---|---|---|
| replay | 同じseedと入力なら同じ | 同じ | 同じ |
| 同時Throw / 並び順 | 1 tickで2回引くと、引く順番が並び順に依存する | 参加者ごとの列なので、順番に依存しない | 列の割り当て次第 |
| 他の乱数との干渉 | 将来の別の乱数が同じ列を使うと、投げの結果が変わる | 投げ専用の、参加者ごとの列 | 投げ専用 |
| 保存するstate | PRNGのstate | 参加者ごとの「KO判定をした回数」（整数）だけ | 列の位置 |
| 長さ | 長い周期 | 2^32 | 有限。20個のloopは周期が見える |
| test | seedを探す | seedを探すか、chance 0 / 1 | 最も簡単 |

推奨はRNG B: `roll_k = fmix32((seed + 0x9E3779B9 · (k + 1)) mod 2^32) / 2^32`（murmur3のfmix32、[0, 1)）。

- `k`は、その参加者のKO判定の回数（Simulationが持つ整数。0から）
- KOは`roll < chance`
  - `chance = 0`なら、rollは0以上なので決して成立しない
  - `chance = 1`なら、rollは1未満なので必ず成立する
  - `chance`は、setupの検証で[0, 1]の有限値に限る
- scratchで確認:
  - 最初の20個はすべて異なる
  - replayは同一
  - 200,000回で、P(u < 0.15) = 0.1498、P(u < 0.35) = 0.3506、十分位はすべて0.099–0.101
  - u < 0は0回、u ≥ 1も無い
- rollを使う規則（BC14）:
  - 1人の投げ（S3）を実際に解決したときだけ、その本人の`k`を1つ進める
  - 引き分け（S1）、同じ方向（S2）、捨てたedge、Drive中、TURNING中、Release、遷移中、FREEでは進めない
- Snapshotの扱い:
  - 13B: 参加者の`throwRolls`（回数）を公開する必要は無い（presentationは使わない）
  - 将来の保存 / replayでは、seedと回数の2つで復元できる
- Math.randomは使わない。seedは`BoutSetup`の外（Managementか、試合の組み立て）が決める

# Part 12 — 同時のThrow（1つのtick-localな状態から解決）

1. 各参加者のeligibility（Part 3）
2. edge → worldの向き`d_A` / `d_B`（Part 1）
3. 分類する（並び順に依存しない。`dot(d_A, d_B)`の符号だけ）

両者がREADYなら、2つの向きはほぼ平行か反平行（facingの許容15°ずつでも、|dot| ≥ cos 30° = 0.866）。

| case | 規則 |
|---|---|
| S1: 逆のworld方向（dot < 0） | 引き分け。rollなし、移動なし、組んだまま。両者とも`throw`のrecoveryに入る（遷移は始めない） |
| S2: 同じworld方向（dot > 0） | `resolveSameDirectionThrow(powerA, powerB)`。v1は常に同等 → 両者が動く。pairの平行移動の遷移（`mode: 'shift'`、`d = normalize(d_A + d_B)`、`THROW_SHARED_SHIFT`）。rollなし。遷移の後、両者が`throw`のrecovery |
| S3: 片方だけが投げる | 通常の投げ（rollを1回。KO / non-KO） |
| S4: 1人が同じtickにLeftとRightの両方 | 両方を捨てる（その人は投げなかったものとして扱う）。もう片方が投げていればS3 |

- 将来の`throwPower`の差（BC25）: S2で強いほうがS3（通常の投げ）になる。同じならv1と同じ
- 「Draw」の解釈: 試合の引き分けではなく、そのaction同士の相殺とした
  - 試合のrematchは、既存の同時ring-outだけ
  - Current Sourceとの食い違いは無い

# Part 13 — KOの決着の形

推奨は、汎用の`'fall'`を理由にし、原因の技を別に持つこと。

```ts
type BoutFinishReason = 'ring-out' | 'fall'
type BoutOutcome =
  | …
  | { kind: 'win'; winnerId; loserId; reason: 'ring-out' }
  | { kind: 'win'; winnerId; loserId; reason: 'fall'; cause: { kind: 'throw'; throwerId; side: 'left' | 'right'; direction: Vec2 } }
```

- `'fall'`にする理由:
  - 将来、他の技（押し倒し、足取り）でも「倒れて負け」が起きる
  - 技の名前（throw）は`cause`に分ければ、理由の種類が増えすぎない
- 表示の文字列はSimulationに入れない（`copy`が持つ）
- KOのtickの扱い:
  - そのtickで`outcome`を確定し、step()の残りを行わない
  - 位置・facing・velocityはtick開始のまま。積分・回転・Driveも無し
  - engagementは`grappled`のままfrozen。勝敗が決まった後のstep()は何もしない（既存）
- presentationに必要なもの:
  - 倒れる向き = `cause.direction`（投げる本人の自分の左右のworld向き。KOのtickのfacingから計算）
  - 誰が誰を、は`winnerId / loserId / throwerId`で分かる
  - event busは作らない。`outcome`がそのまま「1回きりの結果」を持つ

# Part 14 — KOとring-outの優先順位

推奨: 先にrollを引く。

- KO → 即決着（`reason: 'fall'`）。non-KOの移動はしない
  - KOのtickは位置が動かないので、ring-outと同時に起きることは無い
- KOが外れた → non-KOの遷移を始める。遷移の各tickで、既存のring-outが判定する

縁の近くの同時Throw:

- S1: 移動しないので、ring-outは無い
- S2: pairの平行移動で両者が出ることがある。既存の規則（先に出たほうが負け、同時ならrematch）がそのまま判定する
- S3: 縁の近くで、投げられた側が弧を通って出る → 通常のring-out。投げた本人は動かない

# Part 15 — 投げの向きとWASDの回転

- 自分の左右は、Throwを始めたtickの開始時点のcanonicalなfacingから計算する
  - WASDで回したペアなら、その回転の後のfacing
  - 前の向きを持ち越すcacheは無い
- 遷移は、始まったときの方向（`side`と回転の符号）で決まった経路を進む（意図的なlock）
- 同じtickのThrowとWASD:
  - Throwの判断は、手動回転より前にある
  - Throwが始まれば、そのtickの手動回転は行わない
  - 向きは、tick開始のfacingを使う（BC19）
- WASDの回転（ACTION-12B）はそのまま。Throwの後の新しい配置から、また回せる

# Part 18 — Ring-out / Tokudawara

- Throw専用の境界は無い。壁・clamp・跳ね返りも無い
- 遷移の各tickは、そのtickの開始位置 → 終了位置で、既存の`resolveArenaRingOut`が判定する
  - 1 tickの移動は弧の小さな弦で、膨らみは最大0.46 mm
  - Tokudawaraの窓の出入りも、既存の`firstArenaExitFraction`がそのまま扱う
- 遷移のtickで決着したら、そのtickで止まる（CounterTransitionと同じ）

# Part 19 — Presentationとの境界（後の見た目のTask用）

Snapshotに足す最小のもの:

1. `throwTransition`（pair-level）:
   - `none`
   - `active { mode: 'throw', throwerId, targetId, side, ticksRemaining, totalTicks }`
   - `active { mode: 'shift', direction, ticksRemaining, totalTicks }`
   - 進み具合は`1 − ticksRemaining / totalTicks`
2. 参加者のaction `{ kind: 'throw', side, phase: 'recovery', ticksRemaining }`
3. `outcome`の`reason: 'fall'` + `cause`

- canonicalな位置 / facingは、そのまま経路を動く
- Sceneは画素やアニメーションから結果を推測しない
- `WrestlerVisualState`への写しは13C（pose: `throw`、`thrown`、`fallen`など）

# 将来の`step()`の順序（13B）

1. Tsuppariの手のcooldown
2. CounterTransition中 → そのstepで終了（既存）
3. **NEW: Throw遷移中 → `stepThrowTransition`で終了**
   - 入力は無視
   - 経路の位置とfacing
   - 速度の報告
   - ring-out
   - 最後のtickで終点に合わせ、velocityを0にし、本人（S2では両者）を`throw`のrecoveryへ
4. `previousA / previousB`
5. posture timer
6. tick開始のreadiness（`ready()`）
7. Release（既存）
8. `grappled`の確定
9. **NEW: Throwの判断（tick開始の状態から。Driveの判断より前なので、`p.action`はまだ前のtickのもの）**
   - 各参加者のeligibilityと向き → S1–S4の分類
   - S3:
     - `k`を進めてrollを引く
     - KOなら、`outcome = fall`にしてreturn（残りのstepは行わない）
     - non-KOなら、遷移を始め、最初の遷移stepを実行し、ring-outしてreturn
   - S2: shiftの遷移を始め、最初の遷移stepを実行し、ring-outしてreturn
   - S1: 両者を`throw`のrecoveryにして、このtickを続ける
10. Driveの判断（既存）。ただし、`throw`のrecovery中の参加者は`idle`で上書きしない（Driveに寄与しない）
11. WASDの手動回転（ACTION-12B、既存のまま）
12. 以降は既存どおり: self velocity → `updateGrappledExternal()` → 積分 → contact → bond → action timer（`throw`のrecoveryを減らす）→ facing → ring-out

Throw edgeが無い（または全部捨てられた）tickは、9 / 10の例外がどれも働かず、既存とbit単位で同一になる（BC35 / BC36）。

# 将来の変更fileの候補

| file | 内容 |
|---|---|
| `src/game/sumo/BoutTypes.ts` | `ParticipantIntent.throwLeftPressed / throwRightPressed`。`ThrowProfile`と`ParticipantSetup.throw?`。`ParticipantActionState`に`throw`のrecovery。`BoutThrowTransition`と`BoutSnapshot.throwTransition`。`BoutFinishReason`に`'fall'`、`outcome`に`cause` |
| `src/game/sumo/grappleThrow.ts`（新規、純関数） | `ownLateral(facing, side)`、`classifyThrowRequests`、`resolveSameDirectionThrow`、`throwKoRoll(seed, k)`（fmix32）、経路の点`throwOrbitPoint` / `throwShiftPoint` |
| `src/game/sumo/BoutSimulation.ts` | prototypeの値（Part 10）、setupの検証（chance ∈ [0, 1]）、参加者ごとのroll回数、step()の9 / 10の追加、`stepThrowTransition`、copy関数 |
| `src/game/scenes/BoutScene.ts` | Arrowのlatchを1回consumeした値を、Tsuppariと同じ値でThrowのfieldにも入れる。PROTOTYPEのsetupにprototypeのThrowProfileとseed。操作説明の文字列 |
| `src/game/input/pushDummyController.ts` | `NO_INPUT`にThrowのfield（false）だけ。dummyは投げない |
| `src/game/presentation/boutHudPresentation.ts` / `boutHudCopy.ts` | fallとring-outを区別した結果の文字列（必要なら。13Bの最小なら、文字列は1つ追加） |
| `src/game/sumo/BoutThrow*.test.ts`（新規） | 下のmatrix |
| `docs/ARCHITECTURE.md` | 組み中の操作（Arrow = 投げ）、Throw遷移、fall |

# 将来の境界case（38件）と検証の対応

すべて13Bの自動testで扱う（★ = browser smokeでも確認）。

| # | case | 検証 |
|---|---|---|
| 1 | neutral、READY、Left Throw | 相手が本人の左へ、負の角度で45°回る。bond 0.70。組んだまま。本人はrecovery（★） |
| 2 | neutral、READY、Right Throw | 正の角度（★） |
| 3 | WASDで90°回したペアのLeft / Right | 回した後のfacingの左右のworld向き（★） |
| 4 | Morozashiのholderの投げ | morozashiの値を使う（75°、0.35）（★） |
| 5 | Morozashiのdisadvantagedの投げ | neutralの値。READYなら投げられる |
| 6 | neutralでKOが成立 | `roll < chance`になる`k`のseedで、即`fall`。位置は不変 |
| 7 | neutralでKOが外れる | 遷移で移動 |
| 8 | MorozashiでKO確率が上がる | 同じseed / kでneutralは外れ、Morozashiは成立するrollの例。200k回の統計（純関数） |
| 9 | Morozashiでnon-KOの移動が増える | 75° > 45°、横0.68 m > 0.50 m |
| 10 | chance 0 | 何回投げてもKOしない |
| 11 | chance 1 | 1回目でKO |
| 12 | 決定的なreplay | 同じscriptを2回実行してSnapshotが一致（★） |
| 13 | 並び順の入れ替え | idごとに同じ結果、同じroll |
| 14 | 使われない / 不適格なedgeはrollを消費しない | Drive中、TURNING、Release、FREE、遷移中、S1 / S2、S4の後でも、`k`が進まない（次の正当な投げのrollが同じ） |
| 15 | Driveの開始とThrowが同じtick | Throwが勝つ |
| 16 | 既にDrive中 + Throw edge | 捨てる、Drive継続、rollなし |
| 17 | 相手がDrive中、本人が適格 | 投げられる |
| 18 | Release + Throwが同じtick | Release、rollなし |
| 19 | Throw + WASDが同じtick | 回転なし、tick開始のfacingの向き |
| 20 | TURNING（v1の規則） | TURNINGの本人は投げられない（edgeを捨てる）。READYな側は相手がTURNINGでも投げられる（背後のMorozashi）（★） |
| 21 | 逆のworld方向の同時Throw | 引き分け: 移動なし、rollなし、両者recovery（★） |
| 22 | 同じworld方向の同時Throw | 平行移動0.30 m、rollなし、両者recovery（★） |
| 23 | 1人がLeftとRightの両方 | 両方捨てる |
| 24 | 同じ方向で同等の強さ（v1） | 22と同じ |
| 25 | 将来の強さの差 | `resolveSameDirectionThrow`の純関数test（v1は常に同等） |
| 26 | 縁の近くのnon-KO → 通常のring-out | 遷移のtickで決着（★） |
| 27 | Tokudawaraの窓を通る | 窓の内 / 外で、決着の有無が既存の境界どおり |
| 28 | 縁の近くでKO | `fall`（位置不変、ring-outなし） |
| 29 | non-KOの後の組み | grappled、bond 0.70、READY / TURNINGが投げの前と同じ |
| 30 | すぐ投げ直す / recovery | 遷移 + recoveryの間は捨てる、rollなし |
| 31 | 上下左右の4つのfacing → 左右 | Part 1の表 |
| 32 | 斜め / 任意のfacing → 左右 | 同じ式 |
| 33 | Morozashiで、並び順を入れ替え | 同じ結果 |
| 34 | 結果表示がfallとring-outを区別できる | `reason`と`cause`のtest |
| 35 | Throw edgeが無いとき、ACTION-12Bの回転は不変 | 既存の`BoutGrappleRotation.test`がそのまま通る |
| 36 | Throw edgeが無いとき、Driveは不変 | 既存の`BoutDrive.test`がそのまま通る |
| 37 | FREEのTsuppari（Arrow）は不変 | 既存の`BoutTsuppari.test` + FREEではThrow edgeを無視 |
| 38 | ring-outだけの既存fixtureは不変 | 既存の`BoutRingOut` / `BoutTokudawara`がそのまま通る |

# 推奨のTask分割

ACTION-13B — Throw Core Gameplay（User Play Test必須）:

- 入力のfield、Sceneでの割り当て
- eligibility、同時のcontest、決定的なKO（RNG B）、`fall`の決着
- 経路の遷移（Simulationが持つ）、recovery、ring-out
- 暫定の値、test（38件）、browser smoke
- 最小の結果表示（fallとring-outの区別）
- 遷移はring-outの正しさとPlay Testに必要なので、13Bに含める

ACTION-13C — Throw / Fall Presentation（User Visual Gate）:

- 投げのpose、投げられる側の見た目、倒れる見た目、衝撃 / cameraの演出
- canonicalな遷移と`outcome.cause`だけを読む

KOの確率を別のTaskに分けない（13Bで、投げの中心の仮説を検証できなくなるため）。

# User Play Testで確かめる項目（BLOCKERではない）

1. 「READYな本人だけが投げられる」で十分か（TURNING中の本人の投げは後で）
   - 背後からのMorozashiの投げが強すぎないか。強すぎるなら、両者READYにするのが最小の切り替え
2. 同じworld方向の同時Throwで「2人とも流れる」が自然か
3. 暫定の値（Part 10）: KOの確率、投げの角度、遷移とrecoveryの長さ
4. 「Drive中は投げられない」の手触り（ArrowUpを離してから投げる）

# Design Deviations

Design Deviations: N/A（Investigation）

# Unexpected Scope

- 無し
- 参考（Current Sourceの状態）: `formatOutcome`は、今は決着の理由を読んでいない。fallを区別して表示するには、13Bか13Cで1か所の追加が要る

# Verification

- source inspection:
  - `AGENTS.md`、`docs/ARCHITECTURE.md`
  - `BoutTypes.ts`（intent、action、engagement、outcome、setup）
  - `BoutSimulation.ts`（`step`、Tsuppariの開始、Drive、release、回転、`updateFacing`、CounterTransition）
  - `grappleOrientation.ts`、`ringOut.ts`、`pressLatch.ts`、`movementVector.ts`、`pushDummyController.ts`
  - `BoutScene.ts`（latch、`ActionEdges`、setup）、`boutHudPresentation.ts` / `boutHudCopy.ts`
- 既存testの実行: Grip / Drive / Orientation / GrappleRotation / RingOut / Tsuppari / HUDで7 files、145 PASS
- scratch script（scratchpadの`throw13a.mjs`、commitしない）:
  - 左右の向き（上下左右、斜め）、ACTION-12Bの符号との一致
  - 同時の分類のdot
  - fmix32のroll（最初の20個、replay、200k回の一様性、0 / 1の境界）
  - 弧の長さ / 弦 / 横の移動 / 中点の移動 / tickごとの速度と膨らみ（1 / 12 / 18 / 24 tick）
- Production / docs / tests / assetsの変更: なし

# Git delivery

- Investigation-only Report Commit Exception（AGENTS.md §13）: 変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`だけ
- 1 commit（`docs(agent): report ACTION-13A-GRAPPLE-THROW-INVESTIGATION`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
- User Play Test: このInvestigationでは対象外。13Bで必須
