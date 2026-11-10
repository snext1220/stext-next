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

- 開発サーバーは `scenarios/` を `/scenarios/` で配信します。シナリオごとのフォルダー（`scenarios/<id>/`）に、`scenario.json` とそのシナリオの挿絵（`capture/`）・BGM（`bgm/`）があります。
- 共通の画像・BGM・効果音（`assets/common/`）は `/assets/` で配信します。画像・BGM は旧リポジトリから `scripts/import-legacy-assets.mjs` で取り込んだものです（[assets/README.md](../assets/README.md)）。
- 案内所の画面・フッターで使う旧サイトの画像（画廊のイラスト、募集企画のバナー、CONTACT のアイコンなど）は `assets/site/` にあります。旧サイトから `scripts/import-site-images.mjs` で取り込んだものです。

| 環境変数 | 内容 |
| --- | --- |
| `VITE_ASSET_BASE` | 共通の画像・BGM・効果音の配信元（既定はビルド結果の `assets/`。別の場所に置くときは、`common/` を含む URL を末尾 `/` 付きで指定） |
| `VITE_SCENARIO_BASE` | シナリオの配信元（既定はビルド結果の `scenarios/`。`<id>/scenario.json` と、挿絵・BGM もここから読む） |
| `VITE_PLAYGROUND_URL` | 投稿の画面の「Playground を開く」のリンク先（既定はプレイヤーの隣の `playground/`。開発サーバーで試すときは `http://localhost:5174/` を指定） |

### 作品提出フォーム

送信先と発行HTMLの項目名・hidden値は [post.ts](../apps/playground/src/post.ts) にまとめています。オレンジフォーム（フォームID `261098`）へUTF-8の通常のフォームPOSTを行い、別タブで確認・最終送信します。`fetch` やCORSによる応答読み取りは使いません。提供元の `of_lib.js` が行うPOSTをブラウザー標準のフォーム送信で置き換えるため、jQuery・メール誤入力補助・Cookie保存用scriptは読み込みません。発行HTMLのhoneypot `of_dummy_note` と「Powered by」の表示は残します。

管理画面で、管理者通知の宛先と本文、`mail` を宛先とする投稿者への自動返信（確認メール）、必須項目、迷惑投稿対策、完了画面を設定してください。確認メールにダウンロードURL・キーを含めるかは必要性を確認し、個人情報の保存期間と閲覧権限も決めます。分類は発行HTMLに合わせて必須、保持期間は7日以上（初期値 `7`）です。`7日` / `7日間` の入力も受け付け、送信時は数値文字列に整形します。

提出の主経路はギガファイル便へのZIPアップロードと［作品を提出］によるフォームPOSTです。GitHub Discussionsはダイアログ下部の代替案内だけとし、提出文のコピー機能はありません。

入力の下書きは [postDraft.ts](../apps/playground/src/postDraft.ts) で、ダウンロードキーを除く全項目（メールアドレスを含む）をプロジェクトごとにCookieへ30日間保存します。入力の変更時に保存期間を更新し、再度開く際に復元します。アプリのパス、`SameSite=Lax`、HTTPSでは `Secure` を指定します。長文は1件あたりの容量制限内に分割し、保存結果を読み返して失敗を警告します。Cookieは同じサイトの対象パスへの通信にも付きます。［保存した入力内容を削除］はその作品のCookieを削除して入力欄を初期値に戻します。フォームPOST後に自動削除はしません。

Playgroundでは受付・メール送信の完了を判定しません。実際の確認画面、最終送信、管理者通知、確認メールの到達・文字化け・迷惑メール判定は、管理者が許可したテスト投稿で確認します。PlaywrightのE2Eでは別タブの送信先をモックし、外部フォームへ実送信しません。

独自PHP受け口と `VITE_SUBMISSION_URL` は削除しました。公開環境に配備済みの `submit.php` と旧 `upload.php` は別途停止してください。フォームが利用できない場合はGitHub Discussionsを案内します。

`npm run build` の結果（`apps/player/dist/`）には `scenarios/` と `assets/` も含まれるので、そのまま静的サイトとして公開できます。

## よく使うコマンド

| コマンド               | 内容                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `npm test`             | すべてのテストを実行（Vitest）                                       |
| `npm run test:watch`   | 変更を監視してテストを再実行                                         |
| `npm run typecheck`    | 型検査（ライブラリ、テスト、プレイヤー、Playground）                 |
| `npm run lint`         | ESLint                                                               |
| `npm run format`       | Prettier で整形（`format:check` は確認のみ）                         |
| `npm run build`        | ライブラリを `dist/` に、プレイヤーを `apps/player/dist/` に、Playground を `apps/playground/dist/` にビルド |
| `npm run dev:playground` | Playground の開発サーバー（http://localhost:5174/）                 |
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
| `apps/playground` | `@stext/playground` | Browser | シナリオの編集環境（Vite + React + React Flow）  |
| `prototype/`      | —                | Browser   | デザインプロトタイプ（GitHub Pages で公開）      |
| `scenarios/`      | —                | —         | 旧シナリオ。シナリオごとに `scenario.json`（`stext convert-all` の出力）と挿絵・BGM |
| `assets/`         | —                | —         | 共通の画像・BGM・効果音（`assets/common/`）と、旧サイトの画像（`assets/site/`） |
| `schema/`         | —                | —         | エディター補完用の JSON Schema（生成物、GitHub Pages で公開） |

