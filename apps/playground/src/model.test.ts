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
