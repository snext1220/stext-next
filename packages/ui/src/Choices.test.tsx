// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceList } from './Choices.js';

afterEach(cleanup);

describe('ChoiceList', () => {
  it('numbers the normal choices and reports the chosen index', () => {
    const onChoose = vi.fn();
    const { getAllByRole, getByText } = render(
      <ChoiceList
        onChoose={onChoose}
        choices={[
          { index: 0, kind: 'go', label: '踏んでみる', footer: false },
          { index: 2, kind: 'go', label: '**投げる**', before: '石がある。', footer: false },
          { index: 3, kind: 'jump', label: '', footer: false },
        ]}
      />,
    );
    const buttons = getAllByRole('button').filter((b) => b.classList.contains('choice'));
    expect(buttons.map((b) => b.dataset['key'])).toEqual(['1', '2']);
    expect(getByText('石がある。')).toBeTruthy();
    fireEvent.click(buttons[1]!);
    expect(onChoose).toHaveBeenCalledWith(2);
  });

  it('submits number input for jump choices', () => {
    const onChoose = vi.fn();
    const { getByLabelText, getByRole } = render(
      <ChoiceList
        onChoose={onChoose}
        choices={[{ index: 5, kind: 'jump', label: '', footer: false }]}
      />,
    );
    fireEvent.change(getByLabelText('移動する番号'), { target: { value: ' 500 ' } });
    fireEvent.click(getByRole('button', { name: '移動する' }));
    expect(onChoose).toHaveBeenCalledWith(5, '500');
  });
});
