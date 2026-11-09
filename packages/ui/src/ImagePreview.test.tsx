// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePreview } from './ImagePreview.js';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('ImagePreview', () => {
  it('opens the source image and can reopen it after the zoom-out animation', () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole } = render(
      <ImagePreview src="/images/scene.png" alt="森の風景" />,
    );

    const trigger = getByRole('button', { name: '森の風景を拡大表示' });
    fireEvent.click(trigger);

    let dialog = getByRole('dialog', { name: '森の風景（拡大表示）' });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/images/scene.png');

    fireEvent.click(getByRole('button', { name: '画像を閉じる' }));
    expect(dialog.hasAttribute('data-closing')).toBe(true);
    act(() => vi.advanceTimersByTime(250));

    expect(queryByRole('dialog')).toBeNull();

    fireEvent.click(trigger);
    dialog = getByRole('dialog', { name: '森の風景（拡大表示）' });
    expect(dialog.hasAttribute('data-closing')).toBe(false);
  });
});
