Task-ID: ACTION-11J-GRIP-SUCCESS-LIMB-VFX-READY-ONLY
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: f0816e7439b72edcf6c5c5a11d4927208c9e1ff5
Agent-Start-Head: e77cce6ee5f4a8836624861563ee74eda45ced05
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

ACTION-11Iで止めた作業のうち、正対した（READYの）状態で良く見えた腕のgeometryを採用した。そのうえで、組み合っている2人のどちらかがTURNINGのあいだは、2人とも腕・手のVFXを隠す。

- 両者がREADYになったframeで、2人の腕が同時に現れる
- gameplay、Grappled Orientation、canonicalな位置・bond・facing、ACTION-11Fのcompression、ACTION-11Hのtone補正、asset、art toolingは変えていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `f0816e7`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `f0816e7..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `e77cce6`

# WIP patchの扱い

ACTION-11Iで退避した`action11i_wip.patch`（scratchpad、同じ機械）を使った。

- 適用前に中身を確認した
  - 対象は3 fileだけ: `gripSuccessLimbVfx.ts` / `gripSuccessLimbVfx.test.ts` / `WrestlerView.ts`
  - 中身はACTION-11Iの腕の配置変更とそのtestだけ
  - scratchやdebug用のcodeは含まれていない
- `git apply --check`の後に適用した
- その上に、ACTION-11Jのpair READY表示を足した

# Geometry: ACTION-11G → ACTION-11J

wrestler-localのR単位。+forward = FRONT、+lateral = 力士の右。

ACTION-11G（不採用、単一のcapsule × 2本）:

| limb | start | end | 太さ | 手 | depth |
|---|---|---|---|---|---|
| FAR | (0.18, +0.42) | (0.82, +0.25) | 0.20 | 0.15 | 1.9 |
| NEAR | (0.22, −0.65) | (1.12, −0.58) | 0.22 | 0.16 | 2.2 |

ACTION-11J（2区間の腕 × 2本。各腕は肩→肘→手）:

| 腕 | 区間 | start | end | 太さ | 手 | layer / depth |
|---|---|---|---|---|---|---|
| LOW（右、長い） | 上腕 | 肩 (0.35, +0.8) | 肘 (1.55, +1.5) | 0.26 | なし | FAR 1.9 |
| LOW | 前腕 | 肘 (1.55, +1.5) | 手 (2.2, +1.15) | 0.26 | 0.19 | NEAR 2.2 |
| HIGH（左、短い） | 上腕 | 肩 (0.35, −0.8) | 肘 (1.25, −0.75) | 0.24 | なし | FAR 1.9 |
| HIGH | 前腕 | 肘 (1.25, −0.75) | 手 (1.6, −0.45) | 0.24 | 0.17 | NEAR 2.2 |

正対したpairで、相手のlocal座標に直した位置:

- 相手の表示上の中心は、自分のlocalで(1.72, +0.40)
- LOWの手: 相手の(−0.48, −0.75) → 相手の背中側の脇。まわしのあたり
- HIGHの手: 相手の(+0.12, +0.85) → 相手の前半身の脇・肩口
- 肘は、どちらも相手の輪郭上（相手の中心から1.0–1.3 R）

# 2区間 / depthのmodel

| 区間 | depth | 役割 |
|---|---|---|
| 上腕（肩→肘） | FAR 1.9 | 影1と体2のあいだ。付け根が自分の体の下に隠れるので、丸い切り口は見えない |
| 前腕（肘→手） | NEAR 2.2 | 体の上。手が相手の体に乗る |

その他:

- 前腕は肘から、上腕と同じ太さで始まる。肘は丸いcapで繋がる
- 上腕には手が無く、端は腕の太さの丸いcap（textureの手の半径 = max(手, 太さ/2)）
- textureのkeyは`grip-limb-<arm>-<segment>-<R>`。区間ごと・Rごとに1回だけ生成する
- depthは固定で、動的なsortは無い。smokeで、display listの順序が全frameで不変なことを確認した

# Pair READYの表示

- pure helper（Phaser非依存）: `gripSuccessPairLimbsVisible(self, opponent)`（`gripSuccessLimbVfx.ts`）
  - = 両者がsuccess pose（grapple / drive）かつ `!self.turning && !opponent.turning`
  - 2人とも同じ答えになる
- 入力は既存の`WrestlerVisualState.turning`だけ（Simulation由来の値）
  - 新しいgameplay state、timer、Grappled Orientationの複製は無い
- `BoutScene.syncViews`の変更: 両者の`WrestlerVisualState`を先に求め、`WrestlerView.apply(state, participant, pos, opponentState)`へ相手のvisual stateを渡す
  - 体のart選択・ACTION-11Fのoffset・limbのgeometryは、従来どおり力士ごと。pair contextを使うのはlimbの表示判定だけ
  - visual stateの計算そのもの（`resolveWrestlerVisualState`と、moveのhysteresisに使う前frameの`moving`）は従来と同じ
- `WrestlerView`: 体の位置・影・artは不変。limbの表示判定だけが`gripSuccessPairLimbsVisible(state, opponentState)`に替わった
- ついでの整理: ACTION-11Gでlimbのblockが、Kuzushiの汗のcommentとそのcodeのあいだに入っていた。commentを汗のcodeの直前へ戻した（挙動は不変）

# ACTION-11F / 11H / gameplay unchanged

- `GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14` / `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.2`は不変（`gripSuccessGateArt.ts`はdiff 0。test P1、smoke 7）
- ACTION-11H: `tools/wrestler_art/`（recipe / curve / exporter）と`public/assets/action/wrestler/`（success textureを含む）のdiffは0。再書き出しもしていない
- `src/game/sumo/`・`src/game/input/`のdiffは0
- Snapshotは不変、bondは0.70 m（test P3 / P4、smoke 6 / 16b）

# Tests

`src/game/presentation/gripSuccessLimbVfx.test.ts`: 20 / 20 PASS

| ID | 内容 |
|---|---|
| geometry | 上の4区間の値。各前腕は上腕の肘から同じ太さで始まり、手は前腕にだけある |
| G1 | placementは決定的 |
| G2 / G4（Task） | 腕の付け根（上腕のstart）は自分の体の内側（< 0.95 R）で、FAR = 体の下 |
| G3 / G5（Task） | 前腕はNEAR = 体の上。手は相手の体の内側に乗る。肘は相手の輪郭上（1.0–1.3 R） |
| G2（Task）HIGH | 手は相手の前半身（上半身・肩口） |
| G3（Task）LOW | 手は相手の後半身（腰・まわし）。LOWの前腕はHIGHより長い。HIGH = 左、LOW = 右 |
| rotation | facing 0 / π/2 / π / −π/2で剛体として回る |
| G6 | 長さ・太さ・手の大きさがRに比例 |
| V1 | 両者grappledでREADY → 2人とも表示 |
| V2 / V3 | 片方がTURNING（背後からの組み）→ TURNINGの側も、READYの相手側も非表示（success poseそのものは表示中） |
| V4 | 両者TURNING → 非表示 |
| V5 | TURNING → READY: 2人の表示は常に一致し、READYになった同じtickで両者が表示される。その後30 tickは消えない |
| V6 / V7 | Drive（40 tick）とMorozashi、どちらも両者READY → 表示 |
| V8 | Grip attempt / releaseのtick / recovery / Tsuppari / Counter / Kuzushi / Push → 非表示 |
| 既存 | pose単位の表示（G1–G3）、attempt / release / 他のactionで非表示、表示上の中心へのanchor |
| P1 / P3 / P4 | Snapshot不変、bond 0.70 m、ACTION-11Fの定数不変 |
| ownership | Phaser / Simulationに依存しない。WrestlerViewのdepth 1.9 / 2 / 2.2、表示上の中心からの配置、pair判定の使用（source assertion） |

# Verification

| 項目 | 結果 |
|---|---|
| limb VFXのfocused test（geometry + pair READY） | 20 / 20 PASS |
| `pnpm test`（Grip success / attemptのpresentation、Grip / Grapple / Drive / Orientationのgameplay、Push / Tsuppari / Counter / Kuzushiのpresentationを含む） | 30 files、525 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiff | 0行 |

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU、Vite dev server、1920x1080。ACTION-11Gのscriptを、次のように変えて実行した:

- limbを4区間に対応させた
- 判定を「pair READYのときだけ表示」に変えた

結果は **27 / 27 PASS**。

| 項目 | 結果 |
|---|---|
| L1 | Grip attempt中はlimb無し |
| L2 | neutralの最初のframe + 落ち着いた後: 両者に4区間。表示上の中心と向きに正しく付く（< 1e-6 px / 1e-9 rad） |
| L3 | 描画順が安定: 上腕1.9 < 体2 < 前腕2.2。display listの順序も全frameで不変 |
| L4 / L5 | Drive（290 frame）、Morozashi（211 frame）で常に表示 |
| L6（TURNING） | 背後から組んだgrappleで、TURNINGの132 frameは両者とも非表示。最初のREADY frame（index 132）から、両者が同じframeで表示され、以後消えない（519 frame） |
| L7 / L8 | releaseの最初のfree frameからlimb無し。後の新しいGrip attemptにも残らない |
| L9 | Push / Tsuppari / Counter / Kuzushi（599 frame）でlimb無し |
| その他 | ACTION-11Fのcompression / bond 0.70 m / scale / pivot / 影 / 描画順、Tsuppari / Counter 35° / Kuzushiの汗 / Push、R restartは不変。console error・例外なし（既存の`/favicon.ico` 404は除外） |

smoke scriptの補足: 計測hookが`apply`の第4引数（相手のvisual state）を渡しておらず、初回は計測側で例外になった。hookを直して再実行した。productには影響しない。

## Screenshots（ローカルのscratchpad、commitしない）

8枚と一覧: `smoke11j\`

- `01_neutral_immediately_after_success`（READY、腕あり）
- `02_neutral_settled`（READY、腕あり）
- `03_drive_while_grappled`（READY、腕あり）
- `04_morozashi_grapple`（READY、腕あり）
- `05_immediately_after_release`（腕なし）
- `06_turning_immediately_after_success`（**TURNING、腕なし**）
- `07_turning_mid`（**TURNING、腕なし**）
- `08_turning_settled`（**READY、腕あり**）
- 一覧（2倍拡大）: `pair_sheet.png`

before / after:

- ACTION-11G: `smoke11h\pair_sheet.png`（11Hのtone補正後、11Gの腕）
- ACTION-11Iで止めた時点: `smoke11i\pair_sheet.png`（TURNING中に腕が浮く）
- ACTION-11J: `smoke11j\pair_sheet.png`

目視（観察）:

- READY（01–04、08）:
  - LOWの腕が、相手の脇の外側を回り、手が相手の背中側（まわしのあたり）に掛かる
  - HIGHの前腕は、相手の肩口に短く乗る
  - 上腕の付け根は体の下に隠れ、切り口は見えない
  - 「横に置いた棒」ではなくなった
  - ただし形は単純なcapsuleなので、硬い棒のような質感は残る
- TURNING（06–07）: 腕は無い。success poseとcompressionは表示されたまま。空中に浮く腕は無い
- 08: 正対した後、ACTION-11Jの形が両者に同時に現れる
- 腕の肌色（`#f3b47c`、ACTION-11Gのまま）は、ACTION-11Hで補正した体の肌より明るく見える。色は今回の範囲外なので変えていない

