Task-ID: LOOP-01-BOUT-FINISH-MATCHQUEUE-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / BOUT FINISH PRESENTATION + DAILY MATCH FLOW + BASHO RECORD
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105
Handoff-Mode: GITHUB

# LOOP-01 — Bout Finish Presentation / Daily Match Queue / Basho Record Investigation

## Purpose

ACTION-06A Ring-out / BoutOutcome FoundationはTechnical Review + User Play TestでAccept済み。

次は、Boutが決着した後を「Result画面」や「1試合Reward」へ進めるのではなく、

- 行司による勝者指示Presentation
- Player側から見た Win / Lose 表示
- Rematch処理
- その日の所属力士の取組Queue
- 場所成績への1勝 / 1敗の記録
- その日の予定取組終了後にSimulation画面へ戻る境界

として設計する。

Investigation Only / No Production Changes.

今回の中心はState ownershipとFlow設計。
まだProduction実装しない。

## Accepted User Direction

### 1. Result画面は作らない

Bout終了後に別のResult Scene / Result Screenへ遷移する設計は採らない。

土俵上の最終状態を残したまま、
行司Presentation + 勝敗文字表示で取組結果を伝える方向。

### 2. 1試合ごとのRewardはない

- XP
- money
- item
- stat growth
- per-bout reward

を今回のFlowへ入れない。

取組結果として記録するのは、その場所における勝 / 敗。

### 3. Boutの決着理由はRing-outだけではない

Current SourceではRing-outだけが実装済み。

将来:
- 土俵内で転がされた
- 倒れた / ground touch
- Throw等

でも敗北し得る。

したがってFinish Presentation / Match Flowは:
- `reason === 'ring-out'`専用にしない
- canonical `BoutOutcome.win{winnerId, loserId, reason}` を受けて処理する
- future finish reason追加でFlowを作り直さない

今回、ground-touch / Throw等の勝敗rule自体は実装しない。

### 4. 行司

行司は試合中には表示しなくてよい。

決着後だけ登場するPresentationを想定。

正式Sprite/Animationはまだ作らず、
次Implementationでは必要ならPlaceholderで:
- 登場
- 勝者側を示す
- 軍配を上げる/向けることが分かる
- Presentation完了

を読める最小状態遷移を目指す。

添付動画のような「決着後に行司が勝者を示す」方向をReference Feelとするが、
素材や具体Animation frameは未決。

### 5. Win / Lose文字

ユーザー視点は所属力士側。

Owned wrestlerが勝った:
`Win`

Owned wrestlerが負けた:
`Lose`

東西はWin/Lose文字の決定には使わない。

Current `EAST PLAYER Win / WEST CPU Win` はACTION-06AのPrototype表示。
次Flowでは、owned wrestler perspectiveの `Win / Lose` 表示へ移す方向を調査する。

### 6. Win/Lose後のFlow

所属力士が複数いる場合:

- その日に予定されている所属力士の取組だけが対象
- まだ未消化の予定取組があれば、次の所属力士のBoutへ遷移
- その日の予定取組を全員終えていれば、Simulation画面へ戻る

例:
所属5人、その日に3人だけ取組予定
→ その3Boutだけ順番に実施
→ 3Bout終了後にSimulationへ戻る

所属しているがその日取組がない力士はQueueに入れない。

### 7. Rematch

Current simultaneous Ring-out:
`BoutOutcome.rematch`

User direction:

```
simultaneous finish
↓
数秒待つ
↓
Rematch
↓
試合開始Animation
↓
same pairで再試合
```

- Rematchは場所成績へ勝敗を記録しない
- Match Queueの次へ進めない
- same scheduled boutをやり直す
- auto-rematch方向
- exact wait secondsは未決 / Investigationで最小Prototype値を提案可
- formal start animationは未実装。次ImplementationでPlaceholder start presentationまで必要か調査する

### 8. Bout finish Presentation

Win/Lose:
```
BoutOutcome final
↓
BoutSimulation frozen
↓
brief pause
↓
Gyoji placeholder presentation
+ Win / Lose text
↓
record result exactly once
↓
next scheduled owned bout OR Simulation
```

Exact seconds / input-vs-auto advanceは未決。
Investigationで最小Prototypeを推奨する。

### 9. Basho record

1取組のwin/lossは、所属力士のその場所成績へ加算。

