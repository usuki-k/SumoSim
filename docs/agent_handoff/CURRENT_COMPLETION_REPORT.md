Task-ID: ACTION-11F-GRIP-SUCCESS-PAIR-COMPRESSION-TUNE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 97ef733bbad7cebdcdbc3d64621ff5909574354d
Agent-Start-Head: a3aac27c179fd867ced582d7092bc24497b1cdc2
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - pure / focused test、`pnpm test`、`pnpm build`、`git diff --check`、Browser Smoke 18 / 18（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

ACTION-11Eの「横だけ−0.30 R」をやめ、前へ+0.14 R、横へ−0.20 Rの2成分にした。いずれも各力士のlocal frameで、presentationだけの表示offset。

- 向かい合った2人は、表示上で互いに押し込まれて重なる
- 頭は横にずれたまま、相手の肩口へ入る
- Simulationの位置、0.70 mのbond、facing、gameplay、asset、Grip attemptは変えていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `97ef733`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `97ef733..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `a3aac27`
- 前回、11Fがqueueされる前の開始指示ではTask-ID / Status不一致でSTOPし、Repositoryには何も書いていない

# Values

| 定数 | ACTION-11E | ACTION-11F |
|---|---|---|
| `GRIP_SUCCESS_FORWARD_OFFSET_R` | （無し、0） | **+0.14** |
| `GRIP_SUCCESS_LATERAL_OFFSET_R` | −0.30 | **−0.20** |

Task指定の暫定値のまま。実装後に値は調整していない。

# Final transform formula

`gripSuccessDisplayOffsetPx(state, facing, bodyRadiusPx)`（`src/game/presentation/gripSuccessGateArt.ts`。既存のhelperを拡張し、新しいhelperは作っていない）:

```
if pose !== 'grapple' && pose !== 'drive': (0, 0)
f = GRIP_SUCCESS_FORWARD_OFFSET_R * R      // +0.14 R
l = GRIP_SUCCESS_LATERAL_OFFSET_R * R      // -0.20 R
x = f * cos(facing) - l * sin(facing)
y = f * sin(facing) + l * cos(facing)
```

- local +X = FRONT、local +Y = 力士の右。ACTION-11E / Kuzushiの汗と同じ規約
- `WrestlerView.apply`は、このoffsetを体と影の位置に足すだけ。影の相対offsetは不変
- 汗・回転・scale・texture選択は不変

実測（R = 61.54 px、正対したneutral）:

- A（blue、facing 0）のoffsetは(+8.615, −12.308) px、B（red、facing π）は(−8.615, +12.308) px。点対称で、pairの中点は不変
- 表示上の中心間距離は108.671 px。canonicalな中心間距離は123.077 px（= 2R = 0.70 m）
- 軸方向に2 × 0.14 R近づき、軸と垂直に2 × 0.20 Rずれる

# Simulation / canonical bond unchanged

- `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiffは0行
- helperはSnapshotを変えない（test O1）
- grapple中のcanonicalな中心間距離は0.70 m（test O2、smoke 6 / 16b）
- smoke: free中の全frameで、体の位置 = canonicalな位置。success中は、offsetがちょうど上の式の値

# Tests

`src/game/presentation/gripSuccessGateArt.test.ts`: 19 / 19 PASS（ACTION-11Eの横だけのtest 2件を置き換え、追加）

| ID | 内容 | test |
|---|---|---|
| P1 / P2 | 正対したgrappleで、local前 +0.14 R、local横 −0.20 R | `P1 / P2: provisional values…` |
| P3–P5 | 17通りのfacingで、大きさ・成分・前（facing方向）・横（力士の左）が正しく回る | `P3-P5: …` |
| P6 / S6–S8 | 次の場面でちょうど(0, 0): attempt、whiff / releaseのrecovery、idle、Push、Tsuppari、Counter、Kuzushi | `zero for idle, Grip attempt, …` |
| P7–P9 | 正対で、前の成分は互いに内向き（逆向き）、横の成分も逆向き、和は0（中点不変）。表示上の距離 = hypot(2R − 0.28 R, 0.40 R) | `P7-P9: …` |
| S1–S3 | grapple / Drive（40 tick）/ neutralでoffsetあり。offsetの有無はsuccess textureの有無と常に一致 | `applies exactly while…` |
| S4 / S5 | Morozashiのholder / disadvantagedとも同じoffset | `S4 / S5: …` |
| O1 / O2 | Snapshot不変、bond 0.70 m | `display only: …` |
| O3 | `WrestlerView`は体と影にだけoffsetを足す（source assertion） | `stays Phaser-free…` |
| O4 / O5 | gameplay / asset / toolingのdiff 0 | `git diff --stat HEAD -- src/game/sumo src/game/input public tools`が空 |

# Verification

