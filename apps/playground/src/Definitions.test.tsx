// @vitest-environment jsdom
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Definitions } from './Definitions.js';

afterEach(cleanup);

const scenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'settings', title: '設定' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [],
};

describe('Definitions settings', () => {
  it('edits summary display, character image set, and status labels', () => {
    const onChange = vi.fn();
    render(<Definitions scenario={scenario} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /シーン番号の代わりに表示/ }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ showSummary: true }) }),
      'meta.showSummary',
    );

    fireEvent.change(screen.getByLabelText('キャラクター画像'), {
      target: { value: 'custom' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ imageSet: 'custom' }) }),
      'meta.imageSet',
    );

    fireEvent.change(screen.getByLabelText('HP の表示名'), { target: { value: '体力' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ labels: { hp: '体力' } }) }),
      'meta.labels.hp',
    );

    expect(screen.getByLabelText('状態異常 の表示名')).toBeTruthy();
    expect(screen.getByLabelText('KRM の表示名')).toBeTruthy();
  });
});
