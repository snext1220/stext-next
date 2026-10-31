// 旧エンジンとの差分テスト。
//
// 旧リポジトリ（snext1220/stext）の jQuery 版エンジンをヘッドレス Chromium で動かし、
// 新エンジン（@stext/core）と同じ選択を続けて、毎回の状態と選べる選択肢を比べる。
// 乱数は両方とも同じ固定値を返すようにして、キャラ生成やランダム遷移の結果をそろえる。
//
// 使い方:
//   1. 旧リポジトリを ../stext に clone し、そのディレクトリで HTTP サーバーを起動する
//      （例: cd ../stext && python3 -m http.server 8765）
//   2. npm run build
//   3. node scripts/difftest.mjs [--base http://localhost:8765] [--steps 60] [scepter slayer ...]
//
// Chromium と playwright が必要（CI では実行しない）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createEngine, emptyGlobalState } from '@stext/core';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = opt('--base', 'http://localhost:8765');
const maxSteps = Number(opt('--steps', '60'));
const walks = Number(opt('--walks', '3'));
const checkText = args.includes('--text') ? (args.splice(args.indexOf('--text'), 1), true) : false;
const root = new URL('../scenarios/', import.meta.url);
const ids = args.length
  ? args
  : readdirSync(root).filter((id) => existsSync(new URL(`${id}/scenario.json`, root)));

// 乱数の固定値（歩くたびに変える）と、選択肢を選ぶための別の乱数
const FIXED = [0.5, 0.25, 0.75, 0.1, 0.9];
function chooser(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 比べやすい形にそろえる（旧エンジンは数値を文字列で持つことがある） */
function normalize(state) {
  const s = JSON.parse(JSON.stringify(state));
  const fix = (v) =>
    typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
  for (const k of Object.keys(s.chara)) s.chara[k] = fix(s.chara[k]);
  // 8個目以降の星は旧シナリオの誤り（変換時に警告して取り除いている）なので比べない
  s.stars = s.stars.slice(0, 7).map(fix);
  for (const k of Object.keys(s.params)) s.params[k] = fix(s.params[k]);
  s.scene = String(s.scene);
  delete s.memos;
  delete s.chara.poison_scene;
  if (s.bonus === undefined || s.bonus === null) delete s.bonus;
  return s;
}

function diff(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diff(a[k], b[k], `${path}.${k}`),
    );
  }
  return [`${path}: 旧=${JSON.stringify(a)} 新=${JSON.stringify(b)}`];
}

let textMismatches = 0;

const resultCounts = new Map();
function resultCount(id) {
  if (!resultCounts.has(id)) {
    const file = new URL(`${id}/scenario.json`, root);
    resultCounts.set(
      id,
      existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).results.length : 0,
    );
  }
  return resultCounts.get(id);
}

