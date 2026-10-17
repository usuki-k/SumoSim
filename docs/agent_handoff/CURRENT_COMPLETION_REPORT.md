Task-ID: ACTION-03-PUSH-CONTACT-COLLISION-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 29073732a123163bb11e81d7b4b82ac7ffeb5bbd
Agent-Start-Head: 43c8085a6fe2326675ac8e2661fd247ad0618a3e
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation-only Report Commit）。Q1〜Q13のすべてに推奨案を1つずつ出した。

User Decisionは4点（D1〜D4）ある。いずれも最初のImplementation Task（ACTION-03A Contact / Separation）を止めない。D1/D2はACTION-03B（Push）の前、D3/D4はACTION-03C（Ring-out）の前に必要（下記「User Decisions Required」）。

最大のリスクであるQ5（grounded locomotionと外力momentumの干渉）は、ACTION-02Bの移動挙動を一切変えずに解決できる構造を提案した（推奨Model B）。Physics engineは不要と判断した。Production Source変更なし。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 3
- Remote CURRENT_TASK：
  - Task-IDは一致、StatusはREADY、Target-Branchはdevelop、Handoff-ModeはGITHUB
  - Source-Baselineは2907373で期待値どおり。origin/developのancestorである
- Coordination Diff（2907373..origin/develop）は`docs/agent_handoff/CURRENT_TASK.md`のみ（4199512 review、ed696ff play test accept、43c8085 task）
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head 43c8085
- 前TaskのFinal Review / User Play Test Result（ed696ff版）を読んだ：
  - Movement Feelは現Baselineとして受理済み
  - Regression Riskとして「強いlateral dampingが将来のpush impulseを即座に消す」が指摘されている → Q5で扱う

# Current Source Findings

- `BoutSimulation.step()`の現在の順序：
  1. 各participantで`applyGroundedVelocity(p.velocity, move)`
  2. position積分
  3. `updateFacing()`
  - contact、外力、outcomeは無い
- velocityは1本のcanonical `velocity`で、grounded ruleがこのvector全体に作用する：
  - 横成分の減衰、逆向き成分の制動、入力0の停止、`MAX_SPEED` clamp
  - → 外から加えた速度もこれらのruleで即座に削られる（Q5のリスクの実体）
- `ParticipantIntent`は`move`のみ。Action channelは無い
- body半径はScene側の`BODY_RADIUS_METERS = 0.35`（presentation-only）にしかない
  - Simulationはbodyの大きさを知らない
  - 当たり判定の半径をここから流用すると、描画定数がGameplay ruleになる → Q1で是正方針を出す
- facingは毎tick末に相手中心方向へ即時に向く。同一点の場合は直前の値を維持（fallbackあり）
  - したがって現状、「facing方向」と「中心間の法線」は常に一致する（Q8）
- ringはScene側で、半径Rの位置に幅8pxのstroke（中心揃え）で描かれている
  - 視覚上の境界線は R ± 4px に跨る（Q9のpresentation注記）
- `FixedStepAccumulator`と`movementVector`はpushに無関係で、変更不要
- Current Source / Review / Accepted BaselineとのMaterial Conflict：**なし**

# Q1 — Body / Contact Representation

**推奨：participant中心 + 円。半径はSimulationが所有する。最初は両者同値の暫定定数とする。**

- `BoutSimulation`が各participantの`bodyRadius`（m）を静的データとして持ち、Snapshotで公開する
- SceneはSnapshotの`bodyRadius`で描画する。Sceneの`BODY_RADIUS_METERS`は削除し、Gameplay半径を正本にする
  - 「描画の円 = 判定の円」はSnapshot経由で一致させる。描画が判定の正本になることはない
  - 将来sprite化した時は、spriteの大きさと判定円が別物であることをScene側で明示する
