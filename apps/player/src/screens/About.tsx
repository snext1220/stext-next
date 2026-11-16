import { ImagePreview } from '@stext/ui';
import { siteImageUrl } from '../config.js';
import { MANUALS, REPOSITORY } from '../links.js';
import { href } from '../router.js';
import { DocPage, DocSection, DocSheet, ExtLink, type DocChapter } from './Doc.js';

const SORCERIAN: DocChapter = { id: 'sorcerian', title: 'ソーサリアンとは' };

/** ソーサリアン Text とは：SText と原作「ソーサリアン」の紹介（旧サイトの概要） */
export function About({ section }: { section?: string }) {
  return (
    <DocPage
      page="about"
      section={section}
      eyebrow="About"
      title="ソーサリアン NText とは"
      lede="ソーサリアン NText とは、ブラウザー上で動作するゲームブックエンジン「ソーサリアン Text」のv2版。原作30周年を記念してリリースされたv1から10年、装いも一新した次世代プラットフォームです。"
    >
      <DocSheet seed={31}>
        <ImagePreview
          triggerClassName="doc-hero"
          src={siteImageUrl('ntext-promo.webp')}
          alt="冒険者たちが本から広がる世界へ旅立つ、ソーサリアン NText のイメージイラスト"
          width={1536}
          height={1024}
          loading="eager"
        />
        <p>
          「ソーサリアン
          Text」（略称：SText）は、ソーサリアンの世界を古典的なゲームブックの形で再現しようという試み。新世代言語SGML（Sorcerian
          Gamebook Markdown
          Language）を採用し、自ら創造した世界（シナリオ）を即座に、かつ、無限に公開できるプラットフォームが特徴だ。
        </p>
        <p>
          標準提供される基本シナリオに加えて、今後も順次追加シナリオを公開予定。開発者マニュアルも完備しているので、「我も」という誉れ高き勇者は自作シナリオを［制作工房（作品投稿）］ページから投稿してほしい。
        </p>
        <p className="doc-strong">来たれ、ソーサリアン、無限の冒険譚へ……！</p>

        <h3>STextが目指す「eゲームブックプラットフォーム」の世界</h3>
        <p>
          SText
          が目指すのは、ゲームブックを届ける新しい場「eゲームブック・プラットフォーム」（eGBP）。紙の本とも電子書籍とも、専用のアプリとも違う、ゲームブックの第三の柱です。
        </p>
        <ImagePreview
          className="doc-float"
          triggerClassName="doc-float"
          src={siteImageUrl('about-egb-v2.svg')}
          alt="eGBPの構成図。シナリオを、Playground・Converter・Systemで支えるソーサリアン Text v2のプラットフォーム"
          width={1214}
          height={684}
        />
        <ul>
          <li>
            <strong>プレイヤーに優しく</strong>
            ：フラグやアイテムの管理は自動。ゲームブックらしさはそのままに、手軽に遊べる分岐の物語を目指しました。
          </li>
          <li>
            <strong>創作者に易しく</strong>
            ：アプリを自分で作るよりずっと簡単に、アイデアを形にできます。Playground
            を使えば、シーンをフロー図の上でつなぐだけで、分岐する物語を組み立てられます。紙の本のように、フラグやアイテムを管理するための特別な仕掛けもいりません。物語を創ることに集中できます。
          </li>
        </ul>
        <p>
          プレイヤーにも創作者にも優しい eGBP
          で、古くて新しいゲームブックの世界を開拓してみませんか？
        </p>
        <h3>ソーサリアン Text から NText へ</h3>
        <ImagePreview
          triggerClassName="doc-banner"
          src={siteImageUrl('banner/ntext-history-660x80.png')}
          alt="NextからText、そしてNTextへ…冒険譚を受け継ぎ、新しい世代へ。"
          width={660}
          height={80}
        />
        <p>
          2017年12月20日に生まれた「ソーサリアン
          Text」（SText）は、原作の世界をゲームブックとして楽しみ、誰もがシナリオを投稿できる場として育ってきました。その遊びと作品を次の世代へ引き継ぐため、プレイ画面はもちろん、開発環境まで完全に作り直したのが「ソーサリアン
          Text v2」こと、「ソーサリアン
          NText」です。旧サイトのシナリオをすべて遊べて、セーブデータ（.stext
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
      </DocSheet>

      <DocSection page="about" chapter={SORCERIAN} eyebrow="SORCERIAN" seed={37}>
        <p>
          1987年12月20日に、日本ファルコムから PC-8801（レトロPC）
          のゲームとして発売されたアクション
          RPGです。「小粒のミッションを集めた短編集」のようなゲームで、個々の短編のことをソーサリアンでは「シナリオ」と呼んでいます。
          基本的に、キャラクターが冒険に出発する毎に歳を取り、世代交代してゆくシステムも本作の特徴です。
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
          基本は「中世風の世界観で繰り広げられる剣と魔法のファンタジー」です。ただし原作にも、戦国時代やピラミッド、果てには
          SF（宇宙）まで登場するなど、わりと何でもありな世界でもあります。
        </p>
        <ImagePreview
          className="doc-float"
          triggerClassName="doc-float"
          src={siteImageUrl('sorcerian-next-add2.jpg')}
          alt="ドラゴンに立ち向かう冒険者たち"
          width={640}
          height={400}
          loading="lazy"
        />
        <p>
          物語の主な舞台となるのは「ペンタウァ王国」。この王国にある「ペンタウァの町」には、武器と防具の店や魔法屋、薬屋など冒険者御用達の店が多く立ち並び、大きな城もそびえ立っています。
        </p>
        <p>
          ペンタウァの町では、「月、火星、水星、木星、金星、土星、太陽」を司る七惑星の神々の力――すなわち「星」を掛け合わせることで魔法を作り出します。そして、魔法が盛んなペンタウァの町に集い、己が野心を抱いて幾多の冒険に身を投じる冒険者は、人々から「ソーサリアン」と呼ばれています。
        </p>
        <p>
          ゲームのタイトルである「ソーサリアン」というのは、ペンタウァの町に集う冒険大好きマン（ウーマン）のことだったのです。
        </p>
        <h3>ソーサリアンってどんな人？</h3>
        <ImagePreview
          className="doc-float"
          triggerClassName="doc-float"
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
        <p>で、ソーサリアン Textでどんな物語を創ればいいのかというと。</p>
        <p>
          個人的には、なんでもありだと思っています。いつかどこかの世界、自分で「ここがソーサリアンの世界だ」と宣言したら、それで良し（そこがどんなに現代日本に似ていたとしても、です！）。
        </p>
        <p>
          某さんの言葉をお借りするなら、「ソーサリアン＝主人公、冒険者、あなた、勇気あるもの、トラブル引き寄せ体質……」、そんなノリで良いではありませんか。
        </p>
        <p>
          とにかく自由に、気軽に。皆さんの頭の中の世界を物語に紡いでいただければ――そんな緩い企画が、ソーサリアン
          Text（NText） なのです。
        </p>
      </DocSection>
    </DocPage>
  );
}
