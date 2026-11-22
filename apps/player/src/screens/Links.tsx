import { ImagePreview } from '@stext/ui';
import { siteImageUrl } from '../config.js';
import { DocPage, DocSheet, ExtLink } from './Doc.js';

/** ソーサリアンの歴史資料を紹介するページ */
export function Links() {
  return (
    <DocPage
      page="links"
      eyebrow="History"
      title="歴史展示室"
      lede="ソーサリアン NextからSText、Next 2020、NTextへと続く企画の歩みを紹介します。"
    >
      <DocSheet seed={47}>
        <h3>起源（オリジン）、そして更なる展開（ステージ）へ</h3>
        <p>
          創まりは、2013年のエイプリルフール企画として公開された「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/">SORCERIAN Next</ExtLink>
          」。その発想の源をたどると、iOS版ソーサリアンのシナリオコンテストに行き着きます。当時の作品を紹介するブログ「
          <ExtLink href="https://d.hatena.ne.jp/sorcerian/">新時代のソーサリアンを提案する</ExtLink>
          」とあわせて、ソーサリアンの新しい可能性を模索した軌跡をご覧ください。
        </p>
        <div className="doc-banner-links">
          <a
            className="doc-banner-link"
            href="https://www.web-deli.com/sorcerian/next/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://www.web-deli.com/sorcerian/next/images2/snext_banner_1.png"
              alt="SORCERIAN Next"
              width={180}
              height={180}
              loading="lazy"
            />
          </a>
          <a
            className="doc-banner-link"
            href="https://d.hatena.ne.jp/sorcerian/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://cdn-ak.f.st-hatena.com/images/fotolife/s/sorcerian/20121027/20121027191354.png"
              alt="新時代のソーサリアンを提案する"
              width={269}
              height={56}
              loading="lazy"
            />
          </a>
        </div>
        <p>
          Next企画の後、「嘘（ネタ）に留まりたくない！」「自分の物語を遊べる形にしたい」という思いからスタートしたのが、「
          <ExtLink href="https://www.web-deli.com/sorcerian/text/">
            ソーサリアン Text（SText）
          </ExtLink>
          」。ソーサリアンの世界をゲームブックで再現する企画です。「テキストを即座に遊べる世界へ」をモットーに、スタッフや有志の皆さまの手によって、35本のシナリオが公開されました。
        </p>
        <div className="doc-banner-links">
          <a
            className="doc-banner-link"
            href="https://www.web-deli.com/sorcerian/text/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://www.web-deli.com/sorcerian/text/image/banner/begin.png"
              alt="ソーサリアン Text（SText）"
              loading="lazy"
            />
          </a>
        </div>
        <p>
          SText以降も「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/allabout.aspx">
            All About 計画
          </ExtLink>
          」の名のもとで、ソーサリアン関連の創作を続けています。2020～21年には、MV ツクール版「
          <ExtLink href="https://www.web-deli.com/sorcerian/next/2020">SORCERIAN Next 2020</ExtLink>
          」を発表しました。Next
          2020は独立したゲーム作品で、STextとは別の、「遊べる」企画のもうひとつの柱です。執筆時点で7本のシナリオを遊べます。
        </p>
        <div className="doc-banner-links">
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
        </div>
        <p>
          そして2026年、NTextは、STextのシナリオとセーブデータを引き継ぎながら、プレイヤーを次世代向けに作り直したものです。NextからText、そしてNTextへ――それぞれの試みを通じて、ソーサリアンの物語を楽しみ、創る場をつないでいます。
        </p>

        <ImagePreview
          triggerClassName="doc-banner"
          src={siteImageUrl('banner/ntext-660x80.png')}
          alt="ソーサリアン NText。遊ぶ。創る。無限の冒険譚へ。"
          width={660}
          height={80}
        />
        <h3>謝辞</h3>
        <p>ソーサリアン NText の開発にあたり、多くの皆さまにご協力いただきました。</p>
        <p>
          Next チームの
          <ExtLink href="https://x.com/toki_s1">ときのじさん</ExtLink>、
          <ExtLink href="https://x.com/mail74446386">Salvador さん</ExtLink>、
          <ExtLink href="https://x.com/cocotori_twit">cocotori さん</ExtLink>、
          <ExtLink href="https://x.com/VENUS_AZ">AZ さん</ExtLink>はもちろん。
        </p>
        <p>
          魅力的なシナリオを寄稿いただいたちゃなさん、RYUさん、山田さん、咲華さん、鏡読みさんら、ゲストの皆さま。そして、ソーサリアン
          Textを遊覧、詳細なレポートにまとめていただいた
          <ExtLink href="https://sakuhindb.com/pj/6_A5ABA5A4A5CDA5EBA1A6A5C9A5A5A1A6A5E9A5D5A5A1A5C6A5A3/28/7__E3_82_BD_E3_83_BC_E3_82_B5_E3_83_AA_E3_82_A2_E3_83_B3Text/">
            カイネルさん
          </ExtLink>
          。
        </p>
        <p>
          また、シナリオ内の楽曲には、
          <ExtLink href="https://youfulca.com/">ユーフルカさん</ExtLink>
          が公開されている素材を多数活用させていただきました。
        </p>
        <p>
          そのほか、SText（NText）に関わってくださったすべての皆さまがいなければ、この作品が世に出ることはありませんでした。この場を借りて心より感謝いたします。
        </p>
        <p>
          システム・企画担当：<ExtLink href="https://x.com/yy7512">Rio</ExtLink>
        </p>
      </DocSheet>
    </DocPage>
  );
}
