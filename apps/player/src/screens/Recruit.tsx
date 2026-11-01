import { siteImageUrl } from '../config.js';
import { DocPage, DocSheet, ExtLink } from './Doc.js';

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

/** 募集中の企画（旧サイトの募集企画） */
export function Recruit() {
  return (
    <DocPage
      page="recruit"
      eyebrow="Recruit"
      title="募集中の企画"
      lede="SText では、いつでもシナリオの投稿を募集しています。いくつかの企画も立ち上げているので、自分に合った企画に取り組んでみてくださいね。"
    >
      <DocSheet seed={67}>
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
      </DocSheet>
    </DocPage>
  );
}
