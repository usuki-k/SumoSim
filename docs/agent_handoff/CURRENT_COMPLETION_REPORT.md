Task-ID: ACTION-07B-TSUPPARI-GAMEPLAY-IMPLEMENTATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 7357788bd9b9091e50ef44859874cec4ae128671
Agent-Start-Head: 915bd35f809558df455d3569d71a3cebc72440ef
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Browser Smoke PASS。Game Feelは未受理で、User Play Testが必要）。

- ACTION-07Aの設計どおりに、Tsuppariを実装した。対象は、Simulationの状態とルール、ArrowLeft / ArrowRightの入力、手ごとのcooldown、中心基準のreach、impulse、6回目のKuzushi、Counter、Push / Tsuppariの勝負、debug表示、dummy mode 3
- `PUSH_EXTERNAL_ACCELERATION` を 20 → 26.25 にした。代表fixtureで、Pushの変位は 0.5325 m（旧0.267 mの2.00倍）、Tsuppariの変位は 0.2658 m
- Taskが列挙した境界Case 1〜44は、すべて自動Testで確かめた（新規 `BoutTsuppari.test.ts`、42件）
- `pnpm test`: 340 / 340 PASS。`pnpm build`: PASS。`git diff --check`: PASS
- Product Tsuppari poseの画像は入れていない。Tsuppari中も、idleのspriteを表示する

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `7357788`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `7357788..origin/develop` の変更は `docs/agent_handoff/` の2 file（07AのReportとCURRENT_TASK）のみ。`HEAD..origin/develop` は `CURRENT_TASK.md` のみ → `merge --ff-only` → `915bd35`

# Current Source Delta

## Constants（`BoutSimulation.ts`。すべてProvisional / User Play Test）

| 定数 | 値 |
|---|---|
| `PUSH_EXTERNAL_ACCELERATION` | 20 → **26.25** m/s² |
| `TSUPPARI_STARTUP_TICKS` | 6 |
| `TSUPPARI_ACTIVE_TICKS` | 1 |
| `TSUPPARI_RECOVERY_TICKS` | 9（合計16） |
| `TSUPPARI_HAND_COOLDOWN_TICKS` | 60 |
| `TSUPPARI_HAND_REACH` | 0.525 m（数値で定義。命中は `中心距離 ≤ 0.525 + receiver.bodyRadius` = 0.875 m） |
| `TSUPPARI_IMPULSE` | 2.13 m/s |
| `TSUPPARI_COUPLED_SHARE` | 0.5 |
| `TSUPPARI_KUZUSHI_BUILDUP` | 5（6回目でKuzushi） |
| Kuzushiの長さ | 既存の `KUZUSHI_TICKS`（30）を再利用 |

変えていない: `MAX_EXTERNAL_SPEED`（3）、`EXTERNAL_DECELERATION`（8）、`KUZUSHI_PUSH_SUSCEPTIBILITY`（1.5）、Pushのtiming（6 / 8 / 10）、Counter window、CounterTransition、Grip / Drive、ring-out / Tokudawara（TS36で値を確認）。

## State shape

```ts
// BoutTypes.ts
readonly tsuppariLeftPressed: boolean   // ParticipantIntent（必須）
readonly tsuppariRightPressed: boolean
export type TsuppariHand = 'left' | 'right'
export type TsuppariPhase = 'startup' | 'active' | 'recovery'
export type TsuppariStrike = 'pending' | 'hit' | 'whiff'
// ParticipantActionState / MutableAction
{ kind: 'tsuppari'; hand; phase; ticksRemaining; strike }
// ParticipantState（Snapshotにcopyを公開）/ MutableParticipant（正本）
tsuppariCooldown: { left: number; right: number }   // 0 = ready
tsuppariBuildup: number
```

topレベルに、Tsuppariの重複したStateは作っていない。

## Tick order（実装）

