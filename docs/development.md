# 開発ガイド

SORCERIAN Text v2 の開発環境の使い方です。全体の方針は [移行計画書](migration-plan.md) を参照してください。

## 必要なもの

- Node.js 22 以上（`.nvmrc` に記載）
- npm 10 以上

## はじめに

```bash
npm install
npm run dev        # プレイヤーアプリの開発サーバー（apps/player）
```

## よく使うコマンド

| コマンド               | 内容                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `npm test`             | すべてのテストを実行（Vitest）                                       |
| `npm run test:watch`   | 変更を監視してテストを再実行                                         |
| `npm run typecheck`    | 型検査（ライブラリ、テスト、プレイヤーアプリ）                       |
| `npm run lint`         | ESLint                                                               |
| `npm run format`       | Prettier で整形（`format:check` は確認のみ）                         |
| `npm run build`        | ライブラリを `dist/` にビルドし、プレイヤーアプリを `apps/player/dist/` にビルド |
| `npm run clean`        | ビルド結果を削除                                                     |

CI（`.github/workflows/ci.yml`）は、プルリクエストと `main` への push で format:check → lint → typecheck → test → build を実行します。

## 構成

| パス              | パッケージ       | 動作環境  | 役割                                             |
| ----------------- | ---------------- | --------- | ------------------------------------------------ |
| `packages/schema` | `@stext/schema`  | Universal | シナリオ JSON（stext/2）のスキーマ・型・条件パーサ |
| `packages/core`   | `@stext/core`    | Universal | ゲームエンジン                                   |
| `packages/convert`| `@stext/convert` | Universal | 旧形式（XML / .gbat / Playground JSON）からの変換 |
| `packages/cli`    | `@stext/cli`     | Node      | `stext` コマンド                                 |
| `packages/ui`     | `@stext/ui`      | Browser   | React コンポーネント                             |
| `apps/player`     | `@stext/player`  | Browser   | プレイヤーアプリ（Vite + React）                 |
| `prototype/`      | —                | Browser   | デザインプロトタイプ（GitHub Pages で公開）      |

依存の向き: `schema` ← `core` / `convert` ← `cli`、`ui` ← `player`。逆向きの依存は作りません。

### Universal パッケージの決まり

`schema` / `core` / `convert` はブラウザでも Node でも動く必要があります。

- `window` `document` `localStorage` `navigator` `location` `process` などの環境固有のグローバル変数を使わない
- `node:*` のモジュールを import しない
- 乱数・保存先・素材パス・XML パーサなど環境に依存するものは、引数で受け取る

これらは ESLint でエラーになります。

### ワークスペース内の参照

- 各パッケージは `dist/` を公開します（`exports` は `dist/index.js` と `dist/index.d.ts`）。
- テスト（Vitest）と開発サーバー（Vite）は、`workspace-aliases.ts` で `@stext/*` を各パッケージの `src/` に向けるので、ライブラリをビルドしなくても変更がすぐ反映されます。
- 型検査（`tsc -b`）はプロジェクト参照で依存順にビルドします。新しいパッケージを足したときは、ルートの `tsconfig.json` の `references` と `workspace-aliases.ts` に追加してください。

### コードの書き方

- ESM（`"type": "module"`）。パッケージ内の相対 import には `.js` 拡張子を付けます（例: `import { run } from './index.js'`）。ビルド後に Node でそのまま動かすためです。
- テストは対象ファイルの隣に `*.test.ts(x)` で置きます。

## `stext` コマンド

```bash
npm run build
node packages/cli/dist/bin.js --help
```

`convert` / `validate` は Phase 2、`play` は Phase 3 で実装します。現時点では「未実装」と表示して終了コード 1 を返します。
