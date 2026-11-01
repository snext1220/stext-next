/**
 * シナリオの投稿。旧 Playground Flow の［投稿］と同じ項目を、同じ投稿先（upload.php）へ送る。
 * 旧版との違いは、シナリオを scenario.xml ではなく scenario.json（stext/2）で送ること。
 */
import type { Scenario } from '@stext/schema';

/** 投稿できる合計サイズの上限（旧版と同じ 8MB） */
export const POST_LIMIT = 8 * 1024 * 1024;

const KEY_KEY = 'stext-next:playground:post-key';
const FORM_KEY = 'stext-next:playground:post';

/** FTP を希望するときに送る値（旧版と同じ） */
export const FTP_WISH = '★FTP希望★';

export interface PostForm {
  email: string;
  /** 分類（カンマ区切り） */
  tag: string;
  /** 難易度 1〜5 */
  level: string;
  /** シナリオ紹介 */
  intro: string;
  /** 作者より */
  comment: string;
  ftp: boolean;
}

export type FileKind = 'bgms' | 'ses' | 'pics';
export type PostFiles = Record<FileKind, readonly File[]>;

/** 添付ファイルの種類。拡張子は upload.php が受け付けるもの */
export const FILE_KINDS: Record<FileKind, { label: string; extensions: readonly string[] }> = {
  bgms: { label: 'BGM', extensions: ['mp3'] },
  ses: { label: '効果音', extensions: ['mp3'] },
  pics: { label: '挿絵', extensions: ['png', 'jpg', 'jpeg'] },
};

export const LEVELS = [
  ['5', '5（Hell）'],
  ['4', '4（Hard）'],
  ['3', '3（Normal）'],
  ['2', '2（Easy）'],
  ['1', '1（Very Easy）'],
] as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても投稿はできる
  }
}

/**
 * 入力欄の初期値。連絡先・難易度・作者より・FTP は前回の入力を使う。
 * 分類とシナリオ紹介は、シナリオの「定義」（キーワード・紹介文）にあればそちらを使う。
 */
export function initialForm(scenario: Scenario, saved: Partial<PostForm> = loadForm()): PostForm {
  const keywords = (scenario.meta.keywords ?? []).join(', ');
  return {
    email: saved.email ?? '',
    tag: keywords || (saved.tag ?? ''),
    level: saved.level ?? '3',
    intro: scenario.meta.description || (saved.intro ?? ''),
    comment: saved.comment ?? '',
    ftp: saved.ftp ?? false,
  };
}

export function loadForm(): Partial<PostForm> {
  try {
    return JSON.parse(read(FORM_KEY) ?? '{}') as Partial<PostForm>;
  } catch {
    return {};
  }
}

export function saveForm(form: PostForm) {
  write(FORM_KEY, JSON.stringify(form));
}

/** 投稿者を見分けるキー（ブラウザーごと。投稿先のフォルダー名になる） */
export function postKey(): string {
  const saved = read(KEY_KEY);
  if (saved && /^[0-9a-z]{8,}$/i.test(saved)) return saved;
  const key = Date.now().toString(16);
  write(KEY_KEY, key);
  return key;
}

export function scenarioFile(scenario: Scenario): Blob {
  return new Blob([JSON.stringify(scenario, null, 2) + '\n'], { type: 'application/json' });
}

const extension = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';

/** 送る前の確認。問題がなければ空の配列 */
export function validatePost(form: PostForm, files: PostFiles, scenarioSize: number): string[] {
  const errors: string[] = [];
  if (!form.email.trim()) errors.push('連絡先（メールアドレス）を入力してください');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.push('連絡先（メールアドレス）の形式が正しくありません');
  const intro = form.intro.trim().length;
  if (intro < 2 || intro > 300)
    errors.push(`シナリオ紹介は2〜300文字で入力してください（いま ${intro} 文字）`);
  if (!form.comment.trim()) errors.push('作者よりを入力してください');
  for (const kind of Object.keys(FILE_KINDS) as FileKind[]) {
    const { label, extensions } = FILE_KINDS[kind];
    for (const f of files[kind])
      if (!extensions.includes(extension(f.name)))
        errors.push(`${label}に送れないファイルです：${f.name}（${extensions.join('・')} のみ）`);
  }
  const total =
    scenarioSize +
    Object.values(files)
      .flat()
      .reduce((n, f) => n + f.size, 0);
  if (total > POST_LIMIT)
    errors.push(
      `合計サイズが上限（8MB）を超えています（${(total / 1024 / 1024).toFixed(1)}MB）。複数回に分けて投稿してください`,
    );
  return errors;
}

/** upload.php に送るデータ（項目名は旧版と同じ） */
export function buildPostData(
  key: string,
  form: PostForm,
  scenario: Scenario,
  files: PostFiles,
): FormData {
  const data = new FormData();
  data.append('key', key);
  data.append('email', form.email.trim());
  data.append('tag', form.tag);
  data.append('level', form.level);
  data.append('intro', form.intro);
  data.append('comment', form.comment);
  data.append('ftp', form.ftp ? FTP_WISH : '');
  data.append('scenario', scenarioFile(scenario), 'scenario.json');
  for (const kind of Object.keys(FILE_KINDS) as FileKind[])
    for (const f of files[kind]) data.append(`${kind}[]`, f, f.name);
  return data;
}

/**
 * 送る。投稿先は CORS に対応していないので、応答は読めない（no-cors）。
 * 通信できなかったときだけ失敗になる。
 */
export async function sendPost(
  url: string,
  data: FormData,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await fetcher(url, { method: 'POST', mode: 'no-cors', body: data });
}
