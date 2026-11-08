import { readFileSync } from 'node:fs';
import { checkScenario, validateScenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { computeDamage, receiveAttack } from './battle.js';
import { createEngine, type Engine, type Step } from './engine.js';
import { emptyGlobalState } from './state.js';

const data: unknown = JSON.parse(
  readFileSync(new URL('../../../scenarios/gods/scenario.json', import.meta.url), 'utf8'),
);
const validated = validateScenario(data);
if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
const scenario = validated.scenario;

function choose(engine: Engine, step: Step, label: string, input?: string): Step {
  const choice = engine.view(step.state, step.global).choices.find((c) => c.label === label);
  if (!choice) throw new Error(`${step.state.scene}: 選択肢「${label}」がありません`);
  const next = engine.choose(step.state, step.global, choice.index, input);
  if (next.kind !== 'moved') throw new Error(`${step.state.scene}: ${next.kind}`);
  return next;
}

function setup(scene: string, flags: string[] = [], random: () => number = () => 0) {
  const engine = createEngine(scenario, { random });
  const initial = engine.start(emptyGlobalState());
  initial.state.flags.push(...flags);
  initial.state.chara.free1 = 2;
  return { engine, step: engine.enterScene(initial.state, initial.global, scene) };
}

function follow(engine: Engine, step: Step, labels: string[]): Step {
  return labels.reduce((current, label) => choose(engine, current, label), step);
}

describe('新・天の神々たち', () => {
  it('has consistent scenario references and an achievement for every bad ending', () => {
    expect(checkScenario(scenario)).toEqual([]);
    expect(
      scenario.scenes
        .filter((scene) => scene.end === 'bad')
        .every((scene) => scene.effects?.result),
    ).toBe(true);
    expect(scenario.scenes.length).toBeLessThanOrEqual(350);
    for (const scene of scenario.scenes) {
      const visibleText = scene.text.replace(/\$\{[^}]*\}/g, '');
      expect(visibleText, scene.id).not.toMatch(/\bFREE(?:[123]|I{1,3})\b/i);
      for (const c of scene.choices) {
        if ('label' in c) expect(c.label, scene.id).not.toMatch(/\bFREE(?:[123]|I{1,3})\b/i);
      }
    }
  });

  it('uses the original mountain monster and places rare meteors in heaven', () => {
    expect(scenario.enemies.find((enemy) => enemy.id === 'm14')?.name).toBe('ペリュトン');
    expect(scenario.enemies.find((enemy) => enemy.id === 'm15')?.name).toBe('ペリュトン（瓶狙い）');
    const scene = scenario.scenes.find((item) => item.id === '637');
    expect(scene?.enemies).toContain('m32');
    expect(scene?.text).toContain('流星');

    const meteor = scenario.enemies.find((enemy) => enemy.id === 'm32');
    if (!meteor?.func) throw new Error('Missing meteor damage formula');
    const chara = setup('637').step.state.chara;
    let hits = 0;
    for (let left = 1; left <= 6; left++)
      for (let right = 1; right <= 6; right++)
        if (computeDamage(meteor.func, [left, right], chara) > 0) hits++;
    expect(hits).toBe(3);
  });

  it('lets an aracora steal exactly one bottle and names the villagers', () => {
    const { engine, step } = setup('202');
    const aracora = scenario.enemies.find((enemy) => enemy.id === 'm19');
    if (!aracora?.attack || !aracora.func) throw new Error('Missing aracora attack');
    receiveAttack(
      engine.effectContext(step.state, step.global, []),
      aracora.attack,
      aracora.func,
      [1, 1],
    );
    expect(step.state.chara.free1).toBe(1);
    expect(engine.view(step.state, step.global).choices.map((choice) => choice.label)).toContain(
      '先へ進む',
    );
    expect(scenario.scenes.find((scene) => scene.id === '160')?.text).toContain('ノーマス');
    expect(scenario.scenes.find((scene) => scene.id === '1040')?.text).toContain('ギルデン');
  });

  it('initializes the wine and pot with the amounts described to the player', () => {
    const wine = setup('115').step;
    expect(wine.state.chara.free1).toBe(7);
    expect(scenario.scenes.find((s) => s.id === '440')?.text).toContain('最後の7本');
    const pot = setup('643').step;
    expect(pot.state.chara.free2).toBe(18);
  });

  it('lets the player infer the priest’s deceit from the villagers’ accounts', () => {
    const incomplete = setup('100', ['f01', 'f02']);
    const tavernBeforeMeetingThePriest = choose(incomplete.engine, incomplete.step, '酒場');
    expect(
      incomplete.engine
        .view(tavernBeforeMeetingThePriest.state, tavernBeforeMeetingThePriest.global)
        .choices.map((choice) => choice.label),
    ).not.toContain('聞いた話を整理する');

    const { engine, step: initial } = setup('100', ['f01', 'f02', 'f08']);
    let step = choose(engine, initial, '酒場');
    expect(step.state.scene).toBe('112');
    expect(engine.view(step.state, step.global).markdown).toContain('人形まで巫女に渡した');
    step = choose(engine, step, '聞いた話を整理する');
    expect(step.state.scene).toBe('1181');

    const answerChoice = engine
      .view(step.state, step.global)
      .choices.find((choice) => 'kind' in choice && choice.kind === 'answer');
    if (!answerChoice) throw new Error('Missing village answer choice');
    const incorrect = engine.choose(step.state, step.global, answerChoice.index, '酒場');
    if (incorrect.kind !== 'moved') throw new Error(`Unexpected answer result: ${incorrect.kind}`);
    expect(incorrect.state.scene).toBe('1182');

    step = choose(engine, incorrect, '考え直す');
    const retry = engine
      .view(step.state, step.global)
      .choices.find((choice) => 'kind' in choice && choice.kind === 'answer');
    if (!retry) throw new Error('Missing village answer retry');
    const correct = engine.choose(step.state, step.global, retry.index, '巫女');
    if (correct.kind !== 'moved') throw new Error(`Unexpected answer result: ${correct.kind}`);
    expect(correct.state.scene).toBe('1183');

    const selfDelivery = choose(engine, correct, '自分で神々の庭園へ届ける');
    expect(selfDelivery.state.scene).toBe('115');
    expect(selfDelivery.state.chara.free1).toBe(7);
    expect(selfDelivery.state.flags).toContain('f10');

    const misplacedWine = choose(engine, correct, '巫女を信じて、葡萄酒を預ける');
    expect(misplacedWine.state.isEnded).toBe(true);
    expect(misplacedWine.global.results.gods).toContain('r05');
  });

  it('rewards reading the fish and uses dice to resolve a poor maneuver', () => {
    const countEvades = (label: string) => {
      let evades = 0;
      for (let roll = 0; roll < 6; roll++) {
        const run = setup('822', [], () => roll / 6);
        if (choose(run.engine, run.step, label).state.scene === '824') evades++;
      }
      return evades;
    };
    expect(countEvades('魚影の反対へ、瓶を左に動かす')).toBe(5);
    expect(countEvades('魚影へ、瓶を右に引き寄せる')).toBe(2);

    const run = setup('820');
    const step = follow(run.engine, run.step, [
      '瓶を沈める',
      '魚影の反対へ、瓶を左に動かす',
      '次の魚に備える',
      '魚影の反対へ、瓶を上に引く',
      '次の魚に備える',
      '魚影の反対へ、瓶を右に動かす',
      '次の魚に備える',
      '瓶を泉から引き上げる',
    ]);
    expect(step.state.scene).toBe('830');
    expect(step.state.chara.free1).toBe(1);
    expect(step.global.results.gods).toContain('r21');
  });

  it('makes bottle damage more likely on the exposed mountain route', () => {
    const { step } = setup('205');
    const chara = { ...step.state.chara, dex: 6 };
    const enemy = (id: string) => {
      const found = scenario.enemies.find((e) => e.id === id);
      if (!found?.func) throw new Error(`Missing formula ${id}`);
      return found.func;
    };
    const average = (id: string) => {
      let total = 0;
      for (let l = 1; l <= 6; l++)
        for (let r = 1; r <= 6; r++) total += Math.max(0, computeDamage(enemy(id), [l, r], chara));
      return total / 36;
    };
    expect(average('m10')).toBeGreaterThan(1.5);
    expect(average('m15')).toBeGreaterThan(0.9);
    expect(average('m11')).toBeGreaterThan(2);
    expect(average('m59')).toBeLessThan(average('m11'));
    expect(average('m18')).toBeGreaterThan(0.5);
  });

  it('raises ordinary enemy damage and adds star rewards throughout the journey', () => {
    const { step } = setup('205');
    const chara = { ...step.state.chara, str: 6, dex: 6, int: 6 };
    for (const id of ['m14', 'm30', 'm36', 'm50', 'm54']) {
      const enemy = scenario.enemies.find((e) => e.id === id);
      if (!enemy?.func) throw new Error(`Missing formula ${id}`);
      expect(computeDamage(enemy.func, [3, 4], chara), id).toBeGreaterThanOrEqual(5);
    }
    const rewards = scenario.scenes.filter(
      (s) => Array.isArray(s.effects?.stars) && s.effects.stars.some((count) => count > 0),
    );
    expect(rewards.length).toBeGreaterThanOrEqual(12);
  });

  it('makes hurried fire transport riskier than careful transport', () => {
    const { step } = setup('643');
    const large = scenario.enemies.find((e) => e.id === 'm33')?.func;
    const small = scenario.enemies.find((e) => e.id === 'm34')?.func;
    if (!large || !small) throw new Error('Missing fire transport formulas');
    for (const dex of [4, 6, 8]) {
      const chara = { ...step.state.chara, dex };
      const rolls = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1]);
      const damage = (formula: string, dice: number[]) =>
        Math.max(0, computeDamage(formula, dice, chara));
      let hurried = 0;
      let careful = 0;
      for (const a of rolls)
        for (const b of rolls)
          for (const c of rolls) {
            if (damage(large, a) + damage(large, b) + damage(small, c) >= 18) hurried++;
            if (damage(small, a) + damage(small, b) + damage(small, c) >= 18) careful++;
          }
      const total = 36 ** 3;
      expect(hurried / total).toBeGreaterThan(0.05);
      expect(hurried).toBeGreaterThan(careful);
      expect(careful / total).toBeLessThan(0.3);
    }
  });

  it('applies transport damage and prevents continuing when the pot is destroyed', () => {
    const { engine, step } = setup('663');
    const state = structuredClone(step.state);
    state.chara.dex = 6;
    state.chara.free2 = 4;
    const large = scenario.enemies.find((e) => e.id === 'm33');
    if (!large?.func || !large.attack) throw new Error('Missing fire transport enemy');
    receiveAttack(engine.effectContext(state, step.global, []), large.attack, large.func, [6, 6]);
    expect(state.chara.free2).toBeLessThanOrEqual(0);
    const choices = engine.view(state, step.global).choices.map((c) => c.label);
    expect(choices).toContain('鍋が燃え尽きた（鍋の耐久が0以下）');
    expect(choices).not.toContain('回廊を抜けた');
  });

  it('opens the old bridge and uses the mirror without completing the forge quest', () => {
    const { engine, step: initial } = setup('600', ['f40']);
    let step = follow(engine, initial, [
      '東の架け橋',
      '橋のたもとを調べる',
      '控え室に入る',
      '石板を読む',
      '控え室を見回す',
      '帳面を調べる',
      '控え室を見回す',
      '布の下を見る',
      '鏡を借りる',
      '控え室を見回す',
      '橋のたもとへ戻る',
      '橋の仕掛けを調べる',
      '留め具を外す',
      'もう一度仕掛けを調べる',
      '重りを下ろす',
      '留め具を外す',
      '留め具を戻して橋を固定する',
      '東の岸へ渡る',
      '東屋へ向かう',
      '泉へ向かう',
      '控え室で読んだ方法を試す',
      '東側の留め金に掛ける',
      '鏡の表を東（日の方）に向ける',
      '静かに瓶を沈める',
      '黄金の酒を確かめる',
      '東屋へ戻る',
      'デュオンのもとへ急ぐ',
      '駆け出す',
      '回廊を回る',
      '扉を開ける',
      '女の子の様子を見守る',
    ]);
    expect(step.state.scene).toBe('876');
    expect(step.state.flags).toEqual(expect.arrayContaining(['f48', 'f52', 'f80']));
    expect(step.state.flags).not.toContain('f85');
    expect(step.state.flags).not.toContain('f47');
    expect(step.state.chara.free1).toBe(1);
    expect(step.global.results.gods).toEqual(expect.arrayContaining(['r44', 'r45', 'r23']));

    step = follow(engine, step, ['広間へ戻る', '東の架け橋', '東屋へ向かう', '竪琴を構える']);
    step = choose(engine, step, '', '452');
    step = choose(engine, step, 'ビヌスの話を聞く');
    expect(step.state.scene).toBe('908');
    expect(engine.view(step.state, step.global).markdown).not.toContain(
      'さっき、フェリスがこれを持ってきた',
    );
    step = follow(engine, step, ['庭園へ戻る', 'ユイターの声がした断崖', '竪琴を構える']);
    step = choose(engine, step, '', '138465');
    step = follow(engine, step, [
      'なぜすぐに取り返そうとしなかったのか',
      'はい',
      '麓の村へ',
      '…………',
      '村の家々を見て回る',
      '酒場に入る',
      '……',
      'おやじを気絶させた',
      '身構える',
      '村人たちを退けた',
      'アンナが竪琴を構える',
      '戦闘開始！',
      'エビルシャーマンを斃した',
      '夜空を見上げる',
      '夜が明ける',
      '村を歩く',
      '村を発つ',
      '旅立つ',
    ]);
    expect(step.state.scene).toBe('1080');
    expect(step.state.isEnded).toBe(true);
    expect(step.global.results.gods).toContain('r33');
  });

  it('keeps the original fire-and-fruit route available', () => {
    const { engine, step: initial } = setup('600', ['f40', 'f41']);
    let step = follow(engine, initial, [
      '鍛冶の神ペトスの工房',
      'はい',
      '広間へ戻る',
      '最上層（太陽の神の宮）',
      '最上層に辿り着いた',
      '＜炎の種＞を受け取る',
      'フェリスに暇を告げる',
      '鍛冶の神のもとへ急ぐ',
      '出発する',
      '一気に走り抜ける',
      '回廊を抜けた',
      '鍋を傾けて、揺れを打ち消しながら降りる',
      '階段を降り切った',
      '中庭を抜けた',
      'フェリスの頼みを思い出す',
      '広間へ戻る',
      '大樹＜ユイターの杖＞の梢',
      '左の枝へ',
      '茂みに潜り込む',
      '先へ進む',
      '＜赤い果実＞を採る',
      '逃げろ！',
      '葉の茂みに身を隠す',
      '木の洞をくぐり抜ける',
      '虫の隙間を縫って全力疾走',
      '広間へ戻る',
      '最上層（太陽の神の宮）',
      '広間へ戻る',
      '鍛冶の神ペトスの工房',
    ]);
    expect(step.state.scene).toBe('650');
    expect(step.state.flags).toEqual(expect.arrayContaining(['f45', 'f47', 'f48']));
    expect(step.state.flags).not.toContain('f80');
    step = follow(engine, step, ['広間へ戻る', '東の架け橋']);
    expect(step.state.scene).toBe('800');
    expect(engine.view(step.state, step.global).markdown).toContain('真新しい鋼の釘');
  });

  it('rewards observing the insects with a safe fruit route', () => {
    const { engine, step: initial } = setup('700', ['f45']);
    const step = follow(engine, initial, [
      '虫たちの様子を観察する',
      '落ちた実を追う',
      '窪みを調べる',
      '虫の反応を待つ',
      '虫たちに礼を言い、広間へ戻る',
    ]);
    expect(step.state.scene).toBe('600');
    expect(step.state.items).toContain('i05');
    expect(step.global.results.gods).toContain('r46');
  });

  it('improves escape odds when the player follows clues or uses high dexterity', () => {
    const countEscapes = (scene: string, label: string, dex?: number) => {
      let escapes = 0;
      for (let roll = 0; roll < 6; roll++) {
        const run = setup(scene, [], () => roll / 6);
        if (dex !== undefined) run.step.state.chara.dex = dex;
        const result = choose(run.engine, run.step, label);
        if (result.state.scene === '732' || result.state.scene === '738') {
          escapes++;
        }
      }
      return escapes;
    };

    expect(countEscapes('730', '葉の茂みに身を隠す')).toBe(5);
    expect(countEscapes('730', '見通しのよい傾斜を駆け下りる')).toBe(3);
    expect(countEscapes('734', '枝の裏側にぶら下がって、手繰って進む', 8)).toBe(6);
    expect(countEscapes('734', '枝の裏側にぶら下がって、手繰って進む', 7)).toBe(2);
  });

  it('lets the player borrow the mirror again after returning it', () => {
    const { engine, step: initial } = setup('820', ['f40', 'f48', 'f83']);
    const step = follow(engine, initial, [
      '橋守の控え室へ鏡を借りに戻る',
      '布の下を見る',
      '鏡を借りる',
      '控え室を見回す',
      '橋のたもとへ戻る',
      '広間へ戻る',
      '東の架け橋',
      '東屋へ向かう',
      '泉へ向かう',
      '控え室で読んだ方法を試す',
      '東側の留め金に掛ける',
      '鏡の表を東（日の方）に向ける',
      '静かに瓶を沈める',
      '黄金の酒を確かめる',
    ]);
    expect(step.state.scene).toBe('830');
    expect(step.state.flags).not.toContain('f85');
    expect(step.state.items).toContain('i06');
  });

  it('lets the player discover both mirror errors and retry without losing the wine', () => {
    const { engine, step: initial } = setup('1130', ['f83', 'f85']);
    const step = follow(engine, initial, [
      '西側の留め金に掛ける',
      '鏡の表を東（日の方）に向ける',
      '掛ける場所を選び直す',
      '東側の留め金に掛ける',
      '鏡の表を西（泉の方）に向ける',
      '鏡の向きを変える',
      '鏡の表を東（日の方）に向ける',
      '静かに瓶を沈める',
      '黄金の酒を確かめる',
    ]);
    expect(step.state.scene).toBe('830');
    expect(step.state.chara.free1).toBe(1);
    expect(step.global.results.gods).toContain('r45');
  });

  it('changes the gods’ reactions when the player returns', () => {
    const { engine, step: initial } = setup('600');
    let step = choose(engine, initial, '鍛冶の神ペトスの工房');
    expect(step.state.scene).toBe('1178');
    expect(engine.view(step.state, step.global).markdown).toContain('誰じゃ');
    step = follow(engine, step, ['広間へ戻る', '鍛冶の神ペトスの工房']);
    expect(step.state.scene).toBe('630');
    expect(engine.view(step.state, step.global).markdown).toContain('また来たのか');
    step = follow(engine, step, ['広間へ戻る', '東の架け橋', '広間へ戻る', '鍛冶の神ペトスの工房']);
    expect(step.state.scene).toBe('1179');
    step = follow(engine, step, ['いいえ', '広間へ戻る', '鍛冶の神ペトスの工房']);
    expect(step.state.scene).toBe('632');
    expect(engine.view(step.state, step.global).markdown).toContain('聞く気になったか');
    step = follow(engine, step, [
      'いいえ',
      '広間へ戻る',
      '最上層（太陽の神の宮）',
      '最上層に辿り着いた',
    ]);
    expect(step.state.scene).toBe('1180');
    step = follow(engine, step, ['広間へ戻る', '最上層（太陽の神の宮）', '最上層に辿り着いた']);
    expect(step.state.scene).toBe('640');
    expect(engine.view(step.state, step.global).markdown).toContain('またそなたか');
  });

  it('keeps the forge quest coherent after the old bridge has been opened', () => {
    const { engine, step: initial } = setup('600', ['f40', 'f41', 'f48', 'f80']);
    let step = choose(engine, initial, '鍛冶の神ペトスの工房');
    expect(step.state.scene).toBe('1179');
    expect(engine.view(step.state, step.global).markdown).toContain('古い天秤橋');
    step = choose(engine, step, 'はい');
    expect(engine.view(step.state, step.global).markdown).toContain('古い橋を動かした');
    step = choose(engine, step, '広間へ戻る');
    expect(
      engine
        .view(step.state, step.global)
        .choices.filter((c) => c.label === '鍛冶の神ペトスの工房'),
    ).toHaveLength(1);
    step = choose(engine, step, '鍛冶の神ペトスの工房');
    expect(step.state.scene).toBe('635');
    expect(engine.view(step.state, step.global).markdown).toContain('炎の種');
  });

  it('gives progressive hints for both harp puzzles', () => {
    const { engine, step: initial } = setup('902');
    let step = choose(engine, initial, '', '4852');
    expect(step.state.scene).toBe('904');
    step = choose(engine, step, 'もう一度弾く');
    expect(engine.view(step.state, step.global).markdown).toContain('人の子の弦は弾かない');
    step = choose(engine, step, '', '8524');
    expect(step.state.scene).toBe('904');
    step = choose(engine, step, 'もう一度弾く');
    expect(engine.view(step.state, step.global).markdown).toContain('山道の石像');
    step = choose(engine, step, '', '452');
    expect(step.state.scene).toBe('906');
    const finale = setup('932', ['f20', 'f21', 'f22', 'f23', 'f24', 'f25']);
    step = choose(finale.engine, finale.step, '', '138456');
    expect(step.state.scene).toBe('934');
    step = choose(finale.engine, step, 'もう一度弾く');
    expect(finale.engine.view(step.state, step.global).markdown).toContain(
      '各行の主語から神を見つける',
    );
    step = choose(finale.engine, step, '', '138456');
    expect(step.state.scene).toBe('934');
    step = choose(finale.engine, step, 'もう一度弾く');
    expect(finale.engine.view(step.state, step.global).markdown).toContain('呼び名と紋章');
    expect(finale.engine.view(step.state, step.global).markdown).not.toContain('ノーネーム');
    step = choose(finale.engine, step, '', '138456');
    expect(step.state.scene).toBe('934');
    step = choose(finale.engine, step, 'もう一度弾く');
    expect(finale.engine.view(step.state, step.global).markdown).toContain('ノーネーム');
    step = choose(finale.engine, step, '', '138456');
    expect(step.state.scene).toBe('934');
    step = choose(finale.engine, step, 'もう一度弾く');
    expect(finale.engine.view(step.state, step.global).markdown).toContain('138465');
    step = choose(finale.engine, step, '', '138465');
    expect(step.state.scene).toBe('940');
  });

  it('lets the pot reduce bottle risks on the mountain routes', () => {
    const rocky = setup('205');
    rocky.step.state.items.push('i01');
    const protectedRoute = choose(rocky.engine, rocky.step, '大鍋で瓶を包み、岩棚を慎重に進む');
    expect(protectedRoute.state.scene).toBe('211');
    expect(scenario.scenes.find((scene) => scene.id === '211')?.enemies).toEqual(['m15']);

    const lizard = setup('225');
    lizard.step.state.items.push('i01');
    const lure = choose(lizard.engine, lizard.step, '大鍋で音を立て、岩トカゲを誘い出す');
    expect(lure.state.scene).toBe('226');
    expect(scenario.scenes.find((scene) => scene.id === '226')?.enemies).toEqual(['m14']);

    const tornado = setup('240');
    tornado.step.state.items.push('i01');
    const deflected = choose(tornado.engine, tornado.step, '大鍋で背負い袋を覆い、風を受け流す');
    expect(deflected.state.scene).toBe('244');
    expect(scenario.scenes.find((scene) => scene.id === '244')?.enemies).toEqual(['m59']);
  });

  it('gives stars at optional encounters only once', () => {
    const { engine, step: initial } = setup('230');
    let step = follow(engine, initial, ['杯を掲げた石像を調べる']);
    const stars = [...step.state.stars];
    expect(stars[0]).toBe(1);
    expect(stars[2]).toBe(1);
    step = choose(engine, step, 'テラスに戻る');
    expect(engine.view(step.state, step.global).choices.map((c) => c.label)).not.toContain(
      '杯を掲げた石像を調べる',
    );
    expect(step.state.stars).toEqual(stars);
  });

  it.each([
    ['251', 'それでも振り返らずに進む', '構わず山を登る', '1161', 'r47'],
    ['615', '女の子を連れて行くよう迫る', '力ずくで女の子を奪い返す', '1163', 'r49'],
    ['620', '壊れた橋を跳び越えようとする', '構わず跳ぶ', '1165', 'r48'],
    ['1108', '鎖を引きちぎって鏡を奪う', '', '1109', 'r50'],
    ['205', '岩棚を使わず、風の強い岩壁を直登する', '構わず岩壁を直登する', '1171', 'r51'],
    ['240', '竜巻が来る前に走って抜ける', 'それでも走り抜ける', '1173', 'r52'],
    ['662', '炎の種を鍋から出し、走り抜ける', '炎を手に持ったまま駆け出す', '1175', 'r53'],
    ['666', '糸を切り、炎の種を鍋底に置く', '糸を切って鍋底に置く', '1177', 'r54'],
  ])('records the warned bad ending from %s', (scene, first, second, ending, result) => {
    const { engine, step: initial } = setup(scene, ['f40']);
    let step = choose(engine, initial, first);
    if (second) step = choose(engine, step, second);
    expect(step.state.scene).toBe(ending);
    expect(step.state.isEnded).toBe(true);
    expect(step.global.results.gods).toContain(result);
  });

  it.each(['1026', '1028'])('records Anna’s attacks on the battle screen %s', (scene) => {
    const { engine, step: initial } = setup(scene);
    expect(engine.view(initial.state, initial.global).markdown).toContain('param="p04"');
    expect(engine.view(initial.state, initial.global).choices.map((c) => c.label)).not.toContain(
      'アンナに届いた攻撃が3回になった',
    );
    const state = engine.setParam(initial.state, 'p04', '3');
    const choices = engine.view(state, initial.global).choices.map((c) => c.label);
    expect(choices).toContain('アンナに届いた攻撃が3回になった');
    expect(choices).not.toContain('エビルシャーマンを斃した');
    const step = choose(engine, { ...initial, state }, 'アンナに届いた攻撃が3回になった');
    expect(step.state.scene).toBe('9910');
    expect(step.global.results.gods).toContain('r31');
  });
});
