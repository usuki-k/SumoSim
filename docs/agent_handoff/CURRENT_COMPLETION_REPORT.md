Task-ID: LOOP-01-BOUT-FINISH-MATCHQUEUE-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105
Agent-Start-Head: c2e86f0f225d8db870baa1e65d68bfcc50f7eb5c
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。

次の要素を、BoutSimulationを変えずにその**上位**へ置ける。
- 取組後の行司presentation
- 所属力士から見たWin / Lose
- 自動のRematch
- その日の予定取組のQueue
- 場所成績の記録（exactly once）
- Simulation画面への戻り

Current Sourceには、上位のflow ownerもStable / Training / Simulation画面も存在しないので、衝突はない。

入力（latchとheld key）が次のBoutへ持ち越される危険を確認し（F5）、対策を示した。BLOCKEDになる点はない。

Production Source / package / lockfileは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 3`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `43efaef`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `43efaef..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `c2e86f0`
- 読んだもの: AGENTS.md、`src/main.ts`、`BoutScene.ts`（唯一のScene）、`BoutTypes.ts`、`BoutSimulation.ts`、`ringOut.ts`、`pressLatch.ts`、`pushDummyController.ts`、ARCHITECTURE.md、GAME_CONCEPT.md、Review / Play Testの記録（`04165f5`、`130855c`）

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Accepted User Direction**: Taskに記載されたUserの方針
- **Recommendation**: 本Reportの推奨（未実装）
- **User Decision (UD)**: 実装前にUserが決める事項
- **Deferred**: 後続Task

# Current Source Findings（Q1、Current Fact）

- F1 `src/main.ts`は`scene: [BoutScene]`だけを登録し、起動すると直接Boutが始まる。**Stable / Training / Simulation画面、上位のflow owner、Management stateは存在しない**
- F2 `BoutScene`は`PROTOTYPE_SETUP`（固定id `wrestler-a` / `wrestler-b`、開始位置±0.7 m）で`BoutSimulation`を生成する
  - `restart()`（Rキー）は、新しいSimulationの生成、3つのlatchのclear、`dummy.reset()`を行う
  - `FixedStepAccumulator`はそのまま使い続ける
- F3 presentation metadata（`PARTICIPANT_PRESENTATION`: controller / color / label / side / name?）はScene内に固定で書かれている
  - 「keyboard = `wrestler-a`」はこのmappingでしか表現されていない
  - `PushDummyController`もid `'wrestler-b'` / `'wrestler-a'`を直書きしている
- F4 勝敗は`BoutSnapshot.outcome`（`ongoing | win | rematch`）。確定後の`step()`はno-op。Sceneは毎frame `outcomeLabel()`でtextを書き直すだけで、「勝敗を一度だけ処理する」仕組みはない
- F5 **入力の持ち越しの危険**:
  - Push / Counter / Gripは`PressLatch`（key-downで保持し、最初のtickで消費）
  - WASDと`driveHeld`は`isDown`（そのframeの生のkey状態）
  - presentation中に押されたedgeは、次にstepした最初のtickで消費されてしまう
  - held keyは、新しいBoutの最初のtickからそのまま効く
  - 現在の`restart()`はlatchをclearするが、presentationの時間をまたぐ設計にはなっていない

# Recommended Architecture（Q2、Q22）

```
[Pure TS] MatchDayFlow（新規。Phaser非依存）
   schedule (ScheduledBout[]) ・ index ・ currentBoutRecorded ・ records (WrestlerId -> BashoRecord)
      │ BoutSetupを作る / outcomeを1回だけ反映する / 次のBoutへ進む / その日の完了
      ▼
[Pure TS] BoutSimulation（変更なし）→ BoutSnapshot.outcome
      ▼
[Phaser] BoutScene
   ├─ 戦う画面（既存）
   ├─ FinishPresentation（ephemeralなphaseとtimer。Phaser非依存の小さなtimeline helperにできる）
   │     決着の間 → 行司 → Win / Lose表示 → complete   ／   Rematch表示 → 開始cue
   └─ 入力gate（presentation中はstepしない。開始時にlatchをclear）
      ▼
handoff: { kind: 'day-bouts-complete', records }   → 将来のSimulation画面
```

