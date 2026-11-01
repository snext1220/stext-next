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

// 詳細を開き、キャラクター作成から冒険開始
await page.click('button[aria-label="「新・消えた王様の杖」の詳細を表示"]');
await page.waitForSelector('[role=dialog] .lib-detail-body');
check(
  '詳細にプロローグが表示される',
  (await page.textContent('[role=dialog]')).includes('おうさまのつえ'),
);
await shot('1b-detail');
await page.click('[role=dialog] >> text=新たに冒険を始める');
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
await page.goto(`${base}/#/play/scepter`);
// セーブデータを書き換えたので、読み込み直す
await page.reload();
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

// ステータスの手入力
await page.click('[role=tab]:has-text("冒険者")');
await page.click('text=ステータスを編集');
await page.fill('#edit-hp', '7');
await page.click('.status-editor button[type=submit]');
check('ステータスを手入力で変えられる', (await hp()).startsWith('7 /'), await hp());

// 共有ボタン
const share = await page.getAttribute('a.share-link', 'href');
check(
  'X への共有リンクがある',
  share.startsWith('https://twitter.com/intent/tweet?') &&
    share.includes('hashtags=falcom%2Cstext'),
);

// 複数の敵がいるシーン（2020）の撃破チェック
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('scepter'));
  s.scene = '2020';
  localStorage.setItem('scepter', JSON.stringify(s));
});
await page.goto(`${base}/#/play/scepter`);
// セーブデータを書き換えたので、読み込み直す
await page.reload();
await page.waitForSelector('.enemy');
await page.click('.defeat-check >> nth=0');
check('撃破チェックで敵に印が付く', (await page.locator('.enemy.defeated').count()) === 1);

// 冒険者の記録：ランク・ボーナス・バックアップとリストア
await page.goto(`${base}/#/records`);
await page.waitForSelector('.rank-card');
check('プレイヤーランクが表示される', (await page.textContent('.rank-card')).includes('RANK'));
check('ボーナスアイテムが一覧になる', (await page.locator('.bonus-item').count()) === 28);
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('button:has-text("バックアップ")'),
]);
const backupPath = await download.path();
check('全データを .stext で保存できる', /^all-\d+\.stext$/.test(download.suggestedFilename()));
await page.evaluate(() => localStorage.removeItem('scepter'));
await page.setInputFiles('#restore-file', {
  name: download.suggestedFilename(),
  mimeType: 'application/octet-stream',
  buffer: (await import('node:fs')).readFileSync(backupPath),
});
await page.waitForSelector('text=リストアが完了しました');
check(
  'リストアでセーブデータが戻る',
  await page.evaluate(() => JSON.parse(localStorage.getItem('scepter')).scene === '2020'),
);
await shot('5-records');

// 文字の演出（baku03 §21 の ${effect fadeInDown}）
await page.goto(`${base}/#/create/baku03`);
await page.click('text=この者で冒険に出る');
await page.waitForSelector('.choices');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('baku03'));
  s.scene = '21';
  localStorage.setItem('baku03', JSON.stringify(s));
});
await page.goto(`${base}/#/play/baku03`);
// セーブデータを書き換えたので、読み込み直す
await page.reload();
await page.waitForSelector('.prose');
check(
  '${effect} が文字ごとの演出になる',
  (await page.locator('.stext-letter.fx-fadeInDown').count()) > 5,
);

// アイテムを使う（baku03 の「軟膏」：HP を 10 回復）
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('baku03'));
  s.items = ['i02'];
  s.chara.hp = s.chara.hp_m - 20;
  localStorage.setItem('baku03', JSON.stringify(s));
});
await page.goto(`${base}/#/play/baku03`);
// セーブデータを書き換えたので、読み込み直す
await page.reload();
await page.waitForSelector('.prose');
await page.click('[role=tab]:has-text("持ち物")');
await page.click('button:has-text("使う")');
await page.click('[role=tab]:has-text("冒険者")');
const [hpNow, hpMax] = (await hp()).split('/').map((v) => Number(v));
check(
  'アイテムを使うと効果が出て、なくなる',
  hpNow === hpMax - 10 &&
    (await page.evaluate(() => JSON.parse(localStorage.getItem('baku03')).items.length)) === 0,
  `${hpNow} / ${hpMax}`,
);

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

