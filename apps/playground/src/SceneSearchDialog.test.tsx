// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Scenario } from '@stext/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneSearchDialog } from './SceneSearchDialog.js';

afterEach(cleanup);

const scenario = {
  format: 'stext/2',
  meta: { title: '検索テスト', author: '' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [
    {
      id: '10',
      summary: '森の入口',
      text: '大きな木の下で休む。',
      choices: [{ label: '先へ進む', to: ['20'] }],
    },
    {
      id: '20',
      summary: '洞窟',
      text: '暗い道を進む。',
      choices: [{ kind: 'answer', answer: 'Open the door', to: '10', else: '20' }],
    },
  ],
} satisfies Scenario;

describe('SceneSearchDialog', () => {
  it('searches and selects a scene, and reports empty results', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<SceneSearchDialog scenario={scenario} onSelect={onSelect} onClose={onClose} />);

    const input = screen.getByRole('searchbox', { name: 'サマリー・本文・選択肢を検索' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'OPEN' } });

    const result = screen.getByRole('button', { name: '§20：洞窟' });
    expect(result.textContent).toContain('選択肢');
    expect(result.textContent).toContain('Open the door');
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith('20');

    fireEvent.change(input, { target: { value: '一致しない' } });
    expect(screen.getByText('該当するシーンはありません。')).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SceneSearchDialog scenario={scenario} onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
