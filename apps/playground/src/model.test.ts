import { validateScenario, type Scenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { autoLayout } from './layout.js';
import {
  addChoice,
  addScene,
  deleteScene,
  emptyScenario,
  moveChoice,
  nextSceneId,
  removeChoice,
  renameScene,
  sceneSelectionGroups,
  toGraph,
  updateChoice,
  updateScene,
} from './model.js';

function sample(): Scenario {
  const s = emptyScenario('テスト');
  return {
    ...s,
    meta: { ...s.meta, footerScene: '99998' },
    scenes: [
      {
        id: '0',
        text: '${import 99}はじまり',
        choices: [
          { label: '次へ', to: ['10'] },
          { kind: 'jump', allow: ['10', '20'] },
        ],
      },
      {
        id: '10',
        text: '',
        choices: [
          { label: '運試し', to: ['20', '10'] },
          { kind: 'answer', answer: 'はい', to: '20', else: '0' },
        ],
        rule: '99',
      },
      { id: '20', text: '', choices: [], end: 'bad' },
      { id: '99', text: 'ルール', choices: [] },
      { id: '99998', text: '', choices: [{ label: 'トップへ', to: ['0'] }] },
    ],
  };
}

describe('scene selection groups', () => {
  const scene = (id: string) => ({ id, text: '', choices: [] });

  it('sorts groups by start id and scenes numerically without changing the scenario', () => {
    const s: Scenario = {
      ...emptyScenario(),
      groups: [
        { title: '後半', start: '20', end: '100' },
        { title: '前半', start: '2', end: '10' },
      ],
      scenes: ['100', '10', 'town', '2', '20', '0'].map(scene),
    };
    const before = structuredClone(s);
    expect(sceneSelectionGroups(s).map((g) => [g.title, g.scenes.map((item) => item.id)])).toEqual([
      ['前半', ['2', '10']],
      ['後半', ['20', '100']],
      ['グループ未所属', ['0', 'town']],
    ]);
    expect(s).toEqual(before);
  });

  it('includes boundary scenes in every matching group and omits empty groups', () => {
    const s: Scenario = {
      ...emptyScenario(),
      groups: [
        { title: '最初', start: '0', end: '10' },
        { title: '重複', start: '10', end: '20' },
        { title: '空', start: '30', end: '40' },
      ],
      scenes: ['20', '10', '0'].map(scene),
    };
    expect(sceneSelectionGroups(s).map((g) => g.scenes.map((item) => item.id))).toEqual([
      ['0', '10'],
      ['10', '20'],
    ]);
  });

  it('sorts all scenes when no groups exist, including text ids', () => {
    const s = { ...emptyScenario(), scenes: ['town10', '10', '2', 'town2'].map(scene) };
    expect(sceneSelectionGroups(s).map((g) => g.scenes.map((item) => item.id))).toEqual([
      ['2', '10', 'town2', 'town10'],
    ]);
    expect(sceneSelectionGroups({ ...s, scenes: [] })).toEqual([]);
  });

  it('compares negative and decimal ids by their numeric values', () => {
    const s = { ...emptyScenario(), scenes: ['2.5', '-2', '2.11', '-10'].map(scene) };
    expect(sceneSelectionGroups(s)[0]!.scenes.map((item) => item.id)).toEqual([
      '-10',
      '-2',
      '2.11',
      '2.5',
    ]);
  });
});

describe('editing model', () => {
  it('starts with a valid empty scenario', () => {
    expect(validateScenario(emptyScenario()).ok).toBe(true);
  });

  it('adds scenes with the next id and an optional choice', () => {
    // 90000 以上（戻る・共通フッターなど）は数えず、最大の 99 の次の10の倍数
    expect(nextSceneId(sample())).toBe('100');
    const { scenario, id } = addScene(sample(), { from: '20', label: '進む' });
    expect(id).toBe('100');
    expect(scenario.scenes.find((x) => x.id === '20')!.choices).toEqual([
      { label: '進む', to: ['100'] },
    ]);
    expect(() => addScene(sample(), { id: '10' })).toThrow('すでにあります');
  });

  it('renames a scene and every reference to it', () => {
    const s = renameScene(renameScene(sample(), '10', '100'), '99', 'rule');
    expect(s.scenes.map((x) => x.id)).toEqual(['0', '100', '20', 'rule', '99998']);
    expect(s.scenes[0]!.choices).toEqual([
      { label: '次へ', to: ['100'] },
      { kind: 'jump', allow: ['100', '20'] },
    ]);
    expect(s.scenes[0]!.text).toBe('${import rule}はじまり');
    expect(s.scenes[1]!.choices[0]).toEqual({ label: '運試し', to: ['20', '100'] });
    expect(s.scenes[1]!.rule).toBe('rule');
    expect(renameScene(sample(), '99998', 'footer').meta.footerScene).toBe('footer');
    expect(() => renameScene(sample(), '10', '20')).toThrow();
  });

  it('deletes a scene and the choices that only led there', () => {
    const s = deleteScene(sample(), '20');
    expect(s.scenes[0]!.choices).toEqual([
      { label: '次へ', to: ['10'] },
      { kind: 'jump', allow: ['10'] },
    ]);
    expect(s.scenes.find((x) => x.id === '10')!.choices).toEqual([{ label: '運試し', to: ['10'] }]);
    expect(deleteScene(sample(), '99998').meta.footerScene).toBeUndefined();
  });

  it('edits, moves and removes choices', () => {
    let s = addChoice(sample(), '20', '0', '戻る');
    s = updateChoice(s, '20', 0, { label: '最初へ', to: ['0'], if: 'f01' });
    expect(s.scenes[2]!.choices).toEqual([{ label: '最初へ', to: ['0'], if: 'f01' }]);
    s = moveChoice(s, '0', 0, 1);
    expect(s.scenes[0]!.choices[1]).toEqual({ label: '次へ', to: ['10'] });
    s = removeChoice(s, '0', 1);
    expect(s.scenes[0]!.choices).toHaveLength(1);
  });

  it('drops empty optional fields when updating', () => {
    const s = updateScene(sample(), '0', { summary: '', bgm: undefined });
    expect('summary' in s.scenes[0]!).toBe(false);
    expect(validateScenario(s).ok).toBe(true);
  });

  it('derives the flow graph', () => {
    const { nodes, edges } = toGraph(sample());
    expect(nodes.map((n) => n.id)).toEqual(['0', '10', '20', '99', '99998']);
    expect(edges.map((e) => `${e.source}>${e.target}:${e.kind}`)).toEqual([
      '0>10:go',
      '0>10:jump',
      '0>20:jump',
      '10>20:random',
      '10>10:random',
      '10>20:answer',
      '10>0:answer',
      '99998>0:go',
    ]);
  });

  it('lays out scenes without positions', () => {
    const s = autoLayout(sample());
    expect(
      s.scenes.every((x) => typeof x.editor?.x === 'number' && typeof x.editor?.y === 'number'),
    ).toBe(true);
    const fixed = updateScene(s, '0', { editor: { x: 5, y: 7 } });
    expect(autoLayout(fixed).scenes[0]!.editor).toEqual({ x: 5, y: 7 });
  });
});
