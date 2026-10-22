Task-ID: ACTION-11A-GRIP-ATTEMPT-ART-VISUAL-GATE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: ed55d79ccd0907ab5f33f715e75f06956e6047f1
Agent-Start-Head: 897508051d906dcb16926a5fcb4af7c6dfc71f1e
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、build、exporterの決定性と`--check`、Browser Smoke 28 / 28（GPU）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

Userが用意したred Grip attempt pose 1枚から、一時的なVisual Gate textureを2枚書き出した:

- red: idleと同じ正規化
- blue: redの反射 + まわしの塗り替え

表示は`pose === 'grip' && gripPhase === 'reach'`のあいだだけ。次の場合は、その瞬間に既存の見た目へ戻る:

- 空振りのrecovery → idle sprite
- 成功（grapple）→ 既存のgrappleの見た目

gameplayは変えていない。

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `ed55d79`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `ed55d79..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `8975080`

# Source identity

| 項目 | 値 | 判定 |
|---|---|---|
| path | `tools/wrestler_art/input.local/candidate_red_grip_attempt.png`（commitしない。`git check-ignore`で確認） | 存在 |
| size / mode | 1254 x 1254 RGBA | 一致 |
| decoded RGBA pixel SHA-256 | `323a7e79829c371345e8561ef3dd8ff6f49541eceb74450ec418b16c328478e0` | 一致 |
| PNG file SHA-256 | `2dcc3b3f87a931098463a4168a0f31873c83b71e8b6badda376d4b1cc20f61f9` | 一致 |

# Measurement（FRONT / root / body core）

Product Tsuppari / Counterと同じlandmark registrationを、この画像で1回実行した（`measure_tsuppari_pose.measure_landmarks` / `normalization`）。

方法:

1. hair blobとmawashiの重心を1/2 BOXで求める
2. idle red masterに位置合わせする
3. 回転差 = angle(H→B) − idleの角度
4. scale = 2つの面積比のsqrtの平均
5. FRONT = idleの160.7 + 回転差

| 項目 | 値 |
|---|---|
| hair重心 / 面積 | (473.8, 534.9) / 42820 px（idle 42652） |
| mawashi重心 / 面積 | (908.0, 570.9) / 56876 px（idle 56028） |
| sqrt面積比 | hair 1.002、mawashi 1.008（2つがよく一致する。胴・頭・まわしはidleと同じ大きさで描かれている） |
| 回転差 | 1.841° |
| scale | 1.0048 |
| **source FRONT** | **162.5°** |
| **root（source px）** | **(683, 608)** |
| **body core（source px）** | **(568, 244) – (759, 850)** |
| body coreとFRONTの直交のずれ | 約0.03°（許容範囲内） |

- 値はrecipeに丸めて記録した（FRONT 0.1°、点 1 px）
- 測定の証拠は`grip_attempt_gate_recipe.json`の`measurement_evidence`に残した
- 書き出した後にidleと重ねて確認した:
  - 頭・まわし・胴の位置は、idleとほぼ一致する
  - 違うのは、前へ伸ばした両腕だけ
- 測定は安全に成立した。STOP条件には当たらない

# Runtime textures（`public/assets/action/wrestler/grip-attempt-gate/`）

| file | size | pivot | body core | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|---|
| `red.png` | 195 x 190 | (81, 105) | 123.0769 px（= 2R） | `9501d5301bbb982072bf419636c2ffb19f0ab9a3c72477172158a64f9dee57da` | `b98312b7093e9450a255ec2ac9356c05660434f5e1ed5d3491fd7e76bc6101ef` |
| `blue.png` | 195 x 190 | (81, 85) = redを反射（y → 190 − 105） | 123.0769 px | `828bbf803a41bbc19f16a1d691c0c3dc8dbb26d87c83a7ce673bc5f682c59098` | `dd7f93dc8f432aef25a073a631b236ef70142744e03e54c67f2a47d860e01ef3` |

# Mask diagnostics（blue、runtime scale）

| 項目 | 値 | 上限 |
|---|---|---|
| mask_px | 2220 | min 1500 |
| missed_band_px | 15 | max 60 |
| fringe_px | 72 | max 120 |

- 上限は、idle / Tsuppariと同じ標準値（1500 / 60 / 120）
- Grip専用の緩和は入れていない。全体の上限も変えていない
- 目視でも、肌・髪・腕に塗り替えの混入は無い

# Selector semantics

`src/game/presentation/gripAttemptGateArt.ts`（Phaser非依存、Simulation非依存）:

```ts
export function selectWrestlerDisplayArt(idle, state) {
  if (state.pose === 'grip' && state.gripPhase === 'reach') return GRIP_ATTEMPT_GATE_ART[idle.id]
  return selectWrestlerPoseArt(idle, state) // 既存: Counter → Product Counter、Tsuppari → Product Tsuppari、それ以外 → idle sprite
}
```

`WrestlerView`の変更は次の2点だけ:

- preloadに、gateのtexture 2枚を追加した
- `apply`の選択関数を、`selectWrestlerPoseArt`から`selectWrestlerDisplayArt`に替えた

次は変えていない:

- 体の回転（`facing + counterVisualRotationOffset`。Grip中は0）
- 影、位置、scale（textureごとのpivotとbody core）
- Kuzushiの汗

| visual state | 表示 |
|---|---|
| idle / move / push | idle Product sprite |
| tsuppari | Product Tsuppari |
| counter | Product Counter（35°の捌きもそのまま） |
| kuzushi | idle sprite + 汗 |
| **grip / reach** | **Grip attempt gate（新規）** |
| grip / recovery | idle Product sprite |
| grapple / drive | 既存のfallback（idle sprite） |

# Grip success / whiffの遷移（Browser Smokeの実測、frame単位）

- 空振り（blue）: `idle > grip/reach:grip-attempt-gate-blue x11 > grip/recovery:product-wrestler-blue x26 > idle`
- 空振り（red CPU）: `idle > grip/reach:grip-attempt-gate-red x12 > grip/recovery:product-wrestler-red x29 > idle`
- 成功（reach中に相手が範囲へ入る）: blue `grip/reach:grip-attempt-gate-blue x12 > grapple:product-wrestler-blue`
  - grappleの最初のframeから、attempt textureは消えている
  - recoveryは通らない
- Kuzushi Grip → Morozashi: engagementは`morozashi`、holderは`wrestler-a`（gripした側）
  - grapple中のframeに、attempt textureは無い
- 押した瞬間に範囲内でGripが成功する場合: Simulationは押下tickで直ちにgrappleへ入る（既存の挙動）
  - reach stateが1 tickも無いので、attempt poseは表示されない
  - 選択は`gripPhase === 'reach'`だけで決まる仕様なので、これは仕様どおり

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| exact source identity | recipeの`pixel_sha256` / `size` / `reviewed_file_sha256`。exporterはdecoded RGBA hashが違えばfail closed（`et.normalize`） | `test_user_source_identity`、`test_missing_or_changed_source_fails_closed`、Preflightのhash照合 |
| normalization / pivot / body core | idleと同じ`et.normalize`。FRONT = local +X、root = pivot、body core = 2R（123.076923 px）、/4 downscale。Scene側の補正は無い | `test_red_is_the_normalized_pose_and_blue_its_reflected_recolor`、`test_committed_textures_match_a_red_only_fresh_export`、TS metadataとexportの一致test、smoke 5 / 6 / 7 |
| red → blue | `aw.mirror_part`（local-Yの反射1回）+ `im.mawashi_mask` / `im.recolor`。ruleの持ち主は`runtime_wrestler_recipe.json`だけ | `test_only_one_local_y_reflection`、alpha保存とmask外が不変のtest、`test_recolor_rule_is_owned_by_the_idle_runtime_recipe` |
| runtime gate paths | `public/assets/action/wrestler/grip-attempt-gate/red.png` / `blue.png`（2枚だけ） | `test_exactly_two_files_from_the_one_red_pose`、`--check`、smokeのtexture size / 200応答 |
| reach-only selection | `selectWrestlerDisplayArt`: `pose === 'grip' && gripPhase === 'reach'` | A1–A5 test、smoke 2 / 3 / 4 / 8 / 同時reach |
| recovery fallback | reach以外は既存の`selectWrestlerPoseArt` → idle sprite | W1–W3 test、smoke 9 |
| success / grapple fallback | grappleのvisual pose（`grapple`）は既存の選択 → idle sprite | S1–S4 test、smoke 10 / 11 / 12 |
| gameplay unchanged | `src/game/sumo/`と`src/game/input/`のdiffは0行。Snapshotにも書き込まない | `git diff HEAD -- src/game/sumo src/game/input`が空、Snapshot不変のtest、Grip / Drive / Orientation / PushChargeの93 test |
| Product art regressions | idle / Tsuppari / Counterのtextureとrecipeは不変 | `test_accepted_idle_tsuppari_and_counter_textures_unchanged`、4 exporterの`--check`、R1–R4 test、smoke 13 |

# Verification

| 項目 | 結果 |
|---|---|
| Grip attempt exporterのfocused test（`tests.test_export_grip_attempt_gate`） | 17 / 17 OK |
| wrestler-art suite全体（`unittest discover -s tests`） | 185 / 185 OK |
| presentationのfocused test（`gripAttemptGateArt.test.ts`） | 10 / 10 PASS |
| presentation全体（Counter / Tsuppari / Kuzushi / visual state / idle art） | 9 files、81 PASS |
| 既存のGrip gameplay regression（BoutGrip / BoutDrive / BoutOrientation / BoutPushCharge） | 4 files、93 PASS |
| `pnpm test` | 27 files、449 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| Grip attempt exporterの決定性 | 2回続けて書き出し、pixel hashが同一。fixtureで2つのdirectoryへ書き出したbyteも同一（test） |
| `export_grip_attempt_gate.py --check` | ok（red / blue） |
| `export_runtime_wrestlers.py` / `export_tsuppari.py` / `export_counter.py --check` | すべてexit 0 |
| Product artが不変であること | `git diff HEAD`で、`public/assets/action/wrestler/red.png` / `blue.png` / `tsuppari/` / `counter/`に差分なし。pixelの固定test |
| `src/game/sumo/`・`src/game/input/`が不変であること | diffなし |

Presentation testの対応:

- A1–A5 / W1–W3 / S1–S4: `gripAttemptGateArt.test.ts`
- R1 Tsuppari、R2 Counter（rotation offset ≠ 0を含む）、R4 汗、R3 Push 24 tickの突進中はidle sprite: `gripAttemptGateArt.test.ts`
- 回転の35°と詳細: 既存の`productCounterArt.test.ts`
- R5: grapple / Driveの既存test
- R6: idle pixelの固定test
- R7: diffなし

# Browser / Runtime Smoke

headless Chrome + CDP、GPU（`--use-angle=d3d11`）、Vite dev server。

計測のために`WrestlerView.apply`を読み取り専用でwrapした。CPUの入力は、test専用のhookで差し込んだ:

- 赤のGrip
- 歩み寄り
- Counterの空振り

成功とMorozashiは、test fixtureでsimulationを差し替えて確認した。結果は **28 / 28 PASS**。

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 | Shiftで、最初のreach frameからattempt poseが出る | PASS |
| 3 | redは、red attempt texture | PASS |
| 4 | blueは、派生したblue attempt texture | PASS |
| 5 | idle → attemptの切り替えで中心が跳ばない（body x/yが同一） | PASS |
| 6 | scaleがidleと同一（差 < 1e-12） | PASS |
| 7 | 体・影の回転がcanonicalなfacingと一致 | PASS |
| 8 | attempt textureはreachのあいだだけ | PASS |
| 9 | 空振り → recoveryでidle texture、その後もidle | PASS |
| 10 | 成功 → grappleの最初のframeでattemptが消える | PASS |
| 11 | grappleは既存のfallback（idle sprite、canonicalな配置） | PASS |
| 12 | Kuzushi Grip → Morozashi（holder = gripした側）、attempt無し | PASS |
| 13 | Tsuppari左右 / Counter（−35°）/ Kuzushiの汗 / Push（facing凍結、idle sprite）は不変 | PASS |
| 14 | Rでrestartでき、restart後もattemptが出る | PASS |
| 15 | console errorと失敗したrequestが無い。gateのPNG 2枚は200 | PASS |
| + | 両者が同時にreachすると、それぞれ自分のattempt textureを出す | PASS |

最初の実行では2件がFAILした。どちらもscript側のbugで、修正後に全項目がPASSした:

- `__rec`をclearした後に読んでいた
- log clearの直後にShiftを押していた

Screenshot（ローカルのscratchpad、commitしない）:

- `01_blue_grip_reach`
- `03_red_grip_reach`
- `05_immediately_after_grip_success`
- `02_blue_grip_recovery_after_whiff`
- `04_both_grip_reach`
- `06_grapple_fallback_settled`
- `07_kuzushi_grip_morozashi`

目視の結果:

- reach中は、両腕を前へ伸ばして開いた手のpose
- recoveryと成功直後は、通常の2人のidle spriteになる

# Changed Files

新規:

- `tools/wrestler_art/grip_attempt_gate_recipe.json`: source identity、測定値、標準のmask上限
- `tools/wrestler_art/export_grip_attempt_gate.py`: `export_counter.py`と同じ構造の決定的なexporter（`--check`あり）
- `tools/wrestler_art/tests/test_export_grip_attempt_gate.py`
- `public/assets/action/wrestler/grip-attempt-gate/red.png`
- `public/assets/action/wrestler/grip-attempt-gate/blue.png`
- `src/game/presentation/gripAttemptGateArt.ts`
- `src/game/presentation/gripAttemptGateArt.test.ts`

変更:

- `src/game/scenes/WrestlerView.ts`: preloadにgateの2枚を追加し、選択を`selectWrestlerDisplayArt`に替えた。header commentを1行追加
- `docs/ARCHITECTURE.md`: 暫定（Visual Gate）のnoteを1項目追加
- `tools/wrestler_art/README.md`: tool表に1行と、暫定の節を追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更していない:

- `src/game/sumo/`、`src/game/input/`
- idle / Tsuppari / Counterのtexture・recipe・exporter
- `WRESTLER_PRODUCT_ART_SPEC.md`
- `PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Design Deviations

