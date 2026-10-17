Task-ID: ACTION-01-MOVEMENT-INPUT-TIMESTEP-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 572990944674f82f31964f8c27b369eaf26faefc
Agent-Start-Head: 073277f1092bea8113a7e7693ede1aae0b6eceba
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation-only Report Commit）。Q1〜Q10すべてに一意の推奨案を出した。User Decisionが必要な点は残るが、いずれも次のImplementation Task（ACTION-02）を止めない。各Decisionの推奨Defaultと、どのTaskまでに決める必要があるかは「User Decisions Required」に記載した。Production Source変更なし。

# Preflight

- working tree clean、branch develop、fetch後 `HEAD...origin/develop` = 0 2
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline 5729909 = 期待値、Handoff-Mode GITHUB
- Source-Baselineは origin/develop のancestor。Coordination Diff（5729909..origin/develop）は `docs/agent_handoff/CURRENT_TASK.md` のみ（6371892 review、073277f task）
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head 073277f
- 前TaskのFinal Review Handoffは 6371892 版のCURRENT_TASK.mdから読んだ（C-1 participant identity ≠ presentation role）

# Current Source Findings

- `BoutSimulation`: constructorでのSetup検証とcopy、`getSnapshot()`のみ。step、time、velocityは無い。下記の推奨Architectureは既存APIを壊さずに追加できる（Conflictなし）
- `BoutTypes`: `Vec2`、`ParticipantSetup{id, position}`、`ArenaSetup{radius}`（原点中心）、`BoutSnapshot`。単位は未定義で、Sceneが1unit=1pxとしてmappingしている
- `BoutScene`: `create()`で1回描画するだけで、`update()`は無い。`PARTICIPANT_STYLE[participant.id]`がid=role依存になっている（C-1）
- `main.ts`: `fps` configは未指定で、Phaserのdefault（target 60、smoothStep true、min 5fps）が使われる
- Phaser 4.2.1 source（`node_modules/phaser/src`）を確認した。外部資料はこれのみ：
  - `core/TimeStep.js`: delta smoothingは直近10frameの平均。1frameのdeltaは `1000/minFps`（=200ms）を超えると直前の値に置換される。blur中やfocus復帰直後はtarget delta（16.67ms）に制限され、focus時に`resetDelta()`される。`VisibilityHandler`がtab hiddenでloopを止める
  - → Phaserから渡るdeltaは、tab復帰時でも巨大値になりにくい。ただしsmoothingされたwall-clock近似であり、Gameplay時間の正本には向かない
  - `physics/arcade/World.js`: Arcade自体が `fixedStep: true`（default）+ `_elapsed` accumulatorで固定刻みを採用している。業界的にもfixed stepが標準であることの裏付け
  - `physics/arcade/Body.js`: BodyはGameObjectに紐付き、Scene所有になる。形状はcircleとAABBのみで、joint/constraintは無い

# Q1 — Input Intent Boundary

推奨：**全Phase共通の単一Intent contract**。Simulationは、Intentの意味をPhaseとInteractionStateで解釈する。

```ts
type ActionDirection = 'forward' | 'back' | 'left' | 'right'   // 力士自身の向き基準（semantic）
type ActionCommand =
  | { kind: 'direction'; direction: ActionDirection }
  | { kind: 'grapple' }
  | { kind: 'custom' }

interface ParticipantIntent {
  readonly move: Vec2                    // world frame、長さ≤1（Simulation側でもclamp）
  readonly action: ActionCommand | null  // このtickで新たに押されたAction（edge）
}

simulation.step(intents: ReadonlyMap<ParticipantId, ParticipantIntent>)
```

- **raw key非依存**: Simulationは`move`ベクトルと`ActionCommand`だけを知る。W/A/S/D、Space、矢印、Touch、Gamepadの対応付けはPresentation側の`KeyboardIntentSource`等の責務とする
- **同じdirectionでもStateで意味が変わる**:
  - FREE: left=左突っ張り、right=右突っ張り、forward=押す、back=引き技
  - GRAPPLED: forward=寄る、left=左投げ、right=右投げ、back=吊り
  - TACHIAI: forward=当たり、left=変化、right=掴み、back=様子見
  - LIFTED: actionは無視し、lifterの`move`のみ有効
  - これをPhase別contractに分けると、Adapter側にState知識が漏れる。単一contractの方が、Touch、CPU、remapを追加してもSimulationが壊れない
