import { checkScenario, validateScenario, type CheckIssue, type Scenario } from '@stext/schema';

export interface Problem extends CheckIssue {
  /** 問題のあるシーン（シーンの中の問題なら） */
  sceneId?: string;
}

/** スキーマの検証と整合性の検査をまとめて行う */
export function findProblems(s: Scenario): Problem[] {
  const v = validateScenario(s);
  const issues: CheckIssue[] = v.ok
    ? checkScenario(v.scenario)
    : v.issues.map((i) => ({ severity: 'error' as const, ...i }));
  return issues.map((i) => {
    const m = /^scenes\[(\d+)\]/.exec(i.path);
    const scene = m ? s.scenes[Number(m[1])] : undefined;
    return scene ? { ...i, sceneId: scene.id } : i;
  });
}

/** シーン ID ごとの問題の数 */
export function problemsByScene(problems: readonly Problem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of problems) if (p.sceneId) map.set(p.sceneId, (map.get(p.sceneId) ?? 0) + 1);
  return map;
}
