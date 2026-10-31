# 素材（画像・BGM・効果音）

旧リポジトリ [snext1220/stext](https://github.com/snext1220/stext) の `stext/` から移した素材です。構成は旧リポジトリと同じです。

| パス | 内容 |
| --- | --- |
| `common/bgm/` | 共通の BGM（シナリオでは `@field05` のように `@` を付けて指定） |
| `common/se/` | 共通の効果音（ダイス・ダメージ・回避・戦利品・状態異常） |
| `common/` のその他 | 共通の画像（属性・攻撃のアイコン、顔グラフィックなど） |
| `<シナリオID>/capture/` | シナリオの挿絵（本文の `![説明](ファイル名)`） |
| `<シナリオID>/bgm/` | シナリオ独自の BGM。`bgm/se/` は効果音 |

素材の作者とライセンスは、各シナリオの `licence`（`scenarios/<シナリオID>/scenario.json`）に記載されています。

取り込み直すときは、旧リポジトリを `../stext` に clone して `node scripts/import-legacy-assets.mjs` を実行します。
