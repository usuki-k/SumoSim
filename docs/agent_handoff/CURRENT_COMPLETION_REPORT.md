Task-ID: ACTION-03B-DISCRETE-PUSH-EXTERNAL-MOMENTUM
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: c11edc5c6e3ffcb7dcb192b4f80bb5af1243fb72
Agent-Start-Head: baa772e123b623e6e1f9edf675c984ef5991821d
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS。離散Push（ArrowUp）と外力Momentum（Model B）を実装した。Push FeelのUser Play Testは**未実施（REQUIRED / NOT RUN）**。

# Preflight

- working tree: clean
- branch: develop
- fetch後の `HEAD...origin/develop`: 0 4
- Remote CURRENT_TASK:
  - Task-ID: 一致
  - Status: READY
  - Target-Branch: develop
  - Handoff-Mode: GITHUB
  - Source-Baseline: c11edc5（期待値どおり）
- Source-Baselineは origin/develop のancestor
- Coordination Diff: `docs/agent_handoff/CURRENT_TASK.md` のみ
- `git merge --ff-only origin/develop` 成功 → Agent-Start-Head baa772e
- 前Review（5e6bfd1）、User Play Test受理（959d5bc）、D2決定（9fcee7d）を確認した

# Changed Files

- `src/game/sumo/BoutTypes.ts`
  - `ParticipantIntent.pushPressed`
  - `PushPhase`
  - `ParticipantActionState`
  - `ParticipantState.externalVelocity` / `.action`
- `src/game/sumo/BoutSimulation.ts`
  - Push定数
  - selfVelocity / externalVelocity
  - Push開始・timer・解決
  - `resolveContact()`がnormalを返すように変更
- `src/game/sumo/BoutPush.test.ts`（新規。T37〜T48）
- `src/game/sumo/BoutSimulation.test.ts`
  - Intent helperに`pushPressed: false`を追加
  - Phaser非依存検査に`pressLatch.ts`を追加
  - 末尾空白1件を削除（前Taskで混入。Unexpected Scope参照）
- `src/game/input/pressLatch.ts`（新規）+ `.test.ts`（T49）
- `src/game/scenes/BoutScene.ts`
  - ArrowUp latch
  - 1 frame中の最初のtickだけedgeを渡す
  - phase表示
  - Rでrestart
- `docs/ARCHITECTURE.md`、`AGENTS.md`（Current Stateの同期）
- 本Report
- package / lockfile / Accumulator / movementVector: 未変更

# D1 / D2 Implementation

- D1（離散edge Push）:
  - `pushPressed`は「そのtickの新しい押下edge」を表す
  - idleの時だけPushを開始する
  - Action中の押下は無視し、queueもしない
  - holdで連続Pushにはならない
- D2: ArrowUpを暫定bindingとした（Sceneのコメントに「Final control schemeではない」と明記）

# Push Runtime State

- `action: { kind: 'idle' } | { kind: 'push', phase, ticksRemaining, direction }`
  - Simulationのcanonical state
  - Snapshotはcopyを返す（isolation Testあり）
- `direction`は開始tickのfacingから計算した単位vectorで、Action中は固定（retargetしない）
- facing自体は従来どおり毎tick相手方向へ更新する
- `ticksRemaining`は「次のtickを含む残りtick数」（常に1以上）
- startup → active → recovery → idle の遷移はtick末の`advanceAction()`で行う

# Provisional phase timings（Task推奨値のまま。変更なし）

| phase | ticks | ms | 挙動 |
|---|---|---|---|
| startup | 6 | 約100 | WASD無効。入力0として制動する。力なし |
| active | 8 | 約133 | WASD無効。固定方向へgrounded ruleで踏み込む。contact中のみ力が出る |
| recovery | 10 | 約167 | WASD無効。入力0として制動する。力なし |
| 合計 | 24 | 400 | 終了tickの次からWASDが戻り、次のPushも可能 |

# Input edge latch

- `PressLatch`（Pure、Phaser非依存）:
  - `press()`で1つのedgeを保持する
  - `consume()`で1回だけtrueを返す
  - 消費前に複数回`press()`しても1つにまとまる
