// schema/scenario.v2.json（エディター補完用の JSON Schema）を @stext/schema から生成する。
// GitHub Pages で https://snext1220.github.io/stext-next/schema/scenario.v2.json として公開される。
// 使い方: npm run build && npm run schema
import { writeFileSync } from 'node:fs';
import { scenarioJsonSchema } from '@stext/schema';

const out = new URL('../schema/scenario.v2.json', import.meta.url);
writeFileSync(out, JSON.stringify(scenarioJsonSchema(), null, 2) + '\n');
console.log(`wrote ${out.pathname}`);
