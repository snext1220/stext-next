# 素材（画像・BGM・効果音）

旧リポジトリ [snext1220/stext](https://github.com/snext1220/stext) の `stext/` から移した素材です。

シナリオに関係する素材は、シナリオ本体と同じフォルダー（`scenarios/<シナリオID>/`）にまとめています。このフォルダー（`assets/`）には、どのシナリオでも使う共通の素材だけを置きます。

| パス | 内容 |
| --- | --- |
| `assets/common/bgm/` | 共通の BGM（シナリオでは `@field05` のように `@` を付けて指定） |
| `assets/common/se/` | 共通の効果音（ダイス・ダメージ・回避・戦利品・状態異常） |
| `assets/common/` のその他 | 共通の画像（属性・攻撃のアイコン、顔グラフィックなど） |
| `scenarios/<シナリオID>/capture/` | シナリオの挿絵（本文の `![説明](ファイル名)`） |
| `scenarios/<シナリオID>/chara/` | シナリオ独自のキャラクター画像（`imageSet` が `custom` のとき。`性別_年齢_種族.png`） |
| `scenarios/<シナリオID>/bgm/` | シナリオ独自の BGM。`bgm/se/` は効果音 |
| `assets/site/` | 旧サイト（https://www.web-deli.com/sorcerian/text/）の画像。プレイヤーの案内・投稿・フッターで使う（ギャラリー、募集企画のバナー、CONTACT のアイコンなど。旧サイトの `image/` と同じ構成） |

素材の作者とライセンスは、各シナリオの `licence`（`scenarios/<シナリオID>/scenario.json`）に記載されています。`assets/site/` の画像の作者は、プレイヤーの案内（ギャラリー・スタッフ）に記載しています。

取り込み直すときは、旧リポジトリを `../stext` に clone して `node scripts/import-legacy-assets.mjs` を実行します（`assets/site/` は消しません）。`assets/site/` は `node scripts/import-site-images.mjs` で旧サイトから取り込み直します。
