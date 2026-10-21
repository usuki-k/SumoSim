Task-ID: ACTION-04A4-COUNTER-TRANSITION-IMPLEMENTATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 8731b0e2ad64113f7942ecf0b841d8daa3138397
Agent-Start-Head: 1987552a5c686accdfd9260d8a45bd35812c9b70
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Runtime Smoke PASS。User Play Testは未実施）。

- Counter成功（Success / Best）の瞬間移動を、Simulationが持つpair-levelの `counterTransition`（120 tick、約2.0秒）に置き換えた
- D1〜D4はすべて実装した
- 遷移中は、2人とも入力lock。正本の位置は、決定的なpathで連続して動く
- 接触の補正はpathを邪魔しない。ring-out / Tokudawaraは、毎tick、2人とも通常どおり判定する
- 有効な候補が無い場合は、ACTION-04A2のfallbackのまま（遷移は始まらない）
- 失敗したCounter、Counterの窓 / tier、ring-outの勝敗の意味は、変えていない
- テスト: `pnpm test` 292件PASS（変更前は262件）、`pnpm build` PASS、`git diff --check` PASS
- 実際のゲームでのsmoke（Success / Best）もPASS

**User Play Testでの最重要の確認点**
- 遷移中もCounter userに土俵外の免除は無い（Design Reviewの訂正どおり）
- そのため、**土俵際へ押し込まれた側がSuccessでCounterすると、横へ回り込む途中で土俵を出て負けることがある**
  - offlineの探索では、+x Tokudawara付近の端の配置で、遷移の約4.7%
- 従来の瞬間移動では、その局面は勝ちだった
- 設計上は受け入れた結果だが、gameplayへの影響が大きいので、User Play Testで判断してほしい（§Ring-out）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 3`
- Remote CURRENT_TASK
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `8731b0e`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- 変更の範囲
  - `8731b0e..origin/develop`、HEAD（`2ee9119`）から `origin/develop` までのどちらも、`CURRENT_TASK.md` のみ
- `merge --ff-only` → HEAD `1987552`
- Design Review（`7006129`）とUser Decision（`8731b0e`）を読んだ
  - 土俵外の免除なし
  - 候補の判定は、終点を基準にした既存の条件
  - 候補が無い場合は既存の動作を保つ

# Current Source Delta

- `BoutTypes.ts`
  - `BoutCounterTransition`（`none` | `active{tier, counterUserId, pusherId, ticksRemaining}`）
  - `BoutSnapshot.counterTransition`
- `BoutSimulation.ts`
  - 定数 `COUNTER_TRANSITION_TICKS = 120`、`COUNTER_STAGGER_DISTANCE = BODY_RADIUS`
  - `counterRelocationTarget` が、候補の相対角度 `theta` も返すようにした（`CounterTarget`。返り値は `Vec2` の拡張なので、既存の呼び出しはそのまま）
  - `counterStaggerEase` / `counterWrapEase`
  - 内部状態 `counterTransition`
  - `resolveCounter` の開始の処理、`step` の分岐、`stepCounterTransition`（各tick / 完了）
  - ring-outの呼び出しを `resolveRingOutFrom` に共通化（動作は同じ）
  - Snapshotのcopy
- `pushDummyController.ts`: 遷移中は `NO_INPUT`、cooldownは満杯
- `BoutScene.ts`（debugのみ）: 遷移中のCounter userのphase textを `COUNTER BEST` / `COUNTER SUCCESS` にする
- `docs/ARCHITECTURE.md`: Counterの節（下記）

# State Shape

公開（Snapshotのtopレベル。pairで1つ）:

```ts
type BoutCounterTransition =
  | { kind: 'none' }
  | { kind: 'active'; tier: 'best' | 'success'; counterUserId; pusherId; ticksRemaining }