1. 勝敗が決まっていれば何もしない
2. **両者の手のcooldownを1ずつ減らす**（`advanceTsuppariCooldown`。CounterTransitionの分岐より前なので、CounterTransition中も減る）
3. CounterTransition中なら、既存の `stepCounterTransition` だけを行う（intentは読まない）
4. posture timer → 組みのreadiness → release
5. FREEのaction開始。優先順: Push → 使える左のTsuppari → 使える右のTsuppari → Counter → Grip
6. 実効move（Tsuppariの全phaseで0 = 制動）→ self velocity → external減衰 → 積分
7. contact
8. GRAPPLED: bond。FREE: `resolveCounter(contact)` → `resolveGrip()` → `resolveForces(contact)`
9. action timer → facing → ring-out（既存）

受け付けたtickでcooldownを60にし、次のtickの先頭から減らす。そのため、同じ手は `t0 + 60` でちょうど再び使える（TS12で確認）。

## 同じtickの入力優先順

Push > Tsuppari（使える左 > 使える右）> Counter > Grip > Move。cooldown中の手のedgeは、優先順を決める前に捨てる（Taskの「Left is unavailable … Right may start」のとおり）。負けたedgeと開始できないedgeは捨てる（queueしない。cooldownも変えない）。開始の条件は既存と同じ（FREE、release tickでない、idle、stable）。

## 力の解決（`resolveForces`、1か所、順序に依存しない）

1. 両者の命中tick（active、`strike: 'pending'`）を、同じ状態から判定する: reach内なら `hit`（buildup +1。buildup ≥ 5なら6回目の命中として、受け手を後でKuzushiにし、buildupを0に戻す）、reach外なら `whiff`
2. 力:
   - 接触していて、どちらかのPushがactive（組のtick）: `resolvePush(contact, strikeNet)` が、`net·P·s·dt + strikeNet·J·0.5` を2人に同じ量だけ加える。Tsuppariの命中が無いtickは、従来とまったく同じ計算（`strikeNet !== 0` のときだけ項を足す。`net === 0` かつ命中なしなら、従来どおり何もしない）
   - それ以外: 命中ごとに、受け手のexternalへだけ、攻撃側 → 受け手の向き × `J` を加え、clampする（打ち消し合わない）
3. 6回目の命中を受けた側を `enterKuzushi`（すべての命中と力が決まった後）

Tsuppariには `KUZUSHI_PUSH_SUSCEPTIBILITY` を掛けない。

## Counter（`resolveCounter(contact)`）

- FREEのtickで毎回呼ぶ。先に「defenderのCounter window × attackerのTsuppariの命中tick × reach内」を確かめ、成立すれば `enterKuzushi(attacker)`、`defender.action = idle` として、tierを返さない（null）。位置、velocity、buildup、transitionには触れない
- Pushの分岐は、`if (!contact) continue` で接触を明示的に確かめる。それ以降の処理は変えていない（Best / Success、CounterTransition、fallback）

## Force interaction matrix（実装どおり）

| A ＼ B | idle / Counter / Grip / Kuzushi | Pushがactive（接触中） | Tsuppariの命中tick |
|---|---|---|---|
| idle / その他 | なし | 組: 2人に `−P·s·dt`（従来） | Aだけ `−J` |
| Pushがactive（接触中） | 組: 2人に `+P·s·dt`（従来） | net 0（従来） | 組: 2人に `+P·dt − J/2` |
| Tsuppariの命中tick | Bだけ `+J` | 組: 2人に `+J/2 − P·dt` | Aに `−J`、Bに `+J` |

Pushのstartup中、active後、または接触していないときは、組のtickではない。その場合、Tsuppariは受け手（Pushの使用者）だけに `J` で入る。

# Representative Measured Displacements（実装で計測）

F1 = 接触（中心距離0.70 m）、受け手はidleで入力なし、action edgeはtick 0の1回だけ。externalが0に戻るまでを測る:

| 場面 | 受け手 | 攻撃側 | 最大速度 |
|---|---|---|---|
| Push（26.25） | **0.5325 m** | 0.5325 m（組） | 2.567 m/s |
| Tsuppari | **0.2658 m** | **0.0000 m** | 2.130 m/s |
| Tsuppari（0.85 m、接触なし） | 0.2658 m | 0.0000 m | 2.130 m/s |
| Push / Tsuppari | **2.00** | | |

Push（A）× Tsuppari（B）。接触から開始し、BはAの `k` tick後に押す:

