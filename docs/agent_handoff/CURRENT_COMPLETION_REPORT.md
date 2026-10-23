Task-ID: ACTION-13A2-GRIP-RPS-TIMING-STATE-INVESTIGATION
Result: PASS
Branch: develop
Source-Baseline: 67bd34cd56940150789ce45391594830f773fe09
Agent-Start-Head: 5478b71c2806e89252b667d6fd9b0cf3b58c4d70
Implementation-Commit: THIS_COMMIT
Push-Target: origin/develop
Push-Verification: RESOLVE_FROM_GITHUB_AFTER_THIS_COMMIT

# Result

PASS（Investigation / Design。Production変更なし）

組み中の三すくみ（寄り > 吊り > 投げ > 寄り）を、実装に入れられる1つの設計にまとめた。STOP条件には当たらない。

| 項目 | 推奨（v1） |
|---|---|
| 行動のmodel | 3つとも離散のGrip action（startup → 実行 → recovery）。寄りは**Model C**: ArrowUpの押下で1回、押しっぱなしなら、recoveryの後に自動で次の寄りが始まる |
| 判定 | 1つのtick-localな状態から対称に解決するRPS resolver。2人のstartupが重なったtickに解決する |
| Best Timing | 2つ目のactionを受け付けたtickに、先に始まっていたactionの経過が`GRIP_BEST_TICKS`（4）未満ならBest。同じtickもBest。勝者が先か後かは問わない |
| 倍率 | `有効倍率 = 組みの倍率（neutral 1.0 / holder 1.5 / disadvantaged 0.5）× timingの倍率（Best 1.5、それ以外1.0）`。勝者の効果の大きさだけを変え、RPSの勝敗は変えない |
| 寄り | **Yori A**: pairを、自分→相手の向きへ`0.5325 m × 倍率`だけ、24 tickで平行移動する（現在のPushの移動量が基準） |
| 投げ | 相手を投げる本人の自分の左 / 右へ`0.45 m × 倍率`、本人から離れる向きへ`0.15 m`、18 tickで動かす → **FREE**。投げた本人はrecovery 6 tick、投げられた側は`thrown` 18 tick |
| 投げのBest（vs 寄り） | 即座に`fall`で決着（乱数なし、位置は動かさない） |
| 吊り | 単独でも成立（vs none）。勝つと**Lifted**（pair-levelの`engagement`の新しい種類）。60 tickの間、吊った側だけが操作でき、WASDで向き、ArrowUpで前進。倍率は運ぶ速さだけに掛ける。終わったら元の組み（Morozashiも保持）に戻る |
| Shift | FREEではGripの開始のまま。GRAPPLED / LIFTEDでは捨てる（Releaseは廃止） |
| Drive | 廃止して、寄り（Yori A）に置き換える。`driveHeld`は`yoriHeld`に改名し、寄りの繰り返しとLiftedの前進に使う |
| 分割 | 13B = 土台 + 寄り + 投げ + fall + Shift廃止 / 14A = 吊り + Lifted / その後に見た目 |

Userの判断を待たずに進められる。User Play Testで見る項目は、最後の節に挙げた。

# Preflight

- working tree clean、branch `develop`、fetch後の`HEAD...origin/develop` = `0 2`
- Remote CURRENT_TASK: Task-ID一致、Status READY、Target-Branch develop、Source-Baseline `67bd34c`（ancestor）、Handoff-Mode GITHUB
- `97cc767..origin/develop`で変わったのは`docs/agent_handoff/CURRENT_TASK.md`だけ → `merge --ff-only` → `5478b71`
- このcommitは、AGENTS.md §13のInvestigation-only Report Commit Exceptionによる。変更は`CURRENT_COMPLETION_REPORT.md`だけ

# Current Source findings（前提1–15）

| # | 前提 | 根拠 | 判定 |
|---|---|---|---|
| 1 | GRAPPLEDのArrowUp押しっぱなし = timerのない`driveHeld` | `BoutScene`: `driveHeld: this.upKey?.isDown`。押下のedgeはPush latchへ | 一致 |
| 2 | Driveは毎tick決め直し、`drive`として保存 | `step()`: `p.action = driveHeld && ready(p) ? drive : idle` | 一致 |
| 3 | Driveは、pair軸に沿った共有のexternal velocityに寄与 | `updateGrappledExternal()` → `grappledExternalVelocity(shared, n, net)` | 一致 |
| 4 | 目標0.6 m/s、加速4 m/s² | `GRAPPLE_DRIVE_SPEED = 0.6`、`GRAPPLE_DRIVE_ACCELERATION = 4` | 一致 |
| 5 | Morozashiのholderは、Driveだけ1.5 | `MOROZASHI_DRIVE_FACTOR = 1.5`、`grappleDriveStrength` | 一致 |
| 6 | ACTION-12Bの回転は両者READYのときだけ | `if (grappled && ready(a) && ready(b))` | 一致 |
| 7 | GRAPPLEDのShift edgeは、READYならRelease | `releasers = … gripPressed === true && ready(p)` | 一致 |
| 8 | ArrowLeft / RightはFREEのTsuppari edge | latch → `tsuppariLeftPressed / RightPressed` | 一致 |
| 9 | ArrowDownはFREEのCounter edge | latch → `counterPressed` | 一致 |
| 10 | GRAPPLEDでは、Tsuppari / Counterのedgeを無視 | FREEの開始条件`!grappled && !released && idle && stable` | 一致 |
| 11 | bond = 0.70 m | `resolveGrappleBond()`、`BODY_RADIUS = 0.35` | 一致 |
| 12 | `ParticipantPosture.kuzushi`は、GRAPPLEDの勝負の状態ではない | Kuzushiに入るのはFREEのCounter / Tsuppariと、CounterTransitionの完了だけ。組んだ時点でKuzushiはMorozashiとして消費される | 一致 |
| 13 | `BoutOutcome`の決着はring-outだけ | `BoutFinishReason = 'ring-out'` | 一致 |
| 14 | Liftedの状態は無い | `BoutEngagement = free | grappled` | 一致 |
| 15 | Throwの遷移は無い | pair-levelの遷移は`counterTransition`だけ | 一致 |

- 既存testの実行: Drive / GrappleRotation / Grip / Orientation / RingOut / Tokudawara / PushCharge / Push / KuzushiFollowup / CounterTransition / GripContestで、11 files、259 PASS

Sourceとの食い違いではないが、設計に効く事実が2つある（scratchで、`step()`のFREEの順序を再現して計算した）。

1. **「Kuzushiの相手へのPush」の移動量は、通常の約1.18倍しかない**
   - 通常のPush（接触から始めた場合）: 相手は0.5325 m（既存test I9の値と一致）
   - 相手がKuzushi: 0.6293 m（1.182倍）。1.5倍は最初の力のtickだけで、Kuzushiはそこで消費されるため
   - Userの意図は「Best寄り ≈ Kuzushiへの押し、つまり約1.5倍」。v1の目標は、明示された**1.5倍（0.799 m）**にした。食い違いは「User Play Testで見る項目」に挙げた
2. **Pushの移動量は、力の倍率に比例しない**（減衰とclampのため）
   - 倍率0.5 → 0.141倍、0.75 → 0.481倍、1.5 → 1.435倍、2.25 → 1.529倍
   - 「力」を倍率で変える方式（Yori B）では、Morozashi / Bestの倍率が、移動量の倍率にならない
   - これが、寄りを「移動量を決めた遷移」（Yori A）にした主な理由

# ACTION-13Aから置き換える決定

