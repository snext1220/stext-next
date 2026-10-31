/**
 * 本文の展開。旧エンジン（sgml.js の decorateText / interpolation）と同じ順序で ${...} マクロを処理し、
 * UI が描画する Markdown を返す。
 *
 * Markdown の中には次の HTML が入ることがある（UI 側で描画する）:
 * - <span style="color:..."> … %blue% など文字色
 * - <span class="stext-secret"> … %secret% の伏せ字（タップで表示）
 * - <span class="stext-hidden"> … %white% の見えない文字（選択すると見える）
 * - <ruby> … ${漢字|かんじ}
 * - <div class="stext-effect" data-effect="..."> … ${effect ...} の演出
 * - <stext-input param="p01"> / <stext-input value="..."> … ${input?...} の入力欄
 */
import { parseCondition, type ConditionNode, type Scenario, type Scene } from '@stext/schema';
import { evaluateCondition, type ConditionContext } from './condition.js';
import { ELEMENT_NAMES } from './data.js';
import { pick, randomInt, type RandomSource } from './random.js';
import type { GameState } from './state.js';

export interface TextContext {
  scenario: Scenario;
  scenes: ReadonlyMap<string, Scene>;
  state: GameState;
  condition: ConditionContext;
  random: RandomSource;
  paramValue: (id: string) => string | number | undefined;
  /** ${result?id} / ${result_rate?id} 用：他のシナリオの実績数 */
  scenarioResults?: (id: string) => { count: number; all: number } | undefined;
}

export interface ExpandedText {
  markdown: string;
  /** ${tweet}...${/tweet} で指定された共有用の文 */
  tweet?: string;
}

const conditionCache = new Map<string, ConditionNode | null>();

/** 文字列の条件を判定する。解釈できない条件は偽 */
export function judge(source: string, ctx: ConditionContext): boolean {
  let node = conditionCache.get(source);
  if (node === undefined) {
    const r = parseCondition(source);
    node = r.ok ? r.node : null;
    conditionCache.set(source, node);
  }
  return node !== null && evaluateCondition(node, ctx);
}

/** シーン本文を展開する（共通フッターの付加を含む） */
export function expandSceneText(scene: Scene, ctx: TextContext): ExpandedText {
  let text = importScenes(scene.text, ctx);
  const footer = ctx.scenario.meta.footerScene;
  if (footer && !scene.excludeFooter && !scene.end) {
    text += importScenes(ctx.scenes.get(footer)?.text ?? '', ctx).trim();
  }
  return expandText(text, ctx);
}

/** ${import シーンID} を、そのシーンの本文に置き換える（入れ子は1段まで。旧エンジンと同じ） */
function importScenes(text: string, ctx: TextContext) {
  return text.replace(
    /\$\{import[\s]+(.+?)\}/gi,
    (_, id: string) => ctx.scenes.get(id.trim())?.text ?? '',
  );
}

/** マクロを展開する（${import} を除く） */
export function expandText(source: string, ctx: TextContext): ExpandedText {
  let tweet: string | undefined;
  let t = source;
  t = decorate(t);
  // 条件付きの文章
  t = t.replace(/\$\{if[\s]+(.+?)\}([\s\S]+?)\$\{\/if\}/gi, (_, cond: string, body: string) =>
    judge(cond, ctx.condition) ? body : '',
  );
  // 演出
  t = t.replace(
    /\$\{effect[\s]+(.+?)\}([\s\S]+?)\$\{\/effect\}/gi,
    (_, args: string, body: string) =>
      `<div class="stext-effect" data-effect="${escapeAttr(args)}">${body}</div>`,
  );
  // 共有用の文
  t = t.replace(/\$\{tweet\}([\s\S]+?)\$\{\/tweet\}/gi, (_, body: string) => {
    tweet = body;
    return body;
  });
  // 変数など
  t = t.replace(/\$\{(.+?)\}/gi, (match, sub: string) => interpolate(match, sub, ctx));
  // ルビ
  t = t.replace(/\$\{(.+?)\|(.+?)\}/gi, '<ruby>$1<rp>（</rp><rt>$2</rt><rp>）</rp></ruby>');
  return tweet === undefined ? { markdown: t } : { markdown: t, tweet };
}

