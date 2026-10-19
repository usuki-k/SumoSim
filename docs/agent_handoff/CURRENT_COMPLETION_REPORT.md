Task-ID: ACTION-04-DOWN-COUNTER-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17
Agent-Start-Head: 161b16a9d43b06a05116c728365111f927bf696a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。Accepted Push / Contact / Movement / Model Bを変えずに実装できる安全なCounter設計を推奨できる。残っているのは§User Decisions Requiredに挙げた確認事項だけで、どれにも推奨既定値がある。

Production Source / package / lockfile / AGENTS / ARCHITECTURE / GAME_CONCEPTは未変更。Repository変更は本Reportのみ。

（前回Reviewの指摘に従い、Agent-Start-HeadはPreflight FF後のHEAD `161b16a` を記載。）

# Preflight

- working tree clean / branch `develop`
- fetch後 `HEAD...origin/develop` = `0 4`（local aheadなし）
- Remote CURRENT_TASK: Task-ID一致 / Status READY / Target-Branch develop / Source-Baseline `730ba8f`（`origin/develop`のancestor）/ Handoff-Mode GITHUB
- `730ba8f..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功（`161b16a`）

# Accepted Baseline と Proposed Semantics の区別

- **Accepted（変更しない）**: WASD grounded movement、Contact / Separation（self-velocityのinward寄与で補正を配分）、ArrowUp Discrete Push（Startup 6 / Active 8 / Recovery 10、direction lock、steering lock、Push中の入力は無視しqueueしない）、Model B（selfVelocity / externalVelocity）、equal Pushの相殺、Push Dummy harness。
- **Proposed（本Reportの推奨。未実装）**: 以下で「推奨」と書く内容はすべてこちら。数値はすべて暫定のPrototype案で、User Play Testで調整する。

# Current Source Findings

設計を左右する事実（Source直読）:

- F1 `step()`の順序: intent → Push start → effective move → grounded self velocity → external decay → integrate → `resolveContact` → `resolvePush` → `advanceAction` → `updateFacing`。Push力は1 tick遅れて変位に効く。
- F2 `resolveContact`はContact中、毎tick**closing normalのself velocityを除去**する。このためContact中のattackerはself側に前進momentumをほとんど溜めない。Pushの駆動はほぼ全量、pair共有の`externalVelocity`に現れる。→ 防御側が「抜ける」だけでは、攻撃側の自然なovershootはほぼ発生しない（Q6の選択肢Bを不採用にした根拠）。
- F3 `resolvePush`はContact normalに沿って`±1`の整数netを使い、同じdvをpair両者へ加える。Push力はlocked directionとContact normalの**角度に依存しない**（Q8に影響）。
- F4 `updateFacing`は毎tick両者を相手へ即座に向ける。facingを使うのは(1) Push開始時のdirection lock、(2) 同一中心時のContact fallback normal、(3) 表示だけ。現在のSimulationには相対角度（側面・背後）を参照するgameplay ruleが無い。→ 側面・背後の優位は、現状はKuzushiの状態そのもの（行動不能・押されやすさ）を通じてしか意味を持たない。facing固定は、将来の角度依存ruleのための前提として必要になる（Q18）。
- F5 `externalVelocity`は参加者ごとのfieldで、decayもclampも参加者ごとに独立している。→ attackerだけに与える外力（overshoot）は、architecture変更なしにModel Bで表現できる。
- F6 `PressLatch`は汎用のpure classで、2個目のinstanceを作るだけでDown edgeにも使える（新規codeは不要）。
- F7 `PushDummyController`は`action.kind !== 'idle'`の間だけcooldownを満タンに保つ。Kuzushiを`action`とは別fieldにした場合、Kuzushi中のDummyはidleに見えてedgeを出し続ける（Simulation側で無視される）。Kuzushi明けの即Pushも起きるので、Counter実装Taskで「Kuzushi中もcooldownを満タンに保つ」小修正が必要になる。
- F8 Arenaは無機能（ring-outなし、場外へ出られる）。ただしrelocationで土俵外へ置く挙動は、将来ring-outと衝突するので今の段階で禁止しておく（Q17）。
- F9 人の反応時間はおよそ200〜250 ms（12〜15 tick）。Push Startupは6 tick、Activeは8 tick。STARTUP表示を見てから押すと、届くのはActive中盤〜終了後になる。→ Best（Active開始を捉える）は先読みでしか取れず、反応で取れるのはSuccessが上限になる。これは設計として望ましい性質（後述）。

# Q1 — Down Counterとは何か

推奨: **C. 共有のDown Counter action 1つ。結果のtechniqueはtimingで決まる**（Best = 引き / pull、Success = 捌き / deflection）。

- Userの結果階層（Best→背後 / 決着、Success→側面 / 崩し）は、そのまま「1つの入力、tierごとに異なるtechnique」を示している。
- 結果の表現にtechniqueの識別（`pull` / `deflect`）を持たせて区別を残す。将来、引きと捌きを別actionへ分けるとき（D案）も、結果表現を変えずに入力側だけ増やせる。
- A（pullのみ）を不採用にした理由: Successの側面捌きを失う。B（deflectionのみ）を不採用にした理由: Bestの背後 / 決着を失う。
- D（最初から別action）は不採用。入力が2つになり、tier設計も重複する。Deferredとする。

# Q2 — 入力意味論

推奨: Pushと対称の**edge-triggered discrete action**。

- 暫定binding: ArrowDown（Prototype binding。User確認が必要）
- 1回の押下で1回の試行。holdでの自動repeatなし
- `ParticipantIntent`に`counterPressed: boolean`を追加（意味はpushPressedと同じ「このtickの新しい押下edge」）
- 開始できるのは`action idle`かつ`posture stable`のときだけ。自分のPush中、Counter中、Kuzushi中の押下は無視し、queueしない（PushのRecovery中も同じ。Pushの既存semanticsと対称）
- `PressLatch`の2個目のinstanceを使う。Scene側の消費はPushと同じく「frameの最初のtickだけ」
- 同じtickにPush edgeとCounter edgeが両方立った場合: **Pushを優先し、Counter edgeは捨てる**。明文化する固定ruleで、隠れた優先ではない。Push semanticsも変えない

# Q3 — Counter phase構造

推奨: `window`（受け）1 phaseに、結果分岐を付ける。

| 役割 | 内容 | 暫定案 |
|---|---|---|
| Startup | **なし**（押下tickからwindowが開く）。反応で取れるSuccessがさらに狭くならないようにするため | 0 |
| Window（active） | 相手のPush Activeとの接触を待つ。WASD steeringは抑制（self moveはzeroでbrake） | `COUNTER_WINDOW_TICKS = 12`（~200 ms） |
| 成功時 | その場でresolutionし、Counter使用者は**即idle**（Recoveryを切り捨て） | — |
| 失敗時 | windowが切れたらCounter使用者が**Kuzushiへ入る**（Kuzushiが空振りのRecoveryを兼ねる） | `COUNTER_FAIL_KUZUSHI_TICKS = 30`（~500 ms） |

- Counterはdirectionを持たず、lockもしない。relocationの基準は**攻撃側のlocked Push direction**（Q17）
- windowの長さは早押しへの許容度、Kuzushiの長さは空振りの代償を決める。この2つがCounter側の主な調整lever。Push側（Startup / Active）はAccepted Baselineなので触らない

# Q4 — Pushに対する成功timing

推奨: **timingと物理条件のhybrid**。

成立条件（同じtickにすべて満たす）:
1. 防御側が`counter window`中
2. 攻撃側が`push active`中
3. そのtickの`resolveContact`がContactを返す

成立した最初のtickでresolutionする。tierは「相手Activeの何tick目で捉えたか」で決める:

- `activeElapsed`（攻撃側のActive経過tick。Active初tick = 0）
- `activeElapsed <= COUNTER_BEST_GRACE_TICKS`（暫定2） → **Best**
- それより後でActive中 → **Success**
- windowが切れるまで成立しない → **Fail**

この定義から得られる性質:
- 相手のActive開始前（Startup中）からwindowを開いて待てば、Active初tickで捉えて必ずBest。Bestの押下許容幅は約14 tick（window 12 + grace 2）で、frame-perfectにならない
- 反応で押した場合はActive途中で捉えるのでSuccess。STARTUPを見てすぐ押せばぎりぎり届く程度
- 「PUSH表示を見てからDown」はほぼ間に合わずFailになる。→ 「PUSHを見てDownで勝ち」は成立しない（User要件を満たす）

各case:
- 早すぎ: windowが相手Active前に切れる → Fail
- 正しいtiming: Active開始をwindowが覆う → Best
- やや遅い: Active途中 → Success（その時点までの押し込みによる変位はexternalVelocityとして残る）
- 遅すぎ: 相手がRecovery以降 → Fail
- 相手Startup中にwindow: 何も起きずに待つ。Activeまでwindowが残っていればBest、残っていなければFail
- 相手Recovery中: 捉える対象がないのでFail（Recovery中の相手には、Counterではなく自分のPushで罰する）

不採用: 「Active開始の瞬間だけ成功」（frame-perfect）、「external加速度・momentum閾値だけで判定」（Pushの1 tick遅延でBestを判定できず、paramterの影響も読みにくい）。

# Q5 — Contact要件

推奨: **開始はContact不要、resolutionは既存Contact判定（`resolveContact`が非nullを返すtick）のみ**。

- 接近してくる相手に先出しできる（先読みの余地）
- near-contact用の新しい許容値は作らない。Simulationの既存Contact定義を唯一の基準にする
- 離れた位置からのPush（非Contactの短い踏み込み）は、Contactに至らなければ成立せずFailになる。踏み込みでContactに至った場合は、そのActive tickで成立する

# Q6 — 成功時のresolution効果

推奨: **A + 位置resolution + Kuzushi、それにD（attackerだけのovershoot）を1定数で付ける**。

resolution tickの処理（`resolveContact`の後、`resolvePush`の前）:
1. 攻撃側のPushを終了し、`action → idle`、`posture → kuzushi`。このtickから攻撃側はActiveでなくなるので、`resolvePush`のnetは0になる（このtickの押し込みは発生しない）
2. pairの`externalVelocity`は**そのまま残す**。Success時はすでに受けた押し込みがpair共有で残り、両者が同じ向きへ流れるだけで相対位置は保たれる
3. 防御側をrelocationする（Q17）
4. 攻撃側にだけ、locked directionに沿ったovershoot外力を加える（`COUNTER_OVERSHOOT_SPEED`、暫定。0にすれば無効にできる）。前へ流れて崩れる様子を見せる。Model Bの参加者ごとのexternalVelocityで表現でき、decayとclampも既存のものを使う

評価:
- B（防御側が抜けて自然にovershoot）: **不採用**。F2のとおり、Contact中のattackerはself momentumをほぼ持たない
- C（lateral externalVelocityへの転向）: 側面への移動はrelocationで担うため、Prototypeでは不採用。inashi（独立した捌き技）のvariant用にDeferred
- D単独: Kuzushi・位置優位を表現できないので不足。上記のとおり補助として採用
- 第2の物理系、impulse framework、mass: 不要
- 将来のWeight / LowerBody / Balance: overshoot量、Kuzushi時間、決着判定の入力になる。いずれも単一の関数・定数経由にしておき、差し替えられるようにする

# Q7 — Failure / Whiff

推奨: **Fail = window終了時にCounter使用者がKuzushiへ入る**。これ以外の罰（後退step、移動の凍結）は追加しない。

- Pushが来ない / 早すぎ / 遅すぎ / Contact外 / 相手が普通に歩いているだけ: すべてFail（window切れ → Kuzushi）
- 相手も同時にCounter: 両者ともwindow切れでFailになり、両者Kuzushi（対称で、隠れた優先なし）
- 連打対策: windowとKuzushiの間は新しい入力をすべて無視する。空振りするたびに、押されやすい無防備状態を約0.5秒さらす
- 空振りの見た目（COUNTER表示からKUZUSHI表示へ。後退モーションの有無など）はUser決定（UD-3）

# Q8 — Lateral evadeとの関係

推奨: **専用のDodge actionはまだ作らない**。

- 既存の要素で部分的には成立している: 攻撃側のPush方向はlockされ、防御側はidleならWASDで動け、Contactの接線方向の移動も残っている
- 制約（F3）: Push力はContact normalに沿って掛かり、locked directionとの角度は見ない。そのため横移動はContactを外せたときだけ効く。Startup 6 tickで静止から動ける横移動は約5 cm、Active終了までで約27 cmにとどまる
- これはCounterの成立を妨げない（BLOCKERではない）。Counter Play Testで「横へ躱す」が選択肢として機能するかを併せて確認し、不足であれば別Taskで「Push力をnormalとlocked directionの整合度で弱める」などを検討する。これはAccepted Push semanticsの変更になるので、Deferredとし、User / Review判断とする

# Q9 — 同時Pushとの関係

- 防御側が自分のPush中: Counter edgeは無視（Q2）
- Counter対Push と Push対Push の違い: Push対Pushはnetが相殺されて拮抗する（Accepted）。Counter対Pushは**離散的なresolution**（Kuzushi、位置、overshoot）になる。Counterは押し合いに参加しない（Counter中のnet寄与は0）
- 両者Counter: 両者Failで、両者Kuzushi（Q7）
- 一方Counter、他方Pushなし: Fail
- 優先ruleは「同じtickのPush edgeとCounter edgeではPushを優先」（Q2）だけで、明文化する

# Q10 / Q15 — Runtime State / Kuzushi State Boundary

推奨: **action unionにcounterを追加し、Kuzushiは別の`posture` fieldにする**。

```ts
type ParticipantActionState =
  | { kind: 'idle' }
  | { kind: 'push'; phase: PushPhase; ticksRemaining: number; direction: Vec2 }
  | { kind: 'counter'; ticksRemaining: number }            // window only