- **Tachiai timing**: Gaugeの値はSimulationが所有しtickで進める。Snapshotで描画用に公開する。tachiai中の`direction` actionの到着tickでGaugeを止め、その時点の値（0〜1）を操作結果として確定する
  - Sceneで値を算出するとrender frame rate依存になり、CPUが同じruleを共有できない
- **Edge処理**: 押下のedgeはAdapterがbufferし、次の`step`で1回だけ消費する。1 render frame中に0〜複数tickが走っても押下を失わず、二重発火もしない。`move`はtick時点の保持状態をsampleする
- **Player/CPU共有**: CPUは `(snapshot, selfId) => ParticipantIntent` のPure関数とする。Playerと同じcontractで、`step`に渡す
- **C-1の解消点**: 「どのparticipantをKeyboardやCPUが操作するか」は、Simulation外の`BoutControlAssignment`（Scene層、participant id → controller）に置く。StyleもScene層でid→styleを明示的にmapする。Simulationはroleを知らない

# Q2 — Movement Ownership

- canonicalはすべて`BoutSimulation`内部に置く：position、velocity（Q8）、facing
- Desired movement（Intent）は`step`の引数で、保存しない（Snapshotにも含めない）
- `step()`内の順序は1関数に明示的に並べる（汎用pipeline frameworkは作らない）：
  1. Phase / Interaction遷移とaction解決（後続Task）
  2. Interactionに応じた各participantの希望移動
  3. 積分（velocity → position）
  4. 拘束（body separation、LIFTED attach）（後続Task）
  5. facing更新（Q7）
  6. Outcome判定（ring-out等）（後続Task）
- **Scene同期**: Sceneは毎render frameで`getSnapshot()`を読み、id→GameObjectのmapに座標を反映する（一方向）。GameObjectの`x/y`をSimulationへ書き戻さない
- **LIFTED**: lifted側のpositionは独立移動しない。各tickの拘束段で、lifterのpositionとfacingから算出した従属位置へ置く。lifted側の`move`は無視する
- **GRAPPLED**: 2人とも各自のpositionを持ち続ける。組んだ2人の移動の合成方法（寄り、押し合い）はGrapple / Push Taskで決める。Movement Taskでは扱わない

# Q3 — Time-Step

推奨：**fixed timestep + accumulator。render interpolationはDefer**。

```
Phaser Scene.update(time, deltaMs)
  └─ accumulator += min(deltaMs, MAX_FRAME_MS)
     while accumulator ≥ STEP_MS and steps < MAX_STEPS_PER_FRAME:
        simulation.step(intentsFromSources())
        accumulator -= STEP_MS
  └─ render(simulation.getSnapshot())
```

- `BoutSimulation.step()`は**dtを受け取らず、常に1tick進める**。tick長はSimulation定数（または`BoutSetup`）で、frame rateから独立する
- accumulatorは小さなPure TypeScript関数にし、Vitest対象にする（例：deltaの列 → 実行tick数）。Sceneはそれを呼ぶだけ
- spiral of death対策：`MAX_FRAME_MS`と`MAX_STEPS_PER_FRAME`でclampし、溢れた時間は捨てる（slow motion化）
  - Phaserも200ms超のdeltaを置換するが、二重の安全として持つ
- **pause / tab background**: Phaserがloopを止め、focus復帰時にdeltaをresetする。tachiai gaugeもtick駆動なので、pause中に不公平に進まない
- 比較：

| 方式 | 判定 | 理由 |
|---|---|---|
| variable delta直接 | Rejected | 押し、衝突、momentumの結果がfps依存になる。60Hzと144Hzで勝敗が変わり得る。Testが非決定的 |
| fixed + accumulator | **Recommended** | 決定的。Player/CPUが同一tickのruleを共有する。Vitestで「N tick後の状態」を厳密にTestできる。実装は小さい |
| fixed + interpolation | Deferred | 高Hz displayでのjudder対策。Snapshotはcopyなので、prev/currentの2つを持つだけで後付けできる。Play Testで目立った時に追加する |

- 応答性：入力→反映の遅延は最大1tick + 1frame程度になる。60Hzなら体感上の問題は小さいと見込む（Play Testで確認）
- **Hz**: 初期値として60Hzを推奨する。検討rangeは30〜120Hz。Final値にはせず、ACTION-02の定数としてPlay Testで検証する
- 乱数を使う場合は、Seed付きRNGをSetup経由で渡す。`Math.random`をSimulation内で直接使わない（決定性とTestのため）
- 目標はsingle-client決定性。Network lockstepレベルのcross-browser浮動小数一致は目標外

