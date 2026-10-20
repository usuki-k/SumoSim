Task-ID: ART-TOOL-01-DOHYO-COMPOSITOR
Result: PASS
Branch: develop
Source-Baseline: 1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6
Agent-Start-Head: 117c158ef0726c697e3dbe573a4328d13bdd6739
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Technical）。Product Visual Checkは未了で、User確認が必要。

- 決定的なDohyo Art Compositorを `tools/dohyo_art/` に実装した
  - Python CLI、入力検証、arena正規化、厳密な円環tawara、shikiri、geometry guide、master / 1920出力、manifest
- 実Product入力（`input.local/arena_base.png`、`input.local/tawara_source.png`）で実合成を行い、7出力を生成した
- 同一入力・同一引数で2回実行し、manifestとPNG bytesが完全に一致した
- Unit test 25件はすべてPASS
- `src/`、package、lockfile、Phaserは未変更。User画像はcommitしていない（`*.local`でignoreされる）

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 5`（local aheadなし）
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `1c5b033`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `1c5b033..origin/develop` の変更は `docs/agent_handoff/` 配下の2ファイルのみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `117c158`
- 実入力2ファイルが存在し、読み込めることを確認した
  - `arena_base.png`: 1672×941 RGB
  - `tawara_source.png`: 2172×724 RGBA

# Scope / Changed Files

| File | 内容 |
|---|---|
| `tools/dohyo_art/compose_dohyo.py` | CLI + 合成ロジック（単一module） |
| `tools/dohyo_art/tests/test_compose_dohyo.py` | `unittest`、synthetic fixture |
| `tools/dohyo_art/requirements.txt` | `Pillow==11.3.0`、`numpy==2.0.2` |
| `tools/dohyo_art/README.md` | 目的、構成、install、CLI、defaults、出力、iteration、fail-closed、tests |
| `tools/dohyo_art/.gitignore` | `.venv/`、`__pycache__/` |
| `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` | 本Report |

Helper moduleは作っていない。`input.local/` と `output.local/` はrootの `*.local` でignoreされる。

# Tool Architecture

`AI/Artist Sources -> Deterministic Geometry/Composition -> Review/Runtime Assets`

- 処理の流れ: `compose()`（純粋にin-memory。`BuildResult` = images + manifest）→ `write_outputs()`（staging後に配置）→ `main()`（CLI）
- 主要部品
  - `Geometry`: master px、centerはcanvas center
  - `TextureOptions`
  - `validate_*`
  - `normalize_arena`
  - `prepare_tawara_strip`
  - `make_seamless_tile`
  - `resolve_repeat`
  - `resample_tile`
  - `render_tawara_ring`
  - `render_shikiri`
  - `build_guide`
- Gameplay / Phaser / TypeScriptとの依存はない（testでimportを検査している）

## RobloxRtsの参照範囲

`usuki-k/RobloxRts` の `tools/card_image/` は設計方針の参考にのみ使った。
- 参考にした方針
  - runtimeの外にtoolを置く
  - sourceと決定的合成を分離する
  - 明示的なCLI
  - fail closed
  - tool-localのrequirements
  - READMEに正規のcommandを載せる
  - focused tests
- class、font、card chrome、Pillowのpin（9.5.0）はコピーしていない。Pillowのversionは本環境で検証した版を選んだ

# CLI Contract

```
python tools/dohyo_art/compose_dohyo.py --arena-base PATH --tawara-source PATH --output-dir DIR
  [--outer-radius 800] [--tawara-width 42] [--shikiri-offset-x 124]
  [--shikiri-length 280] [--shikiri-width 24] [--protected-radius 1064]
  [--participant-offset-x 246] [--repeat auto|N] [--trim-start 0.06]
  [--trim-end 0.06] [--seam-crossfade 0.05] [--alpha-threshold 8]
