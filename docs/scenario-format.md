# シナリオ JSON（stext/2）リファレンス

SORCERIAN Text v2 のシナリオは、JSON 形式（`format: "stext/2"`）で書きます。
旧形式の `scenario.xml` と Playground の JSON は、`stext convert` で変換できます（一方向のみ）。

- スキーマの定義: `packages/schema/src/scenario.ts`（型と JSON Schema はここから生成）
- エディター補完用の JSON Schema: [`schema/scenario.v2.json`](../schema/scenario.v2.json)（GitHub Pages で `https://snext1220.github.io/stext-next/schema/scenario.v2.json` として公開）
- 変換済みの旧シナリオ: [`scenarios/`](../scenarios/)（一覧は `index.json`、変換時の指摘は `REPORT.md`）

ファイルの先頭に `$schema` を書いておくと、VS Code などで項目の補完と検査が効きます。

```json
{
  "$schema": "https://snext1220.github.io/stext-next/schema/scenario.v2.json",
  "format": "stext/2",
  "meta": { "title": "新・消えた王さまの杖", "author": "Rio" },
  "items": [], "flags": [], "params": [], "enemies": [], "results": [],
  "groups": [], "licence": [],
  "scenes": []
}
```

## 全体

| 項目 | 内容 |
| --- | --- |
| `format` | `"stext/2"`（必須） |
| `meta` | タイトル・作者・BGM などシナリオ全体の情報 |
| `items` / `flags` / `params` / `enemies` / `results` | アイテム・フラグ・パラメーター・敵・実績の定義 |
| `groups` | シーンのまとまり（`start`〜`end` の範囲と、そのルール） |
| `licence` | 使用素材のクレジット |
| `scenes` | シーン（パラグラフ）の配列 |

## meta

| 項目 | 旧形式 | 内容 |
| --- | --- | --- |
| `id` | ディレクトリ名 | シナリオ ID |
| `title` / `author` | `<scenario title author>` | |
| `description` / `keywords` | `<intro description keywords>` | `keywords` は配列 |
| `constraint` | `<constraint race age sex>` | キャラクター作成の制約。`race` `age` は配列 |
| `bgm` | `<bgm main happy bad>` | 通常・ハッピーエンド・バッドエンドの曲 |
| `labels` | `<label free1 ...>` | ステータス欄の表示名の置き換え |
| `imageSet` | `<basic imgset>` | `"custom"` でシナリオ独自のキャラクター画像（`chara/性別_年齢_種族.png`） |
| `showSummary` | `<basic summary="true">` | 見出しにシーン番号ではなく `summary` を出す |
| `footerScene` | シーン 99998 | 全シーンの末尾に付けるシーン。`end` のシーンと `excludeFooter: true` のシーンには付けない |

## シーン

```json
{
  "id": "1010",
  "summary": "凹んだ床",
  "text": "君はその時、数歩先の床が微妙に凹んでいることに気付く。\n\n![王さまの杖](scepter.png)",
  "choices": [
    { "label": "ふむ！", "to": ["1020"] },
    { "label": "石を投げる", "to": ["1030"], "if": "i01" }
  ],
  "effects": { "flags": ["f01"], "hp": -3 },
  "enemies": ["m01"]
}
```

| 項目 | 旧形式 | 内容 |
| --- | --- | --- |
| `id` / `summary` | 同名の属性 | |
| `text` | 本文 | Markdown と `${...}` マクロ。**選択肢は含めない** |
| `choices` | 本文中のリンク | 選択肢（下記） |
| `afterText` | 選択肢の後ろの本文 | 選択肢の下に表示する文章 |
| `effects` | `items` `flags` `hp` など | シーンに入ったときの効果（下記） |
| `enemies` | `enemies` | 登場する敵の ID の配列（同じ ID の繰り返しは複数体） |
| `end` | `end` | `"happy"` / `"bad"` / `"good"` |
| `nexts` | `nexts` | 続編として案内するシナリオ ID の配列 |
| `bgm` / `se` / `rule` / `dice` | 同名の属性 | `bgm: ""` はメインテーマに戻す。`rule` はルールとして表示するシーンの ID |
| `excludeFooter` | `exclude="true"` | `meta.footerScene` を付けない |
| `editor` | `x` `y` `level` `color` `group` | エディター専用の情報。エンジンは使わない |

本文中のマクロ（`${if 条件}…${/if}`、`${import シーンID}`、`${name}` など）は旧形式のまま使えます。

敵の `hp` には数値のほか、パラメーター ID（`"p01"`）も書けます。その場合は戦闘で敵の HP を減らすと、パラメーターも更新されます。

### 選択肢

通常の選択肢:

| 項目 | 内容 |
| --- | --- |
| `label` | ボタンの文言 |
| `to` | 遷移先のシーン ID の配列。複数あればランダムに一つ（同じ ID を重ねると確率が上がる）。`"90000"` は「戻る」 |
| `if` | 表示条件（下記） |
| `cast` | 選んだときに唱える（星を消費する）魔法名の配列 |
| `randomCacheDays` | ランダムの結果を保持する日数（旧形式の `;7`） |
| `before` | この選択肢の直前に表示する文章 |

