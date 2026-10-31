import { validateScenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { convertPlaygroundJson, convertScenarioXml } from './index.js';

const xml = (scenes: string, extra = '') => `<?xml version="1.0" encoding="utf-8"?>
<scenario title="テスト" author="Rio">
<init>
  <bgm main="@field05" happy="@field04" bad="@town01"></bgm>
  <intro keywords="探索, テスト" description="説明" />
  <constraint race="FIGHTER,ELF" age="YOUNG" sex="MALE" />
</init>
<items><item id="i01" name="こいし">何の変哲もない、石だ</item></items>
<flags><flag id="f01">調べた。</flag><flag id="f02">*隠し</flag></flags>
<results><result id="r01" name="はじまり" level="1">冒険を開始した</result></results>
<enemies><enemy id="m01" name="人面岩" element="earth" attack="physics" func="L-STR" func_opp="L+R+STR" hp="10">硬い</enemy></enemies>
${extra}
${scenes}
</scenario>`;

const convert = (scenes: string, extra?: string) =>
  convertScenarioXml(xml(scenes, extra), { id: 'test' });

describe('convertScenarioXml', () => {
  it('converts metadata and definitions', () => {
    const { scenario } = convert(
      '<scene id="0">本文\n\n[次へ](1)</scene><scene id="1" end="happy">おわり</scene>',
    );
    expect(scenario.meta).toEqual({
      id: 'test',
      title: 'テスト',
      author: 'Rio',
      description: '説明',
      keywords: ['探索', 'テスト'],
      constraint: { race: ['FIGHTER', 'ELF'], age: ['YOUNG'], sex: 'MALE' },
      bgm: { main: '@field05', happy: '@field04', bad: '@town01' },
    });
    expect(scenario.items).toEqual([{ id: 'i01', name: 'こいし', text: '何の変哲もない、石だ' }]);
    expect(scenario.flags).toEqual([
      { id: 'f01', text: '調べた。' },
      { id: 'f02', text: '隠し', hidden: true },
    ]);
    expect(scenario.enemies[0]).toEqual({
      id: 'm01',
      name: '人面岩',
      text: '硬い',
      element: 'earth',
      attack: 'physics',
      func: 'L-STR',
      funcOpp: 'L+R+STR',
      hp: 10,
    });
    expect(validateScenario(scenario).ok).toBe(true);
  });

  it('moves links out of the text into choices', () => {
    const { scenario, issues } = convert(`<scene id="0">
床が凹んでいる。

![杖](scepter.png)

[踏んでみる](1)
[石を投げる](2 "i01")
[逃げる](1,1,2;7)
</scene><scene id="1" end="bad">a</scene><scene id="2" end="bad">b</scene>`);
    const scene = scenario.scenes[0]!;
    expect(scene.text).toBe('床が凹んでいる。\n\n![杖](scepter.png)');
    expect(scene.choices).toEqual([
      { label: '踏んでみる', to: ['1'] },
      { label: '石を投げる', to: ['2'], if: 'i01' },
      { label: '逃げる', to: ['1', '1', '2'], randomCacheDays: 7 },
    ]);
    expect(issues).toEqual([]);
  });

  it('keeps text between and after choices', () => {
    const { scenario } = convert(`<scene id="0">本文
[戦う](1)
**逃げる場合は DEX で判定**
[逃げる](1)
※ボタンを押すこと
</scene><scene id="1" end="bad">a</scene>`);
    const scene = scenario.scenes[0]!;
    expect(scene.text).toBe('本文');
    expect(scene.choices[1]).toEqual({
      label: '逃げる',
      to: ['1'],
      before: '**逃げる場合は DEX で判定**',
    });
    expect(scene.afterText).toBe('※ボタンを押すこと');
  });

  it('converts number input (X) and answer input (Q) links', () => {
    const { scenario } = convert(`<scene id="0">[1,2](X)
[ペンタウァ,1,2](Q)</scene><scene id="1" end="bad">a</scene><scene id="2" end="bad">b</scene>`);
    expect(scenario.scenes[0]!.choices).toEqual([
      { kind: 'jump', allow: ['1', '2'] },
      { kind: 'answer', answer: 'ペンタウァ', to: '1', else: '2' },
    ]);
  });

  it('records the magic that the legacy engine consumed when a choice was taken', () => {
    const { scenario } = convert(
      '<scene id="0">[唱える](1 "mHEAL,f01")\n[見送る](1 "-mHEAL")</scene><scene id="1" end="bad">a</scene>',
    );
    expect(scenario.scenes[0]!.choices).toEqual([
      { label: '唱える', to: ['1'], if: 'mHEAL,f01', cast: ['HEAL'] },
      { label: '見送る', to: ['1'], if: '-mHEAL' },
    ]);
  });

  it('converts conditions to the AST on request', () => {
    const r = convertScenarioXml(
      xml('<scene id="0">[a](1 "f01&amp;!i01")</scene><scene id="1" end="bad">a</scene>'),
      {
        structureConditions: true,
      },
    );
    expect(r.scenario.scenes[0]!.choices[0]).toEqual({
      label: 'a',
      to: ['1'],
      if: { all: [{ flag: 'f01' }, { not: { item: 'i01' } }] },
    });
    expect(r.stats).toMatchObject({ conditions: 1, structuredConditions: 1 });
  });

  it('converts scene attributes into effects and editor data', () => {
    const { scenario, issues } =
      convert(`<scene id="0" items="i01,-i02" flags="f01" params="p01:@3" stars="1,0,0,0,0,0,-1"
  hp="-5..-1" mp="full" str="@5" free1="+1" hp_max="1..5" state="-all" result="r01" enemies="m01,m01"
  bgm="@none" se="se01" nexts="baku02" x="1.5" y="2" level="3" color="Aqua" group="prologue" exclude="true">[a](1)</scene>
<scene id="1" end="bad">a</scene>`);
    const scene = scenario.scenes[0]!;
    expect(scene.effects).toEqual({
      items: ['i01', '-i02'],
      flags: ['f01'],
      params: ['p01:@3'],
      stars: [1, 0, 0, 0, 0, 0, -1],
      hp: '-5..-1',
      mp: 'full',
      str: '@5',
      free1: 1,
      max: { hp: '1..5' },
      state: '-all',
      result: 'r01',
    });
    expect(scene).toMatchObject({
      enemies: ['m01', 'm01'],
      bgm: '@none',
      se: 'se01',
      nexts: ['baku02'],
      excludeFooter: true,
      editor: { x: 1.5, y: 2, level: 3, color: 'Aqua', group: 'prologue' },
    });
    expect(issues.map((i) => i.message)).toEqual([
      'アイテム「i02」が定義されていません',
      'パラメーター「p01」が定義されていません',
    ]);
  });

  it('reports what cannot be converted', () => {
    const { issues } = convert('<scene id="0" hp="@0">[a](9 "f01,-f02")</scene>');
    expect(issues.map((i) => `${i.severity} ${i.path}`)).toEqual([
      'warning scenes[0].effects.hp',
      'error scenes[0].choices[0]',
      'error scenes[0].choices[0].if',
    ]);
  });

  it('sets the footer scene when scene 99998 exists', () => {
    const { scenario } = convert(
      '<scene id="0">本文</scene><scene id="99998">[トップへ](0)</scene>',
    );
    expect(scenario.meta.footerScene).toBe('99998');
  });
});

describe('convertPlaygroundJson', () => {
  it('turns edges into choices with the same rules as the Playground', () => {
    const { scenario, issues } = convertPlaygroundJson(
      {
        title: 'サンプル',
        author: 'Rio',
        init: { bgm: { main: '@field05' }, intro: {}, constraint: {}, label: {}, basic: {} },
        groups: [],
        items: [{ id: 'i99', name: 'アイテムA', text: 'えぇアイテム' }],
        flags: [],
        params: [],
        enemies: [],
        results: [],
        licence: [],
        scenes: [
          {
            id: '0',
            summary: 'プロローグ',
            text: 'はじまり',
            label: '0:\nプロローグ',
            group: 'prologue',
          },
          { id: 100, summary: 'つぎ', text: 'つぎ', end: 'happy' },
          { id: '200', text: 'べつ', end: 'bad' },
        ],
        edges: [
          { from: '0', to: '200', label: 'ランダム', type: 'R', order: 3, cache: 2 },
          { from: '0', to: '100', label: 'ランダム', type: 'R', order: 3 },
          { from: '0', to: 100, label: '次へ', condition: '', order: 1 },
          { from: '0', to: '200', label: '条件付き', condition: 'i99', order: 2 },
        ],
      },
      { id: 'pg' },
    );
    expect(scenario.scenes[0]).toEqual({
      id: '0',
      summary: 'プロローグ',
      text: 'はじまり',
      choices: [
        { label: '次へ', to: ['100'] },
        { label: '条件付き', to: ['200'], if: 'i99' },
        { label: 'ランダム', to: ['200', '100'], randomCacheDays: 2 },
      ],
      editor: { group: 'prologue' },
    });
    expect(issues).toEqual([]);
  });
});
