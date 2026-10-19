Task-ID: ACTION-05A-GRIP-ENGAGEMENT-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: d72f43b0887203095eebe3f1c7efb1d1193a188d
Agent-Start-Head: 2108e0029279007d6f574e630c3cf3b772be5a1d
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 148/148、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**
- User Play Test: **REQUIRED / NOT RUN**

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `d72f43b`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `d72f43b..origin/develop` の変更は `docs/agent_handoff/` 配下のみ（CURRENT_TASK.md、CURRENT_COMPLETION_REPORT.md）→ `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `2108e00`

# Changed Files

- `src/game/sumo/BoutTypes.ts`: `gripPressed`、`GripPhase`、`grip` action、`GrappleAdvantage`、`BoutEngagement`、`BoutSnapshot.engagement`
- `src/game/sumo/BoutSimulation.ts`: engagementの正本、Grip / release / bond、定数3つ
- `src/game/sumo/BoutGrip.test.ts`（新規）: T92〜T109、T112、T114
- `src/game/input/pushDummyController.ts`: GRAPPLEDを尊重し、intentに`gripPressed: false`を追加
- `src/game/input/pushDummyController.test.ts`: helperの追加とT110
- `src/game/input/pressLatch.test.ts`: T111（Shift latchの統合確認）
- `src/game/scenes/BoutScene.ts`: Shift latch、ENGAGE表示、組みの線、`GRIP` / `GRIP REC`表示
- `src/game/sumo/BoutSimulation.test.ts` / `BoutPush.test.ts` / `BoutCounter.test.ts` / `BoutCounterPosition.test.ts`: helperに`gripPressed: false`を追加しただけ（assertionは不変）
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

AGENTS.mdは変更なし。新規dependencyはなし。

# User Decisions Implemented

1. stableかつidleなtargetへの有効なGrip → 決定的にneutral
2. Kuzushiかつidleなtarget → Morozashi（holder = 掴んだ側）。targetのKuzushiは即座に消費してstable
3. 片側だけのGripは、action idleのtargetにだけ成立する（Push / Counter / Gripを中断しない）
4. GRAPPLED中は両者ともShiftでrelease可能。releaseした側だけがGrip Recovery、同時なら両者
5. GRAPPLED中はWASDを抑制
6. `GRIP_RANGE_MARGIN = 0.09` m
7. Shift（左右どちらでも同じ。Phaser `KeyCodes.SHIFT`）、hold時のauto-repeatなし

# Engagement（single SoT）

- `BoutSimulation.engagement: BoutEngagement`（`free` | `grappled{advantage}`）。constructorで`free`
- Snapshotのtopレベル`engagement`は独立したcopy
- participant stateには組みのflagを一切持たせない（T92でkeyの集合を確認）
- 入口は`enterGrapple()`だけで、releaseはtickの先頭でだけ起こる
- LIFTEDは追加していない

# Grip Action / Resolution

- `grip{phase: 'reach' | 'recovery', ticksRemaining}`
  - `GRIP_REACH_TICKS = 6`、`GRIP_RECOVERY_TICKS = 12`
  - 押したtickがreachの1 tick目
  - phase中は実効move 0（grounded brake）
- 開始条件: FREEかつidleかつstable。同じtickの優先順は Push > Counter > Grip
- `resolveGrip()`（FREEのときだけ、Counter解決の後、Push解決の前）:
  - 範囲 = `distance <= rA + rB + GRIP_RANGE_MARGIN`（範囲外なら何もしない）
  - 両者がreach中かつstable → neutral（配列順に依存しない）
  - それ以外: reach中かつstableな側が、action idleの相手を掴む。相手がKuzushiならpostureをstableにしてMorozashi、それ以外はneutral。成立し得る向きは常に1つ
- whiff: reachが切れたらrecovery（Kuzushiにはならない）

# Enter Grapple / Bond

`enterGrapple(advantage)`の処理:
1. engagementをset
2. 両者のactionをidle
3. 両者の`externalVelocity`を成分ごとの平均にそろえる（暫定の正規化。質量は扱わない）
4. `resolveGrappleBond()`で中心距離を`R`ちょうどへ対称に寄せる

`resolveGrappleBond()`: 中心軸に沿って両者を`(distance − R) / 2`ずつ動かす。同一中心ならAのfacingをfallbackにする。GRAPPLED中は毎tick、通常のcontactの後に呼ぶ。

GRAPPLED中:
- 両者のWASDは0（制動）
- FREE用のaction開始なし
- facingは既存のauto-facing

# Release

- tickの先頭（posture timerの直後）で処理する。engagementがgrappledで、誰かのGrip edgeがあれば:
  - FREEへ戻す
  - 押した側をGrip recovery（12）にする。release tickが1 tick目
  - 同時なら両者
- release tickは誰もFREE actionを開始しない（そのedgeは捨てる）
- releaseしなかったidleの側は、同じtickから通常の移動ができる
- 位置・速度・facingは変えない
- Morozashiは消える

# Step Order（実装どおり）

1. posture timer
2. release（tickがGRAPPLEDで始まった場合）
3. FREE action開始（優先順）
4. 実効move（GRAPPLED中は0）
5. self velocity
6. external減衰
7. 積分
8. contact
9. GRAPPLEDならbond / FREEならCounter → Grip → Push（Contactがあり、まだFREEの場合）
10. action timer
11. facing

Task §Step Orderと同じ意味。intentのsanitizeはparticipantごとのloop内で行う（従来どおり）。

# Dummy

Snapshotの`engagement.kind === 'grappled'`の間、Dummyは`NO_INPUT`（move 0、edgeはすべてfalse）を返し、cooldownを30に保持する。Dummy自身がGripを出すことはない。release後、最初のFREE tickからちょうど30 tick後に次のPushを出す（T110）。

# Presentation

- 画面上部の2行目に`ENGAGE: FREE` / `ENGAGE: GRAPPLED` / `ENGAGE: MOROZASHI (PLAYER|CPU)`
- 組み中は2人の中心を線で結ぶ（neutralは白い4 px、Morozashiはholder色の8 px）
- phase textは`GRIP` / `GRIP REC`を追加。`KUZUSHI`の優先は維持
- mode行に`Shift: grip`を追記

# Tests（148/148 PASS）

既存124件はhelperに`gripPressed: false`を追加しただけでPASS（T113）。新規24件:

- T92 既定FREE、Snapshotの分離、participantに重複flagなし
- T93 stable → neutral
- T94 Kuzushi → Morozashi（holder a）、Kuzushi消費。B側の鏡像（holder b）
- T95 範囲境界（ちょうどの距離で成立、+1e-6でwhiff → recovery、Kuzushiでも範囲は省略しない）
- T96 1 edge = 1回、連打は無視、Push > Counter > Grip
- T97 targetのPush / Counter / Grip recoveryは中断しない。reachはtargetがidleになるまで待てる（tick 24で成立）
- T98 Kuzushi最後の1 tickならMorozashi、`ticksRemaining 0`ならneutral
- T99 同時Gripはneutral（participantの順序を入れ替えても同じ）
- T100 Kuzushi側は開始できない（相手がholderになる）。両者Kuzushiなら何も起きない
- T101 / T108 Best → 背後 → Grip → Morozashi、externalVelocityの平均
- T108 Success → 側面 → Morozashi。overshootで離れた10 tick後（隙間3 cm超）でもmargin内なのでMorozashi
- T102 margin距離から対称に吸着（中点は不変）
- T103 反対方向のWASDを180 tick入れても距離は`R`、位置・速度は不変
- T104 GRAPPLED中はPush / Counter / WASDが効かない
- T105 片側release（neutral / Morozashiの不利側）。同じtickのFREE edgeは捨てる。releaseしなかった側は移動できる
- T106 同時releaseは対称
- T107 releaseで位置・速度・facingは不変、advantageは消える
- T109 holderの不変条件
- T110 Dummyの挙動
- T111 Shift latch（0 tickのframe、holdでrepeatしない、再押下、Up / Down / Shiftの優先）
- T112 reach 6 / recovery 12 tickちょうど（whiffとreleaseの両方）
- T114 混在sequenceのreplay一致・finite・engagementの不変条件（GRAPPLED中は距離R、両者stable / idle、holderは実在するid）

# Browser Smoke

**NOT RUN（environment limitation）**。`pnpm build`は成功。

# Acceptance Criteria

| AC | 状態 / 根拠 |
|---|---|
| single SoT / default FREE | PASS（T92） |
| Shift edge | PASS（T111） |
| Push > Counter > Grip | PASS（T96 / T111） |
| Reach / Recovery | PASS（T112） |
| stable → neutral | PASS（T93） |
| Kuzushi → Morozashi + 消費 | PASS（T94 / T98） |
| margin 0.09 m | PASS（T95） |
| targetのactionを中断しない | PASS（T97） |
| 同時Gripの対称性 | PASS（T99 / T100） |
| external正規化 | PASS（T101） |
| 吸着 / bond | PASS（T102 / T103） |
| GRAPPLED中の抑制 | PASS（T104） |
| release + recovery | PASS（T105〜T107） |
| DummyのEngagement対応 | PASS（T110） |
| debug表示 | 実装済み（ブラウザで未確認） |
| Counter → Kuzushi → Morozashi | PASS（T101 / T108） |
| Drive / Throw / Lift / stats / RNGのscope creepなし | PASS |
| test / build | PASS |
| User Play Test | REQUIRED / NOT RUN |
| Unexpected Scope | なし |

# Implementation Evidence

上記Testsの対応どおり。Drive、Throw、Lift、stat、RNG、Ring-out、方向による優位、GRAPPLED中の移動のcodeはない。

# Design Deviations

なし。

# Unexpected Scope

なし。

Play Test向けの所見:
- 組み中は両者が動けず、外力も平均化されて止まる。releaseするまで状況は変わらない（Driveが未実装のため。仕様どおり）
- Morozashiとneutralの差は、現時点では表示だけ（Morozashiの効果はDrive / Throw Taskで付ける）

# Known Untested

- Browser Smoke全項目（Shiftの実入力と左右、hold、表示、組みの線、R、console error）
- Grip / Engagement Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Task §User Play Testの12項目）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add grip engagement foundation`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
