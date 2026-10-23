Task-ID: ACTION-11N-GRIP-SUCCESS-LOWER-MARKER-REFLECTION-TUNE
Result: PASS WITH USER VISUAL GATE REQUIRED
Branch: develop
Source-Baseline: c3d11081693f80bfc77a1cebece5c55cd32c9ba7
Agent-Start-Head: 6d6f081307f66c99e6ed00ec48102d97fb9b3d89
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH USER VISUAL GATE REQUIRED:

- Technical PASS
  - focused / full test、`pnpm build`、`git diff --check`、Browser Smoke 27 / 27（GPU、turningを含む）がすべてPASS
- 見た目の受け入れは、User Visual Gateで判断する

下側（足の側）の2つのmarkerだけを変えた。

- 画像の反転: 既存のauthored / mirroredのvariantを入れ替えた
- 肘の位置: 参照画像に合わせた

結果、前腕はまわしから脇の下側の縁に沿って前へ伸び、力こぶは外側の縁に来る。Userの参照画像の下の腕と同じ流れ。

拳はまわしの同じ点のまま。上側の2つ、作者画像のpixel、ゲームプレイ、ACTION-11F / 11H / 11Jは変えていない。

まわしに対する角度は約76°で、Taskの30–45°から外れる。Userの確認を取った上での選択（Design Deviationsを参照）。

# User Play Test follow-up（同じTask内の追加修正、2 commit目）

最初のcommit（`95b5802`、下の各節の内容）をpushした後、UserがPlay Testで違和感を報告し、2枚目の参照画像を貼った。

- 参照画像の内容: 上下とも、相手（markerが乗る力士）の**肩の横から腕が出て**いて、まわしの拳へ向かう

Userの直接の指示で、上下4つとも次の配置（候補P1）に変えた。

- 上側も変えたので、Taskの「上側は固定」から外れる（Design Deviationsを参照）
- offline比較: `m11o_a_grid.png`（0 = 最初のcommit、P1–P4 = 絵の向きの組み合わせ）。Userが「P1を今すぐ実装」を選んだ

最終の配置（markerが乗る力士のlocal、R単位）:

| 絵 | 役割 | 拳 | 肘 | texture | 肘→拳 | まわし（local横軸）との角度 |
|---|---|---|---|---|---|---|
| red | 頭の側（上） | (−0.40, +0.80) | (0.25, +1.15) | authored | 0.74 R | 61.70° |
| red | 足の側（下） | (−0.55, −0.45) | (−0.05, −0.95) | mirrored | 0.71 R | 45.00° |
| blue | 頭の側（上） | (−0.40, −0.80) | (0.25, −1.15) | mirrored | 0.74 R | 61.70° |
| blue | 足の側（下） | (−0.55, +0.45) | (−0.05, +0.95) | authored | 0.71 R | 45.00° |

配置の結果:

- 肘はどれも、力士の前寄りの輪郭上か、その少し外（中心から0.95–1.18 R）。拳より外側・前側
- 掴む側の力士（前方約1.72 R）からは1.5 Rより遠い
- 上側: 上腕が上の縁に沿って前へ伸び、前腕がまわしの上側の拳へ下りる
- 下側: 肘・力こぶが下の縁のすぐ外に出て、前腕がまわしの下側の拳へ上がる
- 拳もまわしの上で少し動いた
  - 上側: 上の縁寄り(−0.40, ±0.80)
  - 下側: 下寄り(−0.55, ±0.45)
- 絵は、既存のauthored / mirroredの2枚の選択だけ。pixel・anchor・exporterは不変

検証（2 commit目）:

- markerのfocused test: 18 / 18 PASS
  - 4つの値の完全一致
  - blueはredの鏡像
  - 肘は肩の横（輪郭上か外）
  - 反転で拳が動かない
  - 角度・長さ（0.65–0.75 R）
  - 表示 / 非表示の規則
