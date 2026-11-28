import {
  checkScenario,
  validateScenario,
  type CheckIssue,
  type DraftScenario as Scenario,
} from '@stext/schema';
import { checkCombatScenario } from './combatChecks.js';

export interface Problem extends CheckIssue {
  /** 問題のあるシーン（シーンの中の問題なら） */
  sceneId?: string;
}

function addSceneIds(s: Scenario, issues: readonly CheckIssue[]): Problem[] {
  return issues.map((i) => {
    const m = /^scenes\[(\d+)\]/.exec(i.path);
    const scene = m ? s.scenes[Number(m[1])] : undefined;
    return scene ? { ...i, sceneId: scene.id } : i;
  });
}

/** スキーマ検証と軽量な整合性検査を行う */
export function findImmediateProblems(s: Scenario): Problem[] {
  const v = validateScenario(s);
  const issues: CheckIssue[] = v.ok
    ? checkScenario(v.scenario)
    : v.issues.map((i) => ({ severity: 'error' as const, ...i }));
  return addSceneIds(s, issues);
}

/** 戦闘バランスを検査する。不正なシナリオはスキーマ検証側で報告する */
export function findCombatProblems(s: Scenario): Problem[] {
  const v = validateScenario(s);
  return v.ok ? addSceneIds(s, checkCombatScenario(v.scenario)) : [];
}

/** スキーマ・整合性・戦闘バランスの検査をまとめて行う */
export function findProblems(s: Scenario): Problem[] {
  const v = validateScenario(s);
  if (!v.ok) {
    return addSceneIds(
      s,
      v.issues.map((i) => ({ severity: 'error' as const, ...i })),
    );
  }
  return addSceneIds(s, [...checkScenario(v.scenario), ...checkCombatScenario(v.scenario)]);
}

/** シーン ID ごとの問題の数 */
export function problemsByScene(problems: readonly Problem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of problems) if (p.sceneId) map.set(p.sceneId, (map.get(p.sceneId) ?? 0) + 1);
  return map;
}
