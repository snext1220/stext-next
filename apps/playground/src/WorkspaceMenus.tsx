import { useEffect, useRef, useState } from 'react';
import type { LocalFileSync } from './localFileSync.js';

export interface WorkMenuTemplate {
  id: string;
  name: string;
  scenes: number;
}

export interface WorkMenuScenario {
  id: string;
  title: string;
}

export function WorkDialog({
  templates,
  published,
  onNew,
  onOpenTemplate,
  onOpenPublished,
  onOpenFile,
  onOpenSavedProjects,
  onClose,
  busy = false,
  autoLink = false,
  onPickFile,
}: {
  templates: readonly WorkMenuTemplate[];
  published: readonly WorkMenuScenario[];
  onNew: () => void;
  onOpenTemplate: (id: string) => void;
  onOpenPublished: (id: string) => void;
  onOpenFile: (file: File) => void;
  onOpenSavedProjects: () => void;
  onClose: () => void;
  busy?: boolean;
  autoLink?: boolean;
  onPickFile: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState('');
  const [scenarioId, setScenarioId] = useState('');

  useEffect(() => {
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, busy]);

  return (
    <div className="pg-dialog-backdrop" onClick={() => !busy && onClose()}>
      <section
        ref={dialog}
        className="pg-dialog pg-work-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-work-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-work-title">作品</h2>
          <span className="pg-spacer" />
          <button type="button" disabled={busy} onClick={onClose}>
            閉じる
          </button>
        </header>
        {busy && <p role="status">ファイルを読み込んでいます…</p>}
        <div className="pg-dialog-body pg-work-options" inert={busy}>
          <section>
            <h3>新しく作る</h3>
            <button type="button" onClick={onNew}>
              新しいシナリオ
            </button>
            <label>
              <span>テンプレート</span>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">テンプレートを選択…</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}（{template.scenes} シーン）
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!templateId}
              onClick={() => templateId && onOpenTemplate(templateId)}
            >
              テンプレートを開く
            </button>
            <label>
              <span>公開シナリオ</span>
              <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                <option value="">公開シナリオを選択…</option>
                {published.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!scenarioId}
              onClick={() => scenarioId && onOpenPublished(scenarioId)}
            >
              公開シナリオを開く
            </button>
          </section>

          <section>
            <h3>ファイルから読み込む</h3>
            <p className="pg-hint">stext/2 JSON、旧 scenario.xml、旧 Playground JSONを開けます。</p>
            {autoLink && (
              <p className="pg-hint">
                IDを設定したstext/2 JSONは保存先としても連携します。
                書き込みは［エクスポート…］の［ローカルへ反映］で行います。
                旧形式は読み込みのみです。
              </p>
            )}
            <button
              type="button"
              onClick={() => (autoLink ? onPickFile() : fileInput.current?.click())}
            >
              ファイルを選択…
            </button>
            <input
              ref={fileInput}
              id="work-open-file"
              type="file"
              accept=".json,.xml"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                onOpenFile(file);
                event.currentTarget.value = '';
              }}
            />
          </section>

          <section>
            <h3>保存済みの作品</h3>
            <p className="pg-hint">
              編集内容はこのブラウザーに自動保存されます。作品一覧から保存済みの作品に切り替えられます。
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSavedProjects();
              }}
            >
              作品一覧を開く
            </button>
          </section>
        </div>
      </section>
    </div>
  );
}

export function ExportDialog({
  onExportZip,
  onExportJson,
  onClose,
  zipDisabled = false,
  localFile,
}: {
  onExportZip: () => void;
  onExportJson: () => void;
  onClose: () => void;
  zipDisabled?: boolean;
  localFile: LocalFileSync;
}) {
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !localFile.busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, localFile.busy]);

  return (
    <div className="pg-dialog-backdrop" onClick={() => !localFile.busy && onClose()}>
      <section
        ref={dialog}
        className="pg-dialog pg-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-export-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-export-title">エクスポート</h2>
          <span className="pg-spacer" />
          <button type="button" disabled={localFile.busy} onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-dialog-body pg-export-options">
          <button
            type="button"
            className="pg-export-primary"
            disabled={zipDisabled || localFile.busy}
            onClick={() => {
              onClose();
              onExportZip();
            }}
          >
            作品一式をZIPでダウンロード
          </button>
          <p className="pg-hint">
            シナリオと、この作品に登録した画像・音声をまとめます。通常はこちらを使ってください。
          </p>
          <button
            type="button"
            disabled={localFile.busy}
            onClick={() => {
              onClose();
              onExportJson();
            }}
          >
            シナリオだけをJSONでダウンロード
          </button>
          <p className="pg-hint">素材ファイルは含みません。JSONを確認・編集する場合に使います。</p>
          <section aria-labelledby="pg-local-file-title" aria-busy={localFile.busy}>
            <h3 id="pg-local-file-title">ローカルファイル連携</h3>
            <p className="pg-hint">
              手元のリポジトリへシナリオJSONだけを反映できます。素材は含みません。
              ファイルの選択だけでは書き込みません。
            </p>
            {localFile.supported ? (
              <>
                {localFile.link ? (
                  <>
                    <p className="pg-local-file-target">
                      保存先：{localFile.link.handle.name}（ID: {localFile.link.scenarioId}）
                    </p>
                    {localFile.link.reflectedAt && (
                      <p>
                        最終反映：
                        <time dateTime={localFile.link.reflectedAt}>
                          {new Date(localFile.link.reflectedAt).toLocaleString('ja-JP')}
                        </time>
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={localFile.busy || zipDisabled}
                      onClick={() => void localFile.reflect()}
                    >
                      ローカルへ反映
                    </button>
                    <div className="pg-local-file-actions">
                      <button
                        type="button"
                        disabled={localFile.busy || zipDisabled}
                        onClick={() => void localFile.choose()}
                      >
                        保存先を変更…
                      </button>
                      <button
                        type="button"
                        disabled={localFile.busy}
                        onClick={() => localFile.forgetCurrent()}
                      >
                        連携を解除
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={localFile.busy || zipDisabled}
                    onClick={() => void localFile.choose()}
                  >
                    保存先ファイルを選択…
                  </button>
                )}
                <p className="pg-hint">
                  連携はこのタブの作品ごとに保持します。ページ再読み込み後は保存先を選び直してください。
                  反映中は同じファイルを他のアプリで保存しないでください。
                </p>
                <p className="pg-hint">
                  旧形式から変換した作品は、再変換で変更を失う可能性があります。 反映後はVS
                  Codeなどで差分を確認してください。公開サイトは自動更新されません。
                </p>
              </>
            ) : (
              <p className="pg-hint">
                この環境では利用できません。HTTPSまたはlocalhostで対応するChrome／Edgeを使うか、
                上のJSONダウンロードをご利用ください。
              </p>
            )}
            {localFile.busy && (
              <p role="status">連携処理中… 操作開始時点の編集内容を使用します。</p>
            )}
            {localFile.feedback && (
              <p role={localFile.feedback.error ? 'alert' : 'status'}>{localFile.feedback.text}</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
