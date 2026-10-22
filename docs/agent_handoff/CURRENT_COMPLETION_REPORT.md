Task-ID: ACTION-11C-GRIP-LUNGE-CONTEST-IMPLEMENTATION
Result: PASS WITH USER PLAY TEST REQUIRED
Branch: develop
Source-Baseline: 710d86e58cb7c8d9b6695828a08175f931225043
Agent-Start-Head: e9a710e944853cd99afdcf7fac97d94a0d7eddaa
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER PLAY TEST REQUIRED:

- Technical PASS
  - 必須ケース（G / V / C / TG / PG / GC / GG / IK / R / D / P）をすべて実行した
  - timing sweep 441 cell × 4通り（役割の入れ替え / id / 配列順）が一致した
  - `pnpm test`は486件すべてPASS、`pnpm build`もPASS
  - Browser Smokeは20 / 20 PASS（GPU）
- Game Feelは、User Play Testで判断する

ACTION-11Bの推奨設計を、User選択（D1 = 4 tick、D2 = neutral、D3 / D4 = Push / Tsuppariのstartupとrecoveryは掴めないまま）どおりに実装した。

- Gripのreachは、8 tickの短い突進になった
  - 押下時の方向とfacingで固定する
  - 移動は約0.10 m、制動の惰性を含めて0.1267 m
- 成功の条件は、実接触と、reachの経過4 tick以上
- Gripの関係は、純関数`resolveFreeGripContest`が1つの状態から対称に決める
  - Tsuppari > Grip
  - Push impact > Grip
  - Grip > Counter（neutral）
  - Grip / Grip（neutral）