| k | Bの変位 | Aの変位 | 最初の30 tickで離れたtick数 |
|---|---|---|---|
| −1（命中はPushのstartup中） | 0.000 | −0.139 | 24（Pushは空振り） |
| 0（同じtick） | 0.291 | 0.291 | 0（組の勝負。Pushが勝つ） |
| 2 / 4 / 6（active中） | 0.223 / 0.217 / 0.253 | 同じ | 0 |
| 8（activeの後） | 0.533 | 0.186 | 15（普通の命中） |

Tsuppari同士（0.80 m）: A −0.2658 m、B +0.2658 m（対称）。

いずれもACTION-07Aの試作の値と一致した。

# Explicit Boundary-Case Results（`src/game/sumo/BoutTsuppari.test.ts`）

すべてPASS。番号はTaskの一覧と同じ。

| # | Case | Test | 結果 |
|---|---|---|---|
| 1 | Left ready / Right ready → Left | TS01 | PASS（L cd 60、R cd 0） |
| 2 | Left cd中 + Leftだけ → なし | TS02 | PASS |
| 3 | Left cd中 + Right → Right | TS03 | PASS |
| 4 | Right cd中 + Rightだけ → なし | TS04 | PASS |
| 5 | 両方cd中 → なし。Counter / Gripは始まる | TS05 | PASS |
| 6 | Left + Right（両方ready）→ Left、Rはready のまま、queueしない | TS06 | PASS |
| 7 | Left cd中 + Right → Right | TS07 | PASS |
| 8 | Push + Left → Push、Lのcdは0 | TS08 | PASS |
| 9 | Left + Counter → Left | TS09 | PASS |
| 10 | Left + Grip → Left | TS10 | PASS |
| 11 | WASD + Tsuppari → 16 tick制動、その後WASDが戻る | TS11 | PASS |
| 12 | `t0+59` まで拒否、`t0+60` で受付。左右の連打 `0 L, 16 R, 60 L, 76 R, 120 L, 136 R` | TS12 | PASS |
| 13 | 新しいBoutはcd 0 / 0、buildup 0 | TS13 | PASS |
| 14 | reach外でwhiff（impulseなし、buildupなし） | TS14 | PASS |
| 15 | 接触での命中: 受け手のexternalがちょうど `(J, 0)`、攻撃側は0で位置も不変、buildup 1 | TS15 | PASS |
| 16 | 0.85 m（接触なし）での命中 | TS16 | PASS |
| 17 | reach ± 1e-6 で hit / whiff | TS17 | PASS |
| 18 / 19 | 1〜5回目は普通、6回目は普通のimpulse + Kuzushi（30）+ buildup 0、7回目は1 | TS18 / TS19 | PASS |
| 20 | 5回命中 → whiff → 次の命中がKuzushi | TS20 | PASS |
| 21 / 22 | Counterが左 / 右のTsuppariを捕える（攻撃側はその場でKuzushi、Counterの使用者はidle / stable）。位置とexternalは、Counterしなかった場合と一致（既存の勢いは0にしない）。Bへのimpulseなし | TS21 / TS22 | PASS |
| 23 | CounterTransitionが起きない | TS21 / TS22 | PASS |
| 24 | buildupを変えない（0のまま、および1のまま） | TS21 / TS22 / TS24 | PASS |
| 25 | Counter window × whiffでは捕えない。windowが切れるとFail | TS25 | PASS |
| 26 | Push Counterは従来どおり（Best → transition、pusherがKuzushi）。既存のCounter系Testもすべて通過 | TS26 + 既存 | PASS |
| 27 | Tsuppari同士: 両方命中、`(−J, 0)` と `(J, 0)`、両方buildup 1、対称に離れる | TS27 | PASS |
| 28 | 参加者の配列の順序を入れ替えても、140 tickの全Snapshotが一致（`toEqual`） | TS28 | PASS |
| 29 | 6回目 × 普通（同じtick）: 両方のimpulse、6回目を受けた側だけKuzushi、Bのbuildupは3になる | TS29 | PASS |
| 30 | 6回目 × 6回目: 両方のimpulse、両方Kuzushi、両方0 | TS30 | PASS |
| 31 | Push × Tsuppari（k = 0 / 2 / 4 / 6）: 2人に同じ `decayed + P·dt − J/2`、離れない、Bの変位は 0.15 < d < 0.6 × 抵抗なしの値 | TS31 | PASS |
| 32 | Pushのstartup中の命中: Pushの使用者だけ `−J`、Bは不変、Pushは空振り | TS32 | PASS |
| 33 | Pushのactive後の命中: 普通の命中（Tsuppariが無い場合と比べて、Aだけ `−J`） | TS33 | PASS |
| 34 | 等しいPush同士は、40 tickのあいだexternalが0 | TS34 | PASS |
| 35 | Push 0.50〜0.57、Tsuppari 0.25〜0.285、比 1.8〜2.2、攻撃側の変位0 | TS35 | PASS |
| 36 | clamp / decay / 受けやすさ / Pushのtimingは不変 | TS36 | PASS |
| 37 | Tsuppariで受け手がring-out（既存の判定） | TS37 | PASS |
| 38 | 土俵際のTsuppari同士 → Rematch | TS38 | PASS |
| 39 | CounterTransition中のedgeは捨てる。cdは `max(0, 60 − 経過tick)` で減り続ける | TS39 | PASS |
| 40 | 組み中のedgeは捨てる | TS40 | PASS |
| 41 | Kuzushi中のedgeは捨てる（queueしない） | TS41 | PASS |
| 42 | Push / Grip / 自分のTsuppariのrecovery中のedgeは捨てる（queueしない） | TS42 | PASS |
| 43 | 勝敗が決まった後は何もしない（cdもSnapshotも不変） | TS43 | PASS |
| 44 | Snapshotのcd / buildup / actionはdeep copy | TS44 | PASS |

