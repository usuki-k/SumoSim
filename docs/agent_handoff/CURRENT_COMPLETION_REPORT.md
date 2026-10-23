Task-ID: ACTION-11L-GRIP-SUCCESS-AUTHORED-FOREARM-HAND-GATE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 809d530321e4042c607f3784a39e2d10a22de9a5
Agent-Start-Head: 90ed63f67434a3117f27a0b1cff92b390da8e27a
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、exporterの決定性と`--check`、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

ACTION-11Kの手続き的な記号を、Userが描いた前腕 + 拳の絵1枚（1枚目）に置き換えた。

- 力士ごとに2つ、自分のまわしの上に「相手の両手」として重ねる。READYのpairで計4つ
- 各markerは、拳がまわしに乗り、前腕がまわしの帯を約37°で横切る
- 体とはつながらない記号のまま
- ACTION-11JのpairのREADY規則（どちらかがTURNINGなら全部隠す）は維持した
- gameplay、Grappled Orientation、canonicalな位置・bond・facing、ACTION-11Fのcompression、ACTION-11Hのtone補正、力士の体のassetは変えていない

# Preflight / Source identity

- 1回目の開始: `input.local/candidate_grip_forearm_hand_symbol.png`が無く、STOPした（Repositoryには何も書いていない）
- 2回目: 置かれた画像のdecoded RGBAが`5156e298…`で、期待値と違ったのでSTOPした
- 3回目（今回）:
  - working tree clean、`HEAD...origin/develop` = `0 0`
  - Remote CURRENT_TASK: Task-ID一致、Status READY、Source-Baseline `809d530`（ancestor）、Handoff-Mode GITHUB
  - 1回目の時点で、`809d530..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけだったので、`merge --ff-only` → `90ed63f`にしてある

| 項目 | 値 | 判定 |
|---|---|---|
| path | `tools/wrestler_art/input.local/candidate_grip_forearm_hand_symbol.png`（commitしない。`git check-ignore`で確認） | 存在 |
| size / mode | 1536 x 1024 RGBA | 一致 |
| decoded RGBA SHA-256 | `2f00cba4d6256028fdbd3c545eb5c7923d030d89881a5f3680efe00c67b0dba1` | 一致（正） |
| PNG file SHA-256 | `5f59a0c97e642cbdef3d5ae087ac5abc56e12ebbaff2279d9ca5848373b6543b` | 一致 |

使ったsourceはこの1枚だけ。2枚目・3枚目の拳、再生成、ACTION-11Kの記号は使っていない。

# Source alpha / crop diagnostics

- alpha: 範囲0–254（255の画素は無い）。透明な画素は975,343、半透明〜不透明な画素は597,521
- 背景は透明で、グローのような半透明の縁は無い（緑の背景に合成して確認）
- alpha > 8の範囲（bbox）: (52, 94)–(1510, 991)。recipeに記録し、exporterが毎回照合する
- 切り出し: bbox + 余白16 px → (36, 78)、1504 x 944（1/16で割り切れるよう、右下に透明な余白を足した）
- 縮小: premultiplied（alphaを掛けた色）でBOX 1/16 → runtime 94 x 59
- 色: 再着色・tone補正・sharpen・blurは無い
  - alpha 254でのpremultipliedの往復で、RGBは最大±1動く
  - 実画像では、完全に不透明な832 blockで、runtimeの色と元のblockの平均色の差は最大1.57（丸めの範囲）

# Anchors

sourceから1回だけ、目視で1 px単位に測った。

| | source px | runtime px（authored） | runtime px（mirrored） |
|---|---|---|---|
| 拳の中心（hand） | (290, 752)。拳の輪郭の範囲の中央 | (15.875, 42.125) | (15.875, 16.875) |
| 肘（elbow） | (1207, 567)。前腕の軸上で、内側の肘の折れ目(1133, 400)と外側の肘の角(1280, 733)の中点 | (73.1875, 30.5625) | (73.1875, 28.4375) |

- runtime = (p − 切り出しの原点(36, 78)) / 16。mirroredは y → 59 − y
- anchorはtextureの内側にある（test A5）
- 拳と肘を画像上で安全に特定できたので、Stop条件には当たらない（`forearm_anchors.png`）

# Runtime assets（2 variant）

| file | size | pixel SHA-256 | file SHA-256 |
|---|---|---|---|
| `public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png` | 94 x 59 | `c1c171a21aa9d9050d89456aac7d4910d088b9ae5a0c666c695d01340dbd5ebb` | `d94b717f1c066e89af64742082340b0b1c3a996e13f76bc2ceafd0c30244d40e` |
| `.../forearm_hand_mirrored.png` | 94 x 59 | `8fb61adf1e1a573c4bab91f442351d3a845c0cac419e32dfce60e5036cd961ea` | `e97a9f3fe7a3548e262662566c82ff565fe28df215c2640645ce3e638cbbacfe` |

- 同じsource 1枚から、offlineで決定的に作ったvariantを2つ使う（mirroredは上下反転）
- runtimeで毎frame反転することはしない

mirrorを使う理由（offline比較`markers4_a.png`）:

- 絵の上腕部分は、肘から片側へ曲がっている
- 両側に同じ向きの絵を使うと、片側の上腕が体の外へ突き出す
- 右 = 元の向き、左 = 反転、にすると、両側とも上腕の端が体の縁に沿って前へ回り込む

# Four-marker layout

markerが乗る力士のlocal座標。R単位、+forward = FRONT、+lateral = 力士の右。

| marker | 拳（hand） | 肘（elbow） | texture | 肘→拳 | まわし（local横軸）との角度 |
|---|---|---|---|---|---|
| RIGHT | (−0.45, +0.62) | (−0.03, +1.18) | authored | **0.70 R** | **36.87°** |
| LEFT | (−0.45, −0.62) | (−0.03, −1.18) | mirrored | **0.70 R** | **36.87°** |

- 数: 1人あたり2つ → READYのpairで**4つ**
- 各`WrestlerView`は、自分の腰に乗る2つ（= 相手の両手）を描く
- 拳の位置: 後ろ半分の腰（まわし）の左右。体の内側（中心から0.77 R）
- 置き方:
  - textureのoriginを拳のanchorにする。拳がまわしの点に固定され、回転・拡大しても拳はずれない
  - 回転 = canvas上の肘→拳の角度 − texture上の肘→拳の角度
  - 拡大 = 0.70 R / textureの肘–拳の距離（R = 61.54 pxで0.7368倍、肘–拳43.08 px）
- 置く基準は、表示上の体の中心（canonical + ACTION-11Fのoffset）とcanonicalなfacing
- depth 2.3（体2の上、Kuzushiの汗2.5の下）。1層だけで、動的なsortは無い

Taskの初期値との違い（Design Deviationsを参照）:

- Taskは、拳(−0.45, ±0.62)と肘(−0.15, ±1.02)を初期値として示している。この2点の距離は0.50 Rで、同じTaskの必須条件「肘→拳 0.65–0.75 R（目標0.70）」と両立しない
- 拳の位置と角度（36.87°）はそのままにして、肘を同じ方向へ伸ばし、長さを0.70 Rにした → 肘は(−0.03, ±1.18)

# Rendering / ownership changes

- ACTION-11Kの手続き的な描画を削除した: `ensureGripSymbolTexture`（`Graphics.generateTexture`）と、肌・影・highlight・輪郭の色の定数
- `WrestlerView`:
  - preloadに、marker artの2枚を追加
  - 力士ごとにmarkerのimageを2枚（originは拳のanchor）
  - `apply`で`gripMarkerPlacement`の位置・回転・拡大を当てる
- `gripSuccessSymbolVfx.ts`: ACTION-11Kのpure helperを置き換えた
  - 中身: art metadata（`GRIP_MARKER_ART`）、4-markerの配置（`GRIP_SUCCESS_MARKERS`）、長さ / 角度、`gripMarkerPlacement`
  - pair READYの判定`gripSuccessPairSymbolVisible`は引き継いだ
- 経路（`BoutScene`が両者のvisual stateを`apply`へ渡す）は、ACTION-11Jのまま

# ACTION-11F / 11H / gameplay unchanged

- `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14` / `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.2`は不変（`gripSuccessGateArt.ts`のdiffは0。test P1）
- ACTION-11H: `grip-success-gate/`のtexture、`grip_success_gate_recipe.json`、`export_grip_success_gate.py`のdiffは0。`--check` ok
- `src/game/sumo/`・`src/game/input/`のdiffは0
- Snapshotは不変、bondは0.70 m（test P3 / P4、smoke 6 / 16b）
- 力士の体のasset（idle / Tsuppari / Counter / Grip attempt / Grip success）は不変
  - 新しいassetは`grip-symbol-authored-gate/`の2枚だけ
  - pixel固定test、6 exporterの`--check`で確認した

# Tests

TS `src/game/presentation/gripSuccessSymbolVfx.test.ts`: 15 / 15 PASS（ACTION-11Kのtestを置き換えた）

| ID | 内容 |
|---|---|
| art | authored / mirroredの2枚。mirroredのanchorは上下反転した値。anchorはtextureの内側。他のtexture key / pathと重ならない。preloadされる |
| G1 / G2 | 力士あたり2つ（RIGHT = authored、LEFT = mirrored）→ READYのpairで4つ。ACTION-11Kの手続き描画は無い |
| G3 | 左右の拳はまわしの反対側。後ろ半分、体の内側。左は右の鏡像 |
| G4 / G5 | まわしに対して30–45°（36.87°）、肘→拳は0.70 R。textureの肘–拳 × scale = 表示上の長さ |
| G6 | facing 0 / π/2 / π / −π/2: 拳・肘が剛体として回る。textureの肘anchorを、拳の周りに回転・拡大すると肘の点に一致する |
| G7 | pairの4つの拳は決定的で、互いに0.8 Rより離れる |
| anchor | 表示上の中心（ACTION-11Fのoffset込み）に置かれる |
| V1–V3 | READYのneutral / Drive（40 tick、flickerなし）/ Morozashiで4つ |
| V4 | どちらかがTURNING → 0。数は常に0か4で、READYになった同じtickで4つ出て、以後消えない |
| V5 / V6 | Grip attempt中、releaseのtick、recoveryで0 |
| V7 | idle / Push / Tsuppari / Counter / Kuzushiで0 |
| P1 / P3 / P4 | Snapshot不変、bond 0.70 m、ACTION-11Fの定数不変 |
| ownership | Phaser / Simulationに依存しない。depth 2 < 2.3 < 2.5、pair判定、表示上の中心からの配置、originが拳anchorであること（source assertion） |

Python `tools/wrestler_art/tests/test_export_grip_forearm_hand_gate.py`: 13 / 13 OK

| ID | 内容 |
|---|---|
| A1 | sourceのidentity（recipe）。sourceが無い / 違えばfail closed |
| A2 | 決定的: 2つのdirectoryへの書き出しが同一byte |
| A3 / A6 | 出力 = 切り出し + premultiplied BOX縮小だけ（参照pipelineとbyteが一致）。alphaは元のalphaのBOX平均（±1）。内部の色は元の色（±1）。mirroredは上下反転だけ |
| A4 | `--check`が、変わった画素・無いfileを検出する。実際にcommitしたtextureのpixel hash |
| A5 | anchorの対応（(p − 原点) / 16、反転のy）、textureの内側 |
| 他 | recipeの不正（anchor欠落、範囲外、縮小率、出力名）でfail。実画像の切り出し(36, 78, 1540, 1022)とalphaの範囲。TS metadata（寸法・anchor）がexportと一致。sourceはignore、runtimeはignoreされない。idle / Grip success / Grip attemptのtextureは不変 |

# Verification

| 項目 | 結果 |
|---|---|
| 新しいexporterのfocused test | 13 / 13 OK |
| wrestler-art suite全体 | 222 / 222 OK |
| exporterの決定性 | 書き出しを2回繰り返して`--check`が一致（pixel + PNG byte） |
| `export_grip_forearm_hand_gate.py` / `export_grip_success_gate.py` / `export_grip_attempt_gate.py` / `export_runtime_wrestlers.py` / `export_tsuppari.py` / `export_counter.py --check` | すべてexit 0 |
| markerのfocused test（TS） | 15 / 15 PASS |
| `pnpm test`（Grip success / attemptのpresentation、Grip / Grapple / Drive / Orientationのgameplay、Push / Tsuppari / Counter / Kuzushiのpresentationを含む） | 30 files、520 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`、体のasset、Grip successのrecipe / exporterのdiff | 0行 |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU、Vite dev server、1920x1080。ACTION-11Kのscriptで、記録と判定を「力士あたり2つのmarker」に置き換えた。