- 結線: SceneでArrowUpのPhaser Key `down` eventを`press()`へ接続する
  - Phaser 4.2.1の`Key.emitOnRepeat`はdefaultでfalse。OSのauto-repeatでは`down`が再発火しないことをsource（`keys/Key.js` の `onDown`）で確認した
- `update()`:
  - tick数が1以上のframeで`consume()`を1回だけ呼び、その最初のtickにだけ`pushPressed: true`を渡す
  - tick数0のframeでは消費しないので、押下は失われない
- `R`（restart）でlatchをclearする
- WASDは従来どおりframeごとのhold sample

# selfVelocity / externalVelocity ownership（Model B）

- `selfVelocity`: 自分の足運び
  - ACTION-02Bのgrounded ruleと、contactのclosing除去・inward判定はこちらだけに作用する
- `externalVelocity`: 相手のPushで受けた運動量
  - grounded ruleの対象外で、独自の減衰（`EXTERNAL_DECELERATION`、0までovershootなし）と`MAX_EXTERNAL_SPEED` clampを持つ
- 移動は`self + external`
- Snapshot:
  - `velocity` = 和（実際の移動速度。既存の意味を維持）
  - `externalVelocity` = 内訳
  - 自分の足運びは `velocity − externalVelocity` で導出でき、重複して保持しない
- Pushは常に両者へ同じdeltaを加え、減衰ruleも同じなので、externalは両者で常に等しい
  - したがって、組の相対位置にexternalは影響しない

# Push force / external momentum constants（暫定）

| 定数 | 値 |
|---|---|
| `PUSH_EXTERNAL_ACCELERATION` | 20 m/s²（net ±1あたり、法線方向） |
| `EXTERNAL_DECELERATION` | 8 m/s² |
| `MAX_EXTERNAL_SPEED` | 3 m/s |

実測（等しい体で、静止相手に接触した状態から1回Push）:

- 組の移動距離: 約0.267 m
- externalのpeak: 約1.73 m/s
- 押下から約27 tick（約0.45秒）でexternalが0になる

非接触Pushの踏み込み:

- 約0.127 m（self速度のpeakは約1.33 m/s）
- externalは常に0

# Contact integration

- penetration ownership（inward contribution、Case Dの精緻化）は**self velocityのみ**で判定する
  - externalは組で共有されるため、creepを再導入しない（T46: 600 tick歩き込んでもexternalは0、相手は不動）
- closing normalの除去と接線の保持はselfVelocityに対して行う（ACTION-03A2と同じ）
- Pushは位置補正ではなく、externalへの明示的な加速として作用する
- step順序はTask §11どおりで、Material Deviationはない
  - Pushの加速は次のtickから変位に効く（1 tickの遅延。Taskで許容済み）

# Tests

`pnpm test`: 75 tests PASS（既存51 + latch 5 + Push 19）。

- T37: 1 edgeでstartup開始、固定方向 = 開始時のfacing
- T38:
  - startup 6 / active 8 / recovery 10 tickが厳密に適用され、24 tick後にidle
  - timerは常に整数で1以上
  - Action中の連打・hold相当は無視され、queueされない。idle後の新しい押下は有効
- T39: 相手が横へ動き、facingが追従しても、Push方向は固定のまま
- T40:
  - Action中は、WASDを入れた場合と入れない場合で位置が完全一致する
  - idle後はWASDが効く
  - activeは固定方向へ駆動し、startup終了時にself速度が0
- T41:
  - 非接触Pushはexternalが0のまま、移動は0.05〜0.3 m（stepであってdashではない）で、最後は停止する
  - 走行中に押してもstartupで制動される
- T42:
  - contact中のactive Pushで組が防御側へ動く（Bが0.1 m以上後退）
  - 非重なり、両者のexternalは一致
  - activeでない間はexternalが0
  - BのPushは方向が反転する
- T43: 同時Pushではexternalが常に0。中点が不動、非重なり、有限、揺れなし
- T44:
  - externalは単調減少してexactに0。逆転なし、上限以下
  - 1 tick目の加速量、2 tick目の「減衰 + 加速」量が定数どおり
- T45:
  - 押されたBが横へ歩いても、externalのx成分は`EXTERNAL_DECELERATION`でのみ減る（grounded横減衰は及ばない）
  - 自分の足運び成分は横方向だけ
