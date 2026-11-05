import { useEffect, useRef, useState } from 'react';
import type { ProjectSummary } from './store.js';

export function ProjectDialog({
  projects,
  currentId,
  onOpen,
  onDelete,
  onClose,
}: {
  projects: ProjectSummary[];
  currentId: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const removeProject = async (project: ProjectSummary) => {
    if (
      !window.confirm(
        `「${project.title}」を削除しますか？この作品と、作品に登録した素材がこのブラウザーから削除されます。`,
      )
    )
      return;
    setDeletingId(project.id);
    setDeleteError(null);
    try {
      await onDelete(project.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pg-dialog-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="pg-dialog pg-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-project-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-project-title">保存済みの作品</h2>
          <span className="pg-spacer" />
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-dialog-body">
          {deleteError && (
            <p className="pg-project-error" role="alert">
              作品を削除できませんでした: {deleteError}
            </p>
          )}
          {projects.length === 0 ? (
            <p className="pg-hint">まだ作品はありません。</p>
          ) : (
            <ul className="pg-project-list">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className="pg-project-open"
                    disabled={project.id === currentId || deletingId !== null}
                    onClick={() => onOpen(project.id)}
                  >
                    <strong>{project.title}</strong>
                    <span>
                      {project.scenarioId ? `ID: ${project.scenarioId} · ` : ''}
                      {new Date(project.updatedAt).toLocaleString('ja-JP')}
                    </span>
                    {project.id === currentId && <small>編集中</small>}
                  </button>
                  <button
                    type="button"
                    className="pg-project-delete"
                    disabled={deletingId !== null}
                    onClick={() => void removeProject(project)}
                    aria-label={`「${project.title}」を削除`}
                  >
                    {deletingId === project.id ? '削除中…' : '削除'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
