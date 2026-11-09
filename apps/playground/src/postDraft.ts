import { strFromU8, strToU8 } from 'fflate';
import { initialForm, type PostForm } from './post.js';
import type { DraftScenario as Scenario } from '@stext/schema';

const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 8;
const MAX_AGE = 30 * 24 * 60 * 60;
const FIELDS = [
  'author',
  'email',
  'tag',
  'level',
  'intro',
  'comment',
  'downloadUrl',
  'retention',
] as const satisfies readonly (keyof PostForm)[];

function cookieName(projectId: string) {
  const name = `stext_post_${encodeURIComponent(projectId)}`;
  if (name.length > 500) throw new Error('プロジェクトIDが長すぎるため入力内容を保存できません。');
  return name;
}

function cookieAttributes(maxAge: number) {
  const path = new URL('.', window.location.href).pathname;
  return `; Max-Age=${maxAge}; Path=${path}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
}

function readCookie(name: string) {
  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function deletePostDraft(projectId: string) {
  const name = cookieName(projectId);
  for (const suffix of ['', ...Array.from({ length: MAX_CHUNKS }, (_, index) => `_${index}`)]) {
    document.cookie = `${name}${suffix}=${cookieAttributes(0)}`;
    if (readCookie(`${name}${suffix}`) !== undefined)
      throw new Error('保存した入力内容を削除できませんでした。Cookieの設定を確認してください。');
  }
}

export function loadPostDraft(projectId: string, scenario: Scenario): PostForm {
  const form = initialForm(scenario);
  const name = cookieName(projectId);
  const count = readCookie(name);
  if (count === undefined) return form;
  if (!/^[1-8]$/.test(count)) throw new Error('保存した入力内容が壊れています。削除してください。');
  let encoded = '';
  for (let index = 0; index < Number(count); index++) {
    const chunk = readCookie(`${name}_${index}`);
    if (!chunk) throw new Error('保存した入力内容が不足しています。削除してください。');
    encoded += chunk;
  }
  let saved: unknown;
  try {
    saved = JSON.parse(
      strFromU8(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))),
    );
  } catch {
    throw new Error('保存した入力内容を読み取れません。削除してください。');
  }
  if (typeof saved !== 'object' || saved === null)
    throw new Error('保存した入力内容の形式が正しくありません。削除してください。');
  const values = new Map<string, unknown>(Object.entries(saved));
  for (const field of FIELDS) {
    const value = values.get(field);
    if (typeof value !== 'string')
      throw new Error('保存した入力内容の形式が正しくありません。削除してください。');
    form[field] = value;
  }
  return form;
}

export function savePostDraft(projectId: string, form: PostForm) {
  const name = cookieName(projectId);
  const saved = Object.fromEntries(FIELDS.map((field) => [field, form[field]]));
  const encoded = btoa(
    Array.from(strToU8(JSON.stringify(saved)), (byte) => String.fromCharCode(byte)).join(''),
  );
  const count = Math.ceil(encoded.length / CHUNK_SIZE);
  if (count > MAX_CHUNKS)
    throw new Error('入力内容が長すぎるためCookieに保存できません。内容を短くしてください。');

  // 長い紹介文や作者コメントも、Cookieの1件あたりの容量制限内に分割する。
  for (let index = 0; index < count; index++) {
    const value = encoded.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    document.cookie = `${name}_${index}=${value}${cookieAttributes(MAX_AGE)}`;
    if (readCookie(`${name}_${index}`) !== value) {
      deletePostDraft(projectId);
      throw new Error('入力内容を保存できませんでした。Cookieの設定や空き容量を確認してください。');
    }
  }
  document.cookie = `${name}=${count}${cookieAttributes(MAX_AGE)}`;
  if (readCookie(name) !== String(count)) {
    deletePostDraft(projectId);
    throw new Error('入力内容を保存できませんでした。Cookieの設定や空き容量を確認してください。');
  }
  for (let index = count; index < MAX_CHUNKS; index++)
    document.cookie = `${name}_${index}=${cookieAttributes(0)}`;
}
