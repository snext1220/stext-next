// エディター補完用の JSON Schema を @stext/schema から生成する。
// GitHub Pages の schema/ 以下に公開される。
// 使い方: npm run build && npm run schema
import { writeFileSync } from 'node:fs';
import { scenarioIndexJsonSchema, scenarioJsonSchema } from '@stext/schema';

for (const [name, schema] of [
  ['scenario.v2.json', scenarioJsonSchema()],
  ['scenario-index.v1.json', scenarioIndexJsonSchema()],
]) {
  const out = new URL(`../schema/${name}`, import.meta.url);
  writeFileSync(out, JSON.stringify(schema, null, 2) + '\n');
  console.log(`wrote ${out.pathname}`);
}
