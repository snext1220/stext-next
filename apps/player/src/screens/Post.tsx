import { ASSET_BASE, PLAYGROUND_URL, siteImageUrl } from '../config.js';
import { MANUALS, POST_THREAD, SCENARIO_FORMAT_DOC, SOUNDTRACKS } from '../links.js';
import { href } from '../router.js';
import { DocPage, DocSection, ExtLink, type DocChapter } from './Doc.js';

const CHAPTERS = {
  create: { id: 'create', title: 'シナリオを作る' },
  submit: { id: 'submit', title: '投稿の手順' },
  folder: { id: 'folder', title: 'zip の中身' },
  recruit: { id: 'recruit', title: '募集中の企画' },
  materials: { id: 'materials', title: '制作者向けの素材' },
} satisfies Record<string, DocChapter>;

const FOLDER = `stext/ ……………………… シナリオのフォルダー
├─ scenario.json ……… シナリオ本体（Playground で保存したファイル）
├─ capture/ …………… 挿絵
│   ├─ intro.png …… 書庫で紹介する画像（120×180px）
│   └─ xxxxx.png …… 本文の画像（100KB 目安）
├─ bgm/ ………………… 独自の BGM（xxxxx.mp3、1MB 目安）
│   └─ se/ ………………… 独自の効果音（xxxxx.mp3、30KB 目安）
└─ chara/ ……………… 独自のキャラクター画像（100×100px。使うときだけ）`;

const RECRUITS: {
  title: string;
  banner: string;
  closed?: boolean;
  body: string[];
  wiki?: string;
}[] = [
  {
    title: 'SText 3周年＆30シナ到達記念！連作「幕末ソーサリアン」',
    banner: 'banner/baku.png',
    body: [
      'ソーサリアン原作33周年＋ソーサリアン Text 3周年を記念した連作シナリオです。日本の幕末を舞台に、土方歳三などの歴史上の有名人をはじめ、原作「ピラミッドソーサリアン」からも懐かしのメンバーが登場します。',
      '幕末をテーマにシナリオを書いてくださる方も募集しています。興味のある方は、ぜひお声がけください。',
    ],
    wiki: 'https://github.com/snext1220/snext-management/wiki/%E9%80%A3%E4%BD%9C%E3%80%8C%E5%B9%95%E6%9C%AB%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%E3%80%8D%E5%9F%B7%E7%AD%86%E8%80%85%E5%8B%9F%E9%9B%86',
  },
  {
    title: 'Playground でゲームブック執筆に挑戦「Playground100祭」',
    banner: 'banner/pg100.png',
    body: [
      'Playground を使って、100パラグラフ前後の中編を作ってみよう！という企画です。シーンをフロー図の上でつなぎながら、あなたのアイデアを形にしてみてください（Playground への要望も大歓迎です）。',
      '投稿するときは、シナリオのタイトルの後ろに「（プレグラ100）」と書き添えてください。',
    ],
    wiki: 'https://github.com/snext1220/stext/wiki/Playground-Flow%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9%E8%A8%98%E5%BF%B5%E4%BC%81%E7%94%BB%E3%80%8C%E3%83%97%E3%83%AC%E3%82%B0%E3%83%A9100%E7%A5%AD%E3%80%8D%E5%9F%B7%E7%AD%86%E8%80%85%E5%8B%9F%E9%9B%86%EF%BC%81',
  },
  {
    title: '手軽に思いつきを形に「ミニミニ30祭」',
    banner: 'banner/mini30.png',
    body: [
      '「ゲームブックを作るのって難しくない？」と二の足を踏んでいる方にお勧めの企画です。パラグラフの上限は30。その中で、ちょっとした物語を描いてみませんか。出オチでも、一発ネタでも、ワンカットの短編でも。いっそ、未完の物語の「ここだけは！」という小さな断片でも、まったくかまいません！',
      '投稿するときは、シナリオのタイトルの後ろに「（ミニ30）」と書き添えてください。',
    ],
  },
  {
    title: 'いつでも、いつまでも募集中！「一般シナリオ」',
    banner: 'banner/begin.png',
    body: [
      '制約もルールもまったくない一般シナリオは、いつでも募集しています。書庫には、20パラグラフちょっとのミニシナリオから500以上の超力作まで、テーマもお気楽な日常ものから本格的な探索、シリアスもの、時代物まで、さまざまなシナリオがそろっています。',
      '気張らず、アイデアを自由に形に、が SText のモットーです。かしこまらずに創作を楽しんでいただければ（そして、あわよくば投稿していただければ）、開発者としてはとても嬉しいのです。',
    ],
  },
  {
    title: 'SText 1周年＆15シナ到達記念！連作「ドラゴンモード」',
    banner: 'banner/dragon.png',
    closed: true,
    body: [
      'ソーサリアン原作31周年＋ソーサリアン Text 1周年に向けた連作シナリオです。本編の募集は終了しました。',
      '「こんなドラゴンも書いてみたい」「本編に触発されてスピンオフを」という方の、外伝的なシナリオは大歓迎です。投稿するときは、シナリオのタイトルの後ろに「（ドラモード）」と書き添えてください。',
    ],
    wiki: 'https://github.com/snext1220/stext/wiki/%E9%80%A3%E4%BD%9C%E3%80%8C%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%89%E3%80%8D%E5%9F%B7%E7%AD%86%E8%80%85%E5%8B%9F%E9%9B%86%EF%BC%81',
  },
];

