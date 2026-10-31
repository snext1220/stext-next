/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 画像・BGM の配信元（旧リポジトリの stext/ ディレクトリに当たる URL） */
  readonly VITE_ASSET_BASE?: string;
  /** シナリオ JSON（scenarios/）の配信元 */
  readonly VITE_SCENARIO_BASE?: string;
  /** Playground の URL（既定はプレイヤーの隣の playground/） */
  readonly VITE_PLAYGROUND_URL?: string;
}