```

- `ticksRemaining` = これから行う遷移のtick数（次のtickを含む）
  - 開始時は120
  - 0になるのは、最後の遷移tickで勝敗が決まり、freezeした場合だけ

内部（`ActiveCounterTransition`。公開しない）:
- 参照: `counterUser`、`pusher`
- `ticksElapsed`
- 捕えた時に固定する値: `direction` d、`pusherStart`、`pusherEnd`、`startRadius` / `startTheta`、`endRadius`（半径の和）、`endTheta`、`counterUserEnd`
- path上の座標は、正本のparticipantの位置としてだけ存在する（位置の正本を2つ持たない）

# Entry Semantics（`resolveCounter`。捕えたtick）

1. `d`（固定したPushの方向）と、tier（`counterTier`。変更なし）を取る
2. `pusherEnd = pusherStart + d · COUNTER_STAGGER_DISTANCE`
3. `counterRelocationTarget(tier, pusherEnd, d, 半径の和, counterUserの位置, radius − bodyRadius)`
   - 候補の順序、好みの側の規則、保守的な円の条件は、既存のまま
   - 基準だけを、D4に従ってpusherの終点にした
4. `enterKuzushi(pusher)`、`counterUser.action = idle`（既存）
5. targetがあれば
   - 瞬間移動はしない。`COUNTER_OVERSHOOT_SPEED` も足さない
   - 2人のself / external velocityを0にする（D3）
   - 遷移を `active`、`ticksElapsed = 0` で始める
   - 開始の半径と角度は、捕えた時の相対位置から、pusherの `(d, perp)` 系で求める
6. targetが無ければ、ACTION-04A2のfallback（下記 §null-target）
7. このtickの残り（Grip / Push / action timer / facing / ring-out）は、既存の順序のまま
   - Pushは取り消されたので、Push forceは無い
   - Gripはreachしている者がいないので、起きない
   - 捕えたtickの終わりに、2人の正本の位置は、捕えて接触を補正した位置のまま

# Transition Tick Order（`step` → `stepCounterTransition`）

1. outcomeのfreezeの判定（既存。決着後は何もしない）
2. `counterTransition.kind === 'active'` なら、この分岐だけを行う
   - intentは読まない
   - posture / 解除 / Drive / action開始 / 積分 / 接触 / 組みの結合 / Counter / Grip / Push / action timerは行わない
3. 2人の直前の位置を記録する
4. `ticksElapsed += 1`
   - 最後のtick（120）: pusherを `pusherEnd`、Counter userを `counterUserEnd` に厳密に置く
   - それ以外: pathの式で位置を置く（下記）
5. 速度を報告する（pusher: self 0、external = 変位 / dt。Counter user: self = 変位 / dt、external 0）
6. `updateFacing()`（既存の規則）
7. `resolveRingOutFrom(直前の位置)`（既存の `resolveArenaRingOut`。2人とも）
8. 最後のtickで、まだongoingなら完了

**通常のtickとの違い**
- pusherのKuzushi timerは、この分岐では `advancePosture` を呼ばないので、止まる
- 接触の補正を行わないので、pathと競合しない

# Completion Semantics（tick 120の終わり、ongoing）

- 位置: pusherは捕えた位置 + d · 1.0R。Counter userは、その終点の真横（Success）/ 真後ろ（Best）で、半径の和ちょうど
- 速度: 2人とも、selfもexternalも `{0, 0}`
- action: 2人ともidle。engagement: FREE
- posture
  - pusher: `enterKuzushi` で `{kuzushi, KUZUSHI_TICKS}`（D2）
  - Counter user: stable
- facing: 既存の規則の結果のまま
- `counterTransition = none`
- **次のtickから入力が戻る**
  - 押しっぱなしのWASDは、すぐ効く
  - 押した瞬間の入力は、そのtickに新しく来たものだけ

# Success / Best Path

- `u = k / 120`
- pusher: `P(u) = P0 + d · L · (1 − (1 − u)²)`、L = 0.35 m
- Counter user: `C(u) = P(u) + d·r·cosθ + perp·r·sinθ`、`perp = (−d.y, d.x)`
  - `s = 3u² − 2u³`
  - `r = r0 + (半径の和 − r0)·s`、`θ = θ0 + (θ1 − θ0)·s`
- 目標の角度θ1
  - side+ = +π/2、side− = −π/2
  - Bestのrear = 好みの側の符号 × π（好みの側を回って背後へ）
- **共通**: 120 tick、入力lock、pusherのpath、接触の扱い、ring-out、速度、向き、Kuzushi
- **違い**: θ1と候補の順序だけ（Success: 好みの側 → 反対側、Best: rear → 好みの側 → 反対側）
- 2人の距離は、常に `min(r0, 半径の和)` 以上
  - pusherの体を通り抜けない
  - 毎tick、≥ 半径の和 − 1e-9 をtestで確認した

# Null-target Behavior

- 終点を基準にした有効な候補が無い場合は、**Counter transitionを始めない**
- ACTION-04A2のfallbackを、そのまま残した
  - 移動しない、pusherはKuzushi、Counter userはidle
  - pusherにだけ `d × COUNTER_OVERSHOOT_SPEED` を足し、既存の勢いは残す
  - 入力lockもない（従来どおり）
- `COUNTER_OVERSHOOT_SPEED` は、このfallbackだけで使い続ける（dead constantではない。コメントを更新した）
- D1〜D4は遷移についての決定なので、遷移が無いこの場合とは衝突しない
  - 新しい結果を作ったり、重なりや無効なtargetを許したりもしない
  - そのためSTOPせず、既存の意味を保つ実装にした
- 確認: T81の統合テスト（変更なし）と、新しいテスト「no valid target keeps the ACTION-04A2 fallback」
  - 60 tickの間、遷移なし、有限、重なりなし、ongoing

# D1–D4 Evidence

- **D1**: `COUNTER_STAGGER_DISTANCE = BODY_RADIUS`（0.35 m）
  - Success / Bestとも、pusherの移動はちょうど d · 0.35（T85、新しいtest「D1 / D4」）
  - runtimeの実測: Best (0,0) → (−0.35,0)、Success (−0.02,0) → (−0.37,0)
- **D2**: 遷移中、pusherのKuzushiは `{kuzushi, 30}` のまま止まる
  - 完了時に改めて30。次のtickで29（T89、「D2: paused… renewed」）
  - 完了直後のGripでMorozashi（T101、T108、「D2: after completion…」、runtimeでも確認）
- **D3**: 捕えたtickで、2人の速度とexternalを0にする
  - 前の勢いが大きくても（約2.4 m/s）、pathは同じ（T84 ×2、「D3: entry clears…」）
- **D4**: 終点の相対配置
  - Successは真横（d方向の成分が0）、Bestは真後ろ（d方向の成分が −半径の和）。距離は半径の和ちょうど（T78、T79、T87、「D1 / D4」）

# Input Lock Evidence

- 遷移中、WASD / Push / Counter / Grip / Driveを毎tick送っても、Snapshotは何も送らない場合と完全に一致する
  - actionは常にidle、engagementはFREE（「ignores movement, Push, Counter, Grip and Drive…」）
- 完了後、最初のtickで押しっぱなしの移動が効き、遷移中の押下は溜まっていない。新しいedgeは効く（「held movement acts on the first tick…」）
- T101: 遷移中のGripのedgeは捨てられる
- dummy: 遷移中は、idle / stableでも `NO_INPUT`。完了後の最初のPushは、ちょうどcooldownの30 tick後（T74b）

# Contact Evidence

- 遷移中は `resolveContact()` を呼ばない
- 毎tickの正本の位置は、pathの式から独立に計算した期待値と1e-12で一致する（「follows the documented deterministic path exactly every tick」）
  - 接触の補正などは混ざっていない
- 距離は、毎tick ≥ 半径の和 − 1e-9（「pair never overlaps」）
- runtimeの最小距離は 0.700000

# Ring-out / Tokudawara Evidence

- 毎tick、2人とも `resolveArenaRingOut(直前 → 現在)` を通る（`BoutCounterTransitionRingOut.test.ts`）
  - 呼び出しの引数が、2人の直前 / 現在の位置と一致する
  - resolverの結果（aが先 / bが先 / 同時のRematch）を、そのまま採用してfreezeする
- 結果の一致: Tokudawaraの窓の付近を含む複数の配置で、毎tickのoutcomeが、記録した線分に対する共通resolverの結果と一致する（「every transition tick decides exactly what the shared resolver decides」）
- 実際の配置での途中の決着
  - **pusherが外へ出る**: Tokudawara arenaで、Counter userが張り出しの中にいるBest
    - 遷移の5 tick目でpusherが負ける（「the pusher can ring out mid-transition」）
  - **Counter userが外へ出る**: 中点 (1.75, 0)、Success
    - 最終の横の目標は有効なのに、回り込みの途中（32 tick目）で円の外へ出て負ける（「the Counter user can ring out mid-transition（no immunity）」）
- **境界ちょうどはIN**
  - Counter userが通る最大の半径を、そのまま土俵の半径にすると、決着せずに完了する
  - その半径を1 ulp小さくすると、ちょうどそのtickで負ける
- **Tokudawaraの張り出し**: 同じpathで、円の土俵ではCounter userが負け、Tokudawaraでは負けずに完了する（張り出しの中で、半径2.275 mを越える）
- **freeze**: 決着したtickの状態が、そのまま残る（遷移は `active` のまま。完了の処理は行わない）
- offlineの探索（scratchpad。本番のSimulationを総当たりで実行）
  - +x窓の付近の 262,519 遷移: Counter userが出る 12,294件（4.7%）、pusherが出る 540件、**同じtickに2人とも出る 0件**
  - 盤面全体の粗い探索でも、2人同時は0件
  - そのため、同時のRematch / 先に出た方の判定は、resolverを包んだtestで確認した（上記）
- 窓の側線を通って、同じtickの中で出て戻るケースは、明示的なfixtureを作れていない
  - 共通resolver（`firstArenaExitFraction`）に委ねていることと、窓の付近の一致testで確認した（Known Untested）

# Facing Evidence

- pusher: Kuzushiなので、既存の規則で向きを固定する
  - test T89で毎tick不変
  - runtimeでも遷移中ずっと一定（`fb` が不変）
- Counter user: 既存のFREEの規則で、毎tick pusherへ向く
  - runtimeのSuccessで、0 → 1.571 radへ連続して回った
- 新しい向きの規則は足していない
- 既知の延期事項（直していない）: 遷移の後、pusherのKuzushiが終わる瞬間に、FREEの規則で相手へ1 tickで向き直る（Bestでは約180°）

# Velocity Evidence

- 各遷移tick: pusherの `velocity == externalVelocity == 変位 / dt`、Counter userの `velocity == 変位 / dt` でexternalは0
  - 「velocities report the per-tick path displacement」で、1e-9で確認
- 位置はこの速度で積分しない（pathの式と1e-12で一致）
- 完了時は、2人とも0（同test、T86）
- 決着でfreezeしたときは、そのtickの値のまま

# Kuzushi / Morozashi Follow-up Evidence

- 遷移中は、Kuzushiは30のまま
- 完了時に30。そこから既存のとおり30 tickの間、Kuzushi
- Grip
  - 完了後、Kuzushi中の最初のtickでGripすると、Morozashiになる
  - Kuzushiの最後のtickでも、Morozashiになる
  - その次のtickではstableなので、neutralになる（T108。既存のT98と同じ数え方）
- 背後 / 横から組んだ後、向き直る量（T117〜T120、T126、T127）は、遷移の後でも従来どおり

# Snapshot / API Changes

- `BoutSnapshot.counterTransition`（topレベル。毎回copy）
  - 返したSnapshotを書き換えても、正本には影響しない（「counterTransition is a top-level isolated copy」）
- topレベルのkeyを厳密に比べるtestを、意図して更新した: `BoutDrive` T148、`BoutOrientation` T126、`BoutRingOut` T172
- export
  - `COUNTER_TRANSITION_TICKS`、`COUNTER_STAGGER_DISTANCE`、`CounterTarget`、`counterStaggerEase`、`counterWrapEase`
  - `counterRelocationTarget` の返り値は `CounterTarget | null`（`Vec2` を拡張したもの）

# Changed Files

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/input/pushDummyController.ts`
- `src/game/scenes/BoutScene.ts`（debugのlabelのみ）
- 新しいtest
  - `src/game/sumo/BoutCounterTransition.test.ts`（25件）
  - `src/game/sumo/BoutCounterTransitionRingOut.test.ts`（4件。resolverをwrap）
