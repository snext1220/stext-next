import type { Scenario, Scene } from '@stext/schema';

export type BgmMode = 'legacy' | 'group';
export type BgmSource = 'scene' | 'group' | 'main' | 'ending' | 'implicit' | 'legacy';

export interface BgmScenarioSettings {
  meta: { bgm?: Scenario['meta']['bgm'] };
  groups: readonly Pick<Scenario['groups'][number], 'start' | 'end' | 'bgm'>[];
}

export interface BgmSelection {
  track: string;
  source: BgmSource;
}

export function getBgmMode(scenario: Pick<BgmScenarioSettings, 'groups'>): BgmMode {
  return scenario.groups.some((group) => group.bgm !== undefined && group.bgm !== '')
    ? 'group'
    : 'legacy';
}

export function resolveSceneBgm(
  scenario: BgmScenarioSettings,
  scene: Pick<Scene, 'id' | 'bgm' | 'end'>,
  previous: string,
): BgmSelection {
  if (getBgmMode(scenario) === 'legacy') {
    if (scene.end && scene.bgm === undefined) {
      const ending = scenario.meta.bgm?.[scene.end === 'good' ? 'happy' : scene.end];
      return {
        track: ending ?? scene.end,
        source: ending === undefined ? 'implicit' : 'ending',
      };
    }
    return {
      track: previous,
      source: scene.bgm === undefined ? 'legacy' : 'scene',
    };
  }

  if (scene.bgm !== undefined)
    return scene.bgm === '' ? mainTrack(scenario) : { track: scene.bgm, source: 'scene' };

  const group = groupForScene(scenario, scene.id);
  if (scene.end) {
    const ending = scenario.meta.bgm?.[scene.end === 'good' ? 'happy' : scene.end];
    if (ending) return { track: ending, source: 'ending' };
    if (group?.bgm) return { track: group.bgm, source: 'group' };
    return { track: scene.end === 'good' ? 'happy' : scene.end, source: 'implicit' };
  }
  if (group?.bgm) return { track: group.bgm, source: 'group' };
  return mainTrack(scenario);
}

function mainTrack(scenario: Pick<BgmScenarioSettings, 'meta'>): BgmSelection {
  const main = scenario.meta.bgm?.main;
  return main ? { track: main, source: 'main' } : { track: 'main', source: 'implicit' };
}

function groupForScene(
  scenario: Pick<BgmScenarioSettings, 'groups'>,
  sceneId: string,
): BgmScenarioSettings['groups'][number] | undefined {
  const sceneNumber = Number(sceneId);
  if (!/^-?\d+$/.test(sceneId) || !Number.isSafeInteger(sceneNumber)) return undefined;
  return scenario.groups.find(
    (group) =>
      /^-?\d+$/.test(group.start) &&
      /^-?\d+$/.test(group.end) &&
      Number.isSafeInteger(Number(group.start)) &&
      Number.isSafeInteger(Number(group.end)) &&
      Number(group.start) <= Number(group.end) &&
      Number(group.start) <= sceneNumber &&
      sceneNumber <= Number(group.end),
  );
}
