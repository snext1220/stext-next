import type { Scenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { createEngine, type RandomCache } from './engine.js';
import { emptyGlobalState, readLegacySave, type GameState } from './state.js';

const fixed = (r: number) => () => r;

function scenario(scenes: Scenario['scenes'], extra: Partial<Scenario> = {}): Scenario {
  return {
    format: 'stext/2',
    meta: {
      id: 'demo',
      title: 'デモ',
      bgm: { main: '@field05', happy: '@field04', bad: '@town01' },
    },
    items: [
      { id: 'i01', name: 'こいし', text: 'ただの石' },
      { id: 'i02', name: '剣', shared: true },
    ],
    flags: [
      { id: 'f01', text: '調べた' },
      { id: 'f02', text: '隠し', hidden: true },
    ],
    params: [{ id: 'p01', initial: 0, min: 0, max: 10 }, { id: 'p99' }],
    enemies: [
      {
        id: 'm01',
        name: '人面岩',
        element: 'earth',
        attack: 'physics',
        func: 'L-STR',
        funcOpp: 'L+R+STR',
        hp: 10,
      },
    ],
    results: [{ id: 'r01', name: 'はじまり' }],
    groups: [],
    licence: [],
    scenes,
    ...extra,
  };
}

const go = (label: string, to: string, more: object = {}) => ({ label, to: [to], ...more });

describe('createEngine', () => {
  it('creates a character and enters scene 0 with its effects', () => {
    const e = createEngine(
      scenario([
        {
          id: '0',
          text: 'こんにちは、${name}。',
          choices: [go('次へ', '1')],
          effects: { items: ['i01'], result: 'r01' },
        },
        { id: '1', text: 'おわり', choices: [], end: 'bad' },
      ]),
      { random: fixed(0) },
    );
    const { state, global, events } = e.start(emptyGlobalState());
    expect(state.chara).toMatchObject({
      race: 'FIGHTER',
      sex: 'MALE',
      hp: 85,
      hp_m: 85,
      job: 'のうふ',
    });
    expect(state).toMatchObject({ scene: '0', ellapsed_scene: 1, items: ['i01'] });
    expect(global.results).toEqual({ demo: ['r01'] });
    expect(events).toEqual([
      { type: 'itemGained', id: 'i01' },
      { type: 'resultUnlocked', id: 'r01' },
    ]);
    expect(e.view(state, global).markdown).toBe(`こんにちは、${state.chara.name}。`);
  });

  it('shows only the choices whose conditions hold, and expands labels', () => {
    const e = createEngine(
      scenario([
        {
          id: '0',
          text: '${if f01}調べた。${/if}${if !f01}まだ。${/if}',
          choices: [
            go('石を投げる', '1', { if: 'i01' }),
            go('${主|ぬし}へ', '1', { if: { not: { item: 'i01' } } }),
          ],
        },
        { id: '1', text: '', choices: [], end: 'bad' },
      ]),
      { random: fixed(0) },
    );
    const { state, global } = e.start(emptyGlobalState());
    const v = e.view(state, global);
    expect(v.markdown).toBe('まだ。');
    expect(v.choices).toEqual([
      {
        index: 1,
        kind: 'go',
        label: '<ruby>主<rp>（</rp><rt>ぬし</rt><rp>）</rp></ruby>へ',
        footer: false,
      },
    ]);
    expect(e.choose(state, global, 0)).toEqual({ kind: 'rejected', reason: 'hidden' });
  });

  it('applies effects in the legacy order and clamps parameters', () => {
    const e = createEngine(
      scenario([
        { id: '0', text: '', choices: [go('a', '1')] },
        {
          id: '1',
          text: '',
          choices: [],
          effects: {
            items: ['i01', 'i02:3'],
            flags: ['f01', 'f02', '-f01'],
            params: ['p01:20'],
            stars: [1, 0, 0, 0, 0, 0, -1],
            hp: -5,
            str: '@3',
            free1: '2..2',
            state: 'poison',
          },
        },
      ]),
      { random: fixed(0) },
    );
    const s = e.start(emptyGlobalState());
    const r = e.choose(s.state, s.global, 0);
    if (r.kind !== 'moved') throw new Error(r.kind);
    const { state } = r;
    // 毒でさらに HP −1、隠しでないフラグは消せない、p01 は上限 10
    expect(state.chara).toMatchObject({ hp: 85 - 5 - 1, str: 3, free1: 2, state: 'poison' });
    expect(state.items).toEqual(['i01', 'i02']);
    expect(state.flags).toEqual(['f01', 'f02']);
    expect(state.params).toEqual({ pi02: 3, p01: 10 });
    expect(state.stars).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(r.events).toContainEqual({
      type: 'warning',
      message: 'f01：隠しフラグ以外は削除できません。',
    });
  });

  it('consumes stars for cast choices and refuses when they are short', () => {
    const e = createEngine(
      scenario([
        { id: '0', text: '', choices: [go('a', '1')] },
        {
          id: '1',
          text: '',
          choices: [go('HEAL', '2', { if: 'mHEAL', cast: ['HEAL'] })],
          effects: { stars: [0, 0, 0, 1, 0, 1, 0] },
        },
        { id: '2', text: '', choices: [go('HEAL', '1', { cast: ['HEAL'] })] },
      ]),
      { random: fixed(0) },
    );
    const s = e.start(emptyGlobalState());
    let r = e.choose(s.state, s.global, 0);
    if (r.kind !== 'moved') throw new Error(r.kind);
    r = e.choose(r.state, r.global, 0);
    if (r.kind !== 'moved') throw new Error(r.kind);
    expect(r.state.stars).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(e.choose(r.state, r.global, 0)).toEqual({ kind: 'rejected', reason: 'notEnoughStars' });
  });

  it('handles number input, answers, back and missing scenes', () => {
    const e = createEngine(
      scenario([
        {
          id: '0',
          text: '',
          choices: [
            { kind: 'jump', allow: ['2'] },
            { kind: 'answer', answer: 'ペンタウァ', to: '2', else: '3' },
            go('戻る', '90000'),
            go('どこか', '404'),
          ],
        },
        { id: '2', text: '', choices: [], end: 'bad' },
        { id: '3', text: '', choices: [], end: 'bad' },
      ]),
      { random: fixed(0.99) },
    );
    const { state, global } = e.start(emptyGlobalState());
    expect(e.choose(state, global, 0, '3')).toEqual({ kind: 'rejected', reason: 'notAllowed' });
    expect(e.choose(state, global, 0, '2')).toMatchObject({ kind: 'moved', state: { scene: '2' } });
    expect(e.choose(state, global, 1, 'ペンタウァ')).toMatchObject({ state: { scene: '2' } });
    expect(e.choose(state, global, 1, 'ソーサリアン')).toMatchObject({ state: { scene: '3' } });
    expect(e.choose(state, global, 2)).toEqual({ kind: 'back' });
    expect(e.choose({ ...state, params: { p99: '3' } }, global, 2)).toMatchObject({
      state: { scene: '3' },
    });
    expect(e.choose(state, global, 3)).toEqual({ kind: 'rejected', reason: 'missingScene' });
  });

  it('keeps random results for the cache period', () => {
    const store = new Map<string, string>();
    const cache: RandomCache = { get: (k) => store.get(k), set: (k, v) => void store.set(k, v) };
    const scenes: Scenario['scenes'] = [
      { id: '0', text: '', choices: [{ label: '運試し', to: ['1', '2'], randomCacheDays: 7 }] },
      { id: '1', text: '', choices: [], end: 'bad' },
      { id: '2', text: '', choices: [], end: 'bad' },
    ];
    const first = createEngine(scenario(scenes), { random: fixed(0.9), cache });
    const s1 = first.start(emptyGlobalState());
    expect(first.choose(s1.state, s1.global, 0)).toMatchObject({ state: { scene: '2' } });
    const second = createEngine(scenario(scenes), { random: fixed(0), cache });
    const s2 = second.start(emptyGlobalState());
    expect(second.choose(s2.state, s2.global, 0)).toMatchObject({ state: { scene: '2' } });
    expect(store).toEqual(new Map([['random_demo0', '2']]));
  });

  it('ends the adventure, awards a bonus item and carries the character over to sequels', () => {
    const e = createEngine(
      scenario([
        {
          id: '0',
          text: '',
          choices: [go('a', '1')],
          effects: { items: ['i01', 'i02'], flags: ['f01'] },
        },
        { id: '1', text: '', choices: [], end: 'happy', nexts: ['next1', 'next2'] },
      ]),
      { random: fixed(0) },
    );
    const s = e.start(emptyGlobalState());
    const r = e.choose(s.state, s.global, 0);
    if (r.kind !== 'moved') throw new Error();
    expect(r.state.isEnded).toBe(true);
    expect(r.global.items).toEqual(['gi01']);
    expect(r.events).toContainEqual({ type: 'bonusAwarded', id: 'gi01' });
    expect(Object.keys(r.carryOver!)).toEqual(['next1', 'next2']);
    expect(r.carryOver!['next1']).toMatchObject({
      items: ['i02'],
      flags: [],
      scene: 0,
      ellapsed_scene: 0,
      isEnded: false,
    });
    expect(e.view(r.state, r.global).bgm).toBe('@field04');
    expect(() => e.enterScene(r.state, r.global, '0')).toThrow();
  });

  it('applies the start bonus chosen from the owned bonus items', () => {
    const e = createEngine(scenario([{ id: '0', text: '', choices: [] }]), { random: fixed(0) });
    const { state } = e.start({ ...emptyGlobalState(), items: ['gi23'] });
    expect(state.bonus).toBe('gi23');
    expect(state.stars).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('appends the footer scene to every scene except endings and excluded ones', () => {
    const sc = scenario([
      { id: '0', text: '本文', choices: [go('次へ', '1')] },
      { id: '1', text: '別', choices: [go('次へ', '0')], excludeFooter: true },
      { id: '99998', text: '<br>', choices: [go('トップへ', '0')] },
    ]);
    const e = createEngine(
      { ...sc, meta: { ...sc.meta, footerScene: '99998' } },
      { random: fixed(0) },
    );
    const { state, global } = e.start(emptyGlobalState());
    const v = e.view(state, global);
    expect(v.markdown).toBe('本文<br>');
    expect(v.choices.map((c) => [c.label, c.footer])).toEqual([
      ['次へ', false],
      ['トップへ', true],
    ]);
    const r = e.choose(state, global, 0);
    if (r.kind !== 'moved') throw new Error(r.kind);
    expect(e.view(r.state, r.global).choices.map((c) => c.label)).toEqual(['次へ']);
  });

  it('casts magic from the magic sheet', () => {
    const e = createEngine(
      scenario([
        { id: '0', text: '', choices: [], effects: { hp: -30, stars: [0, 0, 0, 1, 0, 1, 0] } },
      ]),
      {
        random: fixed(0),
      },
    );
    const s = e.start(emptyGlobalState());
    const r = e.castMagic(s.state, s.global, 'HEAL');
    expect(r.state.chara.hp).toBe(s.state.chara.hp + 15);
    expect(r.state.stars).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(e.castMagic(r.state, r.global, 'HEAL').events).toEqual([{ type: 'notEnoughStars' }]);
  });
});

describe('useItem', () => {
  const items: Scenario['items'] = [
    { id: 'i01', name: '薬草', target: 'hp', effect: '20' },
    { id: 'i02', name: '毒消し', target: 'state', effect: '-poison' },
    { id: 'i03', name: '力の実', target: 'str', effect: '1' },
    { id: 'i04', name: '金貨', target: 'free1', effect: '@100' },
    { id: 'i05', name: '鍵', target: 'param', effect: 'p01:1' },
    { id: 'i06', name: '石ころ', target: 'none' },
    { id: 'i07', name: '手紙' },
  ];
  function setup(effects: Scenario['scenes'][number]['effects']) {
    const sc = scenario([{ id: '0', text: '', choices: [], effects }]);
    const e = createEngine({ ...sc, items }, { random: fixed(0) });
    return { e, ...e.start(emptyGlobalState()) };
  }

  it('applies the effect and consumes the item like the legacy item sheet', () => {
    const { e, state, global } = setup({
      items: ['i01', 'i02', 'i03', 'i04', 'i05', 'i06'],
      hp: -30,
      state: 'poison',
    });
    let s = e.useItem(state, global, 'i01').state;
    expect(s.chara.hp).toBe(state.chara.hp + 20);
    s = e.useItem(s, global, 'i02').state;
    expect(s.chara.state).toBe('');
    s = e.useItem(s, global, 'i03').state;
    expect(s.chara.str).toBe(state.chara.str + 1);
    s = e.useItem(s, global, 'i04').state;
    expect(s.chara.free1).toBe(100);
    s = e.useItem(s, global, 'i05').state;
    expect(s.params['p01']).toBe(1);
    const r = e.useItem(s, global, 'i06');
    expect(r.events).toEqual([{ type: 'itemUsed', id: 'i06' }]);
    expect(r.state.items).toEqual([]);
  });

  it('uses up counted items one by one', () => {
    const { e, state, global } = setup({ items: ['i01:2'], hp: -30 });
    expect(state.params['pi01']).toBe(2);
    const once = e.useItem(state, global, 'i01').state;
    expect(once).toMatchObject({ items: ['i01'], params: { pi01: 1 } });
    const twice = e.useItem(once, global, 'i01').state;
    expect(twice.items).toEqual([]);
  });

  it('does nothing for items without a target or not owned', () => {
    const { e, state, global } = setup({ items: ['i07'] });
    expect(e.useItem(state, global, 'i07')).toEqual({
      state,
      global,
      events: [{ type: 'itemNotUsable', id: 'i07' }],
    });
    expect(e.useItem(state, global, 'i01').events).toEqual([{ type: 'itemNotUsable', id: 'i01' }]);
  });
});

describe('readLegacySave', () => {
  it('reads the save data written by the legacy engine as is', () => {
    const legacy = {
      chara: {
        name: 'クルトン',
        title: 'いけにえの神官',
        race: 'FIGHTER',
        sex: 'MALE',
        age: 'OLD',
        job: 'のうふ',
        state: '',
        stone_scene: 0,
        forget_scene: 0,
        hp_m: 90,
        hp: 82,
        mp_m: 60,
        mp: 48,
        str_i: 7,
        str: 7,
        int_i: 3,
        int: 3,
        dex_i: 6,
        dex: 6,
        krm_i: 4,
        krm: 4,
        free1: 0,
        free2: 0,
        free3: 0,
      },
      stars: [1, 0, 1, 2, 1, 2, 1],
      items: ['i01'],
      flags: [],
      params: {},
      memos: '',
      scene: '1010',
      ellapsed_scene: 3,
      bgm: '',
      isEnded: false,
    };
    const state: GameState = readLegacySave(JSON.stringify(legacy));
    expect(state).toEqual(legacy);
    expect(() => readLegacySave('{}')).toThrow();
  });
});
