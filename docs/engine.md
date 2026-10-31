# ゲームエンジン（@stext/core）の使い方

`@stext/core` は、シナリオ JSON（stext/2）を受け取ってゲームを進めるエンジンです。DOM にも Node にも依存しないので、ブラウザのプレイヤー（Phase 4）、`stext play`、テストのどこからでも同じように使えます。

進行の規則は旧エンジン（snext1220/stext の `stext/sgml.js`）と同じです。旧エンジンとの差分テストの結果は [移行計画書 §5.2](migration-plan.md#52-phase-3-の検証旧エンジンとの差分テスト) を参照してください。

## 基本の流れ

```ts
import { createEngine, emptyGlobalState } from '@stext/core';

const engine = createEngine(scenario, { scenarioId: 'scepter' });

// 新しいキャラクターで始める（シーン 0 に入った状態が返る）
let { state, global, events } = engine.start(emptyGlobalState());

// 表示する内容
const view = engine.view(state, global);
// view.markdown … 本文（Markdown、${...} は展開済み）
// view.choices  … 選べる選択肢（条件を満たすものだけ）

// 選択肢を選ぶ
const r = engine.choose(state, global, view.choices[0].index);
if (r.kind === 'moved') ({ state, global, events } = r);
```

- 状態（`state`・`global`）は**値として受け渡し**ます。エンジンは渡された状態を書き換えず、新しい状態を返します。履歴（「戻る」）は、呼び出し側が以前の状態を持っておけば実現できます。
- `events` は、アイテム入手・実績獲得などの出来事です。トースト表示などに使います。

## 状態

| 型 | 内容 | 旧エンジンでの保存先 |
| --- | --- | --- |
| `GameState` | シナリオごとのセーブデータ（キャラクター、星、アイテム、フラグ、パラメーター、現在のシーンなど） | `localStorage[シナリオID]` |
| `GlobalState` | シナリオをまたぐデータ（ボーナスアイテム、全シナリオの実績、設定） | `localStorage['sorcerian_text']`（`GLOBAL_SAVE_KEY`） |

どちらも**旧エンジンのセーブデータと同じ形**です（`ellapsed_scene` などの綴りも含む）。旧セーブデータは `readLegacySave` / `readLegacyGlobal` でそのまま読み込めます。

## createEngine のオプション

| オプション | 内容 |
| --- | --- |
| `scenarioId` | シナリオ ID（実績の保存先）。省略時は `meta.id` |
| `random` | 0 以上 1 未満を返す乱数源。省略時は `Math.random`。`seededRandom(seed)` で再現できる乱数を作れる |
| `cache` | ランダム遷移の結果を `randomCacheDays` の間保持する仕組み（`get` / `set`）。旧エンジンは Cookie を使っていた |
| `scenarioResults` | `${result?id}`・`${result_rate?id}` 用。他のシナリオの獲得実績数と総数を返す |

## 進行

| 関数 | 内容 |
| --- | --- |
| `start(global, { memos })` | キャラクターを作り（ボーナスアイテムの適用を含む）、シーン 0 に入る |
| `newCharacter(global, { constraint, memos })` | キャラクター作成画面用の下書きを作る（制約を絞れば、種族などを選んだ振り直しになる） |
| `begin(character, global)` | 作ったキャラクターで冒険を始める（開始時のボーナスを適用し、シーン 0 に入る） |
| `view(state, global)` | 現在のシーンの表示内容（`SceneView`） |
| `choose(state, global, index, input?)` | 選択肢を選ぶ。`input` は番号入力・文字入力の値 |
| `enterScene(state, global, id)` | 指定のシーンに直接入る（デバッグ用） |
| `castMagic(state, global, name)` | 魔法シートから魔法を唱える（星を消費して HP 回復などを反映） |
| `setParam(state, id, value)` | 本文の `${input?p01}` の入力欄から、パラメーターに値を代入する |
| `sceneText(state, global, id)` | 指定したシーンの本文を展開する（Battle Sheet のルール表示など） |

`choose` の結果:

| `kind` | 内容 |
| --- | --- |
| `moved` | 移動した。`state`・`global`・`events`、続編があれば `carryOver`（シナリオ ID → 引き継ぐ状態）を含む |
| `back` | 「戻る」（遷移先 90000）で、パラメーター `p99` がない。呼び出し側で直前の状態に戻す |
| `rejected` | 移動しなかった。`reason` は `notEnoughStars`（魔法の星が不足）、`notAllowed`（入力した番号に移動できない）、`hidden`（条件を満たさない）、`missingScene`（遷移先がない） |

エンディング（`view.end`）に着いた状態は `isEnded: true` になります。続けて遊ぶには `start` で新しく始めます。

## 表示（SceneView）

| 項目 | 内容 |
| --- | --- |
| `markdown` | 本文。共通フッター（`meta.footerScene`）も付いている |
| `afterText` | 選択肢の後ろに表示する文章 |
| `choices` | `{ index, kind: 'go' \| 'jump' \| 'answer', label, before?, footer }` |
| `enemies` | 登場する敵の定義 |
| `end` | `happy` / `bad` / `good` |
| `bgm` | 再生する曲（`@field01` など。空ならメインテーマ。エンディングでは `meta.bgm` の曲） |
| `se` / `dice` / `rule` / `tweet` | 効果音、ダイスの指定、Battle Sheet に出すルールのシーン、共有用の文 |

`markdown` と選択肢の `label` には、次の HTML が入ることがあります。UI はこれを描画します。

| HTML | 元の記法 | 内容 |
| --- | --- | --- |
| `<span style="color:blue">` | `%blue%`…`%/%` | 文字色 |
| `<ruby>主<rp>（</rp><rt>ぬし</rt><rp>）</rp></ruby>` | `${主\|ぬし}` | ルビ |
| `<div class="stext-effect" data-effect="fadeInDown">` | `${effect fadeInDown}`…`${/effect}` | 文字の演出 |
| `<stext-input param="p01" value="3">` | `${input?p01}` | パラメーターを増減する入力欄 |

本文中の画像（`![説明](file.png)`）のパスはシナリオのディレクトリからの相対パスのままです。URL の自動リンクも Markdown の描画側で行います。

## 戦闘

Battle Sheet の操作は、UI から一つずつ呼びます。いずれも旧エンジンと同じ計算です。

```ts
const ctx = engine.effectContext(copyOfState, global, events); // 状態は複製してから渡す
const dice = rollDice(random, view.dice);                        // 既定は6面2個
const { func } = selectFunc(random, enemy.func);                 // カンマ区切りならランダムに一つ
receiveAttack(ctx, enemy.attack, func, dice.values, multiplier);  // 敵の攻撃を受ける
attackEnemy(ctx, enemy, currentHp, dice.values, multiplier);      // こちらから攻撃する
const drop = dropFor(random, enemy);                              // 戦利品を決める
if (drop) applyDrop(ctx, drop.drop);                              // 戦利品を反映する
```

`multiplier` は Battle Sheet の倍率（×2、×1、×1/2、×1/4）です。PROTECT などの魔法の効果は、旧エンジンと同じくプレイヤーがこの倍率で反映します。

## コマンドラインで遊ぶ

```bash
npm run build
node packages/cli/dist/bin.js play scenarios/scepter/scenario.json
node packages/cli/dist/bin.js play scenarios/scepter/scenario.json --auto 30 --seed 1
```