- 判定の内容: 全frameで、textureのkey・拳の位置・回転・拡大・depthを期待値と比べる

結果は **27 / 27 PASS**。

| 項目 | 結果 |
|---|---|
| L1 | Grip attempt中はmarker無し |
| L2 | neutralの最初のframe + 落ち着いた後: 4つ表示。textureのkeyが正しい（読み込みに失敗していない）。拳 = 期待した点（< 1e-6 px）、回転（< 1e-9 rad）、scale 0.7368 = 肘–拳43.08 px = 0.70 R |
| L3 | 描画順が安定: 体2 < marker 2.3。display listの順序も全frameで不変 |
| L4 / L5 | Drive（283 frame）、Morozashi（215 frame）で常に4つ |
| L6（TURNING） | TURNINGの132 frameは0。最初のREADY frame（index 132）から4つ同時に表示され、以後消えない（518 frame） |
| L7 / L8 | releaseの最初のfree frameから0。後の新しいGrip attemptにも残らない |
| L9 | Push / Tsuppari / Counter / Kuzushi（600 frame）でmarker無し |
| その他 | ACTION-11Fのcompression / bond 0.70 m / scale / pivot / 影 / 体の描画順、Tsuppari / Counter 35° / Kuzushiの汗 / Push、R restartは不変。console error・例外なし（既存の`/favicon.ico` 404は除外） |

