// GitHub Pages に公開するサイトを site/ に組み立てる（npm run build のあとで実行する）。
//
//   site/                  プレイヤー（apps/player/dist。scenarios/ と assets/ を含む）
//   site/prototype/        デザインプロトタイプ（これまでと同じ URL）
//   site/schema/           シナリオの JSON Schema（各シナリオの $schema が指す URL）
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const site = root('site');
const player = root('apps/player/dist');

if (!existsSync(`${player}/index.html`)) {
  console.error('apps/player/dist がありません。先に npm run build を実行してください');
  process.exit(1);
}
rmSync(site, { recursive: true, force: true });
cpSync(player, site, { recursive: true });
cpSync(root('prototype'), `${site}/prototype`, { recursive: true });
cpSync(root('schema'), `${site}/schema`, { recursive: true });
console.log(`site/ を作りました（プレイヤー、prototype/、schema/）`);
