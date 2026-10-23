Task-ID: ACTION-11M-GRIP-SUCCESS-LOWER-MARKER-POSITION-TUNE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 903fe8a372fdc37979a1e29b73a638e59592ccdf
Agent-Start-Head: 0d2c38f4af27beb18433c9932e31f2ebef9c7bba
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

下側の2つの作者画像のmarkerだけ、配置を変えた。

- 拳はまわしの同じ点のまま
- 肘を、markerが乗る力士（Userの言う「相手」）の背中の側へ移した
- 前腕は、その力士の背中・肩のあたりから、まわしへ斜め（36.87°）に伸びる
- 上側の2つ、作者画像、ゲームプレイ、ACTION-11F / 11H / 11Jは変えていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `903fe8a`（ancestor）、Handoff-Mode GITHUB
- `903fe8a..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `0d2c38f`

# 「下側のmarker」の特定

- ACTION-11Lでは、2人とも同じlocalの配置だった（右 = authored、左 = mirrored）。それでも画面上で上下の見え方が違ったのは、success poseの絵が左右非対称だから
  - 頭の側は、肩が大きく張り出している
  - 足の側は、輪郭が細い
- そのため、足の側では肘(±1.18 R)が輪郭の外に出て、「自分の体からぶら下がる腕」に見えていた
- blueはredの反射なので、足の側は次のとおり。Scene上で正対したpairでは、どちらも画面の下側になる
  - redでは左（−lateral）
  - blueでは右（+lateral）
- そこでmarkerの組を、力士の絵ごとに持つようにした: `GRIP_SUCCESS_MARKERS[artId]` = [頭の側, 足の側]

# Geometry

markerが乗る力士のlocal座標。R単位、+forward = FRONT、+lateral = 力士の右。

| 絵 | 役割 | 拳（hand） | 肘（elbow） | texture | 状態 |
|---|---|---|---|---|---|
| red | 頭の側（上） | (−0.45, +0.62) | (−0.03, +1.18) | authored | **ACTION-11L RIGHTと同一** |
| red | 足の側（下） | (−0.45, −0.62) | (−0.03, −1.18) → **(−0.03, −0.06)** | mirrored → **authored** | 変更 |
| blue | 頭の側（上） | (−0.45, −0.62) | (−0.03, −1.18) | mirrored | **ACTION-11L LEFTと同一** |
| blue | 足の側（下） | (−0.45, +0.62) | (−0.03, +1.18) → **(−0.03, +0.06)** | authored → **mirrored** | 変更 |

下側（足の側）の変化:

- 拳（まわしの上の掴む点）は変えていない: (−0.45, ±0.62)。腰の後ろ半分のまわしの上
- 肘: 腰の外(±1.18 R) → 背中の中央付近(±0.06 R、力士の中心から0.067 R)
  - 肘→拳は(−0.42, ±0.56)で、拳を起点に、肘を反対側へ折り返した形
  - 上側と同じく、角度はまわし（local横軸）に対して**36.87°**、長さは**0.70 R**
  - 肘は、掴んでいる側の力士（前方、表示上の中心は約1.72 R先）から遠い（1.5 Rより遠い）。「自分の体から出ている」ようには置いていない
- textureの向き（authored / mirrored）を入れ替えた
  - これで、下側の上腕の端も、上側と同じく2人の接点（肩口）の側へ回り込む
  - offline比較（`m11_b_cmp.png`）で、同じ向きのままだと上腕の端が背中の上方へ向き、上側と揃わなかった
- 作者画像のpixel・anchor・exporterは変えていない。どの向きの絵を使うかを選び直しただけ

上側（頭の側）:

- ACTION-11Lの値と完全に一致する（test 11M-1）
- smokeでも、頭の側の拳は11Lと同じ位置（A: (940.92, 489.54)）

# Changed Files

- `src/game/presentation/gripSuccessSymbolVfx.ts`
  - `GRIP_SUCCESS_MARKERS`を、力士の絵ごとの組（`Record<ProductWrestlerArtId, ...>`）にした
  - 役割`role: 'headSide' | 'footSide'`を追加し、足の側の配置を変えた
  - header comment
- `src/game/presentation/gripSuccessSymbolVfx.test.ts`: 11Mのtestを追加。既存のtestを組の形へ合わせた
- `src/game/scenes/WrestlerView.ts`: 自分の絵（`art.id`）の組でmarkerを作り、置く。header comment
- `docs/ARCHITECTURE.md`: 記号VFXの項目に、ACTION-11Mの頭の側 / 足の側の配置を追記（暫定）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Preservation

- ACTION-11F: `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14` / `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.2`は不変（test P1）
- ACTION-11H: `public/`と`tools/`のdiffは0。`export_grip_success_gate.py --check`はexit 0
- ACTION-11J: pair READYの規則は不変（V4、smoke L6）
- ACTION-11Lの作者画像:
  - `public/assets/action/wrestler/grip-symbol-authored-gate/`のdiffは0
  - file SHA-256は`d94b717f…44d40e` / `e97a9f3f…bbacfe`で、ACTION-11L（`2b38f0d`）と同一
- `src/game/sumo/`・`src/game/input/`のdiffは0。Snapshotは不変、bondは0.70 m（test P3 / P4、smoke 6 / 16b）
- markerの数: READYのpairで4つ（test G2 / V1–V3、smoke L2）

# Tests

`src/game/presentation/gripSuccessSymbolVfx.test.ts`: 17 / 17 PASS

| Task ID | test |
|---|---|
| 1 上側は11Lと同一 | `11M-1: the head-side (upper) markers keep the ACTION-11L geometry exactly` |
| 2 下側は別の配置 / 4 肘は自分ではなく相手（乗る側）の背中へ | `11M-2 / 11M-4`: 頭の側とは別の値。肘は乗る側の中心から < 0.3 R、拳より内側。拳より前（まわしへ下りる）。掴む側の力士から1.5 Rより遠い。redとblueの組は左右の鏡像 |
| 3 下側の拳はまわし上 | `G3 / 11M-3`: 拳は全部(−0.45, ±0.62)で体の内側。各組で左右反対 |
| 5 下側の角度は30–45° | `G4 / G5`: 全markerが36.87°・0.70 R。textureの肘–拳 × scale = 表示上の長さ |
| 6 READYで4つ | `G1 / G2`、`V1`–`V3` |
| 7 TURNINGで0 | `V4`（数は常に0か4。READYになった同じtickで4つ） |
| 8 release / recovery / 他のactionで0 | `V5 / V6`、`V7` |
| 9 ACTION-11Fの定数不変 | `P1 / P3 / P4` |
| 10 ACTION-11Hのasset不変 | `public/`・`tools/`のdiffが0（下記） |
| 11 Snapshot / bond 0.70 m | `P1 / P3 / P4` |
| 12 sumo / inputのdiffなし | `git diff --stat HEAD -- src/game/sumo src/game/input`が空 |
| その他 | 回転・拡大の剛体変換（G6）、pairの4つの拳は決定的で離れている（G7）、表示上の中心へのanchor、WrestlerViewが自分の絵の組を使うこと（source assertion） |

# Verification

| 項目 | 結果 |
|---|---|
| markerのfocused test | 17 / 17 PASS |
| `pnpm test`（Grip success / attemptのpresentation、Grip / Grapple / Drive / Orientationのgameplay、Push / Tsuppari / Counter / Kuzushiのpresentationを含む） | 30 files、522 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiff | 0行 |
| `export_grip_success_gate.py --check`（ACTION-11H） | exit 0 |
| `export_grip_forearm_hand_gate.py --check`（ACTION-11L） | **実行できなかった**（下のKnown Untested Itemsを参照） |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU、Vite dev server、1920x1080。ACTION-11Lのscriptで、期待値を力士ごとの組に変えた。

- 判定の内容: 全frameで、textureのkey・拳の位置・回転・拡大・depthを、組の値と比べる
- 対応: wrestler-a = blue、wrestler-b = red

結果は **27 / 27 PASS**。

| 項目 | 結果 |
|---|---|
| L1 | Grip attempt中はmarker無し |
| L2 | neutralの最初のframe + 落ち着いた後: 4つ。Aの頭の側の拳(940.92, 489.54)は11Lと同じ位置、足の側の拳(940.92, 565.85)も11Lと同じ位置。足の側は回転だけが変わった（−1.1264 rad）。scale 0.7368 = 0.70 R |
| L3 | 描画順が安定（体2 < marker 2.3） |
| L4 / L5 | Drive（286 frame）、Morozashi（208 frame）で常に4つ |
| L6 | TURNINGの132 frameは0。最初のREADY frameから4つ同時に表示され、以後消えない（540 frame） |
| L7 / L8 | releaseの最初のfree frameから0。後のGrip attemptにも残らない |
| L9 | Push / Tsuppari / Counter / Kuzushi（600 frame）で0 |
| その他 | ACTION-11Fのcompression / bond 0.70 m / scale / pivot / 影、Tsuppari / Counter 35° / Kuzushiの汗 / Push、R restartは不変。console error・例外なし（既存の`/favicon.ico` 404は除外） |

## Screenshots（ローカルのscratchpad、commitしない）

- 8枚と一覧: `smoke11m\`
  - `01_neutral_immediately_after_success`
  - `02_neutral_settled`
  - `03_drive_while_grappled`
  - `04_morozashi_grapple`
  - `05_immediately_after_release`
  - `06_turning_immediately_after_success`
  - `07_turning_mid`
  - `08_turning_settled`
  - `pair_sheet.png`
- **下側のbefore / after**（左ACTION-11L、右ACTION-11M、neutralの同じ切り出し）: `smoke11m\before_after_11l_11m.png`
- offline比較: `m11_a.png`（4案）、`m11_b_cmp.png`（下側の絵の向き2案の拡大）

目視（観察）:

- 上側の2つは11Lと同じ
- 下側の2つ:
  - blue: 前腕がblueの背中の中央から左下のまわしへ斜めに伸び、上腕の端は2人の接点（肩口）の側へ回り込む
  - red: 前腕がredの背中から右下のまわしへ伸びる
  - 11Lのような、体の輪郭の外へぶら下がる肘は無くなった
  - 拳はまわしの縁に掛かる
- 4つとも上腕の端が接点の側を向き、同じ「肩・背中からまわしへ」の向きで揃って見える
- 足の側の前腕は、背中の中央を横切るので、体の絵の上に重なる面積は11Lより大きい

# Design Deviations

Design Deviations: NONE

（下側の配置のために、markerの組を力士の絵ごとに持つ形にした。Taskの「必要なら上側 / 下側を別に定義してよい」の範囲。）

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない

# Known Untested Items

- `export_grip_forearm_hand_gate.py --check`を実行できなかった
  - 今回の作業中に、`tools/wrestler_art/input.local/candidate_grip_forearm_hand_symbol.png`が無くなっていた
  - exporterは、sourceが無いのでfail closed（exit 2）。Python testの実画像のclassも、skipされる条件になる
  - このTaskは作者画像に触れない
  - 不変であることは、`public/`・`tools/`のgit diffが0であること、runtime PNGのfile hashがACTION-11Lと同一であることで示した
  - sourceを置き直せば、`--check`を再実行できる。他のdirectoryは探していない
- 実機のTouch入力
- TURNINGは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した

# User Visual Gate: REQUIRED

主な問い: 下側の2つの作者画像のmarkerが、上側と同じ向きで、相手（markerが乗る側）の肩・背中からまわしへ伸びているように、記号として読めるか。

- 上側は変わっていないか
- 下側の向き、拳がまわしに掛かる位置
- 30–45°の斜め
- 4つの読みやすさ（下側の前腕が背中の中央に重なる量を含めて）
- Drive / Morozashiで一貫しているか、TURNING中に隠れるか

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): tune lower grip hand markers`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