# Q4 — Coordinate / Time Units

- **logical unitはメートル**：
  - 土俵の内径は実際に約4.55m（半径≈2.275m）。これを初期fixtureにでき、Height(cm)、Weight(kg)とも直感的に結び付く
  - 値はPrototype fixtureとして扱い、Final値ではない
- 速度：m/s。将来の加速度：m/s²。momentumを導入する場合は質量（kg）×速度を基本とするが、formulaは後続で決める
- 時間：Simulation内部はtick（整数）。調整値は秒で書き、tick換算は1箇所で行う（例 `secondsToTicks`）。msはPhaserとの境界（accumulator）だけで使う
- 軸：原点=土俵中心、x右、y下（canvasと同じ向き）。Scene transformはscale+translateだけで済む
- Scene transform：`pixelsPerMeter = (min(canvasW, canvasH)/2 × margin) / ringRadius` のような小さな関数をScene側に置く。現在の1unit=1pxは、ACTION-02でmeter fixtureへ置き換える（Prototype値の変更なので許容範囲）
- Unit Frameworkやbranded typeは導入しない。field名とcommentで単位を明記する

# Q5 — Physics Adoption

結論：**Do Not Use for Gameplay Core**（Arcade、Matter.jsとも）。Prototype experimentは不要と判断した。

- Arcade Physics：
  - BodyがGameObject/Sceneに所有され、「SimulationがState正本」というAccepted原則と衝突する
  - 円/AABBの分離のみで、constraintが無い。組み、吊り、投げ、balanceを表現できない
  - 衝突分離heuristicの調整余地も限られる
- Matter.js（Phaser内蔵版）：
  - Scene world経由で、同じくScene結合になる。単体の`matter-js`を使えば新Dependencyになる
  - 汎用rigid bodyの挙動（回転、摩擦、反発）を、相撲の状態駆動（FREE/GRAPPLED/LIFTED、技のcommitment）に従わせるのは、得るものより戦う量が多い
  - 決定性、Test性、Game Feel調整がいずれも困難
- Custom Pure TypeScriptで必要な数学はごく小さい：
  - 2円の重なり分離：距離 < r1+r2 なら法線方向へ押し戻す
  - ring-out：中心距離 > 土俵半径（体の判定基準は後で決める）
  - 速度積分と減衰
  - 「押し」はこの上に明示的なformulaとして載せる。Game Feelの調整は数値と式を直接いじれる方が速い
- Phaserは描画、Tween、Particle等のPresentation演出にのみ使う（Physics不要）

# Q6 — Interaction State Model

InteractionはParticipant個別ではなく「2人の関係」なので、Bout全体の1つのStateとして持つ。PhaseとOutcomeは分離する。

```ts
type BoutPhase =
  | { kind: 'tachiai'; gauge: number /* 0..1 */; /* 選択や確定状況 */ }
  | { kind: 'engaged'; interaction: Interaction }
  | { kind: 'finished'; outcome: BoutOutcome }

type Interaction =
  | { kind: 'free' }
  | { kind: 'grappled' }
  | { kind: 'lifted'; lifterId: ParticipantId; liftedId: ParticipantId; ticksRemaining: number }

interface BoutOutcome { winnerId: ParticipantId; loserId: ParticipantId; reason: string /* 決まり手は後続 */ }
```

遷移図：

```
TACHIAI ──(両者確定・結果解決)──► ENGAGED{free}
   │                               │  ▲
   └──(掴み成立)──► ENGAGED{grappled}│  │ grapple action（解除）
                     │  ▲  ▲        │  │ throw & continue
    grapple成功 ─────┘  │  │        ▼  │
    (from free)         │  └── lift失敗（grappledのまま）
                        │
   lift成功 ──► ENGAGED{lifted} ──(ticksRemaining=0 / 能力限界)──► ENGAGED{grappled}

いずれのState ──(throw決着 / ring-out / その他決着)──► FINISHED{outcome}
```

- 遷移元はすべて`step()`内の1つのswitchに集約する。State Machine frameworkは作らない
- TypeScriptのdiscriminated unionで、不正な組み合わせ（free中のlifterId等）を型で表現できなくする
- LIFTED：lifterの`move`のみ有効。lifted側のIntentは全無視。standard actionはlifter側も無効
- Outcomeは`finished`に到達したときにだけ存在する。「投げ成功」と「決着」は別の判定で、投げ成功→continueならfreeへ戻る
- Ambiguity（後続Task向け、ACTION-02は不要）：
  - GRAPPLEDは対称（両者が組んでいる）か非対称（片方だけが掴む）か → U4
  - FREEでgrapple失敗時の扱い（recovery tick等）