| ACTION-13Aの決定 | 13A2での扱い |
|---|---|
| 確率でのKO（`koChance`、`ThrowProfile`、fmix32のroll、seed、試行の回数） | **すべて廃止**。KOは「投げのBest vs 寄り」だけで、決定的 |
| 外れた投げの後も組んだまま + 投げた本人のrecovery 30 tick | **廃止**。通常の投げ → FREE |
| 相手を本人の周りに回す（orbit。neutral 45°、Morozashi 75°） | **置き換え**。自分の左右への直線 + 離す距離（Part 8） |
| Release > Throw > Drive > WASD回転 | **置き換え**。Releaseは廃止、Driveは寄りに置き換え。新しい順序はPart 19 / 将来のstep順 |
| 「Drive中は投げられない」 | **置き換え**。同じ人の同じtickの優先順位（Part 19）。押しっぱなしの寄りは、新しい投げ / 吊りの押下に負ける |
| 専用のsemantic edge（`throwLeftPressed / throwRightPressed`） | **維持**。寄り（`yoriPressed`）と吊り（`liftPressed`）も同じ形にする |
| 投げる本人がREADY（相手はTURNINGでもよい） | **維持**。3つのaction共通 |
| 自分の左右 = facing ∓ 90° | **維持**。ただし向きは、READYのfacingではなく、本人→相手のpair軸の垂直から取る（2人の左右が厳密に±になる。Part 8） |
| 同時の投げ: 逆のworld方向 = 相殺、同じ方向 = pairごと0.30 m | **維持**。ただし同じ方向でも組んだまま（Part 18） |
| 決着の`reason: 'fall'` + `cause: throw` | **維持** |
| CounterTransitionと同じ型の、Simulationが持つ遷移 | **維持**。寄り / 投げ / 同じ方向のずれに共通の`gripTransition`にする |

# Part 1 — Gripのaction model（寄りの操作）

| | Model A: 3つとも押下で1回 | Model B: 寄りは押しっぱなし、投げ / 吊りは押下 | **Model C: 押しっぱなしで寄りを繰り返す（推奨）** |
|---|---|---|---|
| Best Timing | 開始のtickがはっきりしている | 押し始めの1回だけに時計がある。押し続けている間の寄りには「開始」が無く、投げのBestが定義できない | 1回ずつの寄りに開始のtickがある。Model Aと同じ定義が使える |
| 「寄り」の手触り | 連打が必要。今のDriveの押しっぱなしの感覚は消える | 今のまま | 押しっぱなしで前へ出続ける（1回0.53 mの寄りを、約0.67 sごとに繰り返す。平均約0.8 m/sで、今のDrive 0.6 m/sと近い） |
| 投げへのリスク | 毎回の押下がリスク | 押し始めにしかリスクが無い | 一定のリズムで開始が来るので、相手が読んで投げを合わせられる（意図したリスク） |
| 連打 | recoveryで制限 | — | 連打しても押しっぱなしより速くならない（どちらもrecoveryの後に次が始まる） |
| 実装量 | 小 | 寄りだけ別の型（非対称） | Model Aに「押しっぱなしなら、idleに戻ったtickに開始する」を1つ足すだけ |

推奨はModel C。

- 入力: `yoriPressed`（ArrowUpの押下。FREEの`pushPressed`と同じlatchを1回consumeした値）と、`yoriHeld`（今の`driveHeld`を改名。ArrowUpの`isDown`）
- 寄りを始める条件: 適格（Part 10の共通条件）で、`yoriPressed || yoriHeld`
- 今のDrive（timerのない`drive`）は廃止する（Part 6）。押しっぱなしの意味は、「寄りを繰り返す」と「Liftedでの前進」になる
- STOP条件「押しっぱなしの意味とBestが両立しない」には当たらない（Model Cで両立する）

## 1つのGrip actionの形（3つ共通）

```
participant action:  gripAction { move: 'yori' | 'throw' | 'lift', side?: 'left' | 'right', phase: 'startup' | 'recovery', ticksRemaining }
pair-level:          gripTransition（寄り / 投げ / 同じ方向のずれの実行）、または engagement.lifted（吊りの実行）
```

- startup: `GRIP_ACTION_STARTUP_TICKS` = 10（約167 ms）。相手から見える構え。この間に相手のactionと重なると、勝負になる
- 実行: 本人のactionではなく、pair-levelの遷移かLiftedが持つ（状態を二重に持たない）
- recovery: `GRIP_ACTION_RECOVERY_TICKS` = 6。次のGrip actionを始められない（WASDの回転は使える）
- 重なりが無いままstartupが終わったら、相手 = 「無し」として実行する（Part 3）

# Part 2 — Grip RPS resolver

2つの段階を分ける。

1. **同じ人の、同じtickの入力の優先順位**（Part 19）: 各参加者の入力から、要求を高々1つ選ぶ（`none | yori | throwLeft | throwRight | lift`）
2. **2人の間のRPS**: tick-localな1つの状態から、対称に解決する純関数

```ts
// pure, order-independent: resolveGripContest(a, b) === mirror(resolveGripContest(b, a))
type GripMove = 'yori' | 'throw' | 'lift'
beats(x, y): (x === 'yori' && y === 'lift') || (x === 'lift' && y === 'throw') || (x === 'throw' && y === 'yori')
```

勝負が起きる条件:

- 2人のactionが、同じtickにどちらもstartupにある
- そのうち少なくとも1つが、このtickに受け付けられたもの

startupが重なった最初のtickに、必ず1回だけ解決する。

| 状況 | 結果 |
|---|---|
| 異なるaction | `beats`で勝者を決める。勝者の結果（Part 4のtier）をすぐ実行する。敗者のactionは取り消す（Part 17） |
| 同じaction | Part 18の規則 |
| 片方だけがstartup、相手は無し / recovery / TURNING | 勝負なし。startupが終わったら、相手 = 「無し」として実行する |
| 遷移中 / Lifted中 | 両者の入力を捨てる。受け付けない |
| Morozashi | 勝敗の判定に使わない。勝者の効果の大きさだけ（Part 15） |
| 投げのLeft vs Right | Part 18の、同じactionの規則 |
| 同じ人の同時の押下 | Part 19（resolverより前に、1つに決まっている） |

参加者の並び順で決まるところは無い。`beats`は反対称、tierは2つのstartupの経過だけ（Part 4）、Throw同士は2人の左右が厳密に±（Part 8）。

# Part 3 — 「無し」の振る舞い

GRAPPLEDで「無し」とは:

- 寄り / 投げ / 吊りのどれもしていない（idle、recovery、TURNING）
- WASDの回転は、条件を満たせば使える
- Shiftは捨てる
- 無料のReleaseは無い

| action vs 無し | 結果 |
|---|---|
| 寄り | 通常の寄り（tier `uncontested`、timingの倍率1.0 × 組みの倍率） |
| 投げ（Left / Right） | 通常の投げ → FREE |
| 吊り | 比較は下 |

| | **A: 吊りは単独でも成立（推奨）** | B: 投げへの返しとしてだけ成立 | C: 単独だと弱い |
|---|---|---|---|
| 一貫性 | 3つとも「無しに対しては通常の効果」。表が1枚で読める | 吊りだけが、FREEのCounterのように「来なければ空振り」 | 「単独の倍率」という3つ目の軸が増える |
| Userの意図「吊りは本物のaction」 | 満たす | 隠れた返し技に近い | 満たす |
| balance | 吊りが強すぎないかは、運ぶ速さの1つの値で調整できる（通常の運べる距離0.6 m ≈ 寄り0.53 m） | 吊りは純粋な読み | 調整の値が2つになる |

推奨はA。Play Testで吊りが強すぎれば、Cへ（「単独のときの倍率」を1つ足す）。

# Part 4 — 共通のBest Timing

Kuzushiの姿勢は使わない。tierは、2人のactionのphase（startupの残りtick）だけから導く。新しいtimerは作らない。

```
勝負が起きたtick（2つ目のactionが受け付けられたtick）に:
  earlierElapsed = 先に始まっていたactionのstartupの経過tick（同じtickなら0）
  tier = earlierElapsed < GRIP_BEST_TICKS ? 'best' : 'success'
```

