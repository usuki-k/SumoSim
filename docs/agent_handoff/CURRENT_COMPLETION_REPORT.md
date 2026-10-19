Task-ID: ACTION-04A2-COUNTER-POSITION-RESOLUTION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 0dede47770b664f9fd01b99597403ad7bd92b55a
Agent-Start-Head: fe80d5582bc7b6fabc615c453510a5add7d7975c
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 124/124、`pnpm build`、`git diff --check`）。

- Browser Smoke: **NOT RUN（environment limitation）**
- User Play Test: **REQUIRED / NOT RUN**（Full Counter Feelを判断するgate）

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 3`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `0dede47`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `0dede47..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `fe80d55`

# Changed Files

- `src/game/sumo/BoutSimulation.ts`: 定数`COUNTER_OVERSHOOT_SPEED` / `COUNTER_SIDE_EPSILON`、pure helper`counterRelocationTarget()`、`resolveCounter`の拡張
- `src/game/sumo/BoutCounterPosition.test.ts`（新規）: T78〜T89、T91
- `src/game/sumo/BoutCounter.test.ts`: A1のtest 2件をA2の仕様に合わせて更新（下記Design Deviations参照）
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更していないもの: `BoutTypes.ts`（新しい型は不要だった）、`BoutScene.ts`（表示の追加は不要。位置の結果そのものが違いを見せる）、AGENTS.md、Dummy。新規dependencyはなし。

# Best Rear Algorithm

`resolveCounter`内の処理（Task §10の順序どおり）:
1. Counter windowと攻撃側のPush Activeが成立していることを確認
2. `d`（locked Push direction）を**`enterKuzushi`の前に**copyする
3. tierを判定
4. contact解決後の位置から移動先を決める
5. 攻撃側Kuzushi
6. 防御側idle
7. 防御側の`position`を書き換え（移動先がある場合）
8. 攻撃側に`d × COUNTER_OVERSHOOT_SPEED`を加えて`clampExternal`

移動先の基準: `P` = 攻撃側の中心、`R` = 半径の和、`perp = (-d.y, d.x)`。
- rear = `P − d·R`
- Bestの候補順: rear → 優先side → 反対side → 移動なし

# Automatic Side Algorithm / Tie-break / Fallback

- side+ = `P + perp·R`、side− = `P − perp·R`
- `lateralOffset = dot(perp, defender − P)`（移動前の防御側位置で計算）
  - `> COUNTER_SIDE_EPSILON`（1e-6 m）ならside+
  - `< −ε`ならside−
  - それ以外はtie
- tieの場合: 土俵中心からの距離が小さい方（差がε以内なら同じとみなす）。それも同じならside+
- Successの候補順: 優先side → 反対side → 移動なし
- 移動しない場合でもtierは変わらず、攻撃側Kuzushiとovershootも適用する。BestをSuccessへ格下げすることもない
- randomや手動選択は使わない

# Target Validity Rule

valid = x・yが有限、かつ`hypot(target) <= arena.radius − defender.bodyRadius`。clampはしない。移動先は常に`P`から距離`R`ちょうど（重なりも隠れた隙間もない）。

# Overshoot

- `COUNTER_OVERSHOOT_SPEED = 1.0` m/s（暫定）
- Best / Successの成功1回につき1回だけ、**攻撃側だけ**のexternalVelocityへ`d`方向に加える
- 既存の`clampExternal`（MAX 3 m/s）と既存の減衰（`EXTERNAL_DECELERATION`）がそのまま効く
- Counter専用の減衰は作っていない

# External Momentum Preservation

pair externalVelocityは消さない。防御側は既存の値を維持し（そのtickは通常の減衰だけ）、攻撃側は既存の値にovershootを足す。

# Tests（124/124 PASS）

