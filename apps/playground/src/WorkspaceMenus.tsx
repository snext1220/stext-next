import { useEffect, useRef, useState } from 'react';

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
}: {
  templates: readonly WorkMenuTemplate[];
  published: readonly WorkMenuScenario[];
  onNew: () => void;
  onOpenTemplate: (id: string) => void;
  onOpenPublished: (id: string) => void;
  onOpenFile: (file: File) => void;
  onOpenSavedProjects: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState('');
  const [scenarioId, setScenarioId] = useState('');

  useEffect(() => {
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="pg-dialog-backdrop" onClick={onClose}>
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
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-dialog-body pg-work-options">
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
            <button type="button" onClick={() => fileInput.current?.click()}>
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
                onClose();
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
}: {
  onExportZip: () => void;
  onExportJson: () => void;
  onClose: () => void;
  zipDisabled?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="pg-dialog-backdrop" onClick={onClose}>
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
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-dialog-body pg-export-options">
          <button
            type="button"
            className="pg-export-primary"
            disabled={zipDisabled}
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
            onClick={() => {
              onClose();
              onExportJson();
            }}
          >
            シナリオだけをJSONでダウンロード
          </button>
          <p className="pg-hint">素材ファイルは含みません。JSONを確認・編集する場合に使います。</p>
        </div>
      </section>
    </div>
  );
}
