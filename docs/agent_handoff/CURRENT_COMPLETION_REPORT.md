Task-ID: ACTION-10B-PUSH-CHARGE-IMPLEMENTATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: f58c3448f32b2dc79fb800d5e664633627ac0716
Agent-Start-Head: 0f9dc12ebccc29c516c47f88619c3f6915298ee7
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS:

- Technical PASS: 必須の境界ケース（M / I / F / D1-16 / C / PP / PT / K / R / G）をすべて実行してPASS
- `pnpm test` 439 PASS
- Browser Smoke 64 / 64 PASS（GPU）
- Game Feelは、User Play Testで判断する

User選択のACTION-10A Option Bを実装した。流れは次のとおり:

1. startup 6 tick
2. 押下時のfacingに固定した方向への突進（最大24 tick）
3. 最初の体の接触で、8 tickのimpact windowが開く（Push力 / Counter / 連結は、このあいだだけ）
4. recovery 10 tick

- Push中は、canonical facingを凍結する
- 空振りは、突進を走り切る
- 縁では、既存のring-outがそのまま、相手の押し出しにも、自滅にもなる

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `f58c344`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `f58c344..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `0f9dc12`

# 定数

| 定数 | 値 | 備考 |
|---|---|---|
| `PUSH_STARTUP_TICKS` | 6 | 変えていない |
| `PUSH_CHARGE_TICKS` | **24**（新規） | 接触しない突進の最大の長さ |
| `PUSH_IMPACT_TICKS` | **8** | `PUSH_ACTIVE_TICKS` から**名前を変えた**（値は1つだけ。互換のaliasは置いていない） |
| `PUSH_RECOVERY_TICKS` | 10 | 変えていない |

次は変えていない:

- `PUSH_EXTERNAL_ACCELERATION` 26.25、`FORWARD_ACCELERATION` 10、`MAX_SPEED` 3、`STOP_DECELERATION` 24
- `EXTERNAL_DECELERATION` 8、`MAX_EXTERNAL_SPEED` 3
- `BODY_RADIUS`、`CONTACT_SLOP`、`COUNTER_BEST_TICKS`、`COUNTER_WINDOW_TICKS`、`KUZUSHI_*`、`TSUPPARI_*`

# Push stateの最終形（`BoutTypes.ts` / `BoutSimulation.ts`）

```ts
{ kind: 'push'; phase: 'startup' | 'active' | 'recovery'; ticksRemaining: number; direction: Vec2; impactTicksRemaining: number | null }
```

## `impactTicksRemaining`

| 値 | 意味 |
|---|---|
| `null` | まだ接触していない。startupと、接触前の突進 |
| 正の値 | impact window中。Snapshotは「次のtickを含む残りtick」で、開いたtickの末尾に1つ数えるので7..1 |
| `0` | windowが切れてrecoveryに入った。recovery中も0のまま。空振りのrecoveryでは `null` のまま |

## `ticksRemaining`

- activeでは、残りの突進。window中は数えない（残りの突進は再開しない）
- startup / recoveryでは、従来どおり

## そのほか

- Snapshotには、ほかのfieldと同じくcopyで公開する（`copyAction`）
- 目標のid、命中flag、homingのstateは足していない

# 最初の接触とimpactの更新順（FREEの1 tick）

1. intent → Push開始（`direction = (cos facing, sin facing)`、`impactTicksRemaining = null`）
2. 実効move（activeは `direction`。startup / recoveryは入力0）→ self velocity → external減衰 → 積分
3. `resolveContact`（既存の円の接触）
4. 接触していれば、activeで `impactTicksRemaining === null` のPushに **`openPushImpact` → `PUSH_IMPACT_TICKS`（8）**
5. `resolveCounter`（`isPushActive` = active かつ window > 0、かつcontact。tier = `counterTier(impactTicksRemaining)`）
6. `resolveGrip` → `resolveForces`（Push力 / Push vs Tsuppariの連結 / Kuzushiのfollow-up。どれも `isPushActive`）
7. `advanceAction`:
   - windowが開いていれば、windowを1減らし、0なら即recovery（`ticksRemaining = PUSH_RECOVERY_TICKS`）
   - 開いていなければ、突進を1減らし、0ならrecovery
8. `updateFacing`: FREEでは、Kuzushiに加えて `action.kind === 'push'` の参加者も向きを変えない（startup〜recovery全体で凍結）
9. ring-out

したがって、最初の接触tickは、そのtickのうちにBestで捕えられ、Push力をかけ、Push同士や連結にも加わる。

# 計測結果

## 自由空間

| 項目 | 値 |
|---|---|
| tick数 | startup 6、active 24、recovery 10 → 40 tick目でidle |
| 移動 | **0.938333 m**（旧0.126667 mの7.41倍） |
| peak self speed | 3.0 m/s（MAX_SPEEDで止まり、超えない） |
| external | 0 |

## 接触から始めたshove

- force 8 tick
- receiver / pairの移動 **0.5325 m**
- receiverのpeak external **2.566667 m/s**
- impactは、最初のactive tickで開く
- 従来のbaselineと同じ

## 距離0.8 mからの突進

- 最初の接触はtick 13
- その接触tickで `impact` が開き、力は `26.25 / 60`（1回目のtickのΔv）

## dodge matrix（D1-D16。通常のMoveだけ。+yへ動き始めるtick: 0 = 押下、6 = 最初の突進tick、9 = +3、12 = +6）

| 距離 | 押下と同時 | 最初の突進tick | +3 | +6 |
|---|---|---|---|---|
| 0.8 m | MISS | HIT（tick 14） | HIT（13） | HIT（13） |
| 0.9 m | MISS | HIT（18） | HIT（17） | HIT（17） |
| 1.0 m | MISS | **MISS** | HIT（20） | HIT（20） |
| 1.1 m | MISS | **MISS** | HIT（24） | HIT（22） |

- HITでは、すべてimpactが開き、Push力もかかった
- MISSでは、すべて次のとおりだった:
  - 接触なし、impactは開かない、力なし
  - 最小の中心距離は0.702超
  - 攻撃側は0.938 mを走り切った
- 早い読みは空振りにでき、遅い反応は当たる
- homingも、回避専用の状態や無敵も無い

## 縁

| 場面 | 結果 |
|---|---|
| 直撃（弦y = 1、相手は縁から0.1 m内側、0.8 m前方、避けない） | tick 13で接触しimpactが開き、**tick 19で相手がring-out**（既存の8 tick impactのまま。forceの調整は不要。STOP条件に当たらない） |
| 同じ場面で、Tokudawaraの窓の中（y = 0） | 相手は、より遅い**tick 22でring-out**（窓で許される半径が広い分） |
| 空振りの自滅（同じ配置。相手は押下と同時に中心側へ避ける） | 接触なし。**tick 33で攻撃側がring-out**（recovery中、`reason: 'ring-out'`）。円とTokudawaraで同じ |
| 中央での空振り | ongoingのまま |
| 縁でのPush同士（相手が0 / 3 / 6 tick目にPush） | 両者のimpactが同じtickに開き（7 / 7）、相手のexternalは常に0。ongoingのまま（一方的に飛ばされない） |

## Counter（0.9 mの突進。最初の接触はtick 17）

| 押下 | 結果 |
|---|---|
| tick 17 / 18 / 19（impactの経過0〜2） | **Best** |
| tick 11（接触の6 tick前。windowが接触を覆う） | Best |
| tick 20〜24（経過3〜7） | Success |
| tick 25（recovery） | Fail |
| 接触しない突進（2.0 m） | 押下が0 / 6 / 12 / 18 / 24のどれでも、捕えられずにFail（自分がKuzushi） |

捕えた後の結果は変わらない: CounterTransition（Best、counterUser = b、pusher = a）、pusherのKuzushi 90、Counter userはidle。

## Push vs Push

- 1.0 mから同時に押すと、両者が出会い、windowが同じtickに開く
- externalは両者とも常に0
- 終わった後の位置は、左右対称
- participantの配列を入れ替えても、Snapshotが完全に同じ

## Push vs Tsuppari（0.8 mの突進、Tsuppariを撃つtick 0〜29）

- 連結になる（C）のは1つの連続した区間だけで、**8 tick以下**
- それ以外は、普通の命中か空振り
- 接触前の突進中の命中（0.85 m）は、普通の命中: pusherだけが −2.13 m/s、windowは `null`

## Kuzushi（ACTION-09B）

- 接触しない突進は、Kuzushiを消費しない
- 突進で最初に接触したforce tickは、**0.65625 m/s（1.5倍）で、そのtickに消費**される
- 次のtickは、1.0倍 − 減衰（0.30417）

## facing / homingしないこと

- 距離0.8 mで、相手が押下と同時に避ける場合、Push中のすべてのtickで次のとおりだった:
  - `direction` = (1, 0)
  - facing = 0
  - 位置のy = 0
  - 移動方向 = 0°
- idleに戻ると、facingは相手の方向へ向き直る（F4）
- browserでも、Push中の体のsprite（94 frame）は、rotation = facing = 0

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| 24 tickの突進 | `nextPushPhase`: startup → active（`PUSH_CHARGE_TICKS`）。activeは `effectiveMove` で `direction` へ歩く（既存のgrounded rule） | M1-M6、`BoutPush` T38 / T41、smoke P1（0.93833 m、active 24） |
| 8 tickのimpact | `openPushImpact`（8）、`isPushActive`（window > 0）、`advanceAction` で数える | I3-I9、smoke P3 / P5 |
| 最初の接触で開く順序 | `resolveContact` → `openPushImpact` → `resolveCounter` → `resolveForces` | I3 / I4、C2 / C3（接触tickでBest）、PP1、smoke P6 |
| impactの終わりでrecoveryへ | window 0 → 即recovery。残りの突進は再開しない | I7 / I8 |
| facingの凍結 | `updateFacing` で、Pushの参加者を飛ばす（Kuzushiと同じ。正本は1つ） | F1-F4、`BoutPush` T39、`BoutCounterPosition` T87、smoke P2 |
| homingしない | `direction` は押下時に固定。目標を持たない | F3、`BoutPush` T39、smoke P2 |
| 通常の回避 / 接触 | 既存のMoveと円の接触だけ | D1-D16、I6（擦れる接触の後に離れる）、smoke P2 |
| 自滅ring-out | 既存の `resolveArenaRingOut` だけ | R2 / R3 / R4、smoke P4 |
| 縁での直撃 | 既存の8 tick impact | R5（tick 19で相手が外）、smoke P3 |
| Push同士 | 既存のnet（+1 / −1）を、window中だけ | PP1-PP3、R6、smoke P5 |
| Counterのtiming | `counterTier(impactTicksRemaining)`。捕えるのはwindow + contactのときだけ | C1-C6、`BoutCounter` T63、`BoutCounterPosition` T78-T89、smoke P6 / P7 |
| Tsuppariの連結 | `resolveForces` の連結条件を `isPushActive`（window）にした | PT1-PT3、`BoutTsuppari` TS31-TS33、smoke P9a / P9b |
| Kuzushiを保つ | `wasKuzushi` / `followUp` は変えていない | K1-K4、`BoutKuzushiFollowup` P1-P6、smoke P8 / K1-K9 |
| presentationの責任 | `WrestlerVisualState.phaseProgress` は、canonicalなPush stateから作る: startup 6、active = 突進（null）またはimpact（8）、recovery 10。timerは持たない。体は既存どおりcanonical facingで描く | `wrestlerVisualState` のtest（突進1/24、接触1/8）、smoke P2 |

# Verification（Heavy）

| 項目 | 結果 |
|---|---|
| 新しい `src/game/sumo/BoutPushCharge.test.ts` | 39 tests PASS（M / I / F / D1-16 / C / PP / PT / K / R / G5） |
| `pnpm test`（Push / Counter / CounterPosition / CounterTransition / Grip / Tsuppari / Kuzushi / ring-out / Tokudawara / presentation / input） | 26 files / 439 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` の `--check` | どれもexit 0 |
| `git diff 0f9dc12 -- public tools` | 0行（Product artは不変） |

