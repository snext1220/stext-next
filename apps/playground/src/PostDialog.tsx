/**
 * シナリオの投稿（旧 Playground Flow の［投稿］ダイアログ）。
 */
import type { Scenario } from '@stext/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { POST_URL } from './config.js';
import { Field, SelectField, TextArea, TextField } from './fields.js';
import { HelpButton } from './help/HelpPanel.js';
import {
  buildPostData,
  FILE_KINDS,
  initialForm,
  LEVELS,
  postKey,
  saveForm,
  scenarioFile,
  sendPost,
  validatePost,
  type FileKind,
  type PostFiles,
  type PostForm,
} from './post.js';

const FILE_HINTS: Record<FileKind, string> = {
  bgms: 'SText 標準の BGM を使うなら不要です。1ファイル 1MB 未満を勧めます',
  ses: '数秒程度の短い音を勧めます。1ファイル 30KB 未満を勧めます',
  pics: 'intro.png（120×180px）は公開時の紹介画像になります。1ファイル 100KB 未満を勧めます',
};

const kb = (n: number) => `${Math.ceil(n / 1024).toLocaleString('ja-JP')}KB`;

export function PostDialog({
  scenario,
  errors,
  onClose,
}: {
  scenario: Scenario;
  /** 検査で見つかったエラーの数 */
  errors: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PostForm>(() => initialForm(scenario));
  const [files, setFiles] = useState<PostFiles>({ bgms: [], ses: [], pics: [] });
  const [state, setState] = useState<'edit' | 'sending' | 'sent'>('edit');
  const [issues, setIssues] = useState<string[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const scenarioSize = useMemo(() => scenarioFile(scenario).size, [scenario]);
  const total =
    scenarioSize +
    Object.values(files)
      .flat()
      .reduce((n, f) => n + f.size, 0);

  useEffect(() => panel.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'sending') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, state]);

  const set = (patch: Partial<PostForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const found = validatePost(form, files, scenarioSize);
    setIssues(found);
    if (found.length > 0) return;
    saveForm(form);
    setState('sending');
    try {
      await sendPost(POST_URL, buildPostData(postKey(), form, scenario, files));
      setState('sent');
    } catch (e) {
      setIssues([
        `送信できませんでした（${e instanceof Error ? e.message : String(e)}）。通信の状態を確かめて、もう一度お試しください`,
      ]);
      setState('edit');
    }
  };

  return (
    <div className="pg-dialog-backdrop" onClick={() => state !== 'sending' && onClose()}>
      <div
        ref={panel}
        className="pg-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-post-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-post-title">シナリオを投稿</h2>
          <HelpButton topic="post" />
          <span className="pg-spacer" />
          <button type="button" onClick={onClose} disabled={state === 'sending'}>
            閉じる
          </button>
        </header>
        {state === 'sent' ? (
          <div className="pg-dialog-body" role="status">
            <p>
              「{scenario.meta.title || '無題'}」の投稿を送信しました。投稿が届くと、連絡先（
              {form.email.trim()}）に投稿完了のメールが届きます。
            </p>
            <p className="pg-hint">
              メールが届かないときは、連絡先の入力ミスか、送信に失敗した可能性があります。連絡先を確かめて、もう一度投稿してください。
            </p>
            <div className="pg-dialog-actions">
              <button type="button" onClick={onClose}>
                閉じる
              </button>
            </div>
          </div>
        ) : (
          <form
            className="pg-dialog-body pg-editor"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p className="pg-hint">
              編集中のシナリオ（stext/2 の
              scenario.json）と添付ファイルを投稿します。合計サイズの上限は 8MB
              です。超えるときは複数回に分けて投稿してください。
            </p>
            {errors > 0 && (
              <p className="pg-error">
                「検査」でエラーが {errors} 件見つかっています。直してから投稿することを勧めます。
              </p>
            )}
            <div className="pg-grid">
              <TextField
                label="連絡先（メールアドレス）"
                value={form.email}
                onChange={(v) => set({ email: v })}
                placeholder="you@example.com"
                hint="公開時の連絡先になります"
              />
              <TextField
                label="分類"
                value={form.tag}
                onChange={(v) => set({ tag: v })}
                hint="検索のキーになります（カンマ区切り）"
              />
              <SelectField
                label="難易度"
                value={form.level}
                options={LEVELS}
                onChange={(v) => set({ level: v })}
              />
            </div>
            <TextArea
              label="シナリオ紹介（2〜300文字）"
              value={form.intro}
              onChange={(v) => set({ intro: v })}
              rows={6}
            />
            <TextArea
              label="作者より（80文字程度）"
              value={form.comment}
              onChange={(v) => set({ comment: v })}
              rows={3}
            />
            <div className="pg-grid">
              {(Object.keys(FILE_KINDS) as FileKind[]).map((kind) => (
                <Field
                  key={kind}
                  label={FILE_KINDS[kind].label}
                  hint={
                    files[kind].length > 0
                      ? `${files[kind].map((f) => f.name).join('、')}（${kb(files[kind].reduce((n, f) => n + f.size, 0))}）`
                      : FILE_HINTS[kind]
                  }
                >
                  {(id) => (
                    <input
                      id={id}
                      type="file"
                      multiple
                      accept={FILE_KINDS[kind].extensions.map((x) => `.${x}`).join(',')}
                      onChange={(e) =>
                        setFiles((f) => ({ ...f, [kind]: [...(e.target.files ?? [])] }))
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
            <label className="pg-check">
              <input
                type="checkbox"
                checked={form.ftp}
                onChange={(e) => set({ ftp: e.target.checked })}
              />
              FTP での更新を希望する（公開後に FTP で更新できます。パスワードは別途お知らせします）
            </label>
            {issues.length > 0 && (
              <ul className="pg-error" role="alert">
                {issues.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <div className="pg-dialog-actions">
              <span className="pg-hint">合計 {kb(total)} / 8MB</span>
              <span className="pg-spacer" />
              <button type="button" onClick={onClose} disabled={state === 'sending'}>
                キャンセル
              </button>
              <button type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? '送信中…' : '投稿'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