- `pnpm test` 523 PASS、`pnpm build` PASS、`git diff --check` clean
- `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiffは0
- Browser Smoke **27 / 27 PASS**
  - READYで4つ、値どおり
  - TURNINGの132 frameは0
  - release / 他のactionで0
  - console errorなし（`/favicon.ico` 404は除外）

Screenshots（scratchpad、commitしない）:

- 8枚と一覧: `smoke11n2\`
- 拡大: `smoke11n2\zoom_02.png`
- 最初のcommitとの比較: `smoke11n2\before_after.png`

以下の各節は、最初のcommit（`95b5802`）の記録として残す。

# Preflight / reference

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Source-Baseline `c3d1108`（ancestor）、Handoff-Mode GITHUB
- `c3d1108..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `6d6f081`
- 参照画像:
  - Taskが言う「Userの最新の参照画像」は、Repositoryにも手元にも無かった
  - 候補の比較（下記）を見たUserが、chatで参照画像を貼った。redのsuccess poseに、両手がまわしを掴む絵
  - 下の手の読み取り: 拳はまわしの下側。前腕は体の下側の縁に沿って前（頭の側）へ伸び、肘と力こぶは前寄りの下側で体の輪郭の内側

# Reflection candidates compared

拳の位置と肘の方向を固定すると、「左右反転」「上下反転」「両方」は、どれも次のどちらかと同じになる。

- 元の絵
- 反転した絵（両方の反転 = 180°回転なので、回転で吸収される）

そこで、絵の向き2通り × 肘の置き方で比べた。

1回目（`m11n_cands_grid.png`）:

| 候補 | 肘 | 絵 | 結果 |
|---|---|---|---|
| A | 背中の中央(−0.03, ±0.06) | ACTION-11Mの向き | 11Mのまま |
| B | 背中の中央 | 反転 | 上腕の端が背中の上方へ |
| C | 腰の外(−0.03, ±1.18) | ACTION-11Lの向き | Userの判断: 「一番近いが、参照画像を貼る」 |
| D | 腰の外 | 反転 | 上腕が下の外へ突き出す |

参照画像を受けて、2回目（`m11n_b_grid.png`）:

| 候補 | 肘 | 絵 | まわしとの角度 |
|---|---|---|---|
| 1 | C（11L） | 11L | 36.87° |
| 2 | 45°で外 (0.045, ±1.115) | 11L | 45° |
| 3 | 45°で外 | 反転 | 45° |
| **4** | **前寄りの下側 (0.23, ±0.79)** | **11Lの向き = 11Mから見て反転** | **75.96°** |
| 5 | 前寄りの下側 | 11Mの向き | 75.96° |

- 30–45°に収めると（候補1–3）、肘は腰の外に出て、参照画像の「体の縁に沿う」腕にならなかった
- **候補4**が参照画像に一致した
- Userに確認した: 「4は参照画像に近いが30–45°から外れる（約76°）」→ Userの回答「4で進める」

# Selected method

- 方法: offlineのvariant。既存の`forearm_hand.png` / `forearm_hand_mirrored.png`（ACTION-11Lで書き出し済み）のどちらを使うかを、下側だけ入れ替えた
- runtimeでの反転、新しいasset、作者画像のpixelの変更は無い

| 絵 | 下側の絵 11M → 11N | 下側の肘 11M → 11N | 拳（不変） |
|---|---|---|---|
| red（足の側 = 左） | authored → **mirrored** | (−0.03, −0.06) → **(0.23, −0.79)** | (−0.45, −0.62) |
| blue（足の側 = 右） | mirrored → **authored** | (−0.03, +0.06) → **(0.23, +0.79)** | (−0.45, +0.62) |

下側の結果:

- 肘→拳: (−0.68, ±0.17)
- 長さ: 0.701 R（0.65–0.75の範囲内）
- まわし（local横軸）に対する角度: **75.96°**
- 拳は、腰の後ろ半分のまわしの上。11Mと同一
- 肘は、markerが乗る力士の体の内側（中心から0.82 R）。掴む側の力士（前方約1.72 R）からは1.5 Rより遠い

