Task-ID: ACTION-07C2-TSUPPARI-RIGHT-POSE-AND-REACH-TUNE
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 4ba81157e3525bfb150e374f9937259b77d55a03
Agent-Start-Head: d49cf5765fbbd63e9147af90679e9e5b6a7ffe6d
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS、Browser Smoke 52 / 52 PASS。見た目と手触りは、User Visual Gate / Play Testで判断する）。

このTaskで機能として変えたのは、次の2つだけ:

1. red right Tsuppariの候補を、Userが作り直した腕の短い画像に入れ替えた
   - 右腕の長さ（pivotから先端まで）: 07C1の134.0 px → **116.6 px**。左腕は108.5 px
   - 向き（FRONTから）: 27.8° → 28.4°。07C1の前向きの角度は保っている
2. `TSUPPARI_HAND_REACH` を **0.525 → 0.55 m** にした。体の半径が同じ2人の中心距離のしきい値は、**0.875 → 0.90 m**

ほかのgameplay semanticは変えていない。

```
SEPARATE is still a User preference, not yet promoted to permanent Product baseline.
```

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-IDは一致、Status READY、Target-Branch develop、Source-Baseline `4ba8115`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- `4ba8115..origin/develop` で変わったのは `docs/agent_handoff/CURRENT_TASK.md` だけ → `merge --ff-only` → `d49cf57`
- 前回の開始指示では、remoteのTaskがまだ07C1（REVIEWED）だった。Preflight STOPとして、repositoryには何も書かなかった

## Local input（`tools/wrestler_art/input.local/`、commitしない）

| file | file SHA-256 | decoded RGBA pixel SHA-256 | 07C1との比較 |
|---|---|---|---|
| candidate_red_tsuppari_right.png（新） | `8c2067a50b73708c1c2a3eb078ac3390f6aab35b838e73c09cba4da69198426a` | `d7d5632f8357bd1e4427d2bcdcee5a6e74307fcd9d0caca2d86d102ec8719011` | **変更あり**（07C1は `3db3260b…2cace`） |
| candidate_red_tsuppari_left.png | `24a00ca6…b917af` | `219d66dc…cb84b3` | 同じ |
| candidate_blue_tsuppari_left.png | `1b476336…5f2b` | `060bfbf4…8e77` | 同じ |
| candidate_blue_tsuppari_right.png | `b5a9d8ef…9345` | `17782b11…1071` | 同じ |

- 新しい画像も1254×1254のRGBA
- `candidate_red_tsuppari_right_backup2.png` は07C1のrightとpixelが同じ（`3db3260b…`）。下の校正にだけ使った

# Red-Right Normalization（新）

07C1で校正した測定方法を、そのまま使った。

- 髪: 1/2 BOX縮小、max(RGB) < 80、alpha > 200、7 px opening、最大成分
- まわし: hue band、最大成分の5%以上の成分
- idleの基準: 同じ方法で測った (428.7, 542.7) / 42652 px

校正の結果:

- 07C1のright（backup2）を同じ方法で測ると、recipeに記録した07C1の値と完全に一致した
  - 回転差 −2.885 / s 1.0778 / front 157.8 / root (818, 688) / core (663, 310)–(920, 940)
- 07Cのrightも、前回と同じ値になった

| 項目 | 07C1 right | 新07C2 right |
|---|---|---|
| hair centroid / px | (590.2, 628.8) / 48696 | (590.4, 628.5) / 48892 |
| mawashi centroid / px | (1051.9, 628.9) / 66208 | (1051.9, 628.8) / 66024 |
| 回転差 / s | −2.885° / 1.0778 | −2.858° / 1.0781 |
| source_front_deg | 157.8 | 157.8（同じ） |
| root_source_px | (818, 688) | (818, 688)（同じ） |
| body_core_source_px | (663, 310)–(920, 940) | **(663, 309)**–(920, 940) |
| runtime size / pivot | 209×167 / (79, 87) | **193×163 / (79, 87)** |
| reflected pivot（blue-left） | (79, 80) | **(79, 76)** |

