# 書庫一覧 JSON（`scenarios/index.json`）リファレンス

`scenarios/index.json` は、プレイヤーの書庫に表示するシナリオの一覧です。ルートは JSON 配列で、各要素がシナリオ 1 本分の情報を持ちます。シナリオ本文を定義する `scenario.json` とは別のファイルです。

- 一覧の原本: [`scenarios/index.json`](../scenarios/index.json)
- プレイヤー側の型: [`ScenarioEntry`](../apps/player/src/data.ts)
- 旧形式からの変換処理: [`stext convert-all`](../packages/cli/src/index.ts)
- シナリオデータから新規項目を追加する手順: [scenario-index-entry スキル](../.github/skills/scenario-index-entry/SKILL.md)

## 形式

```json
[
  {
    "id": "scepter",
    "title": "新・消えた王さまの杖",
    "author": "Rio",
    "listed": true,
    "series": "王さまの杖",
    "tags": ["探索", "冒険"],
    "published": "2026-01-15",
    "updated": "2026-02-01",
    "v2": true,
    "level": 3,
    "comment": "書庫に表示する紹介文です。",
    "scenes": 120,
    "results": 5,
    "clears": ["r01"],
    "unpublished": false,
    "quest": "フォーム ID",
    "prologue": "冒険の導入です。",
    "bgm": ["field01", "battle01"]
  }
]
```

この例は項目を示すためのものです。`id`、`title`、`listed`、`scenes`、`results` 以外は省略できます。実際の項目と型は、以下の表を参照してください。

## 項目

| 項目 | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `id` | 文字列 | はい | シナリオ ID。`scenarios/<id>/scenario.json` の `<id>` と一致させます。一覧内で重複させません。 |
| `title` | 文字列 | はい | 書庫に表示するタイトル。 |
| `author` | 文字列 | いいえ | 作者名。 |
| `v2` | 真偽値 | いいえ | `true` の場合、書庫に NText 対応を示すマークを表示します。NText 向けに対応済みのシナリオに設定します。 |
| `listed` | 真偽値 | はい | `true` の場合に書庫の候補になります。`false` の項目は書庫に表示されません。 |
| `series` | 文字列 | いいえ | シリーズ名。書庫の表示・検索に使います。 |
| `tags` | 文字列の配列 | いいえ | 分類。書庫の詳細表示とキーワード検索に使います。 |
| `published` | 文字列 | いいえ | 公開日。書庫の詳細表示と並べ替えに使います。`YYYY-MM-DD` 形式を推奨します（既存データの `YYYY-M-D` 形式も扱います）。 |
| `updated` | 文字列 | いいえ | 更新日。書庫の詳細表示と並べ替えに使います。`YYYY-MM-DD` 形式を推奨します（既存データの `YYYY-M-D` 形式も扱います）。 |
| `level` | 1～5 の整数 | いいえ | 難易度。書庫に表示し、難易度での絞り込みに使います。 |
| `comment` | 文字列 | いいえ | 書庫に表示する紹介文。`prologue` がない場合に詳細画面へ表示します。 |
| `scenes` | 数値 | はい | シナリオのシーン数。書庫に表示し、物語の長さの分類・並べ替えに使います。 |
| `results` | 数値 | はい | シナリオの実績数。書庫に獲得状況を表示し、並べ替えに使います。 |
| `clears` | 文字列の配列 | いいえ | クリア判定に使う実績 ID。配列内のいずれかを獲得するとクリア済みになります。 |
| `unpublished` | 真偽値 | いいえ | `true` の場合、公開前のシナリオとして扱い、書庫には表示しません。 |
| `quest` | 文字列 | いいえ | 感想アンケートの Google フォーム ID。指定すると回答・結果へのリンクを表示します。 |
| `prologue` | 文字列 | いいえ | 書庫の詳細に表示するプロローグ。Markdown として表示します。指定した場合、`comment` より優先されます。 |
| `bgm` | 文字列の配列 | いいえ | 使用している共通 BGM 名。`@` を付けない名前を指定し、音楽室でのシナリオ検索に使います。 |

`listed` が `true` でも `unpublished` が `true` なら、書庫には表示されません。

## 配列の順序

通常は公開日の新しい順です。公開日がない項目は後ろに置き、ID 順にします。書庫で別の項目が同じ値になった場合は、元の `index.json` の順序が保たれます。

## スキーマと生成

[`schema/scenario-index.v1.json`](../schema/scenario-index.v1.json) が `index.json` 用の JSON Schema です。VS Code では [`.vscode/settings.json`](../.vscode/settings.json) で `scenarios/index.json` に関連付けているため、項目の補完と検査が使えます。ルートが配列なので、ファイル内に `$schema` は書きません。

スキーマの正本は [`scenario-index.ts`](../packages/schema/src/scenario-index.ts) です。変更後は `npm run build`、`npm run schema` の順で JSON Schema を生成します。テストでは生成物とコミット済みの一覧を検証します。プレイヤーは [`ScenarioEntry`](../apps/player/src/data.ts) の型を使いますが、読み込み時に項目の形を実行時検証しているわけではありません。[`schema/scenario.v2.json`](../schema/scenario.v2.json) は `scenario.json` 用の別スキーマです。

JSON Schema は必須項目・値の型・未定義項目を検査します。一覧内で `id` が重複していないことや、対応するシナリオファイルがあることは、JSON Schema では検査できないためテストで確認します。

`stext convert-all` は旧リポジトリの XML から変換結果として `index.json` を生成します。この出力は既存作品の一覧を更新するためのものではありません。既存作品はコミット済みの `scenario.json` を原本として扱い、古い XML から再変換して上書きしないでください。