上側（頭の側）は、ACTION-11L / 11Mと同一（test `11M-1`）:

- red: 右、authored、拳(−0.45, +0.62)、肘(−0.03, +1.18)
- blue: 左、mirrored、拳(−0.45, −0.62)、肘(−0.03, −1.18)
- 36.87°、0.70 R、depth 2.3
- smokeでも、Aの頭の側の拳は11L / 11Mと同じ位置(940.92, 489.54)

# Changed Files

- `src/game/presentation/gripSuccessSymbolVfx.ts`: 足の側の2つの値（肘・絵）。header commentとcomment
- `src/game/presentation/gripSuccessSymbolVfx.test.ts`: 11Nのtest（下側の値と絵、反転で拳が動かないこと、角度・長さ）
- `src/game/scenes/WrestlerView.ts`: header commentのTask名だけ
- `docs/ARCHITECTURE.md`: 記号VFXの項目の、足の側の説明（ACTION-11N、暫定）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Preservation

- ACTION-11F: `+0.14 / −0.20`は不変（test P1）
- ACTION-11H: `public/`と`tools/`のdiffは0。`export_grip_success_gate.py --check`はexit 0
- ACTION-11J: pair READYの規則は不変（V4、smoke L6）
- ACTION-11Lの作者画像: runtimeの2枚のfile SHA-256は`d94b717f…44d40e` / `e97a9f3f…bbacfe`のまま（diff 0）
- markerは4つ（G2 / V1–V3、smoke L2）
- `src/game/sumo/`・`src/game/input/`のdiffは0。Snapshotは不変、bondは0.70 m（P3 / P4、smoke 6 / 16b）

# Tests

`src/game/presentation/gripSuccessSymbolVfx.test.ts`: 18 / 18 PASS

| Task ID | test |
|---|---|
| 1 上側はACTION-11Mと同一 | `11M-1`（値と絵が完全一致） |
| 2 下側は選んだ反転だけ | `G1 / G2`（red: footSide:left:mirrored、blue: footSide:right:authored）、`11N-2 / 11N-3`（値の完全一致） |
| 3 下側の拳はまわし上 | `G3 / 11M-3`（全部(−0.45, ±0.62)） |
| 4 反転しても拳の位置は不変 | `11N-4`（同じmarkerでauthored / mirroredを入れ替えても、4つのfacingで拳・肘・長さが一致） |
| 5 角度 | `G4 / G5 / 11N-5`: 頭の側36.87°（30–45°）、足の側75.96°（Userの確認済みの逸脱）。長さはどれも0.65–0.75 R |
| 6 red / blueで決定的 | `11N-2 / 11N-3`（redとblueは左右の鏡像）、`G7` |
| 7 READYで4つ | `G1 / G2`、`V1`–`V3` |
| 8 TURNINGで0 | `V4` |
| 9 release / recovery / 他のactionで0 | `V5 / V6`、`V7` |
| 10 ACTION-11F | `P1 / P3 / P4` |
| 11 ACTION-11H | `public/`・`tools/`のdiff 0、`--check` |
| 12 Snapshot / bond | `P1 / P3 / P4` |
| 13 sumo / input | diff 0 |

offlineのvariantを使ったので、runtimeでの反転のtestは対象外。variantはACTION-11Lのexporterの出力で、そのanchorのtestは既にある。

# Verification

| 項目 | 結果 |
|---|---|
| markerのfocused test | 18 / 18 PASS |
| `pnpm test`（Grip success / attemptのpresentation、Grip / Grapple / Drive / Orientationのgameplay、Push / Tsuppari / Counter / Kuzushiのpresentationを含む） | 30 files、523 PASS |
| `pnpm build` | PASS（既存の500 kB chunk warningのみ） |
| `git diff --check` | clean |
| `src/game/sumo/`・`src/game/input/`・`public/`・`tools/`のdiff | 0行 |