- 最初の値：暫定定数 `BODY_RADIUS = 0.35 m`（現在の表示値を踏襲。両者同値）
  - BoutSetupへのfieldは、まだ追加しない（Q6のattributes導入時に追加する）
  - ただし内部とSnapshotは最初からparticipant単位で持つ。後でparticipantごとの値にしても、Snapshotの形とSceneは変わらない
- 将来のHeight / Weight：
  - 半径の算出には体格（Weight、必要ならHeight）を使い得るが、formulaは未決
  - 半径を大きくすると「押されにくい」ではなく「当たりやすい・土俵際で不利」になる
  - 強さはQ6の質量・tractionで表現し、半径は幾何に限定する
- Rejected：
  - 楕円・capsule（facingで回転させる必要があり、FREE contactの初期検証には過剰）
  - spriteサイズ由来の判定

# Q2 — Contact Detection / Separation

2体専用の明示的な円-円計算で、汎用collision frameworkは作らない。

- 検出：
  - `d = |pB − pA|`、`overlap = rA + rB − d`
  - **contact**：`d ≤ rA + rB + CONTACT_SLOP`
  - SLOPは暫定値で 1〜5 mm 程度。分離後に「ちょうど接している」状態でもcontactが続き、resting contactがtickごとにon/offしてjitterするのを防ぐ
- 法線：`n = (pB − pA)/d`（AからBへ）
  - `d = 0`の場合は、Aの直前のfacing方向 `(cos fA, sin fA)` を使う
  - それも使えない場合（初期の同一点）は +x を使う（参加者の順序で決定的）
  - NaNを作らない
- 分離（積分後に実行）：
  - `overlap > 0`なら、法線方向へ質量比で位置を戻す（Aを `−n·overlap·mB/(mA+mB)`、Bを `+n·overlap·mA/(mA+mB)`）
  - 当面は等質量なので対称（半分ずつ）になる
  - 2体なので一回の完全な射影で足り、iterationは不要
- 速度の扱い（重要）：
  - contact中は、self-locomotion速度のうち相手へ近づく法線成分（closing成分）を除去する（非弾性。跳ね返りなし）
  - しないと、壁を押し続ける側のvelocityが「止まっているのに3 m/s」のままになり、Snapshotの速度が実際の動きと乖離する
  - さらに、contactが解けた瞬間にその速度で突進する
  - ACTION-03Bでは、除去したclosing成分を外力momentumへ移す（Q5、Q7の衝撃）
- Tunneling：
  - 現在の最大相対接近速度は 3 + 3 = 6 m/s で、1 tickあたり0.1 m。半径の和0.7 mに対して十分小さい
  - 外力速度にも上限 `MAX_EXTERNAL_SPEED` を設け、invariant `(2·MAX_SPEED + 2·MAX_EXTERNAL_SPEED)·TICK < rA + rB` をTestで固定する
  - これでCCDは**Deferred**でよい（立合いの衝撃などで高速域を足す時に再評価する）

# Q3 — Push Intent Semantics

**推奨：Pushは「押し続ける」hold型。Intentに継続のboolean channelを1つ追加する。**

```ts
interface ParticipantIntent {
  readonly move: Vec2
  readonly press: boolean   // 前方への圧力を保持（FREEでは押し、将来GRAPPLEDでは寄り）
}
```

- 理由：
  - 押し（oshi）は持続的に相手を運ぶ動作である
  - 離散的なpulseは、Accepted DirectionのLeft/Rightの突っ張り（tsuppari、edge型の将来action）と役割がかぶる
  - 「押す=hold」「突っ張り=edge/pulse」と分けると、操作の意味が明確になる
- ACTION-01で提案した edge型の`action: ActionCommand | null` は、突っ張りなどの導入時に**別channel**として追加する
  - holdとedgeを1 fieldに混ぜない
  - `press`はforward actionのhold版という位置付けで、raw keyではない
