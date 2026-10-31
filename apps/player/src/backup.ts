/**
 * セーブデータのバックアップ／リストア。旧エンジンと同じ .stext ファイルを読み書きする。
 *
 * - シナリオ一つ：ファイル名「<シナリオID>-<時刻>.stext」、中身はセーブデータの JSON そのもの
 * - すべて：ファイル名「all-<時刻>.stext」、中身は「キー」「値」を一行ずつ交互に並べたもの
 *   （キーはシナリオ ID と、実績・ボーナスを持つ sorcerian_text）
 */
import { GLOBAL_SAVE_KEY, readLegacyGlobal, readLegacySave } from '@stext/core';

export const ALL = 'all';

/** バックアップの中身を作る。key が ALL なら ids に挙げたものすべて */
export function backupContent(
  key: string,
  ids: readonly string[],
  get: (key: string) => string | null,
): string | null {
  if (key !== ALL) return get(key);
  let content = '';
  for (const id of [GLOBAL_SAVE_KEY, ...ids]) {
    const value = get(id);
    if (value) content += `${id}\n${value}\n`;
  }
  return content === '' ? null : content;
}

export function backupFileName(key: string, now = Date.now()): string {
  return `${key}-${now}.stext`;
}

export interface RestoreEntry {
  key: string;
  value: string;
}

/** バックアップファイルを読み、書き戻す内容を返す。形式が正しくなければ例外 */
export function parseBackup(fileName: string, content: string): RestoreEntry[] {
  const key = fileName.split('-')[0] ?? '';
  const entries: RestoreEntry[] = [];
  if (key === ALL) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const k = lines[i]!.trim();
      const v = lines[i + 1]!;
      if (k && v) entries.push({ key: k, value: v });
    }
  } else {
    entries.push({ key, value: content.trim() });
  }
  if (entries.length === 0) throw new Error('バックアップの中にデータがありません');
  for (const e of entries) {
    try {
      if (e.key === GLOBAL_SAVE_KEY) readLegacyGlobal(e.value);
      else readLegacySave(e.value);
    } catch {
      throw new Error(`「${e.key}」のデータを読み込めません（.stext ファイルか確かめてください）`);
    }
  }
  return entries;
}

/** ブラウザでファイルとして保存させる */
export function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