その他の新しいTest:

- `pushDummyController.test.ts` に TD1〜TD4（mode `tsuppari`）を追加
  - 範囲外では近づくだけ
  - 範囲内では使える手で打つ（左が優先、action中は何も出さない、400 tickの打撃がすべて命中）
  - PlayerのCounterで、dummyがその場でKuzushiになり、その後は何も出さない
  - 他のmodeは不変
- `wrestlerVisualState.test.ts` に、Tsuppariのpose / 手 / phase / 進み具合の対応を追加

# Existing Regression Suite

- `pnpm test`: **21 files / 340 tests PASS**（変更前は293件。新規47件）
- `pnpm build`（`tsc && vite build`）: PASS（既存のchunk size警告のみ）
- `git diff --check`: PASS

既存Testへの変更:

1. intentを作るhelper / literal（13 file）に、`tsuppariLeftPressed: false, tsuppariRightPressed: false` を追加した（機械的な変更）
2. **CounterTransitionのfixture（guardrailの範囲内）**: `BoutCounterTransition.test.ts` の `COUNTER_USER_OUT.mid.x` を **1.75 → 1.73** にした（1行。コメントあり）
   - Pushが強くなり、1.75では捕える前にCounterの使用者が押し出されて「decided before catch」になっていた
   - 1.72〜1.74を調べ、同じ場面（Success、Counterの使用者が遷移の途中で土俵外、直前のtickはIN、Bはpeakより内側）が成り立つ範囲の中央の1.73にした
   - 主張は変えていない。これで、失敗していた3件（no immunity / shared resolver / freeze）が、すべて元の主張のままPASSする
3. 参加者のkey一覧を確かめるTest 3件（`BoutGrip` T92、`BoutOrientation` T126、`BoutRingOut` T172）に、`tsuppariBuildup` / `tsuppariCooldown` を加えた
   - Taskが要求したSnapshotの追加によるもの
   - 「組み / 勝敗のflagを参加者に持たせない」という主張は、そのまま保っている

# Browser / Runtime Smoke

`pnpm dev` + headless Chrome（CDP、SwiftShader）。Simulationの `step()` を読み取り専用で包み、毎tickのSnapshotを記録した。scratchpadの `smoke_tsu.mjs`。結果は `smoke_07b*` に残した（全6回の実行）。

