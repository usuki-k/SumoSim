Task-ID: VISUAL-01A-WRESTLER-VISUAL-FOUNDATION
Result: PASS WITH KNOWN UNTESTED ITEMS
Branch: develop
Source-Baseline: 43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105
Agent-Start-Head: dff973d27a890240868fbaba26c39c1cee5715a1
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

Technical Gateはすべて PASS（`pnpm test` 209/209、`pnpm build`（tsc + vite）、`git diff --check`）。

- **Browser Smoke: NOT RUN（environment limitation）**。このAgent環境には実ブラウザを操作するToolがない
  - したがって、描画の実際の見え方と、runtimeでのtexture生成（`Graphics.generateTexture`）の動作は未確認
  - 型定義（Phaser 4.2.1の`phaser.d.ts`）でAPIの存在と仕様（Canvas APIで描画する）は確認した
- User Play Test: **REQUIRED / NOT RUN**（debug表示OFFで行う）

# Preflight

- working tree clean / branch `develop` / local aheadなし（fetch後 `HEAD...origin/develop` = `0 2`）
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `43efaef`（`origin/develop`のancestor）、Handoff-Mode GITHUB
- `43efaef..origin/develop` の変更は `docs/agent_handoff/` 配下のみ → `merge --ff-only` 成功
- Agent-Start-Head: FF後のHEAD `dff973d`

# Changed Files

- `src/game/presentation/wrestlerVisualState.ts`（新規。Taskが許可したdirectory、Phaser非依存）: `resolveWrestlerVisualState`
- `src/game/presentation/wrestlerVisualState.test.ts`（新規）: 9件
- `src/game/scenes/WrestlerView.ts`（新規、Phaser）: 部品textureの生成と、関節付きのview
- `src/game/scenes/DohyoView.ts`（新規、Phaser）: 土俵の描画
- `src/game/scenes/BoutScene.ts`: 円の本体を`WrestlerView`に置き換え、`drawDohyo`、debugの切り替え（`0`）、depthの整理
- `docs/ARCHITECTURE.md`: Current Stateを同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

**Gameplay sourceは変更なし**: `BoutSimulation.ts`、`BoutTypes.ts`、`grappleOrientation.ts`、`ringOut.ts`、input、Dummyはいずれも未変更。新規dependency、asset file、外部の道具もない。

# Pure Visual Resolver

`resolveWrestlerVisualState(self, opponent, engagement, outcome, wasMoving)` → `{ pose, pushPhase, gripPhase, phaseProgress, grappleRole, turning, frozen, locomotionSpeed, kuzushiStrength }`

- 優先順位: kuzushi > FREEのpush / counter / grip > drive > grapple（turning / 役割）> move > idle
  - 勝敗の確定は`frozen`の修飾として扱い、決着用の共通poseは付けない
- `phaseProgress = 1 − ticksRemaining / phaseTicks`（export済みのPush / Gripの長さの定数を読む）
- `kuzushiStrength = ticksRemaining / KUZUSHI_TICKS`
- `turning`はengagementがgrappledで、かつ`canActInGrapple`がfalseのとき（既存helperを読むだけ）
- `locomotionSpeed`は自分の足運び（`velocity − externalVelocity`）。押されて流されているときは歩きにならない
- idleとmoveの切り替えは、presentationだけのhysteresis（0.2 m/sで入り、0.1 m/sで出る）

# WrestlerView / Exact Facing

- 部品: 影 / 左右の足 / 胴（肩幅が広い楕円とお腹のshade） / まわし（背中側半周の帯と後ろの結び目） / 左右の腕（capsuleと手） / 頭（後半分は髪、前は額、後頭部に髷）
  - 白で描いた部品（まわし）はteam色でtintする（PLAYER青 / CPU赤）
- 前後の手がかり: 頭が前寄り、髷とまわしの結び目が後ろ、腕が前へ伸びる。facingのdotがなくても向きが分かる設計
- Containerの位置 = canonicalな中心（補間しない）、回転 = `participant.facing`（量子化しない）。GRAPPLED中の旋回も連続して見える
- 影は体の下に置き、少し右下へずらす
- depth: 影1 < 体2 < debug表示3 < text4（2人が重なっても、相手の影が体の上に描かれない）
- poseは、部品の位置・回転・拡大率の目標値（R単位のparameter）へ、presentationだけの指数補間（18 /s）で近づける。勝敗確定後は時間を止めて動きもfreezeする

# Pose Mapping（R = 体の半径）