- **owner**: Pure TSの小さな`MatchDayFlow`（明示的なstateと純関数、または小さなclass）
  - Sceneにはlong-termなstate（成績・Queue）を持たせない
  - FSM frameworkやevent busは作らない
- **Scene構成**: A（BoutSceneのまま、上に小さなfinish-presentation controllerを足す）
  - 結果画面は作らず、最終の体の位置を見せたまま行司を重ねる
  - 別のFinish Scene（B）は、Simulationとsnapshotの受け渡しが余計に増える。Sceneの置き換え（C）は過剰
- **配置先**: Pure TS moduleの配置先（例: `src/game/flow/`）は新しいdirectoryになる。AGENTS.md §5により、実装Taskで明示的に許可が必要（UD-L8）

# State Ownership（Q3、Q15）

| 寿命 | データ | owner |
|---|---|---|
| 場所（persistent、将来Save対象） | `records: Map<WrestlerId, { wins, losses }>` | MatchDayFlow（将来はManagement） |
| その日（per-day） | `schedule: ScheduledBout[]`、`index` | MatchDayFlow |
| 取組（per-bout） | `currentBoutRecorded: boolean` | MatchDayFlow |
| 1回の対戦（per-attempt、Rematchで作り直す） | `BoutSimulation` | BoutScene |
| ephemeral | presentationのphaseとtimer | BoutScene |

```ts
type WrestlerId = string
interface BashoRecord { readonly wins: number; readonly losses: number }
interface ScheduledBout {
  readonly ownedWrestlerId: WrestlerId
  readonly opponentId: WrestlerId
  readonly eastId: WrestlerId          // side of this bout (future: from banzuke)
  readonly westId: WrestlerId
}
```

- **BoutSetupの生成**: `boutSetupFor(bout)` → `participants: [{ id: eastId, position: (−0.7, 0) }, { id: westId, position: (+0.7, 0) }]`
  - BoutSimulationのparticipant idに**WrestlerIdをそのまま使う**（id変換表は不要。idはSimulationにとって不透明な文字列）
- `BashoRecord`は`wins` / `losses`だけにする
  - 予定の総数（15 / 7）や消化数は持たない。これらはscheduleを作る将来の規則が持ち、消化数は`wins + losses`で導ける
  - 番付の変動は表現しない

# Owned Identity（Q4、Q8）

- 所属は`ScheduledBout.ownedWrestlerId`で**明示**する
- keyboard、EAST / WEST、PLAYER labelから所属を推測しない
- 逆向きにする: 「所属力士をkeyboardで操作し、相手をDummyで操作する」という**controllerの割り当てを、Sceneがscheduleから導く**
- Win / Lose:
  - `outcome.winnerId === ownedWrestlerId`なら`Win`
  - `outcome.loserId === ownedWrestlerId`なら`Lose`
  - rematchなら`Draw Rematch`（ACTION-06AでAcceptされた文言。UD-L2で確認）
- 東西はWin / Loseの判定に使わない
- ACTION-06Aの`EAST|WEST <name> Win`表示は、このWin / Lose表示に**置き換える**
  - 東西のmetadataは残す（立合い前の紹介や番付表示で将来使う）

# Finish Presentation Phases（Q5、Q23、Q24）

| phase | 種類 | 暫定の長さ（presentation tuning） |
|---|---|---|
| `startCue`（READY → START） | presentation。終わったら戦闘開始（入力が有効になる） | 900 ms |
| `fighting` | Simulationを進める | — |
| `decisionPause` | presentation。体は静止 | 500 ms |
| `gyojiDecision`（登場 → 軍配で勝者を示す） | presentation | 1200 ms |
| `resultHold`（Win / Lose） | presentation | 1500 ms |
| `complete` → Queueの次へ / その日の完了 | **ここだけがQueueを進める** | — |
| `rematchPause`（`Draw Rematch`表示） | presentation。記録しない | 1500 ms |
| → `startCue` → `fighting`（同じ組み合わせで新しいBoutSimulation） | | |

