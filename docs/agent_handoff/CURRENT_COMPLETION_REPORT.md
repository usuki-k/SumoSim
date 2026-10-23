Task-ID: ACTION-11D-GRIP-SUCCESS-ART-VISUAL-GATE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 6264e95052c60dcbe4b4a998d169047d5c608e1f
Agent-Start-Head: 4f8766a13a933f91c2f0ca556e3907aeb0343fa2
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、build、exporterの決定性と`--check`、Browser Smoke 16 / 16（GPU）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

Userが用意したred Grip success pose 1枚から、一時的なVisual Gate textureを2枚書き出した:

- red: idleと同じ正規化
- blue: redの反射（local Y）+ まわしの塗り替え

表示は`pose === 'grapple' || pose === 'drive'`のあいだ。neutral / Morozashi（holder・disadvantaged）で同じpose。releaseの瞬間にidle spriteへ戻る。Grip attempt（ACTION-11A）、gameplay、bondの距離、pair配置は変えていない。

# Preflight

- 1回目・2回目の開始指示: Source identityの不一致（decoded RGBA `0cedde98…` ≠ Taskの`b2d38c4f…`）でSTOP。Repositoryには何も書いていない
- 3回目: working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `6264e95`（`origin/develop`のancestor）、Handoff-Mode GITHUB。期待hashは`4f8766a`（`docs(agent): align grip success source identity`）で現物の値に更新されていた
- `6264e95..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `4f8766a`

# Source identity

| 項目 | 値 | 判定 |
|---|---|---|
| path | `tools/wrestler_art/input.local/candidate_red_grip_success.png`（commitしない。`git check-ignore`で確認） | 存在 |
| size / mode | 1283 x 1226 RGBA | 一致 |
| decoded RGBA pixel SHA-256 | `0cedde984646384514e3b1609b69f04450d04c5446888da966de206a183e566e` | 一致（正） |
| PNG file SHA-256 | `aace9edc143176673aabf78b66120885d54fb722aa2f50a0f3a031cb1f679793` | 一致 |

使ったsourceはこの1枚だけ（attempt / idle / 他の候補で代用していない）。exporterは`aw.load_source`でsize / decoded hashが違えばfail closedする。

# Measurement（FRONT / root / body core）

既存のProduct Tsuppari / Counter / Grip attemptと同じlandmark registration（`measure_tsuppari_pose.measure_landmarks` / `normalization`。idle red masterへ、髪の塊とまわしの重心で合わせる）をこのsourceで1回実行した。attempt / Counter / idleの値は流用していない。

| 項目 | idle reference | Grip success |
|---|---|---|
| hair centroid（source px） | (428.7, 542.7) | (359.8, 549.1) |
| mawashi centroid | (878.6, 565.5) | (978.0, 574.7) |
| hair px / mawashi px | 42652 / 56028 | 80116 / 114724 |
| rotation delta | — | −0.528° |
| scale s | — | 1.4007（hair sqrt比 1.371、mawashi 1.431、H→B距離比 1.374） |

recipeに記録した値（front 0.1°、点 1 px に丸め）:

- `source_front_deg` 160.2（idle 160.7 + delta）
- `root_source_px` (662, 639)
- `body_core_source_px` (481, 139)–(781, 971)、body coreはfront軸に垂直（`load_recipe`が検査）
- 測定は`test_recorded_measurement_is_reproducible`で毎回再測定して照合（丸め誤差 ≤ 0.1° / 1 px）

判断: sourceはidleの約1.40倍の大きさで、向きはほぼidleと同じ。2つの面積比のずれ（約4%）は、Counterで受理済みの前例（1.317 / 1.009）より小さい。安全に測定できると判断した。

# Runtime textures

| file | size | pivot | body core | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|---|
| `grip-success-gate/red.png` | 160 x 183 | (83, 98) | 123.076923 px（= 2R） | `afab5fbc87e586147ff9c35ae14aedddc0c78e436ef2142bd8cb0e906867ef0b` | `8a9aa64bce6047f4196b80facb1537b00b7c08390df8228d158565bb4db5abf5` |
| `grip-success-gate/blue.png` | 160 x 183 | (83, 85) = redの反射（183 − 98） | 123.076923 px | `2336e895cfb92c625042f2af688d23d11c146bec70d51434849cb72122777a8b` | `0ee7d78a772b6cfb8a965d09ef5422e93d1a197ed827d1468eb64adda83f25d7` |

表示scaleはidleと同じ（body coreの直径が同一のため。smokeで差 < 1e-9）。

# Mask diagnostics

標準の`mask_limits`（1500 / 60 / 120）。Grip success専用の許容値は作っていない。global limitも変えていない。

| 項目 | 値 | 上限 |
|---|---|---|
| mask px | 2394 | ≥ 1500 |
| missed band px | 17 | ≤ 60 |
| fringe px | 47 | ≤ 120 |

- 塗り替えのruleの持ち主は`runtime_wrestler_recipe.json`だけ（`test_recolor_rule_is_owned_by_the_idle_runtime_recipe`）
- mask外のpixelは不変、alphaは反射と同一（test）
- 目視でも、肌・髪への塗り替えの漏れは無い

# Selector composition

```
selectWrestlerArt (gripSuccessGateArt.ts, ACTION-11D)
  pose === 'grapple' || pose === 'drive' -> GRIP_SUCCESS_GATE_ART[id]
  else -> selectWrestlerDisplayArt (gripAttemptGateArt.ts, ACTION-11A, unchanged)
            grip && reach -> Grip attempt gate
            else -> selectWrestlerPoseArt (Counter) -> selectWrestlerArt (Tsuppari / idle)
