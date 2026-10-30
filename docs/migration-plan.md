# ソーサリアンText 次世代化 移行計画（v2 計画書・ドラフト）

> ステータス: **計画段階**（ロジック開発は未着手）
> 対象リポジトリ: `snext1220/stext-next`（v2 開発用）。現行 jQuery 版は [`snext1220/stext`](https://github.com/snext1220/stext) で稼働を継続
> 本書の `stext/sgml.js` などのパスは、現行リポジトリ `snext1220/stext` 内のパスです
> デザインプロトタイプ: [`prototype/design/index.html`](../prototype/design/index.html)（ブラウザで直接開けます）

---

## 0. ゴール

| # | 目標 | 完了の定義 |
|---|------|-----------|
| G1 | UIをReactへ、ロジックをESModuleへ。可能な範囲をUniversal JavaScript化 | エンジン本体（`@stext/core`）がDOM・jQuery・`localStorage`に一切依存せず、Node.js上でシナリオを最初から最後までヘッドレスに実行できる |
| G2 | シナリオの正式フォーマットをJSONへ | JSON Schemaで定義された`scenario.json`をエンジンが唯一の入力として扱う。XMLは`xml → json`変換器経由でのみ読み込む |
| G3 | ファンタジー色を残したままUIを刷新し、操作性を改善 | 既存43シナリオが新UIで遊べ、スマートフォン片手操作・キーボード操作・既存セーブの引き継ぎが可能 |

非ゴール（今回はやらない）: シナリオ内容の改変、ゲームルール（ダメージ計算・魔法の星コスト等）の仕様変更、サーバーサイド（ASP.NET / PHP）側の作り直し。

---

## 1. 現状分析

### 1.1 コード規模と構成

| 対象 | 実体 | 規模 | 所見 |
|------|------|------|------|
| ゲームエンジン | `stext/sgml.js` | 約5,500行・単一ファイル | `$.fn.startGame`等のjQueryプラグイン。状態（`save_data`等）はクロージャ内のグローバル変数 |
| 開発環境 Playground | `playground/index.html` + `lib/playground.js` | 約1,070行 + 約3,700行 | vis.js（フロー図）・SlickGrid・Ace・jsTreeを組み合わせたエディタ。JSONを生成済み |
| 依存ライブラリ | `stext/*.js`, `playground/lib/*` | 15種以上 | jQuery, Sidr, SmartMenus, toastr, Zoombox, Textillate, js-cookie, selectBox, jQuery Markdown 等。多くがメンテ停止 |
| シナリオ | `stext/<id>/scenario.xml` | **43本 / 6,571シーン** | 最大は `slayer`（1,893シーン）。シナリオ一覧は `stext/stext.xml` |
| 素材 | 画像・BGM・SE | `stext/`全体で約300MB | 顔グラ・ダイス・属性アイコン・メニュー画像など |

### 1.2 `sgml.js` の論理ブロック（分割の目安）

| ブロック | 主な関数 | 分類 |
|---------|---------|------|
| `Common`（基本データ） | 名前・称号・`pc_init`・`magic`（星コスト）・`star_names` | **純粋データ** → そのままESM化可 |
| `Util` 条件判定 | `judgeMultiCondition`, `conditionFull`, `ifParam`, `ifStatus`, `hasStars` … | **純粋ロジック**（ただし`eval`使用・`save_data`直参照） |
| `Util` 状態更新 | `updateItems`, `updateFlags`, `updateHpMp`, `updateStars`, `updateResults` … | **純粋ロジック化可能**（現状はtoastr・DOM操作が混在） |
| `Util` 戦闘 | `computeDamage`, `dropItem`, `judgeExpression` | **純粋ロジック化可能**（乱数を注入可能にする） |
| `Util` テキスト処理 | `interpolation`, `ifCondition`, `importText`, `decorateText` | **純粋ロジック化可能**（`${if}`, `${import}`, `${var}` などの展開） |
| `Util` 永続化 | `saveStorage`, `loadStorage`, `downloadSavedata`, `restoreSaveData` | アダプタ化（ブラウザ/Node で差し替え） |
| `SideBar` / `ControlPanel` | ステータス・魔法・アイテム・実績・ボーナス各ダイアログ | **React UIへ全面置換** |
| `createScene` | シーン描画の中核（約350行） | エンジン側（状態遷移）とUI側（描画）に分解 |
| `gbat2stext`, `backupData`, `restoreData` | 変換・バックアップ | CLI/ツール側へ移設 |

### 1.3 シナリオ記法の現状

- シーン本文はMarkdown風テキスト。選択肢は `[ラベル](遷移先 "条件")` 形式で本文中に埋め込み
  - 条件の接頭辞: `f`(フラグ) `i`(アイテム) `m`(魔法) `o`(ステータス `oSTR6+`) `p`(パラメーター) `r`(実績) `s`(星) `x`(経過シーン) `-`(否定) `fn:`(関数) と、`#AND#` `#OR#` `#NOT#` `#L#` `#R#`
  - 遷移先は `6700,6700,6701` のようなランダム分岐も可
- テキスト内マクロ: `${if}`(1,182回) `${import}`(861回) `${var}`(434回) `${race}` `${name}` `${input}` `${tweet}` など
- シーン属性: `items` `flags` `enemies` `result` `bgm` `se` `rule` `end` `hp` `mp` `stars` `params` `nexts` `state` 等

### 1.4 主な課題

1. **単一巨大ファイル＋グローバル状態**で、テスト・部分改修が困難
2. 条件式評価に **`eval`** を使用（安全性・デバッグ性の問題）
3. ロジックとDOM操作・通知（toastr）が密結合で、Playgroundのプレビューと本番エンジンで挙動差が生じやすい
4. XML（本番）とJSON（Playground）の**二重フォーマット**
5. UIはPC前提のサイドバー＋ドロップダウン中心で、スマートフォンでの操作性が低い（現行画面ではサイドバーが本文を覆う）
6. ビルド工程・型・テストが存在しない

---

## 2. ターゲットアーキテクチャ

### 2.1 パッケージ構成（npm workspaces によるモノレポ）

```
stext/
├─ packages/
│  ├─ schema/        @stext/schema     … JSON Schema / TypeScript型 / バリデータ        [Universal]
│  ├─ core/          @stext/core       … ゲームエンジン（状態・遷移・条件式・戦闘・マクロ） [Universal]
│  ├─ convert/       @stext/convert    … XML→JSON変換、旧セーブデータ移行、.gbat変換      [Universal]
│  ├─ cli/           @stext/cli        … `stext convert` / `stext validate` / `stext play`  [Node]
│  ├─ ui/            @stext/ui         … Reactコンポーネント・デザイントークン            [Browser]
│  ├─ player/        apps/player       … プレイヤーアプリ（Vite + React）                  [Browser]
│  └─ playground/    apps/playground   … 新Playground（第2段階）                           [Browser]
├─ scenarios/        … 変換済み scenario.json（素材は従来パスを参照）
└─ legacy/           … 現行 jQuery 版（移行完了までそのまま稼働）
```

- 言語: **TypeScript**（出力はESM）。JSで書きたい場合もJSDoc + `checkJs`で型検査
- ビルド: Vite（アプリ）、tsup もしくは `tsc`（ライブラリ）
- テスト: Vitest（core/convert は Node 環境、ui は jsdom）、Playwright（E2E）
- Lint/Format: ESLint + Prettier

### 2.2 Universal 化の境界

`@stext/core` は以下を**引数で受け取る**ことで環境非依存にする。

| 依存 | インターフェース | ブラウザ実装 | Node実装 |
|------|------------------|--------------|----------|
| 乱数 | `rng: () => number` | `Math.random` | シード付きPRNG（テスト・リプレイ用） |
| 永続化 | `StorageAdapter { get, set, remove }` | `localStorage`（キーは現行互換） | ファイル / メモリ |
| 素材パス | `assetResolver(path)` | 公開URL | ローカルパス |
| 通知 | エンジンは **イベント配列を返すだけ**（`ItemGained`, `ResultUnlocked`, `HpChanged` …） | Reactでトースト等に描画 | ログ出力 |

エンジンのAPIは**純粋関数＋イミュータブルな状態**を基本とする。

```ts
const engine = createEngine(scenario, { rng, storage });
let state = engine.newGame({ constraint });            // キャラ生成
let view  = engine.enterScene(state, '0');             // { state, scene: RenderedScene, events: GameEvent[] }
view      = engine.choose(view.state, choiceId);       // 選択肢
view      = engine.resolveBattle(view.state, enemyId, diceRoll);
```

- `RenderedScene` は **マクロ展開・条件評価済み** のデータ（本文Markdown、表示可能な選択肢、敵、効果）。UIは描画に専念する
- これにより、Node上で全シナリオの到達可能性チェック・回帰テスト（スナップショット）が可能になる

### 2.3 条件式

- `eval` を廃止し、**小さな再帰下降パーサ**で現行の条件記法（接頭辞・`&` `|` `!` `()`・`#AND#`系エイリアス・`fn:`）をAST化して評価
- JSONフォーマットでは条件を **文字列（現行記法）** のまま保持する。AST化はロード時に行い、構文エラーは `stext validate` で検出
  - 理由: 作者が書き慣れた記法を維持でき、XML→JSON変換が可逆に近くなる
  - 将来、構造化形式（`{ "all": [ {"flag": "f01"}, ... ] }`）も受け付けられるようスキーマに余地を残す

### 2.4 UI（React）

- React 18 + Vite。状態は `useReducer` + Context（エンジン状態は単一ストア、UI状態はローカル）で開始し、必要になれば Zustand を検討
- jQueryプラグイン群の置き換え

| 現行 | 新 |
|------|----|
| Sidr（サイドバー） | 自前 `<Drawer>`（PC: 常設サイドパネル / スマホ: 下部シート） |
| SmartMenus | 自前 `<NavBar>` + スマホ下部タブバー |
| toastr | 自前 `<Toast>`（実績・アイテム獲得演出） |
| Zoombox | `<dialog>` ベースのライトボックス |
| Textillate / Lettering | CSSアニメーション（`prefers-reduced-motion` 尊重） |
| jQuery Markdown | `marked` または `markdown-it` + 独自拡張（選択肢・マクロはエンジン側で処理済み） |
| js-cookie / selectBox | 不要化 |

- 埋め込み互換: 既存ページの `$('#main').startGame('scepter')` 相当として、`mountStext(el, { scenario: 'scepter' })` を提供し、外部サイト（web-deli.com）への組み込みを維持

---

## 3. シナリオJSONフォーマット（v2）

Playgroundが生成している現行JSON（`playground/template/*.json`）を土台に、以下を整理する。

| 項目 | 現行Playground JSON | v2 案 |
|------|--------------------|-------|
| バージョン | なし | `"format": "stext/2"` と `$schema` を必須に |
| メタ情報 | `title` `author` `init.*` に分散 | `meta`（title, author, description, keywords, constraint, bgm, labels）へ集約 |
| 選択肢 | 別配列 `edges[] {from,to,label,condition}` | シーン内 `choices[]` に保持（`to` は配列でランダム分岐を表現）。Playgroundのフロー図は `choices` から導出 |
| 効果 | `items: "i99"` などカンマ区切り文字列 | `effects: { items: ["i99"], flags: ["f99"], hp: -5, ... }` の配列/数値 |
| 敵の参照 | `enemies: "m99,m98"` | `enemies: ["m99","m98"]` |
| エディタ専用情報 | `label`, `x`, `y`, `group` がシーンに混在 | `editor: { x, y, label }` に分離（エンジンは無視） |

```jsonc
{
  "$schema": "https://snext1220.github.io/stext/schema/scenario.v2.json",
  "format": "stext/2",
  "meta": {
    "id": "scepter",
    "title": "新・消えた王さまの杖",
    "author": "Rio",
    "keywords": ["探索", "リメイク", "王さまの杖"],
    "constraint": { "race": ["FIGHTER","WIZARD","DWARF","ELF"], "age": ["YOUNG","ADULT","OLD"] },
    "bgm": { "main": "@field05", "happy": "@field04", "bad": "@town01" }
  },
  "items":   [{ "id": "i01", "name": "こいし", "text": "何の変哲もない、石だ" }],
  "flags":   [{ "id": "f01", "text": "「☆」の道を調べた。" }],
  "params":  [],
  "enemies": [{ "id": "m01", "name": "人面岩", "element": "earth", "attack": "physics", "func": "L-STR", "text": "喋るだけで、硬い岩だ。" }],
  "results": [{ "id": "r01", "name": "冒険のはじまり", "level": 1 }],
  "groups":  [],
  "licence": [],
  "scenes": [
    {
      "id": "1000",
      "summary": "王さまの依頼",
      "text": "……嗚呼、誉れ高き勇者よ…！\n\n![王さまの杖](scepter.png)",
      "effects": { "results": ["r01"] },
      "choices": [{ "label": "君のぼやきは止まらない", "to": ["1010"] }]
    },
    {
      "id": "1010",
      "text": "君はその時、数歩先の床が微妙に凹んでいることに気付く。",
      "choices": [
        { "label": "踏んでみる",   "to": ["1020"] },
        { "label": "石を投げる",   "to": ["1030"], "if": "i01" },
        { "label": "引き返す",     "to": ["1000"], "if": "-f01" }
      ]
    }
  ]
}
```

- 本文中の `${if}` `${import}` `${var}` 等のマクロは **v2でも本文文字列内に残す**（変換の忠実性を優先）。エンジンが展開する
- 本文中にインライン記述された選択肢 `[ラベル](遷移先 "条件")` は、変換器が `choices[]` に抽出。ただし `${if}` 内部の選択肢など抽出できないケースは本文に残し、エンジン側でも従来記法を解釈できるようにする（**互換モード**）

### 3.1 XML → JSON 変換器（`@stext/convert`）

- 入力: `scenario.xml`（ブラウザでは `DOMParser`、Node では `fast-xml-parser` などを差し替え注入）
- 出力: v2 JSON ＋ 変換レポート（警告: 未定義ID参照、抽出できなかった選択肢、未知の属性 等）
- 一方向のみ（JSON→XMLは提供しない）
- 検証方法: **43シナリオ全件**を変換し、①スキーマ検証 ②旧エンジンと新エンジンで同一シード・同一選択列を流して到達シーン列・状態が一致すること（差分テスト）を確認
- Playgroundの既存JSON（`edges`形式）からv2への変換も同パッケージで提供

---

## 4. UIデザイン刷新方針

プロトタイプ: `prototype/design/index.html`（React UMD + htm で依存インストール不要。モックデータで画面遷移のみ実装）

### 4.1 デザインコンセプト「夜の書見台」

- 暗い革装丁の枠（背景）に、**羊皮紙のページ**が一枚置かれている構図。現行の黒背景＋白い紙面＋五芒星という印象を継承しつつ、質感と階調で整理する
- 金箔（見出し・罫線・アクティブ状態）と、7つの星（太陽・月・火星・水星・木星・金星・土星）の色を**アクセントの語彙**として固定
- 書体: 見出しに欧文の碑文系セリフ（Cinzel）、本文に明朝（Shippori Mincho）、UI・数値にゴシック（BIZ UDPGothic）
- ダーク（夜）／ライト（昼の書斎）の2テーマ。どちらも紙面は羊皮紙色を保つ

### 4.2 操作性の改善点

| 現行の問題 | 改善 |
|-----------|------|
| サイドバーが本文を覆う / 開閉が多い | PCは「本文＋右の冒険者パネル」2カラム常設。スマホは下部タブバー＋ボトムシート |
| 選択肢がテキストリンクで押しにくい | 選択肢を大きなボタン化。番号キー（1〜9）で選択可能。条件付き選択肢は「必要条件を満たした」ことを小さな印で示す |
| 戦闘判定が別シート（Battle Sheet）に分離 | 敵カードをシーン内に表示し、ダイスロール→ダメージ反映をその場で完結 |
| HP/MPなどの変化に気付きにくい | ゲージ＋増減アニメーション、アイテム・実績獲得はトースト＋ログに残す |
| 魔法の使用可否がわかりにくい | 星の所持数と必要数を並べ、唱えられる魔法をハイライト |
| 進行状況が見えない | シーン履歴（戻れない旨を明示した「冒険の記録」）、経過シーン数、実績達成率 |
| 文字サイズ固定 | 文字サイズ3段階・行間調整・ルビ対応（読書設定） |
| アクセシビリティ | キーボード操作、フォーカス表示、`aria-live` での状態通知、`prefers-reduced-motion` |

### 4.3 画面一覧（プロトタイプ収録）

1. **書庫**（シナリオ選択）: 作者・規模・ジャンル・プレイ状況を表示
2. **冒険者の誕生**（キャラ作成）: 種族・性別・年齢・職業、能力値ロール
3. **冒険**（メイン）: 本文・選択肢・敵カード・ダイス・冒険者パネル
4. **魔法**: 7つの星と詠唱可能な魔法
5. **持ち物と記録**: アイテム・フラグ（手記として表示）・実績
6. **変換所**（XML→JSON）: 変換ツールのUI案

---

## 5. 移行フェーズとスケジュール案

各フェーズ完了時点で現行版は稼働を継続し、**ビッグバン切り替えはしない**。

| Phase | 内容 | 成果物 | 目安 |
|-------|------|--------|------|
| **0. 準備**（本ブランチ） | 現状調査・計画・デザインプロトタイプ | 本書、プロトタイプ | 完了 |
| **1. 基盤** | モノレポ化、TS/Vite/Vitest/ESLint導入、現行ファイルを `legacy/` へ移動（公開URLは維持）、CI（GitHub Actions） | ビルド・テストが回る空のパッケージ群 | 1〜2週 |
| **2. スキーマと変換器** | v2 JSON Schema 確定、`@stext/convert` 実装、43シナリオ一括変換、変換レポートの確認と手修正 | `scenarios/*/scenario.json`、`stext convert/validate` | 2〜3週 |
| **3. コアエンジン** | `Common`データ移植 → 条件式パーサ → 状態更新 → マクロ展開 → 戦闘 → セーブ互換の順で実装。旧エンジンとの差分テスト基盤 | `@stext/core`（Node上でヘッドレスプレイ可） | 4〜6週 |
| **4. プレイヤーUI** | プロトタイプを元に `@stext/ui` と `apps/player` を実装。BGM/SE、トースト、ダイアログ群 | 新プレイヤー（β） | 4〜6週 |
| **5. 並行公開・検証** | `?engine=v2` のようなクエリで新旧切り替え。小規模シナリオから順に新版をデフォルト化。旧セーブの自動移行 | 全シナリオ新版対応 | 2〜4週 |
| **6. Playground刷新** | 新エディタ（React）。vis.js→React Flow 等への置き換え、Ace→Monaco/CodeMirror 6 検討。出力はv2 JSON | 新Playground | 別途 |
| **7. 旧版撤去** | `legacy/` の凍結・アーカイブ、XMLは変換入力としてのみサポート | — | — |

### 5.1 移行順序（シナリオ）

規模と使用機能で段階的に移す。

1. `test` / `playground` のチュートリアル、`mini`, `scepter`（小〜中規模、基本機能）
2. `${if}`/`${import}` を多用するシナリオ
3. `params`・`stars`・`nexts`（連作）を使うシナリオ
4. 大規模: `avengers`（901シーン）、`slayer`（1,893シーン）

---

## 6. 互換性・データ移行

| 対象 | 方針 |
|------|------|
| セーブデータ（`localStorage` のシナリオ別キー、グローバルキー `sorcerian_text`） | キー名・構造を読み込み互換に。新形式には `version` を付与し、初回ロード時に自動マイグレーション |
| バックアップファイル（`.stext`） | 読み込み互換を維持。書き出しは新形式（旧形式での書き出しも一定期間提供） |
| `.gbat` 変換 | `@stext/convert` に移植し、出力をv2 JSONに |
| 素材パス（`@field05` などのBGMエイリアス、`scepter.png` の相対参照） | `assetResolver` で現行ディレクトリ構成をそのまま解決。素材の移動は行わない |
| 埋め込みAPI | `startGame` 互換ラッパーを legacy 撤去まで提供 |

---

## 7. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 暗黙の挙動（`eval`評価順、DOM依存の副作用）を再現できない | シナリオの進行不能 | 旧エンジンをヘッドレスブラウザで動かす**差分テスト**を整備し、43本で自動比較 |
| インライン選択肢・マクロの抽出漏れ | 変換後に選択肢が消える | 互換モード（本文中の旧記法もエンジンが解釈）＋変換レポートで要確認箇所を列挙 |
| 大規模シナリオ（1,893シーン）の性能 | 初回ロードが重い | JSONはgzip前提で配信、条件式ASTは遅延コンパイル、シーンは必要時に展開 |
| デザイン刷新で既存ファンの愛着が損なわれる | 離脱 | 既存アイコン・顔グラフィック・BGMはそのまま使用。旧UIを一定期間選択可能に |
| 作者がJSONを直接書くのは負担 | 新規シナリオ減 | Playgroundを主要な執筆環境とし、JSON Schemaによるエディタ補完も提供 |

---

## 8. 次のアクション（承認待ち）

1. 本計画とプロトタイプのレビュー（特に v2 JSONの `choices` 内包方針と、条件式を文字列のまま保持する方針）
2. デザイン方向性（「夜の書見台」）の合意、または修正点の指示
3. 合意後、Phase 1（基盤整備）から着手