- 実装がACTION-11Bの推奨prototypeと一致することも確認した
  - random入力200 bout、211,978 tick、FREEからのgrapple突入737回で、Snapshotの不一致は0（Gripの`direction`を除いて比較）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `710d86e`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `710d86e..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `e9a710e`

# 定数

| 定数 | 値 | 備考 |
|---|---|---|
| `GRIP_REACH_TICKS` | **8**（6から） | reach = 突進 |
| `GRIP_MIN_ATTEMPT_TICKS` | **4**（新規） | 成功は、reachの経過 ≥ 4 のtickから |
| `GRIP_RECOVERY_TICKS` | 12 | 変更なし |
| `GRIP_RANGE_MARGIN` | **削除** | Gripの成功は実接触だけ。test / docsの参照も更新した |

`BODY_RADIUS`、`CONTACT_SLOP`、movement / Push / Tsuppari / Counter / Kuzushi / Driveの値は変えていない。

# Gripのactionの最終形（`BoutTypes.ts`）

```ts
{ kind: 'grip'; phase: 'reach' | 'recovery'; ticksRemaining: number; direction: Vec2 }
```

- `direction`は、押下時の`(cos facing, sin facing)`
  - whiffや取り消しのrecoveryでも、そのまま持つ
  - 解除（release）のrecoveryは、解除時のfacingを入れる。recoveryでは使わない
- Snapshotにdeep copyする（testあり）
- target id、hit flag、eligible flag、startup timerは足していない
- eligibleは`GRIP_REACH_TICKS − ticksRemaining ≥ GRIP_MIN_ATTEMPT_TICKS`から導く（`isGripEligible`。stableも条件）

# FREE 1 tickの解決順（実装）

```
… → 積分 → resolveContact
→ openPushImpact（接触で、PushのimpactWindowを開く）
→ const grip = resolveFreeGripContest(a, b, contact !== null)   // 1つの状態から、対称に
→ grip.cancelled → Grip recovery（GRIP_RECOVERY_TICKS、direction保持）
→ resolveCounter（変更なし）
→ grip.grapple があれば enterGripGrapple: Morozashiなら相手のKuzushiを消費 → enterGrapple（変更なし）
→ engagementがまだFREEなら resolveForces（Push / Tsuppariの力。変更なし）
→ advanceAction → updateFacing（Grip reach中はfacingを固定）→ ring-out
```

- 旧`resolveGrip`（距離0.79の判定）は削除した
- Tsuppariの命中判定（`isTsuppariHitTick` / `inTsuppariReach`）とPushの`isPushActive`は、helperと既存のresolverが同じ述語を使う
  - これらの述語は、`ActionFacts`（Snapshotのparticipantでもよい構造型）を受け取るように一般化した
- `resolveCounter`は、Gripを含むpairでは何もしない
  - Counterが捕えるのはPush / Tsuppariの攻撃側だけで、そのとき相手はGripをしていない
- そのため、Counterとgrapple突入の順序は結果に影響しない

# 実測（Simulation）

| 項目 | 値 | 確認したtest |
|---|---|---|
| reachの終わりまでの移動（開けた場所） | **0.100000 m**（誤差1e-9以内） | G4 |
| 制動の惰性を含めた移動 | **0.126667 m** | G5 / smoke 3（0.1267 m） |
| 最高速度 | **1.333333 m/s** | G6 |
| reach / recoveryのSnapshot数（whiff） | reach 7（押下tickを含めて8 tickの解決）→ recovery 12 → idle | G10 / smoke 6 |
| 接触してから押した場合 | 経過1〜3はfree、経過4でneutral。成功前のreach Snapshotは**4枚**（ticksRemaining 7 / 6 / 5 / 4） | V1–V4 / smoke 4・5 |
| 止まった相手に届く距離 | 0.800 / 0.801 mは成功、0.803 / 0.85 mはwhiff | C4 |
| 接触による成功時のbond補正 | 相手の位置は動かない（誤差1e-15）。距離は0.70 m（誤差1e-12）。grapple tickのGrip側の移動は、自分の突進1 tick分以下 | C3、T102 |
| 斜めにかすめる接触 | 相手の横歩き中（gap 0.78）でも成功。Grip側はまっすぐ進む | C5 |
| homingしない | reach中のfacingは0のまま、y = 0のまま。WASDは無視。recoveryで相手の方を向き直る | G7–G9 / smoke 7 |

# 全pairの結果（実装 + test）

| Pair | 結果 | test |
|---|---|---|
| Push / Push | 変更なし。両方のimpact中は、pairのexternalが0（7 tick） | R1 |
| Push / Tsuppari | 変更なし。連結され、pairの押し出しは0.5325 → 0.2914 m、buildup +1 | R2 |
| Push / Grip | 接触中のimpactが、reach中のGripを取り消す → Grip recovery。Pushの力は、idleの相手のときと1 tickごとに完全に同じ。startup / 接触前のcharge / recoveryは取り消さず、掴むこともできない | PG1–PG7 / smoke 9 |
| Push / Counter | 変更なし。Best、CounterTransition、pusherはKuzushi | R3 |
| Tsuppari / Tsuppari | 変更なし。両方が命中し、impulseは逆向きで同じ大きさ | R4 |
| Tsuppari / Grip | 命中tickに、reach中のGripを取り消す → Grip recovery。impulse 2.13 m/sとbuildup +1はidleの相手のときと同じ。6発目のKuzushiも成立する（buildupは0に戻る）。Grip側の負けにKuzushiは無い | TG1–TG6 / smoke 8 |
| Tsuppari / Counter | 変更なし。攻撃側がKuzushi、impulseなし、CounterTransitionなし | R5 |
| Grip / Grip | 実接触で、eligible + 相手がreach中（または両方eligible）→ neutral。両方同時に押すと経過4。片方が2 tick早いと経過2 | GG1–GG3 / smoke 13 |
| Grip / Counter | eligible + 実接触 + Counter window中 → neutral。Counterはidleに戻り、Kuzushi / CounterTransitionは無い。先に時間切れでKuzushiになっていればMorozashi | GC1–GC5 / smoke 10・11 |
| Counter / Counter | 変更なし。両者ともwindowの終わりにKuzushi | R6 |
| Idle / Grip | neutral | IK1 |
| Kuzushi / Grip | Morozashi（Gripした側）。Kuzushiの消費はgrapple tickだけ（突進中や接触中はKuzushiのまま） | IK2 / IK3 / smoke 12 |
| Kuzushiの相手に届かないGrip | Kuzushiは消費しない | IK4（BoutKuzushiFollowup G2–G4も） |

`resolveFreeGripContest`の純関数testでは、次を引数を入れ替えた両方の順序で確認した:

- 掴める相手: idle / Kuzushi / Counter / Grip reach（経過0と6）
- 取り消すもの: 命中tickのTsuppari / impact中のPush
- 取り消さず、掴めもしないもの: Pushのcharge / startup / recovery、Grip recovery、Tsuppariのstartup / recovery
- 成功しないもの: eligibleでないGrip、接触なし
- 境界: Tsuppariの命中は接触なしでも届く。Pushのimpactは接触が必要

# Timing sweep（`BoutGripContest.test.ts`）

各cellを4通りで実行した。

- 役割: Gripする側を`a`にするか`b`にするか
- 配列: participantの並びを通常のままにするか、入れ替えるか

役割（G / O）で書いたtimelineが4通りすべてで同じであること、cellごとの不変条件を確かめた。

- 不変条件:
  - grappleに入るtickには、eligibleなGrip reachがある
  - 相手はidle / Counter / Grip reach
  - grapple後の距離は0.70 m

| sweep | gap | offset d | cell | 主な結果（0 = Gripの押下tick） |
|---|---|---|---|---|
| Grip / Counter | 0.70 / 0.75 / 0.80 | −14..+7 | 66 | windowが重なる → neutral（例: 0.70、d = −6 → 4: neutral）。先に時間切れ → Morozashi（0.70、d = −8 → 3: Kuzushi、4: Morozashi） |
| Grip / Tsuppari | 0.70 / 0.75 / 0.80 / 0.85 | −17..+8 | 104 | d = −6..+1は、全gapで`d+6: 取り消し + 命中`。d = +3（0.75）→ 7: whiff、9: 命中。d = +6（0.75）→ 5: neutral（Tsuppariは始まらない） |
| Grip / Push | 0.70 / 0.75 / 0.80 / 1.2 / 1.6 | −30..+8 | 195 | 1.2、d = −24 → 0: 取り消し + impact。startup / recovery / 接触前のchargeは取り消さない。d = +6（0.75）→ 5: neutral |
| Grip / Grip | 0.70 / 0.75 / 0.80 / 0.90 | −9..+9 | 76 | 0.75、d = 0 → 4: neutral。0.90、d = 0 → 7: neutral（同時の突進だけが届く）。0.90、d = 2 → 両者whiff |
| 合計 | | | **441 cell × 4通り** | **すべて一致**。不変条件の違反は0 |

この結果は、ACTION-11Bで測った表と同じ。上記のprototypeとの一致（211,978 tick）でも裏付けられる。

# 参加者の順序

- sweep全体: 441 × 4で一致
- 純関数: 全ケースで引数の順序を入れ替えて一致
- 既存: BoutGripのT99（同時Grip、配列を入れ替え）、BoutDriveのT147は引き続きPASS

# Regression

- `pnpm test`: 28 files、**486 PASS**
  - 新規: `BoutGripContest.test.ts` 35件、`gripAttemptGateArt.test.ts`のV6 2件
- `pnpm build`: PASS（既存の500 kB chunkの警告だけ）
- `npx tsc --noEmit`: clean
- `git diff --check`: clean
- D1–D5（grapple / Drive）: 既存のBoutGrip（T101: externalの平均、T102 / T103: bond、T105–T107: 解除）、BoutOrientation（15件）、BoutDrive（19件）がPASS
  - grapple突入の位置だけを、新しい成立tickに合わせた
- Ring-out / Tokudawara:
  - 新しいtestを追加した（Tokudawaraのring、縁から2.2〜2.274 m、相手はring内、静止 / 左右へ横歩き、300 run超）
    - Grip側のring-outは0件で、決着の理由は既存の`ring-out`だけ
  - BoutRingOut / BoutTokudawaraの既存testはPASS
- P1–P5（presentation）:
  - attemptはreachのあいだだけ。recoveryと取り消しの後はidle sprite、成功後は既存のfallback
    - V6: 接触から押すとattemptのframeが4、Tsuppariに負けたtickからidle
  - Push / Tsuppari / Counter / Kuzushiの見た目のtestはPASS
  - art exporterは4本とも`--check`がexit 0
  - `public/`と`tools/`に差分なし（Product assetのhashは不変）
- `src/game/input/`のproductionは変更なし（testだけ変更）

# 既存testの更新（仕様変更に合わせたもの。弱めてはいない）

| test | 変更 |
|---|---|
| BoutGrip T93 / T94 / T98–T101 / T105–T109 ほか | 接触してから押すGripは、押下tick + 4 tickで成立（`pressGrip`）。T93は「押下tickでは成立せず、経過4で成立」を明示的に確認する |
| BoutGrip T95 | 「範囲0.79の境界」→「突進が届かなければwhiff（Kuzushiでも迂回できない）」 |
| BoutGrip T97 | Counterを掴まない部分は削除（Grip > Counterになったため、新testのGC1–GC4へ）。Grip recoveryの相手は、解除によるrecoveryで確認する形に変えた |
| BoutGrip T102 | 「marginからの対称なattach」→「突進が隙間を詰め、実接触で成立。snapなし、相手は動かない」 |
| BoutGrip T106 / BoutOrientation T124 | 解除の同時recoveryは、`direction`以外（phase / timer）が一致することを確認する |
| BoutRingOut T170 | marginによるattachの引き込みは無くなったため、「縁ちょうどの相手を掴んでも、相手は動かずIN、ring-outしない」に変えた（後半のDrive部分は変更なし） |
| BoutDrive T146 / pushDummyController T110 | Mode 2のdummyは、FREEで接触するとPushを出し、そのimpactでGripが負ける（Push > Gripのとおり）。testの目的はgrapple中のDriveとcooldownなので、dummyは最初のgrapple以降だけ使う |
| 他（Orientation / Drive / Kuzushi / Tsuppari / CounterTransition / Tokudawara / visual state / 汗 / 11A art） | 成立tickを`GRIP_MIN_ATTEMPT_TICKS`ずらし、旧範囲の定数を、突進で届かない距離に置き換えた |

# Browser / Runtime Smoke

headless Chrome + CDP、GPU、Vite dev server。

- `WrestlerView.apply`を読み取り専用でwrapした
- CPUの入力は、test専用のhookで差し込んだ
- fixtureでsimulationを差し替えた

結果は **20 / 20 PASS**。

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 | Shiftで、blueのattempt texture（reachのあいだだけ） | PASS |
| 3 | 短い突進。移動0.1267 m | PASS |
| 4 | 接触してから押しても、成功前にreach Snapshotが4枚、attemptのframeが出る | PASS |
| 5 | 経過4でneutral grapple。距離0.7、相手のx = 0.35のまま。attemptは消える | PASS |
| 6 | whiff: reach 7 Snapshot → recovery 12（idle texture）→ idle | PASS |
| 7 | homingしない（CPUが0.058 m横へ動いても、facingとyは固定） | PASS |
| 8 | Tsuppariの命中で、CPUのGripが同じtickに取り消される（recoveryの残り11）。attempt → idle sprite | PASS |
| 9 | Pushのimpact（接触）で、CPUのGripが取り消される。Pushはそのまま続く（CPUのx 0.35 → 0.882） | PASS |
| 10 | CPUのGripが、playerのCounter（window中）をneutralで取る | PASS |
| 11 | Counterで負けた側はKuzushiにならない。CounterTransitionも汗も無い | PASS |
| 12 | Kuzushiのplayerを、CPUのGripがMorozashi（holder CPU）。Kuzushiはそのtickに消費 | PASS |
| 13 | 同時のGrip（両者reach中）→ neutral。両者ともattempt textureを表示 | PASS |
| 14 | Tsuppari（product-tsuppari-blue-left）/ Push（idle sprite）/ Counter（product-counter-blue + 体の回転）は変わらない | PASS（3項目） |
| 15 | Rでrestartできる | PASS |
| 16 | console error、runtime error、失敗したrequestが無い | PASS |

最初の2回の実行では、script側のbug（記録をclearした後に読んでいた、待機条件の誤り）でFAILが出た。修正後に全項目PASS。

Screenshot（scratchpad `smoke11c\`、commitしない）:

| 状況 | file |
|---|---|
| 突進の途中 | `01_blue_lunge_attempt_midway` |
| 成功前のattempt | `02_contact_attempt_before_success` |
| 最小attempt後の成功 | `03_grip_success_after_min_attempt` |
| Tsuppari > Grip | `04_tsuppari_beats_grip` |
| Push > Grip | `05_push_beats_grip` |
| Grip > Counter | `06_grip_beats_counter` |
| Kuzushi → Morozashi | `07_kuzushi_grip_morozashi` |
| Grip vs Grip | `08_grip_vs_grip_both_reaching` / `09_grip_vs_grip_neutral` |

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| Gripの8 tickの突進 | `GRIP_REACH_TICKS = 8`。`effectiveMove`はreach中に`direction`を返す（既存のgrounded rule、Grip専用の加速なし）。recoveryは`ZERO_MOVE` | G1 / G4–G6 / G10、smoke 3・6 |
| 最小attempt 4 | `GRIP_MIN_ATTEMPT_TICKS = 4`、`isGripEligible`（ticksRemainingから導く） | V1–V5、V6（presentation）、smoke 4・5 |
| 実接触で成功 | `resolveFreeGripContest(…, contact !== null)`。`GRIP_RANGE_MARGIN`は削除 | C1–C5、T102、T170 |
| facing / 方向の固定 | 押下時の`direction`をactionに保存。`updateFacing`はGrip reachを飛ばす。recoveryは通常 | G7–G9、smoke 7 |
| contest helper | export済みの純関数`resolveFreeGripContest`（対称。cancelled + grappleを返す） | 純関数のpair表test（引数の入れ替え）、sweep |
| Tsuppari > Grip | 命中tick × reach中 → 取り消し → recovery。命中は既存のresolver | TG1–TG6、sweep、smoke 8 |
| Push > Grip | impact中 × 実接触 → 取り消し。startup / charge / recoveryは取り消さず、掴めない | PG1–PG7、sweep、smoke 9 |
| Grip > Counter | Counter windowは掴める相手 → neutral、Kuzushiなし | GC1–GC5、sweep、smoke 10・11 |
| Grip vs Grip | eligible + 相手がreach中 → neutral（空白なし） | GG1–GG3、sweep d = −9..+9、smoke 13 |
| Kuzushi / Morozashi | `enterGripGrapple`でgrapple tickにだけ消費 | IK1–IK4、T94 / T98、BoutKuzushiFollowup G1、smoke 12 |
| resolverの順序に依存しない | helperが1つの状態から決め、resolverは適用だけ | sweep 441 × 4、純関数の引数入れ替え |
| 既存systemの維持 | Push / Tsuppari / Counter / Kuzushi / Grapple / Driveのcodeと値は変更なし | R1–R7、既存suite全体、prototypeとの一致211,978 tick |

# Changed Files

Production:

- `src/game/sumo/BoutSimulation.ts`
  - 定数
  - Gripのaction（`direction`）
  - `effectiveMove`
  - 述語の一般化（`ActionFacts`）
  - `isGripEligible`、`resolveFreeGripContest`、`enterGripGrapple`
  - FREE tickの順序
  - `updateFacing`
  - copy / 解除 / advanceAction
  - 旧`resolveGrip`の削除
- `src/game/sumo/BoutTypes.ts`: Gripのactionに`direction`

Test:

- `src/game/sumo/BoutGripContest.test.ts`（新規）
- 更新: `BoutGrip` / `BoutDrive` / `BoutOrientation` / `BoutKuzushiFollowup` / `BoutRingOut` / `BoutTokudawara` / `BoutTsuppari` / `BoutCounterTransition` の各test
- 更新: `src/game/input/pushDummyController.test.ts`
- 更新: `src/game/presentation/gripAttemptGateArt.test.ts`、`kuzushiVisualEffect.test.ts`、`wrestlerVisualState.test.ts`

Docs:

- `docs/ARCHITECTURE.md`: ACTION-05AのGripの記述、新しい「Grip lunge + contest」の項、`step()`の順序、ACTION-11Aの注記
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更していない:

- `WrestlerView` / `BoutScene` / inputのproduction
- art / asset
- `WRESTLER_PRODUCT_ART_SPEC.md`
- `PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Design Deviations