| 確認 | 結果 |
|---|---|
| pre-bout（待っている間のtickは0）、Enterで開始 | PASS |
| 1.40 mでArrowLeft → left Tsuppari、cd {60, 0}、whiff | PASS |
| 歩いて近づき、ArrowRight → right Tsuppari、hit、受け手のexternal 2.130、buildup 1 | PASS |
| 同じframeにLeft + Right（両方ready）→ Left、Rはready | PASS |
| 左右を交互に打つ → 6回目の命中（buildup 5 → 0）で、CPUがKUZUSHI | PASS |
| debug表示: phase text `TSU R` / `TSU L HIT` / `WHIFF`、左下に `PLAYER TSU L ok R 0.7s hits 1/5   CPU TSU …`（screenshotで確認） | PASS |
| R → Enter: 両者のcd {0, 0}、buildup 0 | PASS |
| dummy mode 3 × PlayerのCounter（dummyのstartup中にDown）→ dummyがKUZUSHI、位置は不変、transition none | PASS（全6回） |
| PlayerのPush × dummyのTsuppari | 組の勝負を2回確認（命中tickにPushがactiveで接触中、両者のexternalが同じ値。例: −0.323 と −0.019）。別の実行では、命中が接触の外（0.702 m）で普通の命中になった（設計どおり）。押すtimingがCDPの遅延に左右されるため、実行ごとに場面が変わる |
| 既存の操作: Push（受け手0.533 m）、Counter、Grip（grappled）、組み中のArrowLeftは無視 | PASS |
| console error / exception | なし（1回目の実行の `favicon.ico` 404は既知で、gameとは無関係） |

Tsuppari専用のposeは無い（idleのspriteのまま。仕様どおり）。

