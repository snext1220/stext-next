import { Zip, ZipPassThrough } from 'fflate';
import type { Scenario } from '@stext/schema';
import {
  collectResourceReferences,
  isSafeLocalResourcePath,
  type LocalResource,
} from './resources.js';

export interface ArchiveProgress {
  completedBytes: number;
  totalBytes: number;
}

export function validateArchiveId(id: string | undefined): string | undefined {
  if (!id?.trim()) return 'シナリオ ID を設定してから ZIP を作成してください';
  if (
    id.includes('/') ||
    id.includes('\\') ||
    id === '.' ||
    id === '..' ||
    /[<>:"|?*]/.test(id) ||
    /[. ]$/.test(id) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(id) ||
    Array.from(id, (character) => character.charCodeAt(0)).some(
      (code) => code < 0x20 || code === 0x7f,
    )
  )
    return 'シナリオ ID は ZIP のフォルダー名に使えない形式です。安全な ID に変更してください';
  return undefined;
}

export function findMissingResources(
  projectId: string,
  scenario: Scenario,
  resources: readonly LocalResource[],
): string[] {
  const registered = new Set(
    resources
      .filter((resource) => resource.projectId === projectId)
      .map((resource) => resource.path),
  );
  return collectResourceReferences(scenario)
    .map((reference) => reference.path)
    .filter((path) => !registered.has(path));
}

export function createScenarioArchive(
  projectId: string,
  scenario: Scenario,
  resources: readonly LocalResource[],
  onProgress: (progress: ArchiveProgress) => void = () => {},
): Promise<Blob> {
  const idError = validateArchiveId(scenario.meta.id);
  if (idError) return Promise.reject(new Error(idError));

  const root = scenario.meta.id!;
  const projectResources = resources.filter((resource) => resource.projectId === projectId);
  const entries = [
    {
      path: `${root}/scenario.json`,
      blob: new Blob([`${JSON.stringify(scenario, null, 2)}\n`], {
        type: 'application/json',
      }),
    },
    ...projectResources.map((resource) => ({
      path: `${root}/${resource.path}`,
      blob: resource.blob,
    })),
  ];
  const paths = new Set<string>();
  for (const resource of projectResources) {
    if (!isSafeLocalResourcePath(resource.path))
      return Promise.reject(new Error(`ZIPに使用できない素材パスです: ${resource.path}`));
  }
  for (const entry of entries) {
    const key = entry.path.toLocaleLowerCase('en-US');
    if (paths.has(key))
      return Promise.reject(new Error(`ZIP内でファイル名が衝突しています: ${entry.path}`));
    paths.add(key);
    if (!(entry.blob instanceof Blob))
      return Promise.reject(new Error(`素材を読み込めません: ${entry.path}`));
  }

  const totalBytes = entries.reduce((total, entry) => total + entry.blob.size, 0);
  let completedBytes = 0;
  onProgress({ completedBytes, totalBytes });

  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    let settled = false;
    let activePath = 'ZIPデータ';
    const archive = new Zip((error, data, final) => {
      if (settled) return;
      if (error) {
        settled = true;
        reject(
          new Error(
            `${activePath} の圧縮に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        return;
      }
      if (data) {
        const copy = new ArrayBuffer(data.byteLength);
        new Uint8Array(copy).set(data);
        chunks.push(new Blob([copy]));
      }
      if (final) {
        settled = true;
        resolve(new Blob(chunks, { type: 'application/zip' }));
      }
    });

    void (async () => {
      for (const entry of entries) {
        activePath = entry.path;
        const file = new ZipPassThrough(entry.path);
        archive.add(file);
        const reader = entry.blob.stream().getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              file.push(new Uint8Array(), true);
              break;
            }
            file.push(value);
            completedBytes += value.byteLength;
            onProgress({ completedBytes, totalBytes });
          }
        } catch (error) {
          throw new Error(
            `${entry.path} を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        } finally {
          reader.releaseLock();
        }
      }
      archive.end();
    })().catch((error: unknown) => {
      if (settled) return;
      settled = true;
      archive.terminate();
      reject(error);
    });
  });
}
