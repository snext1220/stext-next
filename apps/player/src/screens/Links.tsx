import { siteImageUrl } from '../config.js';
import { DocPage, DocSheet, ExtLink } from './Doc.js';

/** リリース当日からの反応をまとめた Twitter（現 X）のモーメント */
const MOMENTS = [
  '943472161229963265',
  '944744163085451264',
  '945920318736015361',
  '952115273322004480',
  '954892955159949313',
  '959575509179891712',
  '963438572295536640',
  '966488782445805568',
  '974316960065318913',
  '981685095055507458',
  '994401198315749376',
  '1005230213809299456',
  '1019928687909597184',
  '1034354366067564544',
  '1043817887129948160',
  '1061226852079960065',
  '1080659053842333697',
  '1083886324220715008',
  '1094469502664765440',
  '1102071513518239744',
  '1116360077047263238',
];

type Link = { text: string; url: string };

const RELEASE_LINKS: Link[] = [
  {
    text: 'ブラウザで遊べる『ソーサリアン』！『SORCERIAN Text』で『ソーサリアン』をゲームブック風に楽しもう！',
    url: 'http://www.cobalog.com/entry/sorcerian_text',
  },
  {
    text: 'Socerianの世界観をゲームブックで投稿する企画。ノンプログラマにはとにかく敷居が高いのでざっと説明してみます',
    url: 'http://blog.gamebook.xyz/entry/2017/12/22/060000',
  },
];

