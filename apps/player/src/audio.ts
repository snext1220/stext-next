/**
 * BGM と効果音。自動再生を拒否された BGM は、次の操作で再試行する。
 */
export class AudioDirector {
  private bgm: HTMLAudioElement | undefined;
  private current = '';
  private attempt = 0;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  playBgm(url: string) {
    if (url === this.current && this.bgm) {
      if (this.enabled && this.bgm.paused) this.startBgm(this.bgm);
      return;
    }
    this.clearRetry();
    this.bgm?.pause();
    this.current = url;
    this.bgm = new Audio(url);
    this.bgm.loop = true;
    this.bgm.volume = 0.2;
    if (this.enabled) this.startBgm(this.bgm);
  }

  private clearRetry() {
    this.attempt++;
    document.removeEventListener('click', this.retryBgm);
    document.removeEventListener('keydown', this.retryBgm);
  }

  private retryBgm = () => {
    if (this.enabled && this.bgm) this.startBgm(this.bgm);
  };

  private startBgm(bgm: HTMLAudioElement) {
    this.clearRetry();
    const attempt = this.attempt;
    void bgm.play().catch((error: unknown) => {
      // 曲変更や停止より前の再生要求は、復帰待ちに戻さない。
      if (attempt !== this.attempt || bgm !== this.bgm || !this.enabled) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        document.addEventListener('click', this.retryBgm);
        document.addEventListener('keydown', this.retryBgm);
      } else {
        console.error('BGM を再生できませんでした', error);
      }
    });
  }

  playSe(url: string) {
    if (!this.enabled) return;
    const a = new Audio(url);
    a.volume = 0.9;
    void a.play().catch(() => {});
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.clearRetry();
    if (!this.bgm) return;
    if (enabled) this.startBgm(this.bgm);
    else this.bgm.pause();
  }

  stop() {
    this.clearRetry();
    this.bgm?.pause();
    this.bgm = undefined;
    this.current = '';
  }
}