# Browser / Runtime Smoke

ACTION-11Mのscriptで、足の側の期待値を11Nの値に変えて実行した。

- 判定の内容: 全frameで、textureのkey・拳の位置・回転・拡大・depth

結果は **27 / 27 PASS**。

- READY（neutral / Drive 286 frame / Morozashi / turning後）: 常に4つ。値どおり
- TURNINGの132 frameは0。READYになった最初のframeから4つ同時に表示され、以後消えない
- release / recovery / 新しいGrip attempt / Push / Tsuppari / Counter / Kuzushiで0
- ACTION-11Fのcompression / bond / 影 / 描画順、R restartは不変
- console error・例外なし（既存の`/favicon.ico` 404は除外）

Screenshots（ローカルのscratchpad、commitしない）:

- 8枚と一覧: `smoke11n\`
- neutralの拡大: `smoke11n\zoom_02.png`
- before / after（左ACTION-11M、右ACTION-11N）: `smoke11n\before_after_11m_11n.png`
- 候補の比較: `m11n_cands_grid.png`、`m11n_b_grid.png`

目視（観察）:

- 下側の2つ:
  - 前腕は、まわしの下側の拳から体の下側の縁に沿って前（2人の接点の側）へ伸びる
  - 力こぶは外側の縁に来る
  - 参照画像の下の腕と同じ流れになった
- 上側の2つは11Mと同じ
- 4つが、それぞれの力士の体の上下の縁を回り込むように見える

# Design Deviations

- **（最終）上側のmarkerも変更した**: Taskは上側の固定を求めていた
  - User Play Testの2枚目の参照画像を受け、Userの直接の指示で、上下4つともP1の配置にした
  - 最終の角度: 上側61.70°（Taskの30–45°の範囲外）、下側45.00°（範囲内）
- （最初のcommitの記録）下側の角度75.96°も範囲外だった。Userの確認済み。その内容が次の2項目
- **下側のmarkerの角度が75.96°で、Taskの「まわしに対して30–45°」の範囲外**
  - 理由: 30–45°のままでは、肘が腰の外に出て、Userの参照画像の「前腕が体の下側の縁に沿って前へ伸びる」腕にならない（候補1–3）
  - Userに候補（`m11n_b_grid.png`）を見せ、範囲外であることを伝えた上で、「4で進める」の回答を得た
  - 上側は36.87°のまま
- 下側の肘も、Taskの「小さな調整」より大きく動かした（(−0.03, ±0.06) → (0.23, ±0.79)）。同じく参照画像に合わせるため

# Unexpected Scope

- 既存の`/favicon.ico` 404。直していない

# Known Untested Items

- `export_grip_forearm_hand_gate.py --check`は実行していない
  - 前回（ACTION-11M）の後で置き直された`input.local/candidate_grip_forearm_hand_symbol.png`が、ACTION-11Lのsource（decoded `2f00cba4…`）と違う版（`5156e298…`）だったため
  - このTaskは作者画像に触れない。runtimeの2枚が不変であることは、diff 0とfile hashで示した
- 実機のTouch入力
- TURNINGは、CounterTransition後の背後からの組みの1通りだけ確認した

# User Visual Gate: REQUIRED

主な問い: 反転した下側の2つが、参照画像のとおり、相手（markerが乗る側）の肩・背中の側からまわしへ伸びて見えるか。上側は変わっていないか。

- 下側の向き・左右の向き、拳の位置
- 約76°（体の縁に沿う）でよいか
- 4つの読みやすさ
- Drive / Morozashi、TURNING中に隠れること

Technical PASSは、見た目の受け入れを意味しない。

# Git delivery

- Task-ownedのfileだけを明示的にstage → 1 commit（`feat(presentation): reflect lower grip hand markers`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