| 質問 | 答え |
|---|---|
| 時計を始める出来事 | 先に始まったaction（どちらでもよい）の受付tick |
| 誰のtimingを測るか | 2人の開始の差`|t_win − t_lose|`。勝者が先でも後でも同じ |
| Success / Bestのtick数 | Best: 差が0–3 tick（`GRIP_BEST_TICKS` = 4、約67 ms）。Success: 差が4–9 tick（重なっていれば、startupの残り全部） |
| 窓は負けたactionの開始だけで開くか | 先に始まったほうの開始で開く（「相手の出だしに合わせる」） |
| 同じtick | Best（Part 5） |
| 最速の反応か、中心の窓か | 2人の開始を中心とした窓（`|差| < 4`）。反応の速さではなく、「読みで同時に合わせた」ことへの報酬 |
| phaseから導けるか | 導ける。勝負のtickに、後から来たほうは経過0なので、先のほうの経過 = 差 |

3つの組み合わせに同じ規則を使う。

| 勝者 vs 敗者 | Success | Best |
|---|---|---|
| 投げ vs 寄り | 通常の投げ → FREE（組みの倍率） | **fallで決着**（倍率は使わない） |
| 吊り vs 投げ | Lifted、運ぶ速さ × 組みの倍率 | 運ぶ速さ × 組みの倍率 × 1.5 |
| 寄り vs 吊り | 寄り`0.5325 m` × 組みの倍率 | × 組みの倍率 × 1.5 |

- 例外は、投げのBestがfallになることだけ（Userの指定）
- 投げの「1.5倍の移動」は、v1では生じない（投げのBestは寄りが相手のときしか起きず、それはfallになる）

なぜ反応の速さ（後から出したほうが早いほどBest）にしなかったか:

- 人の反応は約200–250 ms（12–15 tick）。3–4 tickの窓は、反応では届かない
- 「後出しの速さ」だけを測ると、Bestは事実上「相手と同時に押した」ことと同じになり、それを先 / 後で切り分ける理由が無い
- 反応で返せた場合（相手のstartupを見て、10 tick以内）はSuccessになる。これは保険として残る

# Part 5 — 同じtickの開始とBest

推奨は**A: 同じtickはBest**（Part 4の規則の`差 = 0`。特別扱いしない）。

| 例 | 結果 |
|---|---|
| 寄りと投げが同じtick | 投げのBest → fall |
| 投げと吊りが同じtick | 吊りのBest → Lifted ×1.5 |
| 吊りと寄りが同じtick | 寄りのBest → 寄り ×1.5 |

- Bの「同じtickはSuccess、1 tick後からBest」は、1 tickの差に意味を持たせる理由が無い（どちらも見てから押せない）
- リスクとリターン: 寄りを押しっぱなしにすると、開始のリズムが読めるので、相手は投げのBest（fall）を狙える。これが「寄りのリスク」になる

# Part 6 — 寄りの作り直し

| | **Yori A: 移動量を決めた遷移（推奨）** | Yori B: 短い強いDrive | Yori C: 今のDriveのまま、勝ったら強化 |
|---|---|---|---|
| 移動量 | 正確に`D × 倍率` | 減衰とclampのため、倍率に比例しない（Push: 0.5倍 → 0.14倍） | 押している時間次第 |
| Best 1.5倍との相性 | そのまま掛けられる | 合わない | 勝負の単位が無い |
| 縁 / ring-out | 毎tick、既存の判定 | 既存の判定 | 既存の判定 |
| 見た目 | 決まった長さ・決まったcurveで前へ出る | 加速と減衰 | 連続 |
| 将来の寄りの強さ | `D`をpre-boutの有効値に置き換えるだけ | 力の式が要る | — |

推奨はYori A。

- pairを、寄った本人→相手のpair軸の向き（受付時のtick開始の軸）へ、`YORI_DISTANCE`（0.5325 m）× 有効倍率だけ平行移動する
- 時間は`YORI_TRANSITION_TICKS`（24、0.4 s）、`easeOut(u) = 1 − (1 − u)²`（`counterStaggerEase`と同じ式）
  - 通常: 平均1.33 m/s
  - holderのBest（1.198 m）: 平均3.0 m/s
- 実行の間、bond、両者のfacing、READYの状態は変えない（平行移動だから）
- 速度は経路の変位を報告し、最後に0にする
- Pushの状態（`push`のaction、Pushの強さ）は使わない
  - 0.5325 mは、Prototypeの調整の基準として値を合わせているだけ。式を共有するわけではない
  - 将来のPushの強さと寄りの強さは、別のparameterのまま

# Part 7 / 18 — 同じaction同士

## 寄り vs 寄り

- `net = 組みの倍率(A) − 組みの倍率(B)`（同じactionなのでtimingの倍率は無い）
  - neutral同士（1.0 − 1.0）→ 相殺。移動なし、両者recovery
  - Morozashi（1.5 − 0.5 = 1.0）→ holderの寄り（`YORI_DISTANCE × 1.0`）。tierは`overpower`
- 今のDrive同士（`strength(A) − strength(B)`で、holder 1.5 − 1 = 0.5）と同じ「差し引き」の考え方。Morozashiのholderが押し勝つのは、組みの有利さとして自然
- これはRPSの勝敗の話ではない（同じactionなので）。「倍率はRPSの勝敗を覆さない」とは矛盾しない
- 将来の寄りの強さ: `net = 有効な寄りの強さ(A) − (B)`に置き換えるだけ。v1では値を作らない

## 投げ vs 投げ

13Aの、world方向での分類を維持する。

- 向きは、pair軸の垂直から取る
  - Aの左 = `(n.y, −n.x)`、Bの軸は`−n`なので、Bの左 = −(Aの左)
  - 同じラベル（Left / Left）= 逆のworld方向、違うラベル（Left / Right）= 同じworld方向。誤差なしで決まる

| case | v1 |
|---|---|
| 逆のworld方向 | 相殺。移動なし、組んだまま、両者recovery |
| 同じworld方向 | pairごと、その向きへ`THROW_SHARED_SHIFT`（0.30 m）を18 tickで動かす（`gripTransition`の`shift`）。**組んだまま**（どちらも投げに成功していない）。両者recovery |

- 将来の`throwPower`: 同じ方向のとき、強いほうを通常の投げにする。純関数`resolveSameDirectionThrow`の1か所。v1は常に同じ強さ
- v1では値を作らない（BC42）

## 吊り vs 吊り

- 相殺。移動なし、組んだまま、両者recovery
- 将来の吊りの強さの比較は、同じく1か所の純関数にしておく
- 並び順で勝者を決めることは無い

# Part 8 — 投げの作り直し（通常の投げ → FREE）

| | 相手を本人の周りに回す → FREE（13A） | **自分の左右への直線 + 離す距離 → FREE（推奨）** | 自分の左右への直線だけ |
|---|---|---|---|
| FREEになったときの距離 | 回し終わりは0.70 mちょうど（接触したままFREEになる） | `√((0.70 + 0.15)² + L²)` ≥ 0.85 m。必ず離れる | `√(0.70² + L²)`。disadvantagedの0.225 mでは0.735 m（隙間0.035 m） |
| 倍率 | 角度に掛けると横の移動は`sin`で比例しない。holderのBestで101°（相手が後ろへ回る） | 横の移動`L`に、そのまま比例 | 比例 |
| 読み | 回り込み | 「横へ投げて、突き放す」 | 横へずれるだけ |

推奨は、自分の左右への直線 + 離す距離。

```
s  = 投げる本人の自分の左右（world。pair軸 n = 本人→相手 の垂直: left = (n.y, −n.x), right = (−n.y, n.x)）
L  = THROW_LATERAL_DISTANCE（0.45 m）× 有効倍率（neutral 0.45 / holder 0.675 / disadvantaged 0.225）
終点 = 相手の開始位置 + s·L + n·THROW_RELEASE_SEPARATION（0.15 m）
```