## G（regression）

- G1: Counterの35°は `productCounterArt` のtestとsmokeで確かめた
- G2: 汗は `kuzushiVisualEffect` のtestと、smokeのS1〜S4 / K系で確かめた
- G3: Tsuppariは `BoutTsuppari` のtestと、smokeのTsuppari productで確かめた
- G4: Grip / Grappleは `BoutGrip`、`BoutGrapple` 系のtestで確かめた
- G5: 移動の定数は不変（test）
- G6: assetの `--check` で確かめた

## 既存のtestの更新（30 tick / 8 tickの前提を新しい規則に合わせた。弱めてはいない）

| test | 変更 |
|---|---|
| 全体 | `PUSH_ACTIVE_TICKS` → `PUSH_IMPACT_TICKS`（接触から始まるPushでは、意味が同じ） |
| `BoutPush` T38 / T40 / T41 | 接触しないPushは、activeが24 tick、全長40 tick、移動約0.94 m（以前は「短い一歩」0.3 m未満だった） |
| `BoutPush` T39 | facingは、以前の「相手を追う」から、「`direction` のまま凍結」へ |
| `BoutCounter` T61 / T63 | 離れたPushの全長は、突進の全長。tierの分類は `impactTicksRemaining` から |
| `BoutCounterPosition` `tierOf` / T87 | tierはimpactの残りから。T87は、facingが凍結されること（遷移は引き続きlockした方向を使う） |
| `BoutTsuppari` TS32 / TS42 | startupの命中の後、押し戻されたpusherの突進は続き、後の接触でimpactが開く（以前は8 tickで届かなかった）。離れたPushの全長 |
| `BoutKuzushiFollowup` P4 / P5、`wrestlerVisualState` | 接触しないPushの全長と、active progress（突進 / impact） |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ Chrome（CDP、GPU）
- 09Bのsmoke全体に、10Bの場面P1〜P9を加えた
- 縁の場面では、ページの中でだけ `scene.simulation` を固定配置の新しいSimulationに差し替え、CPUの入力を `dummy.nextIntent` で注入した（testだけ。ソースは変えていない）
- 結果: **64 / 64 PASS**