- moveとpressは同時に有効（押しながら回り込む、押しながら前進など）
- contact外でのpressは**効果なし**（初期Prototype）。突進やlungeは立合い/突っ張りの領域なので、ここでは作らない
- contactはtick解像度で判定する。holdなので「押下tickにcontactしていなければ失敗」という時刻判定の問題が生じず、短いtap問題の影響も受けない
- CPUは`press: true/false`を返すだけで済む。Touchは画面上の押し続けボタン1つで済む
- **User Decision D1**：Push = hold（推奨）か、edge/pulseか。Player-facingの意味が変わるため、ACTION-03Bの前に必要
- **User Decision D2**：Prototypeでのpressの仮キー。推奨はArrowUp（ACTION-01 U2の「方向Actionは矢印」、Accepted「Up action = push」と整合）。仮bindingであり、Final bindingではない

# Q4 — Fixed Tick Resolution Order

`step(intents)`の1 tickの順序を固定する。1関数に明示的に並べ、pipeline frameworkは作らない。

```
0. outcome確定済みなら何もしない（return）
1. intentsのsanitize（move clamp、非有限値→0、pressはboolean）
2. self-locomotion：各participantの selfVelocity を grounded ruleで更新（ACTION-02Bのまま、MAX_SPEED clampもselfのみ）
3. contact判定（tick開始時のposition、SLOP付き）→ n, contact?
4. contactなら:
   4a. 衝撃：selfVelocityのclosing法線成分を除去し、その運動量を両者のexternalVelocityへ非弾性で移す（03Bから。03Aでは除去のみ）
   4b. 押し合い：両者の drive / resistance から net を求め、excessがあれば両者のexternalVelocityを同じ向き（負け側の後方）へ加速する（Q7）
5. externalVelocityの減衰：4bで駆動されていないparticipantは、traction由来の減速で0へ（overshootなし）、上限clamp
6. 積分：position += (selfVelocity + externalVelocity) · TICK
7. 分離：積分後のpositionで overlap > 0 なら質量比で射影
8. facing更新（現行の即時auto-face）
9. ring-out判定 → outcome（03Cから）
```

- 2と4〜5を分けることで、「自分の足の動き」と「押されて動かされる量」の処理順が一意になる
- 3の判定はtick開始時のposition、7の分離は積分後のpositionで行う
  - 押しの判定は前tickの接触状態に基づく。同一tick内に順序依存の分岐を作らないため
  - 1 tick（16.7 ms）の遅れは体感上の問題にならない見込み（Play Testで確認する）

# Q5 — Grounded Locomotion vs External Push Momentum

**推奨：Model B。self-locomotion velocityと外力velocityを分け、移動量は合算する。**

| 観点 | A：1本のtotal velocity | **B：self + external（推奨）** |
|---|---|---|
| ACTION-02B Feelの保持 | ✗ 外力も横減衰・逆制動・停止ruleで即座に消える。tuningすると移動のfeelも変わる | ✓ selfには現行ruleがそのまま作用する。contactが無ければexternal = 0で、挙動は現行と完全に同一 |
| Push Feelの調整 | ✗ 押されの残り方が移動定数に従属する | ✓ external専用の減衰（traction）を独立に調整できる |
| Weight / LowerBody | △ 移動と抵抗が同じ係数に混ざる | ✓ 抵抗・減衰はexternal側だけに効かせられ、移動の重さとは別に設計できる |
| 立合い・突っ張り・投げ | 同上 | ✓ 衝撃は「externalへのimpulse」という同じ入口に入る |
| 組み・吊り | — | ✓ 吊りは従属拘束（ACTION-01）で、externalとは直交する |
| 単一Source of Truth | ✓ | ✓（理由は下記） |
| 複雑さ | 小 | 小＋vector 1本 |

Bが重複したSource of Truthにならない理由：

- 2つは**異なる物理概念**で、それぞれ唯一の正本を持つ
  - `selfVelocity`：本人の足運びによる速度。Intentとgrounded ruleが決める
  - `externalVelocity`：他者からの力で生じた運動量。contactとtractionが決める