Accepted bout counts:
- 横綱: 15
- 大関: 15
- 関脇: 15
- 小結: 15
- 前頭: 15
- 十両: 15
- 幕下: 7
- 三段目: 7
- 序二段: 7
- 序ノ口: 7

勝ち越し:
- 15番制: 8勝以上
- 7番制: 4勝以上

負け越しはその逆。

今回:
- win/loss record boundaryは調査対象
- 具体的な番付変動幅は実装しない

### 10. East / West in Banzuke

同じ枚目でもEast / Westは別rank slotとして扱う方向。

例:
- 前頭5枚目 東
- 前頭5枚目 西

内部では連続したrank順序として扱える方向を将来検討。

今回のMatch Flowでは具体的なBanzuke ordering systemを作らない。

### 11. Future Banzuke movement

User direction:
- 勝ち越し/負け越しの量で上昇幅/下降幅が変わる
- 実際には全員の成績を相対的に見て番付が決まる
- SumoSimでも将来的に相対評価型を検討したい
- 難しければ疑似的に自然に見える方式を後で設計
- **今は決めない**

Do NOT invent:
- 8-7なら何rank上がる
- 10-5なら何枚
- promotion formula

### 12. Special rank rules

Future direction:
- 大関: 負け越しで関脇へ降格
- 横綱: 負け越しで引退
- 特殊昇進/降格ruleは有り
- 実際より少し単純化する

詳細はDeferred。
今回実装/確定しない。

# Architecture Goal

Maintain:

```
Pure TS BoutSimulation
  ↓
BoutOutcome
  ↓
Higher-level Match / Day Flow State
  ├─ Finish Presentation state
  ├─ Scheduled Bout Queue
  ├─ Basho record update
  └─ Next Bout / Return to Simulation decision
  ↓
Phaser presentation
```

Important:
- BoutSimulationにMatch Queue / Basho record / Management stateを入れない
- Sceneをlong-term Management StateのSource of Truthにしない
- Presentation timerとpersistent win/loss recordを同じstateに混ぜない
- Rematchでrecord二重加算しない
- Win/Lose記録はexactly once

# Investigation Questions

## Q1 — Current Source inventory

Inspect Current Source and identify:
- existing Phaser Scenes
- current boot flow
- whether Stable / Training / Simulation screen exists yet
- how BoutScene is created/restarted
- where Prototype participant metadata lives
- whether any higher-level flow/state owner already exists

Do not assume a Simulation screen implementation exists merely because it is planned.

## Q2 — Higher-level owner

Recommend minimal owner for:
- today's scheduled owned bouts
- current queue index / current scheduled bout
- current basho records
- return-to-Simulation decision

Compare:
- Pure TS `GameFlow` / `MatchDayFlow`
- Phaser Scene-owned
- another explicit small state object

Preferred direction:
Pure TS state/logic above BoutSimulation, with Phaser consuming it.

Avoid generic FSM framework.

## Q3 — Management state boundary

Define minimum data needed now without implementing full Management.

Potential concepts:
```ts
type WrestlerId = string

type BashoRecord = {
  wrestlerId: WrestlerId
  wins: number
  losses: number
}

type ScheduledBout = {
  ownedWrestlerId: WrestlerId
  opponentId: WrestlerId
  // setup/presentation references as needed
}
```

These are examples, not required names.

Determine:
- what is persistent across multiple Bouts
- what is per-day
- what is per-Bout
- how BoutSetup is produced

Do not add final stats/rank schema prematurely.

## Q4 — Owned wrestler identity

Win / Lose is relative to the user's所属力士.

Do not infer long-term ownership from:
- keyboard controller
- EAST/WEST side
- current PLAYER label

Recommend an explicit ownership/input to the higher-level match entry.

Current Prototype may map wrestler-a to owned wrestler, but architecture should not encode "keyboard means owned" as gameplay truth.

## Q5 — Finish Presentation phases

Recommend a small explicit Presentation lifecycle.

Example:
```
fighting
→ decisionPause
→ gyojiDecision
→ resultHold
→ complete
```

For Rematch:
```
fighting
→ rematchPause
→ rematchAnnouncement
→ boutStartPresentation
→ fighting
```

Names/timing not fixed.

Determine:
- which phases are presentation-only
- which transitions affect persistent record / queue
- whether these states belong in BoutScene or a higher presentation controller

No generic event bus/FSM framework.

## Q6 — Gyoji placeholder

Design minimum placeholder that makes User Play Test meaningful.

Need not use real sprite.