/** 本文の比較用：Markdown の記号・HTML タグ・空白を除いた文字だけにする（Markdown の解釈の差は見ない） */
function textOf(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&amp;|&lt;|&gt;/g, '')
    .replace(/^\s*(#{1,6}|>|[-+*]|\d+\.)\s+/gm, '')
    .replace(/[*_~`\\|!-]/g, '')
    .replace(/\s+/g, '');
}

/** ラベルの比較用：HTML タグと Markdown の強調記号、空白を除く */
const plain = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/\s+/g, '');

const browser = await chromium.launch();
const summary = [];
for (const id of ids) {
  const scenario = JSON.parse(readFileSync(new URL(`${id}/scenario.json`, root), 'utf8'));
  if (!scenario.scenes.some((s) => s.id === '0')) continue;
  let steps = 0;
  const problems = [];
  for (let w = 0; w < walks; w++) {
    const fixed = FIXED[w % FIXED.length];
    const pickChoice = chooser(1000 + w);
    const page = await browser.newPage();
    const errors = [];
    page.on('dialog', (d) => d.dismiss());
    page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0]));
    await page.addInitScript((r) => {
      Math.random = () => r;
      localStorage.clear();
      document.cookie
        .split(';')
        .forEach(
          (c) => (document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT'),
        );
    }, fixed);
    await page.goto(`${base}/index.html`);
    await page.evaluate((sid) => window.jQuery('#main').startGame(sid, false), id);
    try {
      await page.waitForFunction((sid) => localStorage.getItem(sid) !== null, id, {
        timeout: 10000,
      });
    } catch {
      problems.push(`walk ${w}: 旧エンジンが起動しませんでした`);
      await page.close();
      continue;
    }

    // ${result?id} / ${result_rate?id}：旧エンジンの PlayerRank と同じく、獲得済み実績数とシナリオの実績総数
    let global = emptyGlobalState();
    const scenarioResults = (sid) => ({
      count: global.results[sid]?.length ?? 0,
      all: resultCount(sid),
    });
    const engine = createEngine(scenario, { scenarioId: id, random: () => fixed, scenarioResults });
    let state;
    ({ state, global } = engine.start(global));

    let carried = false;
    for (let step = 0; step < maxSteps; step++) {
      await page.waitForTimeout(30);
      const legacy = await page.evaluate((sid) => {
        const $ = window.jQuery;
        const links = $('#main a.scenebtn')
          .filter((_, a) => !['end_reload', 'end_exit'].includes(a.id))
          .map((_, a) => a.textContent)
          .get();
        const main = $('#main').clone();
        // ul.texts は演出（Textillate）が持つ元の文章の写しなので除く
        main
          .find(
            '#scenario_title, .scene_summary, #debug_panel, a.scenebtn, .xbtn, script, img, ul.texts',
          )
          .remove();
        const text = main.text();
        return {
          save: JSON.parse(localStorage.getItem(sid)),
          global: JSON.parse(localStorage.getItem('sorcerian_text')),
          links,
          text,
        };
      }, id);
      steps++;
      const where = `walk ${w} step ${step} §${state.scene}`;
      const d = diff(normalize(legacy.save), normalize(state));
      if (d.length) {
        problems.push(
          `${where}: 状態が違います\n      ${d.slice(0, 6).join('\n      ')}${errors.length ? `\n      旧エンジンのエラー: ${errors.slice(-2).join(' / ')}` : ''}`,
        );
        break;
      }
      // 引き継ぎデータを比べたら、この冒険は終わり
      if (carried) break;
      const gd = diff(legacy.global.results ?? {}, global.results);
      if (gd.length) problems.push(`${where}: 実績が違います ${gd.slice(0, 3).join(' / ')}`);

      const view = engine.view(state, global);
      const ours = view.choices.filter((c) => c.kind === 'go');
      const a = legacy.links.map(plain);
      const b = ours.map((c) => plain(c.label));
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        problems.push(
          `${where}: 選択肢が違います\n      旧=${JSON.stringify(a)}\n      新=${JSON.stringify(b)}`,
        );
        break;
      }
      if (checkText && !view.end) {
        const ourText = textOf(
          view.markdown +
            '\n' +
            (view.afterText ?? '') +
            view.choices.map((c) => c.before ?? '').join(''),
        );
        const theirs = textOf(legacy.text);
        if (ourText !== theirs) {
          textMismatches++;
          let i = 0;
          while (i < ourText.length && ourText[i] === theirs[i]) i++;
          const at = Math.max(0, i - 20);
          if (textMismatches <= 3)
            problems.push(
              `${where}: 本文が違います（参考、${i}文字目から）\n      旧=…${theirs.slice(at, at + 80)}\n      新=…${ourText.slice(at, at + 80)}`,
            );
        }
      }
      if (state.isEnded || ours.length === 0) break;

      const k = Math.floor(pickChoice() * ours.length);
      const result = engine.choose(state, global, ours[k].index);
      if (
        result.kind === 'back' ||
        (result.kind === 'rejected' && result.reason === 'missingScene')
      )
        break;
      const before = JSON.stringify(legacy.save);
      await page.evaluate((i) => {
        const $ = window.jQuery;
        $('#main a.scenebtn')
          .filter((_, a) => !['end_reload', 'end_exit'].includes(a.id))
          .eq(i)
          .trigger('click');
      }, k);
      if (result.kind === 'moved') {
        state = result.state;
        global = result.global;
        // 続編が同じシナリオなら、旧エンジンは引き継ぎ用のデータでセーブデータを上書きする
        if (result.carryOver?.[id]) {
          state = result.carryOver[id];
          carried = true;
        }
        try {
          await page.waitForFunction(([sid, s]) => localStorage.getItem(sid) !== s, [id, before], {
            timeout: 5000,
          });
        } catch {
          problems.push(
            `${where}: 旧エンジンでは移動しませんでした（新エンジンは §${state.scene} へ移動）${errors.length ? `\n      旧エンジンのエラー: ${errors.slice(-2).join(' / ')}` : ''}`,
          );
          break;
        }
      }
    }
    await page.close();
  }
  summary.push({ id, steps, problems });
  console.log(
    `${problems.length ? '✗' : '✓'} ${id}: ${steps} 手を比較${problems.length ? `、不一致 ${problems.length}` : ''}`,
  );
  for (const p of problems.slice(0, 3)) console.log(`    ${p}`);
}
await browser.close();
const bad = summary.filter((s) => s.problems.length);
console.log(
  `\n${summary.length} シナリオ、${summary.reduce((n, s) => n + s.steps, 0)} 手を比較。不一致のあるシナリオ: ${bad.length}`,
);
process.exitCode = bad.length ? 1 : 0;
