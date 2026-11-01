import { siteImageUrl } from '../config.js';
import { DocPage, DocSheet, ExtLink } from './Doc.js';

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

/** 作り手たち（旧サイトのスタッフ） */
export function Staff() {
  return (
    <DocPage
      page="staff"
      eyebrow="Staff"
      title="作り手たち"
      lede="ソーサリアン Text を作ってきた人たちと、その言葉です。"
    >
      <DocSheet seed={41}>
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
      </DocSheet>
    </DocPage>
  );
}