- 進行は**自動**（入力では進めない）を推奨（UD-L1）
- 開始cueは、最初の取組・次の取組・Rematchの**すべて**で同じものを使う（一貫性と入力gateのため）。立合いの規則は含めない
- 永続的なstateに影響するのは2点だけ:
  - (1) 勝敗が最初に確定した瞬間の記録（Q9）
  - (2) `complete`での`advance`
- それ以外は表示だけ
- phaseの計算は、Phaser非依存の小さな純関数（`elapsedMs → phase`）にすれば、timerだけでtestできる

# Gyoji Placeholder（Q6、Q7）

- 戦っている間は表示しない。`gyojiDecision`の間だけ登場する
- 最小の見た目:
  - 土俵の内側の固定位置（例: 上側の`(0, −0.8·R)`）に、人を表す小さな円
  - 軍配として短い太線（または扇形）
  - 登場は短いfade / scale-in
  - その後、軍配を**勝者の最終位置の方向へ**回し、伸ばして示す
- 勝者の方向は、**凍結した最終Snapshotでの勝者の実際の位置**から求める（`gyojiPos → winner.position`）
  - 決着時には位置が動いているので、東西（画面の左右）は使わない
  - 将来の投げなど、どんな負け方でも同じように動く
  - 行司と勝者の位置がほぼ重なった場合は、東西の方向をfallbackにする
- 後で正式なspriteへ置き換えるときは、「行司のview + 指す方向（rad）」というinterfaceのまま差し替える
- 正式な素材は作らない

# Exactly-once BashoRecord（Q9）

**Recommendation**: 上位のflowが、確定した`win`を**最初に受け取った瞬間に記録する**。presentationの長さとは独立にする。

```
applyBoutOutcome(flow, outcome):
  ongoing           -> no change
  rematch           -> no change (records, index, recorded untouched)
  win, !recorded    -> winner.wins += 1, loser.losses += 1; recorded = true
  win,  recorded    -> no change (idempotent)
advanceAfterPresentation(flow): requires recorded; index += 1; recorded = false
```

- 冪等性はflow自身が持つ（`recorded`）。Sceneのupdateが何回呼ばれても、二重に加算されない
- Queueが進むのは`advanceAfterPresentation`だけ（presentationの`complete`）
- **相手の成績も記録する**ことを推奨（UD-L3）
  - 取組の結果は両者にとっての事実であり、将来の相対的な番付評価には全員の成績が必要になる
  - Userの方針は所属力士の成績への加算なので、所属外の力士も記録するかは確認したい

# Rematch Flow（Q10）

1. `rematch`を受け取る: 記録しない、indexもそのまま、`recorded = false`のまま
2. `rematchPause` → `startCue`
3. Sceneが、同じ`ScheduledBout`から`boutSetupFor`で**新しいBoutSimulation**を作る（outcomeはongoing）
4. Dummyのreset、latchのclear、accumulatorの作り直し（Q25）

Rematchの再生成はSceneが行う（ephemeralな対戦instanceの所有者だから）。成績には引き分けや取り直しとして記録しない。

# R / Debug Safety（Q11）

- `fighting`中（outcomeがongoing）: Rは同じ取組をやり直す（記録なし。現行どおり）
- **outcomeが確定した後（win / rematch）、およびpresentation中: Rを無効にする**
  - 確定したwinはすでに記録済みで、その状態でやり直すと同じ取組が2回記録される穴になる
- その日の完了後: Rで「Prototype用の新しい1日」をやり直す（debug。成績はresetするか持ち越すかをUD-L6で決める）

# Daily Queue / Multiple Owned / Simulation Handoff（Q12〜Q14）

