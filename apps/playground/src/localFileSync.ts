import { validateScenarioDraft, type DraftScenario } from '@stext/schema';
import { useRef, useState } from 'react';

export interface LocalFileHandle {
  readonly name: string;
  getFile: () => Promise<Pick<File, 'text'>>;
  requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
}

export interface LocalFileLink {
  handle: LocalFileHandle;
  scenarioId: string;
  baseline: string;
  reflectedAt?: string;
}

export function scenarioJson(scenario: DraftScenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

function requireMatchingId(id: string | undefined, targetId: string | undefined): string {
  if (!id?.trim() || !targetId?.trim())
    throw new Error('編集中の作品と保存先の両方にシナリオIDを設定してください');
  if (id !== targetId)
    throw new Error('シナリオIDが保存先と一致しません。保存先を選び直してください');
  return id;
}

export async function linkLocalFile(
  handle: LocalFileHandle,
  scenario: DraftScenario,
  confirm: (message: string) => boolean,
): Promise<LocalFileLink | undefined> {
  const baseline = await (await handle.getFile()).text();
  const result = validateScenarioDraft(JSON.parse(baseline));
  if (!result.ok) throw new Error('保存先をstext/2のシナリオJSONとして読み込めません');
  const source = validateScenarioDraft(scenario);
  if (!source.ok) throw new Error('編集中の作品をstext/2のシナリオJSONとして読み込めません');
  const scenarioId = requireMatchingId(scenario.meta.id, result.scenario.meta.id);
  if (
    scenarioJson(source.scenario) !== scenarioJson(result.scenario) &&
    !confirm(
      `「${handle.name}」（ID: ${scenarioId}）の内容は編集中の作品と異なります。\n` +
        'このファイルを保存先として連携しますか？\n\n' +
        '［ローカルへ反映］を押すと、現在の編集内容でファイル全体を置き換えます。' +
        'どちらが新しいかは自動判断できず、手元の変更を失う可能性があります。\n' +
        'この確認だけでは書き込みません。',
    )
  )
    return undefined;
  return { handle, scenarioId, baseline };
}

function errorText(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.message : String(error);
}

export async function reflectLocalFile(
  link: LocalFileLink,
  scenario: DraftScenario,
): Promise<LocalFileLink> {
  requireMatchingId(scenario.meta.id, link.scenarioId);
  const text = scenarioJson(scenario);
  const permission = await link.handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') throw new Error('保存先への書き込みが許可されませんでした');
  const current = await (await link.handle.getFile()).text();
  if (current !== link.baseline)
    throw new Error(
      '保存先が外部で変更されています。書き込みを停止しました。' +
        'VS Codeなどで内容を確認してから、保存先を選び直してください',
    );
  const writable = await link.handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      throw new AggregateError(
        [error, abortError],
        `書き込みと中止に失敗しました: ${errorText(error)} / ${errorText(abortError)}。元ファイルの内容を確認してください`,
        { cause: abortError },
      );
    }
    throw new Error(
      `書き込みに失敗しました: ${errorText(error)}。元ファイルの内容を確認してください`,
      { cause: error },
    );
  }
  return { ...link, baseline: text, reflectedAt: new Date().toISOString() };
}

export async function pickLocalFile(includeXml = false): Promise<LocalFileHandle | undefined> {
  if (!window.isSecureContext || !window.showOpenFilePicker)
    throw new Error('この環境ではローカルファイル連携を利用できません');
  let handles: LocalFileHandle[];
  try {
    handles = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: includeXml ? 'シナリオJSON・XML' : 'シナリオJSON',
          accept: includeXml
            ? { 'application/json': ['.json'], 'application/xml': ['.xml'] }
            : { 'application/json': ['.json'] },
        },
      ],
      excludeAcceptAllOption: true,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return undefined;
    throw error;
  }
  const handle = handles[0];
  if (!handle) throw new Error('保存先ファイルが選択されませんでした');
  return handle;
}

export function useLocalFileSync(projectId: string, scenario: DraftScenario) {
  const [links, setLinks] = useState<ReadonlyMap<string, LocalFileLink>>(new Map());
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [feedback, setFeedback] = useState<{
    projectId: string;
    text: string;
    error: boolean;
  } | null>(null);

  const run = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await operation();
    } catch (error) {
      setFeedback({ projectId, text: errorText(error), error: true });
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const forget = (id: string) => {
    if (working.current) return;
    setLinks((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
    setFeedback((previous) => (previous?.projectId === id ? null : previous));
  };

  return {
    supported: window.isSecureContext && typeof window.showOpenFilePicker === 'function',
    link: links.get(projectId),
    busy,
    feedback: feedback?.projectId === projectId ? feedback : null,
    choose: () =>
      run(async () => {
        const handle = await pickLocalFile();
        if (!handle) return;
        const link = await linkLocalFile(handle, scenario, (message) => window.confirm(message));
        if (!link) return;
        setLinks((previous) => new Map(previous).set(projectId, link));
        setFeedback({
          projectId,
          text: '保存先と連携しました。まだファイルには書き込んでいません。',
          error: false,
        });
      }),
    reflect: () =>
      run(async () => {
        const link = links.get(projectId);
        if (!link) throw new Error('保存先ファイルを選択してください');
        const reflected = await reflectLocalFile(link, scenario);
        setLinks((previous) => new Map(previous).set(projectId, reflected));
        setFeedback({ projectId, text: 'ローカルファイルへ反映しました。', error: false });
      }),
    forget,
    forgetCurrent: () => forget(projectId),
    attach: (id: string, link: LocalFileLink) => {
      setLinks((previous) => new Map(previous).set(id, link));
    },
  };
}

export type LocalFileSync = ReturnType<typeof useLocalFileSync>;