- 片方から他方を導出できないので、同じ意味のStateを2重に持っていない
- 総速度 `self + external` は導出値。Snapshotの`velocity`は総速度として公開し、既存の意味「実際の移動」を保つ。必要なら内訳もSnapshotに出す
- 既存Testへの影響：contactが無いCaseではexternalが常に0なので、ACTION-02/02BのTest（T1〜T17）はそのまま成立する。これをRegression gateにする

Rejected：

- C：grounded ruleを「contact中だけ弱める」特例
  - 移動ruleの中にcontact分岐が入り、Feelの責務が混ざる
  - 押された後にcontactが外れた瞬間、また即座に消えてしまう

# Q6 — Minimal Parameter Boundary for Push

**推奨：ACTION-03Bは両者同値で、定数のみとする。ただしformulaは最初から3つの物理量で書く。ACTION-03Dで、それらをWeight / Power / LowerBodyから導出する。**

Simulation内のparticipant静的データ（Bout中は不変、constructorで確定）：

| 物理量 | 意味（semantic role） | 将来の主な由来 |
|---|---|---|
| `mass` | 慣性。同じ超過力でも重い組ほど加速が小さい（動かしにくく、止めにくい） | Weight |
| `pushForce` | press中に能動的に出す押す力 | Power（伝達はLowerBody） |
| `traction` | 足で地面を捉える力。自分が伝えられる力の上限と、押された時の抵抗・踏ん張りの回復（external減衰） | LowerBody ×（Weightによる接地圧） |

- 境界：
  ```
  Management(future) → toBoutParticipantSetup() → BoutSetup.participants[i].attributes（copy、immutable）
                                                       → constructorで mass / pushForce / traction を導出（1回のみ）
  ```
- 能力値の値域、導出formula、Speedの扱いは未決のまま（03Dで決める）
- Height：03Dでも必須ではない（半径の候補。Q1）
- StaminaCapacity / Balanceは導入しない（BalanceはRuntime候補として後続）
- 03Bを同値にする理由：
  - 最初のPlay Testでは「押し合いという相互作用そのものが面白いか」を、能力差という変数を入れずに確認する
  - 03Dでは、debug preset（軽量・高力 対 重量・低力など）で、型が数値から自然に現れるかを確認する

# Q7 — Push Formula Shape

数値は決めず、形だけを決める。contact中・法線nに沿って、1次元で解く。

```
各participant i（相手方向を正とする）:
  F_i   = press_i ? min(pushForce_i · align_i, traction_i)          // 能動的な押し。足が支えられる以上は伝わらない
                  : WALK_PRESSURE · max(0, move_i·n_i) · traction_i  // 歩いて寄るだけの弱い圧力
  R_i   = traction_i · (braced_i ? 1 : PASSIVE_RATIO)                // 抵抗。press中か前へ踏み込んでいれば踏ん張り
  align_i = max(0, facing_i · n_i)                                   // 相手を向いていない押しは弱い

net = F_A − F_B ;  loser L = (net > 0 ? B : A)
excess = max(0, |net| − R_L)
a = excess / (mass_A + mass_B)              // 組が一体で動く
externalVelocity_A, _B += dir_L_backward · a · TICK
```

- 同時に押す：等しければ`net = 0`で拮抗し、どちらも動かない（externalは減衰する）。差が負け側の抵抗を超えた時だけ動く
- 押す / 無入力：B は passive（`PASSIVE_RATIO < 1`）で抵抗が弱い → 押され得る。Bも前へ踏み込めば braced で抵抗が増える
- 軽い高力 対 重い低力：
  - 軽い側は`min(pushForce, traction)`により自分のtraction（≈接地圧）が伝達の上限になり、全力を伝えきれない
  - 重い側は抵抗と慣性が大きい
  - 型（archetype）の分岐を書かなくても、数値の組み合わせから相性が現れる。`if archetype === …` は書かない
