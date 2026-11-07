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

function setup(scene: string, flags: string[] = []) {
  const engine = createEngine(scenario, { random: () => 0 });
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

  it('initializes the wine and pot with the amounts described to the player', () => {
    const wine = setup('115').step;
    expect(wine.state.chara.free1).toBe(7);
    expect(scenario.scenes.find((s) => s.id === '440')?.text).toContain('最後の7本');
    const pot = setup('643').step;
    expect(pot.state.chara.free2).toBe(18);
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
      '茂みに飛び込む',
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

  it('requires the harp player to omit the human verse and reverse the final pair', () => {
    const { engine, step: initial } = setup('902');
    let step = choose(engine, initial, '', '4852');
    expect(step.state.scene).toBe('904');
    step = choose(engine, step, 'もう一度弾く');
    step = choose(engine, step, '', '452');
    expect(step.state.scene).toBe('906');
    const finale = setup('932');
    step = choose(finale.engine, finale.step, '', '138456');
    expect(step.state.scene).toBe('934');
    step = choose(finale.engine, step, 'もう一度弾く');
    step = choose(finale.engine, step, '', '138465');
    expect(step.state.scene).toBe('940');
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
