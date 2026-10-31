// 旧 Playground のテンプレート（snext1220/stext の playground/template/*.json）を stext/2 に変換し、
// apps/playground/public/templates/ に置く。一覧は templates.json。
//
// 使い方: npm run build && node scripts/import-playground-templates.mjs [旧リポジトリの playground/template]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertPlaygroundJson } from '@stext/convert';

const source =
  process.argv[2] ?? fileURLToPath(new URL('../../stext/playground/template', import.meta.url));
const dest = fileURLToPath(new URL('../apps/playground/public/templates', import.meta.url));

// 旧 Playground のテンプレート選択と同じ名前と順
const TEMPLATES = [
  ['empty', '空のテンプレート'],
  ['sample5', 'シンプルサンプル'],
  ['mini15', '15sceneサンプル（説明あり）'],
  ['sample20', '20sceneサンプル（簡易版）'],
  ['bakumatsu', '幕末ソーサリアン'],
  ['dragon', 'ドラゴンモード例'],
  ['function', '機能テスト'],
];

mkdirSync(dest, { recursive: true });
const list = [];
for (const [id, name] of TEMPLATES) {
  const r = convertPlaygroundJson(JSON.parse(readFileSync(join(source, `${id}.json`), 'utf8')), {});
  delete r.scenario.meta.id;
  writeFileSync(join(dest, `${id}.json`), JSON.stringify(r.scenario, null, 2) + '\n');
  list.push({ id, name, scenes: r.scenario.scenes.length });
  const errors = r.issues.filter((i) => i.severity === 'error').length;
  console.log(
    `${id}: ${r.scenario.scenes.length} シーン、エラー ${errors}、警告 ${r.issues.length - errors}`,
  );
}
writeFileSync(join(dest, 'templates.json'), JSON.stringify(list, null, 2) + '\n');
