# 長期的なリファクタリング候補

2026-11-09 時点で、保守性・変更時の影響範囲・状態管理の複雑さを観点に、アプリケーションと主要パッケージのコードを確認した結果です。行数だけでは判断せず、ひとつのモジュールに集まっている責務、非同期処理や状態遷移の結び付き、変更時に確認が必要な範囲を重視しています。

ここに挙げるのは、現時点で確認できた保守上のリスクと改善候補です。記載したコードに既知の不具合がある、またはただちに全面改修が必要、という意味ではありません。優先度は機能開発の合間に段階的に見直す目安です。

## 優先順位

| 順位 | 優先度 | 対象 | 主なリスク |
| --- | --- | --- | --- |
| 1 | 高 | Playground の保存・編集状態管理 | 保存、切替、素材、履歴の非同期処理が集中し、状態遷移の変更が相互に影響しやすい |
| 2 | 高 | プレイヤーのプレイ画面 | エンジン操作、戦闘、保存、音声、画面表示が集中し、進行変更の影響範囲が広い |
| 3 | 中 | Playground の画面全体 | 読み込み・変換・提出・ZIP 出力とエディター表示の調整が同じコンポーネントに集まっている |
| 4 | 中 | Playground のシーン編集フォーム | 本文、選択肢、効果、シーン設定の編集 UI が一つのファイルに集まり、変更時の見通しが悪くなりやすい |
| 5 | 低 | CLI のコマンド実装 | コマンドごとの処理は関数に分かれているが、変換・検査・対話プレイ・出力処理が単一モジュールに集まっている |

## 1. Playground の保存・編集状態管理

**対象:** [`apps/playground/src/store.ts`](../../apps/playground/src/store.ts) と保存・履歴モジュール

**実施状況（2026-11-10）:** IndexedDB の読み書き・復元・素材管理を [`store-persistence.ts`](../../apps/playground/src/store-persistence.ts) に、Undo/Redo と変更のマージ規則を [`store-history.ts`](../../apps/playground/src/store-history.ts) に分離しました。`useScenarioStore` の公開 API、IndexedDB のバージョンとデータ形式は維持しています。`store.ts` は約 890 行から約 470 行になりました。

### 根拠と懸念