# Changed Files

- `src/game/presentation/gripSuccessLimbVfx.ts`:
  - 腕を2区間（`arm` / `segment`）にし、geometryを更新した
  - `gripSuccessPairLimbsVisible`を追加した
  - header comment
- `src/game/presentation/gripSuccessLimbVfx.test.ts`: geometry G1–G6と、pair READYのV1–V8
- `src/game/scenes/WrestlerView.ts`:
  - `apply`が相手のvisual stateを受け取り、limbの表示をpair判定にした
  - 区間ごとのtexture keyと、手の無い端のcap
  - comment（汗のcommentの位置も直した）
- `src/game/scenes/BoutScene.ts`: `syncViews`で両者のvisual stateを先に求め、相手の分を`apply`へ渡す
- `docs/ARCHITECTURE.md`:
  - ACTION-11Gのnoteを11G / 11Jの内容に更新した
  - ACTION-11Gで紛れ込んでいた、11E / 11Fのnoteの末尾1文を、元の項目へ戻した
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

（Taskが数値を指定していないgeometryは、ACTION-11IのWIPの値をそのまま使った。ACTION-11IでHIGHの手を相手の前半身へ寄せた調整（手(1.75, −0.4) → (1.6, −0.45)）も、WIPの時点で入っている。）

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない
- 腕の肌色が、tone補正後の体より明るい（上記）。色は今回の範囲外
- art toolingのメモ: このmachineのPython 3.9.7は、非常に長い行に多byte文字があるsource fileを、「Non-UTF-8」として読めないことがある。docsの編集はNodeで行った。productには影響しない

# Known Untested Items

- 実機のTouch入力
- TURNINGは、CounterTransition後の背後からの組み（Morozashi）の1通りだけ確認した

# User Visual Gate: REQUIRED

1. 正対したGripで、腕が上半身と腰・まわしへ巻きついているように見えるか
2. 付け根が、切れた棒ではなく体に付いて見えるか
3. TURNINGのあいだ腕を隠すのは許容できるか
4. 両者がREADYになった瞬間に、2人の腕が同時に現れるのは許容できるか
5. neutral / Drive / Morozashiで一貫しているか

正対時の形がまだ合わない場合は、どこが問題か教えてほしい: 付け根、肘の通り道、手の位置、太さ、手続き的な形そのもの、のどれか。

TURNING中に隠す方式が合わない場合は、後のTaskで、TURNING専用の腕のposeを検討する。

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): hide grip limbs while turning`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
