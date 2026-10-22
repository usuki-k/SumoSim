Task-ID: ACTION-09B-KUZUSHI-FOLLOWUP-WINDOW
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 45a3916a0480d870239024f1645ec3754cab5ca4
Agent-Start-Head: 95586d9fde14f3b11bdbe74f134a660861ea2121
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS: 必須の境界ケースD / P / T / G / C / Vをすべて実行してPASS、`pnpm test` 400 PASS、Browser Smoke 51 / 51 PASS（GPU）。Game Feelは、User Play Testで判断する）。

Kuzushiを、**最大1.5秒の、最初に成功した1回のfollow-upで消費される**無防備な状態にした:

- Push、Tsuppariのfollow-upは1.5倍
- 有効なGripは、従来どおりMorozashi
- どれも、そのtickでKuzushiを消費する

次のものは変えていない:

- Kuzushiの入口、CounterTransition、Push / Tsuppariの基本の値
- Gripのrange / Morozashi、汗のpresentation、Product art

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `45a3916`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `45a3916..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `95586d9`

# 定数（旧 → 新）

| 定数 | 旧 | 新 |
|---|---|---|
| `KUZUSHI_TICKS` | 30（約0.5秒） | **90（1.5秒 @ 60 Hz）** |
| Kuzushiのfollow-upの倍率 | `KUZUSHI_PUSH_SUSCEPTIBILITY = 1.5`（Pushだけ） | **`KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER = 1.5`**（PushとTsuppari。**名前を変えた**。1.5を持つ定数は1つだけ） |

- 名前の変更に合わせて、`BoutCounter.test.ts` / `BoutTsuppari.test.ts` と `docs/ARCHITECTURE.md` を更新した
- ARCHITECTUREには、旧名を履歴として残した
- 変えていないもの:
  - `PUSH_EXTERNAL_ACCELERATION`（26.25）、`TSUPPARI_IMPULSE`（2.13）、`MAX_EXTERNAL_SPEED`（3）
  - Tsuppariのreach / timing / cooldown / buildup
  - `COUNTER_WINDOW_TICKS`、`COUNTER_TRANSITION_TICKS`、Gripのrange

# 消費を実装した場所（すべて `src/game/sumo/BoutSimulation.ts`）

- **`resolveForces`**（Push / Tsuppariの力を解決する1か所）:
  1. 先頭で `wasKuzushi`（効果を加える前のKuzushi状態のset）を控える
     - 参加者の順序に依存しない
     - 別の「消費済み」flagは持たない（`posture` だけ）
  2. `followUp(receiver)`: 受け手が `wasKuzushi` に含まれていれば、`followUpReceivers` に記録して1.5を返す。含まれていなければ1
  3. Tsuppariの命中（受け手だけに入るpath）: `impulse = TSUPPARI_IMPULSE × followUp(receiver)`（clampは従来どおり）
  4. Pushが接触してactiveのpath: `resolvePush(contact, strikeNet, followUp)`
     - `strikeNet` は、命中ごとに `followUp` の倍率を掛けた符号付きの和
     - 受け手がKuzushiの命中は、この経路では構造上起きない。Kuzushiの参加者はPushもTsuppariもできないため
  5. **すべての力を加えた後に**、`followUpReceivers` の `posture` を `stable` にする（`action` はもともとidle。不変条件 kuzushi ⇒ idle は保たれる）
  6. その**後で**、6回目の命中の受け手を `enterKuzushi`（新しい完全な90）
- **`resolvePush`**:
  - `net !== 0`（実際にPush力を受ける）ときだけ、受け手に `followUp` を適用して1.5倍にし、消費を記録する
  - `net === 0`（打ち消し合い / Pushの無いtick）は、倍率1で消費しない
- **Grip**: 既存の `target.posture.kind === 'kuzushi'` → `stable` + Morozashi のまま（変えていない）
- Kuzushiの入口（`enterKuzushi`、Counter Fail、Push / Tsuppariの捕獲、6回目の命中）と、CounterTransitionの停止と再開は変えていない

# 順序の意味

- 消費されるのは、follow-upが実際に加わったtickのすべての力を加えた**後**
  - Pushの最初のforce tickは1.5倍、次のactive tickは受け手がstableなので1.0倍
- 消費しないもの:
  - Pushのstartup / recovery、接触の無いactive、打ち消し合い
  - whiff、range外 / 空振りのGrip
  - 接触、移動、減衰、待機、Counterの入力
- **Kuzushiを作る攻撃は、その新しいKuzushiの利点を受けない**
  - stableな受け手への6回目の命中は1.0倍で、その後に新しい90
- **すでにKuzushiの受け手への6回目の命中**:
  1. 古いKuzushiで1.5倍
  2. 古いKuzushiを消費する
  3. 6回目の規則で、新しい完全な90のKuzushiを作る
  4. 攻撃側のbuildupは0
- CounterTransition中:
  - pusherのKuzushiは90のまま止まる
  - 入力lockで、follow-upも解決されない
  - 完了時に新しい90から始まる
  - その後の最初のPush / Tsuppari / Gripが、同じ規則で消費する

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| 90 tickの長さ | `KUZUSHI_TICKS = 90`（`enterKuzushi`、CounterTransitionの再開が使う） | D1 / D2 / D3 / C1、smoke K1（90→0をtickごとに観測）、既存のT68など（記号で参照するtestは90でPASS） |
| 1回のfollow-upで消費 | `resolveForces` の `wasKuzushi` → `followUpReceivers` → stable。Gripは既存の消費 | P1 / T1 / G1 / C6a-c、順序非依存のtest（participant配列の入れ替え）、smoke K3 / K5 / K6 |
| Pushは1.5倍の後に消費 | `resolvePush`: `net ≠ 0` の受け手だけ `followUp` | P1（26.25×1.5/60）、P2（次のtickは1.0倍）、P3〜P6、T71の更新、smoke K3 / K4 |
| Tsuppariは1.5倍の後に消費 | 命中のimpulse × `followUp`（clampは既存） | T1（min(3.195, 3)）、T2、T3、smoke K5（|v| = 3.0、消費） |
| GripはMorozashiの後に消費 | 既存のまま（数値の倍率は無い） | G1〜G4、C6a、smoke K6 |
| 6回目の命中の順序 | 消費 → `enterKuzushi`（6回目）の順に固定 | T4（stable → 1.0倍で新しい90）、T5（Kuzushi → 1.5倍、古いものを消費、新しい90、buildup 0） |
| CounterTransitionを保つ | 変えていない（停止と、完了時の新しい90） | C3 / C4 / C5（入力を連打しても90のまま）、既存のD2（transition）test、smoke K7〜K9 |
| 汗の振る舞い | 変えていない（`kuzushiStrength = ticksRemaining / KUZUSHI_TICKS`） | V1〜V3（追加）、09Aの既存test、smoke（消費の次のframeで非表示） |
| gameplay / presentationの責任 | 倍率・消費・長さはすべて `src/game/sumo/`。presentationは読むだけ | diff（presentationのsourceは無変更、testだけ）、`kuzushiVisualEffect` は時間の入力を持たない |

# 必須の境界ケースの結果

- 新しいfile `src/game/sumo/BoutKuzushiFollowup.test.ts`（22 tests）
- `kuzushiVisualEffect.test.ts` に追加した3 tests
- 結果: すべてPASS

| ケース | 結果 |
|---|---|
| D1 Counter Failで完全な90 | PASS |
| D2 触らなければ90の完全tick | PASS（tickごとに90 − k） |
| D3 期限の直後は、入力の前にstable（同じtickのCounterの押下が開始する） | PASS |
| D4 `kuzushiStrength` = ticksRemaining / 90 | PASS（tickごと） |
| P1 接触したactive Pushの最初のforce tickが1.5倍で、その後に消費 | PASS |
| P2 次のactive tickは1.0倍（Δvが通常のrunと一致） | PASS |
| P3 startupは消費しない | PASS |
| P4 接触の無いactiveは消費しない | PASS |
| P5 recoveryは消費しない | PASS（接触の無いPushのstartup / active / recoveryを全部通しても、Kuzushiのまま） |
| P6 打ち消し合うPushは消費しない | PASS（下記の注を参照） |
| T1 Kuzushiの受け手への命中は1.5倍で、消費 | PASS（3.195はclampで3.0、通常は2.13） |
| T2 次の普通の命中は1.0倍 | PASS |
| T3 whiffは消費しない | PASS |
| T4 stableな受け手への6回目の命中は1.0倍で、新しい90 | PASS |
| T5 Kuzushiの受け手への6回目の命中は1.5倍、古いものを消費、新しい90、buildup 0 | PASS |
| T6 Counterで捕えられたTsuppariは不変（攻撃側はその場でKuzushi 90、impulse無し、transition無し） | PASS（既存のTS21〜24も） |
| G1 range内の有効なGripで消費し、Morozashi holder | PASS |
| G2 range外は消費しない | PASS |
| G3 reachの期限切れ / 空振りは消費しない | PASS（recoveryまで） |
| G4 KuzushiはGripのrangeを迂回しない | PASS |
| C1 Counter Failは90 | PASS |
| C2 Counterで捕えられたTsuppariの攻撃側は90 | PASS |
| C3 Push Counterの捕獲でtransitionが始まる | PASS |
| C4 transition中はtimerが止まる（90のまま） | PASS（入力を連打しても） |
| C5 完了で新しい90 | PASS（次のtickは89） |
| C6 transitionの後の最初のGrip / Push / Tsuppariで消費 | PASS（C6a Grip → Morozashi、C6b Push 1.5倍、C6c Tsuppari 1.5倍（clampで3.0）） |
| V1 新しい90で汗は満 | PASS |
| V2 半分の残りでalphaは約0.5 | PASS（残り45で0.5） |
| V3 follow-upで消費したtickに汗が消える | PASS（PushとTsuppari） |
| V4 transition中、汗は満のまま | PASS（09Aのtest D、smoke S2 / K8） |
| V5 Counterの35°の動きは不変 | PASS（`productCounterArt` のtest、smoke） |
| 参加者の順序に依存しない | PASS（PushとTsuppariのfollow-upで、participant配列を入れ替えても結果が同じ） |

P6の注:

- Kuzushiの参加者はPushを開始できない（kuzushi ⇒ idle、押下は無視される）
- そのため「Kuzushiの参加者が、打ち消し合うPushの片方になる」状態は、構造上起きない
- testでは次の2つを確かめた:
  - Kuzushi中のPushの押下がidleのまま
  - stable同士の同時Pushが、引き続き打ち消し合う
- 実装でも、`net === 0` のときは消費しない

# 既存のtestの更新（30 tickの前提や、仕様の変化による。弱めてはいない）

| test | 理由 / 変更 |
|---|---|
| `BoutCounter.test.ts` T71 | 仕様の変化: Kuzushiの防御側は最初のPush force tickで1.5倍、その後**stable**（消費）。旧名の定数も更新 |
| `BoutCounter.test.ts` T62 | 「遅すぎた」側を40 tick後に読んでいた。新しい規則では、BのPushがAのKuzushiを消費する。意図（最後のwindow tickなら捕えられ、1 tick遅いとFail）を保つため、windowの直後（`COUNTER_WINDOW_TICKS` tick）で読むようにした |
| `BoutTsuppari.test.ts` TS36 | 定数名の変更だけ（値1.5は同じ） |
| `pressLatch.test.ts` T77 | 「window + Kuzushiが過ぎた」frame数が、30 tickを前提にした12×4 tickだった。`ceil((COUNTER_WINDOW_TICKS + KUZUSHI_TICKS) / 4) + 1` にした |
| `pushDummyController.test.ts` T74 | ループの上限200 tickが、90 tickのKuzushiに足りなかった。400にした（判定は同じ） |
| `wrestlerVisualState.test.ts` | 半分の位置が、数値で15だった。`KUZUSHI_TICKS / 2` にした |
| `kuzushiVisualEffect.test.ts` | 数値の `1 / 30` を `1 / KUZUSHI_TICKS` にした |

# Verification（Heavy）

| 項目 | 結果 |
|---|---|
| focusedなKuzushi / Push / Tsuppari / Grip / CounterTransition / visual / Product Counterのtest | 9 files / 182 tests PASS |
| `pnpm test` | 25 files / 400 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` の `--check` | どれもexit 0 |
| `git diff 45a3916 -- public tools` | 0行（Product artは不変） |
| presentationのsource（`.ts` 本体） | 無変更（testだけを更新） |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ Chrome（CDP、GPU）
- 09Aのsmoke（Counter / Tsuppari / 35°の回転 / 汗）に、09Bの場面K1〜K9を加えた
- ブラウザ内で `dummy.nextIntent` を一時的に包み、tickごとのSnapshotを記録した。CPUのPush / Tsuppari / Grip / Counterの注入も、そこで行った（testだけ。ソースは変えていない）
- 結果: **51 / 51 PASS**

