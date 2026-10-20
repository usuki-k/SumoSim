Task-ID: ACTION-ART-01B-PRODUCT-BACKGROUND-INTEGRATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 294530e8adfd3f5402b043583032d766dc0d150c
Agent-Start-Head: 0b515e407f7ae19becd59ea0faa1c1cbea3eb02f
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS。

**実装したこと**
- 受理済みのCandidate Cから、runtime assets（`arena_base_1920.png` と `dohyo_ring_overlay_1920.png`）を決定的に再生成し、commitした
- Phaserで、logical 1920×1080、ring中心 (960, 540)、半径400pxの1:1対応で、2つの層として表示する
- 従来のGraphics土俵は削除した
- debug（key `0`）で、Simulationの正確な境界をProduct artの上に重ねて表示する

**検証**
- art ↔ Simulation の一致を、runtime overlayの画素で数値的に確認した
  - 7144の角度と8本の側端で、Simulationの境界の外にtawaraは一切なく、境界の内側には必ずtawaraがある
- `pnpm test` 240件PASS、`pnpm build` PASS、`tsc --noEmit` PASS、Python 51件PASS、`git diff --check` PASS
- gameplayは未変更

**Known Untested**
- 実ブラウザでの描画smokeは **NOT RUN**（ブラウザ操作の手段がない）
  - dev serverで、module変換とassetsの配信（HTTP 200、配信されたPNGのsha256がcommitしたものと一致）だけを確認した
- **User Visual / Play Test: REQUIRED**

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `294530e`（ancestor）、Handoff-Mode GITHUB
- `294530e..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `0b515e4`
- 実入力 `input.local/arena_base.png` と `tawara_source.png` の存在を確認した

# Candidate C Regeneration

使ったcommand：

```
tools/dohyo_art/.venv/Scripts/python.exe tools/dohyo_art/compose_dohyo.py \
  --arena-base tools/dohyo_art/input.local/arena_base.png \
  --tawara-source tools/dohyo_art/input.local/tawara_source.png \
  --output-dir tools/dohyo_art/output-product-c.local \
  --arena-scale 1.0952 --arena-offset-x 5.48 --arena-offset-y 95.28 \
  --tokudawara-depth 42 --tokudawara-half-angle-deg 9