- 衝撃（Q4の4a）：
  - 接近時のclosing相対速度を非弾性で分配し、`v_pair = IMPACT_TRANSFER · m_A·v_close /(m_A+m_B)` を両者のexternalへ加える
  - 「当たった瞬間に相手がわずかに下がる」初接触の手応えになる。将来の立合いの当たりも、同じ入口を使う
- 横方向：Prototypeでは法線方向の力のみとする。回り込みはselfの横移動で行う
- 分類：
  - **Accepted rule semantics（提案）**
    - 押しは法線方向に作用し、組が一体で動く
    - `min(押す力, traction)`
    - 負け側の抵抗を超えた分だけ動く
    - 質量で割る
    - press / bracing / passiveの区別
    - align項
    - 衝撃は非弾性
  - **Provisional tuning**
    - `PUSH_FORCE`、`TRACTION`、`MASS`、`PASSIVE_RATIO`、`WALK_PRESSURE`
    - `IMPACT_TRANSFER`、`EXTERNAL_DECELERATION`（traction / mass由来）、`MAX_EXTERNAL_SPEED`、`CONTACT_SLOP`、`BODY_RADIUS`
  - **Deferred**
    - Balanceによる崩れ、Stamina消費、押しのcommitmentや硬直
    - 横方向の力、いなし・変化、能力値formula
- 注記：
  - `R_L`と`F_L`の両方が負け側を助けるのは、ゲーム上の意図的な単純化である（踏ん張りに操作上の意味を持たせる）
  - 厳密な物理ではないので、Play Testで評価する

# Q8 — Contact Direction / Facing

- 押しの方向は**中心間の法線n**とする（円同士の接触なので、力の作用線は常に法線になる）
- facingは**効率**に効かせる（`align = max(0, facing·n)`）。移動方向は「歩いて寄る圧力」と「bracing判定」にのみ効く（`move·n`）
- 現状は即時auto-faceのため`facing ≡ n`となり、alignは常に1。glancingは現Prototypeでは表に出ない
  - 項を最初から入れておく理由：旋回速度の制限、変化、投げでfacingが法線からずれた時に、正面でない押しが自動的に弱くなる。全接触を常に正面全力の押しにはしない
- 斜め接近：衝撃は相対速度の**法線成分のみ**から作る。かすめる接近はほぼ衝撃にならない

# Q9 — Ring Boundary / Ring-out Geometry

- 参考事実（現実の相撲。ゲーム仕様ではない）：
  - 土俵の内径は15尺（約4.55 m）
  - 足裏以外が地面に着くか、俵の外の地面に体の一部が触れると負ける
- ゲーム上の抽象化：

| 案 | 判定 | 評価 |
|---|---|---|
| a 中心が出る | `d > R` | 寛容で、体の半分が外に出ても残る。視覚と判定の乖離が大きい |
| b 体円が触れる | `d + r > R` | 厳格。端に触れた瞬間に負けるので、土俵際の粘りが生まれにくい |
| c 体円が全部出る | `d − r > R` | 寛容すぎる |
| **d 支持円（推奨）** | `d + ρ > R`、`ρ = SUPPORT_RATIO · r`（0 ≤ ρ ≤ r） | 足元の円という抽象。1係数でaとbの間を連続的に調整でき、土俵際の粘り具合をPlay Testで詰められる |

- 推奨：d。初期値は`SUPPORT_RATIO = 0.5`程度（暫定）。判定は1行の幾何で、決定的にTestできる
- presentation注記：
  - ring線は判定半径Rの位置にinner edgeを合わせて描く（現在は中心揃えで±4px跨る）
  - 将来、支持円を薄く表示するかどうかはPresentationの判断
- **User Decision D3**：ring-out基準（推奨はd、またはa / bのどれか）。Feelに直結するので、ACTION-03Cの前に決める

# Q10 — Outcome Boundary

