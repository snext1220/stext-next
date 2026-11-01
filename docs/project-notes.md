# stext-next プロジェクトノート（決定事項・開発ルール・進捗）

2026-10-31 時点の、これまでの作業で決まったことと進み具合のまとめです。経緯の詳しい記録は [migration-plan.md](migration-plan.md)、開発の手順は [development.md](development.md) を見てください。

---

## 1. プロジェクトの概要

- **目的**：ソーサリアンText（jQuery 製のゲームブックエンジン）を次世代化する。
  - 表示は **React**、ロジックは **ESM／Universal JS**（ブラウザでも Node でも動く）に作り直す。
  - シナリオの正式な形式を **JSON（stext/2）** にする。XML は変換して取り込むだけにする。
  - UI は刷新するが、ファンタジーの雰囲気は残す。
- **リポジトリ**
  - 旧：[snext1220/stext](https://github.com/snext1220/stext)（参照元。手元では `../stext` に clone して使う）
  - 新：[snext1220/stext-next](https://github.com/snext1220/stext-next)（実際の開発先）
- **公開 URL（GitHub Pages）**
  - プレイヤー：https://snext1220.github.io/stext-next/
  - Playground：https://snext1220.github.io/stext-next/playground/
  - デザインプロトタイプ：https://snext1220.github.io/stext-next/prototype/design/index.html
  - JSON Schema：https://snext1220.github.io/stext-next/schema/scenario.v2.json

---

## 2. 決定事項（時系列）

| # | 決定 |
|---|---|
| 1 | まず移行計画とデザインプロトタイプを作る（この段階ではロジックの開発を始めない） |
| 2 | 新しいリポジトリ `stext-next` で開発する |
| 3 | 条件式は**条件 AST を正式な内部形式とし、文字列の記法も受け付ける** |
| 4 | デザインの方向性は「夜の書見台」。五芒星は古びた形に、羊皮紙ウィンドウには端の欠け・右下のめくれ・汚れを加える |
| 5 | 選択肢は**シーン内の `choices[]`** に持たせる。Playground のフロー図は `choices` から導く |
| 6 | 各フェーズは PR を作ってから次へ進む。Phase 2 と Phase 4 は別ブランチで重ねて進めた |
| 7 | 画像・BGM・効果音は**新リポジトリ（`assets/`）に移す**。ゲームの実行方法を README に書く |
| 8 | プレイヤーはこのリポジトリの **GitHub Pages で公開する** |
| 9 | 旧エンジンの残りの機能（ステータス編集、撃破チェック、バックアップ／リストア、ランク・ボーナス一覧、ツイートボタン、`${effect}`、アイテムの使用）を実装する |
| 10 | Playground（Phase 6）を作る。サーバーへの投稿、シーン ID のシャッフル、範囲を絞った表示、旧 PgEditor（jsTree）は作らない |
| 11 | シナリオに関係する画像・BGM は、シナリオごとのフォルダー（`scenarios/<id>/capture/`・`bgm/`）にまとめる。`assets/` には共通の素材だけを置く |
| 12 | 旧サイトのページをプレイヤーに移す。「音楽室」「案内」（SText とは・ソーサリアンとは・スタッフ・ギャラリー・関連リンク）「投稿」（作り方・手順・zip の中身・募集企画・制作者向けの素材）の3画面と、全画面のフッターの CONTACT にまとめる。文章は今の仕組みに合わせて書き直す。旧サイトの画像は `assets/site/` に取り込む。投稿先は今と同じ GitHub Discussions（snext1220/stext#299） |
| 13 | Playground に旧版と同じ投稿機能（「投稿…」）を付ける。送り先は旧版と同じ `upload.php`。シナリオは `scenario.json`（stext/2）で送る（`upload.php` の許可する拡張子に `json` を加える前提）。投稿先は CORS に対応していないので、応答は読まずに送る（no-cors） |
| 14 | プレイヤーのメニューを「書庫」「道具箱」（記録・変換所・音楽室・制作者向けの素材）「案内所」（ソーサリアン Text とは・投稿・募集中の企画・関連リンク・画廊・作り手たち）にまとめる。道具箱・案内所は押すと開くサブメニュー。長かった案内・投稿は項目ごとの画面に分ける（ソーサリアンとはは「ソーサリアン Text とは」の後半、投稿は作り方・手順・zip の中身の3節を1画面に）。メニューと画面の見出しのカタカナは和語にする（ギャラリー→画廊、スタッフ→作り手たち）。英語の小見出し（About など）は飾りなので残す。以前の章の URL は移った先へ転送する |

---

## 3. 開発ルール

### 作業の進め方

- 対応が難しいもの・工数が大きいものは、**着手前に報告**する。
- 機能のまとまり（フェーズ）ごとに PR を作る。
- PR テンプレート（`.github/pull_request_template.md` など）があれば、見出しに合わせる（いまはない）。
- コミット・PR・コードのコメントには、AI のモデル名を書かない。

### コード・ツール

- **構成**：npm workspaces のモノレポ（`packages/*`、`apps/*`）。Node 22 以上。
- **TypeScript 6**：`tsc -b` でプロジェクト参照を使う。アプリはそれぞれ `tsc -p apps/<app>/tsconfig.json` で検査する（noEmit）。
- **ビルドとテスト**：
  - Vite 8。ビルドの出力先は `assetsDir: '_app'`、`base: './'`。
  - Vitest 5。DOM が要るテストは `// @vitest-environment jsdom`。
- **ESLint 10**（flat config）：
  - Universal パッケージ（schema / core / convert）では、DOM のグローバル、`process`、`node:*` を禁止。
  - react-hooks ルールの対象は `packages/ui/**`、`apps/player/**`、`apps/playground/**`。
  - ブラウザで動かす確認スクリプト（`scripts/difftest.mjs`、`scripts/e2e-player.mjs`、`scripts/e2e-playground.mjs`）は、ブラウザのグローバルを使ってよい。
- **Prettier**：README、docs、prototype、scenarios、schema、assets、site は整形の対象外。
- **パッケージの参照**：`workspace-aliases.ts` で `@stext/<name>` を `packages/<name>/src/index.ts` に向ける（`@stext/ui/styles.css` も同様）。
- **依存の向き**：`schema` ← `core` / `convert` ← `cli`、`ui` ← `player` / `playground`。逆向きは作らない。
- **CI**（`.github/workflows/ci.yml`）：format:check → lint → typecheck → test → build。
- **Pages**（`.github/workflows/pages.yml`）：test → build → `scripts/build-site.mjs` → 公開。
- **文書**：日本語。分かりやすい言葉で書く。README のコマンドは1コマンド1ブロック。

---

## 4. アーキテクチャ

| パス | パッケージ | 動作環境 | 役割 |
|---|---|---|---|
| `packages/schema` | `@stext/schema` | Universal | stext/2 の zod スキーマ・型・条件パーサ、`validateScenario`、`checkScenario`、`SCENARIO_FORMAT` |
| `packages/core` | `@stext/core` | Universal | ゲームエンジン `createEngine`（start、newCharacter、begin、view、choose、enterScene、castMagic、useItem、setParam、sceneText、effectContext、paramValue）。旧エンジンと互換の GameState / GlobalState（localStorage のキーはシナリオ ID と `sorcerian_text`）、playerRank |
| `packages/convert` | `@stext/convert` | Universal | `convertScenarioXml`、`convertPlaygroundJson`（旧 Playground の `edges` 形式） |
| `packages/cli` | `@stext/cli` | Node | `stext` コマンド（convert-all、play など） |
| `packages/ui` | `@stext/ui` | Browser | Parchment、SceneText（marked、旧記法の前処理、DOMPurify、html-react-parser）、ChoiceList、HeroPanel、MagicPanel、ItemsPanel、RecordPanel、StatusEditor、EnemyCard、Effect、Toasts、`styles.css`（デザイントークン） |
| `apps/player` | `@stext/player` | Browser | プレイヤー（書庫、キャラ作成、冒険、戦闘、魔法。メニューの道具箱に記録・変換所・音楽室・制作者向けの素材、案内所にソーサリアン Text とは・投稿・募集中の企画・関連リンク・画廊・作り手たち。フッターに CONTACT） |
| `apps/playground` | `@stext/playground` | Browser | シナリオの編集環境（React Flow、dagre） |
| `prototype/` | — | — | デザインプロトタイプ |
| `scenarios/` | — | — | 旧シナリオ。シナリオごとのフォルダーに `scenario.json`・挿絵（`capture/`）・BGM（`bgm/`）をまとめる。ほかに `REPORT.md`、`index.json`（書庫の一覧。音楽室が使う `bgm` も入れる）。`gods`（新・天の神々たち）は旧シナリオの変換ではなく、stext/2 で直接書いたシナリオ |
| `assets/` | — | — | どのシナリオでも使う共通の画像・BGM・効果音（`assets/common/`）と、旧サイトの画像（`assets/site/`。案内所の画面・フッターで使う） |
| `schema/` | — | — | JSON Schema（生成物） |

### シナリオ形式 stext/2 の要点

- 選択肢はシーン内の `choices[]` に持つ。
  - `to` は配列で、要素が複数ならランダム分岐。
  - `kind: 'jump'` は番号入力（`allow`）。
  - `kind: 'answer'` は文字入力（`answer` / `to` / `else`）。
- 条件 `if` は AST が正式な形。文字列の記法も受け付ける。
- `90000` は「戻る」。
- エディター用の情報は `editor`（x、y、color）に持つ。
- 共通フッターのシーンは `meta.footerScene`。

### 環境変数

| 名前 | 内容 |
|---|---|
| `VITE_ASSET_BASE` | 共通の画像・BGM・効果音の配信元 |
| `VITE_SCENARIO_BASE` | シナリオの配信元（`scenario.json`、挿絵、BGM） |
| `VITE_PLAYGROUND_URL` | プレイヤーの投稿の画面から開く Playground（既定はプレイヤーの隣の `playground/`） |
| `VITE_POST_URL` | Playground の「投稿…」の送り先（既定は旧 Playground Flow と同じ `upload.php`） |

---

## 5. フェーズごとの進捗

| フェーズ | 内容 | 状態 |
|---|---|---|
| 計画・プロトタイプ | 移行計画書とデザインプロトタイプ「夜の書見台」 | 完了 |
| Phase 1 | モノレポ、ツール類、CI | 完了 |
| Phase 2 | スキーマ、変換器（XML → JSON） | 完了 |
| Phase 3 | エンジンと、旧エンジンとの差分テスト（43シナリオ、7,115手で一致） | 完了 |
| Phase 4 | プレイヤー β。素材を `assets/` に移設 | 完了 |
| Phase 5（公開） | GitHub Pages で公開 | 完了（初回だけ、Settings → Pages の Source を「GitHub Actions」にする必要がある） |
| Phase 5（残りの機能） | 旧エンジンの残りの機能とアイテムの使用 | 完了 |
| Phase 6（Playground） | 次の節を参照 | 実装済み（[snext1220/stext-next#9](https://github.com/snext1220/stext-next/pull/9)） |
| 旧サイトのページ | 音楽室・案内所の各画面・制作者向けの素材・CONTACT（次の次の節を参照） | 実装済み |

### Phase 6：Playground の中身

- **主なファイル**（`apps/playground/src/`）
  - `model.ts`：編集操作。どれも元を書き換えず、新しいシナリオを返す。
    - シーン：emptyScenario、nextSceneId、addScene、deleteScene、renameScene、updateScene
    - 選択肢：addChoice、updateChoice、removeChoice、moveChoice
    - その他：setPosition、setList、toGraph
  - `layout.ts`：dagre で左から右へ並べる。
  - `store.ts`：
    - 元に戻す／やり直す（100件まで。同じキーの変更は1秒以内ならまとめる）
    - 自動保存（キー `stext-next:playground:current`）
    - マイストレージ（キー `stext-next:playground:slots`）
  - `FlowView.tsx`、`SceneEditor.tsx`、`Definitions.tsx`、`checks.ts`、`Problems.tsx`、`TestPlay.tsx`、`App.tsx`、`fields.tsx`、`playground.css`
  - `help/`：ダイナミックヘルプ。`reference.md`（旧 `reference.xml` を移した内容と移行メモ）、`help.ts`（読み込み・検索）、`HelpPanel.tsx`（表示。`main.tsx` の `HelpProvider` が状態を持つ）
  - `post.ts`、`PostDialog.tsx`：投稿。旧 Playground Flow と同じ項目名（key・email・tag・level・intro・comment・ftp・scenario・bgms[]・ses[]・pics[]）で `upload.php` に送る。入力内容はキー `stext-next:playground:post`、投稿者のキーは `stext-next:playground:post-key` に保存する
- **テンプレート**：`scripts/import-playground-templates.mjs` で、旧 Playground の7本を `apps/playground/public/templates/` に変換する。
- **フロー図の表示**
  - シナリオを開くと、フロー図に全体が収まるように作り直す。
  - 大きなシナリオは、最初のシーンの近くに合わせて表示する。
  - 拡大は最大 1 倍まで。
  - スマホ幅ではミニマップを出さない。
- **確認**：`scripts/e2e-playground.mjs` の27項目（投稿は送り先への通信を差し替えて確かめる）が、開発サーバーとビルド結果の両方ですべて成功。単体テストは全体で108件成功。
- **作らなかったもの**：シーン ID のシャッフル、範囲を絞った表示、旧 PgEditor（jsTree）。本文の入力欄は textarea のまま（Monaco や CodeMirror は入れていない）。

### 旧サイトのページ（音楽室・案内所・制作者向けの素材・CONTACT）

旧サイト（https://www.web-deli.com/sorcerian/text/）にあって、プレイヤーになかったページを移した。

| 画面 | 旧サイトのページ | 内容 |
|---|---|---|
| 音楽室（`#/music`） | For Player「BGMを聴きたい」 | 共通 BGM 24曲（`assets/common/bgm/`）を用途ごとに並べて再生する。曲ごとに使っている書庫のシナリオ（`index.json` の `bgm`）を出す。効果音6種、SoundCloud のサウンドトラックへのリンク |
| ソーサリアン Text とは（`#/about`、`#/about/sorcerian`） | 概要 | SORCERIAN Text とは（eGBP）、ソーサリアンとは |
| 投稿（`#/post/<章>`） | 作品投稿 | Playground での作り方、投稿の手順（GitHub Discussions に返信）、zip の中身（stext/2 の構成） |
| 募集中の企画（`#/recruit`） | 募集企画 | 募集企画5つ（ドラゴンモードは募集終了） |
| 関連リンク（`#/links`）・画廊（`#/gallery`）・作り手たち（`#/staff`） | 資料 | 寄せられた反応や紹介、イラスト、スタッフ |
| 制作者向けの素材（`#/materials`） | For Creator | BGM 素材・キャラ画像素材集（`assets/common/face/` の24点）・書き方の資料 |
| フッター | CONTACT | X、公式マニュアル、質問・要望箱、GitHub、シナリオへの感想（`#/library/quest` でアンケートのあるシナリオだけの書庫を開く）。冒険の画面では出さない |

- **メニュー**：ヘッダーは「書庫」と、サブメニューの「道具箱」（記録・変換所・音楽室・制作者向けの素材）「案内所」（ソーサリアン Text とは・投稿・募集中の企画・関連リンク・画廊・作り手たち）。サブメニューは押すと開き、外を押す・Esc・項目を選ぶと閉じる（`screens/Menu.tsx`）。
- **以前の URL**：はじめは案内・投稿の2画面に章を並べていた。章だった `#/about/staff`・`#/about/gallery`・`#/about/links`・`#/about/stext`・`#/post/recruit`・`#/post/materials` は、分けた画面へ移す（アドレス欄も書き換える。`router.ts` の `MOVED`）。
- **主なファイル**（`apps/player/src/`）：`screens/Music.tsx`、`screens/About.tsx`、`screens/Post.tsx`、`screens/Recruit.tsx`、`screens/Links.tsx`、`screens/Gallery.tsx`、`screens/Staff.tsx`、`screens/Materials.tsx`、`screens/Doc.tsx`（読み物の画面の共通部品）、`screens/Menu.tsx`、`screens/Footer.tsx`、`music.ts`（曲の分類と使用シナリオの集計）、`links.ts`（外部リンク）。読み物の画面は開いたときに読み込む（lazy）。
- **画像**：旧サイトにしかない画像36点を `scripts/import-site-images.mjs` で `assets/site/` に取り込んだ（約5.7MB）。旧 UI の画面写真、旧ツール構成の図、原作の画面と思われる画像は取り込んでいない。
- **リンク**：旧サイトの d.hatena のマニュアルは、移転先の sorcerian.hateblo.jp に直した。Twitter は X（x.com）にした。
- **確認**：`scripts/e2e-player.mjs` の51項目がすべて成功（音楽室の再生、サブメニュー、以前の URL の転送、章への移動、画像の表示、CONTACT から書庫、スマホ幅）。

---

## 6. 残っている課題

1. Playground の PR（[snext1220/stext-next#9](https://github.com/snext1220/stext-next/pull/9)）のレビューとマージ。
2. **`scenarios/REPORT.md` の変換エラー12件**：旧リポジトリのシナリオを直すかどうかの判断。直す場合は `npm run convert:legacy` で変換し直す。
3. **Phase 5 の残り**：旧版からの導線、実際に遊んでの確認。
4. **GitHub Pages の設定**：Source を「GitHub Actions」にする（未設定なら）。
5. **ヘルプの移行メモの確認**：`apps/playground/src/help/reference.md` の `@mark 要確認`（4項目・5件）と `@mark 未実装`（`imageSet`、`randomCacheDays`、`${result?id}`、ライセンス表示など）を見て、仕様を決めるか実装する。Playground の目次で「移行メモ：要確認」などに絞り込める。
6. **改善できること（任意）**：
   - Playground からプレイヤーへリンクする（プレイヤーからは、投稿の画面から Playground を開ける）。
   - 元に戻したことで選択中のシーンが消えたとき、選択を外すのではなく別のシーンを選ぶ。
   - 保存するファイル名を工夫する（いまは `meta.id`、なければ `scenario.json`）。
   - Playground の JS が大きい（約800KB）ので、分割する。

---

## 7. 主なコマンド

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run dev:playground
```

```bash
npm run build
```

```bash
npm run build:site
```

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

```bash
node scripts/e2e-player.mjs --shots /tmp/shots
```

```bash
node scripts/e2e-playground.mjs --shots /tmp/shots
```

- 差分テストと e2e には Chromium と playwright が必要です。CI では動かしません。
- playwright がグローバルにしかないときは、`PLAYWRIGHT_PATH` にその場所を指定します。
- 旧リポジトリを `../stext` に置いておく必要があります。

---

## 8. これまでにあった問題と対処

| 問題 | 対処 |
|---|---|
| e2e でハッシュの移動が速すぎて不安定になる | ストレージを書き換えたあとに再読み込みする |
| e2e で遅延読み込み（`loading="lazy"`）の画像が読まれず、表示されていないと判定される | ページを下まで少しずつスクロールしてから、すべての画像の `complete` を待つ |
| `index.json` を作り直すと、手元の `../stext` が古いため `slayer` などが古い版に戻る | 全体の作り直しをやめ、コミット済みの `scenario.json` から `bgm` を集計して足した。旧リポジトリを最新にしてから `npm run convert:legacy` すれば同じ結果になる |
| `.gitignore` の `site/`（公開用に組み立てるサイト）が `assets/site/` まで無視していた | ルートだけを指す `/site/` にした |
| `npm i -w` で依存が追加されない | 先に `npm install` してワークスペースを認識させる |
| React Flow の Node data の型制約 | `Record<string, unknown>` と交差型にする |
| react-hooks ルールの定義が見つからない | ESLint の対象にそのアプリを追加する |
| Google Fonts の読み込みエラー（サンドボックス内） | 外部への通信が遮られているためで、想定どおり |
