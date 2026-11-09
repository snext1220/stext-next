// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectDialog } from './ProjectDialog.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProjectDialog', () => {
  const projects = [
    {
      id: 'current',
      title: '編集中の作品',
      scenarioId: 'same-id',
      updatedAt: '2026-11-04T12:00:00.000Z',
    },
    {
      id: 'another',
      title: '別の作品',
      scenarioId: 'same-id',
      updatedAt: '2026-11-03T12:00:00.000Z',
    },
  ];

  it('distinguishes works that have the same public scenario ID', () => {
    const onOpen = vi.fn();
    render(
      <ProjectDialog
        projects={projects}
        currentId="current"
        onOpen={onOpen}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/ID: same-id/)).toHaveLength(2);
    expect(screen.getByText('編集中の作品').closest('button')?.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByText('別の作品').closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('another');
  });

  it('confirms before deleting a project, including the currently edited project', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDelete = vi.fn().mockResolvedValue(false);
    render(
      <ProjectDialog
        projects={projects}
        currentId="current"
        onOpen={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '「別の作品」を削除' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('another'));
    expect(window.confirm).toHaveBeenCalledWith(
      '「別の作品」を削除しますか？この作品と、作品に登録した素材がこのブラウザーから削除されます。',
    );

    fireEvent.click(screen.getByRole('button', { name: '「編集中の作品」を削除' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('current'));
  });

  it('shows deletion failures and closes on Escape', async () => {
    const onClose = vi.fn();
    const onDelete = vi.fn().mockRejectedValue(new Error('保存に失敗しました'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ProjectDialog
        projects={projects}
        currentId="current"
        onOpen={vi.fn()}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '「別の作品」を削除' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      '作品を削除できませんでした: 保存に失敗しました',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows unreadable records without hiding editable projects', () => {
    const error = '編集用のデータ構造を読み込めません。保存データは削除していません: scenes';
    const onOpen = vi.fn();
    render(
      <ProjectDialog
        projects={[
          ...projects,
          {
            id: 'broken',
            title: '読み込めない作品',
            scenarioId: undefined,
            updatedAt: '',
            loadError: error,
          },
        ]}
        currentId="current"
        onOpen={onOpen}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(error);
    fireEvent.click(screen.getByText('別の作品').closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('another');
  });
});
