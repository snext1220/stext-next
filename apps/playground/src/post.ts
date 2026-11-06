import type { Scenario } from '@stext/schema';

export const SUBMISSION_ENDPOINT = 'https://form.os7.biz/form/submit/';
export const DISCUSSION_URL = 'https://github.com/snext1220/stext/discussions/299';

export const FORM_HIDDEN_FIELDS = {
  form_id: '261098',
  encoding_test: 'あいうえお眉幅ABC',
  base_url: 'https://form.os7.biz/',
  urlhash: 'f/06d639bb/',
  oid: '1012766',
} as const;

export const FORM_FIELDS = {
  author: 'single_seimei',
  email: 'mail',
  tag: 'free1',
  level: 'free2',
  intro: 'free3',
  comment: 'free4',
  downloadUrl: 'free5',
  retention: 'free6',
  key: 'free7',
} as const;

export const LEVELS = [
  ['1（易）', '1（易）'],
  ['2（やや易）', '2（やや易）'],
  ['3（普通）', '3（普通）'],
  ['4（やや難）', '4（やや難）'],
  ['5（難）', '5（難）'],
] as const;

const characterCount = (value: string) => Array.from(value).length;

export interface PostForm {
  author: string;
  email: string;
  tag: string;
  level: string;
  intro: string;
  comment: string;
  downloadUrl: string;
  retention: string;
  key: string;
}

export type SubmissionValues = Record<(typeof FORM_FIELDS)[keyof typeof FORM_FIELDS], string>;

export function submissionValues(form: PostForm): SubmissionValues {
  return {
    [FORM_FIELDS.author]: form.author.trim(),
    [FORM_FIELDS.email]: form.email.trim(),
    [FORM_FIELDS.tag]: form.tag.trim(),
    [FORM_FIELDS.level]: form.level,
    [FORM_FIELDS.intro]: form.intro.trim(),
    [FORM_FIELDS.comment]: form.comment.trim(),
    [FORM_FIELDS.downloadUrl]: form.downloadUrl.trim(),
    [FORM_FIELDS.retention]: form.retention.trim().replace(/\s*日(?:間)?$/, ''),
    [FORM_FIELDS.key]: form.key,
  };
}

export function clearLegacyPostData(): string | undefined {
  try {
    localStorage.removeItem('stext-next:playground:post');
    localStorage.removeItem('stext-next:playground:post-key');
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function initialForm(scenario: Scenario): PostForm {
  return {
    author: scenario.meta.author ?? '',
    email: '',
    tag: (scenario.meta.keywords ?? []).join(', '),
    level: '3（普通）',
    intro: scenario.meta.description ?? '',
    comment: '',
    downloadUrl: '',
    retention: '7',
    key: '',
  };
}

export function validatePost(form: PostForm): string[] {
  const errors: string[] = [];
  if (!form.author.trim()) errors.push('ペンネーム（作者名）を入力してください');
  else if (characterCount(form.author.trim()) > 100)
    errors.push('ペンネーム（作者名）は100文字以内で入力してください');
  if (!form.email.trim()) errors.push('連絡先（メールアドレス）を入力してください');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.push('連絡先（メールアドレス）の形式が正しくありません');
  else if (characterCount(form.email.trim()) > 254)
    errors.push('連絡先（メールアドレス）は254文字以内で入力してください');
  if (!form.tag.trim()) errors.push('分類を入力してください');
  else if (characterCount(form.tag.trim()) > 300)
    errors.push('分類は300文字以内で入力してください');
  if (!(LEVELS as readonly (readonly [string, string])[]).some(([value]) => value === form.level))
    errors.push('難易度を1〜5から選択してください');
  const introLength = characterCount(form.intro.trim());
  if (introLength < 2 || introLength > 300)
    errors.push(`シナリオ紹介は2〜300文字で入力してください（いま ${introLength} 文字）`);
  if (!form.comment.trim()) errors.push('作者よりを入力してください');
  else if (characterCount(form.comment.trim()) > 1000)
    errors.push('作者よりは1000文字以内で入力してください');
  if (!form.downloadUrl.trim()) errors.push('ギガファイル便のダウンロードURLを入力してください');
  else if (characterCount(form.downloadUrl.trim()) > 2048)
    errors.push('ダウンロードURLは2048文字以内で入力してください');
  else {
    try {
      const url = new URL(form.downloadUrl.trim());
      if (url.protocol !== 'https:' || url.username || url.password)
        errors.push('ダウンロードURLにはHTTPSのURLを入力してください');
    } catch {
      errors.push('ダウンロードURLの形式が正しくありません');
    }
  }
  if (!form.retention.trim()) errors.push('ZIPの保持期間を入力してください');
  else {
    const days = /^(\d{1,4})(?:\s*日(?:間)?)?$/.exec(form.retention.trim());
    if (!days || Number(days[1]) < 7) errors.push('保持期間は7日以上の日数で入力してください');
  }
  if (characterCount(form.key) > 128)
    errors.push('ダウンロードキーは128文字以内で入力してください');
  return errors;
}

/** Public Discussion copy omits the private contact, download URL, and key. */
export function publicSubmissionText(scenario: Scenario, form: PostForm): string {
  return [
    'シナリオ提出',
    `作品名: ${scenario.meta.title || '無題'}`,
    `シナリオID: ${scenario.meta.id || '未設定'}`,
    `作者名: ${form.author.trim() || '未入力'}`,
    `分類: ${form.tag.trim() || '未入力'}`,
    `難易度: ${form.level || '未入力'}`,
    `シナリオ紹介: ${form.intro.trim() || '未入力'}`,
    `作者より: ${form.comment.trim() || '未入力'}`,
    'ZIPをこの投稿に添付してください。',
  ].join('\n');
}
