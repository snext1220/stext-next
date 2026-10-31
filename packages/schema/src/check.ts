/**
 * スキーマでは表せない整合性の検査（参照先の存在、条件の構文など）。
 */
import {
  parseCondition,
  walkCondition,
  type Condition,
  type ConditionNode,
  type ParseOptions,
} from './condition.js';
import { BACK_SCENE_ID, type Scenario } from './scenario.js';

export interface CheckIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

const IF_MACRO = /\$\{if[\s]+(.+?)\}/gi;
const IMPORT_MACRO = /\$\{import[\s]+(.+?)\}/gi;

export function checkScenario(scenario: Scenario): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const error = (path: string, message: string) => issues.push({ severity: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ severity: 'warning', path, message });

  const ids = (list: { id: string }[], name: string) => {
    const set = new Set<string>();
    list.forEach((x, i) => {
      if (set.has(x.id)) warn(`${name}[${i}]`, `ID「${x.id}」が重複しています`);
      set.add(x.id);
    });
    return set;
  };
  const scenes = ids(scenario.scenes, 'scenes');
  const items = ids(scenario.items, 'items');
  const flags = ids(scenario.flags, 'flags');
  const params = ids(scenario.params, 'params');
  const enemies = ids(scenario.enemies, 'enemies');
  const results = ids(scenario.results, 'results');
  const parseOptions: ParseOptions = { flags, items };

  const sceneRef = (path: string, target: string) => {
    if (target !== BACK_SCENE_ID && !scenes.has(target)) error(path, `遷移先のシーン「${target}」がありません`);
  };
  const conditionRefs = (path: string, node: ConditionNode) => {
    for (const n of walkCondition(node)) {
      if ('flag' in n && !flags.has(n.flag)) warn(path, `フラグ「${n.flag}」が定義されていません`);
      if ('item' in n && !items.has(n.item)) warn(path, `アイテム「${n.item}」が定義されていません`);
      if ('has' in n) warn(path, `「${n.has}」はフラグにもアイテムにも定義されていません`);
      if ('param' in n && !params.has(n.param)) warn(path, `パラメーター「${n.param}」が定義されていません`);
    }
  };
  const condition = (path: string, c: Condition) => {
    if (typeof c === 'string') {
      const r = parseCondition(c, parseOptions);
      if (!r.ok) return error(path, `条件を解釈できません: ${r.error}`);
      return conditionRefs(path, r.node);
    }
    conditionRefs(path, c);
  };
  const stripOp = (v: string) => v.replace(/^-/, '').split(':')[0]!;

  if (scenario.meta.footerScene) sceneRef('meta.footerScene', scenario.meta.footerScene);

  // 本文の部品やルール表示として読み込まれるシーン（選択肢がなくてもよい）
  // 99999 は Battle Sheet の既定のルール
  const included = new Set<string>([BACK_SCENE_ID, '99999']);
  if (scenario.meta.footerScene) included.add(scenario.meta.footerScene);
  for (const g of scenario.groups) if (g.rule) included.add(g.rule);
  for (const scene of scenario.scenes) {
    if (scene.rule) included.add(scene.rule);
    for (const m of scene.text.matchAll(IMPORT_MACRO)) included.add(m[1]!.trim());
  }

  scenario.scenes.forEach((scene, si) => {
    const p = `scenes[${si}]`;
    for (const m of scene.text.matchAll(IF_MACRO)) condition(`${p}.text`, m[1]!);
    for (const m of scene.text.matchAll(IMPORT_MACRO)) {
      const target = m[1]!.trim();
      if (!scenes.has(target)) warn(`${p}.text`, `\${import ${target}} の読み込み先シーンがありません`);
    }
    scene.choices.forEach((c, ci) => {
      const cp = `${p}.choices[${ci}]`;
      if ('kind' in c && c.kind === 'jump') c.allow.forEach((t) => sceneRef(cp, t));
      else if ('kind' in c && c.kind === 'answer') [c.to, c.else].forEach((t) => sceneRef(cp, t));
      else if (!('kind' in c)) {
        c.to.forEach((t) => sceneRef(cp, t));
        if (c.if !== undefined) condition(`${cp}.if`, c.if);
      }
    });
    const e = scene.effects;
    e?.items?.forEach((v) => items.has(stripOp(v)) || warn(`${p}.effects.items`, `アイテム「${stripOp(v)}」が定義されていません`));
    e?.flags?.forEach((v) => flags.has(stripOp(v)) || warn(`${p}.effects.flags`, `フラグ「${stripOp(v)}」が定義されていません`));
    e?.params?.forEach((v) => params.has(stripOp(v)) || warn(`${p}.effects.params`, `パラメーター「${stripOp(v)}」が定義されていません`));
    if (e?.result && !results.has(e.result)) warn(`${p}.effects.result`, `実績「${e.result}」が定義されていません`);
    scene.enemies?.forEach((id) => enemies.has(id) || warn(`${p}.enemies`, `敵「${id}」が定義されていません`));
    if (scene.rule && !scenes.has(scene.rule)) warn(`${p}.rule`, `ルールのシーン「${scene.rule}」がありません`);
    if (!scene.end && scene.choices.length === 0 && !scenario.meta.footerScene && !included.has(scene.id)) {
      warn(p, '選択肢がなく、エンディングでもありません');
    }
  });
  return issues;
}
