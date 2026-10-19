Task-ID: ACTION-06-RINGOUT-BOUTOUTCOME-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 7a28a211cf718a15e29cc7b15817b55e38be6bbf
Agent-Start-Head: cd6c52066c687887f87bcbacc69dfe62b80fe33f
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation only）。

- 中心基準（UD-R1）、境界ちょうどはIN（UD-R2）、「先に出た方が負け、同時なら取り直し（Rematch）」（Correction）の3つを、Simulationが所有する決定的なruleとして実装できる
- 「先に出た」は、**各参加者のtick開始位置からtick終了位置までの直線区間と土俵の円が交わる時刻（tick内の割合）**で決められる。CCDや物理systemは不要
- 外へ出た深さで勝敗を決める処理は一切使わない
- 1 tick内の位置の書き換え（contact補正、bond、Grip時の吸着、Counterの位置移動）を検討した結果、この直線区間による定義を破るものはなかった（F4）
- 残る事項は推奨既定値付きのUser Decisionだけで、BLOCKEDになる点はない
  - 東西の割り当てと力士名は現在のSourceにない。これはUD-R5 / R6として明示した

Production Source / package / lockfileは未変更。Repository変更は本Reportのみ。

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 4`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `7a28a21`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `7a28a21..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ（Task、User Decisions、Correction）→ `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `cd6c520`
- 読んだもの: AGENTS.md、`BoutTypes.ts`、`BoutSimulation.ts`、`BoutDrive` / `BoutPush` / `BoutCounterPosition` / `BoutOrientation`のtest、`BoutScene.ts`、ARCHITECTURE.md、GAME_CONCEPT.md、Review記録（`cdd5040`）、Taskに追記されたUser Decision / Correction

# 用語の区別

- **Current Fact**: Current Sourceの事実
- **Recommendation**: 本Reportの推奨（未実装）
- **User Decision (UD)**: 実装前にUserが決める、または決めた事項
- **Deferred**: 後続Task

Taskのquestionのうち、Correctionで置き換わった部分（Q4 / Q5の深さ比較）は「交差時刻」に読み替えて回答する。

# Current Source Findings（Current Fact）

- F1 Arenaは原点中心の円（`arena.radius`、Prototypeでは2.275 m）。participantは`position`と`bodyRadius`を持つ。勝敗のstateはない。壁やclampもない
- F2 `step()`の中で位置が変わる箇所は、次の順に全部で5つ:
  1. 積分（`position += (self + external)·dt`）
  2. `resolveContact`の重なり補正
  3. GRAPPLEDなら`resolveGrappleBond`
  4. FREEなら`resolveCounter`の防御側の位置移動
  5. FREEなら`resolveGrip`の`enterGrapple`での吸着（bond）

  `resolvePush`、action timer、`updateFacing`は位置を変えない
- F3 Counterの位置移動の有効条件は`|target| <= arena.radius − defender.bodyRadius`（体全体が土俵内に収まる）。中心基準より厳しいので、**位置移動によって中心が土俵外へ出ることはない**
- F4 tick内の位置の書き換えと「出る」の関係:
  - 吸着（bondで間を詰める方向）: 2人を互いの中心を結ぶ線分上で動かす。両端が土俵内なら、凸性により結果も土俵内になる。つまり吸着では外へ出ない
  - bondの押し離し（距離 < Rのとき）: GRAPPLED中は外力が同じなので、ずれは浮動小数の誤差（約1e-16）程度
  - contact補正: 内側へ動いた側だけを法線方向に戻すので、移動量は重なりの大きさ（通常は数mm以下）
  - Counterの位置移動: F3により外へ出ない
  - → 実際に土俵外へ出る原因は、ほぼ積分（速度による移動）だけ
- F5 最大速度: externalのMAXは3 m/s、selfのMAXも3 m/s。合計しても1 tickあたり0.1 m以下で、土俵（半径2.275 m）に比べて小さい
- F6 Snapshotのtopレベルのkeyを厳密に確認しているtestがある:
  - `BoutOrientation.test.ts` T126: `['arena', 'engagement', 'participants']`
  - `BoutDrive.test.ts` T148: 同じkey集合に加え、**「土俵外でも何も起きない」こと自体**をassertしている
- F7 小さい土俵のfixtureを使うtest: `BoutCounterPosition.test.ts` T81（半径1.0）、T82（1.25）、T91（100 / 1.25 / 1.0でreplay）。T91は長い移動scriptを含むので、Ring-out導入後は途中でoutcomeが確定してfreezeする可能性がある（replayの一致というassertion自体は成り立つ）。実装時に確認が必要
- F8 Sceneの`PARTICIPANT_PRESENTATION`はid → `{controller, color, label: 'PLAYER' | 'CPU'}`だけを持つ。**東西の割り当てと力士名はどこにもない**

# Ring-out Criterion（Q1〜Q3）— 決定済み

- **UD-R1（決定）**: 中心基準。`|position| > arena.radius`ならOUT。`bodyRadius`や支持円の割合は使わない。Q2は対象外 / Deferred
- **UD-R2（決定）**: 境界ちょうど（`|position| === arena.radius`）はIN。厳密に大きい場合だけOUT。1人分の境界判定にgameplay用のepsilonは入れない
- 判定は`Math.hypot(x, y) > arena.radius`
- 体感: 体の中心が土俵線を越えるまで負けにならないので、見た目の円は半分近くはみ出してから負けになる（後で代表的な絵ができたら見直す前提、UD-R1）

# First Crossing（Correction）— Recommendation

## 定義

tick開始時の位置`P0`（全participantがIN。勝敗未確定のstepしか進まないため）と、tick内のすべての位置解決を終えた後の位置`P1`を使う。

- `|P1| > R` → このtickで外へ出た
- 交差時刻: 直線区間`P(t) = P0 + t·(P1 − P0)`（`t ∈ [0, 1]`）で、`|P(t)| ≤ R`を満たす区間の**上端**`t*`（最後にINだった瞬間）

```ts
// Pure. Returns the in->out crossing fraction in [0, 1), or null when the tick does not end OUT.
firstRingBoundaryCrossingFraction(previous: Vec2, current: Vec2, arenaRadius: number): number | null
```

- 円板は凸なので、INからOUTへ向かう直線区間は境界とちょうど1回交わる（出て戻ることはない）
- `a = d·d`、`b = 2·P0·d`、`c = |P0|² − R² ≤ 0`（`d = P1 − P0`）として、上側の解`t*`を求める
- 数値計算は、`b`の符号によって相殺の起きない形（`q = −(b + sign(b)·√(b² − 4ac)) / 2`で、`t* = max(q/a, c/q)`）を使う
- `c ≤ 0`なので判別式は0以上、`|P1| > R`なので`t* < 1`
- 境界ちょうど（`|P0| = R`）から外へ出る場合は`t* = 0`（境界ちょうどはINなので、そこが最後のINの瞬間）

## 勝敗

| このtickの終わりにOUTの者 | Outcome |
|---|---|
| いない | ongoing |
| 1人だけ | その者の負け（交差時刻は無関係） |
| 2人 | 交差時刻が早い方の負け。差が`RING_OUT_SIMULTANEOUS_EPSILON`以内なら**Rematch** |

- 前のtickで先に出た者がいれば、そのtickで勝敗が決まりfreezeする。そのため、後から出た者が評価されることはない（異なるtickの間の順序は自動的に決まる）
- 外へ出た深さ、tick終了時の中心からの距離、participantの順序、randomは**一切使わない**
- 防御的な処理: tick開始時にすでにOUTの者がいた場合（不変条件違反で、通常は起きない）は交差時刻0として扱う
- **同じtickの典型例**:
  - pairが土俵の接線方向へ平行移動して、2人同時に出る → 交差時刻が等しいのでRematch
  - pairが外へ向かって押される → 前にいる者が先（多くは異なるtick）

## tick内の位置の書き換えの扱い（F4）

- 直線区間`P0 → P1`は、そのtickの**正味の変位**を等速に均したもの。補正や吸着もこの区間に含まれる。特別な扱いは要らず、全員に同じ規則で決定的に適用できる
- 吸着とbondの押し離しは、F4により「外へ出る」原因にならない（bondの浮動小数の誤差は区間に含まれるだけ）
- Counterの位置移動は、F3により移動後が必ずINになるので、出た者の評価対象にならない
  - 将来この有効条件を緩めて土俵際や土俵外へ移動できるようにする場合は、瞬間移動を直線に均してよいかを、そのTaskで改めて判断する（Deferred）
- 一般のCCD、物理system、tick内のsub-step記録は不要
  - `P0`はstepの先頭で取るlocalな値で、保存するstateではない

## 同時のepsilon（Q6）

- `RING_OUT_SIMULTANEOUS_EPSILON = 1e-9`（tickに対する割合。約1.7e-11秒）を推奨する。**技術的な値**で、鏡像の配置で計算順序の違いから生じる丸め誤差を吸収するためのもの
- 鏡像配置（y = ±の対称）は、y²が同じ値になるので、多くの場合ぴったり一致する
- gameplayとしての「ほぼ同時の幅」（例: 数十ms以内なら取り直し）は導入しない。必要ならUser Decision（UD-R7、Deferred推奨）

# BoutOutcome Type（Q7、Q21）— Recommendation

```ts
export type BoutFinishReason = 'ring-out'                 // future: | 'touch-down' | 'throw' ...
export type BoutRematchReason = 'simultaneous-ring-out'