/**
 * 文字色（%blue%…%/%）と伏せ字（%secret%…%/%）。
 * %white% は背景の色に関係なく見えない文字（選択すると見える）にする。
 * 伏せ字の中の空行は段落を分けず、伏せ字がひとまとまりのまま改行されるようにする。
 */
function decorate(source: string): string {
  const stack: string[] = [];
  let out = '';
  let last = 0;
  for (const m of source.matchAll(/%(blue|red|purple|white|secret)%|%\/%/gi)) {
    let chunk = source.slice(last, m.index);
    if (stack.includes('secret')) chunk = chunk.replace(/\n[ \t]*(?=\n)/g, '\n&nbsp;');
    out += chunk;
    last = m.index + m[0].length;
    const kind = m[1]?.toLowerCase();
    if (kind === undefined) {
      stack.pop();
      out += '</span>&nbsp;';
    } else {
      stack.push(kind);
      out +=
        kind === 'secret'
          ? '&nbsp;<span class="stext-secret">'
          : kind === 'white'
            ? '&nbsp;<span class="stext-hidden">'
            : `&nbsp;<span style="color:${kind}">`;
    }
  }
  return out + source.slice(last);
}

function interpolate(match: string, sub: string, ctx: TextContext): string {
  const [name = '', rest] = sub.split('?');
  const args = rest !== undefined ? rest.split(':') : [];
  const c = ctx.state.chara;
  const s = ctx.scenario;
  const choose = (key: string, keys: string[], unknown: string) => {
    const i = keys.indexOf(key);
    return i >= 0 ? (args[i] ?? 'undefined') : unknown;
  };
  switch (name) {
    case 'name':
    case 'title':
    case 'job':
      return String(c[name]);
    case 'hp':
    case 'mp':
    case 'str':
    case 'int':
    case 'dex':
    case 'krm':
    case 'free1':
    case 'free2':
    case 'free3':
      return String(c[name]);
    case 'result':
    case 'result_rate': {
      const info = ctx.scenarioResults?.(args[0] ?? '');
      if (!info) return '?????';
      return String(name === 'result' ? info.count : Math.floor((info.count / info.all) * 100));
    }
    case 'race':
      return choose(c.race, ['FIGHTER', 'WIZARD', 'DWARF', 'ELF'], 'Unknown Race');
    case 'sex':
      return choose(c.sex, ['MALE', 'FEMALE'], 'Unknown Sex');
    case 'age':
      return choose(c.age, ['YOUNG', 'ADULT', 'OLD'], 'Unknown Age');
    case 'state':
      return choose(c.state, ['', 'poison', 'frozen', 'stone', 'curse', 'forget'], 'Unknown State');
    case 'rand':
      return String(randomInt(ctx.random, Number(args[0]), Number(args[1])));
    case 'msg':
      return String(pick(ctx.random, args));
    case 'var':
      return variable(args[0] ?? '', args[1] ?? '', ctx, s);
    case 'input': {
      const key = args[0] ?? '';
      return key.startsWith('p')
        ? `<stext-input param="${escapeAttr(key)}" value="${escapeAttr(String(ctx.paramValue(key) ?? ''))}"></stext-input>`
        : `<stext-input value="${escapeAttr(key)}"></stext-input>`;
    }
    default:
      return match;
  }
}

function variable(id: string, field: string, ctx: TextContext, s: Scenario): string {
  if (id.startsWith('p')) {
    const p = s.params.find((x) => x.id === id);
    if (field === 'text') return String(p?.text ?? '');
    if (field === 'value') return String(ctx.paramValue(id));
  } else if (id.startsWith('m')) {
    const m = s.enemies.find((x) => x.id === id);
    if (field === 'name') return String(m?.name);
    if (field === 'element') return String(ELEMENT_NAMES[m?.element ?? '']);
    if (field === 'text') return String(m?.text ?? '');
  } else if (id.startsWith('i')) {
    const i = s.items.find((x) => x.id === id);
    if (field === 'name') return String(i?.name);
    if (field === 'text') return String(i?.text ?? '');
  } else if (id.startsWith('r')) {
    const r = s.results.find((x) => x.id === id);
    if (field === 'name') return String(r?.name);
    if (field === 'level') return String(r?.level);
    if (field === 'text') return String(r?.text ?? '');
  }
  return 'Unknow Variable';
}

function escapeAttr(v: string) {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
