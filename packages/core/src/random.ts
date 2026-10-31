/**
 * 乱数。エンジンは乱数源（0 以上 1 未満を返す関数）を受け取り、旧エンジンと同じ式で使う。
 */
export type RandomSource = () => number;

/** min 以上 max 以下の整数（旧エンジン Util.random） */
export function randomInt(random: RandomSource, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** 配列から一つ選ぶ（旧エンジン Util.randomArray）。空なら undefined */
export function pick<T>(random: RandomSource, items: readonly T[]): T | undefined {
  return items[Math.floor(random() * items.length)];
}

/** 重みに従って一つの番号を選ぶ（旧エンジン Util.processByWeight）。どれにも当たらなければ -1 */
export function pickByWeight(random: RandomSource, weights: readonly number[]): number {
  const r = random();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i]!;
    if (r < sum) return i;
  }
  return -1;
}

/** 乱数の種を指定できる乱数源（テストやリプレイ用。mulberry32） */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