- T46: Pushなしのcontactでは、externalは常に0で、静止相手は不動（03A2の既存TestもすべてPASS）
- T47: Pushなしの移動ではexternalが0、actionはidle（ACTION-02Bの既存TestもすべてPASS）
- T48: Push、移動、同時Pushを混ぜた列で、決定的、有限、常に非重なり
- T49（`pressLatch.test.ts`）:
  - 1押下は1 tickだけで消費される
  - tick 0のframeでも保持される
  - 消費前の連続pressは1つにまとまる
  - 消費後の新しいpressで次のedgeが出る
  - clear
  - holdとOS repeatはBrowser Smokeで確認した
- 追加: action Snapshotのisolation。Phaser非依存の検査対象に`pressLatch.ts`を追加

# Verification

- `pnpm test`: PASS（75/75）
- `pnpm build`（tsc含む）: PASS
- `git diff --check`: PASS（今回はcommit前にstagingした差分に対して実行し、失敗時は止まるように連結した）
- 新Dependencyなし
- Simulation / latchはPhaser非依存
- Counter、回避、突っ張り、attributes、Ring-out、衝撃伝達、CPU AIはなし

# Browser Smoke

Chrome headless（専用profile）とDevToolsで実キーイベントを送り、Screenshotで確認した。

- Canvas起動、runtime error / console errorは0件
- ArrowUpを1回押すと、PLAYERの上に`STARTUP`が出て、その後`PUSH`になる。非接触なので短く前進して止まる
- ArrowUpをholdし、OS相当のauto-repeat keyDownを20回送った: Pushは1回だけ。約0.8秒時点でphase表示なし（idle）
- 離してから再度押すと、2回目のPushが発生する
- Dで歩いて接触すると、静止CPUは動かない（creepなし）
- その状態でArrowUpを3回押すと、CPUが約0.8 m後退する（Screenshotで、x≈575px → ≈670px）
- Push後にSでWASDが効く
- Rで初期配置に戻る
- ring外に出られる（Ring-out未実装）
- 注: 「押下40 ms後」のScreenshotが、1回目は`STARTUP`、2回目は`PUSH`だった。Screenshotの取得遅延によるもので、tick上の厳密なphaseはT38で確認している

# Acceptance Criteria

- AC-01〜AC-19、AC-21: PASS
- AC-20: User Play Testは REQUIRED / NOT RUN

# Implementation Evidence

1. one press = one Push: T37、T49、Smoke
2. hold no-repeat: Phaser `emitOnRepeat=false`、T38（Action中の押下を無視）、Smoke（auto-repeat 20回で1 Push）
3. startup / active / recovery: T38
4. locked direction: T39
5. short non-contact drive: T41（約0.127 m）
6. Contact Push external momentum: T42、T44
7. self / external separation: T45、Snapshotの`velocity` = 和
8. Contact + Movement regression: 既存51 Testが無修正でPASS（helperへの`pushPressed: false`追加のみ）、T46、T47

# Design Deviations

NONE

# Unexpected Scope

`BoutSimulation.test.ts` の末尾空白1件を削除した。ACTION-03A2のcommit `c11edc5` に混入していたもので、当時のReportで「`git diff --check` PASS」と誤記していた。今回のTaskで同ファイルを編集するため、ついでに除去した。コメント行で、挙動への影響はない。

# Known Untested Items

- **User Play Test（Push Feel、Task §18の11項目）: REQUIRED / NOT RUN**
- 実機キーボードの体感（startupの反応性、recoveryの不自由さ、Pushの因果感）
- 相手からのPush、および同時Pushの体感。CPUは静止のままで、Simulation Testでのみ確認している
- 60Hz以外のdisplay、tab復帰時のlatch挙動、Mobile / touch
- `pnpm dev`（HMR）でのrestart挙動

# User Play Test

REQUIRED / NOT RUN。

- 確認してほしい点: 1回の明確なAction感、holdで連射しないこと、startupの反応性、短い踏み込み感、接触Pushの因果感、recoveryの隙、Action中に操作できないことの妥当性、WASD復帰、非Push時のcontact / 移動が基準のままか、将来の↓/回避の対象として適しているか
- 調整が必要な場合は、上記phase tick数と3つのexternal定数を動かす

# Git delivery

`feat: add discrete push action` を1 commitで`origin/develop`へpushする。mainは変更しない。
