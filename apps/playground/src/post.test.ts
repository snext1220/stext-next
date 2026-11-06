import { describe, expect, it } from 'vitest';
import { emptyScenario } from './model.js';
import {
  FORM_FIELDS,
  FORM_HIDDEN_FIELDS,
  initialForm,
  LEVELS,
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
      retention: '7',
      key: '',
    });
  });

  it('必須入力・難易度・紹介文・HTTPS URLを検証する', () => {
    expect(validatePost(form)).toEqual([]);
    expect(validatePost({ ...form, email: '' })).toContain(
      '連絡先（メールアドレス）を入力してください',
    );
    expect(validatePost({ ...form, email: 'bad' })[0]).toContain('形式');
    expect(validatePost({ ...form, tag: ' ' })).toContain('分類を入力してください');
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
    expect(validatePost({ ...form, retention: '7' })).toEqual([]);
    expect(validatePost({ ...form, retention: '30日間' })).toEqual([]);
    expect(validatePost({ ...form, retention: '6' })).toContain(
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

  it('発行HTMLどおりの項目名とhidden値を使う', () => {
    expect(FORM_FIELDS).toEqual({
      author: 'single_seimei',
      email: 'mail',
      tag: 'free1',
      level: 'free2',
      intro: 'free3',
      comment: 'free4',
      downloadUrl: 'free5',
      retention: 'free6',
      key: 'free7',
    });
    expect(FORM_HIDDEN_FIELDS).toEqual({
      form_id: '261098',
      encoding_test: 'あいうえお眉幅ABC',
      base_url: 'https://form.os7.biz/',
      urlhash: 'f/06d639bb/',
      oid: '1012766',
    });
    expect(submissionValues(form)).toEqual({
      [FORM_FIELDS.author]: '作者名',
      [FORM_FIELDS.email]: 'author@example.com',
      [FORM_FIELDS.tag]: '短編, 謎解き',
      [FORM_FIELDS.level]: '3（普通）',
      [FORM_FIELDS.intro]: form.intro,
      [FORM_FIELDS.comment]: form.comment,
      [FORM_FIELDS.retention]: '7',
      [FORM_FIELDS.key]: 'secret-key',
      [FORM_FIELDS.downloadUrl]: 'https://gigafile.nu/example',
    });
    expect(SUBMISSION_ENDPOINT).toBe('https://form.os7.biz/form/submit/');
  });

  it('送信するテキストを整形し、任意のキーは変更しない', () => {
    const values = submissionValues({
      ...form,
      author: ' 作者名 ',
      email: ' author@example.com ',
      retention: ' 30 日間 ',
      key: ' key ',
    });
    expect(values.single_seimei).toBe('作者名');
    expect(values.mail).toBe('author@example.com');
    expect(values.free6).toBe('30');
    expect(values.free7).toBe(' key ');
  });
});