| 項目 | v1 |
|---|---|
| 経路 | 相手だけが、開始点から終点へ直線で動く（`easeOut`）。`THROW_TRANSITION_TICKS` = 18（0.3 s）。投げた本人は動かない |
| 遷移中の組み | `engagement`は遷移が終わるまで`grappled`のまま。bondは遷移が位置を持つので適用しない |
| facing | 遷移中は、毎tick両者とも相手を向く（`updateFacing`のFREEと同じ即時の規則を、遷移の中で使う） |
| 速度 | 相手 = 経路の変位（external）、本人 = 0。終わりで両者0 |
| 終わり | `engagement → free`（Morozashiは消える） |
| 最終の距離 | neutral 0.98 m、holder 1.09 m、disadvantaged 0.88 m。接触（0.702 m）より必ず遠い |
| recovery | 投げた本人: `gripAction throw recovery` 6 tick（FREEのactionを始められない。制動）。相手: 新しい`thrown { ticksRemaining: THROWN_TICKS = 18 }`（FREEのactionを始められない。制動）。差の12 tickが、投げた側の主導権 |
| Kuzushi | 使わない（FREEのKuzushiの1.5倍の追い打ちを、投げにまで広げない） |
| ring-out | 遷移の各tickで、そのtickの開始 → 終了の位置から、既存の判定。縁を越えたら、そのtickで決着（FREEには戻らない） |

投げに勝つのは吊りだけ（吊りの勝ち → Lifted。投げの移動は無い）。投げが寄りに勝つときは、SuccessならこのPartの通常の投げ、BestならPart 9。

# Part 9 — 投げのBest = fall

ACTION-13Aの形を維持する。

```ts
type BoutFinishReason = 'ring-out' | 'fall'
| { kind: 'win'; winnerId; loserId; reason: 'ring-out' }
| { kind: 'win'; winnerId; loserId; reason: 'fall'; cause: { kind: 'throw'; throwerId; side: 'left' | 'right'; direction: Vec2 } }
```

- 遷移は使わず、勝負のtickに即決着する
  - 位置・facing・velocityは、tick開始のまま
  - そのtickの残りのstepは行わない
  - 決着の後の`step()`は何もしない（既存）
- `direction` = 投げた本人の自分の左右のworld向き（Part 8の`s`）。後の見た目の、倒れる向き
- `'fall'`は汎用の決着の理由。技の名前（投げ）は`cause`に分ける。乱数・seedは無い
- 見た目（倒れる動き）は、presentationのTaskで、`cause`とfreezeされた位置から作る

# Part 10 — 吊りの適格（3つ共通の適格）

Grip actionを受け付けるのは、tick開始の状態で次をすべて満たすとき（寄り / 投げ / 吊りで同じ）。

1. `engagement.kind === 'grappled'`（FREE / Lifted / 遷移中では受け付けない）
2. 本人がREADY（既存の`canActInGrapple`）。相手のREADY / TURNINGは問わない
3. 本人のactionがidle（startup / recoveryではない）
4. 押下がある（寄りだけは、押しっぱなしでもよい）

吊りについては:

- 組んでいるときだけ
- 本人がREADYであること
- 相手はTURNINGでもよい（そのときは「無し」として扱い、単独で成立する）
- 単独でも成立する（Part 3)
- 投げにだけ勝ち、寄りには負ける

READYの本人だけにすると、背後からMorozashiで組んだ側（Counter Best → 組み）は、相手がTURNINGの間に、3つのどれも単独で通せる。13Aと同じく、Play Testで見る（強すぎれば「両者READY」に1行で切り替える）。

# Part 11 — Liftedの持ち主

| | **`engagement`の新しい種類（推奨）** | 組みの横に、別の`liftState`を置く |
|---|---|---|
| Source of Truth | 「2人がどうつながっているか」が1か所 | `grappled` + `liftState`の2つを合わせて読む必要がある |
| 既存のgrappledの処理 | `engagement.kind === 'grappled'`の判定（ready、回転、bond、Grip action）が、Liftedでは自然に外れる | Liftedのときに外す条件を、各所に足す必要がある |
| Morozashi | variantが`advantage`を持ち、終わりで戻す | grappledにそのまま残る |
| Snapshot | `engagement: lifted { lifterId, … }`だけで見た目が決まる | 2か所を見る |

推奨:

```ts
type BoutEngagement =
  | { kind: 'free' }
  | { kind: 'grappled'; advantage: GrappleAdvantage }
  | { kind: 'lifted'; lifterId: ParticipantId; advantage: GrappleAdvantage; ticksRemaining: number; carrySpeed: number }
```

- Liftedは、意味の上では組みの続き（つかんだまま）。`advantage`をそのまま持ち、終わりの`grappled`へ戻す
- `carrySpeed`は、入ったときに有効倍率を掛けて決めた値（Part 13）。途中では変わらない
- 参加者側にflagは持たない
- 物理engineは使わない（Part 12の決まった配置）

既存のコードで直すべき点（13B / 14Aの実装の注意）:

- `step()`のローカルな`grappled`（FREEのactionを始めない条件）は、`engagement.kind !== 'free'`の意味に変える必要がある
- `copyEngagement`、`canActInGrapple`（`'grappled'`だけtrue、のまま）、`updateFacing`（Liftedは専用のstepの中で決める）

# Part 12 — Liftedの操作

Liftedのtickは、CounterTransitionと同じく専用の`stepLifted`だけを行う。吊った側の入力の`move`と`yoriHeld`だけを読み、他はすべて捨てる。

- 吊った側: ArrowLeft / Right / Down / Shift / 押下
- 吊られた側: WASDを含めた全部

| 入力 | 規則 |
|---|---|
| WASD（吊った側） | world-frameの`move`がゼロでなければ、吊った側のfacingを`atan2(move)`へ、最大`LIFT_TURN_RATE`（π/2 rad/s、1.5°/tick）× tickだけ最短の向きへ回す（FREEの移動と同じworld基準。ACTION-12Bの接線の回転ではない）。位置は動かさない |
| ArrowUpの押しっぱなし（`yoriHeld`、吊った側） | 吊った側の位置を、facingの向きへ`carrySpeed`× tickだけ進める（加減速なし。離せば止まる） |
| 吊られた側の位置 | 毎tick、`吊った側 + facing·0.70`（吊った側の前、bondの距離）。吊った側を中心にした決まった配置 |
| 吊られた側のfacing | 吊った側を向く（`facing + π`） |
| 速度の報告 | 吊った側 = 自分の足運び（変位 / tick）、吊られた側 = external（変位 / tick） |

- 中点の周りではなく、吊った側を中心にする
  - 吊った側が「運ぶ」と読める
  - 向きを変えると、吊られた側は半径0.70 mで振られる（約1.1 m/s）
- 縁の近くで振ると、吊られた側を外へ出せる（吊り出しの読み）。回る速さの上限で、読める速さに抑える（Play Testで見る）

# Part 13 — 吊りの「効果」の1つの値

| | 長さ | **運ぶ速さ（推奨）** | 運べる最大の距離 |
|---|---|---|---|
| 1.5倍の意味 | 運べる時間が1.5倍（相手が操作できない時間も1.5倍） | 同じ時間で1.5倍の距離 | 距離の上限 |
| 読みやすさ | 時間が倍率で変わる | Liftedの長さは常に同じ（1 s）。進む速さで、Best / Morozashiが見える | 上限に達した後の規則が要る |
| 寄りとの一貫性 | — | 寄りも「時間は同じで距離に掛ける」。同じ考え方 | — |

推奨は運ぶ速さ。長さ（`LIFT_TICKS` = 60）は固定、`carrySpeed = LIFT_CARRY_SPEED（0.6 m/s）× 有効倍率`。

- 長さと速さの両方には掛けない（効果が2乗になるため）
- 向きを変える速さ（`LIFT_TURN_RATE`）にも掛けない

| 有効倍率 | 速さ | 1 sで運べる距離 |
|---|---|---|
| 0.5（disadvantaged） | 0.3 m/s | 0.30 m |
| 0.75（disadvantaged Best） | 0.45 | 0.45 |
| 1.0（neutral） | 0.6 | 0.60（寄り0.53 mと同じくらい） |
| 1.5（neutral Best / holder） | 0.9 | 0.90 |
| 2.25（holder Best） | 1.35 | 1.35 |

# Part 14 — 吊りの終わり

