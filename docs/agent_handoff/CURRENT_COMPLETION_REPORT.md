Task-ID: ART-TOOL-01A-ARENA-ALIGNMENT
Result: PASS
Branch: develop
Source-Baseline: 3dff5c7aa3c080a8578dc8eab835eccdc4a23373
Agent-Start-Head: 213b1e01687222b1151e30ab6ea2d95c1cdc1e94
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Technical）。Product Visual Checkは未了で、User確認が必要。

- `tools/dohyo_art/` にarena alignmentを追加した
  - 一様scale（canvas center基準）→ 平行移動 → crop
  - canvasを覆えない値はfail closed
  - manifestへ記録する
- 実arenaの正方形土俵上面の中心を計測し、Product用の値（`--arena-scale 1.072 --arena-offset-x 5.36 --arena-offset-y 77.72`）を導いた
- 補正後のPreviewを生成した: `tools/dohyo_art/output-aligned.local/composite_preview_1920.png`（1920×1080）
- Gameplay center / 半径 / shikiri / overlayは変更していない
  - 補正前後でoverlay PNGがbyte一致
- 既定値は恒等（1, 0, 0）。補正しない場合は旧出力とbyte一致する
- `src/`、package、lockfileは未変更。Product画像はcommitしていない

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASKを確認した
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `3dff5c7`（ancestor）、Handoff-Mode GITHUB
- `3dff5c7..origin/develop` の変更は `docs/agent_handoff/CURRENT_TASK.md` のみ → `merge --ff-only` 成功
- Agent-Start-Head = FF後の `213b1e0`
- 実入力2ファイルと、補正前の出力 `output.local/` が存在することを確認した

# Visual Alignment Problem（確認）

補正前の `output.local/composite_preview_1920.png` と `geometry_guide_master.png` で確認した。
- 正方形土俵の中心がcanvas centerより上にある
- ring下端が内側の俵石枠の下辺と重なっている
- 上下の余白が非対称

# Measurement Method

- 補正前の `arena_base_master.png`（3840×2160、恒等正規化）を使った
- 縁を垂直・水平の帯で平均したluminanceの勾配で特定し、拡大cropで目視確認した
  - 横方向の帯: x 1300–1500 / 2340–2540
  - 縦方向の帯: y 650–850 / 1310–1510
- 中央の俵ブロック、角柱、摩耗模様、観客は避けた
- 小規模で決定的な計測にとどめ、CV detectorは作っていない

## Platform reference coordinates（master、補正前）

| Reference | 上 | 下 | 左 | 右 | 中心 |
|---|---|---|---|---|---|
| **土俵上面の外縁（主anchor）** | y≈98 | y≈1917（前面の側面が始まる位置） | x≈883（892 / 873） | x≈2947（2937 / 2957） | **(1915, 1007.5)** |
| 内側俵石枠の内縁（参考） | y≈222 | y≈1766 | x≈1009 / 994 | x≈2822 / 2836 | (≈1915, 994) |
| 内側俵石枠の外縁（参考） | y≈181 | y≈1820 | x≈955 | x≈2885 | (1920, ≈1000) |

- 左右の値が2つあるのは、上の帯と下の帯で測ったため。下ほど少し幅が広く、軽い透視がある
- 上下は、前面の側面が見えている分だけ曖昧さがある。構造中心のばらつきは y 994〜1007.5（約±7px）
- Taskの指示どおり、土俵上面の四辺から出した中心 **(1915, 1007.5)** を採用した

# Correction

- 補正前の視覚中心: (1915, 1007.5)。runtime換算で (957.5, 503.75)
- 固定target center: master (1920, 1080) / runtime (960, 540)
- 変換は「中心基準のscaleの後に平行移動」なので、点 `a` は `(a − c)·S + c + offset` へ移る
  - 中心を合わせる条件: `offset = (c − a)·S = (5·S, 72.5·S)`
