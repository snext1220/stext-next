import {
  MAGIC,
  STAR_IDS,
  STAR_NAMES,
  STATE_NAMES,
  bonusItem,
  canCast,
  type GameState,
  type GlobalState,
  type MagicName,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import { useState } from 'react';

const STAR_COLORS = [
  '--star-mon',
  '--star-tue',
  '--star-wed',
  '--star-thu',
  '--star-fri',
  '--star-sat',
  '--star-sun',
];
const RACE_ICONS: Record<string, string> = {
  FIGHTER: 'M6 26 22 10M18 6l8 8M9 19l4 4',
  WIZARD: 'M16 4 10 26h12L16 4zM13 16h6',
  DWARF: 'M8 12h16v6H8zM16 18v10M10 8l6-4 6 4',
  ELF: 'M6 22C14 22 22 14 26 6M8 6c0 10 6 16 18 18',
};

/** ステータス欄の表示名（シナリオの labels で置き換えられる） */
export function statusLabel(scenario: Scenario, key: string): string {
  return scenario.meta.labels?.[key] ?? key.toUpperCase();
}

export function RaceSigil({ race }: { race: string }) {
  return (
    <div className="sigil" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path d={RACE_ICONS[race] ?? RACE_ICONS['FIGHTER']} />
      </svg>
    </div>
  );
}

/** キャラクターの顔画像。読み込めなければ種族の紋章を出す */
export function CharaPortrait({ src, race }: { src?: string | undefined; race: string }) {
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src) return <RaceSigil race={race} />;
  return (
    <img
      className="portrait"
      src={src}
      alt=""
      width={100}
      height={100}
      onError={() => setFailed(src)}
    />
  );
}