```ts
type BoutOutcome =
  | { kind: 'decision'; winnerId: ParticipantId; loserId: ParticipantId; reason: 'ring-out' }
  | { kind: 'redo'; reason: 'simultaneous-ring-out' }      // D4次第
```

- Snapshotに`outcome: BoutOutcome | null`を追加する。判定はSimulationが所有する（Q4の9）
- 確定後の`step()`は何もしない（no-op）。position・velocityは凍結し、post-finishの移動は無い
- 再開：SimulationにはReset methodを持たせない
  - 呼び出し側（Scene、将来のBout flow）が同じSetupから`new BoutSimulation(setup)`を作り直す
  - 「確定→表示→再開キー」はScene / flowの責務（Presentation）
- 決まり手は持たない。`reason`はcategoryのみで、kimariteは後続で設計する
- ACTION-01の`BoutPhase`（tachiai / engaged / finished）は、立合いの導入時にこの`outcome`を包む形で拡張する。今は先回りしない

# Q11 — Required Boundary Tests（Implementation Tasks向け）

Contact（03A）：

- ちょうど接している（`d = rA+rB`）とSLOP内 → contactが成立し、位置は不変
- わずかな重なり → 分離後に`d = rA+rB`、等質量なら対称
- 同一中心（`d = 0`）→ fallback法線で決定的に分離され、NaNなし
- 最高速で正面から接近 → 通り抜けない。各tickで重なりは0。closing self速度は除去され、Snapshot速度と実移動が一致する
- 最高速の斜め接近やかすめ接近 → 接線方向へ滑って回り込める
- 2体とも同時に相手へ歩く → 中間で止まり、jitterなし（数百tickでpositionが一定）
- invariant：`(2·MAX_SPEED + 2·MAX_EXTERNAL_SPEED)·TICK < rA + rB`

Push（03B）：

- 片方がpress、もう片方が無入力 → 押された側がn方向へ動く。組は離れない
- 両者が等しくpress → 拮抗し動かない。externalは0へ減衰する
- pressの差が抵抗以下 → 動かない。抵抗を超えた時だけ動く（境界値）
- contact外でのpress → 何も起きない
- 衝撃：closing速度とexternalの分配量。かすめ接近では衝撃がほぼ0
- external：押しが止まると減衰して0になり、overshootなし。上限を超えない
- press中のmove（回り込み）も有限で安定

Ring-out（03C）：

- 判定の境界（`d + ρ = R` ちょうど、および±ε）
- 押されて出る → outcomeが確定し、以後の`step()`で状態が凍結される
- 両者が同じtickに外へ出る → D4のruleどおり
- 自分で歩いて出る → 負け

共通（全Task）：

- 同じSetupと同じintent列で同じ結果（決定的replay）
- 全値が有限（NaN / Infinityなし）
- accumulatorのframe partition独立性（既存Test）
- **contactが無い状況でACTION-02B Movement Testが全て不変**（Q5のRegression gate）
- Snapshot隔離、Phaser非依存

# Q12 — Prototype Test Harness / User Play Test

**推奨：相手のdummy controllerを数種類用意し、数字キーで切り替える。Restart keyも付ける。**

- dummy controllerはPure関数 `(snapshot, selfId) → ParticipantIntent`（`src/game/sumo/` または `src/game/input/` に1 file）。将来のCPUと同じcontractで、AIではないことをcommentで明記する
- modes：
  - `1` 静止（既定）
  - `2` 相手へ歩いて寄る（`move`のみ）
  - `3` 寄りながらpress（押し返してくる）
- Sceneの`PARTICIPANT_PRESENTATION`のcontrollerを、局所的に切り替えるだけ。framework化しない
- `R`でrestart（同じSetupで作り直す）。ring-outが入る03C以降に必須
- 2人keyboardでのlocal対戦はRejected：
  - 矢印キーがAction用の候補（D2）と衝突する
  - 1人では「押されること」を検証しにくい
