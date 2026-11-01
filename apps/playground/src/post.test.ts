import { describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import {
  buildPostData,
  FTP_WISH,
  initialForm,
  POST_LIMIT,
  sendPost,
  validatePost,
  type PostFiles,
  type PostForm,
} from './post.js';

const form: PostForm = {
  email: 'author@example.com',
  tag: '短編, 謎解き',
  level: '3',
  intro: 'ある町で起きた事件を解き明かす物語。',
  comment: '楽しんでください。',
  ftp: false,
};
const none: PostFiles = { bgms: [], ses: [], pics: [] };
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

describe('投稿', () => {
  it('入力欄の初期値は、シナリオの定義と前回の入力から作る', () => {
    const s = emptyScenario('題');
    s.meta.keywords = ['短編', '謎解き'];
    s.meta.description = '紹介文';
    const f = initialForm(s, {
      email: 'a@example.com',
      tag: '古い分類',
      intro: '古い紹介',
      ftp: true,
    });
    expect(f).toEqual({
      email: 'a@example.com',
      tag: '短編, 謎解き',
      level: '3',
      intro: '紹介文',
      comment: '',
      ftp: true,
    });
    expect(initialForm(emptyScenario(), { tag: '古い分類', intro: '古い紹介' })).toMatchObject({
      tag: '古い分類',
      intro: '古い紹介',
    });
  });

  it('送る前に入力とファイルを確かめる', () => {
    expect(validatePost(form, none, 100)).toEqual([]);
    expect(validatePost({ ...form, email: '' }, none, 100)).toEqual([
      '連絡先（メールアドレス）を入力してください',
    ]);
    expect(validatePost({ ...form, email: 'abc' }, none, 100)[0]).toMatch(/形式/);
    expect(validatePost({ ...form, intro: 'あ' }, none, 100)[0]).toMatch(/2〜300文字/);
    expect(validatePost({ ...form, intro: 'あ'.repeat(301) }, none, 100)[0]).toMatch(/301 文字/);
    expect(validatePost({ ...form, comment: ' ' }, none, 100)).toEqual([
      '作者よりを入力してください',
    ]);
    const wrong = {
      bgms: [file('a.wav')],
      ses: [file('b.MP3')],
      pics: [file('c.gif'), file('d.JPG')],
    };
    expect(validatePost(form, wrong, 100)).toEqual([
      'BGMに送れないファイルです：a.wav（mp3 のみ）',
      '挿絵に送れないファイルです：c.gif（png・jpg・jpeg のみ）',
    ]);
    const big = { ...none, pics: [file('intro.png', POST_LIMIT)] };
    expect(validatePost(form, big, 100)[0]).toMatch(/8MB/);
  });

  it('旧版と同じ項目名で、シナリオを scenario.json として送る', async () => {
    const s = emptyScenario('題');
    const data = buildPostData('18f0a1b2c3d', { ...form, ftp: true }, s, {
      bgms: [file('field.mp3')],
      ses: [file('hit.mp3'), file('miss.mp3')],
      pics: [file('intro.png')],
    });
    expect(data.get('key')).toBe('18f0a1b2c3d');
    expect(data.get('email')).toBe('author@example.com');
    expect(data.get('tag')).toBe('短編, 謎解き');
    expect(data.get('level')).toBe('3');
    expect(data.get('intro')).toBe(form.intro);
    expect(data.get('comment')).toBe(form.comment);
    expect(data.get('ftp')).toBe(FTP_WISH);
    const scenario = data.get('scenario') as File;
    expect(scenario.name).toBe('scenario.json');
    expect(JSON.parse(await scenario.text())).toEqual(s);
    expect(data.getAll('bgms[]').map((f) => (f as File).name)).toEqual(['field.mp3']);
    expect(data.getAll('ses[]')).toHaveLength(2);
    expect(data.getAll('pics[]').map((f) => (f as File).name)).toEqual(['intro.png']);
    expect(buildPostData('k', form, s, none).get('ftp')).toBe('');
  });

  it('応答を読まない形（no-cors）で POST する', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(null)));
    const data = new FormData();
    await sendPost('https://example.com/upload.php', data, fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/upload.php', {
      method: 'POST',
      mode: 'no-cors',
      body: data,
    });
    const failing = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(sendPost('x', data, failing)).rejects.toThrow('Failed to fetch');
  });
});
