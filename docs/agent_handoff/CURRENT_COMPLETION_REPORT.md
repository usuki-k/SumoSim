Task-ID: ACTION-06A-RINGOUT-BOUTOUTCOME-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 7a28a211cf718a15e29cc7b15817b55e38be6bbf
Agent-Start-Head: 3e91fc38883edf13a2711017354f1da631e4c1f6
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 200/200、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**
- User Play Test: **REQUIRED / NOT RUN**

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `7a28a21`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `7a28a21..origin/develop` の変更は `docs/agent_handoff/` 配下のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `3e91fc3`

# Changed Files

- `src/game/sumo/ringOut.ts`（新規、pure、Phaser非依存）: `RING_OUT_SIMULTANEOUS_EPSILON`、`isOutOfRing`、`firstRingBoundaryCrossingFraction`、`resolveRingOut`
- `src/game/sumo/BoutTypes.ts`: `BoutFinishReason`、`BoutRematchReason`、`BoutOutcome`、`BoutSnapshot.outcome`
- `src/game/sumo/BoutSimulation.ts`: canonicalな`outcome`、step先頭のfreeze、`P0`の取得、tickの最後の判定、`copyOutcome`
- `src/game/sumo/BoutRingOut.test.ts`（新規）: T151〜T172
- `src/game/scenes/BoutScene.ts`: presentation metadata（`side`、未設定の`name`）、`outcomeLabel()`、結果text
- 意図した既存testの更新: 下記「Intentional Test Adaptations」
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

AGENTS.mdは変更なし。新規dependencyはなし。

# User Decisions Implemented

- UD-R1: 中心基準`Math.hypot(center) > arena.radius`。bodyRadiusや支持円は使わない
- UD-R2: 境界ちょうどはIN（厳密に大きい場合だけOUT）。1人分の判定にgameplay用のepsilonはない
- UD-R3: 先に出た方が負け。同時ならRematch。深さ・participantの順序・乱数は使わない
- UD-R4: `EAST|WEST <name> Win` / `Draw Rematch`。Player（`wrestler-a`）= EAST、CPU（`wrestler-b`）= WEST。名前は未設定なので、labelを暫定のfallbackとして使う

# BoutOutcome Type

`ongoing | win{winnerId, loserId, reason: 'ring-out'} | rematch{reason: 'simultaneous-ring-out'}`

- 理由は文字列literalのunionで、将来の負け方を追加できる
- 決まり手の分類systemは作っていない

# ringOut Helper / Math

- `isOutOfRing`: `hypot > radius`
- `firstRingBoundaryCrossingFraction(prev, cur, R)`:
  - `cur`がINならnull
  - `prev`がOUTなら0（防御的な処理）
  - それ以外は`|prev + t·d| = R`の大きい方の解（INだった区間の上端）を返す
  - 相殺の起きない形で計算する: `b ≥ 0`なら`c / q`（`q = −(b + √D) / 2`）、`b < 0`なら`(−b + √D) / (2a)`
  - `t ≤ 0`、`−0`、NaNは0にし、`[0, 1)`に収める
  - 外部ライブラリは使わない

# Resolved Interpolation Semantics

stepの先頭で各participantの位置`P0`をlocalに取得し、通常のtickを最後まで進めてから、最終的な位置`P1`で判定する。

- tick内部の中間位置（contact補正、bond、Gripの吸着、Counterの位置移動）は、個別のRing-out eventとして扱わない
- 物理的なsub-stepの時刻を再現しているとは主張しない
- T170で確認:
  - 吸着で境界ちょうどの位置から内側へ引き込まれたtickは、Ring-outにならない
  - bond補正を含むDriveのtickでは、判定結果がSnapshotの前後の位置に対するhelperの結果と一致する

# First-out / Simultaneous

| 状況 | 結果 |
|---|---|
| 誰もOUTでない | ongoing |
| 1人だけOUT | その者の負け |
| 2人ともOUT | 交差時刻の早い方の負け |
| 2人ともOUTで、差が1e-9以内 | rematch |

**深さを使っていないことの証明（T158）**: 同じtick内に、先に出たが浅い者と、後に出たが深い者を作った（実際の歩行と純関数のfixture、両方向）。どの場合も**先に出た浅い方が負け**になった。

実測（T156、隙間0.2 / 0.205で両者全速力）: 交差時刻はA = 0.50、B = 0.65で、Aの負け。鏡像ではBの負け、等しい隙間ではRematch。

# Tick Order

0. `outcome ≠ ongoing`なら即return（no-op）
1. `P0`を取得
2. 通常のtick: posture → readiness → release → FREE action / Drive → self → external → 積分 → contact → bond / Counter / Grip / Push → action timer → facing
3. `resolveRingOut(P0, P1)`を1回
4. `this.outcome`へ代入

Push / Drive / CounterにRing-out用の特別なcodeはない。

# Freeze Semantics

- 勝敗確定後の`step()`は完全なno-op。T167で、入力を変えながら120回`step()`しても、Snapshotが毎回完全に一致することを確認した
- action / velocity / engagementを正規化しない（T163: 最終Snapshotは`push`のまま。T148: `grappled`のまま）
- 後から相手が外へ出て結果が上書きされることはない（T166〜T168）

