Task-ID: ACTION-08B-COUNTER-PRESENTATION-ROTATION-GATE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 592cbd86988fd9270ab03c7f0a04993b11ae2bfa
Agent-Start-Head: 3d523e31bd464dc2ca14255a2f57a01c3ddac8fd
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 27 / 27 PASS（SwiftShader）、GPUでの再実行も27 / 27 PASS。回転がCounterをTsuppariと見分けられるようにしたかは、User Play Testで判断する）。

- Counter windowのあいだだけ、体のspriteに、presentation専用の回転 **0° → 35° → 0°** を足した
  - 経路: `WrestlerVisualState.phaseProgress` → `counterVisualRotationOffset` → `WrestlerView`
- redは+、blueは−（同じ大きさで、逆の向き）
- 次のものは変えていない:
  - `participant.facing`、Simulation、CounterTransition
  - Counterの画像、影、位置、scale

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `592cbd8`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `592cbd8..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `3d523e3`

# 実装

## 角度・曲線・符号

| 項目 | 値 |
|---|---|
| 最大角度 | **35°**（`COUNTER_VISUAL_MAX_ROTATION_RAD = 35 · π / 180`） |
| 曲線 | `offset = sign · sin(π · phaseProgress) · 35°`。render deltaや壁時計は使わない |
| 符号 | **red = +1、blue = −1**（`COUNTER_ROTATION_SIGN`）。Phaserの+回転は、画面上で時計回り（local +X → +Y） |
| Counter以外 | **ちょうど0**（`state.pose !== 'counter'`） |

## 符号の根拠（Current Sourceで検証した）

- Counterのtextureで、pivotから一番遠い不透明画素（伸ばした腕の先）の角度を測った
  - red: FRONTから **+31.6°**（local +Y側）
  - blue: **−31.6°**（反射したので逆）
- red +35°なら腕先は約+66.6°、blue −35°なら約−66.6°へ動く。どちらも、前方（Tsuppariの線）から**離れる**
- 逆の符号にすると、腕先は前方の±3°付近に来て、Tsuppariに近づく。したがって、Taskの符号どおりで正しい
- 実際の画面でも確かめた（GPUのscreenshot）: blueは体が横を向き、腕は横へ大きく開いた

## Counterのprogress

- `wrestlerVisualState.ts`: Counterのとき `phaseProgress = progress(action.ticksRemaining, COUNTER_WINDOW_TICKS)`
  - `COUNTER_WINDOW_TICKS` をimportした。ほかのposeと同じ `progress()` を使う
  - Counter専用のtimerや状態は足していない
- 押したtickのあとの最初のSnapshotは、ticksRemaining 11（progress 1/12）
- 最後は1（11/12）。その次のtickでCounterが終わる
- そのため、角度の列は9.06° → 17.50 → 24.75 → 30.31 → 33.81 → **35.00**（残り6）→ 33.81 → … → 9.06°。Counterが終われば0

## 適用

- `src/game/presentation/counterGateArt.ts`: `counterVisualRotationOffset(id, state)`（pure、Phaser非依存）
- `src/game/scenes/WrestlerView.ts`: **体のspriteだけ** を `participant.facing + counterVisualRotationOffset(this.idleArt.id, state)` で回す
  - 影の回転は `participant.facing` のまま
  - 位置とscaleは変えていない
  - 回転の中心は、既存の明示pivot（= canonicalなparticipantの中心）

# Changed Files

- `src/game/presentation/wrestlerVisualState.ts`（Counterの `phaseProgress`）
- `src/game/presentation/counterGateArt.ts`（定数、符号、`counterVisualRotationOffset`、comment）
- `src/game/scenes/WrestlerView.ts`（体の回転に、offsetを加える）
- `src/game/presentation/counterGateArt.test.ts`（08Bのtestを追加。既存のinput helperにpush / grip / moveを追加）
- `src/game/presentation/wrestlerVisualState.test.ts`（Counterのprogressのtestを追加）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## 変更していないもの

- `src/game/sumo/`、`src/game/input/`（`592cbd8` から差分0行）
- `BoutScene.ts`
- `public/`、`tools/`（差分0行。Counterの2枚、idleの2枚、Tsuppariの4枚は不変）
- SPEC、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Verification

| 項目 | 結果 |
|---|---|
| presentationのtest（`counterGateArt` / `wrestlerVisualState` などを含む） | 55 tests PASS |
| `src/game/sumo` のtest（Counter / CounterTransition / Tsuppari / Push） | 13 files / 274 tests PASS（変えていない） |
| `pnpm test` | 23 files / 362 tests PASS |
| `pnpm build` / `tsc --noEmit` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| `export_counter_gate.py --check` / `export_runtime_wrestlers.py --check` / `export_tsuppari.py --check` | どれもexit 0（Counter / idle / Tsuppariのassetは不変） |
| `git diff 592cbd8 -- src/game/sumo src/game/input public tools` | 0行 |

追加したtestと、Taskの検証項目との対応:

| Taskの項目 | test |
|---|---|
| 1. Counter以外の状態は0 | idle / move / push / tsuppari / grip、Counterを出た後 |
| 2. progressは `COUNTER_WINDOW_TICKS` から作る | `wrestlerVisualState.test` で、window全体の各tickについて `1 − ticksRemaining / 12` を確かめる |
| 3. 曲線 | tickごとに `sin(π p) · 35°` と一致する |
| 4. 最大値 | ちょうど35°、中間点（index 5 = 残り6）で出る。始めと終わりは対称で、10°未満 |
| 5. red / blueは同じ大きさで逆の符号 | tickごとに確かめる |
| 6. visual state + idだけで決まる | 同じ入力なら同じ値 |
| 7. Snapshot / facingは不変 | JSON、facingの配列が変わらない |
| 8〜10. Tsuppariの選択、idle / move / Push / Grip、Counterの選択 | 08Aの既存testがそのまま通る |
| 11. CounterTransitionのgameplay test | sumoのtest、変えずにPASS |
| 12. sumo / inputに意味の変更が無い | diff 0行 |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ headless Chrome（CDP）
- 08A1のsmokeに、回転の判定を加えた
  - logに、`phaseProgress` と影のrotationを記録する
  - Counter frameでは、`body.rotation − facing = ±sin(π p) · 35°` であることを確かめる
  - それ以外のframeでは、回転差が0であることを確かめる
- CPU redのCounterは、smoke scriptの中だけで、`dummy.nextIntent` を一時的に包んで出した（ソースは変えていない）

結果: SwiftShaderで **27 / 27 PASS**、GPU（D3D11）で再実行して **27 / 27 PASS**

| 確認 | 結果 |
|---|---|
| Enterで開始。ArrowDownで同じCounterが始まる | PASS |
| blue: 全Counter frameで、rotation − facing = −sin(πp)·35°。観測した値（GPU）: −9.06 → −17.50 → −24.75 → −30.31 → −33.81 → **−35.00** → −33.81 → … → −9.06° | PASS |
| red: +の鏡像。観測した値は +9.06 → … → +33.81°。この時点でPushをBestで捕まえてCounterが終わり、既存のCounterTransitionへ移ったので、redは35°に届く前に戻った | PASS |
| 回転はpivot（canonicalな中心）のまわり。位置 = Snapshot center、scale 1.0、影のrotation = facing | PASS |
| Snapshotの `participant.facing` は、Counterのあいだ変わらない（blueは0のまま） | PASS |
| Counter以外のframe（CounterTransitionを含む）、Tsuppariの左右は回転差0 | PASS |
| Counterの空振り → 既存どおりFail / Kuzushi。PushのBestの捕獲 → 既存のCounterTransition（`active`） | PASS |
| Push / Grip / 移動、idle / moveのsprite、R restart、console error / 失敗したrequestが無い | PASS |

代表のscreenshot（scratchpadの `smoke7/`、GPU）:

| tag | progress | 観測したoffset |
|---|---|---|
| `09_blue_early` | 0.1667 | −17.50° |
| `09_blue_peak` | 0.4167 | −33.81° |
| `09_blue_late` | 0.8333 | −17.50° |
| `10_red_early` | 0.25 | +24.75° |
| `10_red_peak` | 0.4167 | +33.81° |

- redのlateは無い（早く捕まえてCounterが終わったため）
- logの中では、blueは中間点で−35.00°に達している

## 描画の問題の切り分け（参考。実装の不具合ではない）

- SwiftShader（headless既定のsoftware GL）では、0°/90°以外の角度に回したspriteで、blueの体の一部が三角形に欠けた
- 同じ欠けは、**idleのspriteに手で一定の回転を足しただけでも出た**。Counterの実装とは関係なく、回転したsprite一般で起きる
- 実GPU（ANGLE D3D11、RTX 3060 Ti）で同じ実験をすると、欠けは出なかった
- そのため、headlessのsoftware renderer固有の描画の問題と判断した
- 判定は、SwiftShader / GPUの両方で27 / 27 PASS（判定は画素ではなく、sprite / Snapshotの値で行っている）

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

NONE（上記のSwiftShaderの描画の問題は、testの環境だけの問題。repositoryの範囲外）

# Known Untested Items

- 実機でのUser Play Test（Game Feel）

# User Play Test: REQUIRED

主な問い:

> 35°の体の捌き（回転）で、ArrowDownがTsuppariとはっきり見分けられるようになったか

判断してほしい点:

- 体の捌き / 受けの動きに見えるか
- 35°は十分か、多すぎるか、少なすぎるか
- red / blueの両方が自然か
- 回転の向き
- idle → Counterの動きが気にならないか
- 早くSuccess / Bestしたときに、回転が途中で戻ることを許容できるか
- 既存の横 / 後ろへのCounterTransitionが、引き続き読み取れるか
- Tsuppariは、引き続き前への突きに見えるか

確認の手順:

1. `pnpm dev` → Enter → ArrowDown（blue）
2. CPUのPushをArrowDownで返す（dummy `2`）

Technical PASSは、動きを受理したという意味ではない。

# Git Delivery

- stageするのはTask-owned fileだけ。commit `feat(presentation): animate counter body rotation` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