- 更新したtest
  - `BoutCounterPosition.test.ts`: T78、T79、T82、T84 ×2、T85、T86、T87、T89を遷移の意味に変更。T80〜T83、T88、T91はそのまま
  - `BoutCounter.test.ts`: T64
  - `BoutGrip.test.ts`: T101、T108
  - `BoutOrientation.test.ts`: `counterGrip` とT119は遷移を待つ。T117は境界の浮動小数点の1 tick、T126はkey
  - `BoutDrive.test.ts`: `rearMorozashi`、T146、T148のkey、T150
  - `BoutRingOut.test.ts`: T165を完了まで動かす、T172のkey
  - `BoutTokudawara.test.ts`: 円の条件のtestを、終点基準のfixtureにして完了まで動かす
  - `pushDummyController.test.ts`: T74b
  - `wrestlerVisualState.test.ts`: 組みの後の向き直りのtestは、遷移を待つ
  - 不要になったhelper / import（`decayed`、`speed` ほか）を削除した
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

**既存のassertionを弱めたもの**: T117の1か所だけ
- 更新数の厳密な一致を、`{exact, exact + 1}` にした
- 理由: 遷移の後、Counter userはちょうど真横（誤差が厳密に90°）にいるので、最後の1 stepが許容角の境界にちょうど乗り、浮動小数点の丸めで1回増えうる
- 1 stepずつ減る、24〜26回、という検査は残した

