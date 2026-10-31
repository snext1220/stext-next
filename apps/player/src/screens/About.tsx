import { siteImageUrl } from '../config.js';
import { MANUALS, REPOSITORY } from '../links.js';
import { href } from '../router.js';
import { DocPage, DocSection, ExtLink, Figures, type DocChapter } from './Doc.js';

const CHAPTERS = {
  stext: { id: 'stext', title: 'SORCERIAN Text とは' },
  sorcerian: { id: 'sorcerian', title: 'ソーサリアンとは' },
  staff: { id: 'staff', title: 'スタッフ' },
  gallery: { id: 'gallery', title: 'ギャラリー' },
  links: { id: 'links', title: '関連リンク' },
} satisfies Record<string, DocChapter>;

const x = (id: string) => `https://x.com/${id}`;

const STAFF: { role: string; members: { name: string; x: string; words: string }[] }[] = [
  {
    role: 'System',
    members: [
      {
        name: 'Rio',
        x: 'yy7512',
        words:
          '無限に広がるシナリオシステムを、ゲームブックの世界で再現（？）してみました。創作の輪を広げながら、システムも進化させたいと思っているので、読んでくださった皆さんも、お気軽にご参加ください。',
      },
    ],
  },
  {
    role: 'Illustration',
    members: [
      {
        name: 'Tokinoji',
        x: 'toki_s1',
        words: 'ドットアイコンに、しれっと YOUNG な FIGHTER くんを入れた張本人です。',
      },
      {
        name: 'Mizuncoo',
        x: 'mizuncooX',
        words:
          'イラストをメインにお手伝いさせていただいています。ゲームも好きで、イース1～3がとくに好きです（PC88世代の）。ネトゲ、ソシャゲもやったりしています。',
      },
      {
        name: 'Mizuri',
        x: 'mizuri_yuco',
        words:
          '30周年ロゴを作らせてもらいました。ソーサリアンを愛する人にしかわからないネタと、ソーサリアンが迎えた新たな夜明けへの想いを込めました。',
      },
    ],
  },
  {
    role: 'Music',
    members: [
      {
        name: 'AZ',
        x: 'VENUS_AZ',
        words:
          '自己紹介の文章がこんなにも思い付かないとはッ!! 音楽を担当させていただきました。以上っ！……ダメですか？',
      },
    ],
  },
];

const SCENARIO_WRITERS = [
  { name: 'ときのじ', x: 'toki_s1' },
  { name: 'Salvador', x: 'mail74446386' },
  { name: 'cocotori', x: 'cocotori_twit' },
];

