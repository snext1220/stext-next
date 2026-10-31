/**
 * BGM と効果音。ブラウザは操作の前に音を出せないため、再生に失敗しても無視する。
 */
export class AudioDirector {
  private bgm: HTMLAudioElement | undefined;
  private current = '';
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  playBgm(url: string) {
    if (url === this.current && this.bgm) {
      if (this.enabled && this.bgm.paused) void this.bgm.play().catch(() => {});
      return;
    }
    this.bgm?.pause();
    this.current = url;
    this.bgm = new Audio(url);
    this.bgm.loop = true;
    this.bgm.volume = 0.2;
    if (this.enabled) void this.bgm.play().catch(() => {});
  }

  playSe(url: string) {
    if (!this.enabled) return;
    const a = new Audio(url);
    a.volume = 0.9;
    void a.play().catch(() => {});
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.bgm) return;
    if (enabled) void this.bgm.play().catch(() => {});
    else this.bgm.pause();
  }

  stop() {
    this.bgm?.pause();
    this.bgm = undefined;
    this.current = '';
  }
}