Design Deviations: NONE

（Taskが推奨したpathとfile名を、そのまま使った。選択関数の名前は`selectWrestlerDisplayArt`。Taskは名前を指定していない。）

# Unexpected Scope

なし。

- `tools/wrestler_art/README.md`への追記は、既存のtoolを一覧にする慣習に合わせたもの
- 内容は文書だけ

# User Visual Gate: REQUIRED

主な問い: このposeは、gameplayの大きさで「Shiftを押して掴みに行っている（Grip attempt）」と読めるか。

確認してほしい点:

- idle / Push / Tsuppariと区別できるか
  - Pushはidle spriteのまま突進する
  - Tsuppariは片手を突き出す
- 腕と手が「掴みに行く」形に見えるか
- pivotやscaleの切り替えが気にならないか
  - 胴・頭・まわしはidleとほぼ同じ位置にあり、変わるのは腕だけ
- redとblueの両方が自然に見えるか
- reachの6 tick（約100 ms）で読み取れるか
  - 押した瞬間に範囲内で成功した場合、attemptは表示されない（既存のgameplayどおり）
- 空振りでidleへ戻る切り替えは許容できるか
- attemptから現在の暫定grappleの見た目への切り替えは、Grip successのartが入るまで理解できる範囲か

Userが受け入れるまでは、Product artに昇格しない。spec、正式path、texture keyは変えない。

# Git Delivery

- stageするのはTask-owned fileだけ
- 手順: commit `art(action): add grip attempt visual gate` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`は変更しない
- `input.local/`はcommitしない