| 項目 | v1 |
|---|---|
| 終わる条件 | 時間切れ（`ticksRemaining` = 0）、またはring-out（どちらかが出たら、既存の規則で決着） |
| ArrowUpを離す | 止まるだけ。時間は減り続ける |
| 自分で下ろす | 無し（新しい入力は作らない） |
| fall | 無し（作らない） |
| 時間切れの後 | `grappled { advantage: Liftedが持っていたもの }`。**Morozashiも戻る** |
| 位置 / facing | 最後の配置のまま（距離0.70 mちょうど）。両者が相手の方位を向いているので、両者READY |
| 速度 | 両者0 |
| recovery | 吊った側に`gripAction lift recovery` 6 tick（自分の実行の後と同じ）。吊られた側は無し（次の駆け引きの主導権は、吊られた側にある） |

組みに戻すのは、Userの「寄りと吊りは組んだまま」と一致する。投げだけがFREEへの出口になる。

# Part 15 — Morozashiの倍率

```ts
advantageMultiplier(engagement, actorId):
  neutral → 1.0;  morozashi.holderId === actorId → MOROZASHI_EFFECT_MULTIPLIER (1.5);  otherwise → MOROZASHI_DISADVANTAGED_EFFECT_MULTIPLIER (0.5)
timingMultiplier(tier):  'best' → GRIP_BEST_EFFECT_MULTIPLIER (1.5);  'success' | 'uncontested' | 'overpower' → 1.0
effectiveMultiplier = advantageMultiplier × timingMultiplier
```

| | Success / 無しに対して | Best |
|---|---|---|
| neutral | 1.0 | 1.5 |
| holder | 1.5 | 2.25 |
| disadvantaged | 0.5 | 0.75 |

| 効果 | 倍率を掛ける量 |
|---|---|
| 寄り | 移動の距離`YORI_DISTANCE` |
| 通常の投げ | 横の移動`THROW_LATERAL_DISTANCE`（離す距離0.15 mには掛けない。接触の回避は倍率と無関係にしたいので） |
| 吊り | `carrySpeed` |
| 投げのBest | 倍率は使わない（fall） |

**RPSの勝敗は、倍率では決して変わらない。**

- `beats`で勝者が決まってから、勝者の倍率で大きさを決める
- 敗者の倍率はどこにも使わない
- disadvantagedの勝者でも、勝者のまま0.5倍の効果を得る
- 倍率が勝敗を覆す経路は構造上無い（STOP条件には当たらない）
- 例外として、同じaction（寄り同士）だけが差し引きになる（Part 7）

今の`MOROZASHI_DRIVE_FACTOR`は、Driveの廃止と一緒に、この`MOROZASHI_EFFECT_MULTIPLIER`に置き換わる。

# Part 16 — Best TimingとMorozashi

推奨は**A: Bestの窓は全員同じ**（`GRIP_BEST_TICKS` = 4）。Morozashiは効果の倍率だけ。

- 窓を広げると、「効果」と「Bestの出やすさ」の両方にMorozashiが効いて、有利さが2重になる
- 窓の幅を将来の力士の能力で変えるかは、Userの判断のまま（この時点の設計は、窓が名前のある1つの値になっているだけ）

# Part 17 — Recovery / commitment

推奨は、actionごとの3段（startup → 実行 → recovery）。ただし実行の段は参加者が持たず、pairの遷移かLiftedが持つ。

| action | startup | 実行（持ち主） | recovery |
|---|---|---|---|
| 寄り | 10 | 24 tick（`gripTransition yori`） | 寄った本人6 |
| 投げ（通常） | 10 | 18 tick（`gripTransition throw`）→ FREE | 投げた本人6（FREE）、相手`thrown` 18 |
| 投げのBest | — | 即決着 | — |
| 吊り | 10 | 60 tick（`engagement.lifted`） | 吊った本人6 |
| RPSで負けたaction | 取り消し | 勝者の実行の間、入力はlock | 実行の終わりで6（Liftedなら、終わりで吊った側だけ6、吊られた側は無し） |
| 同じactionの相殺 | 取り消し | 無し | 両者6（勝負のtickから） |
| 同じ方向の投げ / 寄りの差し引き | 取り消し | 18 / 24 tick | 両者6 |

- recoveryの6 tickはstartupの10より短い。相手が「無し」から次のactionを出したとき、こちらも2–4 tick以内なら、重ねて勝負にできる（一方的な連続にはならない）
- 押しっぱなしの寄りの周期は、`10 + 24 + 6 = 40` tick（0.67 s）で0.53 m

# Part 19 — 同じ人の、同じtickの複数の入力

推奨は、明示の優先順位 + 1つだけの相殺（rawのproperty順には依存しない）。

```
1. ArrowLeftとArrowRightの押下が両方 → 投げの押下は両方捨てる（向きが曖昧）
2. 寄りの押下（yoriPressed）> 投げの押下（Left / Right）> 吊りの押下（liftPressed）> 寄りの押しっぱなし（yoriHeld）
   （FREEの Push > Tsuppari > Counter と同じ並び。押しっぱなしは「続けている意図」なので、新しい押下に負ける）
3. 選ばれなかった押下は捨てる（queueしない）
```

| 例 | 結果 |
|---|---|
| Up + Left（両方とも押下） | 寄り |
| Upの押しっぱなし + Leftの押下 | 投げ（押しっぱなしは負ける） |
| Up + Down（押下） | 寄り |
| Left + Right | 投げは両方捨てる。他の押下か押しっぱなしがあれば、それ |
| Down + Right（押下） | 投げ（Right） |

- 優先順位で選ぶのは、受付が可能なtickだけ（Part 10）
- 受付できないtickの押下は捨てる
- 押しっぱなしは状態なので、受付ができるようになったtickで改めて効く

# Part 20 — Shift Releaseの廃止

| 状態 | Shift（`gripPressed`） |
|---|---|
| FREE | 今と同じGripの開始 |
| GRAPPLED | 捨てる。Releaseなし、recoveryなし、queueなし |
| LIFTED | 捨てる |
| 遷移中（Counter / Grip） | 捨てる（既存のlockと同じ） |

組みから自分で抜ける方法は、通常の投げだけになる。デッドロックは起きない。

- 投げは、本人がREADYでidleなら、いつでも出せる
- TURNINGは、自動の向き直りで必ずREADYになる
- 投げを止められるのは、読みの当たった吊りだけ（それにはLiftedの時間の後で、また投げる機会がある）

13Bで意図して書き直すtest / doc（今のRelease / Driveを前提にしているもの）:

| 対象 | 箇所 |
|---|---|
| `BoutGrip.test.ts` | T105、T106、T107、T109（releaseで消える部分）、T112（releaseのrecovery） |
| `BoutOrientation.test.ts` | T116（READYで次のtickにreleaseできる）、T123–T125、T128（releaseの後の即時のfacing） |
| `BoutDrive.test.ts` | ファイル全体（Driveの廃止。T142 / T143 / T150にはReleaseもある）→ 寄りのtestに置き換える |
| `BoutGrappleRotation.test.ts` | B10（Release + WASD）。それとDriveを使うcase |
| `pushDummyController.ts` / `.test.ts` | `GRAPPLED_DRIVE`（`driveHeld: true`）→ `yoriHeld: true`。test 293行目（`gripPressed`でのrelease） |
| presentation | `wrestlerVisualState`のpose `drive`、`gripSuccessGateArt`（grapple / driveでsuccess pose）、`BoutScene`の`DRIVE`のlabelと操作説明 |
| `docs/ARCHITECTURE.md` | Grip / Engagement、Grappled Orientation、Grappled Drive、Grapple footwork、Intent |

# Part 21 — RPSとACTION-12BのWASD回転

手動の回転を行うのは、tick開始で次をすべて満たすときだけ。

- GRAPPLED、かつ両者がREADY（ACTION-12Bのまま）
- このtickに、Grip actionの受付・勝負・実行の開始が1つも無い
- tickの終わりに、どちらの参加者もstartupにいない
- 遷移もLiftedも無い

| tick | 回転 |
|---|---|
| どちらもGrip actionが無い（idle / recovery） | ACTION-12Bとbit単位で同じ |
| 本人または相手がstartup | しない（構えの間は足を止める。投げの向き、寄りの軸、Bestの判定が、構えの間に変わらない） |
| 受付 / 勝負のtick（相殺を含む） | しない（そのtickのactionが消費する） |
| recovery | する |
| 遷移 / Lifted | しない（遷移が位置を持つ） |