Could use:
- simple shape/person marker
- appears after decision
- moves/turns/points toward winner
- gunbai marker/line
- clearly readable winner direction
- then result text

Investigate smallest version compatible with later sprite replacement.

Do not generate final art in this task.

## Q7 — Winner direction

Gyoji must indicate the winner.

Should Presentation derive winner position from final frozen BoutSnapshot:
- winner participant final position
- vector from ring center / gyoji position toward winner

or use EAST/WEST metadata?

Prefer actual winner entity / position rather than assuming EAST/WEST screen side, because fighters may have moved around.

Evaluate.

## Q8 — Win / Lose text

Determine minimum formatter:
- owned wrestler == winnerId → `Win`
- owned wrestler == loserId → `Lose`
- rematch → `Rematch` or equivalent temporary text

User has accepted Win/Lose for now.

Do not use EAST/WEST to decide Win/Lose.

Investigate whether current ACTION-06A result text should be replaced or temporarily layered during migration.

## Q9 — Win/Lose recording moment

Critical exactly-once boundary.

Compare:
- record immediately when BoutOutcome becomes final
- record when gyoji animation completes
- record when advancing to next bout

Recommended direction to evaluate:
record gameplay result immediately when final win outcome is first consumed by higher-level flow, independently of presentation duration.

Need guarantee:
- Scene re-render/update cannot duplicate record
- R/restart cannot duplicate
- Rematch records nothing
- moving to next Bout happens only after finish presentation completes

## Q10 — Rematch

Design:
- `rematch` does not change record
- queue index does not advance
- same ScheduledBout remains current
- after presentation delay/start placeholder, create/reset a new BoutSimulation for same pair
- new Bout starts outcome ongoing

Determine ownership of restart.

Do not call a Rematch a loss/draw in BashoRecord.

## Q11 — R debug restart

Current R restarts Bout manually.

Once higher-level match flow exists, decide debug semantics:
- during normal fighting: restart same bout without recording
- after decided win but record already committed: R must NOT create a duplicate/erase record accidentally

This is a potential Prototype hazard.

Recommend safe debug behavior and whether R should be disabled after committed result or only reset presentation.

Do not leave an exactly-once hole.

## Q12 — Scheduled daily queue

Define deterministic sequence:
- only owned wrestlers with a scheduled bout today
- after win/loss presentation complete → advance exactly one queue entry
- create next Bout
- if no entries remain → day-bout flow complete → request return to Simulation

Do not create opponents' unrelated bouts unless future Simulation requires it.

## Q13 — Multiple owned wrestlers

Ensure queue supports:
- 0 scheduled bouts
- 1
- multiple

For 0:
- immediately remain/return Simulation; do not open empty BoutScene.

For multiple:
- each wrestler's result updates that wrestler only.

## Q14 — Simulation screen transition boundary

Current Source may not yet have a full Simulation screen.

If absent, define interface/transition result such as:
```
{ kind: 'day-bouts-complete' }
```

or callback/flow state.

Do not implement a fake full Management Scene merely to satisfy this task.

Recommend smallest handoff.

## Q15 — BashoRecord model

Recommend minimal persistent record fields now.

At minimum likely:
- wrestlerId
- wins
- losses

Question:
Do we also need:
- scheduledBoutCount
- completedBoutCount
- rank division / expected bouts

now?

Prefer derive/keep schedule ownership elsewhere unless required.

Do not encode banzuke movement yet.

## Q16 — 15 vs 7 bout count

Determine where the "15 / 7 per basho" rule belongs.

Preferred:
rank/division policy in future Management/Banzuke rules, which generates schedules.
Daily Match Flow consumes already-scheduled bouts and should not decide how many total bouts a wrestler receives.

Confirm.

## Q17 — Kachikoshi / Makekoshi

15 bouts:
- wins >= 8 → kachikoshi
- otherwise if completed 15 → makekoshi

7 bouts:
- wins >= 4 → kachikoshi
- otherwise if completed 7 → makekoshi

Investigate whether to:
- add pure helper now
- defer until Basho end / Banzuke task

Preferred: document boundary now, implementation only if necessary for current flow.

No rank movement formula.

## Q18 — Banzuke relative ranking feasibility

Provide a short design note only:
Is future "evaluate all wrestlers relatively, then assign next banzuke slots" technically feasible in this architecture?

Discuss:
- input: current rank slots + all basho records + special rules
- output: next ordered rank assignment
- deterministic batch calculation
- why it should be a later pure Management module

Do not design formulas now.

