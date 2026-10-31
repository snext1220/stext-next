/**
 * ゲームエンジン。シナリオ（stext/2）と乱数源を受け取り、状態を受け取って新しい状態を返す。
 * 渡された状態は書き換えない（内部で複製してから変更する）。
 *
 * 進行は旧エンジン（sgml.js の createScene）と同じ:
 * 選択 → 魔法の星消費 → シーンの効果 → 状態異常の経過 → 実績 → ボーナス → 経過シーン数 → BGM → エンディング
 */
import { BACK_SCENE_ID, type Choice, type Enemy, type Scenario, type Scene } from '@stext/schema';
import { evaluateCondition, type ConditionContext } from './condition.js';
import { BONUS_ITEMS } from './data.js';
import {
  applySceneEffects,
  applyStartBonus,
  paramDefinitions,
  paramValue,
  updateHpMp,
  updateState,
  type EffectContext,
  type GameEvent,
} from './effects.js';
import { MAGIC, canCast, type MagicName } from './magic.js';
import { pick, randomInt, type RandomSource } from './random.js';
import { newGameState, type GameState, type GlobalState } from './state.js';
import { expandSceneText, expandText, judge, type TextContext } from './text.js';

/** ランダム遷移の結果を一定期間保持する仕組み（旧エンジンは Cookie を使っていた） */
export interface RandomCache {
  get(key: string): string | undefined;
  set(key: string, value: string, days: number): void;
}

export interface EngineOptions {
  /** シナリオ ID（実績の保存先）。省略時は meta.id */
  scenarioId?: string;
  /** 0 以上 1 未満を返す乱数源。省略時は Math.random */
  random?: RandomSource;
  cache?: RandomCache;
  /** ${result?id} 用：他のシナリオの実績数 */
  scenarioResults?: TextContext['scenarioResults'];
}

/** 進行の結果 */
export interface Step {
  state: GameState;
  global: GlobalState;
  events: GameEvent[];
  /** エンディングで続編に引き継ぐセーブデータ（シナリオ ID → 状態） */
  carryOver?: Record<string, GameState>;
}

export interface ChoiceView {
  /** choose() に渡す番号 */
  index: number;
  kind: 'go' | 'jump' | 'answer';
  /** 表示する文言（展開済み）。番号入力・文字入力では空 */
  label: string;
  /** 選択肢の直前に表示する文章（展開済み） */
  before?: string;
  /** 共通フッター（meta.footerScene）の選択肢か */
  footer: boolean;
}

export interface SceneView {
  id: string;
  summary?: string;
  /** 本文（Markdown。展開済み） */
  markdown: string;
  afterText?: string;
  choices: ChoiceView[];
  enemies: Enemy[];
  end?: 'happy' | 'bad' | 'good';
  /** 再生する BGM（"@field01" など。空ならメインテーマ） */
  bgm: string;
  se?: string;
  /** Battle Sheet に表示するルールのシーン ID */
  rule?: string;
  dice?: string;
  tweet?: string;
}