const GALLERY: { title: string; text: string; items: { src: string; caption: string }[] }[] = [
  {
    title: '原作30周年記念ロゴ',
    text: 'ソーサリアン Text は、原作の30周年を記念して公開されました。記念ロゴは、みずりさんの作品です。',
    items: [
      { src: 'gallery/banner_b1.png', caption: '30周年（剣・大）' },
      { src: 'gallery/banner_b2.png', caption: '30周年（剣・小）' },
      { src: 'gallery/banner_r1.png', caption: '30周年（杖・大）' },
      { src: 'gallery/banner_r2.png', caption: '30周年（杖・小）' },
    ],
  },
  {
    title: '歴代スタート画面',
    text: '旧サイトでゲームを始めるとき（やり直すとき）の画像です。最初はスプラッシュ画面として表示し、のちにプレイ画面に組み込みました。ときのじさんの作品です。',
    items: [
      { src: 'gallery/title0.png', caption: 'リリース前（ボツ版）' },
      { src: 'gallery/title1.png', caption: 'リリース時・スプラッシュ画面' },
      { src: 'gallery/title2.png', caption: '改訂版・リスタート画面' },
      { src: 'gallery/title3.png', caption: '改訂版・リスタート画面（ボツ版）' },
    ],
  },
  {
    title: 'シナリオ紹介／宣伝イラスト',
    text: '連作「幕末ソーサリアン」「ドラゴンモード」のイメージイラストをはじめ、各シナリオの紹介・宣伝の画像です。美麗からポンワリまで、さまざまな空気をお楽しみください。ときのじさん、cocotori さんらの作品です。',
    items: [
      { src: 'gallery/baku.png', caption: '幕末ソーサリアン開幕' },
      { src: 'gallery/baku_sengoku.png', caption: '幕末ソーサリアン開幕（戦国ソーサリアン風）' },
      { src: 'gallery/dragon.png', caption: 'ドラゴンモード開始！' },
      { src: 'gallery/dragon2.jpg', caption: 'ドラゴンモード（31周年記念）' },
      { src: 'gallery/cute.jpg', caption: 'SText 可愛いキャラ大集合！' },
      { src: 'gallery/tokinoji.png', caption: 'FIGHTER LOVE!' },
      { src: 'gallery/coco1.png', caption: '鉄腕の吸血姫（チビキャラ）' },
      { src: 'gallery/coco2.png', caption: 'プレアオブ・ドールズ（チビキャラ）' },
      { src: 'gallery/coco3.jpg', caption: 'プレアオブ・ドールズ（宣伝）' },
      { src: 'gallery/coco4.jpg', caption: '鉄腕の吸血姫（イメージ）' },
      { src: 'gallery/coco5.jpg', caption: '鉄腕の吸血姫（タイトルカット）' },
      { src: 'gallery/hero1.jpg', caption: '少女は英雄を語りて（グリメルム）' },
      { src: 'gallery/hero5.png', caption: '少女は英雄を語りて（イメージイラスト）' },
    ],
  },
];

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