```

- 小さな純粋wrapperが1つだけ。既存のselectorは複製していない
- `WrestlerView`はpreloadに2枚を追加し、`this.show(selectWrestlerArt(this.idleArt, state))`で選ぶ
- 位置 / facing / textureごとのpivot・scaleは既存のまま。pair offset、追加の回転、timer、VFXは無い。影も不変
- Counterのrotation offsetはpose = counterのときだけ働くので、grapple中は0

# Neutral / Morozashi / Drive / Release（tick / frame単位の結果）

- 接触からのGrip（test S4）: attemptがちょうど`GRIP_MIN_ATTEMPT_TICKS` = 4 tick → grappleのtickで両者が同時にsuccess
  - smoke: blue `idle x1 > grip:attempt x9 > grapple:success`、red `idle x10 > grapple:success`。同じframeで切り替わる
- 突進からのGrip: 着地したtickに両者がsuccess（test）
- Morozashi: holder / disadvantagedとも同じsuccess texture（test S5、smoke 12）
- Drive（test S6 / S7、smoke 11）: `grapple x2 > drive x223 > grapple x57`のあいだ、ずっとsuccess。idleへのflickerは無い
- Release（test S8 / S9、smoke 13）: 最初のfreeのframeで、releaserは`grip/recovery:product-wrestler-blue`、相手はidle。success / attemptのtextureは出ない。recovery 12 tickの後はidle
- release後の新しいGrip: 再びattempt → success（test、smoke 14）

# Implementation Evidence

| Design Requirement | Implemented As | Verified By |
|---|---|---|
| exact source identity | recipeの`pixel_sha256` / `size` / `reviewed_file_sha256`。違えばfail closed | `test_user_source_identity`、`test_missing_or_changed_source_fails_closed`、Preflightの照合 |
| measured FRONT / root / body core | 既存landmark registrationを、このsourceで実測。front 160.2、root (662, 639)、core (481, 139)–(781, 971) | `test_recorded_measurement_is_reproducible`、`load_recipe`の垂直検査 |
| normalization | `et.normalize`（idleと同じ。FRONT = +X、root = pivot、body core = 2R、/4 downscale）。Scene側の補正は無い | `test_red_is_the_normalized_pose_and_blue_its_reflected_recolor`、TS metadataとexportの一致test、smoke 7 / 8 / 10 |
| red → blue | `aw.mirror_part`（local-Y反射1回）+ `im.mawashi_mask` / `im.recolor`。runtimeでの反転・塗り替えは無い | `test_only_one_local_y_reflection`、alpha / mask外不変のtest、TSのpivot反射test |
| temporary runtime paths | `public/assets/action/wrestler/grip-success-gate/red.png` / `blue.png`（2枚だけ）。permanentな`grip/`は使っていない | `test_exactly_two_files_from_the_one_red_pose`、`--check`、smokeの200応答 |
| grapple / drive-only selection | `selectWrestlerArt`: `pose === 'grapple' \|\| pose === 'drive'` | S1–S9 test、smoke 3 / 4 / 11 |
| attempt preservation | ACTION-11Aのselector・recipe・exporter・textureは不変。success以外は全部attemptのselectorへ渡す | `gripAttemptGateArt.test.ts` 12 PASS、attempt `--check`、attempt pixelの固定test、smoke 2 / 14 |
| neutral / Morozashi same pose | roleで分岐しない | S4 / S5 test、smoke 12 |
| release fallback | grapple終了 → pose grip/recovery または idle → idle sprite | S8 / S9 test、smoke 13 |
| gameplay unchanged | `src/game/sumo/`・`src/game/input/`のdiffは0行。Snapshotにも書き込まない | `git diff`が空、Snapshot不変test、Grip / GripContest / Drive / Orientation / PushChargeの128 test |
| Product art regression | idle / Tsuppari / Counter / Grip attemptのtexture・recipe・exporterは不変 | pixelの固定test、5 exporter `--check`、R1–R5 test、smoke 15 |

# Verification

| 項目 | 結果 |
|---|---|
| Grip success exporterのfocused test（`test_export_grip_success_gate.py`） | 18 / 18 OK |
| wrestler-art suite全体（`unittest discover -s tools/wrestler_art/tests`） | 203 / 203 OK |
| Grip success selectorのfocused test（`gripSuccessGateArt.test.ts`） | 12 / 12 PASS |
| Grip attempt selectorのtest（`gripAttemptGateArt.test.ts`） | 12 / 12 PASS |
| presentationのその他（Counter / Tsuppari / Kuzushi / visual state / idle art / HUD等） | 8 files、71 PASS |
| Grip / Grapple / Drive gameplay regression（BoutGrip / BoutGripContest / BoutDrive / BoutOrientation / BoutPushCharge） | 5 files、128 PASS |
| `pnpm test` | 29 files、498 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| Grip success exporterの決定性 | 2回続けて書き出し、`--check`（pixel + PNG byte）が一致。fixtureでも2つのdirectoryへの書き出しが同一byte（test） |
| `export_grip_success_gate.py --check` | ok（red / blue） |
| `export_grip_attempt_gate.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` / `export_counter.py --check`、`measure_tsuppari_pose.py --check` | すべてexit 0 |
| Product artが不変であること | `git diff`で`red.png` / `blue.png` / `tsuppari/` / `counter/` / `grip-attempt-gate/`に差分なし。pixelの固定test |
| `src/game/sumo/`・`src/game/input/`が不変であること | diffなし（`GRIP_REACH_TICKS = 8` / `GRIP_MIN_ATTEMPT_TICKS = 4` / `GRIP_RECOVERY_TICKS = 12`はそのまま） |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU（`--use-angle=d3d11`）、Vite dev server、1920x1080。

- 計測のために`WrestlerView.apply`を読み取り専用でwrapした
- Morozashiだけ、CPU dummyの`nextIntent`を1 tickだけ差し替えて、Counterを空振りさせた（Kuzushi）
- 撮影のために、grapple開始 / release直後のframeでsceneを一時停止した

結果は **16 / 16 PASS**:

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 | Shiftで、reachのあいだattempt pose | PASS（9 frame） |
| 3 | 接触で最小attemptの後、neutral grapple | PASS |
| 4 | 最初のgrapple frameで、両者が同時にsuccess texture。free中はsuccessが出ない | PASS |
| 5 | 体の回転 = canonicalなfacing。互いに相手を向く（A 0、B π） | PASS |
| 6 | bondの距離は0.70 mのまま | PASS |
| 7 | textureの切り替えで中心が跳ばない（body x/y = canonicalな位置、swap時の移動 0 px） | PASS |
| 8 | scaleが跳ばない（idle = success = 1.000000000625） | PASS |
| 9 | 頭の見え方 | 目視の所見を下に記載（User Visual Gateで判断） |
| 10 | pivotのoriginが正しく適用される（pivotのずれによる重なり無し） | PASS |
| 11 | Driveでsuccess textureが変わらない | PASS |
| 12 | Morozashi（holder = player）もsuccess texture | PASS |
| 13 | releaseで、最初のfree frameからidle | PASS |
| 14 | release後の新しいGripでattemptが出る | PASS |
| 15 | Tsuppari左 / Counter（最大35.00°）/ Kuzushiの汗 / Push（idle sprite）は不変 | PASS |
| 16 | Rでrestartできる | PASS |
| 17 | console error・例外・失敗requestが無い。success gateのPNG 2枚は200 | PASS |

最初の実行では2件がFAILした。どちらもscriptの問題だった:

- Phaserの回転は±πで折り返すので、角度を差の正規化で比べるよう直した
- 4xxの応答が1件あった。Task外の既存の`/favicon.ico` 404（`public/`にfaviconが無い）で、cacheを無効にした再現では出ない

Screenshot（ローカルのscratchpad `smoke11d\`、commitしない）:

- `01_neutral_immediately_after_success`
- `02_neutral_settled`
- `03_drive_while_grappled`
- `04_morozashi_grapple`
- `05_immediately_after_release`

目視の所見（判断ではなく観察）:

- 肩・腕は相手の体へ回り込んで見え、idle 2体が接するだけの形より、組んでいる形に近い
- 頭は横顔の向きで、組みの軸の上でほぼ鼻先同士が接している
  - 原因: blueはredのlocal-Y反射なので、向かい合ったペアは中央の垂線について鏡映対称になる。頭の左右のoffsetが両者で同じ側になり、頭が同じ高さで向かい合う
  - 「頭が互いに相手の肩の脇へずれて組む」形にはならない。現在の配置（offset無し）の構造上の性質で、Taskの指示どおり位置の補正は加えていない
- 自分の体との不自然な重なり・切れ目は見えない。中央で2人の頭の輪郭が少し重なる
- release直後は、2人ともidle spriteに戻る

# Changed Files

新規:

- `tools/wrestler_art/grip_success_gate_recipe.json`: source identity、測定値と根拠、標準のmask上限
- `tools/wrestler_art/export_grip_success_gate.py`: `export_grip_attempt_gate.py`と同じ構造の決定的なexporter（`--check`あり）
- `tools/wrestler_art/tests/test_export_grip_success_gate.py`
- `public/assets/action/wrestler/grip-success-gate/red.png`
- `public/assets/action/wrestler/grip-success-gate/blue.png`
- `src/game/presentation/gripSuccessGateArt.ts`
- `src/game/presentation/gripSuccessGateArt.test.ts`

変更:

- `src/game/scenes/WrestlerView.ts`: preloadにsuccessの2枚を追加し、選択を`selectWrestlerArt`（success wrapper）に替えた。header commentを更新
- `src/game/presentation/gripAttemptGateArt.test.ts`: WrestlerViewの配線を確かめるassertion 1行だけを、新しいwrapper名に合わせた（attemptのselectorの挙動のtestは不変）
- `docs/ARCHITECTURE.md`: 暫定（Visual Gate）のACTION-11D noteを1項目追加。ACTION-11Aのnoteで古くなった「成功はidle sprite」の1文を直した
- `tools/wrestler_art/README.md`: tool表に1行と、暫定の節を追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

変更していない:

- `src/game/sumo/`、`src/game/input/`
- Grip attempt / idle / Tsuppari / Counterのtexture・recipe・exporter
- `WRESTLER_PRODUCT_ART_SPEC.md`
- `PROJECT_HANDOFF.md`、`CURRENT_TASK.md`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- 既存の`/favicon.ico`の404（初回の読み込みでだけ出る）。Task外なので直していない

# Known Untested Items

- 実機のTouch入力、GPU以外の描画経路
- 見た目の受け入れ（下のUser Visual Gate）

# User Visual Gate: REQUIRED

主な問い: 今のbondの距離で、redのsuccess poseと反射したblueが向かい合ったとき、「idleの2人が触れている」ではなく「組み合っている / Grip success」に見えるか。

見てほしい点:

- 頭の位置が組んだ形に見えるか。今は横顔が軸の上で向かい合う（上の所見を参照）
- 肩・胸のシルエットが、より密に組んでいると感じるか
- 反射したblueは自然か、red / blueのペアとしてまとまっているか
- pivot / scaleの切り替えが気にならないか
- 0.70 mのbondの距離が、このartで見た目として許容できるか
- Drive中もsuccess artが自然か
- Morozashiで同じ仮のposeを使うのは許容できるか
- attempt → successの遷移、release → idleの遷移が分かりやすいか

組んで見えない場合の次のTaskの候補（今回は実施しない）:

- pair内のpresentation offset
- success poseの改良（反射のペアが鏡映対称になる点を含む）
- 手の跡のVFX

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`art(action): add grip success visual gate`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
