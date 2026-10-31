# stext-next 向け Copilot 指示

ソーサリアンText（jQuery 製のゲームブックエンジン）を次世代化するプロジェクトです。決定事項と経緯は [docs/project-notes.md](../docs/project-notes.md)、開発手順は [docs/development.md](../docs/development.md) にまとめています。

- 表示は **React**、ロジックは **ESM／Universal JS**（ブラウザでも Node でも動く）で作る。
- シナリオの正式な形式は **JSON（stext/2）**。旧形式の XML は変換して取り込むだけにする。
- 旧リポジトリ [snext1220/stext](https://github.com/snext1220/stext) は参照用。手元では `../stext` に clone して使う。

## 作業の進め方

- 対応が難しいもの・工数が大きいものは、**着手する前に報告する**。
- 機能のまとまり（フェーズ）ごとに PR を作る。PR テンプレートがあれば、その見出しに合わせる。
- コミット・PR・コードのコメントに **AI のモデル名を書かない**。
- 文書は**日本語**で、分かりやすい言葉で書く。README のコマンドは1コマンド1ブロックにする。
- 決定事項や構成が変わったら、`docs/` の関係する文書（特に `project-notes.md`、`development.md`）も更新する。

## 構成

npm workspaces のモノレポ（`packages/*`、`apps/*`）。Node 22 以上。

| パス               | パッケージ          | 動作環境  | 役割                                                                                     |
| ------------------ | ------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `packages/schema`  | `@stext/schema`     | Universal | stext/2 の zod スキーマ・型・条件パーサ、`validateScenario`、`checkScenario`             |
| `packages/core`    | `@stext/core`       | Universal | ゲームエンジン `createEngine`、旧エンジン互換の GameState / GlobalState                  |
| `packages/convert` | `@stext/convert`    | Universal | 旧形式（scenario.xml / 旧 Playground JSON）からの変換                                    |
| `packages/cli`     | `@stext/cli`        | Node      | `stext` コマンド（convert、convert-all、validate、play）                                 |
| `packages/ui`      | `@stext/ui`         | Browser   | React コンポーネントと `styles.css`（デザイントークン）                                  |
| `apps/player`      | `@stext/player`     | Browser   | プレイヤー（Vite + React）                                                               |
| `apps/playground`  | `@stext/playground` | Browser   | シナリオの編集環境（Vite + React + React Flow、dagre）                                   |
| `prototype/`       | —                   | —         | デザインプロトタイプ「夜の書見台」                                                       |
| `scenarios/`       | —                   | —         | 変換済みの旧シナリオ（生成物）。`scenarios/<id>/` に `scenario.json`・`capture/`・`bgm/` |
| `assets/`          | —                   | —         | 全シナリオ共通の画像・BGM・効果音（`assets/common/`）                                    |
| `schema/`          | —                   | —         | JSON Schema（生成物）                                                                    |

- **依存の向き**：`schema` ← `core` / `convert` ← `cli`、`ui` ← `player` / `playground`。**逆向きの依存は作らない。**
- シナリオ固有の画像・BGM は `scenarios/<id>/capture/`・`bgm/` に置き、`assets/` には共通の素材だけを置く。
- 素材の配信元は環境変数 `VITE_ASSET_BASE`（共通素材）と `VITE_SCENARIO_BASE`（シナリオ）で切り替える。

## コードの決まり

### Universal パッケージ（schema / core / convert）

- `window`、`document`、`localStorage`、`navigator`、`location`、`process` などの環境固有のグローバル変数を使わない。
- `node:*` のモジュールを import しない。
- 乱数・保存先・素材パス・XML パーサなど環境に依存するものは、引数で受け取る。
- これらは ESLint でエラーになる。

### 共通

- ESM（`"type": "module"`）。パッケージ内の相対 import には **`.js` 拡張子を付ける**（例：`import { run } from './index.js'`）。
- TypeScript 6。`tsc -b` でプロジェクト参照を使う。アプリはそれぞれ `tsc -p apps/<app>/tsconfig.json` で検査する（noEmit）。
- テストは対象ファイルの隣に `*.test.ts(x)` で置く（Vitest 5）。DOM が要るテストはファイル先頭に `// @vitest-environment jsdom` を書く。
- `workspace-aliases.ts` で `@stext/<name>` を `packages/<name>/src/index.ts` に向けている。新しいパッケージを足したら、ルートの `tsconfig.json` の `references` と `workspace-aliases.ts` に追加する。
- Vite 8 のビルド設定は `assetsDir: '_app'`、`base: './'`。
- ESLint 10（flat config）。react-hooks ルールの対象は `packages/ui/**`、`apps/player/**`、`apps/playground/**`。新しい React アプリを足したらここに追加する。
- Prettier の対象外：README、docs、prototype、scenarios、schema、assets、site。
- Playground の編集操作（`apps/playground/src/model.ts`）は、元のシナリオを書き換えず、新しいシナリオを返す。

### シナリオ形式 stext/2

詳細は [docs/scenario-format.md](../docs/scenario-format.md) を参照。

- 選択肢はシーン内の `choices[]` に持つ。Playground のフロー図は `choices` から導く。
  - `to` は配列。要素が複数ならランダム分岐。
  - `kind: 'jump'` は番号入力（`allow`）、`kind: 'answer'` は文字入力（`answer` / `to` / `else`）。
- 条件 `if` は **AST が正式な内部形式**。文字列の記法も受け付ける。
- シーン `90000` は「戻る」。
- エディター用の情報は `editor`（x、y、color）、共通フッターのシーンは `meta.footerScene` に持つ。
- 旧エンジンとの互換性を保つ（localStorage のキーはシナリオ ID と `sorcerian_text`）。

## 生成物

手で編集せず、コマンドで作り直す。

| 生成物                                              | 更新方法                                          | いつ                                                                           |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `schema/scenario.v2.json`                           | `npm run build` のあとに `npm run schema`         | `packages/schema/src/scenario.ts` を変えたとき（古いままだとテストが失敗する） |
| `scenarios/`                                        | `npm run build` のあとに `npm run convert:legacy` | 変換器を変えたとき、旧シナリオを直したとき（`../stext` が必要）                |
| `assets/common/`、`scenarios/<id>/capture/`・`bgm/` | `node scripts/import-legacy-assets.mjs`           | 旧リポジトリの素材を取り込み直すとき（`../stext` が必要）                      |
| `apps/playground/public/templates/`                 | `node scripts/import-playground-templates.mjs`    | 旧 Playground のテンプレートを取り込み直すとき                                 |

## 確認のコマンド

CI（`.github/workflows/ci.yml`）と同じ順で確認する。

```bash
npm run format:check
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

- ブラウザでの確認（`scripts/difftest.mjs`、`scripts/e2e-player.mjs`、`scripts/e2e-playground.mjs`）には Chromium と playwright が必要で、CI では動かさない。playwright がグローバルにしかないときは `PLAYWRIGHT_PATH` を指定する。
- `npm i -w <workspace>` で依存が追加されないときは、先に `npm install` を実行する。
- GitHub Pages への公開は `.github/workflows/pages.yml`（test → build → `scripts/build-site.mjs`）が行う。

## 作らないと決めたもの

Playground では、サーバーへの投稿、シーン ID のシャッフル、範囲を絞った表示、旧 PgEditor（jsTree）は作らない。
