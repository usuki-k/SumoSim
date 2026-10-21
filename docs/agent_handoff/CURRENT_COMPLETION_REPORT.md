Task-ID: ACTION-07C-TSUPPARI-ART-VISUAL-GATE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 7b38c3ac3cef62115a7082f824b3eb56f29493d5
Agent-Start-Head: ecdebc8e365f678b76ef09dd1a12cc0e972f6a85
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Browser Smoke 38/38 PASS。Tsuppari artの方式は未選択で、User Visual Gateが必要）。

- User提供の4枚の候補PNGから、比較できるTsuppari Art Visual Gateを作った
  - 3方式（SEPARATE / MIRROR-L / MIRROR-R）× red / blue × 左右 = 12枚のruntime texture
  - 生成は決定的なtoolとrecipeで行い、出力は `public/assets/action/wrestler/tsuppari-gate/`
- browserでは、key `4` で3方式を切り替える。presentationだけの切り替えで、key 0のdebug行に `TSU ART: SEPARATE` などと表示する
- Tsuppariの行動中（startup / active / recovery の全体）は、押した手のposeを1枚で保持する。行動が終われば、承認済みのidle spriteに戻る
- ACTION-07Bのgameplayは変えていない（`src/game/sumo/`、`src/game/input/` の差分は0行）。idleの `red.png` / `blue.png` も不変
- 3方式のどれも、受理済みとして扱っていない

# Preflight