- Userが確かめること：
  - 初接触の手応え
  - 抵抗感（押しても動かない時、動く時）
  - 相手を後ろへ運ぶ感覚
  - 押し返されて下がる・拮抗する感覚
  - 土俵際の緊張（03C以降）
  - contactしていない時の移動がACTION-02Bのままか

# Q13 — Next Implementation Sequence

1. **ACTION-03A Contact & Separation**
   - Scope：
     - Simulation所有の`bodyRadius`（Snapshotで公開。Sceneの`BODY_RADIUS_METERS`を廃止）
     - SLOP付きcontact
     - 質量比の分離（当面は対称）
     - closing self速度の除去
     - Model Bの`externalVelocity`の器（常に0）
   - push、衝撃、ring-outは含めない。dummy mode 1と2
   - Technical：Q11のContact項目と共通項目
   - User Play Test：REQUIRED（軽め）。体が「固い」か、回り込みが自然か、接触時に移動感が崩れないか
   - 必要なUser Decision：なし
2. **ACTION-03B Push & External Momentum**
   - Scope：
     - `press` channel
     - Q7のformula（両者同値の定数）
     - 衝撃
     - external減衰と上限
     - dummy mode 3
   - ring-outはまだ含めない（土俵は無限扱い）
   - Technical：Q11のPush項目と共通項目
   - User Play Test：**REQUIRED。Push Feelの最初の必須Gate**
   - 必要なUser Decision：D1、D2
3. **ACTION-03C Ring-out & Outcome**
   - Scope：
     - 支持円判定（D3）
     - `BoutOutcome`
     - 確定後のno-op
     - Sceneの結果表示（簡易text）とRestart
     - ring線のpresentation補正
   - User Play Test：REQUIRED（土俵際の緊張、勝敗の納得感）
   - 必要なUser Decision：D3、D4
4. **ACTION-03D Body Parameters**
   - Scope：
     - `BoutSetup`の`attributes`（Weight / Power / LowerBody）→ mass / pushForce / traction の導出
     - debug presetによる型の比較
   - User Play Test：REQUIRED（体格差・力の差の手応え）
   - 前提：03Bと03Cの受理。値域と導出formulaを決める小さなDesign stepを先に挟むことを推奨する

03Aは小さいので、03Bと統合することもできる。ただし「固い接触」と「押しのFeel」を別々に評価できる方が、問題の切り分けが安全なので、分割を推奨する。

# Recommended Contact Model（要約）

participantごとに、Simulationが所有する円（半径は暫定で同値の0.35 m）を使う。SLOP付きでcontactを判定し、積分後に質量比で射影して分離する。closing self速度は除去する（03Bでexternalへ移す）。CCDはDeferredとし、速度invariantで担保する。

# Recommended Push / Momentum Architecture（要約）

- Model B：`selfVelocity`（grounded ruleのみが作用）+ `externalVelocity`（contact、衝撃、tractionのみが作用）
- 移動量は和で、Snapshotの`velocity`は和で公開する
- 押しは法線上の1次元の力の釣り合い（Q7）で解く

# Recommended Parameter Boundary（要約）

- 03Bでは、mass / pushForce / traction を同値の定数にする
- 03Dでは、`BoutSetup.attributes`（Weight / Power / LowerBody、copyしてimmutable）から、constructorで1回だけ導出する

# Recommended Ring-out Rule / alternatives（要約）

支持円 `d + SUPPORT_RATIO·r > R` を推奨する（D3）。代替は中心判定と体円接触判定。

# Accepted Rule Semantics vs Provisional Tuning

- **このReportで提案するRule semantics**（ChatGPT Review / Userで受理されるまでは提案）：
  - Model B
  - Q4の順序
  - 法線方向の押し
  - `min(力, traction)`
  - 負け側抵抗の超過分だけ組が動く
  - passiveとbraced
  - 非弾性の衝撃
  - 支持円の形
  - outcome確定後はno-op
  - Simulationに再開methodを持たせない
