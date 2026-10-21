Task-ID: ACTION-ART-03A-RIGID-WRESTLER-RUNTIME-INTEGRATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 31d658e0e4bf4d50168d0eae062e29c248b96fb9
Agent-Start-Head: aff9f7948c894bd21d4f6456afa4d0571bede250
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS WITH KNOWN UNTESTED ITEMS（Technical PASS + Runtime Smoke PASS。User Play Testは未実施）。

- 手続き的な関節付きの力士（`WrestlerView.ts`）を、User承認済みの **2枚の剛体のProduct sprite**（blue / red）に置き換えた
  - 位置: canonicalな `participant.position`（meterからpixelへの写像は既存のまま）
  - 向き: canonicalな `participant.facing` で、sprite全体を連続的に回転する
  - 全stateで同じspriteを使う
- runtimeのPNGは、レビュー済みのsourceから、新しいexporterで決定的に書き出した。commitしたfileは、その場で書き出し直したものとbyte単位で一致する
- 変更しなかったもの: Simulation / gameplay / input / HUD / arena

# Preflight

- working tree clean、branch `develop`、fetch後 `HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK
  - Task-ID一致、Status READY、Target-Branch develop
  - Source-Baseline `31d658e`（`origin/develop` のancestor）、Handoff-Mode GITHUB
- 変更の範囲
  - `31d658e..origin/develop` の変更は、`CURRENT_TASK.md` のみ
  - HEAD（`0f5ff64`）から `origin/develop` までも、同じfileのみ
- `merge --ff-only` → HEAD `aff9f79`
- 入力: `tools/wrestler_art/input.local/` に、両fileがあった
  - 他のdirectoryは探していない
  - 03Aでの手順の逸脱（Downloadsからのcopy）についての訂正を受け、今後は入力が無ければ止まる方針にした

# Reviewed Source Identities

| sprite | size / mode | file SHA-256 | decoded RGBA pixel SHA-256 |
|---|---|---|---|
| blue | 1254×1254 RGBA | `ede9ffd2…1781dbb4`（一致） | `0de729df…9adf65dd`（一致。照合の正） |
| red | 1254×1254 RGBA | `98f9465a…5c9792fa9`（一致） | `a212dbfe…9b25dafe7`（一致。照合の正） |

# Asset Export

- 新規: `tools/wrestler_art/export_runtime_wrestlers.py`（小さな専用のscript。汎用のpipelineではない）
  - 03Aの関数をそのまま使う: `aw.load_source` → `ps.normalize_sprite`（`dual_rigid_recipe.json`。1回の全体の回転、body-core = 2R）→ `aw.runtime_part`（ちょうど1/4に縮小）
  - 反転はしない
  - 各fileを原子的に書く
  - 寸法、pivot、body-core、pixel / file SHA-256を表示する
- 書き出し: `PY tools/wrestler_art/export_runtime_wrestlers.py`
  - 出力先は `public/assets/action/wrestler/{blue,red}.png`
- 照合: `PY tools/wrestler_art/export_runtime_wrestlers.py --check`
  - commit済みのfileと、その場の書き出しを比べる（pixelとbytes）。何も書かない
  - 結果は **ok（両方とも）**
- recipeの値は変えていない（03Aでレビューした幾何のまま）

| file | 寸法 | pivot（px） | body-core | pixel SHA-256 | file SHA-256 |
|---|---|---|---|---|---|
| `blue.png` | 167×181 | (84, 87) | 123.0769 px | `bbd3459360064934c1b2fa247fdb5821f3c5e8699b594e4b27dec93f8975fc7b` | `cf61c777d4d88ec105735c93454ccd3c9df59999070eb4f7653140d962eb3168` |
| `red.png` | 158×178 | (82, 95) | 123.0769 px | `d66895bf7301cd3dc9573cea07db7dceca07f2114ba85bcc0be763334313cdaa` | `147dda89e08965b0286461f281501713ebfbe8cd0a5b293901a9185aa0f1f57b` |

（寸法とpivotは、03Aのpreviewで報告した値と同じ。）

# Runtime Pivot / Origin Metadata

- 新規: `src/game/presentation/productWrestlerArt.ts`（Phaser非依存）
  - `PRODUCT_WRESTLER_ART.{blue,red}` に、id、textureKey（`product-wrestler-blue` / `-red`）、assetPath、width / height、pivot、`bodyCoreDiameterPx`（123.076923）を持たせた
  - `productWrestlerOrigin(art) = { x: pivot.x / width, y: pivot.y / height }`
    - blue = (0.50299, 0.48066)
    - red = (0.51899, 0.53371)
  - Phaserの `setOrigin` に渡す。これで `image.position` = canonicalなparticipantの中心になる
- TSの値と、commitしたPNG / その場の書き出しとの一致は、Pythonのtest（`test_runtime_metadata_matches_typescript_contract`）で確認する
  - TSのtestは、PNGを読むために `@types/node` を足すことを避け、純粋な関数だけを確認する

# Scale Formula

- `productWrestlerScale(art, bodyRadiusPx) = (2 × bodyRadiusPx) / art.bodyCoreDiameterPx`
- 現在は `bodyRadiusPx = 0.35 × 400 / 2.275 = 61.538…` なので、scale = **1.000000**（blue / red とも）
- participantごとのcanonicalな `bodyRadius` に比例する（testで、1.2倍にすると1.2になることを確認した）
- 全体のalpha bboxは、scaleの基準にしていない。gameplayの `bodyRadius` は変更していない

# WrestlerView Replacement Summary

`src/game/scenes/WrestlerView.ts`: 328行 → 68行。

**削除したもの**
- 手続き的な足・胴・まわし・1本の腕・頭のtexture生成
- `PoseParams` と各poseの定数、poseの指数的な補間、`mix`
- 腕のreach / spread、crouch / lean、torsoRot
- 歩きの足の位置、旋回中とDrive中の踏み替え
- kuzushiの揺れ
- まわしのtintによるMorozashiの手がかり（`lighten`）
- Container

**新しい構成**
- Product spriteの `Image` 1枚
  - originは明示したpivot、scaleはbody-coreから決める
  - tintはかけない
- 手続き的な影の `Image` 1枚
  - 影のtexture生成だけを残した（2.25R × 2.0R、α0.28、world上で (+0.07R, +0.12R)、ほぼ円形）
- depthは影1、体2（変更なし）
- `preloadProductWrestlers(scene)` を公開した

**`apply(state, participant, positionPx)` がすること**
- `moving = state.pose === 'move'`（既存のhysteresisとの互換を保つ）
- 体をcanonicalな位置に置き、`participant.facing` で回転する
- 影をworld上のoffsetの位置に置く
- 時間による変形はしない
- 体の部位を描く古い経路は、残っていない（裏で動き続けるものも無い）

# Preload / Scene Wiring（`BoutScene.ts`、最小限）

- `preload()`: `preloadProductDohyo(this)` の隣に `preloadProductWrestlers(this)` を足した
- `PARTICIPANT_PRESENTATION` に `art: ProductWrestlerArtId` を足した
  - `wrestler-a` → `'blue'`、`wrestler-b` → `'red'`
  - `color` はdebug（接触円、組みの線）用に残した
- 生成: `new WrestlerView(this, bodyPixels, PRODUCT_WRESTLER_ART[style.art])`
- `apply` が時間を使わなくなったので、`syncViews(dtMs)` の引数を外し、呼び出し4か所を `syncViews()` にした
  - `noUnusedParameters` によって機械的に必要になった変更。`update` のaccumulatorは引き続き `deltaMs` を使う
- `wrestlerVisualState.ts` は変更していない

# Canonical Position / Facing Evidence

- `syncViews` は、従来どおり `toCanvas(participant.position)` で求めた `pos` を、debugの接触円と `WrestlerView.apply` の両方に渡す
  - spriteの位置 = 接触円の中心
  - 位置の正本を、別に持たない
- `body.setRotation(participant.facing)`: 量子化も補間もしない
- Runtime Smoke（下記）で、debugの接触円の中心が両spriteの体の中心にあることを確認した
  - 開始時、移動した後、接近したとき
  - WASDで動くと、facingに合わせてsprite全体が回る

# No-mirror Evidence

- exporter
  - `Image.transpose`、`ImageOps.mirror`、`ImageOps.flip` を、呼ばれたら例外を投げるものに差し替えて、書き出しが成功することを確認した（`test_no_mirror_or_flip`）
  - 正規化は03Aと同じ経路（そこでも、反転しないことをtestで確認済み）
- runtime: `WrestlerView` は `setFlipX` / `setFlipY` も、負のscaleも使わない。blueとredは、別々のtextureのまま

# Tests

- `pnpm test`: **PASS**（18 files / 262 tests）
  - 新規 `productWrestlerArt.test.ts`
    - key / pathが別々であること
    - pivotがtextureの内側にあること
    - pivotからoriginへの変換
    - scaleが約1.0で、bodyRadiusPxに比例すること
    - Phaserに依存しないこと
- `pnpm build`: **PASS**（tsc + vite build。chunkの大きさの警告は、以前からあるPhaser由来のもの）
- Python（`tools/wrestler_art/.venv/Scripts/python -m unittest discover -s tools/wrestler_art/tests`）: **107 tests OK**
  - 既存96件 + 新規 `test_export_runtime_wrestlers.py` 11件
  - Taskの必須10項目との対応
    1. blueが無い → `test_missing_blue_fails`（CLIはexit 2で何も書かない）
    2. redが無い → `test_missing_red_fails`
    3. pixelが違う → `test_wrong_pixel_identity_fails`
    4. 書き出しの決定性 → `test_deterministic_export`
    5. / 6. commit済みのblue / redが、その場の書き出しと一致する → `test_committed_blue_and_red_match_fresh_export`（`check()`。pixelとbytes）
    7. pivot → `test_accepted_runtime_geometry`、`test_runtime_metadata_matches_typescript_contract`
    8. body-core 123.077 → 同上、`test_export_matches_dual_rigid_runtime_normalization`
    9. 反転なし → `test_no_mirror_or_flip`
    10. 透明な余白とpivot → `test_transparent_padding_and_pivot_valid`
  - その他: `--check` が、編集されたfileを検出すること（`test_check_accepts_fresh_export_and_rejects_edits`）
- `git diff --check`: PASS

# Browser / Runtime Smoke

**PASS**（Agentによる自動のsmoke）。

方法:
- `pnpm dev --port 5199`
- headlessのChrome 156（swiftshaderによるWebGL）を、Node 24に内蔵のWebSocketで、DevTools Protocol経由で操作した（script: scratchpad。依存は増やしていない）
- 画面は1920×1080。キー操作はCDPの `Input.dispatchKeyEvent` で送った
- 15枚のscreenshotを、Agentが目で確認した

| 確認 | 結果 |
|---|---|
| Product arenaの読み込み | 200（`arena_base_1920.png`、`dohyo_ring_overlay_1920.png`） |
| blue / redの読み込み | 200（`blue.png`、`red.png`）。texture欠けの表示なし |
| consoleの実行時error / 例外 | **なし**（唯一のerrorは、以前からある `favicon.ico` の404） |
| 取組前の比較表示 | 表示された（Day 3、東西、統計） |
| Enterで開始 | 開始した。Product HUDが表示され、2人がblue（左）/ red（右）で向き合う |
| canonicalな位置への追従 | WASDの移動、接近、dummyのpush（2キー）で、spriteが位置どおりに動く |
| facingの回転 | 移動中、相手の方を向いて、sprite全体が回る（上下や斜めの向きも確認した） |
| key 0のdebug | 接触円・facing marker・label・境界線を表示した。接触円の中心は、spriteの体の中心にある |
| Rで再開 | 取組前の比較表示に戻った。Enterで再び開始できた |
| 古い手続き的な体 | 表示されていない（spriteと影だけ） |

制約:
- 自動のsmokeは、静止画で確認しただけ。動きの手触り、Kuzushi、組み / Driveの成立、土俵際の読みやすさは見ていない
- 送ったキー列ではGripが成立せず、`ENGAGE: FREE` のままだった（組みの見た目は未確認）
- これらはUser Play Testで確認する

# User Play Test Required

**Required**（Technical PASSは承認ではない）。Taskの A〜F を、実際のruntimeで確認してください。
- A. 開始と向き合い: 向き合って見えるか、大きさ、pivot、古い体が消えているか
- B. WASDで相手の周りを動き、連続した360°の回転が自然か
- C. 押し（Up）とCounter（Down）: 同じ剛体のartで、prototypeとして許容できるか
- D. Kuzushi / よろけ: canonicalな位置の移動だけで足りるか（小さな回転は、まだ足していない）
- E. Grip（Shift）/ 組み / Drive（dummy 1 / 2）: 近づいたときの読みやすさ。最初の専用poseが必要なら、押し / 接触か、grip / 組みか、まだ不要か
- F. 土俵際での読みやすさと、HUDの読みやすさ

# Implementation Evidence

| Design Requirement | Implementation Evidence | Preserved | Verified By |
|---|---|---|---|
| blueとredは別のsource | `PRODUCT_WRESTLER_ART.blue/red`、別のtexture key / file、`PARTICIPANT_PRESENTATION.art` | 03Aの2枚のsource | TS `blue and red are separate assets…`、Python `check()` |
| 反転なし | exporterは03Aの正規化のみ。runtimeにflip / 負のscaleなし | 03Aの反転なしの経路 | `test_no_mirror_or_flip`、コードの確認 |
| 明示的なpivot / root | `pivot` → `productWrestlerOrigin` → `setOrigin` | 03Aのroot_source_px | TS origin test、`test_runtime_metadata_matches_typescript_contract`、smoke（接触円の中心） |
| body-coreによるscale | `productWrestlerScale = 2·bodyRadiusPx / 123.076923` | bodyRadius 0.35 m（変更なし） | TS scale test、Python body-core test |
| 連続したcanonicalなfacing | `body.setRotation(participant.facing)` | Simulationのfacing（量子化なし） | smoke（移動中の回転）、コードの確認 |
| canonicalな位置 | `apply(…, pos)`。posは、接触円と同じ `toCanvas(participant.position)` | Simulationの位置が正本 | smoke（接触円の中心が一致） |
| 手足ごとのProduct描画なし | 体のImageは1枚。部位のtexture / pose / tint / 時間による変形を削除した | — | `WrestlerView.ts`（68行）、smoke |
| HUD / debugの保持 | HUD、取組前の比較、Enter / R / 1 / 2 / 0、接触円、facing marker、label、phase text、組みの線、境界のdebugは、未変更 | ACTION-ART-02A / 02Bの表示 | `pnpm test`、smoke（01、03、13、14、15） |

# Changed Files

- 新規
  - `public/assets/action/wrestler/blue.png`、`public/assets/action/wrestler/red.png`（exporterの出力）
  - `src/game/presentation/productWrestlerArt.ts`、`src/game/presentation/productWrestlerArt.test.ts`
  - `tools/wrestler_art/export_runtime_wrestlers.py`、`tools/wrestler_art/tests/test_export_runtime_wrestlers.py`
- 変更
  - `src/game/scenes/WrestlerView.ts`（剛体の描画に置き換え）
  - `src/game/scenes/BoutScene.ts`（preload、art idの割り当て、`syncViews` の引数）
  - `tools/wrestler_art/README.md`（Runtime exportの節）
  - `docs/WRESTLER_PRODUCT_ART_SPEC.md`（下記）
  - `docs/ARCHITECTURE.md`（下記。最小限）
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- 変更なし: `src/game/sumo/**`、input、`wrestlerVisualState.ts`、HUD / 取組前の比較のview、arena、package / lockfile、02A / 02B / 03Aのtool

# SPEC Sync

`docs/WRESTLER_PRODUCT_ART_SPEC.md`:
- Status行を直した: 現在の方針は§0。部位 / 2関節の記述は履歴
- 新しい **§0「現在の採用方針」** を足した
  - 2枚の剛体sprite、反転なし、連続した全体の回転、位置の移動による最小の動き
  - export / pivot / scaleの約束、全stateで同じsprite、割り当て
  - Deferred（専用pose、8方向、frame数、pose数、rig）
- §1 / §5 / §7 / §13の見出しと該当行に、「履歴・§0で置き換えた」と注記した（削除はしていない）
- §11: 03AのUser Visual Gateの結果を記録した
- §21: ACTION-ART-03Aの統合を記録した
- 最終的なanimation / poseの数は決めていない

# Design Deviations

Design Deviations: NONE

（反転、8方向、手足ごとのProduct描画、新しいposeのart、gameplayの変更、新しいよろけの式、canonicalな位置 / facingの置き換えは、どれもしていない。）

# Unexpected Scope（報告のみ）

- **`docs/ARCHITECTURE.md`**（3行の置き換え）
  - 「現状」の欄が、削除した手続き的な `WrestlerView` と「Product力士は部位で組む（未実装）」を説明したままで、現状と食い違っていた
  - そのため、`WrestlerView` の1文、`PARTICIPANT_PRESENTATION` の1文、Product力士artの1項目だけを、現在の実装に合わせた
  - Taskの変更予定の一覧には無いので、ここに記録する
- **`BoutScene.syncViews` の引数の削除**: `apply` の `dtMs` が不要になったことによる、`noUnusedParameters` 上の機械的な変更（動作は同じ）
- **Phaserの描画以外で、もう使わなくなったもの**
  - `wrestlerVisualState` のpose / phaseの詳細（push / grip / kuzushiの強さなど）は、現在 `moving` 以外は描画に使っていない
  - Taskの指示どおり、mappingは残した（将来の混合poseで使える）

# Known Untested Items

- User Play Test（A〜F）: 手触りと見た目の承認
- 組み / Driveの見た目: 自動のsmokeでは、組みが成立しなかった
- 実機のGPUでの表示: smokeはswiftshaderのWebGLだけで確認した

# Git Delivery

- 上のfileだけを明示的にstageし、1 commit（`feat: integrate rigid product wrestlers`）
- fetch → fast-forwardの安全を確認 → `origin/develop` へpush → remote SHAを確認 → clean working treeを確認
- 入力のsprite、previewの出力、`.venv` / cacheは、ignoreされたまま
- `main` は変更しない