## Screenshots（ローカルのscratchpad、commitしない）

8枚と一覧: `smoke11l\`

- `01_neutral_immediately_after_success`（READY、4つ）
- `02_neutral_settled`（READY、4つ）
- `03_drive_while_grappled`（READY、4つ）
- `04_morozashi_grapple`（READY、4つ）
- `05_immediately_after_release`（0）
- `06_turning_immediately_after_success`（TURNING、0）
- `07_turning_mid`（TURNING、0）
- `08_turning_settled`（READY、4つ）
- 一覧（2倍拡大）: `pair_sheet.png`
- neutralの拡大: `zoom_02.png`
- before / after（左ACTION-11K、右ACTION-11L、同じ切り出し）: `before_after_11k_11l.png`
- 準備の証拠: `forearm_on_green.png`（透過の確認）、`forearm_anchors.png`（anchor）、`markers4_a.png`（mirrorの向きの比較）

目視（観察）:

- 各力士のまわしの左右に、Userの絵の前腕 + 拳が1つずつ乗る
  - 拳は、まわしの帯の縁に掛かる
  - 前腕は帯を斜め（約37°）に横切る
  - 上腕の短い端は、体の縁に沿って前へ回り込む
- 輪郭の太さ・cel調の塗りは、力士の絵に近い
- 下側の2つ（blueの左下、redの右下）は、肘と上腕の端が、乗っている力士の輪郭の外へ少し出る
- 拳は握った形なので、見方によっては「殴る」拳にも見える（Taskの想定どおりの確認点）

# Changed Files

新規:

- `tools/wrestler_art/grip_forearm_hand_gate_recipe.json`: sourceのidentity、alphaのbbox、anchor、余白・縮小率・出力
- `tools/wrestler_art/export_grip_forearm_hand_gate.py`: 決定的なexporter（`--check`あり）
- `tools/wrestler_art/tests/test_export_grip_forearm_hand_gate.py`
- `public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png`
- `public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand_mirrored.png`

変更:

- `src/game/presentation/gripSuccessSymbolVfx.ts`: authored artのmetadata、4-markerの配置、長さ / 角度、`gripMarkerPlacement`（pair READYの判定は引き継ぎ）
- `src/game/presentation/gripSuccessSymbolVfx.test.ts`: ACTION-11Lのtestに置き換え
- `src/game/scenes/WrestlerView.ts`: 手続き的な描画を削除、marker artのpreload、力士ごとに2枚のimage、`apply`での配置、header comment
- `docs/ARCHITECTURE.md`: ACTION-11Kの項目を、11K / 11L（暫定）の説明に更新
- `tools/wrestler_art/README.md`: tool表に1行と、暫定の節を追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

- **肘の位置**: Taskの初期値の肘(−0.15, ±1.02)は、拳との距離が0.50 Rで、同じTaskのG5（0.65–0.75 R、目標0.70）と両立しなかった
  - 拳(−0.45, ±0.62)と角度36.87°（Taskの値）はそのまま
  - 肘を同じ方向へ伸ばして(−0.03, ±1.18)とし、長さ0.70 Rにした
  - Taskが認める「小さな局所調整」の範囲と判断したが、数値が変わるので明記する
- **mirroredのvariant**: Taskが「必要なら可」とした、同じsourceからoffline反転したvariantを、左側に使った（理由は上記）

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない
- 参考: このmachineのPython 3.9.7は、非常に長い行に多byte文字があるsourceを読めないことがある。docsの編集はNodeで行った

# Known Untested Items

- 実機のTouch入力
- TURNINGは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した

# User Visual Gate: REQUIRED

1. 描いた腕の絵は、手続き的な記号より力士の絵柄に合っているか（`before_after_11k_11l.png`）
2. 4つのmarkerで、2人とも両手を使っていると分かるか
3. まわしを30–45°で横切る角度は自然か
4. 大きさは、記号として十分に短いか（肘→拳0.70 R。上腕の端が体の外へ少し出る点を含めて）
5. 拳が「掴んでいる」に見えるか、「殴っている」に見えるか
6. TURNING中に隠すこと、Drive / Morozashiでの見え方

拳が殴っているように見えることだけが問題なら、次の一歩は、小さな手の絵だけを「まわしを掴む手」に描き直すこと（力士の体は描き直さない）。

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`art(presentation): trial authored grip hand markers`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
