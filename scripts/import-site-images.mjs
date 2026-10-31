// 旧サイト（https://www.web-deli.com/sorcerian/text/）の画像を assets/site/ に取り込む。
//
// 案内・投稿の画面で使う画像（ギャラリー、募集企画のバナー、CONTACT のアイコンなど）は、
// 旧リポジトリ（snext1220/stext）にはなく、旧サイトのサーバーにしかないため、ここから取り込む。
// 旧サイトの image/ 以下と同じ構成で assets/site/ に置く（例：image/gallery/cute.jpg → assets/site/gallery/cute.jpg）。
//
// 使い方: node scripts/import-site-images.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://www.web-deli.com/sorcerian/text/image/';
const dest = fileURLToPath(new URL('../assets/site/', import.meta.url));

const FILES = [
  // 案内：スタッフ
  'stext30.png',
  'king.gif',
  // ギャラリー：30周年記念ロゴ
  'gallery/banner_b1.png',
  'gallery/banner_b2.png',
  'gallery/banner_r1.png',
  'gallery/banner_r2.png',
  // ギャラリー：歴代スタート画面
  'gallery/title0.png',
  'gallery/title1.png',
  'gallery/title2.png',
  'gallery/title3.png',
  // ギャラリー：シナリオ紹介／宣伝イラスト
  'gallery/baku.png',
  'gallery/baku_sengoku.png',
  'gallery/dragon.png',
  'gallery/dragon2.jpg',
  'gallery/cute.jpg',
  'gallery/tokinoji.png',
  'gallery/coco1.png',
  'gallery/coco2.png',
  'gallery/coco3.jpg',
  'gallery/coco4.jpg',
  'gallery/coco5.jpg',
  'gallery/hero1.jpg',
  'gallery/hero5.png',
  // 関連リンク
  'link/stext.png',
  'link/staff.png',
  'link/sn2020_banner_2.png',
  // 投稿：募集企画のバナー
  'banner/baku.png',
  'banner/pg100.png',
  'banner/mini30.png',
  'banner/begin.png',
  'banner/dragon.png',
  // CONTACT のアイコン
  'contact/twitter.png',
  'contact/manual.png',
  'contact/qa.png',
  'contact/quest.png',
  'contact/github.png',
];

rmSync(dest, { recursive: true, force: true });
let bytes = 0;
for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.error(`${BASE}${file} を取得できませんでした（${res.status}）`);
    process.exit(1);
  }
  const body = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(join(dest, file)), { recursive: true });
  writeFileSync(join(dest, file), body);
  bytes += body.length;
}
console.log(
  `${FILES.length} ファイル（${(bytes / 1024 / 1024).toFixed(1)} MB）を assets/site/ に取り込みました`,
);