- 1回目の開始指示では、required pathの4枚が無かった（実体は `*.png.png` の二重拡張子）。Preflight STOPとして、repositoryには何も書かずに報告した。Userがリネームした後に再開した
- 再開時: working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `7b38c3a`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `7b38c3a..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `ecdebc8`

## 4枚のlocal input（`tools/wrestler_art/input.local/`、commitしない）

すべて1254×1254、PNG RGBA。透過は使える（alpha 0 の画素が68〜71%。不透明部の分布は承認済みの `wrestler_red.png` と同じ傾向）。

| file | bytes | file SHA-256 | decoded RGBA pixel SHA-256 |
|---|---|---|---|
| candidate_red_tsuppari_left.png | 750,627 | `24a00ca64c448dcd53c1705e424a3d893fb57bc07893cfdebcc02cd26fb917af` | `219d66dcf13585e7149382f01c964fdd9074bf61e615b5d3f9bbb15b38cb84b3` |
| candidate_red_tsuppari_right.png | 759,683 | `f94a6e5a084f08194a3d97f2a498958ed32644edfcc73e6f4d2bdf5ecbc9fc8b` | `d0e6070e2359a8309b07e7c3d76eba905c50fd379cf7e4b4d50bf14c1816d33b` |
| candidate_blue_tsuppari_left.png | 737,222 | `1b4763367b27f7ad788825e5fec916a97ccd7300e44522177c6c021ba0af5f2b` | `060bfbf4319ed4fbb79d030f9dc6ae90c378f5b8968a28a8ad1d195913e68777` |
| candidate_blue_tsuppari_right.png | 702,315 | `b5a9d8ef8dbe2e211b662479d6ba1a414e0b96005b6b8d5237ed828675bf9345` | `17782b1155f86ad249f4af1a3704f3ea34f89a6e0e06b86447b924f47f4a1071` |

Toolは、recipeにあるpixel SHA-256との一致を確かめる。一致しなければ、何も書かずにexit 2で止まる。

# Normalization Measurements

方法（`tsuppari_gate_recipe.json` の `measurement`）:

- 各poseの体を、承認済みのidle red masterに合わせる。sourceの1/2 scaleで、胴体のlandmarkを2つ測った
  - H = 髪の塊の重心（暗い不透明画素を7 pxで収縮して輪郭線を除き、最大の成分）
  - B = まわしの重心（hue bandに入る画素のうち、最大成分の5%以上の成分すべて）
- 回転差 = angle(H→B) − idleのangle(H→B)
- scale s = 平均(√髪の面積比, √まわしの面積比)
- idleのroot / body coreの点を、H/Bの中点を中心に s·Rot(差) で運ぶ。`source_front_deg` = idleの160.7 + 回転差
- idleの値はそのまま流用していない。候補の体は、idleより右に50〜120 px（source px）ずれていた

最初は、まわし+髪のIoUを最大にする相似変換を試した。しかし、回転が探索範囲の端（−12°）に張り付いた。overlayで見ても誤りだったため、使っていない。

| pose | 役割 | front (deg) | root (source px) | body core (source px) | 回転差 | s |
|---|---|---|---|---|---|---|
| red_left | runtime source | 160.7 | (704, 620) | (575, 253)–(790, 864) | −0.05° | 1.025 |
| red_right | runtime source | 160.1 | (768, 640) | (637, 281)–(854, 880) | −0.61° | 1.009 |
| blue_left | referenceだけ | 26.4 | (567, 642) | (736, 303)–(456, 867) | +7.05°（左右反転したidle基準） | 0.996 |
| blue_right | referenceだけ | 29.7 | (583, 639) | (762, 326)–(464, 848) | +10.39° | 0.952 |

正規化はidleと同じ03Aの手順で行う。全体の1回回転 → body core = 2R → master /4。limbのwarp、骨格の操作、塗り直しはしていない。

runtimeでの照合（runtime px、idle redとの差。preview `tsuppari_gate.json`）:

- red_left: 髪 (+0.02, +0.05)、まわし (−0.03, +0.16)。ほぼ完全に一致
- red_right: 髪 (−1.9, −1.0)、まわし (+2.0, +0.7)。2 px程度
- body coreは、全12枚が123.0769 px（= idleと同じ2R。runtime scaleは1.0）

# Hand / Reflection Mapping（全runtime texture）

規約: local +X = FRONT、+Y = wrestlerのRIGHT。local-Yの反転 `(x, y) → (x, H − y)` で手が入れ替わる。

- source側の手は絵で確かめた。red_leftは画面下側の腕を伸ばしている（idleと同じく左向き）＝本人の左手。red_rightは上側の腕＝本人の右手
- runtimeでも確かめた。red_leftの伸ばした手は −Y、red_rightは +Y にある
- recipeのloaderは、各textureについて「masterの手 XOR 反転」がtextureの手と一致することを検査する。違えば拒否する

| texture | separate | mirror_l | mirror_r |
|---|---|---|---|
| red left | red L | red L | red R 反転 |
| red right | red R | red L 反転 | red R |
| blue left | red R 反転 + recolor | red L + recolor（二重反転 = 恒等） | red R 反転 + recolor |
| blue right | red L 反転 + recolor | red L 反転 + recolor | red R + recolor |

同じ導出のfileは同一のpixelになる（自動Testで確認）:

- separate_red_left = mirror_l_red_left
- separate_red_right = mirror_r_red_right
- separate_blue_right = mirror_l_blue_right
- separate_blue_left = mirror_r_blue_left

authored blueの2枚は、比較sheetにだけ使った。runtime textureの元にはしていない（exportはred 2枚しか読まない。自動Testで確認）。

# Recolor / Mask Result（poseごと、runtime scale）

規則は、承認済みのred→blue（`runtime_wrestler_recipe.json` が唯一の持ち主）。hue band + 最大の4連結成分。alphaは保つ。mask外の画素は変えない（自動Testで全画素を照合）。

| source | mask px | 最大成分の外のband px | fringe px | 結果の手 |
|---|---|---|---|---|
| red_left | 2239 | 17 | 48 | left |
| red_left 反転 | 2239 | 17 | 48 | right |
| red_right | 2265 | 10 | 61 | right |
| red_right 反転 | 2265 | 10 | 61 | left |
| （参考）承認済みidle | 2196 | 16 | 67 | — |

- 肌、腕、髪への混入は無い（`mawashi_mask_diagnostics.png` で目視確認）。まわしの取り残しも無い
- source解像度では、red_rightの帯の下半分が別の成分に分かれる。しかしmaskをかけるruntime scaleでは1つの成分になり、問題は出ない
- recipeの `mask_limits`（mask ≥ 1500、外のband ≤ 60、fringe ≤ 120）で、poseごとにfail-closedで検査する

# Runtime Visual-Gate Assets

`public/assets/action/wrestler/tsuppari-gate/` の12枚（`export_tsuppari_gate.py` だけが書く）:

| file | size | pivot |
|---|---|---|
| separate_red_left / mirror_l_red_left / mirror_l_blue_left | 198×177 | (83, 94) |
| separate_blue_right / mirror_l_red_right / mirror_l_blue_right | 198×177 | (83, 83) |
| separate_red_right / mirror_r_red_right / mirror_r_blue_right | 197×205 | (79, 88) |
| separate_blue_left / mirror_r_red_left / mirror_r_blue_left | 197×205 | (79, 117) |

pixel SHA-256（exportの出力）:

- separate_red_left `ab5043bf…3f2f`、separate_red_right `633ecd86…a5b1`、separate_blue_left `83efd9c7…99b6`、separate_blue_right `c9369b4b…b1ef`
- mirror_l_red_right `b5ee0bfb…0833`、mirror_l_blue_left `11625cc7…b194`
- mirror_r_red_left `d0aae241…45c9`、mirror_r_blue_right `082f9479…d836`
- 全文は `export_tsuppari_gate.py --check` の出力に出る

texture sizeは揃えていない（Taskのとおり）。各textureが自分のpivotとbody coreを持つ。

# Presentation State Ownership

- `TsuppariArtMode = 'separate' | 'mirror-left' | 'mirror-right'`: 新しいpure module `src/game/presentation/tsuppariGateArt.ts` が持つ。Phaserにも `BoutSimulation` にも依存しない
- 現在のmodeは `BoutScene.tsuppariArtMode` が持つ（Scene内のpresentation状態）
  - key `4` → `nextTsuppariArtMode`
  - Rでrestartしてもmodeは保つ（presentationの選択なので）
- 流れ: `Snapshot → resolveWrestlerVisualState`（既存。`pose === 'tsuppari'` と `tsuppariHand`）→ `selectWrestlerArt(idleArt, visual, mode)` → `WrestlerView.show(art)`
  - textureが変わったときだけ、setTexture / setOrigin（そのtextureのpivot）/ setScale（そのtextureのbody core）を行う
- 位置と回転は、これまでどおりSnapshotのcenter / facingをそのまま使う
- Simulation、Snapshotの型、gameplayの値は一切変えていない

# Mode Toggle Key

`4`（Current Sourceでは未使用）。key 0のdebug表示で、左下の行の先頭に `TSU ART: SEPARATE / MIRROR-L / MIRROR-R` と出る。操作ヘルプ行に `4 tsu art` を足した。

# Changed Files

- `tools/wrestler_art/tsuppari_gate_recipe.json`（新規）: Visual-Gateのrecipe。測定値、hand mapping、mask_limits、preview設定
- `tools/wrestler_art/export_tsuppari_gate.py`（新規）: 決定的なexportと `--check`
- `tools/wrestler_art/preview_tsuppari_gate.py`（新規）: offlineの比較sheet
- `tools/wrestler_art/tests/test_export_tsuppari_gate.py`（新規）: 19件
- `tools/wrestler_art/README.md`: 表に1行、ACTION-07Cの節を追加
- `public/assets/action/wrestler/tsuppari-gate/*.png`（新規12枚）
- `src/game/presentation/tsuppariGateArt.ts`（新規）、`src/game/presentation/tsuppariGateArt.test.ts`（新規、7件）
- `src/game/scenes/WrestlerView.ts`: gate textureのpreload、poseに応じたtexture / origin / scaleの切り替え
- `src/game/scenes/BoutScene.ts`: key 4、`tsuppariArtMode`、debug行の表示、`apply` へmodeを渡す
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Files Explicitly Not Changed

- `src/game/sumo/*`（BoutSimulation、BoutTypesなど）、`src/game/input/*`
  - Push / Tsuppariの力、reach、cooldown、timing、buildup、Counter、組の力、ring-out、Grip / Drive は変えていない
- `public/assets/action/wrestler/red.png` / `blue.png`（`export_runtime_wrestlers.py --check` OK。pixel `d66895bf…` / `9d5feead…` は承認値のまま）
- `runtime_wrestler_recipe.json`、`productWrestlerArt.ts`、`docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `CURRENT_TASK.md`、`PROJECT_HANDOFF.md`
- `input.local/` のfile（commitしていない）

# Verification

| 項目 | 結果 |
|---|---|
| focused wrestler-art test（`test_export_tsuppari_gate.py`） | 19 / 19 PASS（合成fixture、および実際の候補での committed `--check`、TSのmetadata一致、mask値、idle不変、previewの決定性） |
| full wrestler-art suite（`unittest discover`） | 144 / 144 PASS |
| focused presentation test（`tsuppariGateArt.test.ts`） | 7 / 7 PASS（mode循環、12 file、pivot / scale、hand mapping、全行動中の保持とidleへの復帰、Snapshot不変、Phaser-free） |
| `pnpm test` | 347 / 347 PASS（22 files） |
| `pnpm build` | PASS（`tsc && vite build`。chunk sizeの警告は以前からのもの）。dist に12枚がコピーされる |
| `git diff --check` | PASS（新規fileも含む） |
| 決定的な再生成 | exportを再実行 → 12枚の file SHA-256 が完全一致。`--check` OK |
| idleの `red.png` / `blue.png` 不変 | `export_runtime_wrestlers.py --check` OK、git diffなし |
| Simulationのgameplay file不変 | `git diff -- src/game/sumo src/game/input` = 0行 |

# Browser / Runtime Smoke

方法:

- `pnpm dev` + headless Chrome（CDP、SwiftShader）
- Vite devでは同じmoduleを共有するので、`import('/src/game/scenes/WrestlerView.ts')` で `WrestlerView.prototype.apply` を読み取りだけで包んだ。毎frame、表示中のtexture key、origin、scale、位置、回転と、Snapshotのcenter / facingを記録した
- 待ちは、壁時計ではなくSimulationの状態で行った
- script: scratchpadの `smoke_07c.mjs`。結果は `smoke/smoke_07c_results.json` とscreenshot 10枚

結果: **38 / 38 PASS**（3回目の実行。1〜2回目のFAILは、どれもscript側の原因だった。固定待ちによるcooldown中の押下、決着後の操作確認、faviconの404 を直した）。

| 確認 | 結果 |
|---|---|
| gate textureが12枚とも読み込まれる | PASS |
| pre-boutが動く（Simulationは進まない） | PASS |
| pre-bout中のkey 4: SEPARATE→MIRROR-L→MIRROR-R→SEPARATE、Snapshotは不変 | PASS |
| Enterで開始。debug行に `TSU ART: SEPARATE`、ヘルプに `4 tsu art` | PASS |
| 3 mode × ArrowLeft / ArrowRight: Tsuppariの全frameで、押した手の `<mode>_blue_<hand>` が出る（startup / active / recoveryを観測） | PASS（6 / 6） |
| 行動の後は `product-wrestler-blue` に戻る | PASS（6 / 6） |
| 全frameで、image位置 = Snapshot center、rotation = facing。scaleはidleもposeも1.0 | PASS |
| bout中にmodeを切り替える: 同じframeのSnapshot JSONが完全に同じ | PASS（3 mode） |
| dummy mode 3: CPUのTsuppariで `separate_red_left / right` が出る | PASS |
| Push / Counter / Grip（組みに入る）が使える | PASS |
| idle / moveはidle spriteのまま | PASS |
| R restart: pre-bout、位置 −0.7、buildup 0、art modeは保つ | PASS |
| console error / 失敗したrequestが無い（faviconの404だけ除外。以前からある） | PASS |

screenshot（`smoke/03_<mode>_blue_<hand>.png`）で、pose spriteが実際に描かれていることを確かめた。

# Offline Preview Output

`tools/wrestler_art/output-tsuppari-gate.local/`（git-ignored、約7秒）:

- `pivot_guide_red_left / red_right / blue_left / blue_right.png`: 正規化したsourceとpivotのguide（authored候補4枚）
- `mode_separate.png`、`mode_mirror_l.png`、`mode_mirror_r.png`: 各modeのred / blue × 左右と、idle
- `idle_tsuppari_alignment.png`: 12枚それぞれに、同じ色のidleの輪郭（cyan）を重ねたもの
- `rotations_<mode>.png`: 0 / 45 / 90 / 180 / 270°
- `faceoff_<mode>.png`: 0.70 m（接触）と0.875 m（Tsuppariの到達閾値）。blue L / R、red L / R、両者L、両者R
- `mawashi_mask_diagnostics.png`: 4つの導出ごとに、source、mask、recolor後
- `blue_reference_vs_derived.png`: authored blueの参照、各modeの派生blue、idle blue
- `tsuppari_gate.json`、`build_tsuppari_gate_manifest.json`（timestampなし）

# Authored-Blue-Reference Comparison Findings

- 青の色調: 派生blueのまわし（hue 215.9°、sat 0.887、value p50 0.447）は、承認済みidle blue（215.8° / 0.870 / 0.451）とほぼ同じ。authored参照（215–216° / 0.96–0.98 / 0.51–0.52）よりは少しだけ暗く、彩度も少し低い。これはidleで受理した色と同じ傾向
- 体型とシルエット: separateの派生blue（red Rの反転 / red Lの反転）は、authoredの参照と腕の向き、体の太さ、頭の位置がほぼ同じに見える。red-masterからの導出で、目に見えて悪くなった点は見つからなかった
- 反転による問題: 単体のspriteで、反転が明らかに破綻している所は無い。ただし、下の「modeごとの注目点」にある「頭がidleと逆側に出る」点がある
- authored参照のregistrationは、回転差が+7〜+10°と大きい。参照の絵は、もともと胴体の向きが少し違う（参照だけの話で、runtimeには影響しない）

## User Visual Gateで判断してほしい点（観察した事実。採否は判断していない）

- **mirror modeでの頭の跳び**: idleの頭は、local +Y側（本人の右前）に描かれている（runtimeで +25.8 px）
  - mirror_lのred right / blue left、mirror_rのred left / blue right は、反転の有無がidleと逆になる。そのため、切り替えた瞬間に頭が反対側（約52 px ≈ 0.3 m）へ移る
  - separateでは、全12枚で頭の側がidleと一致する（`idle_tsuppari_alignment.png`）
- **authored red Rの向き**: 突き出した手の先は、red_leftでは真正面（local −0.3°、1.76R）にある。red_rightでは、本人の右前へ斜め（+46°、2.4R）に出ている
  - SEPARATEでは、左右で打つ方向が非対称に見える
  - MIRROR-Rでは、両手とも外側の斜めに打つ
  - MIRROR-Lでは、両手とも正面へ打つ
- poseは、Tsuppari全体（16 tick ≈ 267 ms）で保持する。保持として読みやすいか、長すぎるかは、User Play Testで判断してほしい

# Design Deviations

Design Deviations: NONE

Taskの範囲内で、細部として決めたもの:

- art modeの表示は、Taskの推奨どおりdebug UIの中に置いた
  - 操作ヘルプ行に足すと1920 pxを超える。そのため、毎frame更新している左下のTsuppari debug行（y = 944）の先頭に出す
  - key 0がoffのProduct表示では見えない
- 正規化の測定は、idle masterへのlandmark照合にした（方法と値はrecipeに明記）。IoUで相似変換を合わせる方式は、誤った回転になったため使っていない
- blue参照は比較のために正規化した。左右反転したidle redに対して測っているので、参照のためだけにidle blueの03A sourceを使うことはない
- recipeのmode keyは `mirror_l` / `mirror_r`（file名に合わせた）。TSの型は、Taskの例どおり `'mirror-left' | 'mirror-right'`
- 一時的なgate textureの寸法は、TSのmetadataに表で持つ（`productWrestlerArt.ts` には混ぜない）。Python testで、新しいexportとの一致を検査する

# Unexpected Scope

- dev serverで `favicon.ico` が404になる（以前から。今回は直していない）
- build時に、chunk sizeが500 kBを超えるという警告が出る（以前から。Phaserのbundle）

# Known Untested Items

- 実機のUser Play Test（Game Feel、見た目の評価）。headlessのsmokeは、texture選択と配置の正しさまでしか確かめていない
- 実ブラウザの通常のframe rateでの見え方（headless SwiftShaderでは、16 tickの行動が3〜18 frameで描かれた）
- Touch入力（このTaskの範囲外。key 4はkeyboardだけ）

# User Visual Gate

**User Visual Gate: REQUIRED**（Product Tsuppari artの受理は主張しない）

手順:

1. `pnpm dev` → Enter
2. 0でdebug表示 → 4で方式を切り替え（左下に `TSU ART:` が出る）
3. 3でdummy mode 3（CPUが繰り返しTsuppariを打つ）。自分はArrowLeft / ArrowRightで打つ

各方式で見てほしい点:

- 左右の手が分かるか
- idle → poseで体の位置、大きさ、向きが跳ばないか（特にmirrorで頭が逆側に出る点）
- reachがそれらしく見えるか（red Rの斜めの突き）
- 派生blueの色と形
- リズムやimpactを判断できるくらい見えるか
- 全行動の保持が読みやすいか、長すぎるか

選んだ方式を、後続Taskで `WRESTLER_PRODUCT_ART_SPEC` とruntimeの契約へ昇格させるかどうかは、Userが決める。

# Git Delivery

- Task-ownedのfileだけを明示的にstageし、1 commit（`feat(art): add tsuppari visual gate`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → working tree clean