## Q19 — East / West rank ordering

Record accepted direction:
East / West within the same numbered rank are separate adjacent rank positions.

Do not finalize every rank encoding now.
Recommend an eventual sortable representation only if useful.

## Q20 — Special rules boundary

Record Deferred future direction:
- Ozeki makekoshi → Sekiwake
- Yokozuna makekoshi → retirement
- promotion rules remain TBD
- simplification details TBD

Do not implement.

## Q21 — Future non-Ring-out outcomes

Ensure higher-level flow only depends on:
- outcome.kind
- winnerId / loserId
- maybe reason for display/logging

It must not require Ring-out-specific geometry.

Future touchdown/throw should plug in without Match Queue redesign.

## Q22 — Scene structure

Compare implementation options:

A. keep current BoutScene and add a small finish-presentation controller
B. add a separate Finish Scene
C. replace with higher-level Scene

Given:
- no Result screen
- final bodies should remain visible
- gyoji appears over frozen Bout

Preferred direction to evaluate:
A — stay in BoutScene for visual finish, while Pure higher-level flow owns queue/records.

But confirm against Current Source.

## Q23 — Timings

Exact animation timing is not User-decided.

Recommend provisional Prototype timings for later implementation:
- decision pause
- gyoji gesture
- result hold
- rematch pause
- start placeholder

These are Presentation tuning, not gameplay constants.

Mark them provisional / User Play Test.

Do not globally retune Bout speed.

## Q24 — Placeholder Bout start animation

Rematch requires "試合開始Animation".

Investigate minimal placeholder:
- brief READY/START cue
- then new BoutSimulation begins accepting input

Should normal next scheduled bouts use the same start presentation?
Likely yes for consistency, but do not assume; recommend.

No Tachiai rule implementation here.

## Q25 — Input during finish/start presentation

Determine:
- BoutSimulation already frozen after final outcome
- Scene/higher flow should ignore Bout controls during finish presentation
- next Bout input should begin only when start presentation completes

Need avoid held ArrowUp/Shift carrying across into next Bout accidentally.

Recommend how PressLatch / held keys should be cleared/gated at transition.

Important regression risk.

## Q26 — Failure/reload/save boundary

No Save implementation now.

But clarify:
- Basho record becomes persistent Management state eventually
- finish presentation is ephemeral and need not be saved
- Match Queue/day schedule persistence can be addressed in future Save task

Do not add persistence.

## Q27 — Automated test plan

Specify later Implementation tests for:
- win records once
- loss records once
- rematch records zero
- duplicate update frames do not double count
- queue advances after presentation complete
- rematch does not advance queue
- multiple owned wrestlers update correct records
- last scheduled bout produces day-complete transition
- zero scheduled bouts skips Bout flow
- Win/Lose text uses owned identity, not EAST/WEST/controller
- future non-ring-out win reason follows same finish flow
- gyoji direction uses actual winner
- R/debug cannot double-record
- input/latches do not leak into next/rematch Bout
- deterministic replay of pure queue/record logic

## Q28 — User Play Test plan

First implementation should test:
- win → pause → gyoji points winner → Win
- loss → gyoji points opponent → Lose
- body stays frozen during decision
- next owned scheduled Bout starts after presentation
- after final scheduled Bout, returns/indicates return to Simulation
- Rematch does not alter record and restarts same pair after pause
- no stale held input immediately fires in next Bout
- placeholder animation is understandable before final art

## Q29 — Implementation split

Recommend smallest safe implementation sequence.

Likely split:
1. Pure MatchDayFlow / BashoRecord foundation + tests
2. BoutScene Finish Presentation placeholder + flow connection
3. User Play Test
4. Simulation-screen handoff when that screen/state is implemented
5. later ground-touch/Throw finish reasons
6. later Banzuke calculation

But inspect Current Source and recommend whether 1+2 can safely be one small implementation Task.

# Required Reading

Inspect at minimum:
- `AGENTS.md`
- `src/main.ts`
- all current scene files
- `src/game/scenes/BoutScene.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/ringOut.ts`
- current input latches/controller
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- Current Task final review / User Play Test acceptance
- any existing Stable/Training/Management source if present

# Scope Out

Do NOT implement:
- Production code
- final gyoji art/sprite
- full animation asset pipeline
- ground-touch/fall rule
- Throw / Lift
- Tachiai mechanics
- Result Screen
- per-bout Reward
- rank movement formulas
- full Banzuke calculation
- Yokozuna/Ozeki promotion details
- Save
- full Simulation/Management UI
- global tempo tuning