- 体の位置は07C1とほぼ同じで、違うのは腕だけ。実際に値が変わったのはbody core上端のyだけ（310 → 309）
- 正規化のalgorithmは変えていない
- body core 123.0769 px、直交check、clip checkはPASS
- hand evidence（腕を伸ばしているのは画面上側の手 = RIGHT）は同じ

# Runtime Gate Textures

## 変わった6枚（どれもred-right由来）

| file | size | pivot | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|
| separate_red_right.png | 193×163 | (79, 87) | `0859a8c4d3c629f5ea00fc27a9ba97b5e0af8848daba5de77eb846d56aee0de8` | `b26187cc…6774` |
| mirror_r_red_right.png | 193×163 | (79, 87) | `0859a8c4…0de8`（separate_red_rightと同じ） | `b26187cc…6774` |
| separate_blue_left.png | 193×163 | (79, 76) | `bed6fa024e51d9ca17a75fd243554b4fa7f052f204e4fa679ea00a34dd68bb53` | `424fa293…5d57` |
| mirror_r_blue_left.png | 193×163 | (79, 76) | `bed6fa02…bb53`（separate_blue_leftと同じ） | `424fa293…5d57` |
| mirror_r_red_left.png | 193×163 | (79, 76) | `0a0fc35ddec5da9c89081462fe699c3019233efd1823207ced6f3e0b0d11b87e` | `221cb9a7…5d56` |
| mirror_r_blue_right.png | 193×163 | (79, 87) | `09e675f6c2237ffed080c47f1dcd33d348e033ce9735b869da56dd998a235558` | `87f9f145…1a76` |

## 変わっていないもの

07C1の時点（`4ba8115`）と比べて、pixel SHA-256とfile SHA-256の両方が一致した:

- `separate_red_left.png`、`separate_blue_right.png`
- `mirror_l_red_left / red_right / blue_left / blue_right.png`
- idleの `red.png` / `blue.png`

`src/game/presentation/tsuppariGateArt.ts` では、変わった6件のsize / pivotだけを更新した。

# Recolor / Mask

recolor ruleは変えていない。

| pose | mask px | missed（上限60） | fringe（上限120） |
|---|---|---|---|
| red_right（新）/ 反転 | 2264 | 20 | 83 |
| red_left / 反転（不変） | 2239 | 17 | 48 |

- `mawashi_mask_diagnostics.png` を目視した。maskはまわしの帯だけにかかっていて、skin、hair、腕への混入はない
- recolor後のmean hueは215.9°
- 「alphaが変わらない」「mask外の画素が変わらない」は、既存のtestでPASSした
- `test_real_masks_cover_the_mawashi` のred_rightの期待値を、新しいposeの値に更新した

# Gameplay Change（reachだけ）

| | 旧 | 新 |
|---|---|---|
| `TSUPPARI_HAND_REACH` | 0.525 m | **0.55 m** |
| 体の半径が同じときの中心距離しきい値（+ BODY_RADIUS 0.35） | 0.875 m | **0.90 m** |

- 命中の規則は変えていない: `centerDistance <= TSUPPARI_HAND_REACH + receiver.bodyRadius`。中心距離で判定し、spriteの形は使わない
- `src/game/sumo/BoutSimulation.ts` の差分は、この定数とコメントの2行だけ
- 次のものは変えていない:
  - Push、impulse、coupled share
  - cooldown、startup / active / recovery
  - buildup（5回の普通の命中 → 6回目でKuzushi）
  - Counter、contest、clamp / decay、ring-out
- `src/game/input/` と `src/game/scenes/` の差分は0行
- `pushDummyController` のテスト（`DUMMY_TSUPPARI_RANGE` 0.8 < reachのしきい値）は、そのままPASSした
- `docs/ARCHITECTURE.md` の命中の説明を、0.55 m / 0.90 mに更新した（Provisional）

## Focused Reach Tests（`src/game/sumo/BoutTsuppari.test.ts`）

既存のtestは弱めていない。