# Tests

- `pnpm test`: **PASS — 20 files / 292 tests**（変更前は 18 / 262）
- `npx tsc --noEmit` / `pnpm build`: **PASS**（chunkの大きさの警告は、以前からあるPhaser由来のもの）
- `git diff --check`: **PASS**
- Pythonのart testは対象外（artとtoolは未変更）

Task必須の47項目との対応（新しいtestの名前は `BoutCounterTransition.test.ts` の `it` の名前）:
- 1・2: 「Success and Best captures start…」、T84
- 3: 「capture tick does not teleport」
- 4: 「lasts exactly N transition ticks」
- 5: 「same intent script reproduces…」
- 6〜10: 「ignores movement, Push, Counter, Grip and Drive…」
- 11・12: 「held movement acts on the first tick…」
- 13: 「D1 / D4…」、T85
- 14・15: 「D1 / D4…」、T78、T79、T87
- 16: 「pair never overlaps…」
- 17・18: 「Success uses both side preferences; Best wraps…」
- 19〜21: 「D3…」、T84 ×2、T85
- 22〜24: 「velocities report…」、T86
- 25: 「follows the documented deterministic path exactly every tick」
- 26: 「pair never overlaps」
- 27: 「the pusher can ring out mid-transition」
- 28: 「the Counter user can ring out mid-transition」
- 29・30: `BoutCounterTransitionRingOut.test.ts`（resolverへの引数、先に出た方 / Rematchの採用）と、一致test
  - 自然な配置での「同じtickに2人とも出る」は存在しなかった