- 押しっぱなしの寄りの間は、ほとんどのtickでstartupか遷移なので、回転はほぼできない
- 今のDriveは回転と同時にできるが、寄りは「構えて出る」actionになるので、これは意図した変化
- Play Testで見る

# Part 22 — Ring-out / Tokudawara

- 寄り / 投げ / 同じ方向のずれ / Liftedのすべての移動は、各tickで、そのtickの開始 → 終了の位置から、既存の`resolveArenaRingOut`が判定する
  - 1 tickの移動は、寄り（holderのBest）でも最初のtickで約0.10 m。Tokudawaraの窓の出入りも、既存の`firstArenaExitFraction`がそのまま扱う
  - 寄り / 投げ / Lifted専用の壁・clamp・境界は作らない

| case | 結果 |
|---|---|
| 寄りで縁へ | 前にいる相手が先に出る → 相手の負け。両者同じtickなら、既存の規則（同時ならrematch） |
| 通常の投げが縁を越える | 遷移のそのtickで決着。FREEへの変化は起きない |
| 投げの遷移が中で終わる | FREEへ |
| Liftedで運ぶ / 振る | 吊られた側、または吊った側が出たtickで決着 |
| 同じ方向のずれ | pairの平行移動。既存の規則 |
| 投げのBest | 動かないので、ring-outは起きない |

優先順位: ring-outが起きたtickで、そのまま決着する。そのtickに予定していた状態の変化（FREEへ、組みへ、recovery）は行わない（CounterTransitionの完了と同じ）。

# Part 23 — Snapshot / presentationの境界

最小の追加（event busは作らない）。

1. 参加者の`action`:
   - `gripAction { move, side?, phase: 'startup' | 'recovery', ticksRemaining }`
   - `thrown { ticksRemaining }`（FREEのよろめき）
2. pair-levelの`gripTransition`:
   - `none`
   - `active { kind: 'yori' | 'throw' | 'shift', actorId?, targetId?, tier: 'best' | 'success' | 'uncontested' | 'overpower', effect, side?, ticksRemaining, totalTicks }`
3. `engagement.lifted { lifterId, advantage, ticksRemaining, carrySpeed }`
4. `outcome`の`reason: 'fall'` + `cause { throw, throwerId, side, direction }`

- 進み具合は`1 − ticksRemaining / totalTicks`
- Best / Successの演出は、`gripTransition.tier`を読めばよい
- canonicalな位置 / facingは、経路に沿ってそのまま動く
- 13Bでは、`drive`のposeを使っていた見た目（Grip successのpose）は、`gripTransition`の間も組みのposeのままにする（ACTION-11Nの見た目は変えない）

# Part 24 — 暫定の値（すべてUser Play Test対象）

| 名前 | 推奨 | 範囲 | 根拠 |
|---|---|---|---|
| `GRIP_ACTION_STARTUP_TICKS` | 10 | 8–14 | 反応で返すには難しく（約167 ms）、読みが主になる |
| `GRIP_BEST_TICKS` | 4 | 3–6 | 2人の開始の差が67 ms未満で「同時に合わせた」 |
| `GRIP_ACTION_RECOVERY_TICKS` | 6 | 4–10 | startupより短い（Part 17） |
| `YORI_DISTANCE` | 0.5325 m | — | 今のPush（接触から）の移動量。Best 0.799 m |
| `YORI_TRANSITION_TICKS` | 24 | 18–30 | 今のPushが動いている時間（27 tick）に近い |
| `THROW_LATERAL_DISTANCE` | 0.45 m | 0.35–0.60 | 13Aのneutral 45°の横（0.495 m）に近い |
| `THROW_RELEASE_SEPARATION` | 0.15 m | 0.10–0.25 | FREEになったとき、すぐ接触しない |
| `THROW_TRANSITION_TICKS` | 18 | 12–24 | 13Aと同じ |
| `THROWN_TICKS` | 18 | 12–30 | 投げた側の主導権12 tick |
| `THROW_SHARED_SHIFT` | 0.30 m | — | 13Aと同じ |
| `LIFT_TICKS` | 60 | 45–90 | 1 s |
| `LIFT_CARRY_SPEED` | 0.6 m/s | 0.4–0.9 | 今のDriveの目標速度。1 sで寄りと同じくらい |
| `LIFT_TURN_RATE` | π/2 rad/s | — | ACTION-12Bの回転と同じ速さ |
| `MOROZASHI_EFFECT_MULTIPLIER` | 1.5 | — | User指定 |
| `MOROZASHI_DISADVANTAGED_EFFECT_MULTIPLIER` | 0.5 | — | User指定 |
| `GRIP_BEST_EFFECT_MULTIPLIER` | 1.5 | — | User指定（Kuzushiの1.5に相当） |

廃止する値: `GRAPPLE_DRIVE_SPEED`、`GRAPPLE_DRIVE_ACCELERATION`、`MOROZASHI_DRIVE_FACTOR`（`grappledExternalVelocity` / `grappleDriveStrength`も）。

- 組み中の共有のexternal velocityは、組んだときの勢いの減衰だけが残る
- 減衰だけなら、今の`net = 0`の処理と同じ

# Part 25 — 将来のparameterの境界

v1では作らない。Productionにも足さない。

将来、Boutが受け取るのは、試合前に決めた参加者ごとの有効値になる見込み。生のManagementのstatではない。

| 有効値 | 置き換える定数 | 使う場所 |
|---|---|---|
| `yoriDistance` | `YORI_DISTANCE` | 寄りの距離 |
| `yoriStrength` | 組みの倍率の差し引き | 寄り同士の`net` |
| `throwLateral` | `THROW_LATERAL_DISTANCE` | 通常の投げ |
| `throwPower` | — | 同じ方向の投げ |
| `liftCarrySpeed` | `LIFT_CARRY_SPEED` | 吊り |
| `liftStrength` | — | 吊り同士 |
| `gripBestTicks` | `GRIP_BEST_TICKS` | Bestの窓（Userの判断が要る） |

v1は定数を使うだけ。倍率（Morozashi / Best）は、Boutの規則として残る。

# 一貫したv1の状態機械

```
FREE
  ├─ Shift → Grip reach → 成立 → GRAPPLED（neutral / Kuzushiの相手ならMorozashi）   ※今のまま
  └─ （thrown / 投げた本人のrecoveryの間は、FREEのactionを始めない）

GRAPPLED { advantage }
  ├─ 何も無い: WASD回転（両者READY、startupなし）/ 自動の向き直り / Shiftは捨てる
  ├─ 本人READY + idle + 押下 → gripAction startup（10）
  │    ├─ 相手のstartupと重なる → RPS（tier: best / success）
  │    │    ├─ 寄り > 吊り → gripTransition yori（D × 倍率）→ GRAPPLED + recovery
  │    │    ├─ 吊り > 投げ → LIFTED（carrySpeed × 倍率）
  │    │    ├─ 投げ > 寄り: success → gripTransition throw → FREE / best → OUTCOME fall
  │    │    └─ 同じaction → 相殺（recovery）/ 寄りの差し引き / 投げの同じ方向のずれ → GRAPPLED + recovery
  │    └─ 重ならずにstartupが終わる（相手は無し）
  │         ├─ 寄り → gripTransition yori → GRAPPLED + recovery
  │         ├─ 投げ → gripTransition throw → FREE（本人recovery 6 / 相手thrown 18）
  │         └─ 吊り → LIFTED
  └─ どの移動の途中でも: ring-out → OUTCOME

LIFTED { lifterId, advantage, ticksRemaining, carrySpeed }
  ├─ 吊った側のWASD = 向き、ArrowUpの押しっぱなし = 前進。他の入力はすべて捨てる
  ├─ 時間切れ → GRAPPLED { advantage }（両者READY、吊った側recovery 6）
  └─ ring-out → OUTCOME
```