/** 案内：SORCERIAN Text とは／ソーサリアンとは／スタッフ／ギャラリー／関連リンク（旧サイトの概要・資料） */
export function About({ section }: { section?: string }) {
  return (
    <DocPage
      page="about"
      section={section}
      eyebrow="About"
      title="ソーサリアン Text の案内"
      lede="ソーサリアン Text と原作「ソーサリアン」のこと、そして SText を作ってきた人たちと、その足跡です。"
      chapters={Object.values(CHAPTERS)}
    >
      <DocSection page="about" chapter={CHAPTERS.stext} eyebrow="SORCERIAN Text" seed={31}>
        <p>
          「ソーサリアン
          Text」（略称：SText）は、ソーサリアンの世界を古典的なゲームブックの形で再現しようという試みです。原作の30周年を記念して、2017年12月20日に生まれました。
        </p>
        <p>
          自分で創った世界（シナリオ）を、すぐに、いくつでも公開できるのが特徴です。書庫には、標準のシナリオに加えて、皆さんから投稿されたシナリオが並んでいます。「我こそは」という誉れ高き勇者は、ぜひ自作のシナリオを投稿してほしい。
        </p>
        <p className="doc-strong">来たれ、ソーサリアン、無限の冒険譚へ……！</p>
        <h3>eゲームブック・プラットフォーム</h3>
        <p>
          SText
          が目指すのは、ゲームブックを届ける新しい場「eゲームブック・プラットフォーム」（eGBP）です。紙の本とも電子書籍とも、専用のアプリとも違う、ゲームブックの第三の柱です。
        </p>
        <ul>
          <li>
            <strong>プレイヤーに優しく</strong>
            ：フラグやアイテムの管理は自動。ゲームブックらしさはそのままに、手軽に遊べます。
          </li>
          <li>
            <strong>作者に易しく</strong>
            ：アプリを自分で作るよりずっと簡単に、アイデアを形にできます。Playground
            を使えば、シーンをフロー図の上でつなぐだけで、分岐する物語を組み立てられます。紙の本のように、フラグやアイテムを管理するための特別な仕掛けもいりません。物語を創ることに集中できます。
          </li>
        </ul>
        <p>
          プレイヤーにも作者にも優しい eGBP で、古くて新しいゲームブックの世界を開拓してみませんか？
        </p>
        <h3>新しいプレイヤーについて</h3>
        <p>
          この画面は、SText
          を次の世代に引き継ぐために作り直したプレイヤーです。旧サイトのシナリオをすべて遊べて、旧サイトのセーブデータ（.stext
          ファイル）もそのまま使えます。開発は <ExtLink href={REPOSITORY}>GitHub</ExtLink>{' '}
          で進めています。
        </p>
        <div className="end-actions">
          <a className="btn" href={MANUALS.player} target="_blank" rel="noopener noreferrer">
            遊び方を知りたい（プレイヤー向けマニュアル）
          </a>
          <a className="btn ghost" href={href({ name: 'post' })}>
            自分で物語を創りたい！（投稿の案内）
          </a>
        </div>
      </DocSection>

      <DocSection page="about" chapter={CHAPTERS.sorcerian} eyebrow="SORCERIAN" seed={37}>
        <p>
          1987年12月20日に、日本ファルコムから PC-8801 のゲームとして発売されたアクション RPG
          です。小さな冒険を集めた短編集のようなゲームで、一つひとつの短編を「シナリオ」と呼びます。冒険に出るたびにキャラクターが歳を取り、世代交代していくのも特徴です。
        </p>
        <p>
          これまで PC-8801／9801、X1、メガドライブ、PC エンジン、ドリームキャスト、iOS
          など、さまざまな機種で発売されてきました。いま遊ぶなら「
          <ExtLink href="https://www.amusement-center.com/project/egg/special/package_sorceriancomplete/">
            ソーサリアン・コンプリート
          </ExtLink>
          」「
          <ExtLink href="https://www.falcom.co.jp/sor_o/">ソーサリアンオリジナル（DL版）</ExtLink>
          」が比較的手に入れやすく、お勧めです。
        </p>
        <h3>ソーサリアンの世界</h3>
        <p>
          基本は、中世風の世界で繰り広げられる剣と魔法のファンタジーです。ただし原作にも、戦国時代やピラミッド、果てには
          SF（宇宙）まで登場するなど、わりと何でもありな世界でもあります。
        </p>
        <p>
          物語の主な舞台は「ペンタウァ王国」。王国の「ペンタウァの町」には、武器と防具の店や魔法屋、薬屋など、冒険者御用達の店が立ち並び、大きな城もそびえ立っています。
        </p>
        <p>
          ペンタウァの町では、月・火星・水星・木星・金星・土星・太陽を司る七惑星の神々の力――すなわち「星」を掛け合わせて魔法を作り出します。そして、魔法が盛んなペンタウァの町に集い、野心を胸に幾多の冒険へ身を投じる冒険者は、人々から「ソーサリアン」と呼ばれています。
        </p>
        <p>
          ゲームのタイトルの「ソーサリアン」とは、ペンタウァの町に集う冒険大好きマン（ウーマン）のことだったのです。
        </p>
        <h3>ソーサリアンってどんな人？</h3>
        <img
          className="doc-float"
          src={siteImageUrl('gallery/dragon.png')}
          alt="ドラゴンモード開始！（ときのじさんのイラスト）"
          loading="lazy"
        />
        <p>
          ソーサリアンは依頼を請けて現地に赴き、悪さをする魔物を斃したり、困っている人たちを助けたりします。ペンタウァの王さまからの信頼も厚く、王宮から直々に仕事を頼まれることも数多くあります。もちろん、他国から依頼が舞い込むことも珍しくありません。邪悪な魔物退治に難事件の解決、果ては迷子の犬探しまでこなすソーサリアンですから、その便利さ……いえ、名声は広く知れ渡っているのです。
        </p>
        <p>
          依頼を果たしてペンタウァの町に帰ると、冒険で手に入れたアイテムを仲間と分けたり、換金したりします。でも、すぐにまた次の冒険へ……というわけではありません。町にいる間は、パン屋や占い師などの仕事で収入を得ている一住人なのです。冒険に必要な技や知識を学ぶために、道場へ通うこともあります。
        </p>
        <h3>で、どんな物語を創ればいいの？</h3>
        <p>
          個人的には、なんでもありだと思っています。いつかどこかの世界でも、自分で「ここがソーサリアンの世界だ」と宣言したら、それで良し（そこがどんなに現代日本に似ていたとしても、です！）。
        </p>
        <p>
          ある方の言葉をお借りするなら、「ソーサリアン＝主人公、冒険者、あなた、勇気あるもの、トラブル引き寄せ体質……」。そんなノリで良いではありませんか。
        </p>
        <p>
          とにかく自由に、気軽に。皆さんの頭の中の世界を物語に紡いでいただければ――そんな緩い企画が、ソーサリアン
          Text なのです。
        </p>
      </DocSection>

      <DocSection page="about" chapter={CHAPTERS.staff} eyebrow="Staff" seed={41}>
        <p>
          原点は、2013年のエイプリルフール企画「SORCERIAN
          Next」。それから5年近く、原作30周年に向けて、皆でチラシの裏あたりでゴソゴソと頑張ってきました。もっとも、30周年はあくまで区切りの一つ。これからも懲りずに、さまざまな黒歴史……もとい、創作物を披露していきたいと思っています。
        </p>
        <dl className="staff-list">
          {STAFF.map((s) => (
            <div key={s.role}>
              <dt>{s.role}</dt>
              {s.members.map((m) => (
                <dd key={m.name}>
                  <p>{m.words}</p>
                  <p className="staff-name">
                    ―― <ExtLink href={x(m.x)}>{m.name}</ExtLink>
                  </p>
                </dd>
              ))}
            </div>
          ))}
          <div>
            <dt>Scenario</dt>
            <dd>
              <p>
                初期シナリオは、
                {SCENARIO_WRITERS.map((w, i) => (
                  <span key={w.x}>
                    {i > 0 && '、'}
                    <ExtLink href={x(w.x)}>{w.name}</ExtLink>さん
                  </span>
                ))}
                、そして私リオで担当しました。その後、ゲストの皆さまのご協力もいただきながら、世界観もシナリオの本数もどんどん広がっています。皆さまのご協力には、ただただ感謝しかありません。
              </p>
              <p className="staff-name">
                ―― <ExtLink href={x('yy7512')}>Rio</ExtLink>
              </p>
            </dd>
          </div>
          <div>
            <dt>Guest</dt>
            <dd>
              <p>
                公開してからも、たくさんの皆さまにシナリオを寄稿していただき、システムへのご意見もいただいて、SText
                が進化する力をいただきました。ちゃなさん、RYU
                さん、山田さん、咲華さん、座間さん、そのほか SText
                に関わってくださったすべての皆さまに感謝いたします。
              </p>
            </dd>
          </div>
        </dl>
        <p className="doc-small">
          ※
          一部のイラスト・楽曲は、フリー素材などを利用しています。ライセンスは各シナリオに記載していますが、この場を借りて、制作者の皆さまに感謝申し上げます。
        </p>
        <img
          className="doc-banner"
          src={siteImageUrl('stext30.png')}
          alt="ソーサリアン30周年おめでとう！"
          width={200}
          height={60}
          loading="lazy"
        />
      </DocSection>

      <DocSection page="about" chapter={CHAPTERS.gallery} eyebrow="Gallery" seed={43}>
        {GALLERY.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            <p>{g.text}</p>
            <Figures items={g.items.map((i) => ({ ...i, src: siteImageUrl(i.src) }))} />
          </div>
        ))}
      </DocSection>

      <DocSection page="about" chapter={CHAPTERS.links} eyebrow="Link" seed={47}>
        <p>
          SText
          に寄せていただいた反応や、ゲスト作者さん、スタッフによる紹介などを、この場を借りてまとめました。管理人が気付いたものだけなので、漏れがあれば「こんな紹介もした／あったよ！」のような自薦・他薦も大歓迎です。
        </p>
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
      </DocSection>
    </DocPage>
  );
}
