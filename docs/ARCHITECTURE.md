# ARCHITECTURE

現在確定しているArchitectureのみを記す。未導入TechnologyをCurrentとして書かない。

## 確定

- Vite + TypeScript + Phaser 4
- Web-native
- Backendなしで開始
- Pure TypeScript simulation と Phaser presentation の分離
- Phaser Sceneをgameplay source of truthにしない
- deterministic / testableなgame logicはできるだけPure TypeScriptへ置く
- frame rate依存のgameplay calculationを避ける（fixed step / delta timeの設計は後続Action Designで決める）
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
- `BoutScene`はPrototype Setupを組み立て、Snapshotを読んで描画するのみ。canonical positionは持たない。simulation座標（原点=canvas中心、1unit=1px）からcanvasへのpresentation transformはScene側にある（暫定値）。
- Vitest導入済み（`pnpm test`）。Simulationの境界Testがある。
- 座標単位、ring半径、spawn位置、色、logical sizeはPrototype fixtureでありFinal値ではない。
- 未実装: movement、input、time step（fixed/delta未決）、Physics、能力値、CPU、ring-out、勝敗。
