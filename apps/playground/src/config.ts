/** 共通の画像・BGM・効果音の配信元。公開サイトでは Playground（/playground/）の隣の assets/ */
export const ASSET_BASE =
  import.meta.env.VITE_ASSET_BASE ?? new URL('../assets/', location.href.split('#')[0]).href;

/** 公開シナリオの配信元（<id>/ に scenario.json と挿絵・BGM） */
export const SCENARIO_BASE =
  import.meta.env.VITE_SCENARIO_BASE ?? new URL('../scenarios/', location.href.split('#')[0]).href;

/** テンプレート（public/templates/） */
export const TEMPLATE_BASE = `${import.meta.env.BASE_URL}templates/`;

/** 試遊でシナリオの画像を表示するときのシナリオ ID（挿絵は scenarios/<ID>/capture/ から読む） */
export function imageUrl(scenarioId: string | undefined, src: string): string {
  if (/^(https?:|data:|\/)/.test(src) || !scenarioId) return src;
  return `${SCENARIO_BASE}${scenarioId}/capture/${src}`;
}

/** BGM（@ で始まれば共通の曲、それ以外はシナリオ独自の曲） */
export function bgmUrl(scenarioId: string, name: string): string {
  return name.startsWith('@')
    ? `${ASSET_BASE}common/bgm/${name.slice(1)}.mp3`
    : `${SCENARIO_BASE}${scenarioId}/bgm/${name}.mp3`;
}

/** キャラクターの顔画像（imageSet が custom ならシナリオの chara/、それ以外は共通の画像） */
export function charaImageUrl(
  scenarioId: string,
  imageSet: string | undefined,
  chara: { race: string; sex: string; age: string },
): string {
  const file = `${chara.sex}_${chara.age}_${chara.race}.png`.toLowerCase();
  return imageSet === 'custom'
    ? `${SCENARIO_BASE}${scenarioId}/chara/${file}`
    : `${ASSET_BASE}common/${file}`;
}

/** シナリオ固有の効果音 */
export function seUrl(scenarioId: string, name: string): string {
  return `${SCENARIO_BASE}${scenarioId}/bgm/se/${name}.mp3`;
}
