// 旧リポジトリ（snext1220/stext）の画像・BGM・効果音を assets/ に取り込む。
//
// 旧リポジトリの stext/ と同じ構成で置く：
//   assets/common/...            共通の BGM・効果音・画像（_garbage は除く）
//   assets/<id>/capture/...      シナリオの挿絵
//   assets/<id>/bgm/...          シナリオ独自の BGM・効果音（bgm/se/）
//
// 使い方: node scripts/import-legacy-assets.mjs [旧リポジトリの stext ディレクトリ（既定 ../stext/stext）]
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2] ?? fileURLToPath(new URL('../../stext/stext', import.meta.url));
const dest = fileURLToPath(new URL('../assets', import.meta.url));
const MEDIA = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.mp3',
  '.ogg',
  '.wav',
  '.m4a',
]);

if (!existsSync(join(source, 'common'))) {
  console.error(`${source} に旧リポジトリの stext ディレクトリが見つかりません`);
  process.exit(1);
}

let files = 0;
let bytes = 0;
const copy = (from, to) =>
  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      if (src.includes(`${join(source, 'common', '_garbage')}`)) return false;
      if (statSync(src).isDirectory()) return true;
      if (!MEDIA.has(extname(src).toLowerCase())) return false;
      files++;
      bytes += statSync(src).size;
      return true;
    },
  });

// 取り込み直すときは古いものを消す（README.md は残す）
for (const name of existsSync(dest) ? readdirSync(dest) : []) {
  if (name !== 'README.md') rmSync(join(dest, name), { recursive: true, force: true });
}
copy(join(source, 'common'), join(dest, 'common'));
for (const id of readdirSync(source)) {
  if (!existsSync(join(source, id, 'scenario.xml'))) continue;
  for (const sub of ['capture', 'bgm']) {
    if (existsSync(join(source, id, sub))) copy(join(source, id, sub), join(dest, id, sub));
  }
}
console.log(
  `${files} ファイル（${(bytes / 1024 / 1024).toFixed(1)} MB）を ${relative(process.cwd(), dest)}/ に取り込みました`,
);
