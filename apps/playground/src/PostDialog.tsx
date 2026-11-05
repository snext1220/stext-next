import type { Scenario } from '@stext/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createScenarioArchive, findMissingResources, validateArchiveId } from './archive.js';
import { Field } from './fields.js';
import { HelpButton } from './help/HelpPanel.js';
import type { LocalResource } from './resources.js';
import {
  DISCUSSION_URL,
  FORM_FIELDS,
  initialForm,
  LEVELS,
  publicSubmissionText,
  SUBMISSION_ENDPOINT,
  submissionValues,
  validatePost,
  type PostForm,
} from './post.js';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export function PostDialog({
  scenario,
  projectId,
  resources,
  errors,
  onClose,
}: {
  scenario: Scenario;
  projectId: string;
  resources: readonly LocalResource[];
  /** 検査で見つかったエラーの数 */
  errors: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PostForm>(() => initialForm(scenario));
  const [issues, setIssues] = useState<string[]>([]);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipNotice, setZipNotice] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [creatingZip, setCreatingZip] = useState(false);
  const [sending, setSending] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scenarioIdError = validateArchiveId(scenario.meta.id);
  const projectResources = useMemo(
    () => resources.filter((resource) => resource.projectId === projectId),
    [projectId, resources],
  );
  const missingResources = useMemo(
    () => findMissingResources(projectId, scenario, resources),
    [projectId, resources, scenario],
  );
  const archiveSize = useMemo(
    () => projectResources.reduce((total, resource) => total + resource.blob.size, 0),
    [projectResources],
  );

  useEffect(() => {
    panel.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creatingZip && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creatingZip, onClose, sending]);

  const set = (patch: Partial<PostForm>) => setForm((current) => ({ ...current, ...patch }));

  const createZip = async () => {
    if (creatingZip || scenarioIdError) return;
    if (
      missingResources.length > 0 &&
      !window.confirm(
        `次の素材は未登録のためZIPに含まれません。\n\n${missingResources.join('\n')}\n\nこのままZIPを作成しますか？`,
      )
    )
      return;

    setCreatingZip(true);
    setZipError(null);
    setZipNotice(null);
    try {
      const archive = await createScenarioArchive(projectId, scenario, resources);
      downloadBlob(archive, `${scenario.meta.id}.zip`);
      setZipNotice('ZIPのダウンロードを開始しました。保存先を確認してください。');
    } catch (error) {
      setZipError(
        `ZIPを作成できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCreatingZip(false);
    }
  };

  const copyDiscussionText = async () => {
    try {
      await navigator.clipboard.writeText(publicSubmissionText(scenario, form));
      setCopyNotice(
        '作者名・分類・難易度・紹介・作者よりを含むGitHub用の文面をコピーしました。メールアドレスとダウンロード情報は含みません。',
      );
    } catch (error) {
      setCopyNotice(
        `コピーできませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const submit = async () => {
    const found = validatePost(form);
    if (scenarioIdError) found.unshift(scenarioIdError);
    setIssues(found);
    if (found.length > 0) return;
    if (sending) return;
    setSending(true);
    setSubmittedNotice(null);
    try {
      const response = await fetch(SUBMISSION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams(Object.entries(submissionValues(form))),
        credentials: 'omit',
        cache: 'no-store',
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== 'object' ||
        result === null ||
        !('accepted' in result) ||
        result.accepted !== true
      ) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : '提出を受け付けられませんでした。入力内容を確認して再度お試しください。';
        throw new Error(message);
      }
      setSubmittedNotice(
        '提出情報を受け付けました。メール配送の完了は確認できないため、実際に届かない場合があります。公開前に管理者が内容を確認します。',
      );
    } catch (error) {
      setIssues([
        `提出できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pg-dialog-backdrop" onClick={() => !creatingZip && !sending && onClose()}>
      <div
        ref={panel}
        className="pg-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-post-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-post-title">作品を提出</h2>
          <HelpButton topic="post" />
          <span className="pg-spacer" />
          <button type="button" onClick={onClose} disabled={creatingZip || sending}>
            閉じる
          </button>
        </header>
        <form
          className="pg-dialog-body pg-editor"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="pg-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <p className="pg-hint">
            1. ZIPをダウンロードし、ギガファイル便にアップロードします。 2.
            ダウンロードURLと投稿情報を送信します。受付後、管理者が内容を確認してから公開します。
          </p>
          {errors > 0 && (
            <p className="pg-error">
              「検査」でエラーが {errors} 件見つかっています。直してから提出することを勧めます。
            </p>
          )}
          {scenarioIdError && <p className="pg-error">{scenarioIdError}</p>}

          <section aria-label="ZIPの内容">
            <h3>1. 作品ZIP</h3>
            <dl className="pg-submission-summary">
              <dt>作品名</dt>
              <dd>{scenario.meta.title || '無題'}</dd>
              <dt>シナリオID</dt>
              <dd>{scenario.meta.id || '未設定'}</dd>
              <dt>収録素材</dt>
              <dd>
                {projectResources.length}件 / {formatSize(archiveSize)}
              </dd>
            </dl>
            <p className="pg-hint">
              作品名とIDはZIP内の <code>scenario.json</code>{' '}
              から確認します。この表示内容は受付フォームには送信しません。ZIPには連絡先やダウンロードキーも含まれません。
            </p>
            {projectResources.length > 0 && (
              <ul>
                {projectResources.map((resource) => (
                  <li key={resource.path}>
                    {resource.path}（{formatSize(resource.blob.size)}）
                  </li>
                ))}
              </ul>
            )}
            {missingResources.length > 0 && (
              <p className="pg-error">
                未登録素材が {missingResources.length}{' '}
                件あります。ZIPには含まれないため、作成時に確認します。
              </p>
            )}
            <button
              type="button"
              onClick={() => void createZip()}
              disabled={creatingZip || !!scenarioIdError}
            >
              {creatingZip ? 'ZIPを作成しています…' : 'ZIPを作成してダウンロード'}
            </button>
            {zipNotice && (
              <p className="pg-message" role="status">
                {zipNotice}
              </p>
            )}
            {zipError && (
              <p className="pg-error" role="alert">
                {zipError}
              </p>
            )}
          </section>

          <section aria-label="アップロードと提出">
            <h3>2. アップロードと提出</h3>
            <p className="pg-hint">
              ギガファイル便で保持期間を7日以上にし、必要ならダウンロードキーを設定してください。ZIPのアップロード完了後、URL・保持期間・キーを控えてこの画面に戻ります。
            </p>
            <p className="pg-dialog-actions">
              <a href="https://gigafile.nu/" target="_blank" rel="noopener noreferrer">
                ギガファイル便を開く
              </a>
              <a href={DISCUSSION_URL} target="_blank" rel="noopener noreferrer">
                GitHub Discussionsで提出する
              </a>
            </p>
            <div className="pg-grid">
              <Field label="ペンネーム（作者名）">
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.author}
                    value={form.author}
                    onChange={(event) => set({ author: event.target.value })}
                    autoComplete="nickname"
                  />
                )}
              </Field>
              <Field label="連絡先（メールアドレス）">
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.email}
                    type="email"
                    value={form.email}
                    onChange={(event) => set({ email: event.target.value })}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                )}
              </Field>
              <Field label="分類">
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.tag}
                    value={form.tag}
                    onChange={(event) => set({ tag: event.target.value })}
                    placeholder="短編, 謎解き"
                  />
                )}
              </Field>
              <Field label="難易度">
                {(id) => (
                  <select
                    id={id}
                    name={FORM_FIELDS.level}
                    value={form.level}
                    onChange={(event) => set({ level: event.target.value })}
                  >
                    {LEVELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label="シナリオ紹介（2〜300文字）">
              {(id) => (
                <textarea
                  id={id}
                  name={FORM_FIELDS.intro}
                  rows={5}
                  value={form.intro}
                  onChange={(event) => set({ intro: event.target.value })}
                />
              )}
            </Field>
            <Field label="作者より（80文字程度）">
              {(id) => (
                <textarea
                  id={id}
                  name={FORM_FIELDS.comment}
                  rows={3}
                  value={form.comment}
                  onChange={(event) => set({ comment: event.target.value })}
                />
              )}
            </Field>
            <div className="pg-grid">
              <Field
                label="ダウンロードURL（必須）"
                hint="HTTPSのギガファイル便URLを入力してください。ホスト名は管理者も確認します。"
              >
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.downloadUrl}
                    type="url"
                    value={form.downloadUrl}
                    onChange={(event) => set({ downloadUrl: event.target.value })}
                    placeholder="https://..."
                  />
                )}
              </Field>
              <Field label="保持期間（7日以上）">
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.retention}
                    value={form.retention}
                    onChange={(event) => set({ retention: event.target.value })}
                    placeholder="例：7日"
                  />
                )}
              </Field>
              <Field label="ダウンロードキー（任意）">
                {(id) => (
                  <input
                    id={id}
                    name={FORM_FIELDS.key}
                    type="password"
                    autoComplete="new-password"
                    value={form.key}
                    onChange={(event) => set({ key: event.target.value })}
                  />
                )}
              </Field>
            </div>
            {issues.length > 0 && (
              <ul className="pg-error" role="alert">
                {issues.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            {submittedNotice && (
              <p className="pg-message" role="status">
                {submittedNotice}
              </p>
            )}
            <div className="pg-dialog-actions">
              <button type="button" onClick={() => void copyDiscussionText()}>
                GitHub用の提出文をコピー
              </button>
              {copyNotice && (
                <span className="pg-hint" role="status">
                  {copyNotice}
                </span>
              )}
              <span className="pg-spacer" />
              <button type="button" onClick={onClose} disabled={creatingZip || sending}>
                閉じる
              </button>
              <button
                type="submit"
                className="pg-submit-button"
                disabled={sending || creatingZip || !!scenarioIdError}
              >
                {sending ? '送信しています…' : '提出情報を送信'}
              </button>
            </div>
            <p className="pg-hint">
              コピーする文面には作品名・ID・作者名・分類・難易度・紹介・作者よりが含まれます。メールアドレス、ダウンロードURL、保持期間、キーは公開投稿に含めないためコピーしません。
            </p>
            <p className="pg-hint">
              連絡先とダウンロードキーは管理者宛てのメールに含まれますが、この画面を閉じてもブラウザーには保存されません。送信結果はPHPサーバーからの応答で表示します。
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}
