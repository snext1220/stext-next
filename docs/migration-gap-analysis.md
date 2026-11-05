# 旧版からの移行機能差分

## 調査の範囲

現行のプレイヤーと Playground を、旧版リポジトリ [`snext1220/stext`](https://github.com/snext1220/stext) のプレイヤーおよび Playground Flow／Editor と比較した。現行の実装・マニュアル・移行記録に明記された内容をもとに、確認できた不足と未確認事項を分けている。

優先度は次の意味で使う。

- **P1：先に対応を検討** — シナリオの結果や続編との連携が旧版と変わる。
- **P2：通常の制作で不便** — 現行機能で代替できるが、旧版より制作・確認の手間が増える。
- **P3：利便性・表示の差** — 影響が限定的で、必要性を確認してから判断できる。

## P1：シナリオの動作に影響する差

| 機能 | 旧版 | 現行 | 影響・確認根拠 |
|---|---|---|---|
| ランダム遷移の結果保持 | `randomCacheDays` に相当する設定で、選んだ遷移先を Cookie に指定日数保持する | プレイヤーと Playground の試遊で、選択結果を `randomCacheDays` の日数だけ Cookie に保持する | 周回しても保持期間中は同じ遷移先を選ぶ。設定欄は [SceneEditor.tsx](../apps/playground/src/SceneEditor.tsx)、保持処理は [engine.ts](../packages/core/src/engine.ts) と [randomCache.ts](../packages/ui/src/randomCache.ts)、アプリからのエンジン生成は [Play.tsx](../apps/player/src/screens/Play.tsx) と [TestPlay.tsx](../apps/playground/src/TestPlay.tsx)。 |

**対応内容：** ランダム遷移の保持をプレイヤーと試遊に接続した。

## 対応済み

| 機能 | 対応内容 | 確認根拠 |
|---|---|---|
| 他シナリオの実績を参照する本文マクロ | `${result?id}` と `${result_rate?id}` が、プレイヤーでは保存済みの実績とシナリオ一覧の実績総数を使って展開される。Playground の試遊では同じブラウザーのプレイヤー保存データを読み取り専用で参照する。 | 実績情報を参照できないシナリオ ID は `?????` を表示する。[Play.tsx](../apps/player/src/screens/Play.tsx)、[TestPlay.tsx](../apps/playground/src/TestPlay.tsx)、[text.ts](../packages/core/src/text.ts)、[reference.md](../apps/playground/src/help/reference.md)。 |
| 試遊中の状態指定 | 試遊の開始前にアイテム・フラグ・パラメーター・星を指定し、その状態で分岐を確認できる。 | 指定値は試遊だけに使い、プレイヤーの保存データには反映しない。[TestPlay.tsx](../apps/playground/src/TestPlay.tsx)、[manual-playground.md](./manual-playground.md)。 |
| シナリオ全体・シーンの設定欄 | `meta.showSummary`、`meta.imageSet`、HP〜KRM の表示名、`effects.max` も編集できる。 | Playground の定義で全ステータス名を編集でき、シーンの効果欄で HP・MP・STR〜KRM の最大値・初期値を設定できる。試遊にもサマリー見出しとキャラクター画像を反映する。[Definitions.tsx](../apps/playground/src/Definitions.tsx)、[SceneEditor.tsx](../apps/playground/src/SceneEditor.tsx)、[TestPlay.tsx](../apps/playground/src/TestPlay.tsx)。 |

## P2：Playground の制作・確認機能

| 機能 | 旧版 | 現行 | 影響・確認根拠 |
|---|---|---|---|
| 試遊中の戦闘操作 | 旧プレイヤー相当の戦闘を試せた | 敵名を表示する簡易確認で、戦闘操作はできない | 敵の攻撃・回避・ダメージ・戦利品などの最終確認にはプレイヤーを開く必要がある。現行マニュアルもプレイヤーでの確認を案内している。[TestPlay.tsx](../apps/playground/src/TestPlay.tsx)、[manual-playground.md](./manual-playground.md)。 |
| 試遊中に直前のシーンへ戻る | 戻る操作で直前のシーンに戻れた | 「戻る」はログに案内を出すだけで、試遊の履歴を戻せない | 戻る遷移を含む分岐の確認に、最初からやり直す手間がかかる。[TestPlay.tsx](../apps/playground/src/TestPlay.tsx)。 |

**対応の考え方：** 試遊で直前のシーンへ戻る操作を検討する。戦闘試遊はプレイヤー側の戦闘機能があるため、制作上の必要性・実装規模を見て判断する。

## P3：表示・操作上の差

| 機能 | 旧版 | 現行 | 判断材料 |
|---|---|---|---|
| 素材ライセンスのプレイ後表示 | シナリオ終了時にブラウザーのコンソールへ一覧を出した | ライセンス情報はシナリオに保持し、Playground で編集できるが、プレイヤー画面には表示しない | 旧版の表示先は開発者向けコンソールだった。利用者にもクレジットを見せる必要があるかを確認してから、画面表示を検討する。[Definitions.tsx](../apps/playground/src/Definitions.tsx)、[reference.md](../apps/playground/src/help/reference.md)。 |

## 互換性を追加確認したい項目

以下は機能が欠けていると断定できず、旧版の制約と現行の挙動の差を確認してから扱う。

| 項目 | 現在の記録 | 確認内容 |
|---|---|---|
| 条件式での `<` | 旧版のヘルプは回避条件で `<` を不可としていたが、現行エンジンは判定する | 旧版実装の挙動と照合し、互換性のための制約か、現行で正式に許可する仕様かを決める。 |
| Markdown の連続した空行 | 現行の Markdown 描画では旧版と表示が異なる可能性がある | 旧シナリオの実例で段落間隔を比較し、必要なら移行時の書き換え方を案内する。 |
| 画像ファイル名の使用可能文字 | 旧版ヘルプの制限が現行でも必要か未確認 | 日本語や記号を含むファイル名の参照・配信を確認する。 |
| 番号入力・文字入力の選択肢数 | 旧版は各種の選択肢を1シーンにつき1つまでとしていた。現行で複数置く場合の互換性は未確認 | 現行スキーマ・エンジンの動作と旧シナリオを照合し、許容数を決める。 |

これらの未確認メモは [Playground のヘルプ](../apps/playground/src/help/reference.md) にも記載されている。

## 旧版から意図的に変更・廃止したもの

以下は未移行の不具合として扱わず、必要性が確認された場合に別途判断する。

- Playground Flow の表示範囲絞り込み、シーン ID のシャッフル、旧 PgEditor（jsTree）は現行では提供しない。フロー図は全シーンを表示し、シーン選択は表示位置の移動に使う。
- 旧 Playground の名前付き「マイストレージ」は、作品ごとの IndexedDB 自動保存と作品一覧に置き換えた。
- XML は取り込み・変換用で、正式な編集・出力形式は stext/2 JSON。旧版の XML／Markdown 切り替え編集を再現しない。
- 旧版の直接投稿フローは、作品と素材の ZIP を作成して外部アップロード後に提出する方式へ変更した。

これらの変更は [manual-playground.md](./manual-playground.md) と [project-notes.md](./project-notes.md) にも記載されている。

## プレイヤーの移行状況

[移行計画](./migration-plan.md) では、ステータス編集、敵の撃破チェック、バックアップ／リストア、ランク・ボーナス一覧、X への共有、アイテム使用、文字演出など、旧エンジンのプレイヤー向け機能は移行済みとしている。したがって、今回確認できたプレイヤー側の主な差は P1 の「ランダム結果保持」と「他シナリオ実績の参照」であり、Playground 側は試遊機能と編集欄に差が残っている。

## 主な比較資料

- 旧版：[`snext1220/stext`](https://github.com/snext1220/stext) の `stext/sgml.js`、`playground/index.html`、`playground/editor.html`、`playground/lib/reference.xml`
- 現行プレイヤー・Playground：上記表内の実装ファイルと [manual-player.md](./manual-player.md)、[manual-playground.md](./manual-playground.md)
- 現行の移行記録：[migration-plan.md](./migration-plan.md)、[project-notes.md](./project-notes.md)