```

- 成功時はexit 0で、出力pathと解決したrepeatを表示する
- 入力・引数が不正な場合は `error:` を表示してexit 2。何も書き込まない
- Master canvasは3840×2160に固定（CLIからは変えない。libraryの `Geometry` ではtest用に縮小できる）

# Exact Default Geometry

| 項目 | Master | Runtime（1/2） |
|---|---|---|
| Canvas | 3840×2160 | 1920×1080 |
| Center | (1920, 1080) | (960, 540) |
| Outer radius | 800 | 400 |
| Inner radius | 758 | 379 |
| Tawara width | 42 | 21 |
| Shikiri center X | 1796 / 2044 | 898 / 1022 |
| Shikiri center Y | 1080 | 540 |
| Shikiri length（Y方向） / width（X方向） | 280 / 24 | 140 / 12 |
| Protected radius（guideのみ） | 1064 | 532 |
| Participant guide | 1920 ± 246 | 960 ± 123 |

実出力で検証した値：
- master overlayのring alpha bbox = `(1120, 280, 2720, 1880)`
- 1920 overlay = `(560, 140, 1360, 940)`
- outer + 0.5px より外側のalphaは0、inner − 0.5px より内側のalphaはshikiri以外0（master）
- shikiriの矩形 `x 1784–1808 / 2032–2056、y 940–1220` はalpha 255

# Image Mapping Approach

1. **Arena正規化**
   - 不透明であることと、16:9からの差が0.2%以内であることを確認する
   - 実入力の差は −0.053%
   - 小数のcrop box `(0, 0.25, 1672, 940.75)` でcenter cropし、Lanczosで3840×2160へresizeする（scaleは2.2967で縦横同一）
   - それ以外の編集はしない。中央の摩耗模様にも手を加えない
2. **Tawara準備**
   - alpha > 8 のbboxでcropする
     - 実入力では `(52, 206, 2122, 511)`
     - alpha 1–8 の微小noiseが画像全体に散在していたため、閾値を設けた
   - 両端を幅の6%ずつtrimし（124px）、縦方向を再cropする → strip 1822×263
   - source alphaは保持する
3. **Polar mapping**
   - annulus内の各pixelについて、角度をu（2πで `repeat` 回）、半径をv（外縁 = stripの上端）に対応させる
   - tileはwrap paddingを付けてpremultipliedでLanczos縮小し、ring上でほぼ1:1にしてからbilinearでsampleする
   - 縁は、厳密なcenterと半径に対する解析的な1px coverage × texture alpha
4. **Shikiri**: 解析的なpixel coverageによる厳密な矩形。色は暖色のivory `(238, 230, 211)`
5. **Downscale**: BOX（2×2の正確な平均。PillowがRGBAをpremultipliedで処理する）
6. **`--repeat auto`**: sourceのaspect比をring中央の円周上で保つ整数値。実入力では18

# Seam Strategy

- strip末尾の5%（91px）を先頭へ線形crossfadeする（premultiplied）
- tileの周期は1731px
- 既定のtrimでは、stripの両端がほぼ最初と最後のtieの外縁に来るため、seamはtie同士の重なりになる
- repeatは整数なので、2πで正確に閉じる
- 実出力のθ=0付近（ring右側）を拡大して確認し、目立つ継ぎ目はなかった（最終判断はUser）

# Outputs（実Product入力。path: `tools/dohyo_art/output.local/`。git ignored）

| File | Size / Mode |
|---|---|
| `arena_base_master.png` | 3840×2160 RGB |
| `dohyo_ring_overlay_master.png` | 3840×2160 RGBA |
| `geometry_guide_master.png` | 3840×2160 RGB |
| `composite_master.png` | 3840×2160 RGB |
| `dohyo_ring_overlay_1920.png` | 1920×1080 RGBA |
| `composite_preview_1920.png` | 1920×1080 RGB |
| `build_manifest.json` | schema 1、timestampなし、入力はbasenameとSHA-256 |

入力のSHA-256：
- arena `51a04bf5…903d`
- tawara `bd7cd6a4…03bf`

# Dependency Versions

- Python 3.9.7（Anaconda base、Windows x64）。tool-local venv `tools/dohyo_art/.venv`（ignored）
  - Anacondaのglobal numpyはDLL errorで壊れていたため、venvを使った
- Pillow 11.3.0（Python 3.9をsupportする最後の系列）、NumPy 2.0.2（3.9をsupportする最後の系列）
- Node `package.json` / `pnpm-lock.yaml` は未変更

# Deterministic Evidence

- 実入力で、同じ引数のまま別の出力dirへ2回実行した
  - `build_manifest.json` はbyte単位で一致（`cmp`）
  - PNG 6ファイルはすべてsha256が一致
- manifestには、各出力のdecoded pixelのSHA-256を記録している（例: composite_preview_1920 `61d6e1f7…dc93f`）
- 乱数、timestamp、fontは使っていない。guideは文字を描かず、色の凡例をREADMEに記載した
- Unit testでも2回のcomposeでpixel hashとmanifest textが一致することを確認した

# Verification

- `python -m unittest discover -s tools/dohyo_art/tests -v` → **Ran 25 tests, OK**（約17秒）
  - 合成の成功、出力とsize（master/preview、full sizeのCLI smoke）
  - ring center と radius の厳密さ（bboxと左右上下の対称性）
  - outer の外と inner の内が透明であること、annulusが不透明であること
  - shikiriの厳密な位置と色、alphaの保持、padding cropとtrim、seamのwrap連続性
  - 失敗すべきケース
    - alphaが空、alphaなし、縦長のsource
    - aspectの大きなずれ、透明なarena、不正なgeometryとtexture option
    - CLIのfail-closed（5ケースで出力なし）、入力の上書き拒否
  - 決定性、manifestの内容、stdlib / numpy / PIL以外をimportしないこと
- CLI smoke: synthetic入力（1672×941）でfull sizeを確認し、実入力でも実行した
- READMEのcommandを検証した: `pip install -r requirements.txt`、合成command、test command
- `git diff --cached --check`: 問題なし
- `src/`、`package.json`、`pnpm-lock.yaml` の変更なし。stagedは `tools/dohyo_art/` の5ファイルと本Reportのみ
- `input.local/`、`output.local/`、`.venv/` はignoreされていることを `git check-ignore` で確認した
- `pnpm test` / `pnpm build`: 対象外（TS/Nodeは未変更）

# Acceptance Criteria

- Python CLI / 入力検証 / 決定的な正規化 / 厳密な円環 / polar mapping / shikiri / guide / master / 1920 / manifest / tests / README / requirements: すべて満たした
- 実Product入力での実合成: 実施済み
- Product visual acceptance: **未了（User Gate）**

# Design Deviations

Design Deviations: NONE

補足（Taskの範囲内で選んだ細部）：
- tawaraのbbox用に `--alpha-threshold`（既定8）を追加した。実sourceのnoise対策で、Product semanticsへの影響はない
- `--protected-radius` と `--participant-offset-x` はguide専用のoption
- trimは「alpha crop後の幅に対する割合」で指定する。source寸法を仮定しないため
- 1920への縮小はLanczosではなくBOX。2×の厳密な面積平均で、shikiriの縁にringingを出さないため

# Unexpected Scope（報告のみ・未修正）

- **Arena画像と厳密geometryの位置関係（Visual）**
  - 採用済みarena内の石枠（正方形の土俵上面）は、中心がcanvas centerよりやや上にある（1920空間で目視約 y≈500）
  - そのため、ring（y 140–940）の下端が石枠の下辺や下側の徳俵付近の意匠と重なり、上端は石枠の上辺に近い
  - Geometryは仕様どおりで、arenaの編集はTask範囲外。User visual checkで判断が必要
    - 背景を上下に合わせるか、ringと石枠の関係を許容するか
- Anaconda base環境のglobal numpy（1.20.3）がDLL errorでimportできない。tool-local venvで回避しており、Repositoryへの影響はない

# Known Untested Items

- 他のOSやPython versionでのpixel一致は確認していない（決定性の保証は、検証したtoolchainの範囲に限る）
- tawaraの見た目（repeat、trim、seam、ringに沿った陰影の向き）はUser visual checkによる

# User Play Test

- Gameplay Play Test: **Not Required**（runtimeは未変更）
- **Product Visual Check: REQUIRED**
  - 確認するもの: `tools/dohyo_art/output.local/composite_preview_1920.png`（1920×1080）。必要に応じて `composite_master.png` と `geometry_guide_master.png`
  - 調整できる項目: `--repeat`、`--trim-start` / `--trim-end`、`--seam-crossfade`、（geometryを変える場合）`--tawara-width`

# Git Delivery

- Commit: `tools: add deterministic dohyo art compositor`（Task-owned 6ファイルのみ）
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