# Changed Files

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutTsuppari.test.ts`（新規）
- `src/game/input/pushDummyController.ts`
- `src/game/input/pushDummyController.test.ts`
- `src/game/input/pressLatch.test.ts`（intent literalのみ）
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/presentation/wrestlerVisualState.test.ts`
- `src/game/scenes/BoutScene.ts`
- intent helperだけを直したもの: `src/game/sumo/BoutCounter.test.ts`、`BoutCounterPosition.test.ts`、`BoutCounterTransitionRingOut.test.ts`、`BoutDrive.test.ts`、`BoutPush.test.ts`、`BoutSimulation.test.ts`、`BoutTokudawara.test.ts`
- 上記 + key一覧: `BoutGrip.test.ts`、`BoutOrientation.test.ts`、`BoutRingOut.test.ts`
- 上記 + fixtureの位置: `BoutCounterTransition.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Files Explicitly Not Changed

`CURRENT_TASK.md`、`PROJECT_HANDOFF.md`、`WrestlerView.ts`、`productWrestlerArt.ts`、`public/assets/**`、`tools/wrestler_art/**`、`ringOut.ts`、`grappleOrientation.ts`、`pressLatch.ts`、`movementVector.ts`、`docs/WRESTLER_PRODUCT_ART_SPEC.md`、`docs/GAME_CONCEPT.md`、package files、`main` branch。

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| Left / Rightのsemantic intent | `ParticipantIntent.tsuppariLeftPressed / tsuppariRightPressed`（必須） | TS01〜10、tsc、smoke |
| 手ごとのcooldown | `MutableParticipant.tsuppariCooldown`、`startTsuppari`（受け付けたtickで60）、`advanceTsuppariCooldown`（tickの先頭、transitionより前） | TS02〜07、TS12、TS39、smoke |
| 固定のtiming | `TSUPPARI_STARTUP/ACTIVE/RECOVERY_TICKS` 6 / 1 / 9、`nextTsuppariPhase`、`advanceAction` | TS11、TS12、TS15、TS42、visual-state test |
| 中心基準のreach | `inTsuppariReach`: `distance ≤ TSUPPARI_HAND_REACH + receiver.bodyRadius` | TS14〜17 |
| impulse | `resolveForces`: 受け手だけ `±n·J` + clamp。Kuzushiの受けやすさなし | TS15、TS16、TS35 |
| 決定的なbuildup | `tsuppariBuildup`、`TSUPPARI_KUZUSHI_BUILDUP` = 5、6回目でKuzushi + 0 | TS18〜20、TS29、TS30、smoke |
| Counterでその場のKuzushi | `resolveCounter(contact)` のTsuppari分岐（transition / 移動 / tier / buildupなし） | TS21〜25、TD3、smoke |
| Tsuppari同士の対称性 | 判定 → 力 → Kuzushi、受け手ごとのimpulse | TS27〜30 |
| Push × Tsuppariの勝負 | 組のtickは `resolvePush(contact, strikeNet)`（`J·0.5`）、それ以外は受け手だけ | TS31〜33、smoke |
| Pushの変位の増加 | `PUSH_EXTERNAL_ACCELERATION` = 26.25 | TS35、TS36、既存のPush Test |
| Push × Pushの保持 | Tsuppariが無いtickは従来の式そのまま | TS34、既存のPush / Counter Test |
| ring-outの経路 | externalVelocity → 既存の積分 / `resolveArenaRingOut` | TS37、TS38、TS43 |
| Stateの所有 | Simulationだけが正本。Snapshotはdeep copy | TS44、key一覧のTest |
| 入力のlatch | `tsuppariLeftLatch / tsuppariRightLatch`、KeyCodes.LEFT / RIGHTの `down`、最初のtickだけ、`clearPressLatches` | smoke（同じframe、R / Enter） |
| dummy mode | `DummyMode 'tsuppari'`（key 3）、`DUMMY_TSUPPARI_RANGE` 0.8、`DUMMY_TSUPPARI_RECEDE_SPEED` 0.1、Snapshotのcdを使う | TD1〜TD4、smoke |
| presentation / debugの境界 | `wrestlerVisualState`: pose `tsuppari` + `tsuppariHand / tsuppariPhase`。Scene: phase textと、左下のdebug行（key 0のときだけ） | visual-state test、smokeのscreenshot |

# Design Deviations

Design Deviations: NONE

ACTION-07Aの意味からの変更は無い。設計の範囲内で、実装上の細部として決めたもの:

- dummyのharnessは、範囲内でも、相手が `DUMMY_TSUPPARI_RECEDE_SPEED`（0.1 m/s）より速く離れている間は打たない
  - 前の命中で滑っている相手を打って、分かりきったwhiffになるのを避けるため
  - harnessだけの値で、Simulationの命中判定は複製していない
- Tsuppariのdebug表示は、参加者ごとに体の下へ置くと、近いときに重なって読めなかった（smokeのscreenshotで確認）。そのため、既存のdebug textと同じ左下の固定行（y = 944）にまとめた

# Unexpected Scope

- 参加者のkey一覧を確かめる既存のTest 3件が、Snapshotの追加で失敗した。一覧にfieldを2つ加えた（主張は不変）。CounterTransitionのguardrailの対象ではないが、Taskが要求したState追加の直接の結果なので、ここに記録する
- 修正したもの以外の問題は見つけていない

# Known Untested Items

- 実機のGPUでの描画（headlessはSwiftShader。既知の三角形の崩れは、以前から続いている現象）
- Browserの「Push × dummyのTsuppari」の組の勝負は、押すtimingがCDPの遅延に左右される。6回のうち2回で、組の勝負を確認した（他の回は、接触の外で普通の命中になるなど、設計どおりの別の場面）。決定的な検証は、unit test TS31〜33で行っている
- Tokudawaraの窓の中で、Tsuppariによってring-outする専用のfixtureは無い（既存の `resolveArenaRingOut` をそのまま使っている）
- Game Feel（User Play Test）

# User Play Test

**Required。** 判断してほしいもの:

- Tsuppariのtiming（startup 6 / recovery 9）
- 1秒の手のcooldown
- 左右を交互に使うリズム
- reach 0.875 m
- Tsuppariの押しの距離（約0.27 m）
- 強くしたPushの距離（約0.53 m）
- Push × Tsuppariの勝負の感触（同時なら約0.29 m押し切る。startup中に当たるとPushが止まる）
- Tsuppari同士の打ち合い
- CounterでTsuppariを捕える間合いと読みやすさ
- 6回目のKuzushiの周期
- 一枚poseを将来、action全体に表示するか、もっと短いphaseに表示するか

操作: ArrowLeft / ArrowRight = Tsuppari、`3` = dummyのTsuppari mode、`0` = debug表示（phase textと左下のcd / buildup）。

# Git Delivery

- Task-ownedのfileだけを明示的にstageし、1 commit（`feat(action): implement tsuppari gameplay`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → working tree clean