途中のFAIL（どれもscript側）:

- 1回目: recorderの初期化前にwrapperが例外を出し、game loopが止まった
- 2回目: P9bで、Tsuppariを撃つtimingが遅く、命中時にwindowが閉じていた

どちらも直して、再実行した。

| 確認 | 結果 |
|---|---|
| Enter → ArrowUpで、0.938 m・24 tickの突進。impactは開かない（P1） | PASS |
| 早く横へ避けられると、空振り。攻撃側は走り切る（P2） | PASS |
| `direction` / facing = 0、y = 0、体のsprite = facing（P2） | PASS |
| 中央での空振りでは、ring-outにならない（P2） | PASS |
| 縁での直撃で、相手がring-out（P3） | PASS |
| 縁で避けられると、攻撃側がring-out（P4） | PASS |
| Push同士: windowが同時に開き、externalは0（P5） | PASS |
| 長い突進の後の最初の接触でCounter → Best（P6）。windowの後半なら → Success（P7） | PASS |
| KuzushiのCPUへの最初の接触は1.5倍で、消費（P8） | PASS |
| Tsuppari: 突進中は普通の命中（P9a）、window中は連結（P9b） | PASS |
| 既存: Counter / Tsuppari / 汗 / Kuzushi 90 / 遷移、Push / Grip / 移動、R restart、console error / 失敗したrequestが無い | PASS |

