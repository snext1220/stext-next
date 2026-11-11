import { describe, expect, it } from 'vitest';
import { emptyScenario } from './model.js';
import {
  collectResourceReferences,
  localAudioPath,
  MAX_RESOURCE_SIZE,
  validateResourceFile,
} from './resources.js';

describe('collectResourceReferences', () => {
  it('collects scenario-local image, music, and sound paths without common resources', () => {
    const scenario = emptyScenario();
    scenario.meta.bgm = { main: 'theme', happy: '@field01' };
    scenario.scenes[0]!.text = '![image](scene.png) ![external](https://example.test/a.png)';
    scenario.scenes[0]!.bgm = 'battle';
    scenario.scenes[0]!.se = 'door';

    expect(collectResourceReferences(scenario)).toEqual([
      { path: 'capture/scene.png', kind: 'image' },
      { path: 'bgm/battle.mp3', kind: 'bgm' },
      { path: 'bgm/se/door.mp3', kind: 'se' },
      { path: 'bgm/theme.mp3', kind: 'bgm' },
    ]);
  });

  it('does not turn unsafe Markdown paths into references', () => {
    const scenario = emptyScenario();
    scenario.scenes[0]!.text = '![escape](../../secret.png) ![absolute](/secret.png)';

    expect(collectResourceReferences(scenario)).toEqual([{ path: 'bgm/main.mp3', kind: 'bgm' }]);
  });

  it('collects group music and implicit tracks used by group mode', () => {
    const scenario = emptyScenario();
    scenario.groups = [{ title: '森', start: '100', end: '199', bgm: 'forest' }];
    scenario.scenes.push({ id: '1', text: '', choices: [], end: 'happy' });

    expect(collectResourceReferences(scenario)).toEqual([
      { path: 'bgm/forest.mp3', kind: 'bgm' },
      { path: 'bgm/main.mp3', kind: 'bgm' },
      { path: 'bgm/happy.mp3', kind: 'bgm' },
    ]);
  });
});

describe('validateResourceFile', () => {
  it('accepts supported files under scenario resource folders', () => {
    expect(
      validateResourceFile(
        'capture/picture.png',
        new File(['image'], 'picture.png', { type: 'image/png' }),
      ),
    ).toBeUndefined();
    expect(
      validateResourceFile(
        'bgm/se/door.mp3',
        new File(['audio'], 'door.mp3', { type: 'audio/mpeg' }),
      ),
    ).toBeUndefined();
  });

  it('rejects unsafe paths, unsupported extensions, and oversized files', () => {
    expect(validateResourceFile('../picture.png', new File(['x'], 'picture.png'))).toContain(
      '素材パス',
    );
    expect(
      validateResourceFile('capture/CON.png', new File(['x'], 'CON.png', { type: 'image/png' })),
    ).toContain('素材パス');
    expect(validateResourceFile('capture/picture.svg', new File(['x'], 'picture.svg'))).toContain(
      '画像',
    );
    expect(
      validateResourceFile(
        'capture/picture.png',
        new File(['x'], 'picture.png', { type: 'image/jpeg' }),
      ),
    ).toContain('種類');
    const oversized = {
      name: 'large.png',
      size: MAX_RESOURCE_SIZE + 1,
    } as File;
    expect(validateResourceFile('capture/large.png', oversized)).toContain('50MB');
  });

  it('maps local music names to scenario-relative paths', () => {
    expect(localAudioPath('bgm', 'field-track')).toBe('bgm/field-track.mp3');
    expect(localAudioPath('se', 'door')).toBe('bgm/se/door.mp3');
    expect(localAudioPath('bgm', '@field01')).toBeUndefined();
  });
});
