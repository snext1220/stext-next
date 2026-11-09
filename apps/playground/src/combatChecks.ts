import { computeDamage, PC_INIT, type Character } from '@stext/core';
import type { CheckIssue, Scenario } from '@stext/schema';

const DAMAGE_ATTACKS = new Set(['physics', 'magic', 'both']);
const STATES = new Set(['poison', 'frozen', 'stone', 'curse', 'forget']);
const STATE_EFFECTS = new Set([...STATES, '-all', ...[...STATES].map((state) => `-${state}`)]);
const SPECIAL_DICE: Record<string, number[]> = {
  high: [4, 5, 6],
  cheat_l: [1, 1, 1, 2, 3, 4, 5, 6],
  cheat_h: [1, 2, 3, 4, 5, 6, 6, 6],
};
const MAX_DICE_COMBINATIONS = 100_000;

interface Formula {
  source: string;
  expression: string;
  statCoefficients: Partial<Record<'str' | 'int' | 'dex' | 'krm', number>>;
}

interface DiceRoll {
  values: number[];
  label: string;
}

interface InitialProfile {
  race: string;
  sex: string;
  hp: number;
  mp: number;
  chara: Character;
}

interface DamageCase {
  damage: number;
  formula: string;
  dice: string;
}

interface PotentialMaximum {
  result: DamageCase;
  profile: InitialProfile;
}

