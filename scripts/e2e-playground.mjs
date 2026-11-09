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
import { strFromU8, unzipSync } from 'fflate';

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
const allNodes = page.locator('.react-flow__minimap-node');
const selectedId = async () =>
  `§${await page.getByLabel('シーン ID', { exact: true }).inputValue()}`;
const tab = (name) => page.locator('[role=tab]', { hasText: name }).click();
const field = (label) => page.getByLabel(label, { exact: true });

// 初回：空のシナリオから始まる
await page.goto(`${base}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.flow-node');
check('最初は空のシナリオ（シーン 0 だけ）', (await nodes.count()) === 1);

// テンプレート
await page.getByRole('button', { name: '作品…' }).click();
await page.getByRole('dialog', { name: '作品' }).waitFor();
await page.keyboard.press('Escape');
await page.getByRole('dialog', { name: '作品' }).waitFor({ state: 'detached' });
await page.getByRole('button', { name: '作品…' }).click();
await page.getByLabel('テンプレート', { exact: true }).selectOption('mini15');
await page.getByRole('button', { name: 'テンプレートを開く' }).click();
await wait(1000);
check('テンプレートを開ける', (await allNodes.count()) === 16, `${await allNodes.count()} シーン`);
check('最初のシーンが見える大きさで表示される', (await nodes.first().boundingBox()).width > 80);
await shot('1-template');

const sceneSelect = page.getByRole('combobox', { name: '編集するシーン', exact: true });
await sceneSelect.selectOption('10');
await wait();
check(
  'シーン一覧から編集対象とフロー図の選択を切り替えられる',
  (await selectedId()) === '§10' && (await field('シーン ID').inputValue()) === '10',
);

// シーンの選択・追加・名前の変更
await nodes.filter({ hasText: '§1' }).first().click();
await wait();
check('シーンをクリックすると編集できる', (await selectedId()) === '§1');
check('フロー図の選択がシーン一覧にも反映される', (await sceneSelect.inputValue()) === '1');
const edgesBefore = await page.locator('.react-flow__edge').count();
await page.getByRole('button', { name: '＋ 選択中のシーンから' }).click();
await wait();
const added = await selectedId();
check(
  '選択中のシーンから新しいシーンを作ると線も引かれる',
  (await allNodes.count()) === 17 &&
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

// ダイナミックヘルプ
const helpTitle = () => page.locator('.pg-help h2').innerText();
const helpButton = (name) => page.locator('.pg-help-head button', { hasText: name });
await page.locator('.pg-help-button[data-help="scene.text"]').click();
await wait();
check('「?」でその項目のヘルプを開ける', (await helpTitle()) === '本文', await helpTitle());
await page.locator('.pg-help-related button', { hasText: '本文で使える式' }).click();
await wait();
const related = await helpTitle();
await helpButton('戻る').click();
await wait();
check(
  'ヘルプの関連項目へ移り、戻れる',
  related === '本文で使える式' && (await helpTitle()) === '本文',
  related,
);
await shot('2-help');
await page.keyboard.press('Escape');
await wait();
const closed = (await page.locator('.pg-help').count()) === 0;
await page.locator('.pg-label label', { hasText: /^BGM$/ }).dblclick();
await wait();
check(
  'Esc で閉じ、項目名のダブルクリックでもヘルプを開ける',
  closed && (await helpTitle()) === 'BGM',
  await helpTitle(),
);
await helpButton('目次').click();
await page.getByLabel('移行メモで絞り込む').selectOption('要確認');
const pending = await page.locator('.pg-help-index li').count();
await page.getByLabel('移行メモで絞り込む').selectOption('');
await page.getByLabel('ヘルプを検索').fill('ルビ');
await page.locator('.pg-help-index li button', { hasText: 'ルビ' }).first().click();
await wait();
check(
  'ヘルプの目次で検索・移行メモの絞り込みができる',
  (await helpTitle()) === 'ルビ' && pending > 0,
  `要確認 ${pending} 件`,
);
await helpButton('閉じる').click();
await wait();

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
  await page.evaluate(() =>
    JSON.parse(localStorage.getItem('stext-next:playground:current')).scenes.some(
      (s) => s.id === 'town',
    ),
  ),
);

// 保存済み作品一覧から作品を切り替える
await page.getByRole('button', { name: '作品…' }).click();
await page.getByRole('button', { name: '新しいシナリオ' }).click();
await wait();
await page.getByRole('button', { name: '作品…' }).click();
await page.getByRole('button', { name: '作品一覧を開く' }).click();
await page.locator('.pg-project-open:not(:disabled)').first().click();
await wait(600);
check('保存済みの作品一覧から作品を開き直せる', (await allNodes.count()) === 17);

// JSON で保存
await page.getByRole('button', { name: 'エクスポート…' }).click();
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'シナリオだけをJSONでダウンロード' }).click(),
]);
const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
check(
  'JSON で保存できる（stext/2 形式）',
  saved.format === 'stext/2' && saved.scenes.some((s) => s.id === 'town'),
  download.suggestedFilename(),
);

// 素材とシナリオをZIPへまとめる
await tab('定義');
await page.locator('.pg-subtabs button', { hasText: '基本' }).click();
await field('シナリオ ID').fill('e2e-archive');
await tab('シーン');
await field('本文').fill('![一括登録の画像](e2e-scene.png)');
await tab('素材');
await page.locator('.pg-resource-add input[type="file"]').setInputFiles(
  ['e2e-scene.png', 'e2e-unused.png'].map((name) => ({
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  })),
);
await page.getByText('登録 2 件・スキップ 0 件・失敗 0 件', { exact: true }).waitFor();
const referencedImage = page
  .locator('.pg-resource')
  .filter({ has: page.getByText('capture/e2e-scene.png', { exact: true }) });
check(
  '素材を一括登録し、完全一致した参照に紐づける',
  (await referencedImage.innerText()).includes('登録済み · e2e-scene.png') &&
    (await page.getByText('capture/e2e-unused.png', { exact: true }).count()) === 1,
);
await page.locator('.pg-resource-add select').selectOption('chara/');
await page.locator('.pg-resource-add input[type="file"]').setInputFiles({
  name: 'e2e.png',
  mimeType: 'image/png',
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
});
await page.getByText('chara/e2e.png', { exact: true }).waitFor();
const [archiveDownload] = await Promise.all([
  page.waitForEvent('download'),
  (async () => {
    await page.getByRole('button', { name: 'エクスポート…' }).click();
    await page.getByRole('button', { name: '作品一式をZIPでダウンロード' }).click();
  })(),
]);
const archiveFiles = unzipSync(new Uint8Array(readFileSync(await archiveDownload.path())));
check(
  'ZIPにシナリオと未参照登録素材を収録する',
  Boolean(
    archiveFiles['e2e-archive/scenario.json'] &&
    archiveFiles['e2e-archive/chara/e2e.png'] &&
    archiveFiles['e2e-archive/capture/e2e-scene.png'] &&
    archiveFiles['e2e-archive/capture/e2e-unused.png'] &&
    JSON.parse(strFromU8(archiveFiles['e2e-archive/scenario.json'])).meta.id === 'e2e-archive',
  ),
  archiveDownload.suggestedFilename(),
);
await page.reload();
await page.waitForSelector('.flow-node');
await tab('素材');
check(
  '登録素材を再読み込み後も使える',
  (await page.getByText('chara/e2e.png', { exact: true }).count()) === 1 &&
    (await referencedImage.innerText()).includes('登録済み · e2e-scene.png') &&
    (await page.getByText('capture/e2e-unused.png', { exact: true }).count()) === 1,
);

// 提出画面（別タブのPOSTはモックし、外部サービスへ実送信しない）
const submissions = [];
const submissionEndpoint = 'https://form.os7.biz/form/submit/';
await ctx.route('https://form.os7.biz/**', (route) => {
  submissions.push(new URLSearchParams(route.request().postData() ?? ''));
  return route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html lang="ja"><meta charset="utf-8"><title>確認画面（テスト）</title><h1>確認画面（テスト）</h1></html>',
  });
});
await page.getByRole('button', { name: '提出…' }).click();
const postDialog = page.getByRole('dialog', { name: '作品を提出' });
check(
  '提出：scenario.jsonの作品名とIDを読み取り専用で表示する',
  (await postDialog.getByText('e2e-archive', { exact: true }).count()) === 1 &&
    (await postDialog.getByText('作品名', { exact: true }).count()) === 1,
);
const formNames = await postDialog
  .locator('[name]')
  .evaluateAll((fields) => fields.map((field) => field.getAttribute('name')));
check(
  '提出：オレンジフォームの項目名を使い、ファイル添付欄を置かない',
  [
    'single_seimei',
    'mail',
    'free1',
    'free2',
    'free3',
    'free4',
    'free5',
    'free6',
    'free7',
    'of_dummy_note',
    'form_id',
    'encoding_test',
    'base_url',
    'urlhash',
    'oid',
  ].every((name) => formNames.includes(name)) &&
    (await postDialog.locator('input[type="file"]').count()) === 0,
);
await postDialog.getByLabel('ペンネーム（作者名）', { exact: true }).fill('e2e作者');
await postDialog.getByLabel('連絡先（メールアドレス）', { exact: true }).fill('e2e@example.com');
await postDialog.getByLabel('分類', { exact: true }).fill('短編');
await postDialog
  .getByLabel('シナリオ紹介（2〜300文字）', { exact: true })
  .fill('E2E提出の確認用シナリオです。');
await postDialog.getByLabel('作者より（80文字程度）', { exact: true }).fill('確認をお願いします。');
await postDialog
  .getByLabel('ダウンロードURL（必須）', { exact: true })
  .fill('https://gigafile.nu/e2e');
await postDialog.getByLabel('保持期間（7日以上）', { exact: true }).fill('7日');
const zipDownloadPromise = page.waitForEvent('download');
await postDialog.getByRole('button', { name: 'ZIPを作成してダウンロード' }).click();
const submissionArchiveDownload = await zipDownloadPromise;
const submissionArchive = unzipSync(
  new Uint8Array(readFileSync(await submissionArchiveDownload.path())),
);
check(
  '提出：作品スナップショットと登録素材をZIPにする',
  Boolean(
    submissionArchive['e2e-archive/scenario.json'] &&
    submissionArchive['e2e-archive/chara/e2e.png'],
  ),
);
const [submissionPage] = await Promise.all([
  ctx.waitForEvent('page'),
  postDialog.getByRole('button', { name: '作品を提出', exact: true }).click(),
]);
await submissionPage.waitForLoadState();
check(
  '提出：別タブへPOSTし、発行HTMLのhidden値と投稿情報を送る',
  submissionPage.url() === submissionEndpoint &&
    (await submissionPage.locator('h1').textContent()) === '確認画面（テスト）' &&
    (await submissionPage.evaluate(() => window.opener === null)) &&
    submissions.length === 1 &&
    submissions[0].get('form_id') === '261098' &&
    submissions[0].get('encoding_test') === 'あいうえお眉幅ABC' &&
    submissions[0].get('mail') === 'e2e@example.com' &&
    submissions[0].get('single_seimei') === 'e2e作者' &&
    submissions[0].get('free5') === 'https://gigafile.nu/e2e' &&
    submissions[0].get('free6') === '7' &&
    submissions[0].get('of_dummy_note') === '',
);
check(
  '提出：元の画面に入力を残し、受付成功とは表示しない',
  (await postDialog.getByRole('status').allTextContents()).some((text) =>
    text.includes('受付・メール送信の完了を確認できません'),
  ) &&
    (await postDialog.getByLabel('連絡先（メールアドレス）', { exact: true }).inputValue()) ===
      'e2e@example.com',
);
await submissionPage.close();
await shot('7-submission');
await postDialog.getByRole('button', { name: '閉じる' }).first().click();
await ctx.unroute('https://form.os7.biz/**');

// 旧形式の XML を開く
await page.getByRole('button', { name: '作品…' }).click();
await page.setInputFiles('#work-open-file', miniXml);
await wait(1000);
check(
  '旧形式の XML を変換して開ける',
  (await page.locator('.pg-message').innerText()).includes('変換') && (await allNodes.count()) > 5,
  `${await allNodes.count()} シーン`,
);

// 公開シナリオ
await page.getByRole('button', { name: '作品…' }).click();
const published = await page.getByLabel('公開シナリオ').locator('option').count();
await page.getByLabel('公開シナリオ', { exact: true }).selectOption('scepter');
await page.getByRole('button', { name: '公開シナリオを開く' }).click();
await wait(1500);
check(
  '公開シナリオを開ける',
  published > 20 && (await allNodes.count()) > 50,
  `${await allNodes.count()} シーン`,
);

// グループ別のシーン選択
const groupedScenario = {
  format: 'stext/2',
  meta: { title: 'グループ選択テスト' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  licence: [],
  groups: [
    { title: '後半', start: '20', end: '100' },
    { title: '前半', start: '2', end: '10' },
  ],
  scenes: ['100', '10', 'town', '2', '20', '0'].map((id, i) => ({
    id,
    summary: `シーン${id}`,
    text: '',
    choices: [],
    editor: { x: i * 2000, y: 0 },
  })),
};
await page.getByRole('button', { name: '作品…' }).click();
await page.setInputFiles('#work-open-file', {
  name: 'groups.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(groupedScenario)),
});
await wait();
const groupedOptions = await sceneSelect
  .locator('optgroup')
  .evaluateAll((groups) =>
    groups.map((group) => [
      group.label,
      Array.from(group.querySelectorAll('option'), (option) => option.value),
    ]),
  );
check(
  'シーン一覧をグループの開始ID・シーンID順に並べ、未所属も表示する',
  JSON.stringify(groupedOptions) ===
    JSON.stringify([
      ['前半', ['2', '10']],
      ['後半', ['20', '100']],
      ['グループ未所属', ['0', 'town']],
    ]),
);
await sceneSelect.selectOption('0');
await wait();
const focused = await nodes.filter({ hasText: '§0' }).boundingBox();
const flowPane = await page.locator('.flow').boundingBox();
check(
  '画面外のシーンを一覧から選ぶとフロー図内に表示される',
  (await field('シーン ID').inputValue()) === '0' &&
    focused &&
    flowPane &&
    focused.x >= flowPane.x &&
    focused.x + focused.width <= flowPane.x + flowPane.width &&
    focused.y >= flowPane.y &&
    focused.y + focused.height <= flowPane.y + flowPane.height,
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
