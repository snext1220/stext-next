// 旧リポジトリ（snext1220/stext）の画像・BGM・効果音を取り込む。
//
// シナリオに関係するものはシナリオのフォルダーにまとめ、共通のものだけ assets/ に置く：
//   assets/common/...               共通の BGM・効果音・画像（_garbage は除く）
//   scenarios/<id>/capture/...      シナリオの挿絵
//   scenarios/<id>/bgm/...          シナリオ独自の BGM・効果音（bgm/se/）
//   scenarios/<id>/chara/...        シナリオ独自のキャラクター画像（imageSet: "custom"）
//
// 使い方: node scripts/import-legacy-assets.mjs [旧リポジトリの stext ディレクトリ（既定 ../stext/stext）]
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2] ?? fileURLToPath(new URL('../../stext/stext', import.meta.url));
const dest = fileURLToPath(new URL('../assets', import.meta.url));
const scenarios = fileURLToPath(new URL('../scenarios', import.meta.url));
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

// 取り込み直すときは古いものを消す（assets/README.md と scenarios/<id>/scenario.json は残す）
for (const name of existsSync(dest) ? readdirSync(dest) : []) {
  if (name !== 'README.md') rmSync(join(dest, name), { recursive: true, force: true });
}
copy(join(source, 'common'), join(dest, 'common'));
for (const id of readdirSync(source)) {
  if (!existsSync(join(source, id, 'scenario.xml'))) continue;
  for (const sub of ['capture', 'bgm', 'chara']) {
    const to = join(scenarios, id, sub);
    rmSync(to, { recursive: true, force: true });
    if (existsSync(join(source, id, sub))) copy(join(source, id, sub), to);
  }
}
console.log(
  `${files} ファイル（${(bytes / 1024 / 1024).toFixed(1)} MB）を ${relative(process.cwd(), dest)}/common/ と ${relative(process.cwd(), scenarios)}/<id>/ に取り込みました`,
);
