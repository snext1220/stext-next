# stext-next
ソーサリアンTextのアーキテクチャ、UI移行計画です。

https://snext1220.github.io/stext-next/prototype/design/index.html

## ゲームを遊ぶ

**公開版：https://snext1220.github.io/stext-next/** （インストール不要。`main` に変更が入るたびに自動で更新されます）

ブラウザで動くプレイヤー（`apps/player`）で、旧ソーサリアンText（[snext1220/stext](https://github.com/snext1220/stext)）の43シナリオを遊べます。シナリオ（`scenarios/`）と画像・BGM（`assets/`）はこのリポジトリに含まれているので、ほかに用意するものはありません。

### 必要なもの

- [Node.js](https://nodejs.org/) 22 以上（npm も一緒に入ります）

### 手元で起動する

```bash
git clone https://github.com/snext1220/stext-next.git
```

```bash
cd stext-next
```

```bash
npm install
```

```bash
npm run dev
```

ブラウザで http://localhost:5173/ を開くと、シナリオの一覧（書庫）が表示されます。

1. 書庫で遊びたいシナリオを選ぶ
2. 「冒険者の誕生」で種族・性別・年齢・職業・名前を決め、「この者で冒険に出る」を押す
3. 選択肢を押すか、キーボードの数字キーで進む（Backspace で一つ前の節に戻る）

- 冒険の記録はブラウザ（localStorage）に保存され、書庫の「続きから」で再開できます。
- 右上の「音あり／音なし」で BGM と効果音、「昼／夜」で画面の明るさを切り替えます。
- 戦闘のあるシーンでは、本文の下でダイスを振り、「敵の攻撃」「攻撃する」「戦利品」のボタンで結果を反映します。
- 魔法は「魔法」のタブから唱えます（スマホでは画面下のタブ）。
- ステータスは「冒険者」タブの「ステータスを編集」で手入力できます（ゲームブックとして、結果を自分で反映するときに使います）。
- 「記録」では、プレイヤーランク・ボーナスアイテムを確かめたり、セーブデータを旧ソーサリアンText と同じ `.stext` ファイルでバックアップ／リストアしたりできます。
- 「変換所」では、旧形式の `scenario.xml` を読み込んで、その場で遊ぶこともできます。

### 公開用にビルドする

```bash
npm run build
```

`apps/player/dist/` に、シナリオと素材を含んだ静的サイトができます。任意の Web サーバーに置けば遊べます。GitHub Pages への公開は GitHub Actions（`.github/workflows/pages.yml`）が自動で行います（[docs/development.md](docs/development.md#公開github-pages)）。手元で確かめるときは、次のコマンドで http://localhost:4173/ に表示されます。

```bash
npm run preview -w @stext/player
```

### コマンドラインで遊ぶ

```bash
npm run build
```

```bash
node packages/cli/dist/bin.js play scenarios/scepter/scenario.json
```

番号で選択肢を選び、`s` で状態、`q` で終了します。`--auto 30 --seed 1` を付けると、選択肢を自動で選んで進みます。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [docs/migration-plan.md](docs/migration-plan.md) | 移行計画と各フェーズの結果 |
| [docs/scenario-format.md](docs/scenario-format.md) | シナリオ JSON（stext/2）の書き方 |
| [docs/engine.md](docs/engine.md) | ゲームエンジン（`@stext/core`）の使い方 |
| [docs/development.md](docs/development.md) | 開発の手順（テスト、変換、差分テストなど） |
| [assets/README.md](assets/README.md) | 画像・BGM・効果音の出どころ |