- 31: 「exact boundary stays IN…」
- 32: 「Tokudawara: the cardinal extension is respected…」
- 33: 一致test（窓の付近の配置）。明示的な出て戻るfixtureは無い（Known Untested）
- 34: 「a decided outcome freezes…」、resolverのtestのfreeze
- 35・36: 「D2: paused… renewed」、T89
- 37・38: 「D2: after completion…」、T101、T108、T117、T118
- 39・40: 「a failed Counter keeps its Kuzushi-only behavior…」、T88
- 41・42: 「no valid target keeps the ACTION-04A2 fallback…」、T81
- 43: 「counterTransition is a top-level isolated copy」
- 44: T148、T126、T172と、新しいtest
- 45: T84、開始のtest
- 46: 「mirrored geometry with swapped participant order…」
- 47: 「a dummy-driven Push gives the same transition…」、T74b

# Build

`pnpm build` PASS（tsc + vite build）。

# Browser / Runtime Smoke

**PASS**（Agentによる自動のsmoke。headlessのChrome 156 + SwiftShader、CDP。依存の追加なし）。

方法:
- `pnpm dev` を起動し、page上でVite経由で `BoutSimulation` moduleをimportした
- `step` を「`this` と毎tickのSnapshotを記録するだけ」のwrapperで包んだ（読むだけ。gameのsourceは変更しない）
- dummy（Mode 2）のPushの段階を見て、Downを送った
  - Best: startupの途中
  - Success: activeで残り5以下