- 状態の持ち主は3つだけ: 参加者の`action`（startup / recovery / thrown）、pair-levelの`gripTransition`（実行）、`engagement`（free / grappled / lifted）
- 同じことを2か所で持たない

# 将来の`step()`の順序

1. 決着していれば何もしない。Tsuppariの手のcooldown
2. CounterTransition中 → `stepCounterTransition`で終了（既存）
3. **NEW: `gripTransition`中 → `stepGripTransition`で終了**
   - 入力は捨てる
   - 経路の位置、facing、速度の報告、ring-out
   - 最後のtickで終点に合わせ、速度を0にし、次を行う
     - 寄り / ずれ: 組みのまま、recovery
     - 投げ: FREEにし、recovery / thrown
4. **NEW: `engagement.lifted` → `stepLifted`で終了**
   - 吊った側の`move` / `yoriHeld`だけを読む
   - 配置、facing、ring-out
   - 時間切れなら組みへ戻す
5. tick開始の位置（`previousA / B`）、posture timer
6. tick開始のreadiness（`ready()`）
7. GRAPPLEDのShift → 捨てる（今のrelease blockは削除）
8. **NEW: 期限の来た実行**: startupが終わったaction（相手は無し）を実行に移す
   - 遷移かLiftedが始まれば、その最初のtickを実行して、ring-out → return
9. **NEW: 要求の取得**: 適格な参加者ごとに、Part 19の優先順位で1つ → `gripAction startup`として受け付ける
10. **NEW: RPSの解決**: tick開始の状態 + 受け付けたactionの、1つの状態から
    - fall → 決着してreturn
    - 遷移 / Lifted → 最初のtickを実行し、ring-out → return
    - 相殺 → 両者recoveryにして続ける
11. ~~Driveの判断~~（廃止。`driveHeld`は`yoriHeld`に改名し、意味は寄りの繰り返しとLiftedの前進に変わる）
12. ACTION-12BのWASD回転（Part 21の条件）
13. 以降は今と同じ:
    - FREEのaction開始（`engagement.kind === 'free'`のときだけ。`thrown` / recoveryならidleではないので始まらない）
    - self velocity → external（FREEは減衰。GRAPPLEDは共有の減衰だけ）
    - 積分 → contact → bond / FREEの勝負
    - action timer（`gripAction` / `thrown`のcountdownを足す）→ facing → ring-out

Grip actionの押下・押しっぱなしが無いtickは、8–10が何もしない。このとき、ACTION-12Bの回転とGRAPPLEDの制動・bond・facingは、今とbit単位で同じ（BC15 / BC29 / BC76）。

# 将来の変更fileの候補

| file | 内容 |
|---|---|
| `src/game/sumo/BoutTypes.ts` | intentに`yoriPressed`、`yoriHeld`（`driveHeld`の改名）、`throwLeftPressed / throwRightPressed`、`liftPressed`（14A）。`gripPressed`の説明の更新。action（`gripAction`、`thrown`、`drive`の削除）、`BoutGripTransition`、`engagement.lifted`（14A）、`fall` + `cause` |
| `src/game/sumo/gripContest.ts`（新規、純関数） | `selectGripRequest`（Part 19）、`resolveGripContest`（RPS + tier）、`gripEffectMultiplier`、`ownSideDirection`、`resolveSameDirectionThrow`、経路の点 |
| `src/game/sumo/BoutSimulation.ts` | step()の3 / 4 / 7–12、`stepGripTransition`、`stepLifted`（14A）、Drive / Releaseの削除、copy関数 |
| `src/game/scenes/BoutScene.ts` | ArrowUp / Left / Right / Downのlatchを、FREE用とGRAPPLED用のfieldの両方に入れる。押しっぱなし。操作説明、phase text |
| `src/game/input/pushDummyController.ts` | `NO_INPUT`の新しいfield。`GRAPPLED_DRIVE` → `yoriHeld` |
| `src/game/presentation/*` | `drive`のposeの削除 / 置き換え（組みのpose）。`formatOutcome`のfall（必要なら） |
| tests | `BoutGripRps.test.ts`、`BoutYori.test.ts`、`BoutThrow.test.ts`（13B）、`BoutLift.test.ts`（14A）。Part 20の既存testの書き直し |
| `docs/ARCHITECTURE.md` | Part 20の各節 |

# 将来の境界case（80件）と検証の対応

T = 自動test（file名は上の候補）、S = browser smoke、P = User Play Test。

| # | case | 期待 | 検証 |
|---|---|---|---|
| 1 | 寄り vs 吊り | 寄りのSuccess（D × 組みの倍率） | T `BoutGripRps` |
| 2 | 寄りのBest vs 吊り | D × 1.5 | T |
| 3 | 吊り vs 投げ | Lifted（速さ0.6） | T `BoutLift`（14A） |
| 4 | 吊りのBest vs 投げ | 速さ0.9 | T（14A） |
| 5 | 投げ vs 寄り | 通常の投げ → FREE | T `BoutThrow` + S |
| 6 | 投げのBest vs 寄り | fall | T + S |
| 7 | 寄り / 投げが同じtick | Best → fall | T |
| 8 | 吊り / 投げが同じtick | 吊りのBest | T（14A） |
| 9 | 寄り / 吊りが同じtick | 寄りのBest | T（14A） |
| 10 | 開始の差が4以上 | Success（差3はBest、差4はSuccessの境界） | T |
| 11 | 寄り vs 無し | D × 組みの倍率、`uncontested` | T `BoutYori` |
| 12 | 投げLeft vs 無し | 自分の左へ → FREE | T + S |
| 13 | 投げRight vs 無し | 自分の右へ → FREE | T + S |
| 14 | 吊り vs 無し | Lifted（Option A） | T（14A） |
| 15 | 何も無い → ACTION-12Bの回転 | bit単位で同じ | T（既存B1–B19を維持） |
| 16 | neutral Success | 1.0 | T（純関数） |
| 17 | neutral Best | 1.5 | T |
| 18 | holder Success | 1.5 | T |
| 19 | holder Best | 2.25 | T |
| 20 | disadvantaged Success | 0.5 | T |
| 21 | disadvantaged Best | 0.75 | T |
| 22 | 倍率が勝敗を覆さない | disadvantagedの投げ vs holderの寄り → 投げの勝ち（効果0.5） | T（全組み合わせのmatrix） |
| 23 | 投げのBestは常にfall | holder / disadvantagedでもfall | T |
| 24 | 通常の寄り ≈ Push | 0.5325 m（1e-9） | T |
| 25 | Bestの寄り | 0.79875 m | T |
| 26 | 縁での寄り | 既存のring-out | T + S |
| 27 | neutralの寄り同士 | 相殺、移動0、両者recovery | T |
| 28 | Morozashiの寄り同士 | holderがD × 1.0、`overpower` | T |
| 29 | 寄りの入力が無い | ACTION-12Bの零入力と同じ | T |
| 30 | 上下左右のfacing → 自分の左右 | 13Aの表 | T（純関数） |
| 31 | 任意のfacing | 同じ式（pair軸） | T |
| 32 | 通常の投げの横の移動 | 0.45 × 倍率 + 0.15 | T |
| 33 | 通常の投げ → FREE | 遷移の最後のtickで`free` | T |
| 34 | 投げの後の距離 / facing / 速度 | ≥ 0.85 m、向かい合う、速度0、recovery 6 / thrown 18 | T |
| 35 | 縁での通常の投げ | 遷移のtickで決着、FREEにならない | T + S |
| 36 | Tokudawaraを通る | 窓の内 / 外で既存の境界どおり | T |
| 37 | 投げのBestの決着 | `fall`、`cause.throw`、位置不変 | T |
| 38 | 乱数なし / replay | 同じscriptで同じSnapshot。`src`に`Math.random`が無い | T + grep |
| 39 | 投げ同士・逆のworld方向 | 相殺、組んだまま | T |
| 40 | 投げ同士・同じworld方向 | 0.30 mのずれ、組んだまま | T |
| 41 | 1人がLeft + Right | 投げは捨てる | T |
| 42 | 同じ方向の将来の強さ | `resolveSameDirectionThrow`は、v1では常に同じ（値は無い） | T（純関数） |
| 43 | 吊りの勝ち → Lifted | `engagement.lifted` | T（14A） |
| 44 | 吊られた側は何もできない | 全入力を捨てる | T（14A） |
| 45 | LiftedのWASD | 向きをπ/2 rad/sで変える | T（14A） |
| 46 | LiftedのArrowUp | 前進 = carrySpeed | T（14A） |
| 47 | LiftedのLeft / Right / Down / Shift | 捨てる | T（14A） |
| 48 | 通常の吊り | 0.6 m/s | T（14A） |
| 49 | Bestの吊り | 0.9 | T（14A） |
| 50 | holderの吊り | 0.9 | T（14A） |
| 51 | holderのBestの吊り | 1.35 | T（14A） |
| 52 | disadvantagedの吊り | 0.3 | T（14A） |
| 53 | 時間切れ → 組み | 60 tickで`grappled` | T（14A） |
| 54 | 組みの有利さが戻る | Morozashiが戻る | T（14A） |
| 55 | Liftedでのring-out | 運ぶ / 振るで決着 | T + S（14A） |
| 56 | LiftedとTokudawara | 既存の境界 | T（14A） |
| 57 | 吊り同士 | 相殺 | T（14A） |
| 58 | 吊りの状態が1か所だけ | 参加者側にflagが無い（型 + Snapshot） | T（14A） |
| 59 | FREEのShift | 今のGrip | T（既存） |
| 60 | GRAPPLEDのShift | 何も起きない | T（T105ほかを書き直し） |
| 61 | LIFTEDのShift | 何も起きない | T（14A） |
| 62 | 組みから抜けるのは通常の投げだけ | FREEになるのは投げの完了だけ | T |
| 63 | 同じ人のUp + Left | 寄り（両方押下）/ 投げ（Upは押しっぱなし） | T |
| 64 | 同じ人のUp + Down | 寄り | T（Downは14A） |
| 65 | 同じ人のLeft + Right | 捨てる | T |
| 66 | 同じ人のDown + Right | 投げ | T（14A） |
| 67 | 受け付けたactionとWASDが同じtick | 回転なし | T |
| 68 | recovery中のWASD | 回転あり | T |
| 69 | TURNING | TURNINGの本人は受付なし。READYの側は、相手がTURNINGでも単独で通る | T + S |
| 70 | 最初のREADYのtick | tick開始でREADYのtickから受付 | T |
| 71 | 押下を溜めない | startup / recovery / 遷移中の押下は、後で効かない | T |
| 72 | FREEのPush | 変わらない | T（既存） |
| 73 | FREEのTsuppari | 変わらない | T（既存） |
| 74 | FREEのCounter | 変わらない | T（既存） |
| 75 | Shiftでの組み | 変わらない | T（既存） |
| 76 | 何も無いtickの回転 | 変わらない | T（既存） |
| 77 | ring-outのfixture | 変わらない | T（既存） |
| 78 | CounterTransition | 変わらない | T（既存） |
| 79 | FREEのKuzushi | 変わらない | T（既存） |
| 80 | ACTION-11Nの組みの見た目 | 変わらない（grapple中は同じpose / VFX） | T（既存）+ P |

