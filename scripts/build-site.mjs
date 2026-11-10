// GitHub Pages に公開するサイトを site/ に組み立てる（npm run build のあとで実行する）。
//
//   site/                  プレイヤー（apps/player/dist。scenarios/（シナリオと挿絵・BGM）と assets/（共通の素材）を含む）
//   site/playground/       Playground（シナリオの編集環境。シナリオと素材はプレイヤーのものを使う）
//   site/prototype/        デザインプロトタイプ（これまでと同じ URL）
//   site/schema/           シナリオの JSON Schema（各シナリオの $schema が指す URL）
//   site/manual/           プレイヤー・Playground のマニュアル
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const site = root('site');
const player = root('apps/player/dist');
const playground = root('apps/playground/dist');
const manuals = [
  { slug: 'player', title: 'ソーサリアン Text の遊び方', source: 'docs/manual-player.md' },
  { slug: 'playground', title: 'Playground入門', source: 'docs/manual-playground.md' },
];

for (const dist of [player, playground]) {
  if (!existsSync(`${dist}/index.html`)) {
    console.error(`${dist} がありません。先に npm run build を実行してください`);
    process.exit(1);
  }
}
rmSync(site, { recursive: true, force: true });
cpSync(player, site, { recursive: true });
cpSync(playground, `${site}/playground`, { recursive: true });
cpSync(root('prototype'), `${site}/prototype`, { recursive: true });
cpSync(root('schema'), `${site}/schema`, { recursive: true });

const manualSite = `${site}/manual`;
mkdirSync(manualSite, { recursive: true });
cpSync(root('docs/image'), `${manualSite}/image`, { recursive: true });
cpSync(root('docs/manual.css'), `${manualSite}/manual.css`);

const playerStyles = readdirSync(`${site}/_app`).filter((file) => file.endsWith('.css'));
if (playerStyles.length === 0) {
  throw new Error('プレイヤーの CSS がありません。先に npm run build を実行してください');
}
const stylesheetLinks = [
  ...playerStyles.map((file) => `<link rel="stylesheet" href="../_app/${file}" />`),
  '<link rel="stylesheet" href="./manual.css" />',
].join('\n    ');
const pageStart = (title) => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${title}" />
    <title>${title} | SORCERIAN Text</title>
    ${stylesheetLinks}
  </head>
  <body class="manual-page">
    <header class="topbar">
      <nav class="topbar-in">
        <a class="brand" href="../">SORCERIAN Text</a>
        <a href="./">マニュアル一覧</a>
      </nav>
    </header>`;

for (const { slug, title, source } of manuals) {
  const markdown = readFileSync(root(source), 'utf8');
  const content = marked.parse(markdown, { gfm: true, async: false });
  writeFileSync(
    `${manualSite}/${slug}.html`,
    `${pageStart(title)}
    <main class="shell">
      <article class="parchment">
        <div class="page manual-content">${content}</div>
      </article>
    </main>
  </body>
</html>
`,
  );
}

writeFileSync(
  `${manualSite}/index.html`,
  `${pageStart('マニュアル')}
    <main class="shell manual-index">
      <h1>マニュアル</h1>
      <ul>
        <li><a href="./player.html">プレイヤーの遊び方</a></li>
        <li><a href="./playground.html">Playground入門</a></li>
      </ul>
    </main>
  </body>
</html>
`,
);
console.log(`site/ を作りました（プレイヤー、playground/、prototype/、schema/、manual/）`);
