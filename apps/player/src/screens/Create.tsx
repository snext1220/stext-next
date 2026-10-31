import {
  AGES,
  RACES,
  SEXES,
  availableJobs,
  createEngine,
  type GameState,
  type GlobalState,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import { Parchment, RaceSigil } from '@stext/ui';
import { useMemo, useState } from 'react';
import { loadGame } from '../storage.js';

const RACE_JA: Record<string, string> = {
  FIGHTER: 'ファイター',
  WIZARD: 'ウィザード',
  DWARF: 'ドワーフ',
  ELF: 'エルフ',
};
const SEX_JA: Record<string, string> = { MALE: '男性', FEMALE: '女性' };
const AGE_JA: Record<string, string> = { YOUNG: '若年', ADULT: '壮年', OLD: '老年' };
const AGE_WORD: Record<string, string> = { YOUNG: '若き', ADULT: '壮年の', OLD: '老いた' };

export function Create({
  id,
  scenario,
  global,
  onStart,
}: {
  id: string;
  scenario: Scenario;
  global: GlobalState;
  onStart: (character: GameState) => void;
}) {
  const engine = useMemo(() => createEngine(scenario, { scenarioId: id }), [scenario, id]);
  const c = scenario.meta.constraint ?? {};
  const races = RACES.filter((r) => !c.race || c.race.includes(r));
  const sexes = SEXES.filter((s) => !c.sex || c.sex === s);
  const ages = AGES.filter((a) => !c.age || c.age.includes(a));
  const previous = loadGame(id);
  const memos = previous?.memos;

  const roll = (pickRace?: string, pickSex?: string, pickAge?: string) =>
    engine.newCharacter(global, {
      constraint: {
        race: (pickRace ? [pickRace] : races) as never,
        age: (pickAge ? [pickAge] : ages) as never,
        ...(pickSex ? { sex: pickSex as never } : c.sex ? { sex: c.sex } : {}),
      },
      ...(memos !== undefined ? { memos } : {}),
    });

  const [draft, setDraft] = useState<GameState>(() => roll());
  const ch = draft.chara;
  const jobs = availableJobs(ch.race, ch.sex, ch.age);

  const reroll = (race = ch.race, sex = ch.sex, age = ch.age) => setDraft(roll(race, sex, age));
  const update = (patch: Partial<GameState['chara']>) =>
    setDraft({ ...draft, chara: { ...draft.chara, ...patch } });

  const opt = <T extends string>(
    current: T,
    value: T,
    label: string,
    onPick: () => void,
    icon?: boolean,
  ) => (
    <button
      key={value}
      type="button"
      className="opt"
      aria-pressed={current === value}
      onClick={onPick}
    >
      {icon && <RaceSigil race={value} />}
      {label}
      <span className="en">{value}</span>
    </button>
  );

  return (
    <div className="create">
      <div>
        <div className="eyebrow">Character</div>
        <h1 style={{ fontFamily: 'var(--f-book)', fontSize: 'var(--step-3)', margin: '4px 0 6px' }}>
          冒険者の誕生
        </h1>
        <p className="lede" style={{ marginBottom: 20 }}>
          シナリオ「{scenario.meta.title}
          」で選べる範囲から決めます。種族・性別・年齢を変えると、能力を振り直します。
        </p>
        <div className="field">
          <span>種族</span>
          <div className="opts">
            {races.map((r) => opt(ch.race, r, RACE_JA[r]!, () => reroll(r, ch.sex, ch.age)))}
          </div>
        </div>
        <div className="field">
          <span>性別</span>
          <div className="opts two">
            {sexes.map((s) => opt(ch.sex, s, SEX_JA[s]!, () => reroll(ch.race, s, ch.age)))}
          </div>
        </div>
        <div className="field">
          <span>年齢</span>
          <div className="opts three">
            {ages.map((a) => opt(ch.age, a, AGE_JA[a]!, () => reroll(ch.race, ch.sex, a)))}
          </div>
        </div>
        <label className="field">
          <span>職業</span>
          <select id="job" value={ch.job} onChange={(e) => update({ job: e.target.value })}>
            {jobs.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>名前</span>
          <input
            id="name"
            value={ch.name}
            onChange={(e) => update({ name: e.target.value })}
            className="memo"
            style={{ minHeight: 0 }}
          />
        </label>
      </div>
      <Parchment className="sheet-preview" seed={3}>
        <div className="page-head">
          <span className="title">冒険者名簿</span>
          <span className="para">
            <small>{scenario.meta.title}</small>
          </span>
        </div>
        <div className="prose">
          <p>
            その者、名を<b>{ch.name}</b>という。かつては「{ch.title}」と呼ばれた、{AGE_WORD[ch.age]}
            {RACE_JA[ch.race]}である。生業は{ch.job || '定かでない'}。
          </p>
        </div>
        <div className="stats" style={{ color: 'var(--ink)' }}>
          {(
            [
              ['HP', ch.hp_m],
              ['MP', ch.mp_m],
              ['STR', ch.str],
              ['INT', ch.int],
              ['DEX', ch.dex],
              ['KRM', ch.krm],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="stat" style={{ borderColor: 'var(--page-edge)' }}>
              <div className="k" style={{ color: 'var(--ink-soft)' }}>
                {k}
              </div>
              <div className="v">{v}</div>
            </div>
          ))}
        </div>
        {previous && !previous.isEnded && (
          <p className="enemy-desc">このシナリオの冒険の記録は、新しい冒険で上書きされます。</p>
        )}
        <div className="rollrow">
          <button type="button" className="btn ghost" onClick={() => reroll()}>
            能力を振り直す
          </button>
          <button type="button" className="btn" onClick={() => onStart(draft)}>
            この者で冒険に出る
          </button>
        </div>
      </Parchment>
    </div>
  );
}
