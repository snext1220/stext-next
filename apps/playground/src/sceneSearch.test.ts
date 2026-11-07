import type { Scene } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { searchScenes } from './sceneSearch.js';

describe('searchScenes', () => {
  const scenes: Scene[] = [
    {
      id: '20',
      summary: '森の入口',
      text: '大きな木の下で休む。',
      afterText: '検索対象外',
      choices: [{ label: '先へ進む', to: ['30'], before: '検索対象外' }],
    },
    {
      id: '10',
      summary: '洞窟',
      text: '暗い道を進む。',
      choices: [{ kind: 'answer', answer: 'Open the door', to: '20', else: '10' }],
    },
    { id: '30', summary: '湖', text: '静かな湖。', choices: [{ kind: 'jump', allow: ['20'] }] },
  ];

  it('searches summary, body, and choice captions case-insensitively once per scene', () => {
    const results = searchScenes(scenes, '森');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      scene: scenes[0],
      fields: ['サマリー'],
      excerpt: '森の入口',
    });

    expect(searchScenes(scenes, 'OPEN')[0]).toMatchObject({
      scene: scenes[1],
      fields: ['選択肢'],
      excerpt: 'Open the door',
    });
    expect(searchScenes(scenes, '暗い')[0]?.fields).toEqual(['本文']);
  });

  it('aggregates matching fields and excludes text outside the supported search scope', () => {
    const scene: Scene = {
      id: '1',
      summary: '扉',
      text: '扉を開ける。',
      choices: [
        { label: '扉を押す', to: ['2'] },
        { kind: 'answer', answer: '扉の鍵', to: '2', else: '1' },
      ],
    };

    expect(searchScenes([scene], '扉')[0]?.fields).toEqual(['サマリー', '本文', '選択肢']);
    expect(searchScenes(scenes, '検索対象外')).toEqual([]);
  });

  it('returns no results for an empty query', () => {
    expect(searchScenes(scenes, '   ')).toEqual([]);
  });
});
