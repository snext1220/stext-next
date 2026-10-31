/** 共通の画像・BGM・効果音の配信元（末尾は /）。既定はビルド結果の assets/（common/ 以下に旧リポジトリの stext/common/ と同じ構成で置く） */
export const ASSET_BASE = import.meta.env.VITE_ASSET_BASE ?? `${import.meta.env.BASE_URL}assets/`;

/** シナリオの配信元（末尾は /）。<id>/ に scenario.json と、そのシナリオの挿絵（capture/）・BGM（bgm/）を置く */
export const SCENARIO_BASE =
  import.meta.env.VITE_SCENARIO_BASE ?? `${import.meta.env.BASE_URL}scenarios/`;

/** シナリオ内の画像（シナリオのフォルダーの capture/ 以下） */
export function imageUrl(scenarioId: string, src: string): string {
  if (/^(https?:|data:|\/)/.test(src)) return src;
  return `${SCENARIO_BASE}${scenarioId}/capture/${src}`;
}

/** BGM（@ で始まれば共通の曲、それ以外はシナリオ独自の曲） */
export function bgmUrl(scenarioId: string, name: string): string {
  return name.startsWith('@')
    ? `${ASSET_BASE}common/bgm/${name.slice(1)}.mp3`
    : `${SCENARIO_BASE}${scenarioId}/bgm/${name}.mp3`;
}

/** 効果音（common なら共通の効果音） */
export function seUrl(scenarioId: string, name: string, common = false): string {
  return common
    ? `${ASSET_BASE}common/se/${name}.mp3`
    : `${SCENARIO_BASE}${scenarioId}/bgm/se/${name}.mp3`;
}