| 確認 | 結果 |
|---|---|
| K1 Counter FailのKuzushiは、90から0までtickごとに91 snapshot（約1.5秒。以前は30） | PASS |
| K2 触らなければstableに戻り、汗も消える | PASS |
| K3 接触したKuzushiの参加者への最初のPush force: Δv = 0.65625 m/s（= 26.25 × 1.5 / 60）。そのtickでstable。次のframeから汗は非表示 | PASS |
| K4 次のPush tick: Δv = 0.30417（= 26.25 / 60 − 減衰8 / 60）、つまり1.0倍 | PASS |
| K5 Kuzushiへの命中: \|v\| = 3.0 m/s（3.195がclampされる。通常は2.13）。消費され、汗は非表示 | PASS |
| K6 KuzushiへのGrip: Morozashi。そのtickで消費 | PASS |
| K7 Push Counterでtransitionが始まる（90 tick） | PASS |
| K8 transitionのあいだ、pusherのKuzushiは90で止まる（汗は満） | PASS |
| K9 transitionの後、触らなければ新しい90 tick | PASS |
| 09Aの汗（S1〜S4）、Product Counter / Tsuppariのtexture、35°の回転、Push / Grip / 移動、R restart、console error / 失敗したrequestが無い | PASS |

# Design Deviations