export type ChooseResult =
  | ({ kind: 'moved' } & Step)
  /** 「戻る」：パラメーター p99 がなければ、呼び出し側で直前の状態に戻す */
  | { kind: 'back' }
  | { kind: 'rejected'; reason: 'notEnoughStars' | 'notAllowed' | 'hidden' | 'missingScene' };

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(scenario: Scenario, options: EngineOptions = {}) {
  const random = options.random ?? Math.random;
  const scenarioId = options.scenarioId ?? scenario.meta.id ?? 'scenario';
  const scenes = new Map(scenario.scenes.map((s) => [s.id, s]));
  const params = paramDefinitions(scenario);
  const hiddenFlags = new Set(scenario.flags.filter((f) => f.hidden).map((f) => f.id));
  const sharedItems = new Set(scenario.items.filter((i) => i.shared).map((i) => i.id));
  const enemies = new Map(scenario.enemies.map((e) => [e.id, e]));

  const sceneOf = (id: string | number) => {
    const scene = scenes.get(String(id));
    if (!scene) throw new Error(`シーン「${id}」がありません`);
    return scene;
  };

  function effectContext(
    state: GameState,
    global: GlobalState,
    events: GameEvent[],
  ): EffectContext {
    return { state, global, scenarioId, params, hiddenFlags, random, events };
  }

  function conditionContext(state: GameState, global: GlobalState): ConditionContext {
    return {
      flags: new Set(state.flags),
      items: new Set(state.items),
      chara: state.chara,
      stars: state.stars,
      params: state.params,
      paramInitial: (id) => params.get(id)?.initial,
      elapsed: state.ellapsed_scene,
      results: global.results,
      randomInt: (min, max) => randomInt(random, min, max),
    };
  }

  function textContext(state: GameState, global: GlobalState): TextContext {
    const ctx: TextContext = {
      scenario,
      scenes,
      state,
      condition: conditionContext(state, global),
      random,
      paramValue: (id) => paramValue({ state, params }, id),
    };
    if (options.scenarioResults) ctx.scenarioResults = options.scenarioResults;
    return ctx;
  }

  /** 新しいキャラクターで冒険を始め、シーン 0 に入る */
  function start(global: GlobalState, opts: { memos?: string } = {}): Step {
    const g = clone(global);
    const constraint = scenario.meta.constraint;
    const state = newGameState(random, {
      ...(constraint ? { constraint } : {}),
      ...(opts.memos !== undefined ? { memos: opts.memos } : {}),
      bonusItems: g.items,
    });
    const events: GameEvent[] = [];
    applyStartBonus(effectContext(state, g, events));
    const step = enterScene(state, g, '0');
    return { ...step, events: [...events, ...step.events] };
  }

  /** シーンに入る（旧エンジン createScene の、表示以外の処理） */
  function enterScene(
    current: GameState,
    global: GlobalState,
    sceneId: string,
    cast: readonly string[] = [],
  ): Step {
    if (current.isEnded)
      throw new Error('この冒険はエンディングを迎えています。start() で新しく始めてください');
    const state = clone(current);
    const g = clone(global);
    const events: GameEvent[] = [];
    const scene = sceneOf(sceneId);

    // 魔法を唱える選択肢：星を消費する（足りなければ移動しない）
    if (cast.length > 0) {
      const stars = state.stars.map(Number);
      for (const name of cast) {
        const magic = MAGIC[name as MagicName];
        if (!magic || !canCast(name as MagicName, stars, state.chara.state)) {
          return { state: current, global, events: [{ type: 'notEnoughStars' }] };
        }
        magic.stars.forEach((n, i) => (stars[i] = stars[i]! - n));
        if (stars.some((n) => n < 0))
          return { state: current, global, events: [{ type: 'notEnoughStars' }] };
      }
      state.stars = stars;
    }

    const ctx = effectContext(state, g, events);
    applySceneEffects(ctx, scene.effects);
    state.scene = scene.id;
    state.ellapsed_scene += 1;
    if (scene.bgm !== undefined) state.bgm = scene.bgm;

    const step: Step = { state, global: g, events };
    if (scene.end) {
      state.isEnded = true;
      if (scene.nexts?.length) step.carryOver = carryOver(state, scene.nexts);
      const bonus = endingBonus(scene.end);
      if (bonus && !g.items.includes(bonus)) g.items.push(bonus);
      if (bonus) events.push({ type: 'bonusAwarded', id: bonus });
    }
    return step;
  }

  /** 続編に引き継ぐセーブデータ（旧エンジン copyNextScenario） */
  function carryOver(state: GameState, nexts: readonly string[]): Record<string, GameState> {
    const copy = clone(state);
    copy.items = copy.items.filter((id) => sharedItems.has(id));
    copy.flags = [];
    copy.params = {};
    copy.scene = 0;
    copy.ellapsed_scene = 0;
    copy.bgm = '';
    copy.isEnded = false;
    return Object.fromEntries(nexts.map((id) => [id.trim(), clone(copy)]));
  }

  /** エンディングで手に入るボーナスアイテム（happy は必ず、bad は 20% 未満の確率） */
  function endingBonus(end: string): string | undefined {
    if (end === 'happy') return pick(random, Object.keys(BONUS_ITEMS.happy));
    if (end === 'bad' && randomInt(random, 0, 100) < 20)
      return pick(random, Object.keys(BONUS_ITEMS.bad));
    return undefined;
  }

  /** 現在のシーンと、選べる選択肢の一覧 */
  function allChoices(scene: Scene): { choice: Choice; footer: boolean }[] {
    const list = scene.choices.map((choice) => ({ choice, footer: false }));
    const footer = scenario.meta.footerScene;
    if (footer && !scene.excludeFooter && !scene.end && footer !== scene.id) {
      for (const choice of scenes.get(footer)?.choices ?? []) list.push({ choice, footer: true });
    }
    return list;
  }

  function isVisible(choice: Choice, ctx: ConditionContext): boolean {
    if ('kind' in choice || choice.if === undefined) return true;
    if (typeof choice.if === 'string') return judge(choice.if, ctx);
    return evaluateCondition(choice.if, ctx);
  }

  /** 現在のシーンを表示用に組み立てる（${rand} などで乱数を使うことがある） */
  function view(state: GameState, global: GlobalState): SceneView {
    const scene = sceneOf(state.scene);
    const tctx = textContext(state, global);
    const body = expandSceneText(scene, tctx);
    const inline = (s: string) => expandText(s, tctx).markdown;
    const choices: ChoiceView[] = [];
    allChoices(scene).forEach(({ choice, footer }, index) => {
      if (!isVisible(choice, tctx.condition)) return;
      const v: ChoiceView = {
        index,
        kind: 'kind' in choice ? choice.kind : 'go',
        label: 'kind' in choice ? '' : inline(choice.label),
        footer,
      };
      if (choice.before) v.before = inline(choice.before);
      choices.push(v);
    });
    const end = scene.end;
    const v: SceneView = {
      id: scene.id,
      markdown: body.markdown,
      choices,
      enemies: (scene.enemies ?? []).flatMap((id) => enemies.get(id) ?? []),
      bgm:
        end && scene.bgm === undefined
          ? (scenario.meta.bgm?.[end === 'good' ? 'happy' : end] ?? end)
          : state.bgm,
    };
    if (scene.summary !== undefined) v.summary = scene.summary;
    if (scene.afterText) v.afterText = inline(scene.afterText);
    if (end) v.end = end;
    if (scene.se) v.se = scene.se;
    const rule = ruleOf(scene);
    if (rule) v.rule = rule;
    if (scene.dice) v.dice = scene.dice;
    if (body.tweet !== undefined) v.tweet = body.tweet;
    return v;
  }

  /** Battle Sheet のルール：シーンの rule → 敵がいればグループの rule → 99999（旧エンジン detectRuleId） */
  function ruleOf(scene: Scene): string | undefined {
    if (scene.rule) return scene.rule;
    const n = Number(scene.id);
    const group = scenario.groups.find((g) => Number(g.start) <= n && n <= Number(g.end));
    if (group?.rule && scene.enemies?.length) return group.rule;
    return scenes.has('99999') ? '99999' : undefined;
  }

  /** 選択肢を選ぶ。input は番号入力・文字入力の値 */
  function choose(
    state: GameState,
    global: GlobalState,
    index: number,
    input?: string,
  ): ChooseResult {
    const scene = sceneOf(state.scene);
    const entry = allChoices(scene)[index];
    if (!entry || !isVisible(entry.choice, conditionContext(state, global)))
      return { kind: 'rejected', reason: 'hidden' };
    const choice = entry.choice;

    if ('kind' in choice && choice.kind === 'jump') {
      const to = (input ?? '').trim();
      if (!choice.allow.includes(to)) return { kind: 'rejected', reason: 'notAllowed' };
      return go(to);
    }
    if ('kind' in choice && choice.kind === 'answer') {
      return go(input === choice.answer ? choice.to : choice.else);
    }

    let to =
      choice.to.length > 1 ? (pick(random, choice.to) ?? choice.to[0]!).trim() : choice.to[0]!;
    if (choice.to.length > 1 && choice.randomCacheDays && options.cache) {
      const key = `random_${scenarioId}${state.scene}`;
      const cached = options.cache.get(key);
      if (cached) to = cached;
      else options.cache.set(key, to, choice.randomCacheDays);
    }
    if (to === BACK_SCENE_ID) {
      const back = state.params['p99'];
      if (!back) return { kind: 'back' };
      to = String(back);
    }
    return go(to, choice.cast ?? []);

    function go(target: string, cast: readonly string[] = []): ChooseResult {
      if (!scenes.has(target)) return { kind: 'rejected', reason: 'missingScene' };
      const step = enterScene(state, global, target, cast);
      if (step.state === state) return { kind: 'rejected', reason: 'notEnoughStars' };
      return moved(step);
    }
  }

  /** 魔法シートから魔法を唱える（星を消費して効果を反映する） */
  function castMagic(current: GameState, global: GlobalState, name: MagicName): Step {
    const state = clone(current);
    const events: GameEvent[] = [];
    if (!canCast(name, state.stars, state.chara.state)) {
      return { state: current, global, events: [{ type: 'notEnoughStars' }] };
    }
    MAGIC[name].stars.forEach((n, i) => (state.stars[i] = Number(state.stars[i]) - n));
    const ctx = effectContext(state, clone(global), events);
    switch (name) {
      case 'HEAL':
        updateHpMp(ctx, 15, undefined);
        break;
      case 'PEACE':
        updateHpMp(ctx, undefined, 10);
        break;
      case 'CURE':
        updateState(ctx, '-poison');
        break;
      case 'MELT':
        updateState(ctx, '-frozen');
        break;
      case 'STONE-FLESH':
        updateState(ctx, '-stone');
        break;
      case 'UN-CURCE':
        updateState(ctx, '-curse');
        break;
      case 'AIR-HAND':
        updateState(ctx, '-forget');
        break;
      case 'RESURRECT':
        updateHpMp(ctx, 'half', 'half');
        break;
      case 'REDUCE-LIFE':
        updateHpMp(ctx, -25, undefined);
        updateState(ctx, '-all');
        break;
      // ほかの魔法は戦闘の倍率や判定のやり直しなど、プレイヤーが手で反映する
    }
    return { state, global: ctx.global, events };
  }

  return {
    scenario,
    scenarioId,
    start,
    enterScene,
    view,
    choose,
    castMagic,
    conditionContext,
    /** 戦闘などで状態を直接変えるときの文脈（state は呼び出し側で複製してから渡す） */
    effectContext,
    paramValue: (state: GameState, id: string) => paramValue({ state, params }, id),
  };
}

function moved(step: Step): ChooseResult {
  return { kind: 'moved', ...step };
}

/** 状態は JSON で表せるデータなので、JSON で複製する（DOM・Node のどちらにも依存しない） */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