Design Deviations: NONE

実装上の解釈を2点、明記する:

1. 取り消されたGripは、取り消したtickに`GRIP_RECOVERY_TICKS`（12）のrecoveryへ入る。そのtickが12 tickのうちの最初になる
   - Snapshotでは残り11。ここは既存の解除（release）のrecoveryと同じ数え方
   - 時間切れのwhiffは、tickの終わりに12で入る（既存どおり）
2. 解除によるGrip recoveryにも、shapeをそろえるために`direction`（解除時のfacing）を入れた。recoveryでは使わない

# Unexpected Scope

なし。

- Mode 2のdummy（Pushを出すharness）がFREEで接触すると、新しいPush > Gripの規則により、playerのGripはimpactで負ける
  - dummyのcodeは変えていない
  - 2つのtest（T110 / T146）の使い方を合わせた

# User Play Test: REQUIRED

確認してほしい点:

1. Shiftが「短く踏み込んで掴みに行く」感じになったか
2. 約0.10 m（惰性を含めて0.127 m）の突進の距離は合っているか
3. 最小attempt 4 tick（約67 ms）で、attempt poseが読み取れるか
4. 実接触で掴む方が、旧0.79 mの範囲より自然か（止まった相手には約0.80 mまで届く）
5. Tsuppari > Gripは直感的か（命中でGripがrecoveryへ。命中の効果はそのまま）
6. Push > Gripは直感的か（接触したimpactだけが取り消す。startup / recovery中のPushは掴めない）
7. Grip > Counterは直感的か（neutral grapple。Counter側にKuzushiは無い）
8. Grip同士が自然に決まるか（neutral）
9. 4すくみ `Push > Tsuppari > Grip > Counter > Push` が分かりやすいか
10. Push / Tsuppariのstartupとrecoveryを掴めないままにしたことは、許容できるか
11. Counter / Tsuppari / Push / Kuzushiは、引き続き読み取れるか

あわせて試してほしいこと（変更していない既存の挙動）:

- Mode 2（Push dummy）は、接触するとPushを出す
- そのため、CPUにGripを当てるのは以前より難しく感じる可能性がある

Technical PASSは、Game Feelの受け入れではない。

# Git Delivery

- stageするのはTask-owned fileだけ
- 手順: commit `feat(gameplay): add grip lunge contest rules` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`は変更しない