依存の向き: `schema` ← `core` / `convert` ← `cli`、`ui` ← `player` / `playground`。逆向きの依存は作りません。

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
| `stext convert-all <旧リポジトリの stext ディレクトリ> -o <出力先>` | 全シナリオを変換し、`index.json` と `REPORT.md` を作る（`index.json` は公開日の新しい順で、公開日のないものは最後に ID 順。`quest` は stext.xml の quest（感想アンケートの Google フォーム ID）、`prologue` は stext.xml の work の本文から紹介画像を除いたもの、`bgm` はシナリオが使う共通 BGM（`meta.bgm` とシーンの `bgm` のうち `@` で始まるもの。`@none` は除く。音楽室で使う）） |
| `stext validate <scenario.json>...` | スキーマと整合性を検査する（エラーがあれば終了コード 1） |
| `stext play <scenario.json> [--auto <手数>] [--seed <数値>]` | シナリオをコマンドラインで遊ぶ（`--auto` は選択肢を自動で選ぶ） |

`scenarios/index.json` の `v2: true` は、書庫でシナリオに［純正］マークを表示するフラグです。対応済みのシナリオにだけ設定します。

シナリオ形式の詳細は [scenario-format.md](scenario-format.md)、エンジンの使い方は [engine.md](engine.md) を参照してください。

## 生成物の更新

| 生成物 | 更新方法 | いつ |
| --- | --- | --- |
| `schema/scenario.v2.json` | `npm run build && npm run schema` | `packages/schema/src/scenario.ts` を変えたとき（古いままだとテストが失敗します） |
| `scenarios/` | `npm run build && npm run convert:legacy` | 変換器を変えたとき、旧シナリオを直したとき。`snext1220/stext` をこのリポジトリと同じ階層（`../stext`）に clone しておきます。`index.json` は旧シナリオだけで作り直されるので、stext/2 で直接書いたシナリオ（`gods`）の項目や、`v2` フラグは作り直したあとに戻してください |
| `assets/common/`、`scenarios/<id>/capture/`・`bgm/`・`chara/` | `node scripts/import-legacy-assets.mjs` | 旧リポジトリの画像・BGM を取り込み直すとき（`../stext` に clone しておきます）。`scenario.json` と `assets/site/` は消しません |
| `assets/site/` | `node scripts/import-site-images.mjs` | 旧サイト（https://www.web-deli.com/sorcerian/text/）の画像を取り込み直すとき。取り込む画像はスクリプトの一覧に書きます |

`scenarios/`・`schema/`・`assets/` は生成物なので Prettier の対象外です。

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

シーン移動時のスクロールは `apps/player/src/screens/Play.tsx` で、移動・戻るが成功した場合に限り、DOM更新後の `useLayoutEffect` から `behavior: 'instant'` で行います。クリック処理内でスムーズスクロールを開始すると、シーンの高さの変化と競合するためです。`Play.test.tsx` で更新後の本文とスクロール指定、同じシーンへの移動、戻る操作、移動失敗やメモ編集ではスクロールしないことを確認します。iOS Safari実機では、長文から長文・短文への移動、画像のあるシーン、スクロール直後のタップ、番号・答え入力後の移動も確認してください。

`scripts/e2e-player.mjs` は、プレイヤーをブラウザで一通り操作して確かめます（書庫と詳細、キャラ作成、冒険、戦闘、魔法、選択と戻る、スマホ幅、変換所、音楽室、メニューのサブメニュー、案内所と制作者向けの素材の各画面、以前の URL の転送、フッターの CONTACT）。差分テストと同じく Chromium と playwright が必要で、CI では動かしません。

```bash
npm run dev
```

```bash
node scripts/e2e-player.mjs --shots /tmp/shots
```

ビルド結果を確かめるときは、`npm run build` のあと `npx vite preview` を `apps/player` で起動し、`--base http://localhost:4173` を付けます。

## Playground の動作確認

### 素材の一括登録

［素材を追加］では、選択した種類のファイルを複数選択し、既存の `registerResource` で順番に保存します。選択した登録先と元のファイル名を組み合わせたパスが参照先と完全一致すると、既存の表示処理で参照素材に紐づきます。シナリオ本文・設定や保存形式は変更しません。

処理中は素材操作を制限します。同じパスへの登録は差し替えを確認し、キャンセルやファイル単位の失敗があっても残りの登録を続けます。`ResourcesPanel.test.tsx` で種類別の複数登録、完全一致・不一致、確認、進捗、操作制限、部分失敗を確認し、`scripts/e2e-playground.mjs` で一括登録した参照素材・未参照素材の再読み込みとZIP収録を確認します。

### 編集途中の作品の保存・復元

