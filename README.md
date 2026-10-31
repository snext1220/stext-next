# stext-next
ソーサリアンTextのアーキテクチャ、UI移行計画です。

https://snext1220.github.io/stext-next/prototype/design/index.html

## ゲームを遊ぶ

**公開版：https://snext1220.github.io/stext-next/** （インストール不要。`main` に変更が入るたびに自動で更新されます）

ブラウザで動くプレイヤー（`apps/player`）で、旧ソーサリアンText（[snext1220/stext](https://github.com/snext1220/stext)）の43シナリオを遊べます。シナリオ（`scenarios/`）と画像・BGM はこのリポジトリに含まれているので、ほかに用意するものはありません。

シナリオに関係するデータは、シナリオごとに一つのフォルダーにまとめています。

```
scenarios/<シナリオID>/
  scenario.json   シナリオ本体
  capture/        挿絵
  bgm/            シナリオ独自の BGM（bgm/se/ は効果音）
  chara/          シナリオ独自のキャラクター画像（imageSet が custom のとき）
assets/common/    どのシナリオでも使う BGM・効果音・画像
```

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

1. 書庫で遊びたいシナリオの「詳細を表示」を押し、プロローグや情報を確かめて「新たに冒険を始める」を押す（「検索条件」でシリーズ・キーワード・長さ・難易度・クリア状態などから絞り込めます）
2. 「冒険者の誕生」で種族・性別・年齢・職業・名前を決め、「この者で冒険に出る」を押す
3. 選択肢を押すか、キーボードの数字キーで進む（Backspace で一つ前の節に戻る）

- 冒険の記録はブラウザ（localStorage）に保存され、書庫の「続きから」か、シナリオの詳細の「続きから冒険する」で再開できます。詳細の「新たに冒険を始める」から最初からやり直すこともできます（キャラクターを作って出発した時点で、今の冒険は上書きされます）。
- 右上の「音あり／音なし」で BGM と効果音、「昼／夜」で画面の明るさを切り替えます。
- 戦闘のあるシーンでは、本文の下でダイスを振り、「敵の攻撃」「攻撃する」「戦利品」のボタンで結果を反映します。
- 魔法は「魔法」のタブから唱えます（スマホでは画面下のタブ）。★の付いたアイテムは「持ち物」のタブから使えます。
- ステータスは「冒険者」タブの「ステータスを編集」で手入力できます（ゲームブックとして、結果を自分で反映するときに使います）。
- 「記録」では、プレイヤーランク・ボーナスアイテムを確かめたり、セーブデータを旧ソーサリアンText と同じ `.stext` ファイルでバックアップ／リストアしたりできます。
- 「音楽室」では、シナリオで流れる標準の BGM と効果音を試聴できます。曲ごとに、使っているシナリオも表示します。
- 「案内」では、ソーサリアン Text と原作の紹介、スタッフ、ギャラリー、関連リンクを読めます。「投稿」では、シナリオの作り方と投稿の手順、募集中の企画、制作者向けの素材（BGM・キャラ画像）を案内しています。
- 画面の下（フッター）の CONTACT から、公式の X、マニュアル、質問・要望箱、GitHub、シナリオへのアンケートに進めます。
- 「変換所」では、旧形式の `scenario.xml` を読み込んで、その場で遊ぶこともできます。

### 公開用にビルドする

```bash
npm run build
```

`apps/player/dist/` に、シナリオと素材を含んだ静的サイトができます（Playground は `apps/playground/dist/`）。任意の Web サーバーに置けば遊べます。GitHub Pages への公開は GitHub Actions（`.github/workflows/pages.yml`）が自動で行います（[docs/development.md](docs/development.md#公開github-pages)）。手元で確かめるときは、次のコマンドで http://localhost:4173/ に表示されます。

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

## シナリオを書く（Playground）

**公開版：https://snext1220.github.io/stext-next/playground/**

ブラウザで動くシナリオの編集環境（`apps/playground`）です。旧 Playground の代わりに、新しい形式（stext/2 の JSON）のシナリオを作れます。

```bash
npm run dev:playground
```

ブラウザで http://localhost:5174/ を開きます。

- 左のフロー図でシーンを選ぶと、右の「シーン」タブで本文・選択肢・効果・敵などを編集できます。シーンの右の点から別のシーンへ線を引くと選択肢になります。
- フロー図と右のパネルの境目はドラッグ（選んで ←／→ キーでも可）で動かせます。幅はブラウザに保存され、境目のダブルクリックで元の幅に戻ります。
- 「新規・テンプレート」から、旧 Playground と同じテンプレートや公開中のシナリオを開けます。「開く…」では、新形式の JSON、旧形式の `scenario.xml`、旧 Playground の JSON を読み込めます。
- 「定義」タブでタイトルなどの基本情報と、アイテム・フラグ・パラメーター・敵・実績・グループ・ライセンスを編集します。
- 「検査」タブには、つながっていない遷移先や書きかけの条件などの問題が並びます（クリックでそのシーンへ）。
- 「試遊」タブで、編集中のシナリオをその場で遊べます。
- 編集内容はブラウザに自動で保存されます。名前を付けて残すときは「マイストレージ」、ファイルにするときは「保存（JSON）」を使います。Ctrl+Z／Ctrl+Shift+Z で元に戻す／やり直すができます。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [docs/code-reading-guide.md](docs/code-reading-guide.md) | コードの読み解き方（全体像・読む順番・処理の流れ） |
| [docs/migration-plan.md](docs/migration-plan.md) | 移行計画と各フェーズの結果 |
| [docs/project-notes.md](docs/project-notes.md) | 決定事項・開発ルール・進捗のまとめ |
| [docs/scenario-format.md](docs/scenario-format.md) | シナリオ JSON（stext/2）の書き方 |
| [docs/engine.md](docs/engine.md) | ゲームエンジン（`@stext/core`）の使い方 |
| [docs/development.md](docs/development.md) | 開発の手順（テスト、変換、差分テストなど） |
| [assets/README.md](assets/README.md) | 画像・BGM・効果音の置き場所と出どころ |
