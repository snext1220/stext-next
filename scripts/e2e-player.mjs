// プレイヤー（apps/player）をブラウザで一通り操作する確認。
//
// 使い方:
//   npm run dev                      # 別の端末で開発サーバーを起動（http://localhost:5173）
//   node scripts/e2e-player.mjs [--base http://localhost:5173] [--shots ディレクトリ]
//
// Chromium と playwright が必要（CI では実行しない）。scepter と mini のシナリオを使う。
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const base = opt('--base', 'http://localhost:5173');
const shots = opt('--shots', undefined);
if (shots) mkdirSync(shots, { recursive: true });
const miniXml = fileURLToPath(new URL('../../stext/stext/mini/scenario.xml', import.meta.url));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
const shot = (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

// 書庫
await page.goto(`${base}/#/library`);
await page.waitForSelector('.book');
check('書庫にシナリオが並ぶ', (await page.locator('.book').count()) > 20);
await shot('1-library');

// キャラクター作成から冒険開始
await page.click('a.book[href*="scepter"]');
await page.waitForSelector('.create');
await page.click('button.opt:has-text("エルフ")');
check(
  '種族を選ぶと名簿に反映される',
  (await page.textContent('.sheet-preview')).includes('エルフ'),
);
await shot('2-create');
await page.click('text=この者で冒険に出る');
await page.waitForSelector('.choices .choice');
check('シーン 0 が表示される', (await page.textContent('.para')).includes('0'));
check(
  '旧エンジンと同じキーで保存される',
  await page.evaluate(() => JSON.parse(localStorage.getItem('scepter')).scene === '0'),
);

// 敵のいるシーン（1120）で戦闘と魔法
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('scepter'));
  s.scene = '1120';
  s.stars = [3, 3, 3, 3, 3, 3, 3];
  s.chara.hp -= 20;
  localStorage.setItem('scepter', JSON.stringify(s));
});
await page.goto(`${base}/#/library`);
await page.goto(`${base}/#/play/scepter`);
await page.waitForSelector('.enemy');
await page.click('text=ダイスを振る');
await page.click('text=敵の攻撃');
await page.waitForSelector('.toast');
check('敵の攻撃の結果が通知される', (await page.locator('.toast').count()) > 0);
await shot('3-battle');
const hp = () => page.textContent('.gauge .val');
const before = await hp();
await page.click('[role=tab]:has-text("魔法")');
await page.click('.spell.ok:has-text("HEAL") .cast');
await page.click('[role=tab]:has-text("冒険者")');
check(
  'HEAL で HP が回復する',
  Number((await hp()).split('/')[0]) > Number(before.split('/')[0]),
  `${before} → ${await hp()}`,
);

// 数字キーで選び、戻る
const scene = await page.textContent('.para');
await page.keyboard.press('1');
await page.waitForFunction((s) => document.querySelector('.para').textContent !== s, scene);
await page.click('text=← 戻る');
check('数字キーで選び、戻るで元の節に戻る', (await page.textContent('.para')) === scene);

// スマホ幅
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
check(
  'スマホ幅で横にはみ出さない',
  (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
);
await page.click('.mtabs button >> nth=2');
check('下部タブから持ち物を開ける', (await page.locator('.sheet').count()) === 1);
await shot('4-mobile');
await page.setViewportSize({ width: 1280, height: 900 });

// 変換所から遊ぶ
await page.goto(`${base}/#/convert`);
await page.setInputFiles('#convert-file', miniXml);
await page.waitForSelector('.summary-row');
check(
  'scenario.xml を変換できる',
  (await page.locator('.summary-row b').first().textContent()) !== '0',
);
await page.click('text=このシナリオで遊んでみる');
await page.waitForSelector('.create');
await page.click('text=この者で冒険に出る');
await page.waitForSelector('.choices');
check(
  '変換したシナリオで遊べる',
  (await page.textContent('.page-head .title')).includes('ミニミニ'),
);

check('ページのエラーがない', errors.length === 0, errors.join(' / '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} / ${results.length} 件成功`);
process.exitCode = failed ? 1 : 0;
