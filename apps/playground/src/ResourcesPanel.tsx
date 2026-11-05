import { useMemo, useState } from 'react';
import { collectResourceReferences, MAX_RESOURCE_SIZE, type LocalResource } from './resources.js';

const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp';
const AUDIO_ACCEPT = '.mp3,.ogg,.wav,.m4a,.aac';
const RESOURCE_FOLDERS = {
  'capture/': { label: '挿絵・画像（capture/）', accept: IMAGE_ACCEPT },
  'bgm/': { label: 'BGM（bgm/）', accept: AUDIO_ACCEPT },
  'bgm/se/': { label: '効果音（bgm/se/）', accept: AUDIO_ACCEPT },
  'chara/': { label: 'キャラクター画像（chara/）', accept: IMAGE_ACCEPT },
} as const;

function isResourceFolder(folder: string): folder is keyof typeof RESOURCE_FOLDERS {
  return Object.hasOwn(RESOURCE_FOLDERS, folder);
}

function bytes(size: number): string {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024).toLocaleString('ja-JP')}KB`
    : `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export function ResourcesPanel({
  scenario,
  resources,
  ready,
  error,
  onRegister,
  onDelete,
  urls,
}: {
  scenario: Parameters<typeof collectResourceReferences>[0];
  resources: LocalResource[];
  ready: boolean;
  error: string | null;
  onRegister: (path: string, file: File) => Promise<void>;
  onDelete: (path: string) => Promise<void>;
  urls: Readonly<Record<string, string>>;
}) {
  const [newFolder, setNewFolder] = useState<keyof typeof RESOURCE_FOLDERS>('capture/');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const references = useMemo(() => collectResourceReferences(scenario), [scenario]);
  const byPath = useMemo(
    () => new Map(resources.map((resource) => [resource.path, resource])),
    [resources],
  );
  const unreferenced = resources.filter(
    (resource) => !references.some((reference) => reference.path === resource.path),
  );

  const register = async (path: string, file: File | undefined) => {
    if (!file) return;
    if (byPath.has(path) && !window.confirm(`${path} に登録した素材を差し替えますか？`)) return;
    setBusyPath(path);
    setOperationError(null);
    try {
      await onRegister(path, file);
    } catch (reason) {
      setOperationError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyPath(null);
    }
  };

  const remove = async (path: string) => {
    if (!window.confirm(`${path} をこのブラウザーから削除しますか？`)) return;
    setBusyPath(path);
    setOperationError(null);
    try {
      await onDelete(path);
    } catch (reason) {
      setOperationError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyPath(null);
    }
  };

  const preview = (resource: LocalResource) => {
    const url = urls[resource.path];
    if (!url) return null;
    if (resource.path.startsWith('capture/') || resource.path.startsWith('chara/'))
      return <img className="pg-resource-image" src={url} alt={`${resource.path} のプレビュー`} />;
    if (resource.path.startsWith('bgm/')) return <audio controls preload="none" src={url} />;
    return null;
  };

  return (
    <div className="pg-resources pg-editor">
      <p className="pg-hint">
        登録した素材のコピーはこのブラウザーに保存され、試遊と作品のエクスポートに使われます。
        元のローカルファイルは変更されず、サーバーへも送信されません。
      </p>
      {!ready && <p role="status">登録済み素材を読み込んでいます…</p>}
      {(error || operationError) && (
        <p className="pg-error" role="alert">
          {operationError ?? error}
        </p>
      )}
      {busyPath && <p role="status">素材を保存しています: {busyPath}</p>}
      <section className="pg-section">
        <h3>シナリオから参照されている素材</h3>
        {references.length === 0 && <p className="pg-hint">素材の参照はありません。</p>}
        <ul className="pg-resource-list">
          {references.map((reference) => {
            const resource = byPath.get(reference.path);
            return (
              <li key={reference.path} className="pg-resource">
                <div className="pg-resource-info">
                  <strong>{reference.path}</strong>
                  <span>
                    {resource
                      ? `登録済み · ${resource.fileName}`
                      : '未登録（エクスポートに未収録）'}
                  </span>
                  {resource && (
                    <span>
                      {bytes(resource.blob.size)} · {resource.mimeType}
                    </span>
                  )}
                </div>
                {resource && preview(resource)}
                <label className="pg-button">
                  {resource ? '差し替え…' : '素材を指定…'}
                  <input
                    type="file"
                    accept={reference.kind === 'image' ? IMAGE_ACCEPT : AUDIO_ACCEPT}
                    hidden
                    disabled={!ready || busyPath === reference.path}
                    onChange={(event) => {
                      void register(reference.path, event.currentTarget.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {resource && (
                  <button
                    type="button"
                    disabled={busyPath === reference.path}
                    onClick={() => void remove(reference.path)}
                  >
                    削除
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="pg-section">
        <h3>素材を追加</h3>
        <p className="pg-hint">
          参照されていない素材も登録できます。登録先を選ぶと、選んだ種類に対応するファイルだけを選択できます。
          ファイル名は元の名前を使います（1ファイル {bytes(MAX_RESOURCE_SIZE)} 以下）。
        </p>
        <div className="pg-inline pg-resource-add">
          <label className="pg-field">
            <span className="pg-hint">素材の種類</span>
            <select
              value={newFolder}
              onChange={(event) => {
                if (isResourceFolder(event.currentTarget.value))
                  setNewFolder(event.currentTarget.value);
              }}
              disabled={!ready}
            >
              {Object.entries(RESOURCE_FOLDERS).map(([folder, { label }]) => (
                <option key={folder} value={folder}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="pg-button">
            ファイルを登録…
            <input
              type="file"
              accept={RESOURCE_FOLDERS[newFolder].accept}
              hidden
              disabled={!ready}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void register(`${newFolder}${file.name}`, file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </section>
      <section className="pg-section">
        <h3>登録済み素材（{resources.length}）</h3>
        {unreferenced.length === 0 && <p className="pg-hint">未参照の登録素材はありません。</p>}
        <ul className="pg-resource-list">
          {unreferenced.map((resource) => (
            <li key={resource.path} className="pg-resource">
              <div className="pg-resource-info">
                <strong>{resource.path}</strong>
                <span>
                  {resource.fileName} · {bytes(resource.blob.size)}
                </span>
              </div>
              {preview(resource)}
              <button
                type="button"
                disabled={busyPath === resource.path}
                onClick={() => void remove(resource.path)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