# Q7 — Auto-Facing

- **facingはcanonical runtime stateとして保存する**（角度radian、0=+x）。ACTION-02での更新ruleは「毎tickの終わりに相手方向へ即時に向く」
- 描画時にpositionから導出するだけでは不十分な理由：
  - 導出をSceneで行うとruleがSceneに入る
  - 将来、次の要素がfacingを独立に必要とする：旋回速度の上限（Speed）、変化で相手が一瞬背を向ける、投げで向きが回る、技中のfacing lock、横・背後からの攻撃判定
- 保存しておけば、ruleを「即時追従」から「制限付き追従」等へ差し替えても、Snapshotとcontractは変わらない
- movementはfacingに拘束しない（world frameのmove。横移動、後退は自由）。Action directionはfacing基準（Q1）なので、自動facingは技表現を制限しない

# Q8 — Momentum / Balance Foundation

- ACTION-02で追加するのは **`velocity`（m/s）のみ**：
  - 移動は「Intent → 目標速度 → 加減速で追従」とし、加速、減速、最高速は名前付き定数にする
  - 即時速度（velocity = intent × speed）でも動くが、momentumがAccepted方向なので、最初から速度Stateを持つ方が後続の押しに繋がる。数値はPlay Testで調整する
- 予約するのはfieldではなく **境界1点**：
  - 「外力・衝撃をvelocityへ加える」処理を、積分前の1箇所に置く
  - 押し、突っ張り、立合いの衝撃は、後続Taskでここへ合流させる
- Balance、stamina、`currentAction`、recoveryは、それを使う最初のTaskで追加する。placeholder fieldは作らない
- Presentation向けの`events`（衝撃、State遷移）を`step`の戻り値にするのも、最初に必要になるTask（突っ張り/立合い）で追加する

# Q9 — Parameter vs Runtime Boundary

```
Management (future)  Rikishi{stableId, name, history, parameters...}
        │  toBoutParticipantSetup()  ← Simulation外の変換関数（copy）
        ▼
BoutSetup.participants[i] = { id, position, attributes }   ← immutable入力（Simulationがcopy保持）
        ▼
BoutSimulation 内部:
  static  : attributes（とattributesからの導出係数。constructorで1回計算）
  runtime : position, velocity, facing, (後で) stamina, balance, currentAction...
```

- `attributes`はReadonlyなplain dataで、Setupに入れて渡す。SimulationはFOUNDATION-02と同様にcopyする。Bout中は不変
- 体格（Height cm / Weight kg）は物理単位のまま渡し、Skill値は無次元値として渡す。値域は未決（後続の能力値Taskで決める）
- 体格から当たり判定半径などへの導出は、constructorで1回だけ行う
- Runtime Stateは毎Bout初期化し、Managementへ書き戻さない。結果（勝敗、決まり手）は`BoutOutcome`として返す
- `ParticipantId`はBout内の識別子で、Managementの`stableId`を入れてもよい。Presentation role（操作者、色、ラベル）は前述の`BoutControlAssignment`とScene側のstyle mapで、idに対して明示的に割り当てる → C-1を構造的に解消する
- ACTION-02では`attributes`をまだ追加しない（Movementが能力値に依存しないうちは不要）

# Recommended Architecture / State-Intent Flow

```
[Keyboard / Touch Adapter]  [CPU (snapshot,id)→Intent]      ← Scene層 / sumo層Pure関数
          └──────────┬──────────────┘
           BoutControlAssignment (id → source)               ← Scene層。roleはここだけ
                     ▼  ParticipantIntent per id
Scene.update(delta) → FixedStepAccumulator → BoutSimulation.step(intents)  (×N tick)
                                                 │ canonical: phase, interaction,
                                                 │ position, velocity, facing
                                                 ▼
                                          getSnapshot() (copy)
                                                 ▼
                             Scene render: meter→pixel transform, id→GameObject
```

# Rejected / Deferred Alternatives

- Rejected：
  - variable delta直接simulation
  - Phase別Intent contract
  - raw keyをSimulationへ渡すこと
  - Sceneでgauge/facingを算出すること
  - Arcade / MatterをGameplay coreにすること
  - 1unit=1pxのまま進めること
  - Participant単位のInteraction State
  - State Machine / ECS / Event Bus framework
