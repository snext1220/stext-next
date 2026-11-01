import { siteImageUrl } from '../config.js';
import { DocPage, DocSheet, Figures } from './Doc.js';

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

/** 画廊（旧サイトのギャラリー） */
export function Gallery() {
  return (
    <DocPage
      page="gallery"
      eyebrow="Gallery"
      title="画廊"
      lede="記念ロゴやスタート画面、シナリオの紹介イラストなど、SText を彩ってきた絵を集めました。画像を押すと、元の大きさで開きます。"
    >
      <DocSheet seed={43}>
        {GALLERY.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            <p>{g.text}</p>
            <Figures items={g.items.map((i) => ({ ...i, src: siteImageUrl(i.src) }))} />
          </div>
        ))}
      </DocSheet>
    </DocPage>
  );
}