export function HeroPanel({
  scenario,
  state,
  portraitUrl,
}: {
  scenario: Scenario;
  state: GameState;
  /** 顔画像の URL（省略時は種族の紋章） */
  portraitUrl?: string | undefined;
}) {
  const c = state.chara;
  const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
  const label = (k: string) => statusLabel(scenario, k);
  const frees = (['free1', 'free2', 'free3'] as const).filter(
    (k) => scenario.meta.labels?.[k] || c[k] !== 0,
  );
  const bonus = state.bonus ? bonusItem(state.bonus) : undefined;
  return (
    <div>
      <div className={'hero' + (portraitUrl ? ' with-portrait' : '')}>
        <CharaPortrait src={portraitUrl} race={c.race} />
        <div>
          <div className="epithet">「{c.title}」</div>
          <div className="name">{c.name}</div>
          <div className="meta">
            {c.race} · {c.sex} · {c.age} · {c.job}
          </div>
        </div>
      </div>
      <div className="gauges" aria-live="polite">
        <div className="gauge">
          <span className="lbl">{label('hp')}</span>
          <div className="bar hp">
            <span style={{ width: pct(c.hp, c.hp_m) }} />
          </div>
          <span className="val">
            {c.hp} / {c.hp_m}
          </span>
        </div>
        <div className="gauge">
          <span className="lbl">{label('mp')}</span>
          <div className="bar mp">
            <span style={{ width: pct(c.mp, c.mp_m) }} />
          </div>
          <span className="val">
            {c.mp} / {c.mp_m}
          </span>
        </div>
      </div>
      <div className="stats">
        {(['str', 'int', 'dex', 'krm'] as const).map((k) => (
          <div className="stat" key={k}>
            <div className="k">{label(k)}</div>
            <div className="v">{c[k]}</div>
          </div>
        ))}
      </div>
      {frees.length > 0 && (
        <div className="stats">
          {frees.map((k) => (
            <div className="stat" key={k}>
              <div className="k">{label(k)}</div>
              <div className="v">{c[k]}</div>
            </div>
          ))}
        </div>
      )}
      <div className="state">
        <span>状態</span>
        <b>{STATE_NAMES[c.state] ?? c.state}</b>
      </div>
      {state.bonus && (
        <div className="hero-bonus">
          <span>ボーナス</span>
          <div>
            <b>{bonus?.name ?? state.bonus}</b>
            {bonus && <p>{bonus.desc}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function MagicPanel({
  state,
  onCast,
}: {
  state: GameState;
  onCast: (name: MagicName) => void;
}) {
  const total = state.stars.slice(0, 7).reduce((a, b) => a + Number(b), 0);
  return (
    <div>
      <div className="section-h">
        <span>星の加護</span>
        <span>{total} 個</span>
      </div>
      <div className="stars">
        {STAR_IDS.map((id, i) => (
          <div
            key={id}
            className={'star' + (Number(state.stars[i]) ? '' : ' zero')}
            style={{ ['--c' as string]: `var(${STAR_COLORS[i]})` }}
          >
            <div className="orb">{state.stars[i] ?? 0}</div>
            {STAR_NAMES[id]}
          </div>
        ))}
      </div>
      <ul className="spells">
        {(Object.keys(MAGIC) as MagicName[]).map((name) => {
          const ok = canCast(name, state.stars, state.chara.state);
          return (
            <li key={name} className={'spell' + (ok ? ' ok' : '')}>
              <span className="sn">{name}</span>
              {ok ? (
                <button type="button" className="cast" onClick={() => onCast(name)}>
                  唱える
                </button>
              ) : (
                <span className="cost" aria-label="必要な星">
                  {MAGIC[name].stars.flatMap((n, i) =>
                    Array.from({ length: n }, (_, k) => (
                      <i
                        key={`${i}-${k}`}
                        style={{ ['--c' as string]: `var(${STAR_COLORS[i]})` }}
                        title={STAR_NAMES[STAR_IDS[i]!]}
                      />
                    )),
                  )}
                </span>
              )}
              <span className="sd">{MAGIC[name].description}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ItemsPanel({
  scenario,
  state,
  onUse,
}: {
  scenario: Scenario;
  state: GameState;
  /** 使えるアイテム（target を持つもの）を使う */
  onUse?: (id: string) => void;
}) {
  const items = state.items.map(
    (id): { id: string; name: string; text?: string; target?: string } =>
      scenario.items.find((i) => i.id === id) ?? { id, name: id },
  );
  const flags = state.flags
    .map((id) => scenario.flags.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f && !f.hidden));
  const count = (id: string) => state.params[`p${id}`];
  return (
    <div>
      <div className="section-h">
        <span>持ち物</span>
        <span>{items.length}</span>
      </div>
      <ul className="list">
        {items.length ? (
          items.map((i) => (
            <li key={i.id} className={i.target ? 'usable' : ''}>
              <span className="n">
                {i.target ? '★ ' : ''}
                {i.name}
                {Number(count(i.id)) > 0 ? ` ×${count(i.id)}` : ''}
                {i.target && onUse && (
                  <button
                    type="button"
                    className="cast use-item"
                    onClick={() => onUse(i.id)}
                    aria-label={`${i.name}を使う`}
                  >
                    使う
                  </button>
                )}
              </span>
              {i.text ? <span className="d">{i.text}</span> : null}
            </li>
          ))
        ) : (
          <li>
            <span className="d">何も持っていない。</span>
          </li>
        )}
      </ul>
      <div className="section-h">
        <span>冒険の手記</span>
        <span>{flags.length}</span>
      </div>
      <ul className="list journal">
        {flags.length ? (
          flags.map((f) => <li key={f.id}>{f.text}</li>)
        ) : (
          <li>
            <span className="d">まだ書き留めたことはない。</span>
          </li>
        )}
      </ul>
    </div>
  );
}

export interface HistoryEntry {
  id: string;
  label: string;
}

/** 実績レベルのトロフィー名（旧エンジンと同じ。0 は未獲得） */
const TROPHY_NAMES = ['実績未達', 'ノーマル', 'ブロンズ', 'シルバー', 'ゴールド', 'プラチナ'];

export function RecordPanel({
  scenario,
  scenarioId,
  global,
  history,
  trophyUrl,
}: {
  scenario: Scenario;
  scenarioId: string;
  global: GlobalState;
  history: HistoryEntry[];
  /** 実績レベルのアイコン（0 は未獲得）。省略時はアイコンを出さない */
  trophyUrl?: (level: number) => string;
}) {
  const got = new Set(global.results[scenarioId] ?? []);
  const all = scenario.results;
  const trophy = (level: number) => {
    const name = TROPHY_NAMES[level];
    return trophyUrl && name ? (
      <img className="trophy" src={trophyUrl(level)} alt={name} title={name} />
    ) : (
      <span className="trophy" />
    );
  };
  return (
    <div>
      <div className="section-h">
        <span>実績</span>
        <span>
          {all.filter((r) => got.has(r.id)).length} / {all.length}
        </span>
      </div>
      <div className="progress">
        <span
          style={{
            width: `${all.length ? (all.filter((r) => got.has(r.id)).length / all.length) * 100 : 0}%`,
          }}
        />
      </div>
      <ul className={`list results${trophyUrl ? ' with-trophy' : ''}`}>
        {all.map((r) =>
          got.has(r.id) ? (
            <li key={r.id}>
              {trophyUrl && trophy(r.level || -1)}
              <div>
                <span className="n">
                  {r.name}
                  {r.level !== undefined && <span className="lv">Lv.{r.level}</span>}
                </span>
                {r.text ? <span className="d">{r.text}</span> : null}
              </div>
            </li>
          ) : (
            <li key={r.id} className="locked">
              {trophyUrl && trophy(0)}
              <div>
                <span className="n">？？？</span>
              </div>
            </li>
          ),
        )}
      </ul>
      <div className="section-h">
        <span>辿った節</span>
        <span>{history.length}</span>
      </div>
      <ul className="list log">
        {history
          .slice()
          .reverse()
          .slice(0, 12)
          .map((h, i) => (
            <li key={i}>
              <span className="t">§{h.id}</span>
              <span>{h.label}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