- Deferred：
  - render interpolation
  - 旋回速度の制限
  - 非対称grip
  - balance、stamina、currentAction
  - step events
  - attributes
  - Seed付きRNG（乱数が必要になった時）

# Design Conflicts / Ambiguities

- Current Source、AGENTS、ARCHITECTURE、Accepted DirectionとのMaterial Conflictは**なし**。ARCHITECTUREの「fixed step / delta time設計は後続Action Designで決める」に、本Reportが回答する
- 「WASDで前後左右」の基準系が曖昧（画面基準か相手基準か）。contractはworld frameなので、どちらもAdapterで実現できる → U1
- 方向Action（突っ張り、投げ等）とWASD移動が同じキーかどうかが未定。「LIFTED中はWASD Movementのみ、他のActionは不可」という記述から、Action入力はMovementと別系統と読むのが自然 → U2

# Next Implementation Sequence

1. **ACTION-02 Movement Foundation**
   - 内容：fixed-step accumulator、`step(intents)`、world-frameのmove intent、velocityの加減速、auto-facing、WASD Keyboard adapter、`BoutControlAssignment`（C-1解消）、meter単位へのfixture移行、Sceneの毎frame同期
   - 衝突、押し、Actionは含めない
   - Technical Gate：
     - 決定性（同じIntent列 → 同じState）
     - delta列が違っても総時間が同じなら同じtick数・同じState
     - move長のclamp、facingが相手を向くこと
     - Phaser非依存
     - build、Browser Smoke
   - User Play Test：**REQUIRED（movement feel）**。最初のPlay Test Gate
2. **ACTION-03 Body Contact & Push / Ring-out**
   - 内容：円の分離、押し（velocity境界への外力）、ring-outによる`finished`、取組のreset
   - 相手は「前進するだけのDummy CPU intent」（Test fixture扱い）
   - Technical Gate：分離・ring-out判定の境界Test
   - User Play Test：**REQUIRED（push / impact feel）**。中心仮説「押し合いが面白いか」をここで検証する
3. **ACTION-04 Tachiai Phase**
   - 内容：tick駆動gauge、4択、`engaged{free|grappled}`への遷移、最小の結果解決
   - User Play Test：REQUIRED（timing / tachiai feel）
4. **ACTION-05 Grapple（FREE↔GRAPPLED、寄り）** → **ACTION-06 Throw / Lift（LIFTED）**
   - 各Taskの前に、formulaを決める小さなDesign Taskを挟むことを推奨する
   - User Play Test：REQUIRED
5. FREEの突っ張り、引き技、Custom Action、CPUの本格化、能力値`attributes`導入は、上記の手応えを確認してから進める

# User Decisions Required

いずれもACTION-02の開始を止めない。推奨Defaultで進め、Play Testで覆してよい。

- U1：WASD移動の基準系
  - 推奨：画面基準（Touch joystickとも一致する）
  - 期限：ACTION-02のAdapter実装時
- U2：方向Actionのキー
  - 推奨：Movement（WASD）とは別の、矢印キー等
  - 期限：ACTION-03/04まで
- U3：立合い入力
  - 推奨：方向キーを1回押すとgaugeが止まり、同時にActionが確定する
  - 期限：ACTION-04まで
- U4：GRAPPLEDの対称性
  - 推奨：Prototypeでは対称
  - 期限：ACTION-05まで
- U5：tick rate
  - 推奨：60Hz（暫定、検証対象）
- U6：移動モデル
  - 推奨：velocityに加減速を付ける方式（即時速度ではなく）
  - 期限：ACTION-02のPlay Testで確認する

# Design Deviations

NONE

# Unexpected Scope

なし。Current Sourceの修正もしていない。

# Verification

- Current Sourceをinspectした：BoutTypes、BoutSimulation、test、BoutScene、main.ts、package.json、AGENTS、ARCHITECTURE、GAME_CONCEPT、前Review
- Phaser 4.2.1 sourceを確認した：TimeStep、VisibilityHandler、Arcade World/Body
- Q1〜Q10すべてに回答した。Recommendation、Rejected、Deferredを区別した
- Production Source、package、lockfileは変更なし。Repository変更は本Reportのみ
- `git diff --check`: PASS
- `pnpm test` / `pnpm build`：Source未変更のため未実行

# User Play Test

NOT REQUIRED（Investigation）。ACTION-02以降でRequiredにすることを推奨する（上記参照）。

# Git delivery

Investigation-only Report Commit Exceptionを適用する。本Reportのみを1 commit（`docs(agent): investigate action movement architecture`）で`origin/develop`へpushする。mainは変更しない。
