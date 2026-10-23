Task-ID: ACTION-11K-GRIP-SUCCESS-SYMBOLIC-FOREARM-HAND-VFX
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 148006a4181e28bf2e75a5d94b99fc6ab7e72a23
Agent-Start-Head: 4d12c735a78c410dd1d0c2b7c0147ef27f85a194
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

ACTION-11G / 11Jの「体につながった腕」（肩 → 肘 → 手）を廃止し、記号的なmarkerに置き換えた。

- markerは、肘から先だけの短い前腕 + 手の記号で、相手の腰・まわしの上に重ねる
- Kuzushiの汗と同じ、アニメ調の手続き的なVFX
- 体とはつながらない
- ACTION-11JのpairのREADY規則（どちらかがTURNINGなら2人とも隠す）は、そのまま引き継いだ
- gameplay、Grappled Orientation、canonicalな位置・bond・facing、ACTION-11Fのcompression、ACTION-11Hのtone補正、asset、art toolingは変えていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `148006a`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `148006a..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `4d12c73`

# Old → New

| | ACTION-11J（不採用） | ACTION-11K |
|---|---|---|
| model | 体につながった腕2本 × 2区間（肩→肘 / 肘→手）。自分の肩から相手へ伸ばす | 相手の腰に置く、独立した記号「肘→手」 |
| 数 | 1人あたり4区間（pairで8枚） | 1人あたり1つ、**pairで2つ** |
| anchor | 腕の持ち主の体 | 記号が乗る側（掴まれる側）の体 |
| depth | 上腕1.9 / 前腕2.2 | 2.3の1枚だけ |
| code | `gripSuccessLimbVfx.ts`（4区間のgeometry、`gripSuccessPairLimbsVisible`） | 削除して`gripSuccessSymbolVfx.ts`に置き換えた。古いgeometry・texture・depthは残していない |

数の設計:

- 各`WrestlerView`は、自分の腰に乗る1つ（= 相手の掴み）だけを描く
- このため、相手の表示上の位置を受け渡す必要が無い。自分の表示上の中心（ACTION-11Fのoffset込み）と自分のfacingだけで置ける
- Taskが認める「1人1つ」の形

# Final geometry（記号が乗る力士のlocal、R単位。+forward = FRONT、−forward = BACK / まわしの結び目側、+lateral = 力士の右）

| 項目 | 値 | Taskの探索範囲 |
|---|---|---|
| 肘（前腕の始点、丸い端） | (−0.10, +0.95) | — |
| 手の中心 | (−0.55, +0.60) | forward −0.35〜−0.55、\|lateral\| 0.55〜0.80 |
| 前腕の長さ | 0.570 R（肘→手） | 0.35〜0.60 |
| 前腕の太さ | 0.20 R | 0.16〜0.22 |
| 手の半径 | 0.18 R | 0.15〜0.20 |
| 曲がり | 長さの0.12（親指側へ膨らむ） | — |

配置の結果:

- 手は記号が乗る力士の右の脇から、背中側のまわしに掛かる
- 正対したpairでは、2つのmarkerが表示上のpairの中点について点対称になる。軸の反対側に分かれ、重ならない（手の間隔は2Rより大きい）
- smokeでの位置（R = 61.54 px）: Aの肘 (962.46, 586.15)、Bの肘 (1080.62, 493.85)

offline比較（`symbols_a.png`）:

- 4つの候補（S1–S4）を比べた
- S2が、手が背中側のまわしに掛かり、2つが対角に分かれて最も読みやすかったので採用した

# Render style

- 形: 少し曲げた前腕。肘側の端は丸い。先端は親指の膨らみがある、ミトン状の手
- 塗り:
  - 太い輪郭 `#231612`（幅0.045 R）
  - 影色 `#d38c56`
  - 肌 `#f5b47d`。親指側へずらして塗り、cel調の2トーンにする
  - 前腕のhighlight `#fde0b8` 1つ
  - 指先の筋（輪郭色）2本
- 色の由来: ACTION-11Hで補正したGrip successの体の、肌maskのP50（`#f5b47d`）とP20（`#d38c56`）。名前付きの定数にした（`GRIP_SYMBOL_SKIN` / `GRIP_SYMBOL_SHADE`）
  - 補足: 補正後の肌の中間調は、ACTION-11Gの`#f3b47c`とほぼ同じだった。前の腕が明るく見えたのは、体の影の面積が増えたのに、腕が1色だったため。今回は影色の帯を入れて、体の塗り方に合わせた