- **TS17**（更新）
  - `TSUPPARI_HAND_REACH === 0.55`、しきい値0.90
  - しきい値 −1e-6 なら命中、+1e-6 なら空振り
- **TS17b**（追加）
  - 0.876 / 0.89 / 0.899 mでは、左右どちらの手でも命中する。impulseは満額のJ、buildupは1
  - 0.901 / 0.95 mでは空振りで、impulseは0
- **TS24b**（追加）
  - 0.89 m（体は接触していない）からのTsuppariを、Counterが捕まえる
  - 攻撃側はその場でKuzushiになる。受け手にimpulseは入らず、buildupは0、Counter遷移は起きない
- **TS36b**（追加）
  - reach以外のTsuppari定数が変わっていないことを確かめる: 6 / 1 / 9 tick、cooldown 60、impulse 2.13、share 0.5、buildup 5、BODY_RADIUS 0.35、Counter window 12
- 変えずにPASSしたtest
  - 接触距離での普通の命中（TS15）
  - 非接触の命中（TS16）
  - 1.0 mでの空振り（TS14 / TS25）
  - Push / Tsuppariの相互作用（TS31〜TS36）
  - Counter（TS21〜TS26）
- TS17b、TS24b、TS17の新しい境界は、旧reach（0.875 m）のままだと失敗する。新しい帯を実際に検証している

# Offline Preview（`tools/wrestler_art/output-tsuppari-gate.local/`、git-ignored）

- 全sheetを作り直した:
  - pivot guide 4枚
  - mode_separate / mirror_l / mirror_r
  - idle_tsuppari_alignment
  - rotations ×3
  - faceoff ×3
  - mawashi diagnostics
  - blue reference vs derived
  - json / manifest
- faceoffの距離は、recipeの `faceoff` を「contact 0.70 m / **tsuppari reach 0.90 m**」に更新した（README内の説明も同じく更新した）
- 0.90 mのfaceoffでは、新しいright（とblue-left）の手先が、相手の体に届いて見える
- `mode_separate.png`: 新しい右腕は、旧候補より短くなっている。左腕と見比べやすくなった
- MIRROR-Lのsheetも作り直したが、元になるtextureは変わっていない

# Verification

| 項目 | 結果 |
|---|---|
| `test_export_tsuppari_gate.py`（focused） | 19 tests OK |
| wrestler-art全suite | 144 tests OK |
| `export_tsuppari_gate.py --check` | exit 0 |
| `BoutTsuppari.test.ts`（focused） | 45 tests PASS（追加3件を含む） |
| `pnpm test` | 22 files / 350 tests PASS |
| `pnpm build` | PASS（以前からあるchunk size警告だけ） |
| `git diff --check` | OK |
| idleの `red.png` / `blue.png` | pixelもbyteも変わっていない |
| gameplay sourceの差分 | `BoutSimulation.ts` の定数とコメントの2行だけ。input / scenesは0行 |

# Browser / Runtime Smoke

- `pnpm dev`（port 5199）+ headless Chrome（CDP）
- 07C1のsmokeに、新しいsize / pivotと、reachの確認を加えた
- 結果: **52 / 52 PASS**
  - 途中の実行で、in-gameの距離判定に関わるFAILがあった。どれもscript側の問題（打撃後の距離を記録していた、0.875〜0.90 mの帯に止められなかった）で、直してから再実行した

| 確認 | 結果 |
|---|---|
| 12枚が読み込まれ、実寸がexportと一致する（新right系は193×163、MIRROR-Lは198×177） | PASS |
| Enterで開始、debug、key 4で3 modeが順に切り替わる。Snapshotは変わらない | PASS |
| SEPARATE Left → `separate_blue_left`（新しいred-rightの反転）。origin = (79, 76) | PASS |
| dummy 3: CPU redで `separate_red_right`（新）が出る。位置、facing、scaleは正しい | PASS |
| 3 mode × 左右: poseが行動全体で保たれ、終わるとidleに戻る。位置 = center、scale 1.0 | PASS |
| 実行中のgame moduleで、`TSUPPARI_HAND_REACH` = 0.55、しきい値 = 0.90 | PASS |
| 同じmoduleで、0.86 / 0.875 / 0.88 / 0.89 / 0.899 mは左右とも命中、0.901 / 0.91 mは空振り | PASS |
| in-gameで静止状態から打つ: **0.8833 m → 命中**（旧reachなら空振りの距離）、0.9292 m → 空振り。すべての打撃が「命中 ⇔ 距離 ≤ 0.90」に従う | PASS |
| Push / Counter / Gripが使える。idle / move sprite。R restart | PASS |
| console error、失敗したrequestが無い | PASS |