# Counter / Push / Drive Integration

- **Counter**: 位置移動の有効条件`R − bodyRadius`は変更なし。土俵際の代替配置（半径1.25の土俵）でも、中心は`R − bodyRadius`以内でongoing（T165）
- **Push**: 押し出された側の負け。最終位置は土俵外のままで、壁はない（T163）
- **Drive**: 前にいる者が先に出て負け（両方向）。bondの距離はRのまま、clampなし（T164 / T148）

# Snapshot API

topレベルに`outcome`を追加した（participantに勝敗のflagはない。T172）。

# Scene

- `PARTICIPANT_PRESENTATION`に`side: 'EAST' | 'WEST'`と`name?`を追加
- `outcomeLabel()`:
  - ongoingなら空
  - rematchなら`Draw Rematch`
  - winなら`${side} ${name ?? label} Win`
- 結果textは上部中央に表示する
- 体は最終位置のまま
- 入力の抑制はしない（Simulationがno-opなので不要）
- `R`で新しいBoutになる

**暫定の名前fallbackについて**: 現在の表示は`EAST PLAYER Win` / `WEST CPU Win`になる。PLAYER / CPUは暫定のlabelで、**正式な力士名ではない**。名前が決まったら、`PARTICIPANT_PRESENTATION`の`name`を設定するだけで差し替えられる。

# Intentional Test Adaptations（既存test）

開発中に一時的な計測（勝敗が確定したら例外を投げる）を入れて、既存testの中で勝敗が確定するものを全件洗い出した。その結果に基づいて、次のとおり更新した。計測codeは確認後に除去済み（現在のSourceには残っていない）。

| test | 変更内容 | 理由 |
|---|---|---|
| T126（Orientation） | topレベルのkey集合に`outcome`を追加 | Snapshot APIの意図した拡張 |
| T148（Drive） | 「Ring-outなし」を、「土俵を越えると寄り切りで勝敗が決まる、clampなし、最終状態を保持」に置き換え | 旧仕様が意図的に置き換わったため |
| T25（BoutSimulation）、T47（Push） | 遠くの相手の初期位置を`x = 1000`から`x = 90`へ（半径100の土俵内） | 1000では最初のtickで即Ring-outになり、testの本来の目的（接触しない遠くの相手）から外れるため。T47は計測なしでは止まっていても通ってしまう状態だった |
| T91（CounterPosition） | 半径100では全scriptを実行し、小さい土俵（1.25 / 1.0）では冒頭のCounterと代替配置の2区間だけを実行して、ongoingであることを確認する | 小さい土俵では、後半の歩行で中心が出て止まる（半径1.25では75 tick目、1.0では182 tick目）。そのままだとRing-outのtestになってしまうため |

更新後に同じ計測を再度行い、勝敗が確定するのはT148だけ（意図どおり）であることを確認した。T81 / T82（小さい土俵の代替配置）は無変更でPASSしている。その他のassertionは不変。

# Tests（200/200 PASS）

既存182件: 上記の更新を含めてPASS（T173）。新規18件:

- T151 初期はongoing、copyは独立
- T152 境界（3-4-5のように正確に表せる点ちょうどはIN、±1e-9をいくつかの方向で確認、Simulation内でも境界ちょうどならongoing）
- T153 / T154 片方だけOUT（両方向）
- T155 先のtickで出た者が負け
- T156 / T157 同じtickでの先後（両方の順序）
- T158 深さを使わない（両方の順序と純関数）
- T159 鏡像ならRematch（2つの速度で）
- T160 epsilonの境界（0.5e-9ならRematch、3e-9なら先に出た方が負け）
- T161 helper（null、境界から0、上下左右と斜め、弦の通過、接線方向、極小の移動、防御的な処理、範囲`[0, 1)`）
- T162 体の大きさを使わない
- T163 Push
- T164 Drive（両方向）
- T165 Counterの土俵際
- T166〜T168 壁なし、freeze、上書きなし
- T169 新しいBout
- T170 resolved interpolation
- T171 replay
- T172 Snapshot API、Phaser非依存

# Browser Smoke

**NOT RUN（environment limitation）**。`pnpm build`は成功。

# Implementation Evidence

上記の通り。Result / Reward、自動restart、支持円、手付き・倒れ、Throw / Lift、決まり手、stat、tempo調整、Counterの変更のcodeはない。

# Design Deviations

なし。

# Unexpected Scope

なし。

所見: T25 / T47のfixtureは、もともと半径100の土俵の外（x = 1000）に相手を置いていた。Ring-out導入前は無害だったが、導入後は最初のtickでRing-outになる。fixtureの修正で対応し、Simulationは変えていない。

# Known Untested

- Browser Smoke（Pushで押し出したときの表示とfreeze、Driveでの寄り切り、壁がないこと、Rでのrestart、東西の表示、console error）
- Ring-out Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Taskの10項目）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add ring-out bout outcome`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