- 手続き的なtexture: `Graphics.generateTexture`。4倍で描き、scale 0.25で表示。key `grip-symbol-<R>`、Rごとに1回だけ生成
- depth: **2.3**（`GRIP_SYMBOL_DEPTH`。体2の上、Kuzushiの汗2.5の下）。1枚だけで、動的なsortは無い
- glow・text・iconの枠・particleは無い

# Visibility

- `gripSuccessPairSymbolVisible(self, opponent)` = 両者がsuccess pose（grapple / drive）、かつ `!self.turning && !opponent.turning`
- ACTION-11Jの経路をそのまま使う: `BoutScene`が両者のvisual stateを先に求め、`WrestlerView.apply(..., opponentState)`へ渡す
- 次の場合は非表示: どちらかがTURNING、Grip attempt、recovery、release、idle、move、Push、Tsuppari、Counter、Kuzushi、pre-bout
- timer・fadeは無い

# ACTION-11F / 11H / gameplay unchanged

- `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14` / `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.2`は不変
  - `gripSuccessGateArt.ts`の変更は、comment 1行（「limb VFX」→「grip symbol VFX」）だけ
- ACTION-11H: `tools/wrestler_art/`と`public/assets/action/wrestler/`のdiffは0。再書き出しもしていない
- `src/game/sumo/`・`src/game/input/`のdiffは0
- Snapshotは不変、bondは0.70 m（test P3 / P4、smoke 6 / 16b）

# Tests

`src/game/presentation/gripSuccessSymbolVfx.test.ts`（新規）: 14 / 14 PASS。旧`gripSuccessLimbVfx.test.ts`は、対象のcodeと一緒に削除した。

| ID | 内容 |
|---|---|
| G1 / G6 | markerの定義は1つ（肘→手だけ。shoulder / start / root / upperの項目は無い）。WrestlerViewが作るmarkerのimageは1枚。旧limbの参照は無い |
| G2 | 長さ・太さ・手の大きさがTaskの範囲内で、Rに比例 |
| G3 | 手は記号が乗る力士の腰の後ろ半分（まわし側）で、体の内側にある。前腕は脇から手へ向かう |
| G4 | facing 0 / π/2 / π / −π/2で剛体として回る |
| G5 | 正対したpair: 2つは決定的で、重ならない（手の間隔 > 2R）。中点について点対称で、軸の反対側に分かれる |
| anchor | 表示上の中心（canonical + ACTION-11Fのoffset）に置かれる |
| V1–V3 | READYのneutral / Drive（40 tick、flickerなし）/ Morozashiのholder・disadvantagedで、2人とも表示 |
| V4 | どちらかがTURNING → 2人とも非表示。READYになった同じtickで2人とも表示され、その後は消えない |
| V5 / V6 | Grip attempt中、releaseのtick、recoveryで非表示 |
| V7 | idle / Push / Tsuppari / Counter / Kuzushiで非表示 |
| P1 / P3 / P4 | Snapshot不変、bond 0.70 m、ACTION-11Fの定数不変 |
| ownership | Phaser / Simulationに依存しない。depth 2 < 2.3 < 2.5、pair判定と表示上の中心からの配置、BoutSceneが相手のvisual stateを渡すこと（source assertion） |

# Verification

| 項目 | 結果 |
|---|---|
| symbol VFXのfocused test（geometry + pair READY） | 14 / 14 PASS |
| `pnpm test`（Grip success / attemptのpresentation、Grip / Grapple / Drive / Orientationのgameplay、Push / Tsuppari / Counter / Kuzushiのpresentationを含む） | 30 files、519 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiff | 0行 |

`pnpm test`の件数は、ACTION-11Jの525から519に減った。旧limbのtest 20件を削除し、symbolのtest 14件を追加したため。

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU、Vite dev server、1920x1080。ACTION-11Jのscriptで、記録と判定をsymbol 1枚に置き換えた。結果は **27 / 27 PASS**。