- in-gameで距離を合わせるのは、keyのタップ単位（1回で約2.5〜3.5 cm）で行った
- `06_reach_0895.png`（0.883 mで命中）: debugに「TSU L HIT」と出ていて、手先が相手に届いて見える

# Changed Files

- `src/game/sumo/BoutSimulation.ts`（reachの定数とコメント）
- `src/game/sumo/BoutTsuppari.test.ts`（TS17を更新。TS17b / TS24b / TS36bを追加）
- `docs/ARCHITECTURE.md`（reachの値）
- `tools/wrestler_art/tsuppari_gate_recipe.json`（red_rightのidentity、測定値、evidence。faceoffの距離を0.90 mに）
- `tools/wrestler_art/tests/test_export_tsuppari_gate.py`（red_rightのmask期待値）
- `tools/wrestler_art/README.md`（faceoffの距離の表記）
- `src/game/presentation/tsuppariGateArt.ts`（6件のsize / pivot）
- `public/assets/action/wrestler/tsuppari-gate/` の6枚
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

## 変更していないファイル

- `src/game/input/`、`src/game/scenes/`
- red-leftとauthored-blueの候補
- idle art、MIRROR-L、key 4の切り替え
- `WRESTLER_PRODUCT_ART_SPEC`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md`、`main`

# Measurement-Method Note

- 07C1で校正した方法（7 px opening）を、そのまま使った。recipeの `measurement_evidence.remeasured` に記録した
- 07C1のposeを測り直すと、recipeの値が完全に再現される
- recipe冒頭の `measurement.method` の説明（「7 px erosion」）は、07C1のreviewの方針どおり、まだ直していない
- 測定helperは、今回もrepositoryに追加していない（scratchpadのみ）
- Productへ昇格させる時に、説明と実装を正式に揃える必要がある

# Design Deviations

Design Deviations: NONE

# Unexpected Scope

NONE（07C1で記録した「測定helperがcommitされていない」件は、引き続き先送りしている）

# Known Untested Items

- 実機でのUser Visual Gate / Play Test。次の点はheadlessでは判断できない:
  - 新しい右腕の長さが左腕とつり合って見えるか
  - 0.90 mのreachの手触り（届きすぎや空振りの感覚）
  - 打撃のリズム
- headlessのsmokeが確かめたのは、textureの選択と配置、reachの規則まで

# User Visual Gate / Play Test: REQUIRED

確認の手順:

1. `pnpm dev` → Enter → debug `0` → key `4` でSEPARATEにする
2. ArrowLeft / ArrowRightで打つ。dummy `3` にすると、CPUの左右の打撃を繰り返し見られる

見てほしい点:

- 新しい右腕（red right / blue left）の長さが、左腕に近く見えるか
- idle → pose → idleで、位置やscaleが飛ばないか
- reachが前より少し長く感じられるか。0.88〜0.90 m付近で届くことが自然に見えるか
- Push / Counter / Gripの手触りが変わっていないか

SEPARATE is still a User preference, not yet promoted to permanent Product baseline.

# Git Delivery

- stageするのはTask-owned fileだけ。commit `art(action): refresh right tsuppari pose and tune reach` → fetch → fast-forwardできることを確認 → push `origin/develop` → remote SHAを確認 → working treeがcleanか確認
- `input.local/`、`output-*.local/`、`main`、`PROJECT_HANDOFF.md`、`CURRENT_TASK.md` は変更しない