| 項目 | 結果 |
|---|---|
| Grip successのfocused test（pure offsetを含む） | 19 / 19 PASS |
| `pnpm test`（Grip attempt、Grip / Grapple / Drive / Orientationのgameplay、Counter / Tsuppari / Kuzushi / Pushのpresentationを含む） | 29 files、505 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/wrestler_art/`のdiff | 0行 |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU（`--use-angle=d3d11`）、Vite dev server、1920x1080。ACTION-11Eのscriptに、2成分のoffset・描画順・turningの確認を足して実行した。

- CPUの入力は、Morozashi（Counterの空振り）とturning（Pushを1回）のときだけ差し替えた

結果は **18 / 18 PASS**:

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 | attempt中は表示offset 0 | PASS |
| 3 / 4 | neutral grappleの最初のframeで、両者がsuccess texture + 2成分のoffset | PASS |
| 5 | 体の回転 = canonicalなfacing | PASS |
| 6 | canonicalなbondは0.70 m | PASS |
| 7 | free中はcanonicalな位置。success中は前+0.14 R / 横−0.20 Rで点対称、影も追従 | PASS |
| 7b | 重なりの描画順が安定（両者depth 2、display list上はA 4 / B 5で固定。redが上） | PASS |
| 8 / 10 | scale / pivot originは不変 | PASS |
| 11 | Drive（231 frame）中もoffsetが保たれる | PASS |
| 12 | Morozashiでも同じoffset | PASS |
| 13 | releaseの最初のfree frameでoffset 0、idle sprite | PASS |
| 14 | release後の新しいGripのattemptはoffset 0 | PASS |
| 15 | Tsuppari / Counter（35°）/ Kuzushiの汗 / Pushは不変、offset 0 | PASS |
| 16 | Rでrestartできる | PASS |
| 16b | Grappled Orientationのturning（下記） | PASS |
| 17 | console error・例外・失敗requestが無い。gate PNGは200 | PASS |

17の補足: 既存の`/favicon.ico` 404（ACTION-11D / 11Eで報告済み、Task外）は、この判定から明示的に除外した。

## Turning

手順:

- playerのCounterが、CPUのPushを捕まえる → CounterTransition
- その後、playerがGrip → Morozashi（holder = player）
- CPUはdisadvantagedで、TURNINGから始まる

結果:

- grappleは644 frame、そのうちturningは132 frame。最後は両者READYで正対（facing A π、B 0）
- 全frameで、各自のoffsetは「その時のfacingで回した+0.14 R / −0.20 R」と一致
- frame間でのoffsetの変化は、facingの回転で説明できる量を超えない（超過分の最大は8.5e-14 px）
  - facingの変化と無関係な横への瞬間移動は無い
- canonicalなbondは0.70 mのまま、描画順も安定

目視:

- turningの開始時（`06`）: redは背を向けている。前のoffsetはred自身の前（blueから離れる向き）に働くが、blueは前へ寄るので、背後から組みついた形に見える。pairが離れて飛び散ることは無い
- 回り込みの途中（`07`）: redの向きに沿って表示が回る
- 正対したとき（`08`）: neutralと同じ密着の形になる
- turning専用の処理は加えていない（明確な破綻は見えなかったため）

## Screenshots

ローカルのscratchpad `smoke11f\`、commitしない:

- `01_neutral_immediately_after_success`
- `02_neutral_settled`
- `03_drive_while_grappled`
- `04_morozashi_grapple`
- `05_immediately_after_release`
- `06_turning_immediately_after_success`
- `07_turning_mid`
- `08_turning_settled`
- 一覧: `pair_sheet.png`

目視の所見（判断ではなく観察）:

- ACTION-11Eより体が近く、肩・胸・腕が大きく重なって、密着して見える
- 頭は横にずれたままで、鼻先同士の衝突には戻らない。blueの頭は上側、redの頭は下側で、相手の肩口に入る
- 重なった部分は、redの体が上に描かれる（既存の生成順。frameごとに入れ替わらない）
- Drive / Morozashiでも同じ形
- releaseの瞬間、両者はcanonicalな位置へ戻る（offsetの大きさは約0.245 R）。idle spriteへの切り替えと同じframeで、補間は無い

# Changed Files

- `src/game/presentation/gripSuccessGateArt.ts`: `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14`を追加。`GRIP_SUCCESS_LATERAL_OFFSET_R`を−0.3から−0.2に変更。`gripSuccessDisplayOffsetPx`を前 + 横の2成分にした。header comment
- `src/game/presentation/gripSuccessGateArt.test.ts`: P1–P9 / S4–S5のtestと、S2の補足
- `src/game/scenes/WrestlerView.ts`: header commentだけ（offsetを足す処理は、ACTION-11Eのまま）
- `docs/ARCHITECTURE.md`: ACTION-11Eのnoteを、11E / 11Fの2成分（暫定）に更新
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない

# Known Untested Items

- 実機のTouch入力
- turningは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した。他の横からの組みは確かめていない

# User Visual Gate: REQUIRED

主な問い: 横のずれを減らし、2人を内側へ寄せたことで、離れているのではなく、きつく組み合っているように見えるか。

- 重なりの量は自然か。足りなければ、まず`GRIP_SUCCESS_FORWARD_OFFSET_R`だけを調整する
- −0.20 Rの横のずれで、頭が肩側に入っているか。違えば`GRIP_SUCCESS_LATERAL_OFFSET_R`を別に調整する
- 重なりでredが上に描かれる点は気にならないか
- Drive / Morozashi / releaseの瞬間の戻り / turningの見え方

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): compress grip success pair`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