- scheduleは**その日に取組がある所属力士**だけを、決まった順で並べたもの（scheduleの作成は将来のManagement / 番付の規則が行う）。1つの取組がwinで終わってpresentationが完了したら、ちょうど1つ進む
- 0件: flowは開始した時点で完了しているので、BoutSceneを開かずに完了のhandoffを返す
- 複数件: それぞれの取組の結果は、その取組の当事者の成績だけを更新する
- 最後の取組: `{ kind: 'day-bouts-complete', records }`を返す
- **Simulation画面は存在しない（F1）**
  - 偽の画面は作らず、BoutSceneがそのhandoffを受けて「本日の取組終了」程度のplaceholder textを表示する
  - 将来のSimulation画面は、このhandoffを受け取るだけで済む
- Prototypeのscheduleは、Queueを試せるように複数件（例: 所属力士2人の取組）のfixtureにする（UD-L5）

# 15 / 7 Rule・勝ち越し / 負け越し（Q16、Q17）

- 場所あたり15番か7番かは**番付・地位の規則**（将来のManagement）が決め、scheduleを作る。daily flowは、渡された予定を消化するだけで、総数を判断しない
- 勝ち越しと負け越し（15番制は8勝以上、7番制は4勝以上）は、`kachikoshi(record, scheduledTotal)`のような純関数で書けるが、**今のflowには不要**
  - 場所の終わり / 番付Taskで実装する（Deferred）
  - 境界だけ文書化しておく: 判定には地位の規則が持つ総数が要る

# Banzuke Feasibility / East-West / Special Rules（Q18〜Q20）

- **相対評価による番付は実現可能**
  - 入力: 現在の番付slot（順序付き）、全員の場所成績、特別な規則
  - 出力: 次の場所の順序付きslot
  - 決定的なbatch計算（純関数）なので、BoutやFlowと独立した後続のpure Management moduleにするのが適切
  - 式は決めない
- **東西**: 同じ枚目の東と西は、隣り合う別のslotとして扱う（Accepted direction）
  - 将来は「division → 枚目 → 東 → 西」の順に並べた整数のslot index（例: 前頭5枚目東 = n、西 = n+1）が便利
  - 今は作らない
- **特別な規則**（Deferred）:
  - 大関が負け越したら関脇へ
  - 横綱が負け越したら引退
  - 昇進の規則と単純化の詳細は未定

# Future Non-Ring-out（Q21）

- flowが読むのは`outcome.kind`と`winnerId` / `loserId`だけで、`reason`は表示とlogging用
- 行司は勝者の位置だけを使う
- 手付き・倒れ・投げを追加しても、Queue・記録・presentationは作り直さずに済む

# Input / Latch Transition Risk（Q25）

**Recommendation**:

1. `fighting`以外のphaseでは、Sceneは**Simulationをstepせず**、accumulatorも進めない
2. `startCue`が終わって`fighting`へ入る瞬間に、次の3つをまとめて行う
   - 3つのlatchを**clear**する（presentation中に押されたedgeは捨てる）
   - accumulatorを作り直す（presentation中の時間をまとめて流さない）
   - Dummyを新しいidで作り直してresetする
3. held key（WASD、ArrowUpの`isDown`）は物理的な状態なので、そのまま有効にする（開始と同時に押していれば前へ出る、のは自然）
   - `driveHeld`はFREEでは無視されるので、持ち越しても無害
   - Shift / ArrowUp / ArrowDownは「clear後の新しいkey-down」が必要になるので、押しっぱなしでGripやPushが暴発することはない
4. 「held keyも一度離すまで無効」にする案は、開始時の操作感を損なうので採らない

# Save Boundary（Q26）

- BashoRecordは将来のpersistentなManagement state（Save対象）
- presentationはephemeralで、保存しない
- Queueとscheduleの保存は将来のSave Taskで扱う
- 今はpersistenceを作らない

# Automated Test Matrix（Q27）

Pure flow:
1. winを1回だけ記録する（勝者 +1勝、敗者 +1敗）
2. lossも同様
3. rematchは何も記録しない（成績・index・`recorded`は不変）
4. 同じwinを何度`applyBoutOutcome`しても1回分だけ
5. `advance`はrecorded後だけ有効で、ちょうど1つ進む
6. rematchではadvanceしない
7. 複数の所属力士: 正しい力士の成績だけが変わる
8. 最後の取組 → `day-bouts-complete`
9. 0件 → 開始した時点で完了
10. Win / Loseはowned idで決まる（東西やcontrollerを入れ替えても変わらない）
11. 将来の`reason`（testでは型を広げたfixture）でも同じ流れになる
12. replay一致

