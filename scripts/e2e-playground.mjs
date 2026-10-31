// Playground（apps/playground）をブラウザで一通り操作する確認。
//
// 使い方:
//   npm run dev:playground               # 別の端末で開発サーバーを起動（http://localhost:5174）
//   node scripts/e2e-playground.mjs [--base http://localhost:5174] [--shots ディレクトリ]
//
// Chromium と playwright が必要（CI では実行しない）。旧リポジトリ（../stext）の mini の XML も使う。
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const base = opt('--base', 'http://localhost:5174');
const shots = opt('--shots', undefined);
if (shots) mkdirSync(shots, { recursive: true });
const miniXml = fileURLToPath(new URL('../../stext/stext/mini/scenario.xml', import.meta.url));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
const shot = (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const wait = (ms = 300) => page.waitForTimeout(ms);
const nodes = page.locator('.flow-node');
const selectedId = async () =>
  (await page.locator('.flow-node.is-selected .flow-node-id').innerText()).split('\n')[0];
const tab = (name) => page.locator('[role=tab]', { hasText: name }).click();
const field = (label) => page.getByLabel(label, { exact: true });

// 初回：空のシナリオから始まる
await page.goto(`${base}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.flow-node');
check('最初は空のシナリオ（シーン 0 だけ）', (await nodes.count()) === 1);

// テンプレート
await page.selectOption('select[aria-label="新しく始める"]', 't:mini15');
await wait(1000);
check('テンプレートを開ける', (await nodes.count()) === 16, `${await nodes.count()} シーン`);
check('最初のシーンが見える大きさで表示される', (await nodes.first().boundingBox()).width > 80);
await shot('1-template');

// シーンの選択・追加・名前の変更
await nodes.filter({ hasText: '§1' }).first().click();
await wait();
check('シーンをクリックすると編集できる', (await selectedId()) === '§1');
const edgesBefore = await page.locator('.react-flow__edge').count();
await page.getByRole('button', { name: '＋ 選択中のシーンから' }).click();
await wait();
const added = await selectedId();
check(
  '選択中のシーンから新しいシーンを作ると線も引かれる',
  (await nodes.count()) === 17 &&
    (await page.locator('.react-flow__edge').count()) === edgesBefore + 1,
  added,
);
await field('シーン ID').fill('town');
await page.getByRole('button', { name: '変更', exact: true }).click();
await wait();
await nodes.filter({ hasText: '§1' }).first().click();
await wait();
const labels = await page.locator('.pg-choice input').evaluateAll((els) => els.map((e) => e.value));
check('シーン ID を変えると遷移先も直る', labels.includes('town'));

// 選択肢の条件
await page.locator('.pg-choice').last().getByLabel('条件').fill('f01 &&');
await wait();
check('書きかけの条件はエラーを表示', (await page.locator('.pg-choice .pg-error').count()) > 0);
await page.locator('.pg-choice').last().getByLabel('条件').fill('f01 && !i01');
await wait();
check('正しい条件は読めると表示', (await page.locator('.pg-choice .pg-ok').count()) > 0);
await shot('2-scene');

// 元に戻す・やり直す
await page.getByTitle('元に戻す（Ctrl+Z）').click();
await page.getByTitle('元に戻す（Ctrl+Z）').click();
await wait();
const cond = await page.locator('.pg-choice').last().getByLabel('条件').inputValue();
check('元に戻せる', cond === '', `条件「${cond}」`);
await page.getByTitle('やり直す（Ctrl+Shift+Z）').click();
await page.getByTitle('やり直す（Ctrl+Shift+Z）').click();
await wait();
check(
  'やり直せる',
  (await page.locator('.pg-choice').last().getByLabel('条件').inputValue()) === 'f01 && !i01',
);

// 定義：アイテムを足す
await tab('定義');
await page.locator('.pg-subtabs button', { hasText: 'アイテム' }).click();
const itemRows = await page.locator('.pg-table tbody tr').count();
await page.getByRole('button', { name: '＋ アイテムを追加' }).click();
await wait();
check('定義の表に行を足せる', (await page.locator('.pg-table tbody tr').count()) === itemRows + 1);
await shot('3-definitions');

// 検査：問題をクリックするとそのシーンへ
await tab('検査');
await wait();
const problems = page.locator('.pg-problems li');
check('検査に問題が並ぶ', (await problems.count()) > 0, `${await problems.count()} 件`);
const target = (await problems.first().locator('button').innerText()).trim();
await problems.first().locator('button').click();
await wait();
check('問題からそのシーンを開ける', (await selectedId()) === target, target);
await shot('4-problems');

// 試遊
await tab('試遊');
await page.getByRole('button', { name: '最初から試遊' }).click();
await page.waitForSelector('.pg-play .choices .choice');
const before = await page.locator('.pg-play .para').innerText();
await page.locator('.pg-play .choices .choice').first().click();
await wait();
const after = await page.locator('.pg-play .para').innerText();
check('試遊で選択肢を選ぶと次のシーンへ進む', before !== after, `${before} → ${after}`);
await shot('5-play');

// 自動保存：再読み込みしても続きから
await wait(500);
await page.reload();
await page.waitForSelector('.flow-node');
check(
  '再読み込みしても編集中のシナリオが残る',
  (await nodes.filter({ hasText: '§town' }).count()) === 1,
);

// マイストレージ
await page.selectOption('select[aria-label="マイストレージ"]', 'save');
await wait();
await page.selectOption('select[aria-label="新しく始める"]', 'empty');
await wait();
const slot = await page
  .locator('select[aria-label="マイストレージ"] option[value^="load:"]')
  .first()
  .getAttribute('value');
await page.selectOption('select[aria-label="マイストレージ"]', slot);
await wait(600);
check('マイストレージに保存して開き直せる', (await nodes.count()) === 17);

// JSON で保存
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: '保存（JSON）' }).click(),
]);
const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
check(
  'JSON で保存できる（stext/2 形式）',
  saved.format === 'stext/2' && saved.scenes.some((s) => s.id === 'town'),
  download.suggestedFilename(),
);

// 旧形式の XML を開く
await page.setInputFiles('#open-file', miniXml);
await wait(1000);
check(
  '旧形式の XML を変換して開ける',
  (await page.locator('.pg-message').innerText()).includes('変換') && (await nodes.count()) > 5,
  `${await nodes.count()} シーン`,
);

// 公開シナリオ
const published = await page
  .locator('select[aria-label="新しく始める"] optgroup[label="公開シナリオ"] option')
  .count();
await page.selectOption('select[aria-label="新しく始める"]', 's:scepter');
await wait(1500);
check(
  '公開シナリオを開ける',
  published > 20 && (await nodes.count()) > 50,
  `${await nodes.count()} シーン`,
);

// スマホ幅
await page.setViewportSize({ width: 390, height: 844 });
await wait();
check(
  'スマホ幅で横にはみ出さない',
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);
await shot('6-phone');

check('ページのエラーなし', errors.length === 0, errors.join(' / '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} 件失敗` : `${results.length} 件すべて成功`);
process.exit(failed ? 1 : 0);