| 確認 | 結果 |
|---|---|
| 実行時のerror / 例外 | なし（favicon.icoの404のみ。以前から） |
| 比較表示 → Enter / blue・redのsprite | 読み込み200、表示OK |
| Best | `active{tier:best, counterUserId:wrestler-a, pusherId:wrestler-b}` が120 tickで完了 |
| Best: 1 tickの最大移動 | a 0.025 m / b 0.006 m（以前の瞬間移動は1.40 m） |
| Best: 最小距離 / 位置 | 0.700000 / bは (0,0) → (−0.35,0)、aは (−0.70,0) → (0.35,0)（真後ろ） |
| Success | `active{tier:success}` が120 tickで完了 |
| Success: 1 tickの最大移動 | a 0.012 m / b 0.010 m |
| Success: 最小距離 / 位置 | 0.700000 / bは (−0.02,0) → (−0.37,0)、aは (−0.72,0) → (−0.37,−0.70)（真横） |
| pusherの向き | 遷移中ずっと一定 |
| 遷移中の操作 | Simulationが入力を読まない（testで確認。smokeではdebugのlabelが `COUNTER BEST / SUCCESS` と `KUZUSHI`） |
| 完了直後のShift | `grappled / morozashi(holder wrestler-a)`（Best、Successとも） |
| pusherの崩し | 完了後30 tickの間Kuzushi、その後stable |
| R | 取組前の比較表示に戻り、遷移はnone、ongoing |
| debugの円 / 向きの印 | 正本の位置に追従（スクリーンショットで確認） |

**描画の注意（このTaskとは無関係で、以前からある）**
- headlessの撮影では、動いているspriteの一部の三角形に、影のtextureが乗ったような崩れが写ることがある
- **変更前（HEAD `1987552`）のworktreeでも、Counterなしの通常の移動で、同じ崩れが再現した**（2回とも）
- SwiftShaderでのheadless描画 / 撮影と、Phaserの描画の組み合わせで起きるとみられる。実機のGPUでのUser Play Test（ACTION-ART-03A）では報告されていない
- Unexpected Scopeに記録した（直していない）

# User Play Test Required

**Required**（Game Feel / Actionの遷移。Technical PASSは承認ではない）。

確認してほしい点:
- **Success**（相手のPushに、Downを遅めのタイミングで）
  - 瞬間移動が無いか
  - 自然に横へ移るか
  - pusherが前へよろけて見えるか
  - 約2秒、操作できないか
  - 最終の横の位置
- **Best**（相手のPushに、Downを早めのタイミングで）
  - 背後へ回り込む動きが読めるか
  - pusherのよろけ
  - 最終の背後の位置
  - 回転や重なりに不自然さが無いか
- **土俵際（重要）**
  - 押し込まれてSuccess / Bestしたとき、Counter userが回り込みの途中で土俵を出て負ける場合がある（免除なし）
  - これを許容するか（以前は勝ちの局面）
  - Tokudawaraの方向でも試してほしい
- **遷移の後**
  - Counter → Grip → Morozashiの機会が残っているか
  - 追加の約0.5秒の崩しは長いか、短いか
- **値の調整の対象**: 1.0Rのよろけの距離、120 tick、easing
- **既知の延期事項**: 崩しが終わる瞬間の、pusherの向きの瞬時の回転（Bestでは約180°）が気になるか

# Implementation Evidence

