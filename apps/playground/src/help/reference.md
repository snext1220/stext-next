<!--
Playground のダイナミックヘルプ。旧 Playground の lib/reference.xml を stext/2 に合わせて移したもの。

書き方:
  # カテゴリ           目次の見出し
  ## キー[, キー…] | 見出し              （見出しのあとの空行はあってもなくてもよい）
  @legacy 旧 reference.xml のパス[, …]   （旧版にない項目は書かない）
  @related キー[, …]                     関連する項目
  @mark 種別: 内容                       移行時の指摘（種別：変更 / 未実装 / 誤り / 廃止 / 要確認）
  （空行のあと本文。Markdown。段落の途中で改行しない。改行はそのまま <br> になる）

キーはフォームの help 属性（fields.tsx、Definitions.tsx、SceneEditor.tsx）から参照する。
本文から別の項目へのリンクは [見出し](#help/キー) と書く。
-->

# シナリオ全体

## scenario | シナリオ全体

@legacy scenario, init, init/basic
@related meta.title, scene.id, scene.text
@mark 変更: 旧形式の `<scenario>`・`<init>`・`<basic>` 要素は、stext/2 では `meta`（基本情報）にまとまりました。

シナリオは stext/2 形式の JSON 1つで表します。Playground では、左のフロー図でシーンを、右の「シーン」タブで選んだシーンを、「定義」タブでシナリオ全体の情報とアイテム・フラグなどを編集します。

| 項目                                                 | 内容                                                     |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `meta`                                               | タイトル・作者・BGM などの基本情報（「定義」の「基本」） |
| `items` / `flags` / `params` / `enemies` / `results` | アイテム・フラグ・パラメーター・敵・実績の定義           |
| `groups`                                             | シーンのまとまり                                         |
| `licence`                                            | 使った素材のクレジット                                   |
| `scenes`                                             | シーン（パラグラフ）の一覧                               |

## meta.title | タイトル

@legacy title
@mark 変更: 旧版の「プレイ画面の右肩に表示される」は旧プレイヤーの画面配置の説明なので削りました。

シナリオのタイトルです。一覧やプレイ画面に表示されるので、10〜15文字程度を勧めます。

## meta.author | 作者

@legacy author
@mark 未実装: 旧版の「投稿時には、ここで指定された名前を掲載します」の投稿機能は、新しい Playground では作っていません。

作者名です。

## meta.id | シナリオ ID

@related scene.nexts, condition.result

シナリオを識別する ID です（`scepter` など。英小文字と数字を勧めます）。セーブデータの保存先や、[続編](#help/scene.nexts) の指定、[実績の条件](#help/condition.result)（`r01:scepter`）に使います。

試遊では、本文の画像を `scenarios/<シナリオ ID>/capture/` から読み込みます。

## meta.showSummary | 見出しにサマリーを出す（パラグラフレス）

@legacy init/basic/summary
@related scene.summary
@mark 変更: 旧形式の `<basic summary="true">` は `"showSummary": true` になりました。
@mark 未実装: Playground の「定義」にはまだ入力欄がありません。JSON に直接書いてください。

`true` にすると、パラグラフ番号を出さないモードになります。シーンの冒頭に、シーン番号の代わりに [サマリー](#help/scene.summary) を表示します。

## meta.imageSet | キャラクター画像

@legacy init/basic/imgset
@related meta.constraint
@mark 未実装: Playground には入力欄がありません。JSON に直接書いてください。試遊の冒険者欄も、キャラクター画像ではなく種族の紋章を表示します。

キャラクターの画像をシナリオ独自のものにするときに `"custom"` を指定します（値は `custom` だけです）。プレイヤーの［冒険者］タブには、キャラクターの性別・年齢・種族に応じた画像が表示されます。指定しないときは共通の画像（`assets/common/性別_年齢_種族.png`）を使います。

指定したときは、シナリオのフォルダーに `chara` フォルダーを作り、`性別_年齢_種族.png`（たとえば `male_adult_fighter.png`）の名前で画像を置きます。

- 大きさは 100×100px
- [キャラクター作成の制約](#help/meta.constraint) で除いたもの**以外の**すべての画像を用意する（一部だけは不可）
- 足りない画像の代わりには、種族の紋章が表示されます

## meta.constraint | キャラクター作成の制約

@legacy init/constraint
@related meta.constraint.race, meta.constraint.sex, meta.constraint.age

シナリオを始めるときに作るキャラクターの種族・性別・年齢を絞りたいときに指定します。すべて選べてよいなら指定しません。

## meta.constraint.race | 選べる種族

@legacy init/constraint/race
@related meta.constraint
@mark 変更: stext/2 では配列（`["FIGHTER", "ELF"]`）です。Playground ではカンマ区切りで入力します。

作るキャラクターの種族です。次の値をカンマ区切りで並べます。

- FIGHTER
- WIZARD
- DWARF
- ELF

## meta.constraint.sex | 性別

@legacy init/constraint/sex
@related meta.constraint

作るキャラクターの性別です。次のどちらか一つを指定します（両方よいなら指定しません）。

- MALE
- FEMALE

## meta.constraint.age | 選べる年齢

@legacy init/constraint/age
@related meta.constraint
@mark 変更: stext/2 では配列（`["YOUNG", "ADULT"]`）です。Playground ではカンマ区切りで入力します。

作るキャラクターの年齢帯です。次の値をカンマ区切りで並べます。

- YOUNG
- ADULT
- OLD

## meta.bgm | 既定の曲

@legacy init/bgm
@related meta.bgm.main, meta.bgm.happy, meta.bgm.bad, common.bgm

シナリオで使う曲を指定します。値の書き方は [BGM の指定方法](#help/common.bgm) を見てください。

## meta.bgm.main | BGM（通常）

@legacy init/bgm/main
@related common.bgm, scene.bgm

メインテーマです（指定しなければ `main`）。

## meta.bgm.happy | BGM（ハッピー）

@legacy init/bgm/happy
@related common.bgm, scene.end

ハッピーエンドの曲です（指定しなければ `happy`）。グッドエンドでもこの曲を使います。

## meta.bgm.bad | BGM（バッド）

@legacy init/bgm/bad
@related common.bgm, scene.end

バッドエンドの曲です（指定しなければ `bad`）。

## common.bgm | BGM の指定方法

@legacy init/bgm/common
@related meta.bgm, scene.bgm
@mark 変更: 旧版は共通の曲の一覧を「SText ページの Utility 01」で確かめるよう案内していました。新しいプレイヤーで使える曲（`assets/common/bgm/` の内容）をここに載せました。

- 拡張子 `.mp3` を除いた名前で指定します（`battle01.mp3` なら `battle01`）。
- 先頭に `@` を付けると共通の曲です。シナリオのフォルダーに置く必要はありません。
  - 使える曲：@battle01、@battle01d、@battle02、@battle02d、@battle03、@castle01、@end01、@end01d、@end02、@end03、@field01〜@field05、@n30j001〜@n30j004、@talk01、@talk02、@town01〜@town03
  - `@none` は無音です。
- `@` のない名前は、シナリオのフォルダーの `bgm/` から読み込みます。対応する `.mp3` を用意してください。

特定のシーンで曲を変えたいときは、シーンの [BGM](#help/scene.bgm) を指定します。

## meta.labels | ステータスの表示名

@legacy init/label, init/label/status, init/label/free
@mark 変更: 旧形式の `<label>` は `meta.labels`（`{ "free1": "所持金" }` のような対応表）になりました。
@mark 未実装: Playground の入力欄は FREE1〜3 の表示名だけです。HP〜KRM の表示名は JSON に直接書いてください。
@mark 変更: 旧版の「BattleSheet 下部の簡易ステータス表示に Free1〜3 が追加される」は、新しいプレイヤーでは「表示名を付けたか、値が 0 でない FREE をキャラクター欄に表示する」になりました。

ステータス欄の表示名を置き換えます。キーは `hp`、`mp`、`state`、`str`、`int`、`dex`、`krm`、`free1`、`free2`、`free3` です。指定しなければ HP、MP、STATE、STR…、FREE1… と表示します。

- 表示の都合上、5文字以内を勧めます。
- 見た目をそろえるため、HP〜MP、STR〜KRM はまとめて設定するのがおすすめです。
- FREE1〜3 の一部だけを使うときは、使わない項目に「－」などを設定しておくと見た目がそろいます。

## meta.keywords | キーワード

@legacy init/intro, init/intro/keywords
@mark 未実装: 旧版はゲーム画面のメタ情報（`<meta name="keywords">`）に埋め込んでいましたが、新しいプレイヤーは使っていません。

シナリオのキーワードです。カンマ区切りで1〜3語程度を目安に指定します。

## meta.description | 紹介文

@legacy init/intro/description
@related text.tweet
@mark 変更: 新しいプレイヤーでは X（旧 Twitter）で共有する文に使います。ゲーム画面のメタ情報や Twitter カードには使っていません。

シナリオの紹介文です。プレイ画面の「共有」で使う文になります（指定しなければ SText 共通の文）。

シーンの本文で [`${tweet}…${/tweet}`](#help/text.tweet) を書いたシーンでは、そちらが優先されます。

## meta.footerScene | 共通フッターのシーン

@related scene.excludeFooter, scene.id, text.import
@mark 変更: 旧形式ではシーン 99998 が予約されていました（共通インポート）。stext/2 ではどのシーンを使うかをここで指定します（旧シナリオを変換すると `99998` が入ります）。

ここで指定したシーンの本文と選択肢を、すべてのシーンの末尾に付けます。ただし、[エンディング](#help/scene.end) のシーンと、[共通フッター](#help/scene.excludeFooter) で「付けない」にしたシーンには付けません。

# 定義

## items | アイテム

@legacy items, items/item
@related items.id, effects.items, condition.flag

シナリオで使うアイテムの一覧です。1行が1つのアイテムです。

## items.id | アイテムの ID

@legacy items/item/id
@related items

アイテムの ID です（シナリオの中で重ならないこと）。`i` ＋ 番号（`i01` など）で表します。本文の `${var?i01:name}` などは、先頭の `i` でアイテムだと判断します。

## items.name | アイテムの名前

@legacy items/item/name

アイテムの名前です。

## items.text | アイテムの説明

@legacy items/item/text

アイテムの説明です（15文字程度を勧めます）。持ち物の一覧に表示します。

使えるアイテムでは、使ったときに出るメッセージにもなります。使った結果がわかる文にしてください。

## items.target | 使うと作用

@legacy items/item/target
@related items.effect
@mark 変更: 旧版の「アイテム＆フラグシートの［USE］ボタン」は、新しいプレイヤーでは持ち物の「使う」になりました。

アイテムが作用する対象です。指定すると「使えるアイテム」になり、持ち物から使えます。

- hp / mp / state
- str / int / dex / krm
- free1 / free2 / free3
- param
- none（何もしない）

`none` は効果を計算せず、アイテムを消費するだけです（何が起こるかは本文で書きます）。

## items.effect | 効果

@legacy items/item/effect
@related items.target, effects.hp, effects.state, effects.str, effects.free1, effects.params

アイテムの効果です。[使うと作用](#help/items.target) に応じた値（`5`、`1..5`、`full`、`-poison`、`p01:1` など）を指定します。

書ける値は、シーンの効果の同じ項目と同じです（たとえば `hp` ならシーンの [HP・MP](#help/effects.hp) に書ける値）。`target` が `none` なら不要です。

## items.shared | 続編に持ち越す

@legacy items/item/shared
@related scene.nexts

チェックすると、[続編](#help/scene.nexts) を指定したエンディングで、このアイテムを次のシナリオに持ち越します。

## flags | フラグ

@legacy flags, flags/flag
@related flags.id, effects.flags, condition.flag

シナリオで使うフラグの一覧です。1行が1つのフラグです。

## flags.id | フラグの ID

@legacy flags/flag/id

フラグの ID です（シナリオの中で重ならないこと）。`f` ＋ 番号（`f01` など）で表します。

## flags.text | 手記に書く文

@legacy flags/flag/text
@related flags.hidden, effects.flags

フラグの表示名です。分岐のスイッチとしてだけでなく、キャラクターの手記（あらすじ）にも表示します。分岐に使わない場面でも、物語の要所で立てておくのがおすすめです（15文字程度を勧めます）。

## flags.hidden | 隠しフラグ

@legacy flags/flag/text
@related flags.text, effects.flags
@mark 変更: 旧形式では説明の先頭に `*` を付けていました。stext/2 では `"hidden": true` です（変換すると自動で直します）。

チェックすると、手記に表示しない隠しフラグになります。シーンの効果で消せる（`-f01`）のは隠しフラグだけです。

## params | パラメーター

@legacy params, params/param
@related params.id, effects.params, condition.param

シナリオで使う内部パラメーターの一覧です。FREE1〜3 のように使える値を、いくつでも定義できます。画面には表示されないので、内部的な値の管理に使います（本文の `${var?p01:value}` で表示したり、条件に使ったりはできます）。

数値を主に想定していますが、文字列も入れられます。

## params.id | パラメーターの ID

@legacy params/param/id
@related params

パラメーターの ID です（シナリオの中で重ならないこと）。`p` ＋ 番号（`p01` など）で表します。

`p90`〜`p99` は予約番号なので、自分で使ってはいけません。いま使っているのは次のものです。

- `p99`：「戻る」（遷移先 `90000`）で戻るシーンの ID

個数を持つアイテム（`i01:5` など）は、内部で `pi01` のようなパラメーターを使います。

## params.min | 最小

@legacy params/param/min
@related params.max

パラメーターの下限です（数値のみ）。指定するときは最大とあわせて指定します。

## params.max | 最大

@legacy params/param/max
@related params.min

パラメーターの上限です（数値のみ）。指定するときは最小とあわせて指定します。

## params.initial | 初期値

@legacy params/param/initial

パラメーターの初期値です。

## params.text | パラメーターの説明

@legacy params/param/text

パラメーターの説明です（15文字程度を勧めます）。`${var?p01:text}` で本文に出せるので、表示を意識した内容にします。

## enemies | 敵

@legacy enemies, enemies/enemy
@related enemies.id, scene.enemies

シナリオで使う敵・罠の一覧です。1行が1体です。

## enemies.id | 敵の ID

@legacy enemies/enemy/id

敵の ID です（シナリオの中で重ならないこと）。`m` ＋ 番号（`m01` など）で表します。

## enemies.name | 敵の名前

@legacy enemies/enemy/name

敵・罠の名前です（10文字程度を勧めます）。

## enemies.text | 敵の説明

@legacy enemies/enemy/text

敵・罠の説明です。プレイ画面で敵をクリックしたときに表示するので、長くても50文字程度にします。

## enemies.element | 属性

@legacy enemies/enemy/element
@related enemies.drop

敵・罠の属性です。次のどれかを指定します（指定しなければ無属性）。

- earth（地）
- fire（火）
- water（水）
- wind（風）
- spirit（霊）

## enemies.attack | 攻撃

@legacy enemies/enemy/attack
@related enemies.func
@mark 変更: 旧版の「Playground Flow でも xxxN の値には対応していません」は、旧 Playground の話なので削りました。新しいエンジンは `str2` などをそのまま扱います。

攻撃の種類で、どのステータスにダメージを与えるかを決めます。次のどれかを指定します。どれでもない値は、アイコンではなく文字のまま表示します。

- physics（物理）／magic（魔法）／both（物理と魔法）
- free1／free2／free3（FREE1〜3。意味はシナリオによる）
- poison（毒）／frozen（凍結）／stone（石化）／curse（呪い）／forget（忘却）
- strN／intN／dexN／krmN（能力値を N 下げる。N は 1〜9。`str` は `str1` と同じ）

ゲームのバランスを考えると、能力値の攻撃は数値なしの `str`、`int`、`dex`、`krm` を使うべきです。

## enemies.func | ダメージ式

@legacy enemies/enemy/func
@related enemies.attack, enemies.funcOpp
@mark 要確認: 旧版は回避条件に「`[式]<[式]` は不可」としていましたが、新しいエンジンは `<` も判定します。旧エンジンとの互換のため `>` を使う説明のままにしています。

### （1）攻撃が physics／magic／both のとき

ダメージ式は `nL+nR+nLM+nRM+nM+n-nSTR-nINT-nDEX-nKRM-nFREE1-nFREE2-nFREE3` の形で書きます。

- L、LM、M、RM、R はダイスの目です。使える記号はダイスの数で変わります。
  - 2個：L（左）、R（右）
  - 3個：L（左）、M（中央）、R（右）
  - 4個：L（左）、LM（中央左）、RM（中央右）、R（右）
  - 5個：L（左）、LM（中央左）、M（中央）、RM（中央右）、R（右）
- n は任意の数です。
- 符号（＋／－）は入れ替えられます。
- どの項も省略でき、順番も自由です。
- カッコは使えません。

### （2）攻撃が状態異常・能力値のとき

回避条件を `[式]>[式]`（式は（1）と同じ形）で書きます。回避条件を満たさなかったときだけ、状態異常や能力値の低下が起こります（例：`DEX>2L`）。

### 共通

- カンマ区切りで複数書けます（そのときはランダムに一つを選びます）。
- 先頭に `*` を付けると、式を表示するだけになり、ステータスへの反映（自動計算）をしません。自動計算できないシナリオでは `*` を付けてください。

## enemies.funcOpp | こちらの攻撃式

@legacy enemies/enemy/func_opp
@related enemies.func, enemies.hp
@mark 変更: 旧形式の `func_opp` は `funcOpp` になりました。

こちらから敵を攻撃するときのダメージ式です（[HP](#help/enemies.hp) を指定したときだけ使います）。書き方は [ダメージ式](#help/enemies.func) の（1）と同じです。

## enemies.hp | 敵の HP

@legacy enemies/enemy/hp
@related enemies.funcOpp, params

敵の HP です。省略でき、指定したときだけ戦闘画面に表示します。

- 指定したときは [こちらの攻撃式](#help/enemies.funcOpp) も指定します。
- 数値のほか、パラメーターの ID（`p01` など）も書けます。そのときはシーンをまたいで HP を保てます。
  - HP の初期値は、パラメーターの初期値で指定します。
  - 最小・最大も指定できますが、ふつうは省略して構いません（指定するときは両方）。

## enemies.drop | 戦利品

@legacy enemies/enemy/drop
@related enemies.element

倒したときの戦利品です。

- `mon/3`：月の欠片×3（mon、tue、wed、thu、fri、sat、sun が使えます）
- `free1/50/50Gold`：「50Gold」（FREE1 を 50 増やす）
- `item/i01/武器`：「武器」（アイテム i01 を入手）
- `flag/f01/扉を開く`：「扉を開く」（フラグ f01 を立てる）
- `param/p01:10/瓶の中身`：「瓶の中身」（パラメーター p01 を 10 増やす。負の数なら減らす）
- `param/p01:@10/瓶の中身`：「瓶の中身」（パラメーター p01 を 10 にする）

カンマ区切りで複数書くと、ランダムに一つを選びます。

指定しなければ、[属性](#help/enemies.element) から戦利品（星の欠片）を決めます（無属性なら戦利品なし）。

## results | 実績

@legacy results, results/result
@related effects.result, condition.result

シナリオで手に入る実績の一覧です。

## results.id | 実績の ID

@legacy results/result/id

実績の ID です（シナリオの中で重ならないこと）。`r` ＋ 番号（`r01` など）で表します。

## results.name | 実績の名前

@legacy results/result/name

実績の名前です（例：ガジガジネズミ）。

## results.text | 実績の説明

@legacy results/result/text

実績を得る条件です（例：隧道でネズミに食い殺された）。

## results.level | レベル

@legacy results/result/level

難しさです。1〜5 で指定します。

## groups | グループ

@legacy groups, groups/group
@related groups.start, groups.rule
@mark 未実装: 旧版はグループを「Playground Flow でフロー図の表示範囲を絞る」ために使っていましたが、新しい Playground には範囲を絞る表示がありません（作らなかった機能）。

シーンを束ねるグループです。シーン ID の範囲で決めるので、関係するシーンはなるべく近い ID にまとめてください。

## groups.title | グループの名前

@legacy groups/group/title

グループの表示名です。見分けやすいよう、10文字前後のわかりやすい名前を付けます。

## groups.start | 最初のシーン

@legacy groups/group/start
@related groups.end, scene.id

グループに入れるシーン ID の最初です。

## groups.end | 最後のシーン

@legacy groups/group/end
@related groups.start, scene.id

グループに入れるシーン ID の最後です。

## groups.rule | グループの戦闘ルール

@legacy groups/group/rule
@related scene.rule, scene.enemies

グループで使う戦闘ルールのシーン ID です。グループのシーンに [敵](#help/scene.enemies) がいるとき、戦闘画面にこのシーンの本文を表示します。グループ共通の戦闘ルールを書きたいときに使います。

戦闘画面に表示するルールの優先順位は次のとおりです（一つだけ表示します）。

1. シーンの [戦闘ルールのシーン](#help/scene.rule)
2. グループの戦闘ルール（敵がいるシーンのみ）
3. ID が `99999` のシーン

## licence | ライセンス

@legacy licence, licence/work
@mark 未実装: 旧版はシナリオの終わりにブラウザーのコンソールへ一覧を出していましたが、新しいプレイヤーはまだ表示していません。

シナリオで使った画像・曲のクレジットです。

## licence.name | 素材名

@legacy licence/work/name

種類が bgm なら曲名、picture なら使った場所（街、酒場など）です。

## licence.category | 種類

@legacy licence/work/category
@mark 変更: 旧版の値は bgm と picture だけでした。Playground の例には効果音の `se` も載せています。

素材の種類です。

- bgm（曲）
- picture（画像）
- se（効果音）

## licence.creator | 作者

@legacy licence/work/creator

作者・サイト名です。

## licence.url | URL

@legacy licence/work/url

作品を公開しているサイトの URL です。

# シーン

## scene.id | シーン ID

@legacy scene, scene/id
@related meta.footerScene, choice.to, scene.rule
@mark 変更: stext/2 の ID は文字列です。数字以外（`town` など）も使えますが、グループの範囲は数値で比べるので、グループを使うシーンは数字にしてください。
@mark 変更: 旧形式で予約されていた 99998（共通インポート）は、stext/2 では [共通フッターのシーン](#help/meta.footerScene) で指定します。

シーン（パラグラフ）の ID です。

- シナリオの中で重ならないこと
- 0〜99999 の数字を勧めます（連番でなくて構いません）
- 予約された番号を一般のシーンに使わないこと

予約された番号：

- `0`：始まりのシーン（プロローグ）
- `90000`：選択肢の遷移先に書くと「戻る」（一つ前のシーンに戻る）
- `99999`：共通の戦闘ルール（戦闘画面に表示）

今後、`9XXXX` は予約に使う可能性があります。準予約として、通常のシーンには使わないでください。

ID を変えると、選択肢の遷移先などの参照もまとめて直します。

## scene.summary | サマリー

@legacy scene/summary
@related meta.showSummary

シーンの要約です（10文字以内を勧めます）。

ふつうはフロー図でシーンを見分けるためのもので、プレイ画面には表示しません。[見出しにサマリーを出す](#help/meta.showSummary) を有効にすると、シーン番号の代わりに表示します。

## scene.text | 本文

@legacy scene/text
@related text.macro, text.if, text.import, text.color, text.ruby, text.effect, text.tweet, text.input, scene.choices
@mark 変更: 選択肢は本文に書かず、「選択肢」の欄で作ります。旧形式の `[文言](番号)` は本文には書きません。
@mark 誤り: 旧版は水平線を `====` としていましたが、`====` は直前の行を見出しにします。水平線は `---`（または `--` だけの行）です。
@mark 要確認: 旧版の「空行を続けるには『空白＋改行』を空行の数だけ書く」は、新しいプレイヤー（marked）では空行が一つにまとまるため効きません。
@mark 要確認: 旧版の「画像の名前は英小文字と数字だけ（`_` などの記号は使えない）」が新しいプレイヤーでも必要かは確かめていません。

本文は Markdown で書きます。見出し・太字・画像・表・箇条書きなどが使えます。

| 書き方                | 意味                                              |
| --------------------- | ------------------------------------------------- |
| `# …`                 | 見出し（`#` の数が階層）                          |
| 空行                  | 段落                                              |
| \*\*…\*\*             | 太字                                              |
| \*…\*                 | 斜体                                              |
| `+ …`                 | 箇条書き                                          |
| `1. …`                | 番号付きの箇条書き                                |
| `![説明](ファイル名)` | 画像（`scenarios/<シナリオ ID>/capture/` に置く） |
| `> …`                 | 引用                                              |
| `---`                 | 水平線                                            |

改行はそのまま改行になります。`http://`・`https://` で始まる文字は自動でリンクになります。Markdown の詳細は https://notepm.jp/help/how-to-markdown なども参考にしてください。

Markdown に加えて、文字色・ルビ・条件付きの文章・変数などを `${…}` や `%…%` で書けます（[本文で使える式](#help/text.macro)）。

## text.macro | 本文で使える式

@legacy scene/text
@related text.if, text.import, text.input, text.ruby, text.color, text.effect, text.tweet
@mark 誤り: 旧版は `${state?正常:毒:凍結:石化:忘却}` としていましたが、呪いが抜けていました。正しくは「正常:毒:凍結:石化:呪い:忘却」の6つです。
@mark 未実装: `${result?id}`・`${result_rate?id}` は、新しいプレイヤーと試遊ではまだ他のシナリオの実績を受け取らないため、常に「?????」になります。

`${…}` の形で、本文の好きな場所に値を埋め込めます。

- `${title}`：キャラクターの称号
- `${name}`：キャラクターの名前
- `${job}`：キャラクターの職業
- `${hp}` など：ステータス（hp、mp、str、int、dex、krm、free1〜3）
- `${race?人間:魔法使い:ドワーフ:エルフ}`：種族で言葉を変える
- `${sex?男:女}`：性別で言葉を変える
- `${age?若者:中年:老人}`：年齢帯で言葉を変える
- `${state?正常:毒:凍結:石化:呪い:忘却}`：状態異常で言葉を変える
- `${rand?1:20}`：範囲内の乱数
- `${msg?こんにちは:おはよう:こんばんは}`：どれかをランダムに選ぶ
- `${var?i01:name}`／`${var?i01:text}`：アイテムの名前・説明
- `${var?m01:name}`／`${var?m01:element}`／`${var?m01:text}`：敵の名前・属性・説明
- `${var?r01:name}`／`${var?r01:level}`／`${var?r01:text}`：実績の名前・レベル・説明
- `${var?p01:text}`／`${var?p01:value}`：パラメーターの説明・現在の値
- `${result?シナリオID}`：そのシナリオで得た実績の数
- `${result_rate?シナリオID}`：そのシナリオの実績の達成率

race、sex、age、state、msg では、`?` のあとに `:` 区切りで表示したい言葉を書きます。

## text.import | 別のシーンの本文を読み込む

@legacy scene/text
@related meta.footerScene

`${import シーンID}` と書くと、そのシーンの本文をここに埋め込みます。埋め込む文の中でも式を使えますが、`${import}` を入れ子にはできません。

```
${import 99991}
```

## text.input | 入力欄

@legacy scene/text

`${input?…}` で、本文に［＋］［－］付きの数値の入力欄を置けます。

- `${input?0}`：0 から始まる入力欄。セーブデータには残らない、シーンの中のメモ用です。
- `${input?p01}`：パラメーター p01 の値を出す入力欄。変えた値はすぐパラメーターに反映します。

## text.if | 条件付きの文章

@legacy scene/text
@related condition

`${if 条件}…${/if}` で、条件を満たすときだけ表示する文章を書けます。条件は選択肢の [表示条件](#help/condition) と同じ書き方です（複合条件も使えます）。

```
${if f04}
フラグ f04 が立っているときだけ表示します。
${/if}
```

## text.effect | 文字の演出

@legacy scene/text
@mark 変更: 旧版（textillate.js）は flash、bounce、shake、tada、swing、wobble、pulse など多くの効果を挙げていましたが、新しいプレイヤーが対応しているのは下の10種類だけです。それ以外は fadeIn になります。

`${effect 効果名}…${/effect}` で、囲んだ文字を一文字ずつ演出付きで表示します。

使える効果名：fadeIn、fadeInDown、fadeInUp、fadeInLeft、fadeInRight、bounceIn、zoomIn、flipInX、rollIn、flash

`${effect}` は段落ごとに書きます（段落をまたぐときは、段落の数だけ書きます）。

## text.ruby | ルビ

@legacy scene/text

`${文字|ルビ}` でルビを振れます。

```
俺は${銀狼|silver wolf}だ！
```

## text.color | 文字色

@legacy scene/text

`%blue%…%/%` で囲むと、文字に色を付けられます。

```
みんな、%blue%ソーサリアン%/%だ！
```

- 使える色は blue、red、purple、white だけです（white は選択したときだけ見える隠し文字に使います）。
- 色を付けた文字の前後には、半角スペースが入ります。

## text.tweet | 共有する文

@legacy scene/text
@related meta.description
@mark 変更: 旧版の「［ツイート］ボタン」は、新しいプレイヤーでは X（旧 Twitter）の「共有」です。

`${tweet}…${/tweet}` で囲んだ文を、そのシーンの「共有」で使う文にします。

- `${tweet}` の中では Markdown の装飾は使えません。
- 1つのシーンに1つだけ書けます（複数あれば後のもの）。
- 書いていないシーンでは、[紹介文](#help/meta.description) を使います。

## scene.choices | 選択肢

@legacy scene/edge, scene/edge_flow
@related choice.kind, choice.to, condition, choice.cast
@mark 変更: 旧形式では本文に `[文言](番号 "条件")` と書いていました。stext/2 では選択肢を本文と分けて `choices` に持ちます（旧形式からの変換で自動的に分けます）。

シーンから先へ進むボタンです。上から順に表示します。フロー図でシーンの右の点から別のシーンへ線を引いても作れます。

選択肢ごとに、[表示条件](#help/condition) を付けて「条件を満たすときだけ表示」にできます。

## choice.kind | 選択肢の種類

@legacy scene/edge_common
@related choice.to, choice.jump, choice.answer
@mark 変更: 旧形式の `[…](X)`（番号入力）と `[…](Q)`（文字入力）は、種類として選ぶようになりました。

- 通常：一つの遷移先へ進みます。
- ランダム：複数の遷移先からランダムに一つを選びます。
- 番号入力：シーン番号を入力して移動します（[番号入力](#help/choice.jump)）。
- 文字入力：答えを入力し、正解かどうかで遷移先を変えます（[文字入力](#help/choice.answer)）。

## choice.label | 文言

@legacy scene/edge

ボタンに表示する文言です。式（`${name}` など）も使えます。

## choice.to | 遷移先

@legacy scene/edge, scene/edge_common
@related choice.randomCacheDays, scene.id

進む先のシーン ID です。

- `90000` は「戻る」（一つ前のシーンへ戻る）です。
- ランダムでは、カンマ区切りで複数の ID を並べます。そのときどきでランダムに一つを選びます。同じ ID を重ねると選ばれやすくなります。

## choice.randomCacheDays | 結果を保持する日数

@legacy scene/edge_common
@related choice.to
@mark 変更: 旧形式では遷移先の末尾に `;2` のように書いていました。
@mark 未実装: 旧エンジンは Cookie（`stext_cache_…`）で保持していましたが、新しいプレイヤーと試遊はまだ保持の仕組みを渡していないため、毎回ランダムに選びます。

ランダムの結果を保持する日数です。たとえば 2 なら、2日のあいだ最初に選ばれた遷移先が変わりません。

## choice.if | 表示条件

@legacy scene/edge, scene/edge_flow
@related condition

この選択肢を表示する条件です。空なら常に表示します。書き方は [条件の書き方](#help/condition) を見てください。下の「フラグ…」「アイテム…」などから、定義済みの ID を差し込めます。

## choice.cast | 唱える魔法

@legacy scene/edge_common
@related condition.magic
@mark 変更: 旧版は「魔法の条件（`mHEAL`）の選択肢で移動すると自動で星を減らす」としていました。stext/2 では、星を消費する魔法をこの欄で明示します（旧形式からの変換では自動で入ります）。

選んだときに唱える魔法の名前です（`HEAL` など。カンマ区切りで複数）。選ぶと、その魔法に必要な星を消費します。星が足りなければ進めません。

## choice.before | 選択肢の前に出す文章

@related scene.afterText

この選択肢の直前に表示する文章です。旧形式で選択肢のあいだに書かれていた文章は、ここに入ります。

## choice.jump | 番号入力

@legacy scene/edge_common
@related choice.kind
@mark 要確認: 旧版は「番号入力の選択肢はシーンに一つしか置けない」としていました。stext/2 で複数置いたときの動きは確かめていません。

シーン番号を入力して移動する選択肢です。「移動できる番号」に、入力してよいシーン ID をカンマ区切りで並べます。旧形式の `[10,11,12](X)` に当たります。

## choice.answer | 文字入力

@legacy scene/edge_common
@related choice.kind
@mark 要確認: 旧版は「文字入力の選択肢はシーンに一つしか置けない」としていました。stext/2 で複数置いたときの動きは確かめていません。

答えを入力させる選択肢です。「正解」と同じ文字が入力されたら「正解のとき」へ、そうでなければ「不正解のとき」へ進みます。旧形式の `[グーラン,11,12](Q)` に当たります。

## scene.afterText | 選択肢の後ろの文章

@related choice.before

選択肢の下に表示する文章です。

## scene.effects | シーンに入ったときの効果

@related effects.items, effects.flags, effects.params, effects.hp, effects.str, effects.free1, effects.stars, effects.state, effects.result, effects.max
@mark 変更: 旧形式ではシーンの属性（`items`、`hp` など）に書いていました。stext/2 では `effects` にまとまっています。

そのシーンに入ったときに、アイテム・フラグ・ステータスなどを変えます。

## effects.items | アイテム

@legacy scene/items
@related items, effects.params

そのシーンに入ったときに手に入るアイテムです。

- カンマ区切りで複数書けます。
- `-i01` で、そのアイテムを失います。

### アイテムの個数

- `i01:5` で個数付きにできます（i01 を 5 個増やす）。内部では個数用のパラメーター `pi01` を使います。
- `i01:@3`（3個にする）、`i01:-2`（2個減らす）のように、[パラメーター](#help/effects.params) と同じ書き方ができます。
- 個数が 0 になると、アイテムを失います。個数付きのアイテムに `-i01` を使ってはいけません。
- 個数を持つアイテムは、使えるアイテム（[使うと作用](#help/items.target) あり）にしてください。

## effects.flags | フラグ

@legacy scene/flags
@related flags, flags.hidden

そのシーンに入ったときに立つフラグです。カンマ区切りで複数書けます。`-f01` でフラグを消します（消せるのは [隠しフラグ](#help/flags.hidden) だけです）。

## effects.params | パラメーター

@legacy scene/params
@related params

そのシーンに入ったときに増減するパラメーターです。

- `p01:10`：p01 を 10 増やす
- `p01:-10`：p01 を 10 減らす
- `p01:@10`：p01 を 10 にする
- `p02:Rio`：p02 を文字列「Rio」にする
- カンマ区切りで複数書けます（`p01:10, p02:Rio`）。

## effects.stars | 星

@legacy scene/stars
@mark 変更: stext/2 では数の配列（`[1, 0, 0, 0, 0, 0, -1]`）か `"div2"` です。Playground ではカンマ区切りで入力します。

そのシーンに入ったときに増減する〈七惑星の欠片〉です。

- 月・火星・水星・木星・金星・土星・太陽の順に、7つの数をカンマ区切りで書きます（途中を省略しない）。
  - 負の数も書けます。減らした結果が負になると 0 にします。シナリオの中で矛盾しないようにしてください。
- `div2` のように書くと、すべての星を 1/2 にします（小数点以下は切り捨て）。

## effects.hp, effects.mp | HP・MP

@legacy scene/hp_mp

そのシーンに入ったときに増減する HP・MP です。

- `-5`、`5`：その分だけ増減
- `-10..-1`：範囲内の乱数だけ増減
- `full`：最大値にする
- `half`：最大値の半分にする

最大値を超えた分は切り捨てます。

## effects.str, effects.int, effects.dex, effects.krm | 能力値（STR・INT・DEX・KRM）

@legacy scene/status

そのシーンに入ったときに増減する STR、INT、DEX、KRM です。

- `-5`、`5`：その分だけ増減
- `@5`：その値にする
- `full`：初期値に戻す（勧めません）

## effects.free1, effects.free2, effects.free3 | FREE1〜3

@legacy scene/free
@related meta.labels

そのシーンに入ったときに増減する FREE1〜3 です。

- `-5`、`5`：その分だけ増減
- `-10..-1`：範囲内の乱数だけ増減
- `@5`：その値にする

## effects.state | 状態異常

@legacy scene/state

そのシーンに入ったときに、状態異常にしたり治したりします。

- poison（毒）／frozen（凍結）／stone（石化）／curse（呪い）／forget（忘却）
- 先頭に `-` を付けると治します（例：`-poison`）
- `-all` ですべて治します

## effects.result | 実績

@legacy scene/result
@related results

そのシーンに入ったときに得る実績です。一つだけ書けます。

## effects.max | 最大値・初期値の増減

@mark 未実装: Playground にはまだ入力欄がありません。JSON に直接書いてください。

そのシーンに入ったときに、HP・MP の最大値や STR〜KRM の初期値を増減します（旧形式の `hp_max` など）。

```
"effects": { "max": { "hp": 10, "str": "1..5" } }
```

## scene.enemies | 敵

@legacy scene/enemies
@related enemies, scene.dice, scene.rule

そのシーンに出てくる敵・罠の ID です。プレイ画面の下に敵の一覧を出し、戦闘画面で使います。

カンマ区切りで複数書けます。同じ ID を繰り返すと、その数だけ出てきます。

## scene.dice | ダイス

@legacy scene/dice
@related scene.enemies, enemies.func

そのシーンの戦闘画面で使うダイスを「種類:個数」で書きます。たとえば `10:5` で 10面ダイスを5個表示します（指定しなければ `6:2`）。

- 種類は数か名前で書きます。
  - 数：ダイスの最大の目（1〜20）
  - 名前：high（4、5、6 だけ）、cheat_h（6 が出やすい）、cheat_l（1 が出やすい）
- 個数は 2〜5 です。

## scene.end | エンディング

@legacy scene/end
@related meta.bgm.happy, scene.nexts
@mark 変更: stext/2 ではグッドエンド（`good`）が増えました。
@mark 変更: 旧版の「セーブデータを初期化する」は、新しいプレイヤーでは「冒険を終えた状態にする（次は新しいキャラクターで始める）」です。

そのシーンがエンディングかどうかです。エンディングのシーンに着くと冒険を終えます。

- happy（ハッピーエンド。ボーナスアイテムを一つ得る）
- bad（バッドエンド。低い確率でボーナスアイテムを得る）
- good（グッドエンド。曲はハッピーエンドのもの）

## scene.nexts | 続編（シナリオ ID）

@legacy scene/nexts
@related scene.end, items.shared, misc.savedata

いまのシナリオのセーブデータを、指定したシナリオに引き継ぎます。何本かのシナリオで一つの物語を作るための機能です。

引き継ぎ先のシナリオ ID をカンマ区切りで書きます（`scepter, zero, hero` など）。[エンディング](#help/scene.end) のシーンでだけ働きます。何を引き継ぐかは [セーブデータの構造](#help/misc.savedata) を見てください。

引き継いだ続編では、シーン 0 の効果は使われません。セーブデータに初期値を与えたいときは、シーン 1（次のシーン）などで設定してください。

## scene.bgm | BGM

@legacy scene/bgm
@related common.bgm, meta.bgm.main, scene.end
@mark 変更: stext/2 では、空の文字列（`""`）でメインテーマに戻せます。

そのシーンに入ったときに、指定した曲に切り替えます。書き方は [BGM の指定方法](#help/common.bgm) と同じです。

エンディングのシーンで BGM も指定したときは、BGM の曲を優先します。

## scene.se | 効果音

@legacy scene/se
@mark 変更: 置き場所（シナリオのフォルダーの `bgm/se/`）を書き足しました。

そのシーンに入ったときに、指定した効果音を鳴らします。`se.mp3` なら `se` と書きます。ファイルはシナリオのフォルダーの `bgm/se/` に置きます。

## scene.rule | 戦闘ルールのシーン

@legacy scene/rule
@related groups.rule, scene.id

戦闘画面に表示するルールの文を、シーン ID で指定します。

指定しなければ、[グループの戦闘ルール](#help/groups.rule)（敵がいるシーンのみ）か、ID が `99999` のシーンを表示します。

## scene.excludeFooter | 共通フッター

@legacy scene/exclude
@related meta.footerScene
@mark 変更: 旧形式の `exclude="true"` は `"excludeFooter": true` になりました。

チェックすると、このシーンには [共通フッターのシーン](#help/meta.footerScene) を付けません。

## scene.editor.color | フロー図の色

@legacy scene/color
@mark 変更: 旧形式の `color` は `editor.color` になりました（エディター専用の情報で、プレイヤーは使いません）。

フロー図でシーンに付ける色です（`#c0473a` など）。

# 条件の書き方

## condition | 条件の書き方

@legacy scene/edge_common, scene/edge_flow
@related condition.flag, condition.param, condition.magic, condition.stat, condition.chara, condition.stars, condition.result, condition.elapsed, condition.fn, text.if
@mark 変更: 旧版の「複合条件を使うときは本文を `<![CDATA[…]]>` で囲む」は XML 形式の話なので、stext/2 では不要です。

選択肢の表示条件や `${if …}` には、フラグやアイテムなどの条件を書けます。条件を満たすときだけ表示します。

| 書き方                  | 意味                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `f01`／`!f01`           | フラグがある／ない（[フラグとアイテム](#help/condition.flag)） |
| `p01:10`                | パラメーター（[パラメーター](#help/condition.param)）          |
| `mHEAL`                 | 魔法を使える（[魔法](#help/condition.magic)）                  |
| `oHP50`                 | ステータス（[ステータス](#help/condition.stat)）               |
| `xFIGHTER`              | キャラクターの情報（[キャラクター](#help/condition.chara)）    |
| `s7:7:7:7:7:7:7`／`s49` | 星（[星](#help/condition.stars)）                              |
| `r01:scepter`           | 実績（[実績](#help/condition.result)）                         |
| `e15`                   | 経過シーン数（[経過シーン数](#help/condition.elapsed)）        |
| `fn:rand(40)`           | 関数（[関数](#help/condition.fn)）                             |

### 組み合わせ

次の記号で組み合わせられます。優先順位は `!` → `&` → `|` で、カッコで囲んだところが最優先です。

- `!`（でない）
- `&`（かつ）
- `|`（または）

| 例               | 意味                                    |
| ---------------- | --------------------------------------- |
| `!f03`           | f03 がない                              |
| `f01&f02&i01`    | f01、f02、i01 がすべてある              |
| `f01\|f02\|i01`  | f01、f02、i01 のどれかがある            |
| `!(f01&f02&i01)` | f01、f02、i01 のどれかがない            |
| `f01&(f02\|i01)` | f01 があり、f02 か i01 のどちらかがある |
| `f01&!f02&i01`   | f01 と i01 があり、f02 がない           |

カンマ区切り（`f01,f02`）は「すべて」、先頭の `-`（`-f01,f02`）は全体の否定です。カンマ区切りの途中に `-` は書けません（`f01&!f02` と書きます）。

stext/2 の JSON では、条件を構造化した形（条件 AST）でも書けます。詳しくは docs/scenario-format.md を見てください。

## condition.flag | 条件：フラグとアイテム

@legacy scene/edge_common
@related flags, items

| 書き方         | 意味                   | 例     |
| -------------- | ---------------------- | ------ |
| フラグ ID      | フラグがある           | `f01`  |
| `!`フラグ ID   | フラグがない           | `!f01` |
| アイテム ID    | アイテムを持っている   | `i01`  |
| `!`アイテム ID | アイテムを持っていない | `!i01` |

## condition.param | 条件：パラメーター

@legacy scene/edge_common
@related params

| 書き方      | 意味           | 例         |
| ----------- | -------------- | ---------- |
| ID`:`値     | 値以上         | `p01:10`   |
| `!`ID`:`値  | 値未満         | `!p01:10`  |
| ID`:@`値    | 値と等しい     | `p01:@10`  |
| `!`ID`:@`値 | 値と等しくない | `!p01:@10` |

文字列と比べるときは常に「等しい」なので、`@` は不要です（`p02:Rio`）。

## condition.magic | 条件：魔法

@legacy scene/edge_common
@related choice.cast

| 書き方     | 意味                                           | 例       |
| ---------- | ---------------------------------------------- | -------- |
| `m`魔法名  | 魔法を使える（星が足りていて、呪われていない） | `mHEAL`  |
| `!m`魔法名 | 魔法を使えない                                 | `!mHEAL` |

選んだときに星を消費させるには、選択肢の [唱える魔法](#help/choice.cast) も指定します。

## condition.stat | 条件：ステータス

@legacy scene/edge_common
@mark 変更: 旧版は `oHP50+`（より大きい）、`oHP50-`（より小さい）などを「非推奨」として打ち消し線で示していました。stext/2 でも読めますが、`oHP50` の形を使ってください。

| 書き方      | 意味   | 例       |
| ----------- | ------ | -------- |
| `o`種類 値  | 値以上 | `oHP50`  |
| `!o`種類 値 | 値未満 | `!oHP50` |

種類には STR、INT、DEX、KRM、HP、MP、FREEI、FREEII、FREEIII を書けます。

## condition.chara | 条件：キャラクター

@legacy scene/edge_common
@mark 誤り: 旧版は状態異常の値を「POINSON」と書いていました。正しくは POISON です。

| 書き方   | 意味       | 例         |
| -------- | ---------- | ---------- |
| `x`情報  | 一致する   | `xFIGHTER` |
| `!x`情報 | 一致しない | `!xのうふ` |

情報には次のものを書けます。

- 種族（FIGHTER／WIZARD／DWARF／ELF）
- 性別（MALE／FEMALE）
- 年齢帯（YOUNG／ADULT／OLD）
- 状態異常（POISON／FROZEN／STONE／CURSE／FORGET）
- 職業（のうふ、こじき など。ひらがな／カタカナ）

## condition.stars | 条件：星

@legacy scene/edge_common
@mark 誤り: 旧版は「どれかが指定数未満」の例を `s7:7:7:7:7:7:7` としていました（`!` が抜けていました）。

| 書き方            | 意味                         | 例                |
| ----------------- | ---------------------------- | ----------------- |
| `s`月`:`…`:`太陽  | それぞれの星を指定数以上持つ | `s7:7:7:7:7:7:7`  |
| `!s`月`:`…`:`太陽 | どれかの星が指定数未満       | `!s7:7:7:7:7:7:7` |
| `s`総数           | 星の総数が指定数以上         | `s49`             |
| `!s`総数          | 星の総数が指定数未満         | `!s49`            |

## condition.result | 条件：実績

@legacy scene/edge_common
@related results

| 書き方                   | 意味                           | 例             |
| ------------------------ | ------------------------------ | -------------- |
| 実績 ID`:`シナリオ ID    | そのシナリオの実績を持っている | `r01:scepter`  |
| `!`実績 ID`:`シナリオ ID | 持っていない                   | `!r01:scepter` |

実績はずっと残ります（冒険を始め直しても消えません）。一度実績を得ると、ストレージを消さない限り「実績を持っていないとき」の選択肢は二度と表示されません。

## condition.elapsed | 条件：経過シーン数

@legacy scene/edge_common
@mark 誤り: 旧版は「指定値を超えた場合」としていましたが、旧エンジン・新エンジンとも「指定値以上」で判定します。

| 書き方       | 意味                     | 例     |
| ------------ | ------------------------ | ------ |
| `e`シーン数  | 経過シーン数が指定値以上 | `e15`  |
| `!e`シーン数 | 経過シーン数が指定値未満 | `!e15` |

## condition.fn | 条件：関数

@legacy scene/edge_common
@mark 変更: 旧版は「α版」としていました。新しいエンジンは4つの関数すべてを旧エンジンと同じ結果で判定します。

`fn:関数名(引数,…)` で特別な条件を書けます。

- `fn:rand(40)`：40％ の確率で真
- `fn:include(2,f01,f02,f03)`：f01〜f03 のうち 2 つ以上あれば真（アイテムも書けます）
- `fn:range(str,5,10)`：STR が 5 以上 10 未満なら真。書けるキーは次のとおり
  - ステータス（hp、mp、str〜krm、free1〜3）
  - パラメーター（p01 など）
  - 経過シーン数（e）
- `fn:cycle(15,5,1)`：経過シーン数を 15 ごとに区切り、それを 5 ずつに分けたときの 1 番目（1〜5、16〜20…）なら真

# そのほか

## misc.savedata | セーブデータの構造

@legacy scene/nexts
@related scene.nexts, items.shared
@mark 誤り: 旧版は STR〜KRM の初期値（`str_i` など）を「未使用」としていましたが、`full`（初期値に戻す）で使っています。

セーブデータはシナリオを始めるときに作られ、シナリオごとの情報を持ちます。保存のキーはシナリオ ID です。★の項目は [続編](#help/scene.nexts) に引き継ぎません（items は [続編に持ち越す](#help/items.shared) アイテムだけ引き継ぎます）。

```
├─ chara ……… キャラクター
│   ├─ title / name / race / sex / age / job
│   ├─ state ………… 状態異常
│   ├─ stone_scene / forget_scene … 石化・忘却の経過シーン数
│   ├─ hp_m / hp / mp_m / mp … HP・MP の最大値と現在値
│   ├─ str_i / str … STR の初期値と現在値（INT・DEX・KRM も同じ）
│   └─ free1 / free2 / free3
├─ stars ……… 星の欠片（月〜太陽の数の配列）
├─ items ……… 持っているアイテム ★
├─ flags ……… 立っているフラグ ★
├─ params …… パラメーター ★
├─ memos …… 冒険メモ
├─ scene …… いまのシーン ★
├─ ellapsed_scene … 経過シーン数 ★
├─ bgm ……… 再生中の BGM（空ならメインテーマ）★
├─ bonus …… 適用中のボーナスアイテム
└─ isEnded … エンディングに着いたか ★
```

シナリオをまたいで共有するグローバルセーブデータ（キー `sorcerian_text`）もあります。

```
├─ items …… ボーナスアイテム（シナリオ共通で増えていく）
├─ results … 実績（シナリオ ID ごとの一覧）
├─ panel …… コントロールパネルを表示するか
└─ bgm ……… BGM を鳴らすか
```

# 移行しなかった項目

## legacy.fixed | シャッフル除外

@legacy scene/fixed
@mark 廃止: シーン ID のシャッフルは新しい Playground では作らなかったので、この項目もありません（stext/2 にもありません）。

旧 Playground で、シーン ID をシャッフルするときに、そのシーンを対象から外す指定でした。