- canvasを覆う条件: `S ≥ 1 + max(|ox|/1920, |oy|/1080)`
  - 上の条件と連立すると `S ≥ 1 / (1 − 72.5/1080) = 1.07196`
- 採用値: **S = 1.072、offset = (5.36, 77.72)**
  - min scale 1.071963、manifestに記録
  - 最終的なsource box: `(53.9722, 0.2662, 1613.6737, 877.5983)`。source 1672×941の内側で、縦横比は16:9のまま
- この値で十分な理由（補正後のarena masterを再計測した）
  - 土俵上面の外縁: 上 y≈105 / 下 y≈2055 → 中心 **1080**
  - 内側石枠の左右内縁: 950 / 2891 と 936 / 2905 → 中心 **1920.5**
  - ring（y 280–1880、x 1120–2720）は内側石枠の内縁（上 ≈238 / 下 ≈1893 / 左 ≈936–950 / 右 ≈2891–2905）の内側に収まる
    - 補正前は、石枠内縁の縦の半幅が約772 < 800で、ringがはみ出していた
    - 1.072倍で約828になり、収まった
- 拡大は7.2%のみ。元画像はもともと2.3倍に拡大しているので、追加の劣化は軽微
- 画面端の観客と床が約3.4%ずつ切れる。目視で構図の破綻はない

# Changed Files

| File | 内容 |
|---|---|
| `tools/dohyo_art/compose_dohyo.py` | `ArenaAlignment`、`validate_alignment`、`required_arena_scale`、`aligned_source_box`、`normalize_arena(…, alignment)`、`compose(…, alignment)`、CLI、manifest schema 2 |
| `tools/dohyo_art/tests/test_compose_dohyo.py` | alignment tests（10件追加）、CLI cases、git-ignore test |
| `tools/dohyo_art/README.md` | Product用の正規command、Arena alignment節、defaults、fail-closed |
| `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` | 本Report |

# CLI Changes

```
--arena-scale S        uniform zoom about canvas center, 1..1.25 (default 1.0)
--arena-offset-x X     master px, + = arena content right (default 0)
--arena-offset-y Y     master px, + = arena content down  (default 0)
```

- 変換順序: 16:9正規化 → scale → 平行移動 → crop
  - 全体を1つのsource boxに合成し、Lanczosで1回だけresampleする（二重resampleなし）
- 回転と非一様scaleは扱わない
- 次の場合はfail closedする（exit 2、何も書かない）
  - canvasを覆えない
  - scaleが範囲外
  - 値が非有限
- 露出部分を埋める処理（黒、blur、clone、inpaint）はしない

# Manifest Changes

- `schema`: 1 → 2
- `arena_alignment` を追加した
  - `scale`、`offset_x`、`offset_y`、`units`
  - `transform_order`、`min_scale_for_offset`、`coverage`、`source_box`
  - `intended_anchor: "painted main dohyo/platform top surface center -> canvas center"`
- 既存の `arena_normalization.crop_box` は16:9正規化のboxとしてそのまま残した

# Tests

`python -m unittest discover -s tools/dohyo_art/tests -v` → **Ran 35 tests, OK**（skipなし）。

追加・変更したもの：
1. 恒等alignment（既定値と明示指定）が、旧正規化の `resize(box=…)` と同じpixel hashになる
2. +X offsetで内容が右へ動く（marker重心が `(p−c)·S+c+o` と ±0.5px で一致）
3. +Y offsetで内容が下へ動く
4. 一様scaleで正方形markerが正方形のまま（幅=高さ）、source boxが16:9
5. 覆えない値は失敗する（scale不足、<1、>1.25、NaN、inf）
6. 最小scaleで正確に覆える（box境界内、端のpixelは背景色）
7. manifestにalignmentが記録される（恒等も含む）
8. alignment付きでも決定的（pixel hashとmanifest text）
9. alignmentだけを変えた場合、overlayのmaster / 1920 hashとgeometry manifestが不変
10. ring center / radiusが不変（geometryは (480, 270) / 200）
11. CLIでalignmentを指定したfull sizeのsmoke（Product値）。CLIのfail-closedに「uncovered arena」「scale too large」を追加
12. `input.local/`、`output.local/`、`output-aligned.local/` がgit-ignoreされ、`tools/dohyo_art` にPNGや `.local` がtrackされていない