Investigation Only.

# Stop Conditions

Return BLOCKED if:
- Current Source already has a materially conflicting higher-level flow owner
- exactly-once result recording cannot be kept outside BoutSimulation without architecture change
- next-bout transition requires full Management implementation as prerequisite
- current Scene/input architecture makes rematch/next-bout input isolation unsafe without material redesign
- Current Source conflicts materially with accepted ACTION-06A baseline

Do not make Production changes.

# Verification

Investigation / Design Review.

Required:
- Q1–Q29 answered or explicit BLOCKED
- Current Fact / Accepted User Direction / Recommendation / Deferred clearly separated
- Production Source unchanged
- package/lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build not required because Production Source must not change.

# Completion Report

Minimum:
- Result
- Preflight
- Current Source Findings
- Recommended architecture diagram
- state ownership
- Finish Presentation phases
- gyoji placeholder design
- Win/Lose ownership mapping
- exactly-once BashoRecord update
- Rematch flow
- R/debug safety
- daily scheduled-bout queue
- multiple owned wrestler handling
- Simulation handoff
- 15/7 rule boundary
- kachikoshi/makekoshi boundary
- future Banzuke feasibility note
- future non-Ring-out compatibility
- input/latch transition risk
- automated test matrix
- User Play Test plan
- User Decisions Required
- Deferred
- Implementation split
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

# User Play Test

NOT REQUIRED for Investigation.

First Finish Presentation / Match Queue implementation requires User Play Test.

# Git Delivery

Investigation-only Report Commit Exception:
- change only CURRENT_COMPLETION_REPORT.md
- explicit stage
- git diff --check
- one Report-only commit
- push origin/develop
- verify remote SHA / clean tree

Example:
`docs(agent): investigate bout finish match flow`

# Final Instruction

Stop after Investigation.

Do not implement gyoji, MatchDayFlow, BashoRecord, rank logic, Simulation screen, ground-touch, Throw/Lift, or final animation.

After Report Commit / Push:
「LOOP-01-BOUT-FINISH-MATCHQUEUE-INVESTIGATION が完了し、ChatGPT Review待ちです」


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS / USER DECISIONS REQUIRED BEFORE IMPLEMENTATION

## Reviewed Investigation

- Investigation report commit:
  `7f5fbb22b8e3f157f3ddd373d47b9328ffb35628`
- Agent-Start-Head:
  `c2e86f0f225d8db870baa1e65d68bfcc50f7eb5c`
- Diff is exactly one Report-only commit:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- Production Source / package / lockfile unchanged.
- `main` unchanged.

## Current Source Findings

Direct review confirms:

- `src/main.ts` registers only `BoutScene`.
- Stable / Training / Simulation Scene and higher-level flow owner do not exist yet.
- `BoutScene` creates a fixed `PROTOTYPE_SETUP`.
- R currently rebuilds BoutSimulation and clears PressLatch instances.
- Push / Counter / Grip are edge-latched.
- WASD and ArrowUp held state are read directly from Phaser keys.
- `PushDummyController` takes participant IDs but BoutScene currently instantiates it with fixed wrestler-a / wrestler-b IDs.

The Report's input-transition risk is real and relevant.

## Accepted Architecture Direction

Accept:

```
BoutSimulation
  ↓ BoutOutcome
Pure higher-level Daily Match Flow
  ↓
BoutScene Finish Presentation
  ↓
Next scheduled owned Bout / day-complete handoff
```

Preserve:

- BoutSimulation knows nothing about Match Queue, Basho records, Gyoji, Win/Lose UI, or Management.
- Phaser Scene is not the long-term record Source of Truth.
- no generic FSM/event bus.
- no Result Scene.
- no per-bout Reward.
- Finish Presentation overlays the frozen Bout in the same BoutScene.
- future non-Ring-out win reasons should use the same higher-level flow.

## Accepted Finish Presentation Direction

Accept the small explicit lifecycle concept:

```
startCue
→ fighting
→ decisionPause
→ gyojiDecision
→ resultHold
→ complete
```

Rematch:

```
fighting
→ rematchPause
→ startCue
→ fighting
```

Exact phase names are implementation detail.

Presentation phases are ephemeral.
They must not own or duplicate persistent win/loss state.

## Accepted Gyoji Placeholder Direction

Accept:

- Gyoji is hidden while fighting.
- appears only after a win/loss.
- placeholder geometry is sufficient for first implementation.
- Gyoji points toward the actual winner's frozen final position.
- do not infer winner direction from EAST/WEST screen side.
- final art/sprite/animation remains Deferred.

## Accepted Win / Lose Semantics

Accept:

- result text is from the current scheduled owned wrestler's perspective.
- owned wrestler is winner → `Win`.
- owned wrestler is loser → `Lose`.
- keyboard controller / EAST-WEST / PLAYER label are not the gameplay ownership Source of Truth.

The scheduled bout must explicitly identify the owned wrestler.

## Correction C-1 — Long-term BashoRecord ownership

The Report currently describes Basho records as "場所 persistent" while listing MatchDayFlow as owner.

Correct this before implementation.

### Required ownership boundary

`MatchDayFlow` is the owner of:
- today's schedule
- current queue index
- current attempt/result-consumed state
- whether today's playable bouts are complete

It is **not** the final long-term canonical owner of Basho records across days.

Basho record belongs conceptually to future Management/Basho state.

Because that state does not exist yet, LOOP-01 implementation may:

- receive an explicit initial owned-record map/state,
- keep a working copy while today's queue runs,
- return the updated record state/delta in its day-complete handoff.

Do not imply that a MatchDayFlow instance is the permanent Source of Truth across the whole basho.

This keeps future transition clean:

```
Management/Basho State
   ↓ current records + today's schedule
MatchDayFlow
   ↓ updated records / result delta
Management/Basho State
```

No Save system is required now.

## Correction C-2 — Current scope records owned wrestlers only

The Report recommends updating both winner and loser records, including the non-owned opponent.

Do not adopt that recommendation in LOOP-01A by default.

Reason:

- current daily queue intentionally contains only the user's scheduled owned-wrestler bouts.
- recording opponent results here would create a partial world-wide record set.
- future relative Banzuke calculation requires a complete authoritative record for all wrestlers, which will belong to a later Management/world-simulation system.
- a partial opponent record map must not accidentally become that Source of Truth.

For the current Prototype:
- update the scheduled `ownedWrestlerId` only:
  - if owned wins → owned wins + 1
  - if owned loses → owned losses + 1
- preserve canonical BoutOutcome winnerId / loserId as the full match fact.
- future global wrestler record processing may consume the same result when its authoritative owner exists.

If User explicitly wants opponent records now, this correction can be revisited.

## Correction C-3 — Validate outcome against current ScheduledBout

Exactly-once protection needs more than a `recorded` boolean.

Before applying a win result, Pure flow must verify that:
- winnerId and loserId are exactly the two participants of the current ScheduledBout,
- IDs are distinct,
- the scheduled owned wrestler is one of those participants.

A stale/mismatched Outcome must not update records.

Recommended behavior:
- reject/throw in Pure flow for impossible programmer-state input, or return an explicit invalid result.
- choose one small deterministic policy and test it.

Do not silently record arbitrary participant IDs.

This protects queue transitions and later dynamic bout creation.

## Rematch

Accept:

- no Basho record update.
- no queue advance.
- same ScheduledBout remains current.
- after the rematch presentation delay/start cue, BoutScene creates a fresh BoutSimulation from the same scheduled bout.
- new Bout outcome begins ongoing.

No "draw" is added to BashoRecord.

## Input Transition

The Report correctly identifies latch carryover.

Accept:
- no BoutSimulation stepping during finish/start presentation.
- clear Push / Counter / Grip latches at the boundary into a new fighting attempt.
- reset/recreate accumulator so presentation elapsed time is not converted into catch-up ticks.
- reset/recreate Dummy for the current participant IDs.

Held input recommendation is acceptable for the first Prototype:
- held WASD may act when fighting becomes active.
- held ArrowUp does not create a Push edge without a fresh key-down.
- do not add a neutral-release gate unless User Play Test finds accidental carryover confusing.

User Play Test must specifically check this.

## R Debug Safety

Accept with simplification:

- during active fighting: R may restart the same current attempt without recording.
- once outcome is final / finish presentation has begun: R must not reset the match in a way that causes duplicate or erased record state.

At day-complete placeholder, debug restart behavior is not gameplay.
For the first implementation, resetting the entire Prototype day + Prototype records is acceptable if clearly documented as debug-only.

Do not make this a Management rule.

## Daily Queue

Accept:

- queue includes only owned wrestlers who have a bout scheduled today.
- schedule order is deterministic/input data.
- one finalized win/loss + completed finish presentation advances exactly one queue item.
- no scheduled owned bouts → day flow is already complete.
- last scheduled bout → explicit day-complete handoff/state.

Do not fabricate a full Simulation screen in this task.

## Simulation Handoff

Accept a small semantic boundary such as:

```ts
{ kind: 'day-bouts-complete', updatedOwnedRecords: ... }
```

Exact naming can differ.

Since Simulation screen does not exist:
- first Scene integration may show a small "today's bouts complete" placeholder.
- do not create fake Management/Simulation UI beyond that.

## 15 / 7 and Kachikoshi Boundary

Accepted User direction remains:

- Yokozuna through Juryo: 15 bouts.
- Makushita and below: 7 bouts.
- 15-bout kachikoshi: 8+ wins.
- 7-bout kachikoshi: 4+ wins.

Agree with Report:
- this does not belong in Daily Match Flow schedule consumption.
- total-bout scheduling and end-of-basho kachikoshi/makekoshi belong to future Management/Banzuke logic.
- no rank movement formula now.

## Future Banzuke

The feasibility note is accepted.

A future pure Management batch can consume:
- ordered current Banzuke slots,
- complete wrestler Basho records,
- special rank rules,

and output next Banzuke ordering.

Do not design its formula in LOOP-01.

## Implementation Split — Correction C-4

Prefer splitting the next implementation into two tasks rather than one combined task.

### LOOP-01A1 — MatchDayFlow Foundation

Pure TypeScript only:
- ScheduledBout
- explicit owned wrestler identity
- Daily queue/index
- owned Basho record working state
- idempotent win/loss consume
- mismatched outcome validation
- Rematch no-record/no-advance
- advance after presentation semantic command
- day-complete handoff
- deterministic tests
- new `src/game/flow/` directory explicitly allowed by this task

No Phaser Scene changes.
No User Play Test required.

### LOOP-01A2 — Bout Finish Presentation Integration

After A1 Review:
- dynamic current bout setup/controller IDs
- Finish Presentation phases
- Gyoji placeholder
- Win/Lose
- Rematch auto restart
- start cue
- input gating/latch reset/accumulator reset
- current Prototype multi-bout fixture
- day-complete placeholder
- R debug safety
- Heavy verification
- User Play Test REQUIRED

Reason:
This keeps persistent/queue semantics independently testable before refactoring BoutScene and input transitions.

## User Decisions Required

### UD-L1 — Auto advance after normal win/loss

Recommended:
after decisionPause → Gyoji → Win/Lose hold completes,
automatically advance to the next scheduled owned bout.

No click/keypress required.

User confirmation required.

### UD-L2 — Rematch text

Current accepted ACTION-06A text is `Draw Rematch`.

Recent User wording says "Rematch" as the restart concept but did not explicitly change the display text.

Recommended:
retain `Draw Rematch` for now unless User prefers simply `Rematch`.

User can decide before A2; A1 does not depend on display text.

### UD-L3 — Opponent record

Review recommendation:
**do not persist/update non-owned opponent BashoRecord in LOOP-01A1.**

Only update the current scheduled owned wrestler.

Future authoritative global wrestler records are a separate Management/world-simulation responsibility.

User confirmation required because the Agent Report recommended the opposite.

### UD-L4 — Provisional Presentation timing

The Agent recommendation:
- start cue 900 ms
- decision pause 500 ms
- Gyoji 1200 ms
- result hold 1500 ms
- Rematch pause 1500 ms

is acceptable as provisional tuning for A2.
No pre-implementation User decision is required unless User wants different timing now.

### UD-L5 — Prototype multi-bout fixture

For A2, a small two-owned-wrestler daily schedule is useful to test queue progression.

IDs/names can be non-user-facing prototype fixture values.
Do not treat them as final wrestler names or roster design.

### UD-L6 — Start cue coverage

Agent recommendation:
use the same minimal start cue for:
- first bout
- next scheduled bout
- Rematch

This is recommended for consistency and input gating.

User confirmation is useful before A2 but does not block A1.

## New Directory Permission

For LOOP-01A1, explicitly permit:

`src/game/flow/`

AGENTS.md §5 says new directories must be directed by the Task.
This Review approves that directory for the focused Pure flow implementation.

Do not create broader `management/`, `state/`, or framework directories as a side effect.

## Verification Expectations for LOOP-01A1

At minimum:

- empty schedule → complete.
- current scheduled bout identity.
- owned winner → owned wins +1 exactly once.
- owned loser → owned losses +1 exactly once.
- opponent record not created/updated under current scope.
- repeated same final outcome → no duplicate.
- mismatched/stale outcome rejected.
- Rematch → no record, no advance.
- advance before a finalized recorded win/loss rejected.
- advance after recorded result → exactly one next item.
- final advance → day complete.
- multiple owned wrestler records update the correct owned ID.
- input records are copied/not aliased if mutable structures are used.
- deterministic replay.
- Phaser-free.
- existing 200 tests unchanged.

## Do Not Reopen

Unless explicit User change:

- no Result screen.
- no per-bout Reward.
- Gyoji shown after decision, not during fighting.
- Win/Lose from owned wrestler perspective.
- Rematch records no win/loss.
- only today's scheduled owned wrestlers enter the playable queue.
- after all scheduled owned bouts, hand off back toward Simulation.
- exact Banzuke movement deferred.
- Yokozuna/Ozeki special-rule details deferred.

## Deferred

- formal Gyoji art/animation.
- ground-touch/fall outcome.
- Throw/Lift.
- Tachiai.
- full Simulation/Management screen.
- complete global wrestler records/world bout simulation.
- Kachikoshi/Makekoshi implementation.
- Banzuke calculation.
- special promotion details.
- Save.
- formal wrestler names.
- global tempo tuning.


# User Direction Update — Action-First Priority

This update supersedes the previously recommended immediate LOOP-01A1 implementation sequence.

## Confirmed Finish Presentation Decisions

- Normal win/loss:
  Gyoji presentation → Win/Lose hold → automatically proceed.
  No button/keypress wait.
- Rematch user-visible text:
  `Rematch` only.
  Do not use `Draw Rematch` in the future Finish Presentation.
- Gyoji remains post-decision only and placeholder-first when implemented.

These are Accepted User Decisions, but their implementation is Deferred until Action visual work reaches an appropriate point.

## Basho / Opponent Record Decision — DEFERRED

Do not implement a canonical record policy yet for:
- owned wrestlers only
- opponents as well
- complete global wrestler records

Reason:
future real-sumo-inspired bout scheduling may use records for later-round pairings, and championship/playoff handling may require a broader authoritative tournament record model.

Therefore:
- do not implement LOOP-01A1 MatchDayFlow/BashoRecord now.
- do not treat "owned records only" or "record both wrestlers" as Accepted.
- revisit when Basho scheduling / tournament simulation becomes Current Scope.

## Development Priority Correction

Current development remains Action-first.

Do NOT proceed next into:
- Simulation / Management screen
- MatchDayFlow implementation
- BashoRecord implementation
- daily queue implementation
- Banzuke calculation
- tournament scheduling

The user considers current visuals "placeholder of a placeholder" and wants to test whether the accepted Action rules actually read and feel like a game once provisional game graphics/presentation are applied.

## Next Recommended Work Area

Return to Action / Presentation development.

Goal:
apply provisional but game-readable graphics/presentation to the current accepted Bout Core so User can evaluate:

- whether the player can visually read both wrestlers
- facing / orientation
- Push
- Counter / Kuzushi
- Grip / Morozashi
- Grappled turning
- Drive
- Ring-out / finish
- impact / momentum / advantage
- whether side/rear advantage is visually understandable
- whether the game speed feels appropriate once animation exists
- whether the overall bout feels like an actual Action Game rather than debug circles

This should preserve:
Pure TS gameplay state/results → Phaser rendering/animation.

Do not change gameplay formulas merely to compensate for weak placeholder presentation unless a concrete gameplay issue is proven.

## Deferred LOOP-01 Findings

Keep the reviewed LOOP-01 investigation as future design reference, especially:
- no Result screen
- no per-bout reward
- Gyoji post-decision presentation
- Win/Lose from owned wrestler perspective
- Rematch does not count as a result
- day's scheduled owned bouts eventually lead back to Simulation
- input/latch transition risk

But do not implement these flow systems now.

## Next Task Constraint

Before Production implementation of provisional graphics, inspect Current Source/assets and determine:
- whether any usable art assets already exist
- current rendering primitives
- minimum animation state mapping from Simulation state
- whether spritesheet/placeholder assets need to be introduced
- how to keep animation presentation-only
- what visual pass is small enough for User Play Test without prematurely building final art pipeline.

Prefer an Action Visual Prototype Investigation first if asset direction or animation mapping is not already unambiguous.