export type BoutOutcome =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'win'; readonly winnerId: ParticipantId; readonly loserId: ParticipantId; readonly reason: BoutFinishReason }
  | { readonly kind: 'rematch'; readonly reason: BoutRematchReason }
```

- `rematch`（同体・取り直し）は、引き分け（draw）とは意味が違うので明示する
- 表示上の「Draw Rematch」の文言はSceneが作る
- reasonは文字列literalのunionにしておく。将来の負け方を足しても構造は変わらない。決まり手の分類systemは作らない

# Outcome Source of Truth / Snapshot（Q8、Q9）

- `BoutSimulation`がcanonicalな`outcome`を1つだけ持つ
  - constructorでは`ongoing`
  - `BoutSnapshot.outcome`（topレベル）として独立したcopyを公開する
- participantにwinner / loserのflagは持たせない。Sceneも勝敗stateを持たない
- Snapshotの形が変わる（意図的なAPI拡張）ので、F6の2件のtestはscopeを限定して更新する:
  - T126: keyの集合に`'outcome'`を追加する
  - T148: 「Ring-outなし」を確認しているtestなので、Ring-outの仕様に置き換わる。半径100のfixtureで「Drive中に土俵内では何も起きない」に限定するか、Ring-outのtestへ移す
- F7の小さい土俵のtestは、実装時に挙動を確認する
- 古いkey集合のtestを守るために、Sceneだけが使う別APIへ隠すことはしない

# Tick Order（Q10）— Recommendation

```
[outcome ≠ ongoing なら即return（no-op）]
P0 = 各participantの位置（local）
posture timers → readiness → release → FREE action開始 / Drive → self velocity → external → 積分 →
contact → bond / Counter（位置移動）→ Grip（吸着）→ Push → action timers → facing →
resolveRingOut(P0, 最終位置)   // tickの最後に1回だけ
```

- tick内のすべての位置解決（contact / 位置移動 / 吸着 / bond / Driveの平行移動）が終わった後で判定する
- 途中でreturnせず、そのtickは最後まで普通に進める。その最終状態が「最後の物理的な瞬間」になる
- Counterのovershootは速度なので、次のtickの積分で反映され、そのtickの区間に含まれる
- Push / Drive / Counterのどれにも、Ring-out用の特別なlogicは要らない

# Counter / Push / Drive Interaction（Q11〜Q13）

- **Counter（Q11）**: 位置移動の有効条件（`R − bodyRadius`）は**変更しない**
  - 中心基準より厳しく、位置移動でRing-outが起きないことを保証している（F3）
  - 有効条件を中心基準などへ緩めるのは、Accepted Counterの幾何の変更になる。User Decision / 別Task（Deferred）
- **Push（Q12）**: そのtickの終わりにOUTなら勝敗が確定し、Push actionはSnapshotにactiveのまま残る。actionを即座にcancelする処理は追加しない（最小のrule）
- **Drive（Q13）**: pairは平行移動し、各participantを独立に判定する。前にいる者が先に出る。同時なら交差時刻で比較する。Driveに特別な処理は不要

# Post-outcome Freeze（Q14、Q15）— Recommendation

- **A: 勝敗確定後の`step()`は完全なno-op**
  - 位置・速度・action・posture・facing・engagement・outcomeはすべて変わらない
  - timerも減衰も止まる
- 最終Snapshotは物理状態をそのまま保持する（`push` / `drive` / grip / 0でない速度が残っていてよい）。勝敗はoutcomeが表す
- 結果画面へ移るときに何を見せるかはPresentationが決める。見た目を整えるためだけに他のstateを書き換えることはしない

# Scene Boundary（Q16〜Q18）— Recommendation

- **表示の文言（UD-R4、決定）**: `EAST <名前> Win` / `WEST <名前> Win` / `Draw Rematch`
  - Simulationはid（winnerId / loserId）とreasonだけを持つ
  - 文字列はSceneが組み立てる
- **東西と名前の境界（F8）**: Current Sourceにないので**作り話はしない**
  - 最小の拡張は、Scene側のpresentation metadata（`PARTICIPANT_PRESENTATION`）に`side: 'EAST' | 'WEST'`と`name`を加えること
  - Simulation、BoutSetup、勝敗の判定には入れない
  - 将来はManagement（番付・名簿）から渡されるpresentation用の設定になる
  - 値はUser決定（UD-R5 / R6）
- 入力は勝敗確定後も収集してよい（Simulationがno-opなので無害）。Sceneで入力を止める必要はない
- `R`で新しいBoutを始めると`ongoing`に戻る
- **Rematch（Q17）**: `Draw Rematch`を表示し、`R`で手動restartする。自動restartやtimerは付けない
- **土俵（Q18）**: 壁・clamp・跳ね返りは付けない。体は土俵線を越えた位置でfreezeし、押し出された感じが残る

# Body Size Compatibility（Q19）

中心基準では、体の大きさは判定に影響しない。大きい体ほど早く負けるような偏りはない。

将来、体の端や支持円で判定したくなった場合は、`bodyRadius`の割合ではなく、独立したphysical parameter（足の支持範囲）として導入するのがよい（Deferred）。今はstatを追加しない。

# Helper Boundary（Q20）

小さなpure module `src/game/sumo/ringOut.ts`（Phaser非依存）を推奨する。

- `isOutOfRing(position, arenaRadius): boolean`
- `firstRingBoundaryCrossingFraction(previous, current, arenaRadius): number | null`
- `resolveRingOut(entries: { id; previous; current }[], arenaRadius): BoutOutcome`

`BoutSimulation`はtickの最後に`resolveRingOut`を1回呼ぶだけ。Rule Engineは作らない。

# Result / Reward Boundary（Q22）

`BoutSimulation`は最終的な`outcome`を出すだけにする。将来、上位のgame state（Stable → Training → Bout → Result / Reward）がSnapshotの`outcome`を読んでResultへ遷移する。Management stateはBoutSimulationに入れない。

# Determinism / Tunneling（Q23）

- 判定は、固定tickごとに1回、位置解決の後に行う。render deltaは使わない
- 1 tickの最大移動は約0.1 m（F5）。ただし判定は最終位置で行い、交差時刻は区間から正確に求めるので、tunnelingの問題はない
  - 凸な円板なので、tick内で外へ出て戻る経路は直線区間では起きない
- CCDは不要

# Required Automated Tests（Q24、06A用）

1. 初期は`ongoing`。Snapshotの`outcome`は独立したcopy
2. 境界: ちょうど`R`ならIN、`R − 1e-9`ならIN、`R + 1e-9`ならOUT（1人分）
3. AだけOUT → Bの勝ち。BだけOUT → Aの勝ち（両方向）
4. 異なるtickで出た場合: 先に出た者が負け（後の者は評価されない）
5. 同じtickで、交差時刻はAの方が早い → Aの負け。Bの方が早い → Bの負け（両方向。深さは逆になるように配置して、深さで決めていないことを確認する）
6. 同じtickで、鏡像の配置（交差時刻が等しい）→ Rematch
7. epsilonの近傍: 差が`1e-9`以内ならRematch、それより大きければ勝敗が決まる（helperで）
8. `firstRingBoundaryCrossingFraction`: INのまま → null、境界ちょうどから外へ → 0、各方向、外れ値なし、finite
9. bodyRadiusが違っても結果が変わらない（中心基準）
10. FREE Pushで押し出す → 押し出された側の負け
11. Grappled Driveで寄り切る → 前にいる側の負け
12. 土俵際でのCounterの位置移動は土俵外へ出ない（F3。既存の有効条件のまま）
13. 壁やclampがない（最終位置は土俵外のまま）
14. 勝敗確定後、`step()`を何回呼んでもSnapshotが完全に同一（no-op）
15. 新しいBout（新しいinstance）は`ongoing`
16. replay一致・finite
17. 既存の182件: 意図したSnapshotの形の変更（T126 / T148）と、小さい土俵のtest（F7）の確認以外は変更なしでPASS

# User Play Test Plan（Q25）

最初にRing-out FeelがREQUIREDになるのはACTION-06A。

確認項目:
1. 押し出されたときの負けが、目で見て分かる位置で起きるか（中心基準の見え方）
2. Driveでの寄り切りが「寄り切り」らしく決まるか
3. 早すぎる・遅すぎる判定に見えないか
4. 同時に出たときのRematchが恣意的に見えないか
5. freezeが勝敗確定として分かりやすいか
6. `R`でのrestart
7. 見えない壁がないか
8. 全体の速度は引き続きDeferred

# User Decisions Required（Q26）

| # | 決定事項 | 状態 / 推奨 |
|---|---|---|
| UD-R1 | Ring-outの基準 | **決定済み**: 中心基準 |
| UD-R2 | 境界ちょうど | **決定済み**: IN |
| UD-R3' | 同じtickで2人とも出た場合 | **決定済み（Correction）**: 先に出た方が負け、同時ならRematch。推奨: 交差時刻は直線区間で求める |
| UD-R4 | 表示の文言 | **決定済み**: EAST / WEST + 名前 + Win、Draw Rematch |
| UD-R5 | 東西の割り当て | 推奨: Prototypeでは左（Player, `wrestler-a`）をEAST、右（CPU）をWESTとする（正面から見て東が左になる慣例に合わせた案）。User確認が必要 |
| UD-R6 | 力士名 | **User指定が必要**（作り話はしない）。未指定のまま実装する場合の代案: 名前を出さず`EAST Win` / `WEST Win`だけにする |
| UD-R7 | 同時判定のepsilon | 推奨: 技術的な`1e-9`（tickに対する割合）だけにする。gameplayとしての同時の幅はDeferred |
| UD-R8 | 勝敗確定後のstep | 推奨: 完全なno-opで、最終状態をそのまま保持 |
| UD-R9 | Outcomeの型 | 推奨: `ongoing | win{winnerId, loserId, reason} | rematch{reason}` |

# Rejected / Deferred

Rejected:
- 外へ出た深さでの勝敗（Correction）
- tick終了時の距離での比較
- participantの順序や乱数での決着
- 一般のCCDや物理system
- tick内のsub-stepの記録
- 勝敗確定後も物理を続ける案（Q14 B / C）
- 最終状態を正規化する案
- 壁・clamp
- 勝敗の文字列をSimulationに持たせる案
- PLAYER / CPUを東西とみなす案

Deferred:
- 支持円・体の端での判定（代表的な絵ができた後）
- gameplayとしての同時の幅
- Counterの位置移動の有効条件の緩和
- 手付き・倒れ・投げによる負け
- 決まり手
- Result / Rewardへの遷移
- 自動restart
- 全体の速度

# Next Implementation Sequence（Q27）

1. **ACTION-06A Ring-out / BoutOutcome Foundation**
   - 内容: `ringOut.ts`、`outcome`、tick最後の判定、no-op freeze、Sceneの勝敗表示（UD-R5 / R6に従う）、Q24のtest
   - **User Play Test REQUIRED**
2. 最小のResult / Reward遷移のInvestigation
3. Throw / Lift（新しい負け方が必要になるまでは、Ring-outと独立に進められる）

Ring-outとResult / Rewardを1つのTaskに束ねない。

# Design Deviations

なし（Investigationのみ）。

Correctionにより、元のQ4 / Q5（深さ比較）は「交差時刻」に読み替えて回答した。

# Unexpected Scope

なし。

所見:
- F6: T148は「Ring-outなし」を確認しているので、06Aで必ず書き換えになる
- F7: 小さい土俵のtestは06Aで確認が必要
- F8: 東西と名前のmetadataがない

# Verification

- Q1〜Q27に回答済み（Correctionを反映）。BLOCKEDになる点はない
- Current Fact / Recommendation / User Decision / Deferredを分けて記載
- Production Source / package / lockfileは未変更
- Repository変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`のみ
- `git diff --check`: PASS（commit前に実行）
- `pnpm test` / `pnpm build`: 不要（Source変更なし）。実行していない

# User Play Test

NOT REQUIRED（Investigation）。最初にREQUIREDになるのはACTION-06A。

# Git delivery

Investigation-only Report Commit Exceptionを適用。本Reportだけをstageし、`docs(agent): investigate ring-out bout outcome`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
