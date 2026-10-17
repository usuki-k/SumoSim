# ARCHITECTURE

現在確定しているArchitectureのみを記す。未導入TechnologyをCurrentとして書かない。

## 確定

- Vite + TypeScript + Phaser 4
- Web-native
- Backendなしで開始
- Pure TypeScript simulation と Phaser presentation の分離
- Phaser Sceneをgameplay source of truthにしない
- deterministic / testableなgame logicはできるだけPure TypeScriptへ置く
- frame rate依存のgameplay calculationを避ける（fixed timestep + accumulatorを採用。下記「現状」参照）
- 長期management stateとbout runtime stateは分離する方向
- Platform integrationはadapter境界を作る方向。CrazyGames SDKをgameplay coreへ直接散らさない

## ゲームルールと描画の分離

```
Pure TypeScript Game / Simulation
        ↓
State / Results
        ↓
Phaser Rendering / Input / Animation
```

例（命名は決定事項ではない）：

- `BoutSimulation`: 相撲ルール、移動結果、stamina、balance、押し計算、ring-out / 勝敗条件、必要に応じてCPU判断の入力
- `BoutScene`: input、rendering、sprite、animation、camera、sound、presentation

Sceneのframe/updateに重要なGameplay Formulaを埋め込まない。
同じ意味のStateのSource of Truthを複数持たない。

## 初期Prototypeの方針

Small explicit designを優先し、過剰なFramework、ECS、DI Framework、Global Event Bus、汎用Rule Engine等を先回りで導入しない。

## 現状

- `src/main.ts`がPhaser Gameを起動する（logical sizeは暫定値）。
- `src/game/sumo/`にPure TypeScriptのBout境界がある（Phaser import無し）：
  - `BoutSetup`: 明示的な入力境界（participant identity、初期logical position、ring半径）。将来のManagement Stateはこの形へ変換して渡し、Bout runtimeの正本にはしない。
  - `BoutSimulation`: Bout runtime stateの正本。Setupをcopyして保持し、不正Setup（participant数・id重複/空・非有限値・ring半径）を拒否する。
  - `BoutSnapshot`: `getSnapshot()`が毎回返すcopy。consumerが変更してもcanonical stateへ影響しない。
  - `BoutSimulation.step(intents)`: 1 logical tick（60Hz、暫定）だけ進める。render deltaは受け取らない。participantごとのposition / velocity / facingがcanonical state。
  - `ParticipantIntent { move }`: source非依存のsemantic入力（world-frame vector、Simulation側で長さ1にclamp）。raw keyはSimulationに入らない。
  - Movement model（grounded）: velocityをintent方向の平行成分と垂直成分に分解する。垂直成分は強く減衰（方向転換で滑らない）、逆向きの平行成分はまず制動で0へ、同方向は段階的に加速、入力なしは0まで制動、全体はMAX_SPEEDでclamp。velocityは引き続きcanonical state。係数は暫定（User Play Test対象）。→ position積分。facingは毎tick末に相手方向へ即時（座標系: +x右、+y下、facing 0 = +x、radian）。同一点では直前のfacingを維持。
  - `FixedStepAccumulator`: frame deltaを整数tick数へ変換（Phaser非依存）。1 frameのdelta上限とtick数上限を持ち、超過分は破棄。
- `src/game/input/movementVector.ts`: キー状態 → world-frame vector（画面基準: W=-y, S=+y, A=-x, D=+x。逆方向は相殺、斜めは正規化）。
- `BoutScene`: Phaser keyboardを読んでIntentを作り、accumulatorで0..N tick進め、Snapshotを永続GameObjectへ一方向同期する。canonical stateは持たない。participant identityとcontroller / 見た目の対応（`PARTICIPANT_PRESENTATION`）はSimulation外のScene側にある。OpponentはACTION-02では静止。
- 単位: simulationはmeter、m/s、radian。meter→pixelのscale + translateはScene側（presentation）。
- Vitest導入済み（`pnpm test`）。
- 速度・加速度・減速度・tick rate・ring半径・spawn位置・body半径・色・logical sizeはPrototype / 暫定値でありFinal値ではない（User Play Testで調整する）。
- Contact（ACTION-03A）: 各participantはSimulation所有の円（`bodyRadius`、Snapshotで公開。暫定で同値0.35m）を持つ。`step()`の順序は 移動入力のsanitize → grounded self velocity更新 → position積分 → contact解決 → facing更新。contact解決は、`CONTACT_SLOP`付きの距離判定、法線A→B（同一点ならAのfacing方向）、接近方向の法線速度成分のみ除去（接線成分は保持、反発なし）、重なりの位置補正（接近方向のself velocity成分＝inward contributionの比で配分し、静止している側は動かさない。寄与が無い場合は動いている側のみ、両方または両方動いていなければ50/50。質量重み付けなし）。非接触時の移動はACTION-02Bと同一。
- 未実装: 押し / externalVelocity / mass / ring-out / 勝敗、立合い、組み・投げ・吊り、能力値、stamina / balance、CPU、Touch / Gamepad、render interpolation、Physics。