/** キャラ画像素材集（ときのじさん）。assets/common/face/ */
const FACES: [file: string, name: string][] = [
  ['adol', 'アドル'],
  ['adol2', 'アド・ルー'],
  ['darkfact', 'ダルク＝ファクト'],
  ['dogi', 'ドギ'],
  ['fredy', 'フレディ王子'],
  ['kubla', 'クーブラ＝カーン'],
  ['rando', 'ランドー'],
  ['anna', 'アンナ'],
  ['orther', 'オーサー'],
  ['guran', 'グーラン'],
  ['venus', 'ビヌス'],
  ['bob', 'ボブ'],
  ['male_young_fighter2', 'ヤングファイター男2'],
  ['male_young_fighter3', 'ヤングファイター男3'],
  ['male_young_fighter4', 'ヤングファイター男4'],
  ['male_adult_fighter2', '中年ファイター男'],
  ['male_adult_dwarf2', 'アダルトドワーフ男'],
  ['female_young_elf2', 'ヤングエルフ女2'],
  ['female_young_elf3', 'ヤングエルフ女3'],
  ['female_young_elf4', 'ヤングエルフ女4'],
  ['female_young_wizard2', 'ヤングウィザード女'],
  ['pentawa_chara', 'ノーム'],
  ['hero_chara', 'ポーラス'],
  ['hero_chara2', 'グリメルム'],
];

