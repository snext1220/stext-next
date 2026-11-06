import type { Scenario } from '@stext/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createScenarioArchive, findMissingResources, validateArchiveId } from './archive.js';
import { Field } from './fields.js';
import { HelpButton } from './help/HelpPanel.js';
import type { LocalResource } from './resources.js';
import {
  DISCUSSION_URL,
  FORM_HIDDEN_FIELDS,
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
      if (event.key === 'Escape' && !creatingZip) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creatingZip, onClose]);

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

  const validateSubmission = () => {
    const found = validatePost(form);
    if (scenarioIdError) found.unshift(scenarioIdError);
    setIssues(found);
    if (found.length > 0) {
      setSubmittedNotice(null);
      return false;
    }
    setSubmittedNotice(
      '別タブのオレンジフォームで内容を確認し、最終送信してください。この画面では受付・メール送信の完了を確認できません。別タブが開かない場合はブラウザーの設定を確認してください。',
    );
    return true;
  };

  return (
    <div className="pg-dialog-backdrop" onClick={() => !creatingZip && onClose()}>
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
          <button type="button" onClick={onClose} disabled={creatingZip}>
            閉じる
          </button>
        </header>
        <form
          className="pg-dialog-body pg-editor"
          action={SUBMISSION_ENDPOINT}
          method="post"
          target="_blank"
          rel="noopener noreferrer"
          acceptCharset="UTF-8"
          noValidate
          onSubmit={(event) => {
            if (creatingZip || !validateSubmission()) event.preventDefault();
          }}
        >
          {Object.entries({ ...FORM_HIDDEN_FIELDS, ...submissionValues(form) }).map(
            ([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ),
          )}
          <label className="pg-honeypot" aria-hidden="true">
            Website
            <input name="of_dummy_note" tabIndex={-1} autoComplete="off" />
          </label>
          <p className="pg-hint">
            1. ZIPをダウンロードし、ギガファイル便にアップロードします。 2.
            ダウンロードURLと投稿情報をオレンジフォームの確認画面へ送ります。別タブで最終送信すると、管理者への通知と連絡先への確認メールが送られます。受付後、管理者が内容を確認してから公開します。
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
                    value={form.retention}
                    onChange={(event) => set({ retention: event.target.value })}
                    inputMode="numeric"
                    placeholder="例：7"
                  />
                )}
              </Field>
              <Field label="ダウンロードキー（任意）">
                {(id) => (
                  <input
                    id={id}
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
              <button type="button" onClick={onClose} disabled={creatingZip}>
                閉じる
              </button>
              <button
                type="submit"
                className="pg-submit-button"
                disabled={creatingZip || !!scenarioIdError}
              >
                オレンジフォームで確認
              </button>
            </div>
            <p className="pg-hint">
              コピーする文面には作品名・ID・作者名・分類・難易度・紹介・作者よりが含まれます。メールアドレス、ダウンロードURL、保持期間、キーは公開投稿に含めないためコピーしません。
            </p>
            <p className="pg-hint">
              連絡先とダウンロード情報はオレンジフォームへ送られます。この画面の入力内容はブラウザーに永続保存しません。受付結果は別タブで確認し、確認メールが届かない場合は迷惑メールフォルダーも確認してください。
            </p>
            <p className="pg-hint">
              Powered by{' '}
              <a href="https://orange-cloud7.net/form/" target="_blank" rel="noopener noreferrer">
                メールフォーム 『オレンジフォーム』
              </a>
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}