```

- 既存の出力6種（arena / overlay / guide / composite の master、overlay_1920、preview_1920）は、受理時の `output-tokudawara-c.local/` と **byte一致**した
  - 「再生成したCandidate Cが予期せず異なる」という状況は起きていない
- 同じcommandで別dirへ再実行し、`build_manifest.json` と `arena_base_1920.png` が **byte一致**した

## Local Generated / Committed Runtime Assets

| File | Size / Mode | SHA-256 |
|---|---|---|
| `public/assets/action/background/arena_base_1920.png` | 1920×1080 RGB | `07e7f5b2b25483ccc2578426a02045dd7653dd78083e2807ba560cc3392aeaa5` |
| `public/assets/action/background/dohyo_ring_overlay_1920.png` | 1920×1080 RGBA | `d14ee82807763c1dcd8c20a749f1f52cc004de0f67c4678f2e0d339463a58680` |

- どちらも `output-product-c.local/` にある同名ファイルと、sha256が一致する
- PNGにmetadataはない
- master画像、guide、manifest、入力は `public/` に置いていない

# Python Tool Change

- `OUTPUT_ARENA_1920 = "arena_base_1920.png"` を追加した
  - `arena_base_master.png` をBOX（2×2の正確な平均）で縮小する。overlay / previewの1920と同じ方式
  - 追加の再描画はしない
- `BuildResult.images` と manifest `outputs` に追加し、manifest schemaを 3 → 4 にした
- Tests（51件PASS）
  - 出力の集合とサイズ（480×270、RGB）、CLIのfull sizeの出力一覧（1920×1080）
  - 新規 `test_runtime_arena_is_exact_2x_box_downscale_of_master`
    - 恒等とalignment付きの両方で、`master.resize(BOX)` とpixel hashが一致する
    - 2×2の平均と±1以内で一致する
    - 決定的で、manifestにも記録される
  - 既存のTokudawaraと円の互換test（旧版のhashを固定したものを含む）はPASSのまま
- README: runtimeの層と正規のCandidate C command、出力表に `arena_base_1920.png` を追加、schema 4

# Phaser Integration

- `src/main.ts`
  - logical sizeを `PRODUCT_ART_WIDTH × PRODUCT_ART_HEIGHT` = **1920×1080** にした
  - `Scale.FIT` と `CENTER_BOTH` はそのまま
- `src/game/presentation/productArena.ts`（新規、Phaser非依存）が、art contractを持つ
  - `PRODUCT_ART_CENTER (960, 540)`、`PRODUCT_RING_RADIUS_PX 400`、`PRODUCT_TOKUDAWARA_DEPTH_PX 21`、`PRODUCT_TOKUDAWARA_HALF_ANGLE π/20`
  - `productPixelsPerMeter(arena) = 400 / arena.radius`
- `src/game/scenes/DohyoView.ts`
  - `preloadProductDohyo`: Phaser 4.2.1の `scene.load.image(key, url)`（installed typesで確認）で読み込む
    - URLは `${import.meta.env.BASE_URL}assets/action/background/...`
  - `addProductDohyo`: 2枚を `scene.add.image(960, 540, key).setOrigin(0.5)` で、art pixelに1:1で置く
    - depthは arena base 0、overlay 0.5（WrestlerViewの影1と体2より下）
  - 従来の `drawDohyo`（Graphicsの土・俵・仕切り線）は **削除** した。ringの見える正本が二重にならない
  - `arenaBoundaryOutline` と `drawArenaBoundaryDebug` は残した
    - debugの線は高コントラストのmagenta、3px、0.25°刻み。窓の端は厳密な頂点にしてある
- `src/game/scenes/BoutScene.ts`
  - `preload()` を追加した
  - 原点 = `PRODUCT_ART_CENTER`、`pixelsPerMeter = productPixelsPerMeter(snapshot.arena)`（= 175.824…）
  - `RING_FILL_RATIO` は削除した
  - 既存のprototype / debug textだけを1920用に調整した（font sizeを約2倍、縁取り、位置）
  - 新しいUIは作っていない
- 力士: `bodyRadius × pixelsPerMeter` で、直径は **約123.1px**（0.7 m）。bodyRadiusは変更していない
- 新しいdependencyはない

# Logical Resolution / Mapping

- 2.275 m → 400.0 px
- Tokudawara 0.1194375 m → 21.0 px
- halfAngle π/20 = 9°

`productArena.test.ts` で、art contractとSimulationの値の一致を確認している。
- 半径と徳俵の深さは1e-12まで一致
- 42/800の比率、力士の直径約123px、Phaser非依存であること

# Debug Boundary Alignment Method

**数値的な検証**（runtimeのoverlay PNGと、Simulationの幾何をppm 400/2.275で写したもの）

- 側端の±0.2°を除く7144の角度で調べた
  - 境界 + 1.5px のalphaが0でない角度: **0**
  - 境界の内側20px以内に俵がない角度: **0**
- 8本の側端（4方向 × 2）
  - 窓の内側の帯（R+1〜R+D−1）の最小alpha: 187 / 249
  - 窓の外側（r > R+2）の最大alpha: **0**
- debug表示の線は、同じ `arenaBoundaryOutline` を同じ原点とppmで描く。そのため、表示上も同じ境界に重なるはず
- 目視での確認は、User Play Testの 7〜10 で行う

**runtimeの2層と、受理済みpreviewの比較**
- `arena_base_1920` に `overlay_1920` をalpha合成した結果と、受理済みの `composite_preview_1920` の差は、最大3/255（平均0.017）
- 「合成してから縮小する」と「縮小してから合成する」の丸めの差で、見た目は同じ

# Tests / Build

| 項目 | 結果 |
|---|---|
| `pnpm test` | **240 passed**（15 files。新規 `productArena.test.ts` 3件） |
| `pnpm build` | PASS。`dist/assets/action/background/` に2枚が出力される（chunkサイズの警告は以前からのもの） |
| `tsc --noEmit` | PASS |
| Python `tools/dohyo_art` | **51 passed** |
| `git diff --check` | PASS |
| runtime assetのsize / hash | 上の表のとおり。再生成したものと一致 |
| package / lockfile | 未変更 |

# Browser Smoke

**NOT RUN**（この環境には、Phaserのcanvasを表示して操作する手段がない）。

代わりに、dev server（vite）で次を確認した。
- `/`、`main.ts`、`BoutScene.ts`、`DohyoView.ts`、`productArena.ts` がHTTP 200
- 2枚のPNGが `image/png` で200。配信されたarena PNGのsha256は、commitしたものと一致

canvasの16:9表示、引き伸ばしや黒い縁がないこと、操作、debugの切り替え、console errorの有無は、User確認で見ていただく必要がある。

# User Visual / Play Test — REQUIRED

`pnpm dev` で起動する。

**debug OFF**
1. 16:9で歪みなく表示される
2. 受理済みのCandidate Cのpreviewと同じ見た目
3. 4つの徳俵が、描かれた石枠の内側に収まる
4. 暫定の力士の大きさ
5. 古い土俵の描画が重なっていない
6. 操作が効く

**key `0` で debug ON**
7. magentaの線がProductのringに重なる
8. ±X / ±Y の徳俵
9. 斜め（通常の円の部分）
10. Ring-outが、見えている境界で起きる

あわせて報告をお願いします：
- 1920×1080での動作の重さ
- 背景の解像感（ぼけすぎ / 鋭すぎ）
- 暫定の力士が、背景の品質と比べて見劣りするか（後続の力士Product art Taskの判断材料。本Taskでは修正しない）

# Changed Files

- `tools/dohyo_art/compose_dohyo.py`
- `tools/dohyo_art/tests/test_compose_dohyo.py`
- `tools/dohyo_art/README.md`
- `public/assets/action/background/arena_base_1920.png`（新規）
- `public/assets/action/background/dohyo_ring_overlay_1920.png`（新規）
- `src/main.ts`
- `src/game/presentation/productArena.ts`（新規）
- `src/game/presentation/productArena.test.ts`（新規）
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `docs/ARCHITECTURE.md`（最小限の同期）
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

# Design Deviations

Design Deviations: NONE

補足（Taskの範囲内で選んだ細部）：
- 座標の対応を、小さなpure module `src/game/presentation/productArena.ts` に置いた
  - Taskの「Product artの定数から導く小さな明示的mapping」を、testできる形にするため
- `docs/ARCHITECTURE.md` を最小限で同期した
  - 予定のfile一覧にはないが、「logical sizeは暫定」「DohyoViewがGraphicsで俵を描く」という記述が、今回の変更で事実と異なるため
  - 変えたのは該当の3か所と、Product背景の1項目の追加だけ

# Unexpected Scope（報告のみ）

- 1920のlogical sizeでは、debug用の接触円の輪郭（2px）がやや細く見える可能性がある。debug専用なので変更していない
- `arena_base_1920.png` は約2.5MB（PNG）。圧縮やasset pipelineはScope外なので変更していない。配信サイズの最適化は将来のTaskの候補

# Git Delivery

- Commit: `feat: integrate product dohyo background`（Task-ownedの12ファイルのみ）
- `input.local/` と `output*.local/` はignoreされており、stageしていない
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