const COCOBLOG = 'http://cocoblog.en-grey.com/';
const BLOG_LINKS: { author: string; links: Link[] }[] = [
  {
    author: 'cocotori さん',
    links: [
      {
        text: 'ソーサリアンText企画、始動！',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3text%E4%BC%81%E7%94%BB%E3%80%81%E5%A7%8B%E5%8B%95%EF%BC%81`,
      },
      {
        text: '戦闘ルールについて',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E6%88%A6%E9%97%98%E3%83%AB%E3%83%BC%E3%83%AB%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6`,
      },
      {
        text: 'ドールズ、公開',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E3%83%97%E3%83%AC%E3%82%A2%E3%82%AA%E3%83%96%E3%83%BB%E3%83%89%E3%83%BC%E3%83%AB%E3%82%BA%E3%80%81%E5%85%AC%E9%96%8B`,
      },
      {
        text: '吸血鬼もの作成中',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E5%90%B8%E8%A1%80%E9%AC%BC%E3%82%82%E3%81%AE%E4%BD%9C%E6%88%90%E4%B8%AD`,
      },
      {
        text: 'ひとまず完成',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E3%81%B2%E3%81%A8%E3%81%BE%E3%81%9A%E5%AE%8C%E6%88%90`,
      },
      {
        text: 'もろもろ作業中',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E3%82%82%E3%82%8D%E3%82%82%E3%82%8D%E4%BD%9C%E6%A5%AD%E4%B8%AD`,
      },
      {
        text: '「鉄腕の吸血姫」公開',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%80%8C%E9%89%84%E8%85%95%E3%81%AE%E5%90%B8%E8%A1%80%E5%A7%AB%E3%80%8D%E5%85%AC%E9%96%8B`,
      },
      {
        text: '「わたしのネコを探して」公開',
        url: `${COCOBLOG}%E3%82%A8%E3%83%AC%E3%83%A1%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E3%83%BB%E3%83%A1%E3%83%B3%E3%83%90%E3%83%BC%E3%82%BA/%E3%82%A8%E3%83%AC%E3%83%A1%E3%83%B312%E7%AB%A0%EF%BC%9A%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AA%E3%83%BC%E8%A6%8B%E7%9B%B4%E3%81%973`,
      },
      {
        text: 'シナリオ考案中',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%EF%BC%9A%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA%E8%80%83%E6%A1%88%E4%B8%AD`,
      },
      {
        text: 'ドラゴンモード',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3text%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%89_399`,
      },
      {
        text: '導きソーサリアン',
        url: `${COCOBLOG}%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3/%E5%B0%8E%E3%81%8D%E3%82%BD%E3%83%BC%E3%82%B5%E3%83%AA%E3%82%A2%E3%83%B3%E3%80%81%E5%85%AC%E9%96%8B`,
      },
    ],
  },
  {
    author: 'ちゃなさん',
    links: [
      {
        text: 'ソーサリアンTEXTに投稿しました（その1）',
        url: 'http://chanagame.hateblo.jp/entry/2018/01/16/072351',
      },
      { text: '（その2）', url: 'http://chanagame.hateblo.jp/entry/2018/01/20/234259' },
      {
        text: '「ドラゴンモード」予告',
        url: 'http://chanagame.hateblo.jp/entry/2019/01/07/213232',
      },
      { text: '金竜の陰謀', url: 'http://chanagame.hateblo.jp/entry/2019/03/25/233607' },
      { text: '金竜・制作秘話', url: 'http://chanagame.hateblo.jp/entry/2019/04/03/212651' },
      { text: 'キングドラゴン戦', url: 'http://chanagame.hateblo.jp/entry/2019/07/28/225425' },
      { text: '不思議のソーサリアン', url: 'http://chanagame.hateblo.jp/entry/2020/05/03/000216' },
      { text: '制作実況中継', url: 'http://chanagame.hateblo.jp/entry/2020/07/11/195800' },
      {
        text: 'ソーサリアベンジャーズ！',
        url: 'http://chanagame.hateblo.jp/entry/2020/10/25/231925',
      },
      { text: 'STカードバトル', url: 'http://chanagame.hateblo.jp/entry/2021/04/11/002057' },
    ],
  },
  {
    author: '咲華さん',
    links: [
      {
        text: 'stext「黄泉へと送るレクイエム」公開です！',
        url: 'http://tiolight.hatenadiary.jp/entry/2019/02/28/221359',
      },
      {
        text: 'STextの「黄泉へ送るレクイエム」備考録１',
        url: 'http://tiolight.hatenadiary.jp/entry/2019/01/08/234708',
      },
      {
        text: '出店予定報告ですっ！',
        url: 'http://tiolight.hatenadiary.jp/entry/2018/12/28/235109',
      },
      { text: '今年度のお礼', url: 'https://tiolight.hatenadiary.jp/entry/2020/03/18/005603' },
    ],
  },
];

const OTHER_LINKS: Link[] = [
  {
    text: 'ゲームブックを語る夕べpart56（446付近）',
    url: 'https://mevius.5ch.net/test/read.cgi/gsaloon/1487646592',
  },
  {
    text: '俺らね、PLAYS(TAT)ION3はｺｹると思うよ。避難所スレ3294（825付近）',
    url: 'https://jbbs.shitaraba.net/bbs/read_archive.cgi/computer/22593/1513590447/l50',
  },
  {
    text: 'Google+ - ソーサリアン Text',
    url: 'https://plus.google.com/+YasunoriWATANABE/posts/M7jVi4rt34f',
  },
  {
    text: 'ゲームブック作成ツール集！ - ソーサリアンText',
    url: 'http://game-book.seesaa.net/article/458524956.html',
  },
  {
    text: 'ゲームブック作成.wiki',
    url: 'https://seesaawiki.jp/gamebook/d/%a5%bd%a1%bc%a5%b5%a5%ea%a5%a2%a5%f3Text',
  },
];

/** 関連リンク：SText に寄せていただいた反応や紹介 */
export function Links() {
  return (
    <DocPage
      page="links"
      eyebrow="Link"
      title="関連リンク"
      lede="SText に寄せていただいた反応や、ゲスト作者さん、スタッフによる紹介などを、この場を借りてまとめました。管理人が気付いたものだけなので、漏れがあれば「こんな紹介もした／あったよ！」のような自薦・他薦も大歓迎です。"
    >
      <DocSheet seed={47}>
        <h3>リリース当日の様子</h3>
        <img
          className="doc-float"
          src={siteImageUrl('link/stext.png')}
          alt="30周年記念作品"
          loading="lazy"
        />
        <p>
          2017年12月20日、ソーサリアン Text
          はこの世に生まれました。当日からの様子は、Twitter（現在の
          X）のモーメントにまとめています（いまは見られないものもあります）。ブログでまとめてくださった皆さま共々、盛り上げていただいて、ありがとうございました。
        </p>
        <ul>
          <li>
            当日の反応（モーメント）：
            {MOMENTS.map((id, i) => (
              <span key={id}>
                {i > 0 && '・'}
                <ExtLink href={`https://twitter.com/i/moments/${id}`}>{i + 1}</ExtLink>
              </span>
            ))}
          </li>
          {RELEASE_LINKS.map((l) => (
            <li key={l.url}>
              <ExtLink href={l.url}>{l.text}</ExtLink>
            </li>
          ))}
        </ul>
        <h3>スタッフ／ゲスト作者さんのブログより</h3>
        <img
          className="doc-float"
          src={siteImageUrl('link/staff.png')}
          alt="「鉄腕の吸血姫」より"
          loading="lazy"
        />
        <p>
          スタッフやゲスト作者さんのブログでも、SText
          を取り上げていただきました。作品の裏話などもあるので、ご興味のある方はぜひ。
        </p>
        <ul>
          {BLOG_LINKS.map((b) => (
            <li key={b.author}>
              {b.author}：
              {b.links.map((l, i) => (
                <span key={l.url}>
                  {i > 0 && '／'}
                  <ExtLink href={l.url}>{l.text}</ExtLink>
                </span>
              ))}
            </li>
          ))}
        </ul>
        <h3>そのほかにも、さまざまに紹介していただきました</h3>
        <p>
          掲示板や Wiki
          などでも紹介していただきました。残念ながらリンク切れになっているものもありますが、感謝の意味を込めて、リンクだけ残しています。
        </p>
        <ul>
          {OTHER_LINKS.map((l) => (
            <li key={l.url}>
              <ExtLink href={l.url}>{l.text}</ExtLink>
            </li>
          ))}
        </ul>
        <h3>起源（オリジン）、そして更なる展開（ステージ）へ</h3>
        <p>
          2013年のエイプリルフール企画「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/">SORCERIAN Next</ExtLink>
          」のページと、さらに遡って、Next の起源となった iOS
          版ソーサリアンのシナリオコンテストの作品をまとめたブログ「
          <ExtLink href="https://sorcerian.hateblo.jp/">新時代のソーサリアンを提案する</ExtLink>
          」です。SText の起源とも言える（？）過去の作品も、併せてご覧ください。
        </p>
        <p>
          Next チームでは、SText のあとも「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/allabout.aspx">
            All About 計画
          </ExtLink>
          」の名のもとで、ソーサリアン関連の創作を続けています。2020～21年の MV
          ツクール版ソーサリアン「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/2020">SORCERIAN Next 2020</ExtLink>
          」を手始めに、さまざまな創作（とそのプラットフォーム）を試行錯誤していきます！
        </p>
        <a
          className="doc-banner-link"
          href="https://www.web-deli.com/sorcerian/next/2020"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={siteImageUrl('link/sn2020_banner_2.png')}
            alt="SORCERIAN Next 2020"
            width={180}
            height={180}
            loading="lazy"
          />
        </a>
      </DocSheet>
    </DocPage>
  );
}
