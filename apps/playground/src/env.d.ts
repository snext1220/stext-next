/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 画像・BGM・効果音の配信元（既定は公開サイトの ../assets/） */
  readonly VITE_ASSET_BASE?: string;
  /** 公開シナリオ（scenarios/）の配信元（既定は公開サイトの ../scenarios/） */
  readonly VITE_SCENARIO_BASE?: string;
  /** シナリオの投稿先（既定は旧 Playground Flow と同じ upload.php） */
  readonly VITE_POST_URL?: string;
}
