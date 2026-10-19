# ARCHITECTURE

現在確定しているArchitectureのみを記す。未導入TechnologyをCurrentとして書かない。

## 確定

- Vite + TypeScript + Phaser 4
- Web-native
- Backendなしで開始
- Pure TypeScript simulation と Phaser presentation の分離
- Phaser Sceneをgameplay source of truthにしない
- deterministic / testableなgame logicはできるだけPure TypeScriptへ置く
- frame rate依存のgameplay calculationを避ける（fixed timestep + accumulatorを採用。下記「現状」参照）
- 長期management stateとbout runtime stateは分離する方向
- Platform integrationはadapter境界を作る方向。CrazyGames SDKをgameplay coreへ直接散らさない

## ゲームルールと描画の分離

```
Pure TypeScript Game / Simulation
        ↓
State / Results
        ↓
Phaser Rendering / Input / Animation
```

例（命名は決定事項ではない）：

- `BoutSimulation`: 相撲ルール、移動結果、stamina、balance、押し計算、ring-out / 勝敗条件、必要に応じてCPU判断の入力
- `BoutScene`: input、rendering、sprite、animation、camera、sound、presentation

Sceneのframe/updateに重要なGameplay Formulaを埋め込まない。
同じ意味のStateのSource of Truthを複数持たない。

## 初期Prototypeの方針

Small explicit designを優先し、過剰なFramework、ECS、DI Framework、Global Event Bus、汎用Rule Engine等を先回りで導入しない。

## 現状

- `src/main.ts`がPhaser Gameを起動する（logical sizeは暫定値）。
- `src/game/sumo/`にPure TypeScriptのBout境界がある（Phaser import無し）：
  - `BoutSetup`: 明示的な入力境界（participant identity、初期logical position、ring半径）。将来のManagement Stateはこの形へ変換して渡し、Bout runtimeの正本にはしない。
  - `BoutSimulation`: Bout runtime stateの正本。Setupをcopyして保持し、不正Setup（participant数・id重複/空・非有限値・ring半径）を拒否する。
  - `BoutSnapshot`: `getSnapshot()`が毎回返すcopy。consumerが変更してもcanonical stateへ影響しない。
  - `BoutSimulation.step(intents)`: 1 logical tick（60Hz、暫定）だけ進める。render deltaは受け取らない。participantごとのposition / velocity / facingがcanonical state。
  - `ParticipantIntent { move, pushPressed, counterPressed, gripPressed }`: source非依存のsemantic入力。`move`はworld-frame vector（Simulation側で長さ1にclamp）、`pushPressed` / `counterPressed` / `gripPressed`はそのtickの新しい押下edge（holdではない）。同じtickの優先順は Push > Counter > Grip で、負けたedgeは捨てる（queueしない）。raw keyはSimulationに入らない。
  - Movement model（grounded、self velocityに適用）: velocityをintent方向の平行成分と垂直成分に分解する。垂直成分は強く減衰（方向転換で滑らない）、逆向きの平行成分はまず制動で0へ、同方向は段階的に加速、入力なしは0まで制動、全体はMAX_SPEEDでclamp。velocityは引き続きcanonical state。係数は暫定（User Play Test対象）。→ position積分。facingは毎tick末に相手方向へ即時（座標系: +x右、+y下、facing 0 = +x、radian）。同一点では直前のfacingを維持。
  - `FixedStepAccumulator`: frame deltaを整数tick数へ変換（Phaser非依存）。1 frameのdelta上限とtick数上限を持ち、超過分は破棄。
