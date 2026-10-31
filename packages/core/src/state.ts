/**
 * ゲームの状態。
 *
 * 旧エンジンのセーブデータ（localStorage にシナリオ ID をキーとして保存していた save_data）と
 * 同じ形にしてあり、旧セーブデータをそのまま読み込める。
 */
import type { Scenario } from '@stext/schema';
import {
  AGES,
  FEMALE_NAMES,
  JOBS,
  MALE_NAMES,
  PC_INIT,
  TITLES,
  type Age,
  type Race,
  type Sex,
} from './data.js';
import { pick, randomInt, type RandomSource } from './random.js';

export interface Character {
  name: string;
  title: string;
  race: Race;
  sex: Sex;
  age: Age;
  job: string;
  /** 状態異常（poison / frozen / stone / curse / forget。なければ空文字） */
  state: string;
  /** 石化・忘却の経過シーン数 */
  stone_scene: number;
  forget_scene: number;
  poison_scene?: number;
  hp_m: number;
  hp: number;
  mp_m: number;
  mp: number;
  /** 能力値の初期値（_i）と現在値 */
  str_i: number;
  str: number;
  int_i: number;
  int: number;
  dex_i: number;
  dex: number;
  krm_i: number;
  krm: number;
  free1: number;
  free2: number;
  free3: number;
}

/** シナリオごとのセーブデータ */
export interface GameState {
  chara: Character;
  /** 月・火星・水星・木星・金星・土星・太陽の欠片の数 */
  stars: number[];
  items: string[];
  flags: string[];
  params: Record<string, string | number>;
  /** 冒険メモ（自由入力） */
  memos: string;
  /** 現在のシーン ID */
  scene: string | number;
  /** 経過シーン数（旧エンジンの綴りのまま） */
  ellapsed_scene: number;
  /** 再生中の BGM（メインテーマは空文字） */
  bgm: string;
  /** 適用中のボーナスアイテム（gi01 など） */
  bonus?: string;
  isEnded: boolean;
}

/** シナリオをまたいで共有するセーブデータ（旧エンジンのキー sorcerian_text） */
export interface GlobalState {
  /** 所有しているボーナスアイテム */
  items: string[];
  /** シナリオ ID ごとの獲得済み実績 */
  results: Record<string, string[]>;
  bgm: boolean;
  panel: boolean;
}

/** 旧エンジンが使っていたストレージのキー */
export const GLOBAL_SAVE_KEY = 'sorcerian_text';

export function emptyGlobalState(): GlobalState {
  return { items: [], results: {}, bgm: true, panel: true };
}

/** 能力値の初期値を 0〜10 に丸める（旧エンジン minMaxGuard） */
function minMaxGuard(n: number) {
  return Math.min(10, Math.max(0, n));
}

export interface NewCharacterOptions {
  constraint?: Scenario['meta']['constraint'];
  /** 前回のセーブデータのメモを引き継ぐ */
  memos?: string;
  /** 所有しているボーナスアイテムから一つ選んで適用する */
  bonusItems?: readonly string[];
}

/** 新しいキャラクターでセーブデータを作る（旧エンジン initSavedata） */
export function newGameState(random: RandomSource, options: NewCharacterOptions = {}): GameState {
  const c = options.constraint ?? {};
  const base = pick(
    random,
    PC_INIT.filter(([race]) => !c.race || c.race.includes(race)).filter(
      ([, sex]) => !c.sex || c.sex === sex,
    ),
  );
  if (!base) throw new Error('キャラクターの制約に合う種族・性別がありません');
  const [race, sex, hp0, mp0, str0, int0, dex0, krm0] = base;
  const hp_m = randomInt(random, hp0, hp0 + 10);
  const mp_m = randomInt(random, mp0, mp0 + 10);
  const str_i = minMaxGuard(randomInt(random, str0, str0 + 2));
  const int_i = minMaxGuard(randomInt(random, int0, int0 + 2));
  const dex_i = minMaxGuard(randomInt(random, dex0, dex0 + 2));
  const krm_i = minMaxGuard(randomInt(random, krm0, krm0 + 2));
  const name = pick(random, sex === 'MALE' ? MALE_NAMES : FEMALE_NAMES)!;
  const title = pick(random, TITLES)!;
  const age = pick(
    random,
    AGES.filter((a) => !c.age || c.age.includes(a)),
  )!;
  const state: GameState = {
    chara: {
      name,
      title,
      race,
      sex,
      age,
      job: '',
      state: '',
      stone_scene: 0,
      forget_scene: 0,
      hp_m,
      hp: hp_m,
      mp_m,
      mp: mp_m,
      str_i,
      str: str_i,
      int_i,
      int: int_i,
      dex_i,
      dex: dex_i,
      krm_i,
      krm: krm_i,
      free1: 0,
      free2: 0,
      free3: 0,
    },
    stars: [0, 0, 0, 0, 0, 0, 0],
    items: [],
    flags: [],
    params: {},
    memos: options.memos ?? '',
    scene: 0,
    ellapsed_scene: 0,
    bgm: '',
    isEnded: false,
  };
  const bonus = pick(random, options.bonusItems ?? []);
  if (bonus !== undefined) state.bonus = bonus;
  state.chara.job = pick(random, availableJobs(race, sex, age)) ?? '';
  return state;
}

/** 種族・性別・年齢で就ける職業（旧エンジン initJobs） */
export function availableJobs(race: string, sex: string, age: string): string[] {
  return Object.entries(JOBS)
    .filter(
      ([, [r, s, a]]) =>
        r.includes(race.charAt(0)) && s.includes(sex.charAt(0)) && a.includes(age.charAt(0)),
    )
    .map(([name]) => name);
}

/** 旧エンジンのセーブデータ（JSON 文字列）を読み込む */
export function readLegacySave(json: string): GameState {
  const data = JSON.parse(json) as GameState;
  if (!data || typeof data !== 'object' || !data.chara || !Array.isArray(data.stars)) {
    throw new Error('セーブデータの形式が正しくありません');
  }
  data.items ??= [];
  data.flags ??= [];
  data.params ??= {};
  data.memos ??= '';
  data.bgm ??= '';
  data.ellapsed_scene ??= 0;
  data.isEnded ??= false;
  return data;
}

/** 旧エンジンのグローバルセーブデータを読み込む（足りない項目は既定値） */
export function readLegacyGlobal(json: string): GlobalState {
  return { ...emptyGlobalState(), ...(JSON.parse(json) as Partial<GlobalState>) };
}