// 音楽室：共通の BGM を再生する
await page.goto(`${base}/#/music`);
await page.waitForSelector('.track');
check('音楽室に共通の BGM が並ぶ', (await page.locator('.track').count()) === 24);
check(
  '曲ごとに使っているシナリオが出る',
  (await page.textContent('.track-used >> nth=0')).includes('編：'),
);
await page.click('button[aria-label="field04 を再生"]');
await page.waitForSelector('.now-playing audio');
check(
  '押した曲を再生する',
  (await page.getAttribute('.now-playing audio', 'src')).endsWith('/common/bgm/field04.mp3'),
);
await page.click('.now-playing >> text=停止');
check('停止すると再生の欄が消える', (await page.locator('.now-playing').count()) === 0);

// ヘッダーのメニュー：サブメニューを開いて、画面を移る
await page.goto(`${base}/#/library`);
await page.click('.screens button:has-text("道具箱")');
check(
  '道具箱のサブメニューが開く',
  (await page.locator('.submenu-list:visible a').allTextContents()).join('/') ===
    '記録/変換所/音楽室/制作者向けの素材',
);
await shot('6a-menu');
await page.click('.submenu-list >> text=制作者向けの素材');
await page.waitForSelector('.face-grid img');
check(
  'サブメニューから画面を開くと閉じ、親に印が付く',
  (await page.locator('.submenu-list:visible').count()) === 0 &&
    (await page.getAttribute('.screens button:has-text("道具箱")', 'data-active')) === 'true',
);
await page.click('.screens button:has-text("案内所")');
await page.keyboard.press('Escape');
check('Esc でサブメニューが閉じる', (await page.locator('.submenu-list:visible').count()) === 0);

// 案内所・道具箱の読み物：以前の URL、章へのリンク、旧サイトの画像、フッターの CONTACT
await page.goto(`${base}/#/about/gallery`);
await page.waitForSelector('.figure-grid img');
check('以前の章の URL は分けた画面へ移る', new URL(page.url()).hash === '#/gallery');
await page.goto(`${base}/#/post/folder`);
await page.waitForSelector('#post-folder');
await page.waitForTimeout(300);
check(
  '投稿の章へ直接移動できる',
  await page.evaluate(() => {
    const top = document.getElementById('post-folder').getBoundingClientRect().top;
    return top >= 0 && top < 200;
  }),
);
const brokenImages = async () => {
  // 遅延読み込みの画像も読み込ませるため、下まで少しずつスクロールしてから、読み終わるのを待つ
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, {
    timeout: 15000,
  });
  return page.evaluate(() =>
    [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
  );
};
const DOC_PAGES = ['about', 'post', 'recruit', 'links', 'gallery', 'staff', 'materials'];
for (const route of DOC_PAGES) {
  await page.goto(`${base}/#/${route}`);
  await page.waitForSelector('.doc-page .doc');
  const broken = await brokenImages();
  check(`${route} の画像がすべて表示される`, broken.length === 0, broken.join(', '));
}
await shot('6-staff');
await page.goto(`${base}/#/materials`);
await page.waitForSelector('.face-grid img');
check('キャラ画像素材が並ぶ', (await page.locator('.face-grid li').count()) === 24);
await page.goto(`${base}/#/post`);
await page.waitForSelector('#post-submit');
check(
  '投稿先のスレッドへのリンクがある',
  (await page.locator('a[href="https://github.com/snext1220/stext/discussions/299"]').count()) > 0,
);
check('フッターに CONTACT が並ぶ', (await page.locator('.contact-list li').count()) === 5);
await page.click('.contact-list >> text=シナリオへの感想・ご意見');
await page.waitForSelector('.book');
check(
  'CONTACT からアンケートのあるシナリオだけの書庫を開ける',
  (await page.isChecked('text=アンケートのあるシナリオだけ')) &&
    (await page.locator('.book').count()) < 30,
);
await page.setViewportSize({ width: 390, height: 844 });
for (const route of ['music', ...DOC_PAGES]) {
  await page.goto(`${base}/#/${route}`);
  await page.waitForSelector('.page-title');
  await page.waitForTimeout(300);
  check(
    `スマホ幅で ${route} が横にはみ出さない`,
    (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
  );
}
await page.click('.screens button:has-text("案内所")');
check(
  'スマホ幅でサブメニューが画面に収まる',
  await page.evaluate(() => {
    const r = document.querySelector('.submenu-list:not([hidden])').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth;
  }),
);
await shot('7-menu-mobile');
await page.setViewportSize({ width: 1280, height: 900 });

check('ページのエラーがない', errors.length === 0, errors.join(' / '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} / ${results.length} 件成功`);
process.exitCode = failed ? 1 : 0;
