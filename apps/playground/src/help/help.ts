/**
 * ダイナミックヘルプの内容（reference.md）を読み込む。書き方は reference.md の先頭を参照。
 */
import source from './reference.md?raw';

export const MARK_KINDS = ['変更', '未実装', '誤り', '廃止', '要確認'] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export interface HelpMark {
  kind: MarkKind;
  text: string;
}

export interface HelpEntry {
  /** 最初のキー（目次やリンクで使う） */
  key: string;
  /** このエントリーを指すすべてのキー */
  keys: string[];
  title: string;
  category: string;
  /** 旧 reference.xml のパス */
  legacy: string[];
  related: string[];
  /** 移行時の指摘 */
  marks: HelpMark[];
  /** 本文（Markdown） */
  body: string;
}

export interface HelpBook {
  entries: HelpEntry[];
  get(key: string): HelpEntry | undefined;
  categories: { name: string; entries: HelpEntry[] }[];
}

const list = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

export function parseHelp(text: string): HelpBook {
  const entries: HelpEntry[] = [];
  const byKey = new Map<string, HelpEntry>();
  let category = '';
  let current: HelpEntry | undefined;
  let body: string[] = [];
  let inMeta = false;
  let fence = false;

  const finish = () => {
    if (current) current.body = body.join('\n').trim();
    body = [];
  };

  const lines = text.replace(/^\s*<!--[\s\S]*?-->/, '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `reference.md ${i + 1} 行目`;
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence && /^# /.test(line)) {
      finish();
      current = undefined;
      category = line.slice(2).trim();
      return;
    }
    if (!fence && /^## /.test(line)) {
      finish();
      const m = /^## (.+?)\s*\|\s*(.+)$/.exec(line);
      if (!m) throw new Error(`${where}：「## キー | 見出し」の形ではありません`);
      const keys = list(m[1]!);
      current = {
        key: keys[0]!,
        keys,
        title: m[2]!.trim(),
        category,
        legacy: [],
        related: [],
        marks: [],
        body: '',
      };
      for (const k of keys) {
        if (byKey.has(k)) throw new Error(`${where}：キー「${k}」が重複しています`);
        byKey.set(k, current);
      }
      entries.push(current);
      inMeta = true;
      return;
    }
    if (!current) return;
    if (inMeta) {
      const meta = /^@(legacy|related|mark)\s+(.*)$/.exec(line);
      if (meta) {
        const [, name, value = ''] = meta;
        if (name === 'legacy') current.legacy.push(...list(value));
        else if (name === 'related') current.related.push(...list(value));
        else {
          const mark = /^(\S+?)\s*[:：]\s*(.+)$/.exec(value);
          const kind = mark?.[1] as MarkKind | undefined;
          if (!mark || !kind || !MARK_KINDS.includes(kind))
            throw new Error(`${where}：@mark の種別は ${MARK_KINDS.join(' / ')} のどれかです`);
          current.marks.push({ kind, text: mark[2]!.trim() });
        }
        return;
      }
      if (line.trim() === '') return;
      inMeta = false;
    }
    body.push(line);
  });
  finish();

  const categories: HelpBook['categories'] = [];
  for (const e of entries) {
    const last = categories[categories.length - 1];
    if (last?.name === e.category) last.entries.push(e);
    else categories.push({ name: e.category, entries: [e] });
  }
  return { entries, get: (key) => byKey.get(key), categories };
}

/** 見出し・キー・本文に、空白で区切ったすべての語を含むエントリー */
export function searchHelp(book: HelpBook, query: string): HelpEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return book.entries;
  return book.entries.filter((e) => {
    const hay = `${e.title}\n${e.keys.join(' ')}\n${e.body}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const HELP: HelpBook = parseHelp(source);