| 状態 | 表現 |
|---|---|
| idle | 構えた立ち姿、わずかな呼吸のscale |
| move | 足を移動の向き（local）に交互に出す。cycleは移動距離で進めるので、足が滑らない |
| push startup | 腕を胸元へ引き、のけぞり、低い姿勢、足を前後に開いて踏む |
| push active | 前傾（+0.28R）、両腕をまっすぐ突き出す（長さ1.3倍）、頭を前へ |
| push recovery | 進み具合に応じて、activeからidleへ戻す |
| counter | 低く開いた構え（腕を大きく左右に開き、少し後ろへ、足幅を広く）。押しの溜め（腕を引く）と区別できる |
| kuzushi | 胴が傾いて揺れる（Kuzushiの残りに応じて弱まる）、腕を大きく開いてばたつかせる、足を乱す。気絶のmarkerはなし |
| grip reach / recovery | 腕を前へ伸ばす / 戻す |
| grapple neutral | 片腕を外から（やや広く）、片腕を内へ（細く深く）回す、四つの形 |
| Morozashi holder | 両腕を内側へ深く（長さ1.55倍、ほぼ平行）、まわしを明るくする |
| Morozashi disadvantaged | 両腕を外へ大きく広げて浮かせ、上体を少し高くする |
| turning（READYでない） | 腕が組めておらず、横へだらりと下がる。足を小刻みに踏み替える。READYになると組みの形へ戻る |
| drive | 組みの形に前傾（+0.12R）と低い姿勢を加え、足を小刻みにすり足で踏み替える。拮抗（両者drive）でも両者が力を入れた形になる |

背後の場合は、Simulationの回転量（約180°）が側面（約90°）より大きいので、自然に長く旋回して見える（`GRAPPLE_TURN_RATE`は変えていない）。

# Dohyo Pass

`drawDohyo`が描くもの:
- 暗い背景
- 蛇の目（俵の外側0.2 mの明るい砂の帯）
- 土の3段の濃淡
- **ring-outの半径ちょうど**に描く太い俵と区切りの模様
- 仕切り線（中心から±0.35 m）

観客や会場は描いていない。

# Debug Toggle

- `0`キー（暫定）。既定はOFF
- OFF: 力士のvisualと結果text、1行の操作ヒント（Dummyのmodeと各key）だけを表示する
- ON: 従来のlabel、phase text（READY / TURNING n°を含む）、engagementとpair vの表示、接触円の輪郭、facing marker、組みの線を表示する
- 診断機能は削除していない

# Architecture Preservation

- 流れはSimulation → Snapshot → pure mapping → Phaser viewで、visualはgameplayのstateを持たず書き換えもしない
- phaseの長さはSimulationに従い、animationのcallbackでgameplayを決めることはない
- Phaser Physicsは不使用
- presentation moduleはPhaserをimportしない（testで確認）

# Tests

209/209 PASS（既存200件は変更なし + 新規9件）。

新規9件の内容:
- idleとmove、hysteresis
- 外力で押されている間は歩きにならない
- pushのstartup / active / recoveryと進み具合
- counter、grip reach / recovery
- Kuzushiの優先と強さの減衰
- neutralとMorozashiの役割（holderをA / Bの両方で確認）
- 背後の旋回からREADY、driveへの移行（相手がTURNINGの間に押していてもdriveにならない）
- 勝敗確定後はfrozen（直前のposeのまま）
- 決定的であること、Phaser非依存であること

Phaserの描画の座標を細かく確かめるtestは追加していない（Taskの指示どおり）。

# Browser Smoke

**NOT RUN（environment limitation）**。build（tsc + vite）は成功。

ブラウザで最初に確認すべき点:
1. textureが生成されて力士が描かれるか（runtime errorがないか）
2. 向きが正確に回るか
3. poseが切り替わるか
4. `0`の切り替え
5. 俵がring-outの線として見えるか

# Implementation Evidence

上記のとおり。VISUAL-01Bの範囲（camera shake、土煙、衝撃の輪、残像）、行司、flow、音、外部asset、spritesheet、数値の調整のcodeはない。

# Design Deviations

Design Deviations: NONE

- texture生成はTaskの第一候補（`Graphics.generateTexture`）どおり
- `Graphics.make`（scene非表示）で部品ごとに描き、1つのkeyとして保存する

# Unexpected Scope

なし。

参考情報（修正していない）: AGENTS.md §5のdirectory一覧に、今回Taskが許可した`src/game/presentation/`の記載がない。今回のTaskの範囲にAGENTS.mdの変更が含まれていないため、ARCHITECTURE.mdだけを同期した。必要であれば次のdoc同期でAGENTS.md §5へ追記する。

# Known Untested

- Browser Smoke全項目（上記）
- runtimeでのtexture生成と描画の実際の見え方
- Visual / Game Feel（User Play Test）

# User Play Test

REQUIRED / NOT RUN。まずdebug表示OFFで、Taskの14項目を確認する。

その後に**Gameplay Re-evaluation Gate**として、違和感をそれぞれ次のどれに当たるかで分類する。Gameplayの変更は後続のTaskで検討できる。
- Presentationの問題
- Gameplayの問題
- 両方 / 不明

# Git delivery

Task-owned filesだけを明示的にstageし、`feat: add provisional wrestler visuals`としてcommitして`origin/develop`へpushする（SHAはGitHubで確認）。