旧形式との対応:

| 旧形式 | stext/2 |
| --- | --- |
| `[次へ](1010)` | `{ "label": "次へ", "to": ["1010"] }` |
| `[石を投げる](1030 "i01")` | `{ "label": "石を投げる", "to": ["1030"], "if": "i01" }` |
| `[唱える](1040 "mHEAL")` | `{ "label": "唱える", "to": ["1040"], "if": "mHEAL", "cast": ["HEAL"] }` |
| `[逃げる](6700,6700,6701;7)` | `{ "label": "逃げる", "to": ["6700", "6700", "6701"], "randomCacheDays": 7 }` |
| `[500,600,700](X)` | `{ "kind": "jump", "allow": ["500", "600", "700"] }`（番号を入力して移動） |
| `[ペンタウァ,42,43](Q)` | `{ "kind": "answer", "answer": "ペンタウァ", "to": "42", "else": "43" }`（文字を入力して答える） |

### 効果（effects）

値の書き方は旧形式を引き継いでいます。

| 項目 | 例 | 内容 |
| --- | --- | --- |
| `items` | `["i01", "-i02", "i03:2", "i03:@5"]` | 入手・消失・個数の増減と代入 |
| `flags` | `["f01", "-f02"]` | 立てる・消す（消せるのは隠しフラグだけ） |
| `params` | `["p01:1", "p01:@5", "p02:Rio"]` | 加算・数値の代入・文字列の代入 |
| `stars` | `[1, 0, 0, 0, 0, 0, -1]` / `"div2"` | 星の増減（月・火星・水星・木星・金星・土星・太陽の順）/ すべてを 1/2 |
| `hp` / `mp` | `-5` / `"-5..-1"` / `"full"` / `"half"` | 増減・範囲内のランダム・全快・半分 |
| `str` `int` `dex` `krm` | `1` / `"@5"` / `"full"` | 増減・代入・初期値に戻す |
| `free1` `free2` `free3` | `1` / `"@5"` / `"-3..-1"` | 増減・代入・範囲内のランダム |
| `max` | `{ "hp": 10, "str": "1..5" }` | 最大値・初期値の増減（旧形式の `hp_max` など） |
| `state` | `"poison"` / `"-poison"` / `"-all"` | 状態異常にする・解除する・すべて解除 |
| `result` | `"r01"` | 実績を獲得する |

## 条件

`if` には、旧形式と同じ**文字列記法**か、構造化した**条件 AST** のどちらかを書けます。エンジンは文字列を読み込み時に AST に変換して評価します。
`stext convert --structure-conditions` で変換すると、条件を AST で出力します。

```jsonc
// 文字列記法
"if": "(f01&!i01)|oDEX6"

// 条件 AST（同じ意味）
"if": { "any": [
  { "all": [ { "flag": "f01" }, { "not": { "item": "i01" } } ] },
  { "stat": "dex", "gte": 6 }
]}
```

| 条件 AST | 文字列記法 | 意味 |
| --- | --- | --- |
| `{ "all": [A, B] }` | `A&B`、`A,B` | すべて真 |
| `{ "any": [A, B] }` | `A\|B` | いずれかが真 |
| `{ "not": A }` | `!A`、`-A` | 否定 |
| `{ "flag": "f01" }` | `f01` | フラグが立っている |
| `{ "item": "i01" }` | `i01` | アイテムを持っている |
| `{ "result": "r01", "scenario": "scepter" }` | `r01:scepter` | 実績を獲得済み |
| `{ "magic": "HEAL" }` | `mHEAL` | その魔法を唱えられる |
| `{ "stars": [1,0,0,1,0,0,0] }` / `{ "stars": 10 }` | `s1:0:0:1:0:0:0` / `s10` | 星を個別に／総数で所持 |
| `{ "stat": "dex", "gte": 6 }` | `oDEX6` | 能力値が 6 以上（`oDEX6+` は `gt`、`oDEX6-` は `lt`） |
| `{ "param": "p01", "eq": 3 }` | `p01:@3` | パラメーターが 3（`p01:3` は `gte`、`p01:Rio` は文字列の一致） |
| `{ "elapsed": { "gte": 30 } }` | `e30` | 経過シーン数が 30 以上 |
| `{ "chara": "POISON" }` | `xPOISON` | 種族・性別・年齢・状態異常・職業のいずれかが一致 |
| `{ "fn": "rand", "args": [50] }` | `fn:rand(50)` | 組み込み関数（`rand` `include` `range` `cycle`） |

文字列記法の注意:

- `&` `|` `!` `( )` の優先順位は `!` → `&` → `|` です。
- カンマ区切り（`f01,f02`）は「すべて」、先頭の `-`（`-f01,f02`）は**全体**の否定です。
- カンマ区切りの途中に `-` を書くこと（`f01,-f02`）はできません。旧エンジンではこの項が常に偽になっていました。`f01&!f02` と書いてください。

## 検査

```bash
npm run build
node packages/cli/dist/bin.js validate scenarios/scepter/scenario.json
```

スキーマ（項目と値の形）に加えて、存在しない遷移先、解釈できない条件、定義されていない ID などを報告します。
