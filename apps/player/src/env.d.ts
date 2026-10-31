/// <reference types="vite/client" />

/** 画像・BGM の配信元の既定値（vite.config.ts で決める） */
declare const __DEFAULT_ASSET_BASE__: string;

interface ImportMetaEnv {
  /** 画像・BGM の配信元（旧リポジトリの stext/ ディレクトリに当たる URL） */
  readonly VITE_ASSET_BASE?: string;
  /** シナリオ JSON（scenarios/）の配信元 */
  readonly VITE_SCENARIO_BASE?: string;
}
