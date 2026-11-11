// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector } from './audio.js';

let director: AudioDirector;
let tracks: HTMLAudioElement[];
let playResult: () => Promise<void>;

const blocked = () => new DOMException('User interaction required', 'NotAllowedError');
const flush = () => Promise.resolve();
const click = () => document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const keydown = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

beforeEach(() => {
  tracks = [];
  playResult = () => Promise.resolve();
  vi.stubGlobal(
    'Audio',
    class {
      constructor(url: string) {
        const element = document.createElement('audio');
        element.src = url;
        vi.spyOn(element, 'play').mockImplementation(playResult);
        vi.spyOn(element, 'pause').mockImplementation(() => {});
        tracks.push(element);
        return element;
      }
    },
  );
  director = new AudioDirector(true);
});

afterEach(() => {
  director.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function startBlocked(url = '/main.mp3') {
  playResult = () => Promise.reject(blocked());
  director.playBgm(url);
  const bgm = tracks.at(-1)!;
  vi.mocked(bgm.play).mockResolvedValue();
  playResult = () => Promise.resolve();
  return bgm;
}

describe('BGM autoplay recovery', () => {
  it.each([
    ['click / tap', click],
    ['keyboard', keydown],
  ])('retries the same BGM on the next %s without a scene change', async (_, interact) => {
    const bgm = startBlocked();
    await flush();

    interact();
    await flush();

    expect(bgm.play).toHaveBeenCalledTimes(2);
    expect(tracks).toHaveLength(1);
    expect(bgm.loop).toBe(true);
    expect(bgm.volume).toBe(0.2);
    click();
    keydown();
    expect(bgm.play).toHaveBeenCalledTimes(2);
  });

  it('does not retry after successful playback', async () => {
    director.playBgm('/main.mp3');
    await flush();
    click();
    keydown();
    expect(tracks[0]!.play).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting if an interaction is also rejected', async () => {
    const bgm = startBlocked();
    vi.mocked(bgm.play).mockRejectedValueOnce(blocked());
    await flush();
    click();
    await flush();
    keydown();
    await flush();
    expect(bgm.play).toHaveBeenCalledTimes(3);
    click();
    expect(bgm.play).toHaveBeenCalledTimes(3);
  });

  it.each(['mute', 'stop'] as const)('cancels a pending retry on %s', async (action) => {
    const bgm = startBlocked();
    await flush();

    if (action === 'mute') director.setEnabled(false);
    else director.stop();
    click();
    keydown();
    expect(bgm.play).toHaveBeenCalledTimes(1);
    expect(bgm.pause).toHaveBeenCalled();
  });

  it('stops only the BGM without requiring a replacement track', () => {
    director.playBgm('/main.mp3');
    const bgm = tracks[0]!;

    director.stopBgm();

    expect(bgm.pause).toHaveBeenCalled();
    expect(tracks).toHaveLength(1);
    director.playBgm('/main.mp3');
    expect(tracks).toHaveLength(2);
  });

  it('does not start muted music on interaction, but plays when enabled', () => {
    director.setEnabled(false);
    director.playBgm('/main.mp3');
    click();
    keydown();
    expect(tracks[0]!.play).not.toHaveBeenCalled();
    director.setEnabled(true);
    expect(tracks[0]!.play).toHaveBeenCalledTimes(1);
  });

  it('can recover when enabling sound is rejected', async () => {
    director.setEnabled(false);
    director.playBgm('/main.mp3');
    const bgm = tracks[0]!;
    vi.mocked(bgm.play).mockRejectedValueOnce(blocked());
    director.setEnabled(true);
    await flush();
    click();
    await flush();
    expect(bgm.play).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale rejection after the same track has already been retried', async () => {
    const bgm = startBlocked();
    director.playBgm('/main.mp3');
    await flush();
    click();
    keydown();
    expect(bgm.play).toHaveBeenCalledTimes(2);
  });

  it('does not restart an old track after changing music', async () => {
    const old = startBlocked('/old.mp3');
    await flush();
    director.playBgm('/new.mp3');
    await flush();
    click();
    expect(old.pause).toHaveBeenCalled();
    expect(old.play).toHaveBeenCalledTimes(1);
    expect(tracks[1]!.play).toHaveBeenCalledTimes(1);
  });

  it('retries only the latest track when both tracks are blocked', async () => {
    const old = startBlocked('/old.mp3');
    await flush();
    const current = startBlocked('/new.mp3');
    await flush();
    click();
    await flush();
    expect(old.play).toHaveBeenCalledTimes(1);
    expect(current.play).toHaveBeenCalledTimes(2);
  });

  it.each(['mute', 'stop', 'change'] as const)(
    'ignores a late rejection after %s',
    async (action) => {
      director.playBgm('/old.mp3');
      const old = tracks[0]!;
      let reject: (error: unknown) => void = () => {
        throw new Error('Playback has not started');
      };
      vi.mocked(old.play).mockImplementationOnce(
        () =>
          new Promise<void>((_, rejectPlay) => {
            reject = rejectPlay;
          }),
      );
      director.playBgm('/old.mp3');
      if (action === 'mute') director.setEnabled(false);
      else if (action === 'stop') director.stop();
      else director.playBgm('/new.mp3');

      reject(blocked());
      await flush();
      click();
      keydown();
      expect(old.play).toHaveBeenCalledTimes(2);
      if (action === 'change') expect(tracks[1]!.play).toHaveBeenCalledTimes(1);
    },
  );

  it('reports non-policy failures without retrying on every interaction', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    director.playBgm('/missing.mp3');
    const bgm = tracks[0]!;
    const error = new DOMException('Unsupported source', 'NotSupportedError');
    vi.mocked(bgm.play).mockRejectedValueOnce(error);
    director.playBgm('/missing.mp3');
    await flush();
    click();
    expect(report).toHaveBeenCalledWith('BGM を再生できませんでした', error);
    expect(bgm.play).toHaveBeenCalledTimes(2);
  });
});
