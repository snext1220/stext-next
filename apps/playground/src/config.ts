/** 共通の画像・BGM・効果音の配信元。公開サイトでは Playground（/playground/）の隣の assets/ */
export const ASSET_BASE =
  import.meta.env.VITE_ASSET_BASE ?? new URL('../assets/', location.href.split('#')[0]).href;

/** 公開シナリオの配信元（<id>/ に scenario.json と挿絵・BGM） */
export const SCENARIO_BASE =
  import.meta.env.VITE_SCENARIO_BASE ?? new URL('../scenarios/', location.href.split('#')[0]).href;

/** シナリオの投稿先（旧 Playground Flow と同じ upload.php） */
export const POST_URL =
  import.meta.env.VITE_POST_URL ?? 'https://www.web-deli.com/sorcerian/text/playground/upload.php';

/** テンプレート（public/templates/） */
export const TEMPLATE_BASE = `${import.meta.env.BASE_URL}templates/`;

/** 試遊でシナリオの画像を表示するときのシナリオ ID（挿絵は scenarios/<ID>/capture/ から読む） */
export function imageUrl(scenarioId: string | undefined, src: string): string {
  if (/^(https?:|data:|\/)/.test(src) || !scenarioId) return src;
  return `${SCENARIO_BASE}${scenarioId}/capture/${src}`;
}
