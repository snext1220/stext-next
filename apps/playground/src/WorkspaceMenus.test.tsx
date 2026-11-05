// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog, WorkDialog } from './WorkspaceMenus.js';

afterEach(cleanup);

describe('WorkDialog', () => {
  const props = () => ({
    templates: [{ id: 'template-1', name: 'テンプレート例', scenes: 3 }],
    published: [{ id: 'scenario-1', title: '公開作品例' }],
    onNew: vi.fn(),
    onOpenTemplate: vi.fn(),
    onOpenPublished: vi.fn(),
    onOpenFile: vi.fn(),
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
});

describe('ExportDialog', () => {
  it('presents ZIP as the primary export and invokes the selected export', () => {
    const onExportZip = vi.fn();
    const onExportJson = vi.fn();
    render(
      <ExportDialog onExportZip={onExportZip} onExportJson={onExportJson} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '作品一式をZIPでダウンロード' }).className).toContain(
      'pg-export-primary',
    );
    fireEvent.click(screen.getByRole('button', { name: 'シナリオだけをJSONでダウンロード' }));
    expect(onExportJson).toHaveBeenCalledOnce();
    expect(onExportZip).not.toHaveBeenCalled();
  });
});
