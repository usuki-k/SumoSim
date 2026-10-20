# GAME_CONCEPT

現段階で**確定**した方針のみを記す。未決事項は確定として扱わない。

## 確定事項

- 相撲の育成・相撲部屋経営Simulation + 相撲Action Game
- 相撲Actionは見下ろし型
- 最初に超小型Gameplay Loopを作る（Stable → Training → Bout → Result / Reward → Stable）
- その後、相撲Actionを重点的に作り込む
- Actionが成立してからSimulation / Managementを拡張する
- 最初のTargetはCrazyGames向け
- 初回releaseの表示言語は英語のみ。将来の多言語化ができる構造にしておく（追加の配信言語はDeferred）
- Browser Game
- Action Product presentationは、様式化したpainted 2D（見下ろし型のまま）。現在のarena / dohyo（暖色の伝統的な相撲の意匠）のProduct visual baselineは受理済み。Product HUDは、このarenaに合う方向で`docs/ACTION_HUD_PRODUCT_SPEC.md`に仕様化済み（常時表示のHUDと取組前の比較表示の最初の実装あり。データはprototype fixture）
- Action Product presentationの現在のlogical基準は1920×1080（Product artはこの座標空間で制作・出力し、browser表示はここから縮尺する）。最終的なplatform / performance向けのresolution方針とは別
- 将来的な方向として、Kairosoft系のようにキャラクターが施設内で動くManagement Presentationを目指す

## 未決事項（確定していない）

- 最終操作体系
- 決まり手一覧
- ステータス一覧・数値
- 育成/経営の詳細
- 収益化
- Save方式
- CrazyGames SDK導入時期
- Poki対応
- Mobileの最終仕様
- Art styleの詳細（確定済みは上記のAction Product baselineのみ。最終的な力士のart処理、Management presentationの詳細、その他の未承認のvisualは未決。現在の力士visualは暫定でProduct artはDeferred）
- 最終的なplatform / performance向けのresolution方針（1920×1080は現在のAction Product presentation基準であり、最終・不変とは決めていない。制作側の最適化で内部のrenderingやexportの選択が将来変わる可能性は未決）
- Audio
- exact gameplay formulas

文書中に例が現れる場合、それは決定事項ではない。
