import { describe, expect, it } from 'vitest';
import { validateScenarioDraft } from './draft.js';
import { validateScenario, type Scenario } from './scenario.js';

const scenario: Scenario = {
  format: 'stext/2',
  meta: { title: '編集中' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [{ id: '0', text: '本文', choices: [] }],
};

describe('validateScenarioDraft', () => {
  it('accepts completed scenarios without changing them', () => {
    expect(validateScenarioDraft(scenario)).toEqual({ ok: true, scenario });
    expect(validateScenario(scenario).ok).toBe(true);
  });

  it('restores text fields omitted by the old editor as editable blanks', () => {
    const data = {
      ...scenario,
      items: [{}],
      flags: [{}],
      params: [{}],
      enemies: [{}],
      results: [{}],
      groups: [{}],
      licence: [{}],
      scenes: [
        {
          id: '0',
          choices: [{ to: [''] }, { kind: 'answer' }],
        },
      ],
    };
    const result = validateScenarioDraft(data);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('draft was not restored');
    expect(result.scenario.scenes[0]).toEqual({
      id: '0',
      text: '',
      choices: [
        { label: '', to: [''] },
        { kind: 'answer', answer: '', to: '', else: '' },
      ],
    });
    expect(result.scenario.items).toEqual([{ id: '', name: '' }]);
    expect(result.scenario.groups).toEqual([{ title: '', start: '', end: '' }]);
    expect(validateScenario(result.scenario).ok).toBe(false);
    expect(data.items).toEqual([{}]);
  });

  it.each([
    {
      meta: {
        title: '編集中',
        id: '',
        footerScene: '',
        constraint: { race: ['F'], age: ['Y'], sex: 'M' },
      },
    },
    { items: [{ id: '', name: '鍵' }], flags: [{ id: '', text: '' }] },
    { params: [{ id: '', initial: NaN, min: -Infinity, max: Infinity }] },
    { enemies: [{ id: '', name: '敵', hp: 'p' }] },
    { enemies: [{ id: 'm01', name: '敵', hp: '入力途中' }] },
    { results: [{ id: '', name: '実績', level: 1.5 }] },
    { groups: [{ title: '章', start: '', end: '', rule: '' }] },
    { scenes: [{ id: '0', text: '', choices: [{ label: '次へ', to: [''], cast: ['HEA'] }] }] },
    {
      scenes: [
        { id: '0', text: '', choices: [{ label: '次へ', to: [], if: '', randomCacheDays: 0.5 }] },
      ],
    },
    { scenes: [{ id: '0', text: '', choices: [{ kind: 'jump', allow: [] }] }] },
    {
      scenes: [{ id: '0', text: '', choices: [{ kind: 'answer', answer: '', to: '', else: '' }] }],
    },
    {
      scenes: [
        {
          id: '0',
          text: '',
          choices: [],
          effects: {
            hp: '-',
            str: '@',
            mp: 0.5,
            max: { hp: '1..' },
            stars: [NaN, 1.5],
            result: '',
          },
        },
      ],
    },
    { scenes: [{ id: '0', text: '', choices: [], effects: { stars: 'div', state: '-' } }] },
  ])('preserves unfinished values for editing: %j', (patch) => {
    const draft = { ...scenario, ...patch };
    const before = structuredClone(draft);
    expect(validateScenarioDraft(draft)).toEqual({ ok: true, scenario: before });
    expect(draft).toEqual(before);
    expect(validateScenario(draft).ok).toBe(false);
  });

  it.each([
    null,
    { ...scenario, format: 'stext/3' },
    { ...scenario, meta: null },
    { ...scenario, items: null },
    { ...scenario, scenes: [{ id: '0', text: {}, choices: [] }] },
    { ...scenario, scenes: [{ id: '0', text: '', choices: [{ label: '', to: '10' }] }] },
    { ...scenario, scenes: [{ id: '0', text: '', choices: [], effects: { hp: {} } }] },
  ])('rejects data that cannot be handled by the editor: %j', (data) => {
    expect(validateScenarioDraft(data).ok).toBe(false);
  });
});