/** 投稿：シナリオの作り方と投稿の手順、募集中の企画、制作者向けの素材（旧サイトの作品投稿・募集企画・For Creator） */
export function Post({ section }: { section?: string }) {
  return (
    <DocPage
      page="post"
      section={section}
      eyebrow="Post"
      title="シナリオを投稿する"
      lede="ソーサリアン Text は、プレイヤーの皆さん一人ひとりが物語を紡ぎ、世界を創るプラットフォームです。新しいシナリオを、いつでも、いつまでも（！）募集しています。"
      chapters={Object.values(CHAPTERS)}
    >
      <DocSection page="post" chapter={CHAPTERS.create} eyebrow="Create" seed={53}>
        <p>
          皆に遊んでもらえるシナリオを手軽に形にしたい――と常々思っている方は、まずは SText
          で挑戦してみてはいかがでしょう。シナリオを書くための道具、資料、音楽素材などをそろえてお待ちしています。
        </p>
        <h3>Playground で書く</h3>
        <p>
          Playground
          は、ブラウザーで動くシナリオの編集環境です。インストールは要りません。シーンをフロー図の上でつなぎ、つなぎ替えながら、ゲームブックの流れを組み立てられます。フラグやアイテム、敵などは「定義」のタブで編集できます。書いたシナリオは、「試遊」のタブでその場で遊べます。
        </p>
        <p>
          テンプレートや公開中のシナリオを開いて、書き方を真似するところから始めるのもお勧めです。各欄の「？」から、書き方の説明（ヘルプ）を読めます。
        </p>
        <div className="end-actions">
          <a className="btn" href={PLAYGROUND_URL} target="_blank" rel="noopener noreferrer">
            Playground を開く
          </a>
          <a className="btn ghost" href={href({ name: 'post', section: 'materials' })}>
            素材と資料を見る
          </a>
        </div>
        <h3>旧形式のシナリオ</h3>
        <p>
          旧 Playground（Playground Flow／Editor）や旧形式（scenario.xml）で書いたシナリオは、「
          <a href={href({ name: 'convert' })}>変換所</a>
          」で新しい形式（stext/2）に変換して、そのまま遊んだり保存したりできます。保存したファイルは
          Playground で開いて、続きを書けます。
        </p>
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.submit} eyebrow="Submit" seed={59}>
        <ol className="doc-steps">
          <li>
            Playground
            でシナリオを書き、「試遊」で最後まで遊べるか確かめます。「検査」のタブに出た問題も直しておきましょう。
          </li>
          <li>
            ツールバーの「保存（JSON）」でシナリオをファイルに保存し、ファイルの名前を{' '}
            <code>scenario.json</code> に変えます。
          </li>
          <li>
            挿絵や独自の BGM があれば、「
            <a href={href({ name: 'post', section: 'folder' })}>zip の中身</a>
            」の形でフォルダーにまとめ、.zip に圧縮します。
          </li>
          <li>
            GitHub Discussions
            の投稿スレッドを開き、そこに載っているテンプレートに沿って必要な情報を書いて、スレッドへの返信として投稿します。.zip
            は、入力欄にドラッグ＆ドロップすると添付できます（GitHub のアカウントが必要です）。
          </li>
          <li>管理者が確認したあと、書庫に公開されます。公開まで、しばらくお待ちください。</li>
        </ol>
        <div className="end-actions">
          <a className="btn" href={POST_THREAD} target="_blank" rel="noopener noreferrer">
            GitHub から投稿する（要ログイン）
          </a>
        </div>
        <p className="doc-small">
          ※ 旧 Playground Flow
          にあった、編集画面から直接投稿する機能（［シナリオを投稿］ボタン）はありません。
        </p>
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.folder} eyebrow="Folder" seed={61}>
        <p>.zip は、次のフォルダー構成で作ってください。使わないフォルダーは要りません。</p>
        <pre className="doc-tree" aria-label="zip のフォルダー構成">
          {FOLDER}
        </pre>
        <ul>
          <li>
            SText の標準の BGM（<code>@field05</code>{' '}
            のように指定する曲）と効果音は、同梱しなくてかまいません。
          </li>
          <li>
            <code>intro.png</code> は、書庫の一覧と詳細に表示する、シナリオの顔となる画像です。
          </li>
          <li>
            <code>chara/</code> は、キャラクターの画像をシナリオ独自のものにするときだけ使います（「
            <a href={href({ name: 'post', section: 'materials' })}>キャラ画像素材集</a>
            」を参照）。
          </li>
        </ul>
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.recruit} eyebrow="Recruit" seed={67}>
        <p>
          SText
          では、いつでもシナリオの投稿を募集しています。いくつかの企画も立ち上げているので、自分に合った企画に取り組んでみてくださいね。
        </p>
        {RECRUITS.map((r) => (
          <article key={r.title} className={'recruit' + (r.closed ? ' closed' : '')}>
            <img src={siteImageUrl(r.banner)} alt="" width={660} height={80} loading="lazy" />
            <h3>
              {r.title}
              {r.closed && <span className="pill">募集終了</span>}
            </h3>
            {r.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {r.wiki && (
              <p>
                詳しくは<ExtLink href={r.wiki}>募集 Wiki</ExtLink>を参照してください。
              </p>
            )}
          </article>
        ))}
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.materials} eyebrow="For Creator" seed={71}>
        <h3>BGM 素材（AZ さん）</h3>
        <p>
          SText の標準の BGM は、シナリオで自由に使えます。シーンの BGM に <code>@field05</code>{' '}
          のように、曲の名前に <code>@</code>{' '}
          を付けて指定するだけで、ファイルを同梱する必要はありません。どんな曲かは「
          <a href={href({ name: 'music' })}>音楽室</a>」で試聴できます。
        </p>
        <p>
          曲のファイルは SoundCloud
          でも公開しています（曲目の右端の［…］→［Download］からダウンロードできます）。
        </p>
        <ul>
          {SOUNDTRACKS.map((s) => (
            <li key={s.url}>
              <ExtLink href={s.url}>{s.title}</ExtLink>（{s.note}）
            </li>
          ))}
        </ul>
        <p className="doc-small">
          ※ SText 以外での利用は禁止とさせていただきます。ご了承ください。
        </p>

        <h3>キャラ画像素材集（ときのじさん）</h3>
        <p>
          プレイヤーキャラクターの画像は、シナリオごとに差し替えられます。自作の画像でもかまいませんが、「自作はちょっと……でも、いつもと雰囲気を変えてみたい！」という方のために、画像素材を集めました。画像を押すとダウンロードできます。
        </p>
        <p>
          差し替えるときは、シナリオの <code>meta.imageSet</code> を <code>&quot;custom&quot;</code>{' '}
          にして、<code>chara/</code> フォルダーに <code>性別_年齢_種族.png</code>（たとえば{' '}
          <code>male_young_fighter.png</code>
          ）の名前で画像を置きます。本文の挿絵（<code>capture/</code>）として使うこともできます。
        </p>
        <ul className="face-grid">
          {FACES.map(([file, name]) => (
            <li key={file}>
              <a href={`${ASSET_BASE}common/face/${file}.png`} download={`${file}.png`}>
                <img
                  src={`${ASSET_BASE}common/face/${file}.png`}
                  alt=""
                  width={100}
                  height={100}
                  loading="lazy"
                />
                <span>{name}</span>
              </a>
            </li>
          ))}
        </ul>

        <h3>書き方の資料</h3>
        <ul>
          <li>
            <ExtLink href={SCENARIO_FORMAT_DOC}>シナリオの形式（stext/2）の説明</ExtLink>
            ：シナリオのファイルを直接読み書きするときに。
          </li>
          <li>Playground のヘルプ：各欄の「？」から開けます。</li>
          <li>
            <ExtLink href={MANUALS.developer}>開発者向けマニュアル（目次）</ExtLink>・
            <ExtLink href={MANUALS.techniques}>開発者向け実践テクニック集</ExtLink>・
            <ExtLink href={MANUALS.playgroundFlow}>Playground Flow 編</ExtLink>
            ：旧サイトのころのマニュアルです。画面や記法が今とは違うところもありますが、シナリオ作りの考え方は今も参考になります。
          </li>
        </ul>
      </DocSection>
    </DocPage>
  );
}