interface Distribution {
  minimum: DamageCase;
  maximum: DamageCase;
  average: number;
  resource: number;
  profile: InitialProfile;
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function parseExpression(
  value: string,
): { expression: string; statCoefficients: Formula['statCoefficients'] } | undefined {
  const expression = normalizeDigits(value.trim());
  if (!expression) return undefined;
  const statCoefficients: Formula['statCoefficients'] = {};
  let position = 0;
  while (position < expression.length) {
    const match = /^([+-]?)(\d*)(RM|LM|R|L|M|STR|INT|DEX|KRM|FREE1|FREE2|FREE3)?/i.exec(
      expression.slice(position),
    );
    if (!match || match[0].length === 0 || (!match[2] && !match[3])) return undefined;
    if (match[2] && !Number.isFinite(Number(match[2]))) return undefined;
    const key = match[3]?.toLowerCase();
    if (key === 'str' || key === 'int' || key === 'dex' || key === 'krm') {
      const coefficient = (match[1] === '-' ? -1 : 1) * Number(match[2] || 1);
      statCoefficients[key] = (statCoefficients[key] ?? 0) + coefficient;
    }
    position += match[0].length;
  }
  return { expression, statCoefficients };
}

function parseFormula(value: string, comparison: boolean): Formula | undefined {
  const source = value.trim();
  if (!source || source.startsWith('*')) return undefined;
  const normalized = normalizeDigits(source);
  const operators = [...normalized.matchAll(/[<>]/g)];
  if (operators.length === 0) {
    const parsed = parseExpression(normalized);
    return parsed ? { source, ...parsed } : undefined;
  }
  if (!comparison || operators.length !== 1) return undefined;
  const index = operators[0]!.index!;
  const left = parseExpression(normalized.slice(0, index));
  const right = parseExpression(normalized.slice(index + 1));
  return left && right ? { source, expression: normalized, statCoefficients: {} } : undefined;
}

function formulaList(value: string, comparison: boolean): Formula[] | undefined {
  if (value.trim().startsWith('*')) return [];
  const sources = value.split(',');
  const formulas = sources.map((source) => parseFormula(source, comparison));
  return formulas.every((formula): formula is Formula => formula !== undefined)
    ? formulas
    : undefined;
}

function numericRange(value: string): [number, number] | undefined {
  const match = /^(-?\d+)\.\.(-?\d+)$/.exec(value);
  if (!match) return undefined;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max
    ? [min, max]
    : undefined;
}

function validInteger(value: string) {
  return /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

function profileFromInit(init: (typeof PC_INIT)[number]): InitialProfile {
  const [race, sex, hp, mp, str, int, dex, krm] = init;
  const chara: Character = {
    name: '',
    title: '',
    race,
    sex,
    age: 'YOUNG',
    job: '',
    state: '',
    stone_scene: 0,
    forget_scene: 0,
    hp_m: hp,
    hp,
    mp_m: mp,
    mp,
    str_i: str,
    str,
    int_i: int,
    int,
    dex_i: dex,
    dex,
    krm_i: krm,
    krm,
    free1: 0,
    free2: 0,
    free3: 0,
  };
  return { race, sex, hp, mp, chara };
}

function initialProfiles(scenario: Scenario): InitialProfile[] {
  const { race, sex } = scenario.meta.constraint ?? {};
  return PC_INIT.filter(
    (init) => (!race || race.includes(init[0])) && (!sex || sex === init[1]),
  ).map(profileFromInit);
}

function enumerateDice(spec?: string): DiceRoll[] | undefined {
  const [rawType = '', rawCount = '', ...extra] = (spec ?? '').split(':');
  if (extra.length > 0) return undefined;
  const type: number | string = rawType
    ? Number.isNaN(Number(rawType))
      ? rawType
      : Number(rawType)
    : 6;
  const count = rawCount ? Number(rawCount) : 2;
  if (!Number.isSafeInteger(count) || count < 1 || count > 5) return undefined;

  let faces: number[];
  if (typeof type === 'number') {
    if (!Number.isSafeInteger(type) || type < 1) return undefined;
    if (type ** count > MAX_DICE_COMBINATIONS) return undefined;
    faces = Array.from({ length: type }, (_, index) => index + 1);
  } else {
    const special = SPECIAL_DICE[type];
    if (!special) return undefined;
    faces = special;
  }
  if (faces.length ** count > MAX_DICE_COMBINATIONS) return undefined;

  const rolls: DiceRoll[] = [];
  const values: number[] = [];
  const visit = (depth: number) => {
    if (depth === count) {
      rolls.push({ values: [...values], label: `[${values.join(',')}]` });
      return;
    }
    for (const face of faces) {
      values.push(face);
      visit(depth + 1);
      values.pop();
    }
  };
  visit(0);
  return rolls;
}

function distribution(
  formulas: Formula[],
  rolls: DiceRoll[],
  profiles: InitialProfile[],
  resource: 'hp' | 'mp',
): Distribution[] {
  return profiles.map((profile) => {
    let minimum: DamageCase | undefined;
    let maximum: DamageCase | undefined;
    let total = 0;
    let count = 0;
    for (const formula of formulas) {
      for (const roll of rolls) {
        const damage = Math.max(0, computeDamage(formula.expression, roll.values, profile.chara));
        const result = { damage, formula: formula.source, dice: roll.label };
        if (!minimum || damage < minimum.damage) minimum = result;
        if (!maximum || damage > maximum.damage) maximum = result;
        total += damage;
        count++;
      }
    }
    return {
      minimum: minimum!,
      maximum: maximum!,
      average: total / count,
      resource: profile[resource],
      profile,
    };
  });
}

function maximumProfile(profile: InitialProfile, formula: Formula): InitialProfile {
  const chara = { ...profile.chara };
  for (const key of ['str', 'int', 'dex', 'krm'] as const) {
    const initialKey = `${key}_i` as const;
    const minimum = profile.chara[initialKey];
    const maximum = Math.min(10, minimum + 2);
    const value = (formula.statCoefficients[key] ?? 0) > 0 ? maximum : minimum;
    chara[key] = value;
    chara[initialKey] = value;
  }
  return { ...profile, chara };
}

function maximumDamage(
  formulas: Formula[],
  rolls: DiceRoll[],
  profiles: InitialProfile[],
): PotentialMaximum {
  let maximum: PotentialMaximum | undefined;
  for (const formula of formulas) {
    for (const profile of profiles) {
      const candidate = maximumProfile(profile, formula);
      for (const roll of rolls) {
        const damage = Math.max(0, computeDamage(formula.expression, roll.values, candidate.chara));
        if (!maximum || damage > maximum.result.damage) {
          maximum = {
            result: { damage, formula: formula.source, dice: roll.label },
            profile: candidate,
          };
        }
      }
    }
  }
  return maximum!;
}

function formatStats(profile: InitialProfile) {
  const { str, int, dex, krm } = profile.chara;
  return `能力値 STR=${str}/INT=${int}/DEX=${dex}/KRM=${krm}`;
}

function formatDistribution(result: Distribution, resource: 'HP' | 'MP') {
  const { minimum, maximum, average, profile } = result;
  return `${profile.race}/${profile.sex} の${formatStats(profile)}、${resource}下限${result.resource}、最小${minimum.damage}（式 ${minimum.formula}・出目${minimum.dice}）／平均${average.toFixed(1)}／最大${maximum.damage}（式 ${maximum.formula}・出目${maximum.dice}）`;
}

function addItemChecks(scenario: Scenario, issues: CheckIssue[]) {
  const error = (path: string, message: string) =>
    issues.push({ severity: 'error', path, message });
  const warn = (path: string, message: string) =>
    issues.push({ severity: 'warning', path, message });
  const profiles = initialProfiles(scenario);
  const paramDefs = new Map<string, Scenario['params'][number]>(
    scenario.params.map((param) => [param.id, param]),
  );
  for (const item of scenario.items) paramDefs.set(`p${item.id}`, { id: `p${item.id}` });

  scenario.params.forEach((param, index) => {
    const path = `params[${index}]`;
    if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
      error(path, `最小値 ${param.min} が最大値 ${param.max} を超えています`);
    }
    if (param.initial === undefined) return;
    const initial = Number(param.initial);
    if (!Number.isFinite(initial)) {
      if (param.min !== undefined || param.max !== undefined) {
        warn(path, '最小値・最大値を指定していますが、初期値が数値ではありません');
      }
      return;
    }
    if (param.min !== undefined && initial < param.min) {
      error(path, `初期値 ${initial} が最小値 ${param.min} を下回っています`);
    }
    if (param.max !== undefined && initial > param.max) {
      error(path, `初期値 ${initial} が最大値 ${param.max} を上回っています`);
    }
  });

  scenario.items.forEach((item, index) => {
    if (!item.target || item.target === 'none') return;
    const path = `items[${index}].effect`;
    const effect = item.effect;
    if (effect === undefined || effect.trim() === '') {
      error(path, `対象「${item.target}」の効果が空です`);
      return;
    }
    if (item.target === 'hp' || item.target === 'mp') {
      if (effect === 'full' || effect === 'half') return;
      const range = validInteger(effect)
        ? ([Number(effect), Number(effect)] as const)
        : numericRange(effect);
      if (effect.includes('..') && !range) {
        error(path, `効果「${effect}」は整数の昇順範囲で指定してください`);
        return;
      }
      if (!range) {
        error(
          path,
          `HP/MP の効果「${effect}」は数値、full、half、または最小..最大で指定してください`,
        );
        return;
      }
      const [minimum, maximum] = range;
      const stat = item.target;
      const minimumInitial = profiles.length
        ? Math.min(...profiles.map((profile) => profile[stat]))
        : undefined;
      const maximumPossible = profiles.length
        ? Math.max(...profiles.map((profile) => profile[stat] + 10))
        : undefined;
      if (minimumInitial !== undefined && minimum < -minimumInitial) {
        warn(
          path,
          `${stat.toUpperCase()}の効果 ${effect} は、初期値が低い冒険者に使うと0未満になる可能性があります（減少量は0で下げ止まりません）`,
        );
      }
      if (maximumPossible !== undefined && maximum >= maximumPossible) {
        warn(
          path,
          `${stat.toUpperCase()}の効果 ${effect} は、初期値が満タンなら最大値 ${maximumPossible} で上限に達します`,
        );
      }
      return;
    }
    if (['str', 'int', 'dex', 'krm'].includes(item.target)) {
      if (effect !== 'full' && !validInteger(effect) && !/^@[+-]?\d+$/.test(effect)) {
        error(path, `能力値の効果「${effect}」は整数、@整数、または full で指定してください`);
        return;
      }
      if (effect !== 'full' && profiles.length > 0) {
        const key = item.target as 'str' | 'int' | 'dex' | 'krm';
        const minimum = effect.startsWith('@')
          ? Number(effect.slice(1))
          : Math.min(...profiles.map((profile) => profile.chara[key])) + Number(effect);
        const maximum = effect.startsWith('@')
          ? minimum
          : Math.max(...profiles.map((profile) => profile.chara[key] + 2)) + Number(effect);
        if (minimum < 0 || maximum > 10) {
          warn(
            path,
            `初期能力値を基準にした計算結果は ${minimum}〜${maximum} です（通常の初期値範囲 0〜10 を外れます）`,
          );
        }
      }
      return;
    }
    if (['free1', 'free2', 'free3'].includes(item.target)) {
      if (validInteger(effect) || /^@[+-]?\d+$/.test(effect)) return;
      if (effect.includes('..')) {
        if (!numericRange(effect)) {
          error(path, `効果「${effect}」は整数の昇順範囲で指定してください`);
        }
      } else {
        error(
          path,
          `自由能力値の効果「${effect}」は整数、@整数、または昇順の最小..最大で指定してください`,
        );
      }
      return;
    }
    if (item.target === 'state') {
      if (!STATE_EFFECTS.has(effect)) {
        error(path, `状態効果「${effect}」は対応していない状態異常です`);
      }
      return;
    }
    if (item.target === 'param') {
      const match = /^([^:]+):([^:]+)$/.exec(effect);
      if (!match) {
        error(path, `パラメーター効果「${effect}」は ID:値 の形式で指定してください`);
        return;
      }
      const [, id, value] = match;
      const definition = paramDefs.get(id!);
      if (!definition) {
        warn(path, `パラメーター「${id}」が定義されていません`);
        return;
      }
      const numeric = /^@[+-]?\d+$/.test(value!) || /^[+-]?\d+(?:\.\d+)?$/.test(value!);
      if (!numeric) return;
      const assignment = value!.startsWith('@');
      if (definition.initial === undefined && !assignment) {
        error(path, `パラメーター「${id}」に初期値がないため加算結果を計算できません`);
        return;
      }
      const initial = Number(definition.initial ?? 0);
      const valueNumber = Number(assignment ? value!.slice(1) : value);
      const calculated = assignment ? valueNumber : initial + valueNumber;
      if (!Number.isFinite(calculated)) {
        error(path, `パラメーター「${id}」の効果を有限の数値に計算できません`);
        return;
      }
      if (
        definition.min !== undefined &&
        definition.max !== undefined &&
        definition.min <= definition.max
      ) {
        const clamped = Math.min(definition.max, Math.max(definition.min, calculated));
        if (clamped !== calculated) {
          warn(
            path,
            `初期値を基準にした計算結果 ${calculated} は、範囲内の ${clamped} に丸められます`,
          );
        }
      }
      return;
    }
    error(`items[${index}].target`, `未対応の対象「${item.target}」です`);
  });
}

function addEnemyFormulaChecks(scenario: Scenario, issues: CheckIssue[]) {
  const error = (path: string, message: string) =>
    issues.push({ severity: 'error', path, message });
  const definitions = new Map(scenario.enemies.map((enemy) => [enemy.id, enemy]));
  const checked = new Set<string>();

  scenario.enemies.forEach((enemy, index) => {
    const path = `enemies[${index}]`;
    if (enemy.func) {
      const comparison =
        STATES.has(enemy.attack ?? '') || /^(str|int|dex|krm)\d{0,2}$/i.test(enemy.attack ?? '');
      if (
        (DAMAGE_ATTACKS.has(enemy.attack ?? '') || comparison) &&
        !formulaList(enemy.func, comparison)
      ) {
        error(`${path}.func`, `敵の攻撃式「${enemy.func}」を解釈できません`);
      }
    } else if (DAMAGE_ATTACKS.has(enemy.attack ?? '')) {
      issues.push({
        severity: 'warning',
        path: `${path}.func`,
        message: '攻撃式がありません。敵の攻撃ダメージは自動計算されません',
      });
    }
    if (enemy.funcOpp && !formulaList(enemy.funcOpp, false)) {
      error(`${path}.funcOpp`, `こちらからの攻撃式「${enemy.funcOpp}」を解釈できません`);
    }
  });

  const profiles = initialProfiles(scenario);
  if (profiles.length === 0) return;
  scenario.scenes.forEach((scene, sceneIndex) => {
    if (!scene.enemies?.length) return;
    const dice = enumerateDice(scene.dice);
    const enemyIds = new Set<string>();
    scene.enemies.forEach((id) => {
      if (enemyIds.has(id)) return;
      enemyIds.add(id);
      const enemy = definitions.get(id);
      if (!enemy || !DAMAGE_ATTACKS.has(enemy.attack ?? '') || !enemy.func) return;
      const key = `${sceneIndex}:${id}`;
      if (checked.has(key)) return;
      checked.add(key);
      const formulas = formulaList(enemy.func, false);
      if (!formulas?.length) return;
      if (!dice) {
        issues.push({
          severity: 'warning',
          path: `scenes[${sceneIndex}].enemies`,
          message: `敵「${enemy.name}」のダメージ分布を集計できません。ダイス指定「${scene.dice ?? ''}」が不正、または組み合わせ数が多すぎます`,
        });
        return;
      }
      const resource = enemy.attack === 'magic' ? 'mp' : 'hp';
      const results = distribution(formulas, dice, profiles, resource);
      const potentialMaximum = maximumDamage(formulas, dice, profiles);
      const relevant = results.reduce((best, current) => {
        const bestScore = Math.max(
          best.maximum.damage / best.resource,
          best.average / best.resource,
          (best.maximum.damage - best.minimum.damage) / best.resource,
        );
        const currentScore = Math.max(
          current.maximum.damage / current.resource,
          current.average / current.resource,
          (current.maximum.damage - current.minimum.damage) / current.resource,
        );
        return currentScore > bestScore ? current : best;
      });
      const target = resource.toUpperCase() as 'HP' | 'MP';
      const baseMessage = `敵「${enemy.name}」の${target}ダメージ（倍率×1・ボーナス防具なしの試算）: ${formatDistribution(relevant, target)}`;
      const path = `scenes[${sceneIndex}].enemies`;
      if (resource === 'hp' && potentialMaximum.result.damage >= potentialMaximum.profile.hp) {
        issues.push({
          severity: 'warning',
          path,
          message: `特定の能力値・ダイス目で一撃死の可能性があります。${baseMessage}。一撃死例: ${potentialMaximum.profile.race}/${potentialMaximum.profile.sex} の${formatStats(potentialMaximum.profile)}、初期HP下限${potentialMaximum.profile.hp}に対し${potentialMaximum.result.damage}ダメージ（式 ${potentialMaximum.result.formula}・出目${potentialMaximum.result.dice}）`,
        });
      }
      if (
        relevant.average >= relevant.resource / 3 ||
        relevant.maximum.damage - relevant.minimum.damage >= relevant.resource / 2
      ) {
        issues.push({
          severity: 'warning',
          path,
          message: `${baseMessage}。最小・平均・最大の差が大きい、または平均で初期値の3分の1以上を失う可能性があります`,
        });
      }
    });
  });
}

export function checkCombatScenario(scenario: Scenario): CheckIssue[] {
  const issues: CheckIssue[] = [];
  addItemChecks(scenario, issues);
  addEnemyFormulaChecks(scenario, issues);
  return issues;
}