- IndexedDB の初期化・トランザクション、シナリオの復元・移行、素材 CRUD とエクスポート用スナップショットは保存モジュールが担当します（[`openDatabase` と復元処理](../../apps/playground/src/store-persistence.ts#L38)、[`loadExportSnapshot`](../../apps/playground/src/store-persistence.ts#L261)）。
- `store.ts` の hook には自動保存、プロジェクト切替・削除・作成、素材操作、ZIP 用スナップショットの調整が残っています。保存キュー、素材キュー、バージョン番号、タイマーは複数の操作から使われるため、非同期処理の順番やエラー処理を変える際には横断確認が必要です（[`useScenarioStore`](../../apps/playground/src/store.ts#L61)、[`retrySave` とスナップショット作成](../../apps/playground/src/store.ts#L199)）。
- Undo/Redo の履歴上限と入力マージは独立しましたが、状態更新自体は `useScenarioStore` と連携します（[`useScenarioHistory`](../../apps/playground/src/store-history.ts#L18)）。

### 推奨する進め方

1. **完了:** IndexedDB の読み書きとトランザクションを React 非依存の保存モジュールへ移しました。プロジェクト削除時はシナリオと素材を同じトランザクションで削除します。
2. **完了:** Undo/Redo と変更のマージ規則を履歴 hook に分離しました。
3. **継続候補:** hook に残る自動保存・再試行・プロジェクト操作の調整は、現時点では保存キューとの結び付きが強いため維持します。今後変更が重なる場合に、挙動を保つテストを先に追加したうえで小さく分離します。

### 変更時に守ること

- 自動保存、保存再試行、プロジェクト切替・削除・作成中の順序と失敗時の表示。
- ZIP 作成中にデータが変わらないこと、素材操作との同期。
- IndexedDB の既存データ、旧 `current` データからの復元、履歴のマージと上限。
- [`store.test.tsx`](../../apps/playground/src/store.test.tsx) は下書きの復元・移行に加え、プロジェクトと素材の削除を確認します。[`store-history.test.tsx`](../../apps/playground/src/store-history.test.tsx) は Undo/Redo、置換、変更マージを確認します。保存失敗・再試行や素材操作の競合は、今後 hook をさらに分ける際に境界テストを追加します。

## 2. プレイヤーのプレイ画面

**対象:** [`apps/player/src/screens/Play.tsx`](../../apps/player/src/screens/Play.tsx#L95)（約 744 行）

### 根拠と懸念

- `Play` がエンジン状態、戻る履歴、トースト、パネル、セーブダイアログなどを持ち、同じ関数内で進行・戦闘と画面描画を組み立てています。
- 戦闘の初期化、ダイス、被攻撃の表示、攻撃、ドロップ処理がプレイ画面に含まれています（[`newBattle` と戦闘操作](../../apps/player/src/screens/Play.tsx#L209)、[`reportAttack`](../../apps/player/src/screens/Play.tsx#L262)）。
- 選択・戻る・魔法・アイテム使用では、エンジン、React state、保存、音声、通知を連動させています（[`choose` と各操作](../../apps/player/src/screens/Play.tsx#L317)）。
- 同じコンポーネント内に冒険者パネルの分岐と大きな画面構造もあります（[`panelBody`](../../apps/player/src/screens/Play.tsx#L405)、[画面の描画](../../apps/player/src/screens/Play.tsx#L457)）。

### 推奨する進め方

1. 戦闘状態と戦闘操作を、戦闘用 hook または小さなコントローラーに分離します。画面は結果を受けて表示する役割にします。
2. エンジンの遷移・セーブ・履歴を結び付ける処理と、イベント通知・効果音の変換を分けます。
3. 冒険者パネルや設定など、状態共有の少ない表示部分から子コンポーネントへ切り出します。

### 変更時に守ること

- 旧エンジン互換の保存形式、戻る履歴、エンディングと続編への引き継ぎ。
- ロード時に履歴・戦闘状態・表示状態を初期化する既存動作。
- [`Play.test.tsx`](../../apps/player/src/screens/Play.test.tsx) などで選択、戦闘、ロード後の動作を維持する。分割のために進行ロジックまで UI 側へ複製しない。

## 3. Playground の画面全体

**対象:** [`apps/playground/src/App.tsx`](../../apps/playground/src/App.tsx#L39)（約 691 行）

### 根拠と懸念

- 画面選択・編集状態の調整と、ファイル読込、旧形式変換、公開 URL からの読込を同じコンポーネントが扱っています（[`openFile` と `openUrl`](../../apps/playground/src/App.tsx#L189)）。
- JSON/ZIP 出力、素材スナップショット、提出前の保存、進捗表示もここにあります（[`downloadArchive`](../../apps/playground/src/App.tsx#L241)、[`preparePost`](../../apps/playground/src/App.tsx#L280)）。
- フロー図、タブ、シーン編集、定義、素材、検査、試遊、各種ダイアログを一つの画面で接続しています（[画面の構成](../../apps/playground/src/App.tsx#L313)）。

### 推奨する進め方

- まず読込・変換、アーカイブ出力、提出準備を画面外の関数や hook に移し、`App` を状態の配線とレイアウト中心にします。
- 既存の `archive.ts`、`post.ts`、各 Dialog の責務を活用し、同じ処理を新たな層に重複実装しないようにします。
- 画面全体を一度に書き換えず、各ワークフロー単位で既存テストを保ちながら切り出します。

## 4. Playground のシーン編集フォーム

**対象:** [`apps/playground/src/SceneEditor.tsx`](../../apps/playground/src/SceneEditor.tsx#L101)（約 693 行）

### 根拠と懸念

- `SceneEditor` は ID 変更、本文、選択肢の一覧、シーン効果、敵・エンディング・BGM などの設定をまとめて描画します。
- `ChoiceEditor` と `ConditionField` は既に分離されていますが、選択肢の種類ごとの入力、条件候補、各種効果フィールドまで同一ファイルにあります（[`ChoiceEditor`](../../apps/playground/src/SceneEditor.tsx#L431)、[`ConditionField`](../../apps/playground/src/SceneEditor.tsx#L581)）。
- フォーム項目の追加や入力形式の変更が、無関係な編集領域の確認・テストにも波及しやすくなります。

### 推奨する進め方

- 既存の `ChoiceEditor` に加えて、本文・選択肢一覧・効果・その他設定を領域ごとの小コンポーネントに分けます。
- `onChange` と Undo 用 `mergeKey` の規則は親側で維持し、子側には型付きの値とコールバックを渡します。
- 入力 UI だけの分割に留め、シナリオの更新ロジックは既存の [`model.ts`](../../apps/playground/src/model.ts) を引き続き利用します。

## 5. CLI のコマンド実装

**対象:** [`packages/cli/src/index.ts`](../../packages/cli/src/index.ts#L60)（約 556 行）

### 根拠と懸念

- 一つのモジュールで `convert`、`convert-all`、`validate`、`play` を実装し、カタログ読込・レポート出力・対話入力と状態表示も扱っています（[`convert` / `convertAll`](../../packages/cli/src/index.ts#L104)、[`validate` / `play`](../../packages/cli/src/index.ts#L357)）。
- コマンドごとの関数分割はすでにあるため、上記の UI 状態管理ほど緊急性はありません。一方、コマンド追加時に単一ファイルの編集範囲が増え続ける可能性があります。

### 推奨する進め方

- 次の CLI コマンド追加や大きな変更のタイミングで、コマンド実装と共通の引数解析・出力整形を分けます。
- `run` のディスパッチと既存の `Io` 注入を保ち、テストしやすいコマンド境界を維持します。
- [`index.test.ts`](../../packages/cli/src/index.test.ts) のコマンドごとの入出力・終了コードのテストを移動後も維持します。

## 進め方の共通方針

- まず対象領域の既存テストを確認・追加してから分割し、振る舞い変更と構造変更を同時に行わない。
- 一度にファイルを細かく分けすぎず、変更理由と責務境界が明確な単位で移す。
- プレイヤーの旧互換、Playground の IndexedDB データ、提出フローなどの既存決定事項を優先して維持する。
- 優先度はコードの増加や機能変更に応じて見直す。定期的な大規模リライトは前提にしない。