| 項目 | 結果 |
|---|---|
| L1 | Grip attempt中はmarker無し |
| L2 | neutralの最初のframe + 落ち着いた後: 2人に1つずつ（pairで2つ）。表示上の中心と向きに正しく付く（< 1e-6 px / 1e-9 rad） |
| L3 | 描画順が安定: 体2 < marker 2.3。display listの順序も全frameで不変 |
| L4 / L5 | Drive（286 frame）、Morozashi（221 frame）で常に表示。pairと一緒に動く |
| L6（TURNING） | TURNINGの132 frameは2人とも非表示。最初のREADY frame（index 132）から2人とも同時に表示され、以後消えない（526 frame） |
| L7 / L8 | releaseの最初のfree frameからmarker無し。後の新しいGrip attemptにも残らない |
| L9 | Push / Tsuppari / Counter / Kuzushi（601 frame）でmarker無し |
| その他 | ACTION-11Fのcompression / bond 0.70 m / scale / pivot / 影 / 体の描画順、Tsuppari / Counter 35° / Kuzushiの汗 / Push、R restartは不変。console error・例外なし（既存の`/favicon.ico` 404は除外） |

## Screenshots（ローカルのscratchpad、commitしない）

8枚と一覧: `smoke11k\`

- `01_neutral_immediately_after_success`（READY、markerが2つ）
- `02_neutral_settled`（READY、2つ）
- `03_drive_while_grappled`（READY、2つ）
- `04_morozashi_grapple`（READY、2つ）
- `05_immediately_after_release`（なし）
- `06_turning_immediately_after_success`（TURNING、なし）
- `07_turning_mid`（TURNING、なし）
- `08_turning_settled`（READY、2つ）
- 一覧（2倍拡大）: `pair_sheet.png`
- 拡大: `zoom_02.png`
- before: ACTION-11J `smoke11j\pair_sheet.png`

目視（観察）:

- READY:
  - redの上側の脇と、blueの下側の脇に、短い前腕 + 手の記号が1つずつ乗る
  - 手はまわしの縁に掛かる
  - 体から伸びる長い腕や、横に置いた棒は無い
- 輪郭の太さ、2トーンの肌、highlightで、体のillustrationに近い描き方になっている
  - ただし手続き的な形なので、手は単純なミトン形
- 2つは対角に分かれ、互いに掴み合っているように読める

# Changed Files

- 削除:
  - `src/game/presentation/gripSuccessLimbVfx.ts`
  - `src/game/presentation/gripSuccessLimbVfx.test.ts`
- 新規:
  - `src/game/presentation/gripSuccessSymbolVfx.ts`: markerのgeometry（R単位）、長さ、pair READYの判定、canvasでの配置（Phaser非依存）
  - `src/game/presentation/gripSuccessSymbolVfx.test.ts`
- 変更:
  - `src/game/scenes/WrestlerView.ts`
    - 4区間のlimbのimage / texture / depthを、symbol 1枚（`ensureGripSymbolTexture`、`GRIP_SYMBOL_DEPTH`、色の定数）に置き換えた
    - `apply`では、symbolを自分の表示上の中心とfacingから置く
    - header comment
  - `src/game/scenes/BoutScene.ts`: commentだけ（両者のvisual stateを渡す経路はACTION-11Jのまま）
  - `src/game/presentation/gripSuccessGateArt.ts`: commentを1行
  - `docs/ARCHITECTURE.md`: ACTION-11G / 11Jの項目を、ACTION-11Kの記号VFXの説明に置き換えた（暫定）
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない

# Known Untested Items

- 実機のTouch入力
- TURNINGは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した

# User Visual Gate: REQUIRED

主な問い: まわしの上の、独立した記号の前腕 + 手で、体につながった腕が無くても、Kuzushiの汗と同じ簡単なアニメ調のVFXとして、pairが「掴み合っている」と読めるか。

- 記号が意図的に見えるか。切れた腕に見えないか
- 手がまわし・腰に掛かって見えるか
- 前腕の短さは適切か
- 絵柄が力士のillustrationと合っているか
- 2つで足りるか
- neutral / Drive / Morozashiで分かりやすいか
- TURNING中に隠すこと、releaseで消えることは許容できるか

## User作成の小さなPNGを勧めるか

- 今の時点では勧めない
  - 置き方・数・大きさを先にこのGateで判断してほしいため
  - 手続き的な描画でも、輪郭と2トーンで体の絵柄にかなり近づいた
- 位置・大きさは良いが、絵柄だけが合わないと判定された場合は、次の小さな一歩として、Userが描いた透過PNGを1枚使う案を勧める
  - 仕様の案: 肘から手まで、1本分。手は軽く握る形。キャラクターと同じ太い黒の輪郭と2トーンの肌。肘を左、手を右に向けた横向き。背景は透過。元の解像度は約300 x 160 px（runtimeでは約35 x 20 pxに縮小される）

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): replace grip limbs with symbolic markers`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