| Design Requirement | Implementation Evidence | Verified By |
|---|---|---|
| pair-levelの正本の遷移 | `BoutSimulation.counterTransition`（1つ）。participantには持たせない | T84、Snapshotのtest、smoke |
| 120 tick | `COUNTER_TRANSITION_TICKS = 120`。`ticksRemaining` は120 → 1 → none | 「lasts exactly N…」、smoke（span 120） |
| D1 | `COUNTER_STAGGER_DISTANCE = BODY_RADIUS`。pusherはd · 0.35 | T85、「D1 / D4」、smoke |
| D2 | 遷移中はKuzushi timerを止め、完了時に `enterKuzushi` | T89、「D2…」×2、T108、smoke（Morozashi） |
| D3 | 開始時に2人の速度とexternalを0にする | T84 ×2、「D3…」 |
| D4 | targetは `pusherEnd` 基準で、最後のtickで厳密に置く | T78、T79、T87、「D1 / D4」 |
| 入力lock | 遷移中は `step` がintentを読まない。dummyは `NO_INPUT` | 「ignores…」、「held movement…」、T74b |
| 接触の迂回 | 遷移の分岐は `resolveContact` を呼ばない | 「follows the documented path exactly」、「never overlaps」 |
| ring-out / Tokudawara | 毎tick `resolveArenaRingOut`（2人、直前 → 現在） | resolverのtest 4件、一致test、pusher / Counter userの途中の負け、境界、Tokudawara、freeze |
| 速度の記録 | 変位 / dt。pusherはexternal、Counter userはself。完了で0 | 「velocities report…」、T86 |
| Snapshotでの公開 | `counterTransition`（tier、役割、ticksRemaining）を毎回copy | 「isolated copy」、key test 3件 |
| 失敗したCounterは不変 | `advanceAction` の失敗の経路は未変更。遷移なし | T62、T65、T88、「a failed Counter…」 |
| 候補が無いときは不変 | 遷移を始めず、ACTION-04A2のfallback | T81、「no valid target…」 |
| Phaserによる移動なし | Sceneは正本の位置 / facingを描くだけ（debugのlabelのみ追加） | コードの確認、smoke |

# Design Deviations

Design Deviations: NONE

（D1〜D4、Success / Bestの意味、ring-outの勝敗の規則、失敗したCounter、Counterの窓 / tierは、どれも変更していない。Counter userに土俵外の免除は無い。Phaserが移動を持つことも無い。候補が無い場合は、Taskの「既存のfallbackをできるだけ保つ」に従い、遷移を始めない形にした。）

# Unexpected Scope（報告のみ）

- **Counter userの、遷移の途中の土俵外の負け**（設計上の結果。gameplayへの影響が大きい）
  - 土俵際でSuccessすると、pusherの終点を基準にした横の目標は有効でも、回り込みの途中で円の外を通ることがある
  - 免除なし・候補の基準は既存、という指示どおりの結果
  - 大きく変えるなら、別の決定（例: pathの形、回り込む側、候補の判定の範囲）が必要
- **headlessの描画の崩れ**（以前から。上記）
  - 変更前のHEADの通常の移動でも再現した
  - 実機で見えるかは未確認。User Play Testで気づいたら別のTaskにする
- **崩しが終わる瞬間の、pusherの向きの瞬時の回転**（Design Reviewで延期済み）。今回も変更していない
- `docs/ARCHITECTURE.md` のCounterの節を、遷移に合わせて書き換えた（Taskの指示の範囲）

# Known Untested Items

- User Play Test（手触りと見た目の承認）
- 窓の側線で、同じtickの中に出て戻る、明示的なfixture（共通resolverの一致testで代替した）
- 自然な配置での、同じtickに2人とも出る / 同時のRematch（offlineの探索で0件。resolverを包んだtestで、採用の経路だけ確認した）
- 実機のGPUでの表示（smokeはSwiftShaderのheadlessのみ）

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`feat: animate counter resolution in simulation`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- smokeと探索のscript、出力、一時的なworktree（作ってから削除）は、すべてscratchpadにあり、Repositoryには含めない
- `main` は変更しない
