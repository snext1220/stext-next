import { validateScenario, type Scenario } from '@stext/schema';
import { SCENARIO_BASE } from './config.js';

/** scenarios/index.json の一件 */
export interface ScenarioEntry {
  id: string;
  title: string;
  author?: string;
  listed: boolean;
  series?: string;
  tags?: string[];
  published?: string;
  updated?: string;
  level?: number;
  comment?: string;
  scenes: number;
  results: number;
  /** どれかを獲得していればクリアとみなす実績 */
  clears?: string[];
  /** 公開前 */
  unpublished?: boolean;
  /** 感想アンケート（Google フォーム）の ID */
  quest?: string;
  /** 書庫の詳細に出すプロローグ（Markdown） */
  prologue?: string;
}

let indexPromise: Promise<ScenarioEntry[]> | undefined;
const scenarioCache = new Map<string, Promise<Scenario>>();
/** 変換所で読み込んだシナリオ（ページを閉じると消える） */
const localScenarios = new Map<string, Scenario>();

export function loadIndex(): Promise<ScenarioEntry[]> {
  indexPromise ??= fetchJson<ScenarioEntry[]>(`${SCENARIO_BASE}index.json`).catch((e: unknown) => {
    indexPromise = undefined;
    throw e;
  });
  return indexPromise;
}

export function loadScenario(id: string): Promise<Scenario> {
  const local = localScenarios.get(id);
  if (local) return Promise.resolve(local);
  let p = scenarioCache.get(id);
  if (!p) {
    p = fetchJson<unknown>(`${SCENARIO_BASE}${encodeURIComponent(id)}/scenario.json`).then(
      (data) => {
        const v = validateScenario(data);
        if (!v.ok)
          throw new Error(
            `シナリオ「${id}」の形式が正しくありません: ${v.issues[0]?.path} ${v.issues[0]?.message}`,
          );
        return v.scenario;
      },
    );
    p.catch(() => scenarioCache.delete(id));
    scenarioCache.set(id, p);
  }
  return p;
}

export function registerLocalScenario(id: string, scenario: Scenario) {
  localScenarios.set(id, scenario);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} を読み込めませんでした（${res.status}）`);
  return (await res.json()) as T;
}
