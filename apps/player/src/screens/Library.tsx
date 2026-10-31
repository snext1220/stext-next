import type { GlobalState } from '@stext/core';
import { Parchment } from '@stext/ui';
import { useEffect, useMemo, useState } from 'react';
import { loadIndex, type ScenarioEntry } from '../data.js';
import { href } from '../router.js';
import { loadGame, type Settings } from '../storage.js';

const SPINES = [
  '--star-sun',
  '--star-tue',
  '--star-thu',
  '--star-fri',
  '--star-wed',
  '--star-sat',
  '--star-mon',
];

export function Library({
  global,
  settings,
  onSettings,
}: {
  global: GlobalState;
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const [entries, setEntries] = useState<ScenarioEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState('すべて');

  useEffect(() => {
    loadIndex().then(setEntries, (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const visible = useMemo(
    () => (entries ?? []).filter((e) => e.listed || settings.showUnlisted),
    [entries, settings.showUnlisted],
  );
  const seriesList = useMemo(
    () => [
      'すべて',
      ...new Set(visible.map((e) => e.series).filter((s): s is string => Boolean(s))),
    ],
    [visible],
  );
  const shown = visible.filter((e) => series === 'すべて' || e.series === series);

  const recent = settings.recent ? loadGame(settings.recent) : undefined;
  const recentEntry = entries?.find((e) => e.id === settings.recent);

  if (error) {
    return (
      <div className="error-box" role="alert">
        シナリオの一覧を読み込めませんでした。{error}
      </div>
    );
  }

  return (
    <div>
      {recent && recentEntry && !recent.isEnded && (
        <div className="continue">
          <Parchment seed={11} curl={28}>
            <div className="eyebrow" style={{ color: 'var(--ink-soft)' }}>
              続きから
            </div>
            <div
              style={{
                fontFamily: 'var(--f-book)',
                fontSize: 'var(--step-2)',
                fontWeight: 700,
                margin: '4px 0',
              }}
            >
              {recentEntry.title}
            </div>
            <div
              style={{
                fontFamily: 'var(--f-book)',
                color: 'var(--ink-soft)',
                fontSize: 'var(--step--1)',
              }}
            >
              「{recent.chara.title}」{recent.chara.name} · 節 {String(recent.scene)} · HP{' '}
              {recent.chara.hp} / {recent.chara.hp_m}
            </div>
          </Parchment>
          <a
            className="btn"
            style={{
              background: 'var(--gold)',
              borderColor: 'var(--gold)',
              color: 'var(--desk)',
              textDecoration: 'none',
            }}
            href={href({ name: 'play', id: recentEntry.id })}
          >
            冒険を再開
          </a>
        </div>
      )}
      <div className="lib-head">
        <div>
          <div className="eyebrow">Pentawa Library</div>
          <h1>ペンタウァの書庫</h1>
          <p className="lede">
            {visible.length} 編のシナリオ。誰でも書けて、誰でも遊べるゲームブック。
          </p>
        </div>
        <div className="filters" role="group" aria-label="シリーズで絞り込む">
          {seriesList.map((s) => (
            <button
              key={s}
              type="button"
              className="chip-btn"
              aria-pressed={series === s}
              onClick={() => setSeries(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {entries === null ? (
        <p className="empty-state">書庫を開いています…</p>
      ) : (
        <div className="shelf">
          {shown.map((e, i) => {
            const save = loadGame(e.id);
            const got = global.results[e.id]?.length ?? 0;
            const status =
              save && !save.isEnded ? '冒険中' : got > 0 ? `実績 ${got} / ${e.results}` : '未読';
            const cls = save && !save.isEnded ? 'is-play' : got > 0 ? 'is-clear' : 'is-new';
            return (
              <a
                key={e.id}
                className="book"
                href={href(
                  save && !save.isEnded ? { name: 'play', id: e.id } : { name: 'create', id: e.id },
                )}
                style={{
                  ['--spine' as string]: `var(${SPINES[i % SPINES.length]})`,
                  textDecoration: 'none',
                }}
              >
                <div>
                  <h2>{e.title}</h2>
                  <div className="by">{e.author}</div>
                </div>
                <p>{e.comment ? truncate(e.comment, 80) : (e.tags ?? []).join('・')}</p>
                <div className="foot">
                  <span>
                    {e.scenes.toLocaleString()} 節{e.series ? ` · ${e.series}` : ''}
                  </span>
                  <span className={`pill ${cls}`}>{status}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
      <label className="note" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={Boolean(settings.showUnlisted)}
          onChange={(e) => onSettings({ ...settings, showUnlisted: e.target.checked })}
        />
        公開一覧にない開発用のシナリオ（テスト・Playground など）も表示する
      </label>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