Presentation / Scene側（Phaser非依存のhelperとして）:
13. timelineのphase境界
14. 行司の向き = 勝者の実際の位置の方向（勝者が東西の逆側へ動いていても正しい）、重なった場合のfallback
15. Rは、確定後とpresentation中は無効
16. latch / accumulator / Dummyは`fighting`開始時に初期化される（presentation中に押したedgeが次のBoutで発火しない）
17. 既存の200件は変更なし

# User Play Test Plan（Q28）

最初にREQUIREDになるのは、実装Task（LOOP-01A）。

確認項目:
1. 勝ったとき: 静止 → 行司が勝者を指す → Win
2. 負けたとき: 行司が相手を指す → Lose
3. 決着中、体が凍結されている
4. presentationの後に次の所属力士の取組が始まる
5. 最後の取組の後に「本日終了（Simulationへ）」が分かる
6. Rematchでは成績が変わらず、少し待ってから同じ組み合わせで再開する
7. presentation中に押したkeyが、次の取組の開始直後に暴発しない
8. placeholderの行司で意味が伝わる

# User Decisions Required

| # | 決定事項 | 推奨 |
|---|---|---|
| UD-L1 | 結果の後の進め方 | 自動（入力では進めない） |
| UD-L2 | Rematchの表示 | `Draw Rematch`（06AでAccept済みの文言を継続） |
| UD-L3 | 所属外の相手の成績も記録するか | 記録する（将来の番付評価のため） |
| UD-L4 | 暫定のtiming | startCue 900 / decision 500 / gyoji 1200 / result 1500 / rematch 1500 ms |
| UD-L5 | Prototypeの1日のschedule | 所属力士2人分の取組（Queueと完了を試すため）。相手はDummy Mode 2 |
| UD-L6 | その日の完了後 | placeholderの「本日の取組終了」text。Rで新しいPrototypeの1日（成績は持ち越す / resetする、の選択が必要。推奨はreset） |
| UD-L7 | 開始cue | すべての取組（最初・次・Rematch）で同じものを使う |
| UD-L8 | 新しいdirectory | `src/game/flow/`（AGENTS.md §5により、実装Taskでの許可が必要） |

# Deferred

- 正式な行司の素材とアニメーション
- 立合い
- 手付き・倒れ・投げによる負け
- 決まり手
- 15 / 7番の規則、勝ち越し / 負け越しの判定
- 番付の計算（相対評価、東西のslot）
- 特別な規則（大関・横綱）
- Save
- Simulation画面
- 正式な力士名
- 所属同士の対戦を避ける規則
- 全体のtempo

# Implementation Split（Q29）

1. **LOOP-01A Bout Finish Presentation + MatchDayFlow Foundation**（1つのTaskを推奨）
   - 内容: pure flow + test、Sceneのpresentation placeholder、入力gate、Win / Lose表示への置き換え、Rの安全化、placeholderの完了表示、Prototype schedule
   - 1つにまとめられる理由: pure flowは小さく（純関数数個）、Play Testには両方が必要。両者の境界（`applyBoutOutcome` / `advance`）も明確
   - 安全側に分ける場合: 01A-1（pure flowとtestだけ、Sceneは変更なし）→ 01A-2（Scene側）
   - **User Play Test REQUIRED**
2. Simulation画面ができたときのhandoff接続
3. 手付き・倒れ・投げによる負け
4. 場所の終わりの処理（勝ち越し）と番付の計算

# Design Deviations

なし（Investigationのみ）。

# Unexpected Scope

なし。

所見:
- F3: Dummyのidの直書き
- F5: 入力の持ち越し

いずれも実装Taskで対応する事項で、修正はしていない。

# Verification

- Q1〜Q29に回答済み。BLOCKEDになる点はない
- Current Fact / Accepted User Direction / Recommendation / Deferredを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはLOOP-01A。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate bout finish match flow`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
