import {
  AGES,
  RACES,
  SEXES,
  STAR_IDS,
  STAR_NAMES,
  STATE_NAMES,
  availableJobs,
  type GameState,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import { useState } from 'react';
import { statusLabel } from './Panels.js';

const STATES = ['', 'poison', 'frozen', 'stone', 'curse', 'forget'] as const;

export interface StatusEditorProps {
  scenario: Scenario;
  state: GameState;
  onSave: (state: GameState) => void;
  onCancel: () => void;
}

/**
 * ステータスの手入力（旧エンジンのステータス・基本情報・魔法のシートと同じ項目）。
 * ゲームブックとして、戦闘などの結果をプレイヤーが自分で反映できるようにする。
 */
export function StatusEditor({ scenario, state, onSave, onCancel }: StatusEditorProps) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(state)) as GameState);
  const c = draft.chara;
  const label = (k: string) => statusLabel(scenario, k);
  const setChara = (patch: Partial<GameState['chara']>) =>
    setDraft({ ...draft, chara: { ...c, ...patch } });
  const jobs = availableJobs(c.race, c.sex, c.age);

  const num = (
    key:
      'hp' | 'hp_m' | 'mp' | 'mp_m' | 'str' | 'int' | 'dex' | 'krm' | 'free1' | 'free2' | 'free3',
    text: string,
  ) => (
    <NumberField
      key={key}
      id={`edit-${key}`}
      label={text}
      value={Number(c[key])}
      onChange={(v) => setChara({ [key]: v })}
    />
  );

  return (
    <form
      className="status-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const job = jobs.includes(c.job) ? c.job : (jobs[0] ?? c.job);
        onSave({ ...draft, chara: { ...c, job } });
      }}
    >
      <div className="section-h">
        <span>基本情報</span>
      </div>
      <label className="field-row">
        <span>名前</span>
        <input id="edit-name" value={c.name} onChange={(e) => setChara({ name: e.target.value })} />
      </label>
      <label className="field-row">
        <span>種族</span>
        <select
          id="edit-race"
          value={c.race}
          onChange={(e) => setChara({ race: e.target.value as never })}
        >
          {RACES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span>性別</span>
        <select
          id="edit-sex"
          value={c.sex}
          onChange={(e) => setChara({ sex: e.target.value as never })}
        >
          {SEXES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span>年齢</span>
        <select
          id="edit-age"
          value={c.age}
          onChange={(e) => setChara({ age: e.target.value as never })}
        >
          {AGES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span>職業</span>
        <select
          id="edit-job"
          value={jobs.includes(c.job) ? c.job : (jobs[0] ?? '')}
          onChange={(e) => setChara({ job: e.target.value })}
        >
          {jobs.map((j) => (
            <option key={j}>{j}</option>
          ))}
        </select>
      </label>

      <div className="section-h">
        <span>ステータス</span>
      </div>
      <div className="edit-grid">
        {num('hp', label('hp'))}
        {num('hp_m', `${label('hp')} 最大`)}
        {num('mp', label('mp'))}
        {num('mp_m', `${label('mp')} 最大`)}
        {num('str', `${label('str')}（初期 ${c.str_i}）`)}
        {num('int', `${label('int')}（初期 ${c.int_i}）`)}
        {num('dex', `${label('dex')}（初期 ${c.dex_i}）`)}
        {num('krm', `${label('krm')}（初期 ${c.krm_i}）`)}
        {num('free1', label('free1'))}
        {num('free2', label('free2'))}
        {num('free3', label('free3'))}
      </div>
      <label className="field-row">
        <span>状態</span>
        <select
          id="edit-state"
          value={c.state}
          onChange={(e) => setChara({ state: e.target.value })}
        >
          {STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_NAMES[s] ?? s}
            </option>
          ))}
        </select>
      </label>

      <div className="section-h">
        <span>星の欠片</span>
      </div>
      <div className="edit-grid">
        {STAR_IDS.map((id, i) => (
          <NumberField
            key={id}
            id={`edit-star-${id}`}
            label={STAR_NAMES[id]}
            value={Number(draft.stars[i] ?? 0)}
            min={0}
            onChange={(v) =>
              setDraft({ ...draft, stars: draft.stars.map((n, k) => (k === i ? v : n)) })
            }
          />
        ))}
      </div>

      <div className="end-actions">
        <button type="submit" className="btn">
          確定
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          やめる
        </button>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(min !== undefined ? Math.max(min, v) : v);
  return (
    <div className="num-field">
      <label htmlFor={id}>{label}</label>
      <span className="param-input">
        <button type="button" onClick={() => set(value - 1)} aria-label={`${label}を1減らす`}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" onClick={() => set(value + 1)} aria-label={`${label}を1増やす`}>
          ＋
        </button>
      </span>
    </div>
  );
}