- 既存108件: 全PASS（T64 / T67のみA2の仕様に合わせて更新）
- 新規16件:
  - T78 Bestは背後へ（`P − dR`、Contact距離ちょうど、攻撃側Kuzushi、防御側stable / idle）
  - T79 Successは両方の符号を確認（+y / −yへ歩いてからCounter → その側へ）
  - T80 tie-break（中心寄り2方向、ε以内のtie、最終tieはside+、明確な傾きは中心優先より優先）
  - T81 優先sideがinvalidなら反対side、両方invalidなら移動なし、統合版（Successでも攻撃側Kuzushiとovershootはあり）
  - T82 Bestのfallback 4段階、統合版（rearがinvalid → side+、tierはBestのまま）
  - T83 grid上の全組み合わせ: 適用された移動先は有限・土俵内・`P`から距離`R`ちょうど
  - T84 Active初tickのBestで攻撃側にちょうど`d·1.0`、防御側は0。大きな既存momentumに足すとMAX 3.0にclamp
  - T85 遅いSuccess: 既存のpair momentumは減衰分だけ（そのtickのPush gainなし）、攻撃側だけ`+d·1.0`
  - T86 overshootは既存の減衰で毎tick`8/60`ずつ0まで下がり、反転せずNaNもない
  - T87 Push開始後に横へ動いてcontact normalとfacingがずれても、移動先とovershootはlocked `d`基準
  - T88 Failは移動なし・overshootなし・自分がKuzushi
  - T89 A1の挙動（そのtickのPush gainなし、tierの境界、Kuzushiのtimerとfacing固定）
  - T91 3種類の土俵半径（通常 / rear invalid / 全invalid）で、混在sequenceのreplay一致・finite・重なりなし
- T90: 既存のPush / Contact / Movement / Dummyのtest群が全PASS

# Browser Smoke

**NOT RUN（environment limitation）**。実ブラウザを操作するToolがない。`pnpm build`は成功。

# Acceptance Criteria

| AC | 状態 / 根拠 |
|---|---|
| AC-01 | PASS（T78 / T87） |
| AC-02 | PASS（T78） |
| AC-03、AC-04 | PASS（T79） |
| AC-05 | PASS（T80） |
| AC-06 | PASS（T81） |
| AC-07 | PASS（T82） |
| AC-08 | PASS（T83。clampのcodeなし） |
| AC-09 | PASS（T81 / T82） |
| AC-10 | PASS（T84） |
| AC-11 | PASS（T87） |
| AC-12 | PASS（T84〜T86） |
| AC-13 | PASS（T85 / T89） |
| AC-14 | PASS（T88） |
| AC-15 | PASS（T89、既存A1 test） |
| AC-16 | PASS |
| AC-17、AC-18 | PASS（該当codeなし） |
| AC-19 | PASS |
| AC-20 | PASS |
| AC-21 | PASS |
| AC-22 | REQUIRED / NOT RUN |
| AC-23 | PASS |

# Implementation Evidence

1. Best rear: T78
2. Success side+ / side−: T79
3. tie-break: T80 / T82統合
4. invalid fallback: T81 / T82
5. 重なりなし・土俵内: T83
6. 攻撃側だけのovershoot: T84
7. 既存externalの保持: T85
8. locked direction基準: T87
9. Failは不変: T88
10. A1 + Push / Contact / Movementのregression: T89 / 既存108件

# Design Deviations

なし（実装の意味はTaskどおり）。

既存testの更新が2件ある。いずれもTaskが求める新しい意味に合わせるために必要だった:
- T64: 「Counter後もpair externalが完全に一致する」→「攻撃側 = 防御側 + overshoot」。T13で求められている、既存momentumとovershootの区別に合わせた
- T67: A1限定だった「relocationなし」のassertion（y≈0、|Δx|<0.05）を削除し、Contact距離のassertionに置き換えた。位置の検証はT78以降で行う

# Unexpected Scope

なし。

Play Test向けの所見:
- 静止した相手を真正面から押す標準的な状況では、防御側はlocked direction上にいるのでSuccessはtieになりやすい
- Prototypeの初期配置（y=0の対称配置）ではtieがほぼ確実で、中心からの距離も同じになるため、横へ動いていなければside+（攻撃者から見て右。現状では画面上の上側）が選ばれやすい
- Counter前にWASDで横へ寄っていれば、その側が選ばれる

# Known Untested

- Browser Smoke全項目（Mode 2での背後 / 側面の見え方、overshootの見え方、瞬間移動の読みやすさ、console error）
- Full Counter Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN（Task §18の15項目）。

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add counter position resolution`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