Playgroundでは `@stext/schema` の `validateScenarioDraft` と `DraftScenario` を使い、編集に必要な構造・型と、作品としての完成度を分けます。空欄のID・遷移先、入力途中の効果式・魔法名・キャラクター制約などは値を保持して読み込みます。旧エディターが空欄のため省略した本文・選択肢・定義の文字列は空欄として復元します。シーンの必須文字列は、新しい編集では空欄でも削除しません。

自動保存、保存済み作品の復元・切り替え、旧自動保存の移行、JSON読み込み、ZIP用スナップショットは編集用の形式にそろえます。作品UUIDと素材との対応は維持します。作品一覧は、構造を読み込めない1件があっても他の作品を表示し、問題の作品にはエラーを付けて保存データを残します。

正式な `validateScenario` と公開JSON Schemaは変更しません。［検査］は従来どおり正式な形式と整合性を検証し、試遊も正式な形式に通ったシナリオだけで開始します。`draft.test.ts`、`store.test.tsx`（`fake-indexeddb`）、`App.test.tsx` で、未完成データの復元・素材の保持・検査・修正・自動保存・試遊の制御を確認します。

### ブラウザーでの確認

macOS の Safari では、大きなシナリオ（`gods` など）を開いた直後にメモリ使用量の警告と再読み込みが発生し、画面外の描画を省くことで動作するようになったとの報告があります。起動時の `navigator.userAgent` から Safari（macOS・iOS）と判定した場合だけ、React Flow の `onlyRenderVisibleElements` を有効にし、接続線のアニメーションを停止します。Chrome・Edge・Firefox などは従来どおり全体を描画し、ランダム分岐の接続線をアニメーション表示します。手動設定はありません。判定はユーザーエージェントに依存するため、偽装している場合は実際のブラウザと異なる描画になることがあります。

Safari では、移動・ズームに応じて必要なシーンと接続線が描画されます。シナリオのデータや自動配置、ミニマップは共通です。描画の変更を確認するときは、Safari とそれ以外のブラウザで同じシナリオを開き、表示範囲を移動してシーンを選べることも確認してください。

`scripts/e2e-playground.mjs` は、Playground をブラウザで一通り操作して確かめます（テンプレート、シーンの追加と ID の変更、条件の入力、ヘルプ、元に戻す、定義、検査、試遊、自動保存、保存済み作品の切り替え、JSON の保存、XML を開く、公開シナリオ、スマホ幅）。旧リポジトリ（`../stext`）の mini の XML も使います。

```bash
npm run dev:playground
```

```bash
node scripts/e2e-playground.mjs --shots /tmp/shots
```

ビルド結果を確かめるときは、`npm run build:site` のあと `site/` を HTTP サーバーで配信し、`--base http://localhost:<ポート>/playground` を付けます。

Playground のテンプレート（`apps/playground/public/templates/`）は、旧 Playground のテンプレートを `scripts/import-playground-templates.mjs` で変換したものです（`npm run build` のあと、旧リポジトリを `../stext` に置いて実行）。

Playground のヘルプ（各欄の「?」や項目名のダブルクリックで開く説明）は、`apps/playground/src/help/reference.md` に書きます。旧 Playground の `lib/reference.xml` を stext/2 に合わせて書き直したもので、旧版と食い違う点には `@mark`（変更／未実装／誤り／廃止／要確認）を付けています。書き方はファイルの先頭にあります。フォームから使うキーは `help="scene.text"` のように指定し、存在しないキーや関連項目は `help.test.ts` が見つけます。

## 公開（GitHub Pages）

`main` に push されると、GitHub Actions（`.github/workflows/pages.yml`）がテスト・ビルドを行い、https://snext1220.github.io/stext-next/ に公開します。手動で公開し直すときは、Actions の「Pages」から「Run workflow」を実行します。

公開するサイトは `scripts/build-site.mjs` が `site/` に組み立てます。

| URL | 中身 |
| --- | --- |
| `/stext-next/` | プレイヤー（`apps/player/dist`。`scenarios/` と `assets/` を含む） |
| `/stext-next/playground/` | Playground（`apps/playground/dist`。シナリオと素材はプレイヤーのものを使う） |
| `/stext-next/manual/` | マニュアル一覧 |
| `/stext-next/manual/player.html` | プレイヤーのマニュアル（`docs/manual-player.md` から生成） |
| `/stext-next/manual/playground.html` | Playgroundのマニュアル（`docs/manual-playground.md` から生成） |
| `/stext-next/prototype/design/index.html` | デザインプロトタイプ（これまでと同じ URL） |
| `/stext-next/schema/scenario.v2.json` | シナリオの JSON Schema（各シナリオの `$schema` が指す URL） |

マニュアルの画像は `docs/image/`、スタイルは `docs/manual.css` を使います。本文は `marked` で HTML に変換し、プレイヤーと同じビルド済みスタイルを読み込んで羊皮紙の画面に近い見た目で公開します。

手元で同じものを作るには `npm run build:site` を実行します。

**初回だけ必要な設定**：リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にします。これまでの「Deploy from a branch」のままだと、ワークフローの公開の段階が失敗します。
