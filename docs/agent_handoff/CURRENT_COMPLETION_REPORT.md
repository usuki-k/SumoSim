Task-ID: ACTION-11E-GRIP-SUCCESS-PAIR-OFFSET-TUNE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: 4db810ed790434e4b73186297faa7a2727f440c0
Agent-Start-Head: 4db810ed790434e4b73186297faa7a2727f440c0
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - `pnpm test` / `pnpm build` / `git diff --check`はPASS
  - Browser Smokeは15 / 16で、唯一のFAILは既存の`/favicon.ico` 404（Task外、ACTION-11Dと同じ）
- 見た目の受け入れは、User Visual Gateで判断する

Grip successのposeを表示しているあいだだけ、2人の表示位置を、各力士自身の左へ0.30 Rずらす。presentationだけのpair offsetで、Simulationの位置・bondの距離・facingは変えていない。向かい合った2人は点対称にずれるので、頭は軸上で鼻先同士にぶつからず、互いに相手の肩口へ入る。

左右のoffsetだけで改善できたので、Stop条件（回転・別画像・Gameplay変更が必要）には当たらない。

# Handoff note

- このTaskはUserがチャットで直接指示したもの。remoteの`CURRENT_TASK.md`はACTION-11D（Status: REVIEWED）のままで、ACTION-11Eはqueueされていない
- Preflight: working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 1`
  - `5f10b3e..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `4db810e`
- ACTION-11D Reviewとの整合: Next Task Constraintの「頭をずらしたいなら、gameplayの幾何を変える前に、presentation-onlyのpair offset / rotationを調べる」に沿う。Do Not Reopen（11Cのgameplay、0.70 mのbond、Grip attempt art、Push / Tsuppari / Counter / Kuzushi）には触れていない
- `CURRENT_TASK.md`は編集していない

# 原因と設計

- ACTION-11Dの構造: blueはredのlocal-Y反射なので、向かい合ったペアは中央の垂線について鏡映対称になる
  - 実測: success textureの頭（髪の塊）は、どちらも自分の中心から約0.22 R横にある。その結果、world上で2つの頭が同じ高さに来て、鼻先同士でぶつかる
- 対策: 各力士を、自分のcanonicalなfacingに垂直な方向へ、同じlocal offsetでずらす
  - 向かい合う2人のlocal軸は逆向きなので、world上の移動は逆向きで同じ大きさになる（点対称。pairの中点は不変）
  - 頭は横に2 × 0.30 R = 0.60 Rすれ違う
- 符号と量はoffline合成で比較して選んだ（±0.15〜0.55 R、scratchpadの`offset_sheet.png` / `offset_sheet2.png`）
  - 右（+）へずらすと、頭が体の外側へ逃げて、すれ違うように見える
  - 左（−）へずらすと、頭が相手の肩口へ入り、体の重なりも自然に見えた
  - 0.30 Rより小さいと頭がまだ触れ合う。大きいと体同士が離れて見える
  - 暫定値として−0.30 Rを採用した

# Implementation

`src/game/presentation/gripSuccessGateArt.ts`（Phaser非依存）:

- `GRIP_SUCCESS_LATERAL_OFFSET_R = -0.3`: R単位のlocal横offset。+は力士の右で、Kuzushiの汗と同じ規約
- `gripSuccessDisplayOffsetPx(state, facing, bodyRadiusPx)`:
  - success poseのとき（`pose === 'grapple' || pose === 'drive'`。success textureの選択と同じ判定`isGripSuccessPose`）は、`(−l·sin f, l·cos f)`を返す
  - それ以外は`(0, 0)`
- `selectWrestlerArt`は、同じ判定関数を使うようにしただけで、挙動は不変

`src/game/scenes/WrestlerView.ts`:

- `apply`でoffsetを1回求め、体と影の位置に同じ量を足す。影の相対位置は不変
- 回転・scale・texture・Kuzushiの汗の配置は不変
  - 汗はpose = kuzushiのときだけで、そのときoffsetは0
- releaseの最初のframeでposeがgrapple / driveでなくなるので、offsetは即0になる

変えていないもの:

- Simulationの位置・速度、facing、bond、接触、Grip / Drive / releaseのgameplay
- textureとsource art、exporter、recipe

# Verification

| 項目 | 結果 |
|---|---|
| `gripSuccessGateArt.test.ts` | 17 / 17 PASS（ACTION-11Eで5件追加） |
| `pnpm test` | 29 files、503 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiff | 0行 |

追加したtest（ACTION-11E）:

- offsetは力士自身の左向き、大きさ0.30 R、facingに垂直（前後成分0）
- 向かい合ったpairでは、2人のoffsetの和が0（点対称）、差が0.60 R
- grapple / Drive中（40 tick）/ Morozashiで常にoffsetあり。offsetの有無は、success textureの有無と常に一致する
- 次の場面では常にoffset 0: Grip attempt中、release tickとrecovery 12 tick、Tsuppari / Counter / Kuzushi / Push / idle
- Snapshotは不変、bondの距離は0.70 mのまま

# Browser / Runtime Smoke

headless Chrome 156 + CDP、GPU（`--use-angle=d3d11`）、Vite dev server、1920x1080。ACTION-11Dのscriptに、offsetと影の確認を足して実行した。結果は **15 / 16**:

| # | 確認 | 結果 |
|---|---|---|
| 1 | Enterでboutが始まる | PASS |
| 2 | Shiftでattempt pose。attempt中はoffset 0 | PASS |
| 3 | 接触からのGripで、neutral grapple | PASS |
| 4 | 両者が同じframeでsuccess textureに切り替わる | PASS |
| 5 | 体の回転 = canonicalなfacing（A 0、B π） | PASS |
| 6 | bondの距離は0.70 mのまま（Simulation） | PASS |
| 7 | free中はcanonicalな位置。success中は自分の左へ0.30 R（R = 61.54 px → 18.46 px。Aは上へ、Bは下へ）で点対称。影も同じ量だけ動く | PASS |
| 8 | scaleが跳ばない | PASS |
| 10 | pivot originが正しい | PASS |
| 11 | Drive中（230 frame）もsuccess textureとoffsetが保たれる | PASS |
| 12 | Morozashiでも同じtextureとoffset | PASS |
| 13 | releaseの最初のfree frameからoffset 0、idle sprite | PASS |
| 14 | release後の新しいGripは、attempt → success | PASS |
| 15 | Tsuppari / Counter（35°）/ Kuzushiの汗 / Pushは不変、offset 0 | PASS |
| 16 | Rでrestartできる | PASS |
| 17 | console error・例外が無い。gate PNGは200 | FAIL: `/favicon.ico` 404が1件。既存の問題で、Task外（ACTION-11Dと同じ。`public/`にfaviconが無い） |

Screenshot（ローカルのscratchpad `smoke11e\`、commitしない）:

- `01_neutral_immediately_after_success`
- `02_neutral_settled`
- `03_drive_while_grappled`
- `04_morozashi_grapple`
- `05_immediately_after_release`
- 一覧: `pair_sheet.png`

目視の所見（判断ではなく観察）:

- 頭は中央の軸から外れた。blueの頭は上側でredの肩口へ、redの頭は下側でblueの胸・肩口へ入る。鼻先同士の衝突は無くなった
- 肩・腕の重なりは保たれ、Drive中・Morozashiでも同じ見え方
- releaseの瞬間は、2人がcanonicalな位置へ0.30 Rずつ戻る。idle spriteへの切り替えと同じframeで起こる。Taskの「releaseで即解除」どおりで、補間は無い

# Changed Files

- `src/game/presentation/gripSuccessGateArt.ts`: offsetの定数と`gripSuccessDisplayOffsetPx`、判定の共通化、header comment
- `src/game/presentation/gripSuccessGateArt.test.ts`: ACTION-11Eのtest 5件と、WrestlerViewの配線のassertion
- `src/game/scenes/WrestlerView.ts`: 体と影にoffsetを足す。header comment
- `docs/ARCHITECTURE.md`: ACTION-11Dのnoteの「pair offsetは無い」を外し、ACTION-11E（暫定）のnoteを1項目追加
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

補足: 影も体と同じ量だけずらした。影は体の真下に置くための見た目で、gameplayとは無関係。体だけずらすと影が体から外れるため。

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない

# Known Untested Items

- Grappled Orientationの回転中（turning）は、2人のfacingが軸と揃わない。そのあいだはoffsetが厳密には点対称にならない。各自のfacingに沿ってずれるだけで、破綻の心配は少ないが、目視では確かめていない
- 実機のTouch入力

# User Visual Gate: REQUIRED

- 頭が少し左右へ逃げ、肩側で組んでいるように見えるか
- 0.30 Rの量は適切か。小さく / 大きく、の希望があれば定数1つで調整できる
- Drive中、Morozashiで破綻しないか
- releaseで2人が0.30 Rずつ元の位置へ戻る動きが気にならないか
- turning中の見え方

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): add grip success pair offset`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