Design Deviations: NONE

（定数の名前を `KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER` に変えたのは、Taskが推奨した範囲。1.5を持つのはこの1つだけ）

# Unexpected Scope

NONE

`src/game/input/` で変えたのは、Kuzushiの長さに依存していた2つのtestの数値の前提だけ。sourceは変えていない。

# Known Untested Items

- 実機でのUser Play Test（Game Feel）

# User Play Test: REQUIRED

確認の手順:

1. `pnpm dev` → Enter → 離れてArrowDown（Counter Fail、1.5秒のKuzushi）
2. Kuzushi中の相手（dummy `2` のPushをArrowDownで返す / Tsuppariを6回）に、Push / Tsuppari / Gripで追撃する

判断してほしい点:

- 1.5秒は、ゆっくりした追撃の窓として十分か
- 1回の追撃で消費されるのは、公平で分かりやすいか
- Pushの1.5倍 → 消費後は通常、が分かりやすいか
- Tsuppariの1.5倍 → 消費後は通常、が分かりやすいか
- Grip → Morozashi → Kuzushiが消える、が一貫しているか
- 消費で汗が消えることが、「機会を使った」と伝わるか
- CounterTransitionの後の1.5秒は、長すぎないか

Technical PASSは、Game Feelの受理ではない。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `feat(gameplay): extend and consume kuzushi followup window` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
