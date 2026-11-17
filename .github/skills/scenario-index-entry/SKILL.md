---
name: scenario-index-entry
description: '指定された stext/2 シナリオデータから scenarios/index.json に新規エントリーを追加する。既存 ID の確認、基本項目の集計、未公開の既定値、一覧順の維持を依頼されたときに使う。'
---

# 書庫一覧エントリーの追加

指定されたシナリオデータから書庫一覧のエントリーを作る。入力の手間を減らすことが目的なので、確実に読み取れる情報を使い、任意項目も既定値を入れて追加する。`quest` はユーザーから値が指定されていない場合、項目自体を省略する。

- [書庫一覧 JSON リファレンス](../../../docs/scenario-index-format.md)
- [書庫一覧 JSON Schema](../../../schema/scenario-index.v1.json)
- 一覧ファイル: [`scenarios/index.json`](../../../scenarios/index.json)

## 作業手順

1. ユーザーが指定した `scenario.json` またはシナリオデータだけを読む。入力元が複数あり対象が決まらない場合は確認する。既存シナリオの更新では旧 XML から再変換しない。
2. シナリオ ID を確定する。`scenarios/<id>/scenario.json` が入力元なら `<id>` を使う。`meta.id` がディレクトリ名と異なる場合は追加せず、どちらが正しいか確認する。ファイルパスから ID を取れない場合は、ユーザー指定の ID を使うか確認する。
3. `scenarios/index.json` に同じ `id` がないか確認する。重複がなければ新規追加する。重複がある場合は、既存項目と新しい項目の差分を示し、置き換えてよいかユーザーに確認する。確認前はファイルを変更しない。承認されたら既存項目を新しい項目全体で置き換える。置き換えにより手作業で設定した値が既定値に戻る項目も明示する。拒否された場合は変更しない。
4. 次の値をシナリオデータから転記・集計する。
   - `title`: `meta.title`
   - `author`: `meta.author` があれば転記し、なければ `""`
   - `scenes`: `scenes` 配列の件数
   - `results`: `results` 配列の件数
   - `bgm`: 共通 BGM があれば [`commonBgm`](../../../packages/cli/src/index.ts) の処理に従い、シーンごとに実際に選ばれる曲を集める。`@` を外し、`@none` を除外し、重複をなくして並べる。正確に計算できない場合は `[]` にする。`convert-all` は実行しない。
5. 既定値の表に従ってすべての任意項目を出力する。入力に値がある場合はそれを使い、明記された既定値がある場合は既定値を使う。`published` と `updated` は実行日の `YYYY-MM-DD`、`listed` は `true`、`unpublished` は `true` とする。`unpublished` を `false` にするのはユーザーが明示した場合だけ。
6. 任意項目の既定値は次のとおり。

   | 項目 | 入力から使う値 | 入力に値がないとき |
   | --- | --- | --- |
   | `author` | `meta.author` | `""` |
   | `v2` | ユーザーが明示した値のみ | `false` |
   | `series` | ユーザーが明示した値のみ | `""` |
   | `tags` | ユーザーが明示した値のみ | `[]` |
   | `published` | ユーザーが明示した値がなければ実行日 | 実行日の `YYYY-MM-DD` |
   | `updated` | ユーザーが明示した値がなければ実行日 | 実行日の `YYYY-MM-DD` |
   | `level` | ユーザーが明示した値のみ | `3` |
   | `comment` | ユーザーが明示した値のみ | `""` |
   | `clears` | `end: "happy"` のシーンにある `effects.result` の実績 ID | `[]` |
   | `unpublished` | ユーザーが明示した値 | `true` |
   | `quest` | ユーザーが明示した値のみ | 値がなければ項目自体を省略 |
   | `prologue` | ユーザーが明示した値のみ | `""` |
   | `bgm` | シナリオから正確に集計できる共通 BGM | `[]` |

   `clears` はシーン ID ではなく実績 ID を設定する。ハッピーエンドの各シーンの `effects.result` を集め、重複を除く。実績 ID が `results[].id` に定義されていない場合は、追加せず報告する。`v2` は `format: "stext/2"` と同義ではないため推測しない。`meta.keywords` を `tags` に、`meta.description` を `comment` に、`results[].level` を一覧の `level` に自動転記しない。
7. 必須項目 `id`、`title`、`listed`、`scenes`、`results` のいずれかが確定できなければ、値を捏造したり不完全なエントリーを追加したりせず、必要な値を確認する。
8. 新規項目を追加するか、重複確認の承認後に既存項目を置き換える。リファレンスに従い、公開日がある場合は公開日の降順、ない場合は末尾の ID 順に配置する。既存の配列・インデント・順序を保つ。
9. `npx vitest run packages/schema/src/scenario-index.test.ts` を実行する。Schema 検証、ID 重複、対応する `scenario.json` の存在を確認し、失敗した場合は変更を完了扱いにせず原因を調べる。
10. 追加・更新した項目と既定値を簡潔に報告する。シナリオファイルは変更しない。
