import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateScenario, validateScenarioDraft, type DraftScenario } from '@stext/schema';
import { emptyScenario } from './model.js';
import type { LocalResource } from './resources.js';
import { createScenarioArchive, findMissingResources, validateArchiveId } from './archive.js';

function resource(projectId: string, path: string, body: string): LocalResource {
  return {
    projectId,
    scenarioId: 'forest',
    path,
    fileName: path.split('/').pop()!,
    mimeType: 'image/png',
    blob: new Blob([body], { type: 'image/png' }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('scenario archive', () => {
  it('backs up unfinished values and resources in a readable draft', async () => {
    const scenario: DraftScenario = {
      ...emptyScenario(),
      meta: { id: 'draft', title: '未完成' },
      scenes: [
        {
          id: '0',
          text: '',
          choices: [{ label: '', to: [''], cast: ['HEA'] }],
          effects: { hp: '1..' },
        },
      ],
    };
    const blob = await createScenarioArchive('project-1', scenario, [
      resource('project-1', 'capture/keep.png', 'keep'),
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const restored: unknown = JSON.parse(strFromU8(files['draft/scenario.json']!));
    expect(restored).toEqual(scenario);
    expect(validateScenario(restored).ok).toBe(false);
    expect(validateScenarioDraft(restored)).toEqual({ ok: true, scenario });
    expect(strFromU8(files['draft/capture/keep.png']!)).toBe('keep');
  });

  it('includes the scenario and every resource for that project, including unreferenced files', async () => {
    const scenario = emptyScenario();
    scenario.meta.id = 'forest';
    scenario.meta.bgm = { main: '@field01' };
    scenario.scenes[0]!.text = '![forest](tree.png)';
    const resources = [
      resource('project-1', 'capture/tree.png', 'image'),
      resource('project-1', 'chara/hero.png', 'unreferenced'),
      resource('project-2', 'capture/other.png', 'other project'),
    ];
    const progress: number[] = [];

    const blob = await createScenarioArchive('project-1', scenario, resources, (event) => {
      progress.push(event.completedBytes);
    });
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(Object.keys(files).sort()).toEqual([
      'forest/capture/tree.png',
      'forest/chara/hero.png',
      'forest/scenario.json',
    ]);
    expect(strFromU8(files['forest/capture/tree.png']!)).toBe('image');
    expect(strFromU8(files['forest/chara/hero.png']!)).toBe('unreferenced');
    expect(JSON.parse(strFromU8(files['forest/scenario.json']!))).toEqual(scenario);
    expect(progress.at(-1)).toBe(
      new Blob([JSON.stringify(scenario, null, 2) + '\n']).size +
        resources[0]!.blob.size +
        resources[1]!.blob.size,
    );
  });

  it('reports unregistered scenario-local references but ignores shared resources', () => {
    const scenario = emptyScenario();
    scenario.meta.id = 'forest';
    scenario.meta.bgm = { main: '@field01', happy: 'theme' };
    scenario.scenes[0]!.text = '![missing](missing.png)';

    expect(findMissingResources('project-1', scenario, [])).toEqual([
      'capture/missing.png',
      'bgm/theme.mp3',
    ]);
  });

  it('rejects unsafe IDs and archive paths', async () => {
    expect(validateArchiveId(undefined)).toContain('シナリオ ID');
    expect(validateArchiveId('../outside')).toContain('フォルダー名');

    const scenario = emptyScenario();
    scenario.meta.id = 'forest';
    await expect(
      createScenarioArchive('project-1', scenario, [
        resource('project-1', 'capture/../secret.png', 'unsafe'),
      ]),
    ).rejects.toThrow('素材パス');
  });

  it('identifies the resource path when reading a stored blob fails', async () => {
    const scenario = emptyScenario();
    scenario.meta.id = 'forest';
    const broken = new Blob(['unreadable']);
    Object.defineProperty(broken, 'stream', {
      value: () =>
        new ReadableStream({
          start(controller) {
            controller.error(new Error('read failed'));
          },
        }),
    });

    await expect(
      createScenarioArchive('project-1', scenario, [
        { ...resource('project-1', 'capture/broken.png', ''), blob: broken },
      ]),
    ).rejects.toThrow('forest/capture/broken.png を読み込めませんでした');
  });
});