- `src/game/input/movementVector.ts`: キー状態 → world-frame vector（画面基準: W=-y, S=+y, A=-x, D=+x。逆方向は相殺、斜めは正規化）。
- `src/game/input/pressLatch.ts`: key-downで1つの押下edgeを保持し、次のsimulation tickが1回だけ消費する（tick 0のframeでも失われず、1 frame内の複数tickへ重複しない）。SceneはArrowUp（Push）、ArrowDown（Counter）、Shift（Grip / Release。左右どちらでも同じ）（いずれも暫定binding）のPhaser key `down`（auto-repeatなし）を、それぞれ別instanceへ接続する。
- `src/game/input/pushDummyController.ts`: Contested Push検証用のPrototype harness（CPU AIではない）。Snapshot幾何だけを読み、毎Simulation tickに通常の`ParticipantIntent`を返す。mode `stationary`（零入力）/ `push`（離れていれば相手へmove、Contactなら移動せず、idleかつcooldown（`DUMMY_PUSH_COOLDOWN_TICKS`=30 tick、action終了後またはKuzushi終了後のidle stable tickから数える）明けに`pushPressed`を1回。Kuzushi中・GRAPPLED中は零入力でcooldownを満タンに保持し、cooldownは次のidle / stable / FREE tickから数える。Gripは出さない）。Simulation stateへ直接触れず、Push phaseも迂回しない。SceneはキーをMode切替（`1`=STATIONARY / `2`=PUSH、既定STATIONARY）に接続し、`R`はModeを保持してcontroller timingをresetする。
- `BoutScene`: Phaser keyboardを読んでIntentを作り、accumulatorで0..N tick進め、Snapshotを永続GameObjectへ一方向同期する。canonical stateは持たない。participant identityとcontroller / 見た目の対応（`PARTICIPANT_PRESENTATION`）はSimulation外のScene側にある。Opponentの駆動は`PushDummyController`（上記）。
- 単位: simulationはmeter、m/s、radian。meter→pixelのscale + translateはScene側（presentation）。
- Vitest導入済み（`pnpm test`）。
- 速度・加速度・減速度・tick rate・ring半径・spawn位置・body半径・色・logical sizeはPrototype / 暫定値でありFinal値ではない（User Play Testで調整する）。
- Contact（ACTION-03A）: 各participantはSimulation所有の円（`bodyRadius`、Snapshotで公開。暫定で同値0.35m）を持つ。`step()`の順序は 移動入力のsanitize → grounded self velocity更新 → position積分 → contact解決 → facing更新。contact解決は、`CONTACT_SLOP`付きの距離判定、法線A→B（同一点ならAのfacing方向）、接近方向の法線速度成分のみ除去（接線成分は保持、反発なし）、重なりの位置補正（接近方向のself velocity成分＝inward contributionの比で配分し、静止している側は動かさない。寄与が無い場合は動いている側のみ、両方または両方動いていなければ50/50。質量重み付けなし）。非接触時の移動はACTION-02Bと同一。
- Push（ACTION-03B）: 1押下 = 1回の離散Action（`action`: idle | push{startup / active / recovery, ticksRemaining, direction}）。開始時のfacingで方向を固定し、Action中はWASD操作を無効化（startup / recoveryは入力0として制動、activeは固定方向へgrounded ruleで踏み込む）。Action中の押下は無視（queueしない）。velocityは`selfVelocity`（自分の足運び。grounded ruleとcontactのclosing除去はここだけ）と`externalVelocity`（相手のPushで受けた運動量。独自の減衰とMAX clamp）に分離し、移動は和で行う。Snapshotの`velocity`は和（実際の移動速度）、`externalVelocity`はその内訳。contact中のactive Pushは net（A:+1, B:−1）× `PUSH_EXTERNAL_ACCELERATION`を法線方向に両者のexternalへ同量加える（同時Pushは相殺）。`step()`の順序: intent → Push開始 → 実効move → self velocity → external減衰 → 積分 → contact → Push解決 → Push timer → facing。数値はすべて暫定。
- Counter + Kuzushi（ACTION-04A1）: `action`に`counter{ticksRemaining}`（window 1 phase、`COUNTER_WINDOW_TICKS`=12）を追加。開始はidleかつstableのときだけで、Contact不要。window中はWASD無効（入力0として制動）。window中に「相手Push active × そのtickの実Contact」が成立した最初のtickで成功し、相手のPushをcancelしてKuzushiへ入れ、Counter使用者は即idleへ戻る（contact解決の後、Push力解決の前に判定するので、そのtickのPush力は掛からない）。tierは`counterTier()`で、相手Activeの経過tickが`COUNTER_BEST_TICKS`（=3、経過0〜2）未満ならBest、それ以外はSuccess。windowが切れたらFailで、使用者自身がKuzushi。Kuzushiは`action`とは別の`posture`（stable | kuzushi{ticksRemaining}）で、入口は`enterKuzushi()`だけ（actionをidleにする。不変条件: kuzushi ⇒ action idle）。`KUZUSHI_TICKS`=30の完全tickのあいだ持続する（tick先頭でtimerを進め、0なら入力処理の前にstableへ戻る。入ったtickは数えない）。Kuzushi中はPush / Counterを開始できず（queueしない）、移動入力0で制動、facingは固定（`updateFacing`をskip）。押し込まれる側がKuzushiなら、Push加速度に`KUZUSHI_PUSH_SUSCEPTIBILITY`（=1.5）を掛ける。将来のGrip保証は「有効range判定を通過した後、Kuzushiなら成功」とする境界だけを決めてあり、未実装。`step()`の順序: posture timer → intent → Push / Counter開始 → 実効move → self velocity → external減衰 → 積分 → contact → Counter解決 → Push解決 → action timer（Counter期限切れ → Kuzushi）→ facing（Kuzushiはskip）。Sceneは`KUZUSHI`（優先）/ `COUNTER`を表示する。数値はすべて暫定。
- Counter位置解決（ACTION-04A2）: 成功時、`resolveCounter`はPushをcancelする前に攻撃側のlocked Push方向`d`を控え、`counterRelocationTarget()`（pure）で防御側の移動先を決め、そのtickに位置を直接書き換える（瞬時。Simulationが正本で、経路探索や補間はしない）。基準は攻撃側の中心`P`、`perp = (-d.y, d.x)`、`R` = 半径の和。候補はrear `P - dR`、side+ `P + perp R`、side− `P − perp R`（いずれも重なりのないContact距離ちょうど）。sideの優先: 防御側のlateral offset `dot(perp, defender − P)`の符号（±`COUNTER_SIDE_EPSILON`=1e-6 m以内はtie）。tieなら土俵中心に近い方、それも同じならside+。Bestは rear → 優先side → 反対side、Successは 優先side → 反対side の順に試し、最初のvalidな候補を採る（valid = 有限かつ`|target| <= arena.radius − bodyRadius`。clampはしない）。全候補がinvalidなら移動しない（tierとKuzushiはそのまま）。攻撃側にだけ`d × COUNTER_OVERSHOOT_SPEED`（=1.0 m/s）をexternalVelocityへ加え、既存のMAX clampと減衰に任せる。既存のpair external momentumは消さない。Failは従来どおり（移動・overshootなし）。facingの規則は変更なし。
- Grip / Engagement（ACTION-05A）: pair-levelの`engagement`（`free` | `grappled{advantage: neutral | morozashi{holderId}}`）をSimulationが1つだけ持つ（participantに組みのflagは持たせない）。初期値は`free`で、Snapshotのtopレベル`engagement`として独立したcopyを公開する。`action`に`grip{reach | recovery, ticksRemaining}`を追加（`GRIP_REACH_TICKS`=6、`GRIP_RECOVERY_TICKS`=12）。Gripを開始できるのはFREEかつidleかつstableのときだけで、phase中は実効move 0。reach中、相手がaction idleで中心距離 ≤ 半径の和 + `GRIP_RANGE_MARGIN`（=0.09 m）になった最初のtickで成功する（相手のPush / Counter / Gripは中断しない）。成立した時点で相手がKuzushiなら`morozashi(holder = 掴んだ側)`とし、相手のKuzushiは即座に消費してstableにする。それ以外はneutral。同じtickに両者がreach中・stable・範囲内ならneutral（対称）。reachが切れたらwhiffでrecoveryへ入る（Kuzushiにはならない）。成立は`enterGrapple()`だけで行い、両者のactionをidleにし、両者の`externalVelocity`を成分ごとの平均にそろえ（同じ体格を仮定した暫定の正規化）、中心距離を半径の和ちょうどへ対称に寄せる。GRAPPLED中は毎tick、通常のcontactの後に`resolveGrappleBond()`で半径方向の距離を対称に補正する。両者のWASDは無効（制動のみ）で、FREE用のPush / Counter / Gripの開始もない。facingの扱いは下記のGrappled Orientationを参照。GRAPPLED中のGrip edgeはrelease: そのtickの先頭でFREEに戻り、押した側だけがGrip recoveryに入る（同時なら両者）。release tickの他のFREE用edgeは捨てる。位置・速度・facingは変えず、Morozashiは消える。`step()`の順序: posture timer → release → FREE action開始 → 実効move → self velocity → external減衰 → 積分 → contact → bond（GRAPPLED）/ Counter → Grip → Push（FREE）→ action timer → facing。Sceneは上部に`ENGAGE: FREE / GRAPPLED / MOROZASHI (PLAYER|CPU)`を表示し、組み中は2人の中心を線で結ぶ（neutralは白い細線、Morozashiはholder色の太線）。phase textに`GRIP` / `GRIP REC`を追加した。数値はすべて暫定。
- Grappled Orientation（ACTION-05B1）: pure module `src/game/sumo/grappleOrientation.ts`（Phaser非依存。SimulationとSceneが共有する）。`normalizeAngle`（(−π, π]、−πは+πにする）、`grappleFacingError`（相手への方位 − facing。中心が一致すれば0）、`isGrappleReady`（|誤差| ≤ `GRAPPLE_FACING_TOLERANCE` = π/12）、`turnFacingTowardGrapple`、`canActInGrapple`（GRAPPLEDかつREADYのときだけtrue。participant起点のgrapple actionはすべてこれを通す）。readinessは保存せず、position / facing / engagementから毎回導出する（側面・背後やtimerのstateは持たない）。FREEのfacingは従来どおり即時（Kuzushiは固定）。GRAPPLED中は`updateFacing`で各自が相手へ`GRAPPLE_TURN_RATE`（= π rad/s）× tickだけ最短方向へ回り、1 step以内ならbearingへsnapする（位置は動かさない）。誤差がほぼ±π（1e-9以内）のときは固定で+方向（画面時計回り）。readinessの判定はtick先頭の状態（直前のSnapshot）で行うので、tick tの末尾でREADYになった者はtick t+1から行動できる。releaseは`canActInGrapple`がtrueの者だけが行える（TURNING中のGrip edgeは無視し、queueせず、recoveryにもならない）。Counter Success → Grip（約90°）はREADYまで約26回、Best → Grip（約180°）は約56回の旋回更新が必要で、背後の方が自然に長い。正面のGripは成立した時点で両者READY。Sceneは、GRAPPLED中で他に表示すべきlabelがないとき`READY` / `TURNING n°`を表示する。数値は暫定。
- 未実装: Counterの即決着、回避 / 突っ張り、Grappled Drive / 寄り切り / Morozashi補正、mass / traction、ring-out / 勝敗、立合い、投げ・吊り、能力値、stamina / balance、CPU、Touch / Gamepad、render interpolation、Physics。
