// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog, WorkDialog } from './WorkspaceMenus.js';
import type { LocalFileSync } from './localFileSync.js';

afterEach(cleanup);

describe('WorkDialog', () => {
  const props = () => ({
    templates: [{ id: 'template-1', name: 'テンプレート例', scenes: 3 }],
    published: [{ id: 'scenario-1', title: '公開作品例' }],
    onNew: vi.fn(),
    onOpenTemplate: vi.fn(),
    onOpenPublished: vi.fn(),
    onOpenFile: vi.fn(),
    onPickFile: vi.fn(),
    onOpenSavedProjects: vi.fn(),
    onClose: vi.fn(),
  });

  it('opens the selected template and published scenario', () => {
    const callbacks = props();
    render(<WorkDialog {...callbacks} />);

    fireEvent.change(screen.getByLabelText('テンプレート'), {
      target: { value: 'template-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを開く' }));
    fireEvent.change(screen.getByLabelText('公開シナリオ'), {
      target: { value: 'scenario-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '公開シナリオを開く' }));

    expect(callbacks.onOpenTemplate).toHaveBeenCalledWith('template-1');
    expect(callbacks.onOpenPublished).toHaveBeenCalledWith('scenario-1');
  });

  it('uses the saved-project list and no longer offers named storage', () => {
    const callbacks = props();
    render(<WorkDialog {...callbacks} />);

    expect(screen.queryByText(/マイストレージ/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '作品一覧を開く' }));
    expect(callbacks.onOpenSavedProjects).toHaveBeenCalledOnce();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape and outside click, but not when clicking inside', () => {
    const callbacks = props();
    const { container } = render(<WorkDialog {...callbacks} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(callbacks.onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.pg-dialog-backdrop')!);
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(callbacks.onClose).toHaveBeenCalledTimes(2);
  });

  it('uses the handle picker only in supported environments and blocks closing during reading', () => {
    const callbacks = props();
    const { rerender, container } = render(<WorkDialog {...callbacks} autoLink />);
    expect(screen.getByText(/stext\/2 JSONは保存先としても連携/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ファイルを選択…' }));
    expect(callbacks.onPickFile).toHaveBeenCalledOnce();
    rerender(<WorkDialog {...callbacks} autoLink busy />);
    expect(container.querySelector('.pg-work-options')?.hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.querySelector('.pg-dialog-backdrop')!);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    rerender(<WorkDialog {...callbacks} />);
    const file = new File(['{}'], 'scenario.json');
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    expect(callbacks.onOpenFile).toHaveBeenCalledWith(file);
    expect(callbacks.onPickFile).toHaveBeenCalledOnce();
  });
});

describe('ExportDialog', () => {
  const localFile = (): LocalFileSync => ({
    supported: false,
    link: undefined,
    busy: false,
    feedback: null,
    choose: vi.fn(),
    reflect: vi.fn(),
    forget: vi.fn(),
    forgetCurrent: vi.fn(),
    attach: vi.fn(),
  });

  it('presents ZIP as the primary export and invokes the selected export', () => {
    const onExportZip = vi.fn();
    const onExportJson = vi.fn();
    render(
      <ExportDialog
        onExportZip={onExportZip}
        onExportJson={onExportJson}
        onClose={vi.fn()}
        localFile={localFile()}
      />,
    );

    expect(screen.getByRole('button', { name: '作品一式をZIPでダウンロード' }).className).toContain(
      'pg-export-primary',
    );
    fireEvent.click(screen.getByRole('button', { name: 'シナリオだけをJSONでダウンロード' }));
    expect(onExportJson).toHaveBeenCalledOnce();
    expect(onExportZip).not.toHaveBeenCalled();
  });

  it('explains unsupported environments without showing unusable file controls', () => {
    render(
      <ExportDialog
        onExportZip={vi.fn()}
        onExportJson={vi.fn()}
        onClose={vi.fn()}
        localFile={localFile()}
      />,
    );
    expect(screen.getByText(/この環境では利用できません/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '保存先ファイルを選択…' })).toBeNull();
    expect(screen.getByRole('button', { name: 'シナリオだけをJSONでダウンロード' })).toBeTruthy();
  });

  it('selects a target without closing, then offers reflection, replacement and unlinking', () => {
    const file = { ...localFile(), supported: true };
    const onClose = vi.fn();
    const props = { onClose, onExportZip: vi.fn(), onExportJson: vi.fn() };
    const view = render(<ExportDialog {...props} localFile={file} />);
    fireEvent.click(screen.getByRole('button', { name: '保存先ファイルを選択…' }));
    expect(file.choose).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    view.rerender(
      <ExportDialog
        {...props}
        localFile={{
          ...file,
          link: {
            handle: {
              name: 'scenario.json',
              getFile: vi.fn(),
              requestPermission: vi.fn(),
              createWritable: vi.fn(),
            },
            scenarioId: 'gods',
            baseline: '',
            reflectedAt: '2026-11-11T10:00:00Z',
          },
        }}
      />,
    );
    expect(screen.getByText('保存先：scenario.json（ID: gods）')).toBeTruthy();
    expect(document.querySelector('time')?.dateTime).toBe('2026-11-11T10:00:00Z');
    fireEvent.click(screen.getByRole('button', { name: 'ローカルへ反映' }));
    fireEvent.click(screen.getByRole('button', { name: '保存先を変更…' }));
    fireEvent.click(screen.getByRole('button', { name: '連携を解除' }));
    expect(file.reflect).toHaveBeenCalledOnce();
    expect(file.choose).toHaveBeenCalledTimes(2);
    expect(file.forgetCurrent).toHaveBeenCalledOnce();
  });

  it('blocks closing and conflicting operations while busy and exposes errors persistently', () => {
    const onClose = vi.fn();
    const file = { ...localFile(), supported: true, busy: true };
    const { container, rerender } = render(
      <ExportDialog
        onExportZip={vi.fn()}
        onExportJson={vi.fn()}
        onClose={onClose}
        localFile={file}
      />,
    );
    for (const button of screen.getAllByRole<HTMLButtonElement>('button'))
      expect(button.disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.querySelector('.pg-dialog-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('操作開始時点');
    rerender(
      <ExportDialog
        onExportZip={vi.fn()}
        onExportJson={vi.fn()}
        onClose={onClose}
        localFile={{
          ...file,
          busy: false,
          feedback: { projectId: 'project', error: true, text: '外部で変更されています' },
        }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('外部で変更されています');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