screenshot（scratchpadの `smoke11/`）:

- `40_early_sidestep_miss`
- `41_direct_near_edge_hit`（"East Asuiryu Wins"）
- `42_near_edge_self_ring_out`（"West Toshinofuji Wins"）
- `43_push_vs_push_clash`
- `44_long_run_counter_best`

# Changed Files

- `src/game/sumo/BoutSimulation.ts`
  - 定数
  - Push state
  - `openPushImpact` / `isPushActive` / `counterTier`
  - 接触後にimpactを開く処理
  - `advanceAction`
  - `updateFacing`
  - comment
- `src/game/sumo/BoutTypes.ts`（`impactTicksRemaining` とその意味）
- `src/game/presentation/wrestlerVisualState.ts`（Pushのprogress）
- `src/game/sumo/BoutPushCharge.test.ts`（新規）
- 更新したtest:
  - `BoutPush.test.ts`
  - `BoutCounter.test.ts`
  - `BoutCounterPosition.test.ts`
  - `BoutTsuppari.test.ts`
  - `BoutKuzushiFollowup.test.ts`
  - `src/game/presentation/wrestlerVisualState.test.ts`
  - `src/game/input/pushDummyController.test.ts`（名前の変更だけ）
- `docs/ARCHITECTURE.md`
  - Push chargeの段落を新設
  - 既存のPush / Counter / Tsuppariの連結の記述を、window基準に更新
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更していないもの:

- Product art、presentationの描画（`WrestlerView`、`BoutScene`）
- dummyの本体
- ring-out、Tokudawara
- Grip、Kuzushi、Tsuppariの値

# Design Deviations

Design Deviations: NONE

（`PUSH_ACTIVE_TICKS` → `PUSH_IMPACT_TICKS` の名前の変更は、Taskが推奨した範囲。aliasは置いていない）

# Unexpected Scope

- TS32（既存のtest）の変化:
  - Pushのstartup中にTsuppariで押し戻されたpusherが、24 tickの突進で相手まで戻り、後の接触でimpactを開いて押すようになった
  - 旧仕様の8 tickでは届かなかった
  - 仕様どおりの結果と判断し、testの確認をその振る舞いに合わせた
- ACTION-09BのARCHITECTUREにある古いGripの記述は、Taskの指示どおり触れていない

# Known Untested Items

- 実機でのUser Play Test（Game Feel）

# User Play Test: REQUIRED

確認の手順:

1. `pnpm dev` → Enter → ArrowUp
2. dummy `1` / `2` と縁の位置で試す

見てほしい点:

- 突進 / tackleとして感じられるか
- 0.4秒の突進は読めるか
- 早い横移動で避けられるか、遅い回避はちゃんと当たるか
- 空振りの後も走り続けるのが自然か
- 縁での自滅のリスクは楽しいか
- 縁での直撃は気持ちよいか
- Push同士は意味のある競り合いになっているか
- facingの凍結で、まっすぐな意図が見えるか
- recoveryの後に相手の方向へ一気に向き直るのは許容できるか
- Counter / Tsuppari / Kuzushiは分かりやすいままか

Technical PASSは、Game Feelの受理ではない。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `feat(gameplay): add committed push charge` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
