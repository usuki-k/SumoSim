Task-ID: ACTION-04A1-COUNTER-KUZUSHI-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17
Agent-Start-Head: 59c34b3762c4c7b67814f820c56314cfce3ff9d6
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 108/108、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**。このAgent環境には実ブラウザを操作するToolがない。PASSとは記載しない。
- User Play Test: **REQUIRED / NOT RUN**。focused foundation checkとして必要。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `730ba8f`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `730ba8f..origin/develop` の変更は `docs/agent_handoff/` 配下のみ（CURRENT_TASK.md、CURRENT_COMPLETION_REPORT.md）→ `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `59c34b3`（前回Reviewの指摘どおり）

# Changed Files

- `src/game/sumo/BoutTypes.ts`: `counterPressed`、`counter` action、`CounterTier`、`ParticipantPosture`、Snapshotの`posture`を追加
- `src/game/sumo/BoutSimulation.ts`: Counter / Kuzushiのcore処理
- `src/game/sumo/BoutCounter.test.ts`（新規）: T60〜T73、T76
- `src/game/sumo/BoutSimulation.test.ts`、`src/game/sumo/BoutPush.test.ts`: test helperに`counterPressed: false`を追加しただけ（assertionは不変）
- `src/game/input/pushDummyController.ts`: Kuzushiを尊重するようにし、intentに`counterPressed: false`を追加
- `src/game/input/pushDummyController.test.ts`: helperの追加とT74
- `src/game/input/pressLatch.test.ts`: T77（ArrowDown latchの統合確認）
- `src/game/scenes/BoutScene.ts`: ArrowDown用の2個目の`PressLatch`、`COUNTER` / `KUZUSHI`表示
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

`AGENTS.md`は変更なし（Current Sourceの責務の記述に実質的なずれがないため）。新規dependencyはなし。

# User Decisions Implemented

- UD-1: 1つの共有Down Counter。Best / Successのtierは判定するが、A1では両方とも「相手をKuzushiにする」だけ
- UD-2: ArrowDown（暫定binding）
- UD-3: 空振り時の強制後退はなし。表示は`COUNTER → KUZUSHI`
- UD-4: 即決着、PRNG、BoutOutcomeはいずれもなし

# Counter Input / Window

- `ParticipantIntent.counterPressed`: そのtickの新しいedge。Sceneでは`counterLatch = new PressLatch()`をArrowDownのPhaser `down` eventへ接続し、frameの最初のtickだけで消費する（Pushと同じ方式）
- 同じparticipantの同じtickに`pushPressed`と`counterPressed`が両方trueの場合: **Pushを開始し、Counter edgeは捨てる**（queueしない）
- 開始できるのはaction idleかつposture stableのときだけ。Push中・Counter中・Kuzushi中のedgeは無視する（queueしない）
- `COUNTER_WINDOW_TICKS = 12`。押したtickがwindowの1 tick目で、12 tickのあいだ成功判定を行う。Contactがなくても開始できる
- window中は実効move 0（WASD無効）で、既存のgrounded ruleにより制動する

# Best Tick Rule（exact）

`counterTier(pushActiveTicksRemaining)`（exportしたpure関数）で判定する:

```
activeElapsed = PUSH_ACTIVE_TICKS - attacker.action.ticksRemaining
activeElapsed < COUNTER_BEST_TICKS(=3) ? 'best' : 'success'
```

Active経過0・1・2 tickがBest、3 tick以降がSuccess。Failは「windowが切れた」ことで決まる。

# Counter Success / Fail Resolution

- `step()`の中では、`resolveContact()`が非nullの場合だけ、**contact解決の後、Push力解決の前に**`resolveCounter()`を呼ぶ
- 成功条件: 防御側がcounter、相手がpush active、そのtickに実Contactがある。windowの最初の該当tickで成立する
- 成功時: 攻撃側は`enterKuzushi()`（Pushをcancelしてidleへ）、防御側は即idle。tierは`resolveCounter()`が返すが、A1ではgameplayに使わない（A2で位置結果を付ける）
- 攻撃側がもうActiveでないので、そのtickの`resolvePush`はnet 0になり、Push力は掛からない（T64）
- Fail: `advanceAction`でwindowが0になったら、使用者が`enterKuzushi()`
- 背後・側面のrelocation、overshoot、event / historyはなし

# Kuzushi State / Duration

- `posture: { kind: 'stable' } | { kind: 'kuzushi'; ticksRemaining }`。`action`とは別fieldで、Snapshotでは独立したcopyとして公開する
- 入口は`enterKuzushi()`だけ（actionをidleにし、`KUZUSHI_TICKS = 30`をset）。不変条件: kuzushi ⇒ action idle
- tickの扱い（off-by-oneなし）: tickの先頭で`advancePosture()`を呼ぶ。`ticksRemaining <= 0`ならstableへ戻し、それ以外なら1減らしてそのtickを完全なKuzushi tickとする。途中のtickで入ったKuzushiはそのtickでは数えない
  - 結果: Kuzushiに入ったtickの後、ちょうど**30 tick**入力を無視し、31 tick目の先頭でstableへ戻ってそのtickの入力を受け付ける（T68）
  - `ticksRemaining`の意味は「これから来る完全なKuzushi tickの数」。0のSnapshotは「次のtickの先頭で回復する」ことを表す
- Kuzushi中の挙動:
  - Push / Counterを開始できない（queueしない）
  - 実効move 0（grounded brake）
  - facingは固定

# Kuzushi Facing Rule

`updateFacing()`はKuzushiのparticipantをskipする。stableな相手は通常どおりauto-facingする。回復したtickから即座に相手を向く（turn-rateの仕組みはない）（T70）。

# Kuzushi Push Susceptibility

`KUZUSHI_PUSH_SUSCEPTIBILITY = 1.5`（暫定）。`resolvePush`で、netの向きから押し込まれる側を決め、その側がKuzushiならPair dvに1.5を掛ける。通常のMovementには掛けない。両者stableの同時Pushの相殺は変わらない（T71 / T73）。

# Grip Boundary

実装していない。将来の境界はARCHITECTURE.mdに記載した: 有効range判定を先に通し、通ったうえで対象がKuzushiなら成功。

# Dummy Integration

`PushDummyController`は、Snapshotの`posture.kind === 'kuzushi'`の間、零入力（move 0、edgeなし）を返し、cooldownを`DUMMY_PUSH_COOLDOWN_TICKS`（30）に保持する。Snapshot上でstableになってからちょうど30 tick後に次のedgeを出す（T74）。

注: Snapshotが`kuzushi, ticksRemaining 0`のtickでは、Simulationはそのtickの先頭でstableへ戻る。一方Dummyはまだcooldownを保持しているので、Kuzushi明けの実際の待ちは31 tickになる。harness側で1 tick保守的になるだけで、「明けてすぐPushしない」要件は満たす。

# Tests（108/108 PASS）

既存86件はhelperに`counterPressed: false`を追加しただけでPASS（T75）。新規22件:

- T60 1 edge = 1回、連打してもrepeat・queueしない / T61 同じtickならPush優先 / T62 window 12 tickちょうど、最終tickでも成立、1 tick後は不成立
- T63 境界（`counterTier` 8, 7, 6 → best、5 → success）と統合（Counter開始tick 0〜8 → Active初tickでの解決はBest、tick 9 → Success）
- T64 Successの解決tickはdecayだけでgainなし（Push力のcancel） / T65 Pushなし・早すぎ・遅すぎ（Recovery）はFail
- T66 Contact前に開始して後からContact + Activeで成功、届かなければFail / T67 Best / Successとも攻撃側がKuzushi、防御側はidle / stable、relocationなし
- T68 Kuzushiの長さ（30 tickちょうど、off-by-oneなし） / T69 Kuzushi中は入力を無視し、self velocityは0のまま。Counter中の制動はSTOP_DECELERATIONどおり
- T70 facing固定と回復後の復帰 / T71 押されやすさがちょうど1.5倍 / T72 同時Counterは対称なFail→Kuzushi / T73 Push対Pushの不変性
- T74 Dummyの挙動 / T76 混在sequenceのreplay一致・finite・重なりなし / T77 ArrowDown latch（0 tickのframe、複数tickのframe、holdでrepeatしない、再押下、同じframeのUp+DownはPush優先）
- posture snapshotの分離test

# Runtime Smoke

**Browser Smoke: NOT RUN（environment limitation）**。`pnpm build`は成功。実キー入力、表示、console errorはUser側で確認が必要。

# Acceptance Criteria

| AC | 状態 |
|---|---|
| AC-01〜AC-15 | PASS（T60〜T72、T77） |
| AC-16 | PASS（T71） |
| AC-17 | PASS（T74） |
| AC-18、AC-19 | PASS（relocation、overshoot、PRNG、BoutOutcomeのcodeなし） |
| AC-20、AC-21 | PASS（108/108） |
| AC-22 | PASS |
| AC-23 | PASS（ARCHITECTURE.md同期） |
| AC-24 | REQUIRED / NOT RUN |
| AC-25 | PASS |

Browser Smokeは未実施（Known Untested）。

# Implementation Evidence

1. one-edge Counter: T60 / T77
2. Push vs Counterの入力優先: T61 / T77
3. Best / Successの境界: T63
4. 成功時にPushをcancel: T64
5. Fail → 自分がKuzushi: T62 / T65
6. 成功 → 攻撃側がKuzushi: T67
7. Kuzushi中の行動・移動・facing: T68 / T69 / T70
8. 押されやすさ: T71
9. DummyがKuzushiを尊重: T74
10. relocation / 決着のscope creepなし: T67、diff

# Design Deviations

なし。Kuzushi timerはTask §10の推奨順序（tickの先頭で進める）で実装した。

# Unexpected Scope

なし。

参考情報（scope外なので修正していない）: 失敗CounterによるKuzushiは、window中の制動でself velocityがすでに0になっている。そのため「Kuzushi中のgrounded brake」が実際に効くのは、カウンターされた攻撃側に接線方向の速度が残っている場合だけ。

# Known Untested

- Browser Smoke全項目（ArrowDownの実入力、hold、Mode 2でのCounter成功、空振り→KUZUSHI、Kuzushi中の行動不能とfacing固定、回復後の操作、console error）
- Counter / Kuzushiの体感（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Task §20のfocused foundation check。Best / Successの位置差はまだ見えないのが仕様）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add counter kuzushi foundation`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
