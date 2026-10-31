# 開発ガイド

SORCERIAN Text v2 の開発環境の使い方です。全体の方針は [移行計画書](migration-plan.md) を参照してください。

## 必要なもの

- Node.js 22 以上（`.nvmrc` に記載）
- npm 10 以上

## はじめに

```bash
npm install
npm run dev        # プレイヤーアプリの開発サーバー（http://localhost:5173）
```

- 開発サーバーは `scenarios/` を `/scenarios/` で配信します。
- 旧リポジトリ（snext1220/stext）をこのリポジトリと同じ階層（`../stext`）に clone しておくと、画像・BGM をそこから配信します（`/legacy-assets/`）。ない場合は既定の配信元（`https://snext1220.github.io/stext/stext/`）を使います。

| 環境変数 | 内容 |
| --- | --- |
| `VITE_ASSET_BASE` | 画像・BGM・効果音の配信元（旧リポジトリの `stext/` ディレクトリに当たる URL。末尾は `/`） |
| `VITE_SCENARIO_BASE` | シナリオ JSON の配信元（既定はビルド結果の `scenarios/`） |

`npm run build` の結果（`apps/player/dist/`）には `scenarios/` も含まれるので、そのまま静的サイトとして公開できます。

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
| `packages/convert`| `@stext/convert` | Universal | 旧形式（scenario.xml / Playground JSON）からの変換 |
| `packages/cli`    | `@stext/cli`     | Node      | `stext` コマンド                                 |
| `packages/ui`     | `@stext/ui`      | Browser   | React コンポーネント                             |
| `apps/player`     | `@stext/player`  | Browser   | プレイヤーアプリ（Vite + React）                 |
| `prototype/`      | —                | Browser   | デザインプロトタイプ（GitHub Pages で公開）      |
| `scenarios/`      | —                | —         | 変換済みの旧シナリオ（`stext convert-all` の出力） |
| `schema/`         | —                | —         | エディター補完用の JSON Schema（生成物、GitHub Pages で公開） |

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

| コマンド | 内容 |
| --- | --- |
| `stext convert <scenario.xml\|playground.json> [-o out.json] [--structure-conditions]` | 旧形式を stext/2 に変換する |
| `stext convert-all <旧リポジトリの stext ディレクトリ> -o <出力先>` | 全シナリオを変換し、`index.json` と `REPORT.md` を作る |
| `stext validate <scenario.json>...` | スキーマと整合性を検査する（エラーがあれば終了コード 1） |
| `stext play <scenario.json> [--auto <手数>] [--seed <数値>]` | シナリオをコマンドラインで遊ぶ（`--auto` は選択肢を自動で選ぶ） |

シナリオ形式の詳細は [scenario-format.md](scenario-format.md)、エンジンの使い方は [engine.md](engine.md) を参照してください。

## 生成物の更新

| 生成物 | 更新方法 | いつ |
| --- | --- | --- |
| `schema/scenario.v2.json` | `npm run build && npm run schema` | `packages/schema/src/scenario.ts` を変えたとき（古いままだとテストが失敗します） |
| `scenarios/` | `npm run build && npm run convert:legacy` | 変換器を変えたとき、旧シナリオを直したとき。`snext1220/stext` をこのリポジトリと同じ階層（`../stext`）に clone しておきます |

`scenarios/` と `schema/` は生成物なので Prettier の対象外です。

## テストの補足

- `packages/schema/test/legacy-conditions.txt` は、旧43シナリオに現れる条件（1,517種類）です。条件パーサの往復テストに使います。
- `packages/core/src/legacy-condition.test-helper.ts` は、旧エンジンの条件判定をそのまま移植したテスト専用のコードです。新しい評価器と結果が一致することを確かめます。

## 旧エンジンとの差分テスト

`scripts/difftest.mjs` は、旧エンジン（jQuery 版）をヘッドレス Chromium で動かし、新エンジンと同じ選択を続けて毎手比べます。Chromium と playwright が必要なので CI では動かしません。エンジンや変換器を変えたときに手元で実行してください。

```bash
# 旧リポジトリを ../stext に clone し、そこで HTTP サーバーを起動しておく
cd ../stext && python3 -m http.server 8765
```

```bash
npm run build
node scripts/difftest.mjs --walks 5 --steps 80 --text
```

- シナリオ ID を並べると、そのシナリオだけを比べます（例: `node scripts/difftest.mjs scepter slayer`）。
- `--text` を付けると本文も比べます（Markdown の記号・HTML タグ・空白を除いた文字で比べます）。
- playwright がグローバルにしかない場合は、`PLAYWRIGHT_PATH` にその場所を指定します。

## プレイヤーの動作確認

`scripts/e2e-player.mjs` は、プレイヤーをブラウザで一通り操作して確かめます（書庫、キャラ作成、冒険、戦闘、魔法、選択と戻る、スマホ幅、変換所）。差分テストと同じく Chromium と playwright が必要で、CI では動かしません。

```bash
npm run dev
```

```bash
node scripts/e2e-player.mjs --shots /tmp/shots
```

ビルド結果を確かめるときは、`npm run build` のあと `npx vite preview` を `apps/player` で起動し、`--base http://localhost:4173` を付けます。