- **既存のAccepted（変更しない）**：
  - ACTION-02Bのgrounded locomotionと定数
  - fixed-step 60Hz（暫定）
  - 画面基準のWASD
  - auto-face
  - Scene一方向
  - Physics不使用
- **Provisional tuning**：Q7に列挙した定数すべて、および`SUPPORT_RATIO`

# Rejected / Deferred Alternatives

- Rejected：
  - Phaser Arcade / Matter（ACTION-01の理由に加え、Model Bの分離とtraction閾値を表現できない）
  - 単一velocity（Model A）
  - contact中だけgrounded ruleを弱める特例（C）
  - spriteサイズによる判定
  - 楕円・capsule
  - 2人keyboard
  - 押しのlunge（contact外のpressで突進）
- Deferred：
  - CCD
  - 横方向の力
  - いなし・変化
  - Balance
  - Stamina
  - 押しのcommitment
  - 能力値formula
  - Height
  - 決まり手
  - `BoutPhase`拡張
  - render interpolation
  - 短いtapのbuffer

# Design Conflicts / Ambiguities

- Current Source、Review、Accepted Movement Baselineとの**Material Conflictはなし**
- Model Bでも、ACTION-02Bの挙動は「contactが無ければ完全に同一」で、移動の再設計は不要
- 曖昧な点：
  - Q7で負け側の抵抗とdriveを二重に数えるのは、ゲーム上の意図的な単純化。Play Testで評価する
  - 03A段階（衝撃なし）では、静止した相手に歩いて当たっても相手は動かない。体が固いと感じるのは仕様で、押しの導入（03B）で変わる

# User Decisions Required

| # | 内容 | 推奨 | 期限 |
|---|---|---|---|
| D1 | Pushの入力の意味 | **hold**（押し続ける。突っ張り＝edgeとは区別） | ACTION-03B前 |
| D2 | Prototypeのpress仮キー | **ArrowUp**（仮。Final bindingではない） | ACTION-03B前 |
| D3 | Ring-out基準 | **支持円**（SUPPORT_RATIO約0.5、Play Testで調整） | ACTION-03C前 |
| D4 | 同じtickに両者が外へ出た場合 | 支持円が**より深く出た側の負け**、完全同値は**取り直し**（`redo`） | ACTION-03C前 |

D4の参考事実：

- 現実では、同時に出たと判断されれば同体として取り直しになる
- 体勢を失った側を先に負けとする「死に体」という考え方もある
- 上の推奨はゲームとしての簡略化である

# Design Deviations

NONE

# Unexpected Scope

なし。Current Sourceの修正もしていない。

# Verification

- Current Sourceを直接inspectした：
  - BoutTypes、BoutSimulation、test、FixedStepAccumulator、movementVector、BoutScene
  - ARCHITECTURE、GAME_CONCEPT、AGENTS
  - 前Final ReviewとUser Play Test Result
- Q1〜Q13に回答した。Recommended / Rejected / Deferred、Rule / Tuning、User Decisionを区別した
- 外部資料：
  - 現実の相撲の規則（土俵の内径、勝負の基本、同体・取り直し）を、一般知識としてのみ参照した
  - いずれも「参考事実」と明記し、ゲーム仕様にはしていない
- Production Source、package、lockfileは変更なし。Repository変更は本Reportのみ
- `git diff --check`: PASS
- `pnpm test` / `pnpm build`：Source未変更のため未実行

# User Play Test

NOT REQUIRED（Investigation）。Push / Contact Feelの必須Gateは、03A（軽め、contactの固さ）から始まる。**Push Feelの最初の必須Gateは ACTION-03B**。

# Git delivery

Investigation-only Report Commit Exceptionを適用する。本Reportのみを1 commit（`docs(agent): investigate push contact architecture`）で`origin/develop`へpushする。mainは変更しない。
