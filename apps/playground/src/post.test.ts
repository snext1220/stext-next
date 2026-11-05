import { describe, expect, it } from 'vitest';
import { emptyScenario } from './model.js';
import {
  FORM_FIELDS,
  initialForm,
  LEVELS,
  publicSubmissionText,
  SUBMISSION_ENDPOINT,
  submissionValues,
  validatePost,
  type PostForm,
} from './post.js';

const form: PostForm = {
  author: '作者名',
  email: 'author@example.com',
  tag: '短編, 謎解き',
  level: '3（普通）',
  intro: 'ある町で起きた事件を解き明かす物語。',
  comment: '楽しんでください。',
  downloadUrl: 'https://gigafile.nu/example',
  retention: '7日',
  key: 'secret-key',
};

describe('提出フォーム', () => {
  it('作品情報を初期値にし、連絡先やキーは空で始める', () => {
    const scenario = emptyScenario('題');
    scenario.meta.author = '作者';
    scenario.meta.keywords = ['短編', '謎解き'];
    scenario.meta.description = '紹介文';
    expect(initialForm(scenario)).toEqual({
      author: '作者',
      email: '',
      tag: '短編, 謎解き',
      level: '3（普通）',
      intro: '紹介文',
      comment: '',
      downloadUrl: '',
      retention: '',
      key: '',
    });
  });

  it('必須入力・難易度・紹介文・HTTPS URLを検証する', () => {
    expect(validatePost(form)).toEqual([]);
    expect(validatePost({ ...form, email: '' })).toContain(
      '連絡先（メールアドレス）を入力してください',
    );
    expect(validatePost({ ...form, email: 'bad' })[0]).toContain('形式');
    expect(validatePost({ ...form, intro: 'a' })[0]).toContain('2〜300文字');
    expect(validatePost({ ...form, intro: 'あ'.repeat(301) })[0]).toContain('301 文字');
    expect(validatePost({ ...form, level: '6' })).toContain('難易度を1〜5から選択してください');
    expect(validatePost({ ...form, downloadUrl: 'http://gigafile.nu/a' })).toContain(
      'ダウンロードURLにはHTTPSのURLを入力してください',
    );
    expect(validatePost({ ...form, retention: ' ' })).toContain('ZIPの保持期間を入力してください');
    expect(validatePost({ ...form, retention: '3日' })).toContain(
      '保持期間は7日以上の日数で入力してください',
    );
    expect(validatePost({ ...form, retention: '10000日' })).toContain(
      '保持期間は7日以上の日数で入力してください',
    );
    expect(validatePost({ ...form, author: '😀'.repeat(100) })).toEqual([]);
    expect(validatePost({ ...form, author: '😀'.repeat(101) })).toContain(
      'ペンネーム（作者名）は100文字以内で入力してください',
    );
    expect(LEVELS.map(([value]) => value)).toEqual([
      '1（易）',
      '2（やや易）',
      '3（普通）',
      '4（やや難）',
      '5（難）',
    ]);
  });

  it('PHP受け口へ送るフォーム項目を整形し、honeypotは空にする', () => {
    expect(submissionValues(form)).toEqual({
      [FORM_FIELDS.author]: '作者名',
      [FORM_FIELDS.email]: 'author@example.com',
      [FORM_FIELDS.tag]: '短編, 謎解き',
      [FORM_FIELDS.level]: '3（普通）',
      [FORM_FIELDS.intro]: form.intro,
      [FORM_FIELDS.comment]: form.comment,
      [FORM_FIELDS.retention]: '7日',
      [FORM_FIELDS.key]: 'secret-key',
      [FORM_FIELDS.downloadUrl]: 'https://gigafile.nu/example',
      website: '',
    });
    expect(SUBMISSION_ENDPOINT).toBe(
      'https://www.web-deli.com/sorcerian/text/playground/submit.php',
    );
  });

  it('GitHub Discussions向けコピーに投稿情報を含め、連絡先・ダウンロードURL・キーを含めない', () => {
    const scenario = emptyScenario('作品');
    scenario.meta.id = 'scenario-1';
    const text = publicSubmissionText(scenario, form);
    expect(text).toContain('作品名: 作品');
    expect(text).toContain('シナリオID: scenario-1');
    expect(text).toContain('作者名: 作者名');
    expect(text).toContain('分類: 短編, 謎解き');
    expect(text).toContain('難易度: 3（普通）');
    expect(text).toContain(`シナリオ紹介: ${form.intro}`);
    expect(text).toContain(`作者より: ${form.comment}`);
    expect(text).not.toContain(form.email);
    expect(text).not.toContain(form.downloadUrl);
    expect(text).not.toContain(form.key);
    expect(text).not.toContain('保持期間');
  });
});