代表のsamplingにせず、すべてをtestで扱う。13Bでは1–2, 5–7, 10–13, 15–42, 59–60, 62–63, 65, 67–80（Liftに依存しないもの）。14Aでは残り。

# 推奨のTask分割

**ACTION-13B — Grip RPSの土台 + 寄り + 投げ（User Play Test必須）**

- 新しいsemantic入力（寄り / 投げ）、Shift Releaseの廃止、Driveの廃止
- `gripAction`、共通のstartup / Best / recovery、resolver（全体の表を持つ純関数。13Bでは吊りの要求が作られない）
- 寄り（Yori A）、寄り同士、通常の投げ → FREE、投げ同士、投げのBest → fall、Morozashiの倍率
- ACTION-12Bとの統合、test、smoke

**ACTION-14A — 吊り + Lifted（User Play Test必須）**

- `liftPressed`（ArrowDown）、`engagement.lifted`、`stepLifted`、操作、終わり、ring-out、吊り同士
- resolverに、吊りの行（寄り > 吊り > 投げ）を有効にする（足すだけ）

**その後 — 見た目**（寄り / 投げ / 吊り / fallのpose。User Visual Gate）

分けた理由と注意:

- Liftedは、新しい状態と操作のmodeで、13Bに入れるとtestの範囲が倍になる
- 13Bの時点では、投げに勝つ手が無い（寄りは投げに負けるだけ）。したがって13BのPlay Testは「仕組み（timing、寄りの手触り、投げ → FREE、fall）」を見るもので、三すくみのbalanceは14Aの後に見る
  - これをUserが受け入れられない場合だけ、13Bと14Aを1つにする（どちらを選んでも、設計は同じで、意味の重複は生じない）

# User Play Testで確かめる項目（BLOCKERではない）

1. 寄りのModel C: 押しっぱなしで繰り返す手触り（Driveの連続した押しとの違い）。押しっぱなしの間はWASDの回転がほぼできないこと
2. Bestの窓: 「2人の開始の差が4 tick未満」（同じtickを含む）で、狙って出せるか、出すぎないか
3. Bestの寄りの目標: 今の「Kuzushiへの押し」は約1.18倍（0.629 m）だが、v1は1.5倍（0.799 m）。どちらに寄せるか
4. 吊りは単独でも成立（Option A）で強すぎないか（強すぎればOption C）
5. 背後からのMorozashiの組みで、READYの本人だけが動ける規則が強すぎないか（強すぎれば「両者READY」）
6. 通常の投げの後の距離（0.85 m以上）と、`thrown` 18 tickの主導権
7. Liftedで振って吊り出す強さ（`LIFT_TURN_RATE`）
8. 13BのPlay Testでは、三すくみのbalanceはまだ見ない（吊りは14A）

# Design Deviations

Design Deviations: N/A（Investigation）

# Unexpected Scope

- 無し
- 参考:
  - 今のKuzushiへのPushの移動量は約1.18倍（上の「Current Source findings」）
  - `formatOutcome`は決着の理由を読まない（fallを区別して見せるには1か所の追加。13Aと同じ）

# Verification

- source inspection:
  - `AGENTS.md`、`docs/ARCHITECTURE.md`、`CURRENT_TASK.md`、前のCompletion Report（13A）
  - `BoutTypes.ts`、`BoutSimulation.ts`（`step`、release、Drive、回転、CounterTransition、`resolveForces`、`resolvePush`、`advanceAction`、`updateFacing`）
  - `grappleOrientation.ts`、`ringOut.ts`、`pressLatch.ts`、`movementVector.ts`、`pushDummyController.ts`、`BoutScene.ts`
  - Release / Driveに依存するtestの洗い出し（Part 20）
- 既存testの実行: Drive / GrappleRotation / Grip / Orientation / RingOut / Tokudawara / PushCharge / Push / KuzushiFollowup / CounterTransition / GripContestで、11 files、259 PASS
- scratch（scratchpadの`rps13a2.mjs`、commitしない）:
  - FREEのPushの移動量の再現（0.5325 m。既存test I9と一致）
  - Kuzushiの相手（0.6293 m）、倍率ごとのPushの移動量（比例しないこと）
  - Driveを1 s押した距離（0.56 m）
  - 寄りの遷移の速さ
  - 投げの回す角度と直線の比較（最終の距離）
  - 吊りの速さ × 時間
- Production / docs / tests / assetsの変更: なし

# Git delivery

- Investigation-only Report Commit Exception（AGENTS.md §13）: 変更は`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`だけ
- 1 commit（`docs(agent): report ACTION-13A2-GRIP-RPS-TIMING-STATE-INVESTIGATION`）
- fetch → fast-forwardの安全を確認 → `origin/develop`へpush → remote SHAを確認 → working tree clean
- User Play Test: このInvestigationでは対象外。13B / 14Aで必須