既存testは、`normalize_arena` の戻り値が3要素になった点のみ修正した。

# Deterministic Evidence

- **恒等の回帰**: 既定値で再実行した結果が、補正前の `output.local/` と **byte一致**した
  - 対象: `arena_base_master` / `dohyo_ring_overlay_master` / `composite_master` / `dohyo_ring_overlay_1920`
- **再実行**: Product値で2回実行し、`build_manifest.json` と全PNGが **byte一致**した
- **overlay不変**: 補正前の `output.local` と補正後の `output-aligned.local` で、`dohyo_ring_overlay_master.png` と `dohyo_ring_overlay_1920.png` が **byte一致**した

# Real Product Outputs

- 補正前（比較用）: `tools/dohyo_art/output.local/`
- **補正後: `tools/dohyo_art/output-aligned.local/`**

| File | Size |
|---|---|
| `arena_base_master.png` / `dohyo_ring_overlay_master.png` / `geometry_guide_master.png` / `composite_master.png` | 3840×2160 |
| `dohyo_ring_overlay_1920.png` / **`composite_preview_1920.png`** | 1920×1080 |
| `build_manifest.json` | schema 2 |

どちらもgit-ignore（`*.local`）で、commitしていない。

# Product Visual Check

**REQUIRED**。確認するファイルは `tools/dohyo_art/output-aligned.local/composite_preview_1920.png`。

Agentが目視した範囲：
- ringは正方形土俵の中に収まり、下端のはみ出しはなくなった
- 左右は対称
- 露出した端はない
- 非一様な伸びはない

User判断ポイント：
- 内側俵石枠の内縁を基準にすると、中心はまだ約14px上（y≈1065.5）にある
  - そのため、ringから石枠までの余白が下（約13px）より上（約42px）で大きく見える
  - 透視によって、土俵上面の外縁と石枠の基準がずれていることが原因
  - 石枠基準で合わせたい場合の目安: `--arena-scale 1.088 --arena-offset-x 5.44 --arena-offset-y 93.57`
    - 石枠中心 (1915, 994) から計算した値。未生成・未検証

# Design Deviations

Design Deviations: NONE

- 汎用の既定値は恒等（1, 0, 0）のままにした。Product値はREADMEの正規commandで明示的に渡す
- 補正後の出力は、比較できるように `output-aligned.local/` に分けて出力した（Taskの例示どおり）
- 新しいreview出力やguide annotationは追加していない。既存の `geometry_guide_master.png` が、補正後のarenaの上に固定ringを重ねて表示する

# Unexpected Scope（報告のみ）

- 上記の透視による基準の曖昧さ（土俵上面と内側石枠で約14px）。arenaを再描画しないと解消しないため、Task範囲外
- それ以外はなし

# Verification

- Python unit suite: 35 / 35 OK
- 実Product CLIの実行: 補正前（既定値）と補正後（Product値）の両方
- 決定的な再実行の一致、overlay hashの不変、preview 1920×1080を確認した
- `git diff --cached --check`: 問題なし
- `src/`、`package.json`、`pnpm-lock.yaml` の変更なし。Product入力・出力のstageなし
- `pnpm test` / `pnpm build`: 対象外（runtimeは未変更）

# Git Delivery

- Commit: `tools: align product arena background`
  - Task-owned 4ファイル: `compose_dohyo.py` / `tests/test_compose_dohyo.py` / `README.md` / 本Report
- fetch → fast-forward safety確認 → push `origin/develop` → remote SHA確認 → clean tree確認
- `main` は未変更