type ParticipantPosture =
  | { kind: 'stable' }
  | { kind: 'kuzushi'; ticksRemaining: number }
```

- action = 本人が選んだcommitment。posture = 本人の意思によらない体勢。将来Balance / LowerBodyによって「押され続けて崩れる」ようなentryを足すとき、action体系を変えずに済む
- 不変条件: **Kuzushi中のactionは常にidle**。Kuzushiへ入る経路は`enterKuzushi(p, ticks)`の1関数だけにし、そこで`action = idle`にする。同じ意味のstateを2箇所に持つことにはならない（actionとpostureは別の概念）
- 次案（単一unionに`kind: 'kuzushi'`を入れる）でもPrototypeは成立する。不採用にした理由は、将来Balance由来のKuzushiとactionの関係を決めるときに、unionの分解が必要になるため。Review判断で次案にしても、Prototypeの挙動は同じ
- 入る / 出るの所有者: Simulationだけ。entry = Counter成功時の攻撃側、Counter失敗時の使用者。exit = posture timerがなくなったとき（`advanceAction`の隣で減算）
- Kuzushi中のrule:
  - 新しいPush / Counterは開始できない（入力は無視し、queueしない）
  - self moveはzero（brake）
  - facingは固定（Q18）
  - **押されやすさ**: `resolvePush`で、受ける側がKuzushiならpairのdvに`KUZUSHI_PUSH_SUSCEPTIBILITY`（>1、暫定）を掛ける。Kuzushi側同士の場合も既存の±1 netは変えない
  - **Grip保証の境界**: Gripは未実装。将来のGrip resolutionでは、(1) 既存Contact判定などの有効range判定を必ず先に通し、(2) 通った場合だけ、対象がKuzushiなら成否判定を省いて成功とする。距離の判定はKuzushiでも省略しない
- 将来のWeight / LowerBody / Balance / Stamina: `kuzushiTicks(cause, participant)`のような単一関数で時間を決め、押されやすさの係数もそこから得る。今は定数を返すだけにする（stat systemは作らない）
- Snapshot: `action`（counter window含む）と`posture`をcopyで公開する。加えて、resolutionの提示用に参加者ごとの`lastCounter: { seq, tier, technique, relocation } | null`を持たせる。1 tick限りのeventにすると、1 frame内に複数tickが進んだときSceneが見落とすので、persistent fieldに単調増加の`seq`を付け、Scene側は`seq`の変化で検出する
- generic Action frameworkは作らない（3 memberの判別union + posture 2 memberだけ）

# Q16 — Best / Success / Fail Result Model

```ts
type CounterTier = 'best' | 'success' | 'fail'
type CounterTechnique = 'pull' | 'deflect'
type Relocation = 'rear' | 'side' | 'none'
```

結果は(攻撃種別, tier)からの**小さな明示関数**`counterOutcome(attack, tier)`で引く（switch文。tableやframeworkにはしない）。

| 攻撃 | Tier | Kuzushi | 防御側の位置 | 決着判定 | technique |
|---|---|---|---|---|---|
| Push | Best | 攻撃側 | 背後（rear） | 将来あり（Prototypeでは省略: UD-4） | pull |
| Push | Success | 攻撃側 | 側面（side） | なし | deflect |
| Harite（将来） | Best | 攻撃側 | 側面 | なし | deflect |
| Harite（将来） | Success | 攻撃側 | 移動なし | なし | deflect |
| 任意 | Fail | Counter使用者 | 移動なし | なし | — |

- Prototypeで実装するのはPushの行とFailだけ。Hariteは`attack`の判別子として型に予約することもしない（追加時にunionを1 member増やせば済む）
- tierの判定（Q4）と結果の対応付け（この表）を分けておけば、Harite追加時に変えるのは表の関数だけで済む

# Q17 — Side / Rear Position Resolution

基準: 攻撃側の中心`P`、攻撃側のlocked Push direction`d`（単位vector）、`perp(d) = (-d.y, d.x)`、結合半径`R = rA + rB`。

- **Rear target**: `P - d * R`（攻撃側の真後ろで接触する位置）
- **Side candidates**: `P ± perp(d) * R`（攻撃側の真横で接触する位置。前後方向のoffsetは`COUNTER_SIDE_BACK_OFFSET = 0`を暫定とし、Deferred）
- **自動側面選択（User決定どおり）**: 防御側の現在位置により近い候補を選ぶ。2候補はPに対して対称なので、これは`sign(dot(perp(d), defender - P))`と**数学的に同値**。実装は内積の符号で書くのが簡単で頑健
- **重要な所見**: 防御側が`d`の軸上にいると、距離は完全に等しくなる。Push開始時にdirectionは防御側へ向けてlockされるので、防御側が横に動いていなければ**tieが頻発する**。tie-breakが実際の結果を大きく左右するので、次の順で決める:
  1. `|lateral offset| > COUNTER_SIDE_EPSILON`（例 1e-6 m）なら近い側
  2. tieなら**土俵中心に近い側**（valid性が高く、場外へ寄らない）
  3. それもtieなら固定で攻撃側の`+perp(d)`側（+y下の画面座標では、攻撃者から見て右）
  - randomは使わない。横に動いてからCounterすれば、その側が選ばれる（追加入力は不要で、A/Dを要求しない）
- **距離と重なり**: 目標の中心距離はちょうど`R`（接触状態）。重なりはなく、Contactが継続するので、側面・背後からすぐ押せる（将来はGripにもつなげる）
- **無効な目標**: `|target| <= arena.radius - bodyRadius`（体が土俵内に収まる）を満たさない場合は無効
  - Best: rear → 近いside → もう一方のside → relocationなし（Kuzushiは適用する）
  - Success: 選んだside → 反対のside → relocationなし
  - clampで土俵内へ押し戻すことはしない（重なりや不自然な位置を生むため）
- **瞬時 vs 短い移動**: 推奨は**Simulation内で瞬時に確定**（そのtickで位置を書き換える）。短い決定的移動（数tickの軌道追従）では、背後への移動で攻撃側の体を回り込む経路が必要になり、pathfindingに近づくので不採用
  - Source of TruthはSimulationの位置だけ
  - 見た目はPresentationが`lastCounter.seq`の変化を検出し、前の表示位置から新しい位置への短い弧tweenを**描画だけで**行えばよい（gameplayに影響させない）。Prototypeでは瞬時表示のままでも可
  - 瞬間移動の見え方そのものはPlay Testの確認項目にする
- generic nav / pathfindingは追加しない

# Q18 — Kuzushi Facing Rule

推奨: **Kuzushi中はその参加者の`updateFacing`をskipする（facingを固定）。Kuzushi終了tickから通常のauto-facingへ即時に復帰する**。

- 背後・側面へ回られても、相手が次のtickで振り向かない。facing markerは背中を向けたまま残り、優位が見て分かる
- Counter使用者側は通常どおり相手を向く
- 終了時の即時snapでは、Kuzushi終了の次のtick以降のPush方向は通常どおり相手へ向く（Accepted Push lockを変えない）
- 不採用: turn-rate制限（turn速度の新しいstateと定数が必要で、facing system全体の再設計に近づく）。snapの見た目が問題になった場合のDeferred
- 不採用: Kuzushi後もfacingを遅らせる猶予（小さな利点に対して新しいtimerが増える）
- F4のとおり、現在のgameplayでfacing角度が効くのはPush lockとfallback normalだけ。今の側面・背後の優位は「相手がKuzushiで動けず押されやすい」ことに由来する。facing固定は将来の角度依存ruleのための前提

# Q19 — Future Finish Chance Boundary

- 決着の判定・保持はSimulationが所有する（将来の`BoutOutcome`）。PresentationやControllerは結果を読むだけ
- `Math.random()`は使わない。確率を入れるときは、**`BoutSetup`にseedを入れ、Simulationが小さな決定的PRNG state（例: 32-bit整数1つ）を持つ**。PRNGは決着判定のときだけ進める。同じseedと同じintent列なら完全に再現できる（test可能）
- 不採用: 呼び出し側（Scene / Controller）から乱数を毎tick渡す方式（gameplayの結果を外部から注入する形になる）
- 確率の式、関係するstat、値の範囲は決めない
- Prototype推奨: Best-Pushの即決着は**省略**し、常にKuzushi + 背後とする（ring-out / BoutOutcomeが未実装のため）。User確認が必要（UD-4）

# Q11 — Play Test用Dummy harness

- 既存のPUSH DUMMYで足りる。Contact → Push（24 tick）→ cooldown 30 tickという約0.9秒の一定rhythmが、先読み（Best）の練習台になる
- 必要な小修正（F7）: Dummyは`posture === kuzushi`の間もcooldownを満タンに保つ。Kuzushi明けに即Pushしないようにし、Kuzushiの間はedgeも出さない
- 表示: Counter phase text（例`COUNTER`）、Kuzushi text（`KUZUSHI`）、結果text（`BEST` / `SUCCESS` / `FAIL`。`lastCounter.seq`の変化から短時間表示）。presentationのみ
- Userが試せること: 早押しFail / Startup中の先出しBest / 反応Success / 遅押しFail / Pushが来ないときの空振り（Mode 1 STATIONARYで確認）/ 横移動で躱す / Push対Push と Counter対Push の比較 / Counter成功後に背後・側面から自分でPushする
- 本物のAIは追加しない

# Q12 — 必要な自動Test（実装Task用）

1. Counter edge 1回で1回の試行。holdしても繰り返さない。Push・Counter・Kuzushi中の押下は無視
2. 同じtickのPush edgeとCounter edgeではPushが優先
3. windowのtick数が正確で、切れたらFail → Kuzushi → stableへ戻る（tick数を決定的に確認）
4. 相手Startup中から待った場合はActive初tickでBest
5. graceの境界（elapsed = grace はBest、grace + 1 はSuccess）
6. Active後半はSuccess、Recovery中・window切れはFail
7. Pushが来ない場合はFail
8. Contactがない場合（非ContactのPushの踏み込み）は成立しない
9. resolution tickでは攻撃側のPushが終了し、そのtickの押し込みが無い（netが0）
10. relocation: rearとsideの目標、Contact距離ちょうど（重なりなし）、側面の符号選択とtie-breakの3段階、土俵外目標のfallback順
11. Kuzushi中はfacing固定、新しいactionを開始できない、self moveはzero、押されやすさの係数がかかる。終了時にfacingが即時復帰
12. overshootは攻撃側だけ、locked direction沿い、decayで0へ、反転なし
13. 両者Counterでは両者Failで対称
14. Push direction lockとsteering lockが不変
15. Accepted Push対Pushの相殺が不変
16. Counterを使わない場合、既存の86 test（Movement / Contact / Push / Dummy）が変更なしでPASS
17. NaNなし・重なりなし・deterministic replay
18. frame分割に依存しないedge（Scene / latchの分割test。既存T49 / T56と同形式）
19. Dummy: Kuzushi中はedgeを出さず、cooldownを保持する

# Prototype User Play Test Plan

最初にCounter Feelが **REQUIRED** になるのは、実装Task（次のACTION-04A）。本Investigationは NOT REQUIRED。

確認項目案:
1. ArrowDownが1回の意図的な行動として感じられるか（連打できず、ガードボタンにもなっていないか）
2. 先読みでBestが取れ、反応ではSuccess止まり、見てからでは間に合わない、という読み合いが成立しているか
3. 空振りのKuzushiが十分なリスクになっているか（理不尽に感じないか）
4. 背後・側面への瞬間移動が因果的に読めるか、それとも唐突か
5. 自動で選ばれる側面が納得できるか（tie時の「土俵中心寄り」）
6. 攻撃側のovershootが「引かれて前へ流れた」ように見えるか
7. Kuzushiした相手が振り向かないことで、優位が読み取れるか
8. 横移動による回避、Push対Push、Counterの3択が成立しているか
9. Counterを使わないときのAccepted Push / Contact / Movementが不変か

# Recommended Counter Semantics（要約）

ArrowDown（暫定）のedgeで、startupなしの12 tick window（暫定）を開く。windowの間に「相手Push Active × Contact」が成立した最初のtickでresolutionする。tierは相手Activeの経過tickで判定し、grace 2 tick（暫定）以内ならBest、それ以降はSuccess、成立しなければFail。

- Best: 攻撃側がKuzushi、防御側は背後へ。決着判定はPrototypeでは省略
- Success: 攻撃側がKuzushi、防御側は自動選択した側面へ
- 攻撃側にはovershootを与える
- Fail: 自分がKuzushi

Kuzushiは別のposture fieldで、その間は行動不能・brake・facing固定・押されやすさ係数がかかる。

# Rejected / Deferred

Rejected:
- Q1 A / B 単独、D（最初から別action）
- Q4 frame-perfect Best、momentum閾値だけでの判定
- Q6 B（自然なovershoot。F2により成立しない）
- clampによる土俵内への押し戻し
- 短いresolution移動（pathfinding化）
- turn-rate制限（初期）
- 外部から乱数を注入する方式
- Kuzushiを単一unionに入れる案（次案として可。Review判断）
- 同時押しの隠れた優先

Deferred:
- 引き・捌きの別action化、inashiのlateral外力（Q6 C）
- Push力のnormalとlocked directionの整合度依存（Lateral evadeの強化。Accepted Push semanticsの変更になる）
- 専用のDodge
- turn-rate付きのfacing復帰
- 決着確率の式とseed PRNGの導入（BoutOutcome / Ring-outと同時期）
- Harite
- stat由来のKuzushi時間・押されやすさ・overshoot
- 側面目標の前後offset
- relocationの弧tween表示
- Kuzushi中に被弾したときの延長などの細則
- Push距離の調整（Accepted Deferred）

# User Decisions Required

- **UD-1** Counterの意味: 共有のDown Counter（Best = pull / rear、Success = deflect / side）を推奨。Userの結果階層と整合するので、確認だけ
- **UD-2** 暫定binding ArrowDownでよいか
- **UD-3** 空振りの見た目: COUNTER表示 → KUZUSHI表示だけを推奨（後退モーションなどは無し）
- **UD-4** Best-Push Prototypeで即決着の確率を省略し、常にKuzushi + 背後とするか（推奨: 省略）
- （参考。Reviewer判断）Kuzushiを別posture fieldにするか単一unionにするか、Counter失敗の代償をKuzushiだけにするか

決定済み（再確認不要）: 側面は手動選択せず自動。近いvalid側面候補を選び、決定的なtie-breakで決める（本Reportは「土俵中心寄り → 攻撃者の右」をtie-breakとして提案）。

# Next Implementation Sequence

1. **ACTION-04A Down Counter Prototype**: Counter edge、window、tier判定、Push用の結果表、Kuzushi posture（行動不能・brake・facing固定・押されやすさ）、rear / sideの瞬時relocation、overshoot、Dummyの小修正、表示text、Q12のtest。User Play Test **REQUIRED**。Reviewで分割を望む場合は、04A-1（Counter + tier + Kuzushi、relocationなし）と04A-2（relocation + overshoot）に分けられる
2. **ACTION-04B Counter Feel Correction**（必要な場合）: window / grace / Kuzushi時間 / overshoot / 押されやすさの係数と、relocationの表示
3. Accept後に決める: lateral evadeの強化、引き・捌きの分離、Ring-out / BoutOutcome。**Counter + Ring-out + attributesを1 Taskに束ねない**

# Design Deviations

なし（Investigationのみ）。

# Unexpected Scope

なし。

# Verification

- Q1〜Q19に回答済み。BLOCKEDになる点はない
- Recommendation / Rejected / Deferred / User Decisionsを分けて記載
- Accepted BaselineとProposedを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはACTION-04A。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate down counter design`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
