import type { GameState, GlobalState } from '@stext/core';
import { Parchment, SceneText } from '@stext/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { imageUrl } from '../config.js';
import { loadIndex, type ScenarioEntry } from '../data.js';
import {
  CLEAR_STATES,
  DEFAULT_FILTER,
  LENGTHS,
  SORT_KEYS,
  activeConditions,
  filterScenarios,
  type LibraryFilter,
} from '../libraryFilter.js';
import { href } from '../router.js';
import { loadGame, type Settings } from '../storage.js';
import level1 from '../images/level1.png';
import level2 from '../images/level2.png';
import level3 from '../images/level3.png';
import level4 from '../images/level4.png';
import level5 from '../images/level5.png';

const SPINES = [
  '--star-sun',
  '--star-tue',
  '--star-thu',
  '--star-fri',
  '--star-wed',
  '--star-sat',
  '--star-mon',
];

/** 旧サイトの書庫の難易度の呼び方 */
const LEVEL_LABELS = ['簡単', 'やや簡単', '普通', 'やや難', '難'];
/** 旧サイトの難易度のアイコン（image/scena/lv1〜5.png。赤い短剣の数が難易度） */
const LEVEL_ICONS = [level1, level2, level3, level4, level5];

function levelLabel(level: number) {
  const name = LEVEL_LABELS[level - 1];
  return `${level}${name ? `（${name}）` : ''}`;
}

/** 検索条件は、詳細から冒険に出て書庫に戻っても残す（ページを読み込み直すと既定に戻る） */
let lastFilter: LibraryFilter = DEFAULT_FILTER;

/** quest：アンケートのあるシナリオだけに絞った状態で開く（#/library/quest。CONTACT から来たとき） */
export function Library({
  global,
  settings,
  quest = false,
}: {
  global: GlobalState;
  settings: Settings;
  quest?: boolean;
}) {
  const [entries, setEntries] = useState<ScenarioEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(() =>
    quest ? { ...DEFAULT_FILTER, quest: true } : lastFilter,
  );
  const [detail, setDetail] = useState<ScenarioEntry | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const update = (patch: Partial<LibraryFilter>) => {
    const next = { ...filter, ...patch };
    lastFilter = next;
    setFilter(next);
  };

  useEffect(() => {
    if (quest) lastFilter = { ...DEFAULT_FILTER, quest: true };
  }, [quest]);

  useEffect(() => {
    loadIndex().then(setEntries, (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const listed = useMemo(() => (entries ?? []).filter((e) => e.listed), [entries]);
  const seriesList = useMemo(
    () => [...new Set(listed.map((e) => e.series).filter((s): s is string => Boolean(s)))],
    [listed],
  );
  const shown = useMemo(() => filterScenarios(listed, filter, global), [listed, filter, global]);
  const conditions = activeConditions(filter);

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
            {listed.length} 編のシナリオ。誰でも書けて、誰でも遊べるゲームブック。
          </p>
        </div>
      </div>
      <details className="lib-search">
        <summary>
          検索条件
          {conditions > 0 && <span className="lib-search-count">{conditions} 件で絞り込み中</span>}
        </summary>
        <form className="lib-search-form" onSubmit={(ev) => ev.preventDefault()}>
          <label>
            <span>シリーズ名</span>
            <select value={filter.series} onChange={(ev) => update({ series: ev.target.value })}>
              <option value="">すべて</option>
              {seriesList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>検索キーワード</span>
            <input
              type="search"
              value={filter.keyword}
              placeholder="タイトル・作者・分類・紹介文"
              onChange={(ev) => update({ keyword: ev.target.value })}
            />
          </label>
          <label>
            <span>物語の長さ</span>
            <select
              value={filter.length}
              onChange={(ev) => update({ length: ev.target.value as LibraryFilter['length'] })}
            >
              <option value="">すべて</option>
              {LENGTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="lib-search-pair">
            <label>
              <span>難易度</span>
              <select
                value={filter.level}
                onChange={(ev) => update({ level: ev.target.value as LibraryFilter['level'] })}
              >
                <option value="">すべて</option>
                {LEVEL_LABELS.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {i + 1}（{name}）
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="難易度の比べ方"
              value={filter.levelOp}
              onChange={(ev) => update({ levelOp: ev.target.value as LibraryFilter['levelOp'] })}
            >
              <option value="gte">以上</option>
              <option value="eq">一致</option>
              <option value="lte">以下</option>
            </select>
          </div>
          <label>
            <span>クリア状態</span>
            <select
              value={filter.clear}
              onChange={(ev) => update({ clear: ev.target.value as LibraryFilter['clear'] })}
            >
              <option value="">すべて</option>
              {CLEAR_STATES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="lib-search-pair">
            <label>
              <span>並び順</span>
              <select
                value={filter.sort}
                onChange={(ev) => update({ sort: ev.target.value as LibraryFilter['sort'] })}
              >
                {SORT_KEYS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="並びの向き"
              value={filter.order}
              onChange={(ev) => update({ order: ev.target.value as LibraryFilter['order'] })}
            >
              <option value="desc">降順</option>
              <option value="asc">昇順</option>
            </select>
          </div>
          <label className="lib-search-check">
            <input
              type="checkbox"
              checked={filter.quest}
              onChange={(ev) => update({ quest: ev.target.checked })}
            />
            アンケートのあるシナリオだけ
          </label>
          <button
            type="button"
            className="chip-btn lib-search-reset"
            onClick={() => update(DEFAULT_FILTER)}
          >
            条件クリア
          </button>
        </form>
      </details>
      {entries === null ? (
        <p className="empty-state">書庫を開いています…</p>
      ) : shown.length === 0 ? (
        <p className="empty-state">条件に合うシナリオはありません。</p>
      ) : (
        <>
          {conditions > 0 && (
            <p className="lib-search-result" role="status">
              {shown.length} 編 / 全 {listed.length} 編
            </p>
          )}
          <div className="shelf">
            {shown.map((e) => {
              const save = loadGame(e.id);
              const playing = Boolean(save && !save.isEnded);
              const got = global.results[e.id]?.length ?? 0;
              const status = playing ? '冒険中' : got > 0 ? `実績 ${got} / ${e.results}` : '未読';
              const cls = playing ? 'is-play' : got > 0 ? 'is-clear' : 'is-new';
              const spine = SPINES[listed.indexOf(e) % SPINES.length];
              return (
                <article
                  key={e.id}
                  className="book"
                  onClick={() => setDetail(e)}
                  style={{ ['--spine' as string]: `var(${spine})` }}
                >
                  <IntroImage id={e.id} />
                  <div>
                    <h2>{e.title}</h2>
                    {e.author && <div className="by">{e.author}</div>}
                  </div>
                  <div className="book-meta">
                    <span>{e.scenes.toLocaleString()} シーン</span>
                    {e.level !== undefined && <Level level={e.level} />}
                  </div>
                  <div className="foot">
                    <span className={`pill ${cls}`}>{status}</span>
                    <button
                      type="button"
                      className="chip-btn book-detail"
                      aria-label={`「${e.title}」の詳細を表示`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setDetail(e);
                      }}
                    >
                      詳細を表示
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      {detail && (
        <ScenarioDetail
          entry={detail}
          save={loadGame(detail.id)}
          got={global.results[detail.id]?.length ?? 0}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

function IntroImage({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="book-img">
      {failed ? (
        <svg className="book-noimg" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 9.5L73.8 82.8L11.5 37.5H88.5L26.2 82.8Z" />
        </svg>
      ) : (
        <img
          src={imageUrl(id, 'intro.png')}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function Level({ level }: { level: number }) {
  const label = `難易度 ${levelLabel(level)}`;
  const icon = LEVEL_ICONS[level - 1];
  return icon ? (
    <img className="level" src={icon} alt={label} title={label} width={61} height={13} />
  ) : (
    <span className="level">{label}</span>
  );
}

/** 旧サイトと同じ、シナリオごとの感想アンケート（Google フォーム）の回答画面・結果画面 */
function questUrl(quest: string, page: 'viewform' | 'viewanalytics') {
  return `https://docs.google.com/forms/d/e/${encodeURIComponent(quest)}/${page}`;
}

/** 書庫の詳細：プロローグとシナリオの情報。ここから冒険を始める（続ける） */
function ScenarioDetail({
  entry: e,
  save,
  got,
  onClose,
}: {
  entry: ScenarioEntry;
  save: GameState | undefined;
  got: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const playing = save && !save.isEnded ? save : undefined;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  const info: [string, ReactNode][] = [
    ['分類', e.tags?.join('・')],
    ['シリーズ', e.series],
    ['シーン数', e.scenes.toLocaleString()],
    ['難易度', e.level !== undefined && <Level level={e.level} />],
    ['公開日', e.published?.replace(/-/g, '/')],
    ['更新日', e.updated?.replace(/-/g, '/')],
    [
      '取得実績',
      e.results > 0
        ? `${got} / ${e.results}（${Math.floor((got / e.results) * 100)}%）`
        : undefined,
    ],
  ];

  return (
    <div
      className="lib-detail"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="lib-detail-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lib-detail-title"
        tabIndex={-1}
      >
        <Parchment as="article" seed={e.id.length * 7 + 3} curl={36}>
          <header className="lib-detail-head">
            {e.series && <div className="eyebrow">{e.series}</div>}
            <h2 id="lib-detail-title">{e.title}</h2>
            {e.author && <div className="by">{e.author} 作</div>}
          </header>
          <div className="lib-detail-body">
            <IntroImage id={e.id} />
            {e.prologue ? (
              <SceneText className="prose" markdown={e.prologue} />
            ) : (
              e.comment && <p className="prose">{e.comment}</p>
            )}
          </div>
          {e.unpublished && <p className="lib-detail-note">公開前のシナリオです。</p>}
          {playing && (
            <p className="lib-detail-save">
              冒険中：「{playing.chara.title}」{playing.chara.name} · 節 {String(playing.scene)} ·
              HP {playing.chara.hp} / {playing.chara.hp_m}
            </p>
          )}
          <div className="end-actions">
            {playing && (
              <a className="btn" href={href({ name: 'play', id: e.id })}>
                続きから冒険する
              </a>
            )}
            <a className={playing ? 'btn ghost' : 'btn'} href={href({ name: 'create', id: e.id })}>
              新たに冒険を始める
            </a>
            <button type="button" className="btn ghost" onClick={onClose}>
              閉じる
            </button>
          </div>
          {playing && (
            <p className="lib-detail-note">
              新たに冒険を始めると、キャラクターを作って出発した時点で今の冒険は上書きされます。
            </p>
          )}
          {e.quest && (
            <div className="lib-detail-quest">
              <span>作者への感想・ご意見をお寄せください</span>
              <a
                className="chip-btn"
                href={questUrl(e.quest, 'viewform')}
                target="_blank"
                rel="noopener noreferrer"
              >
                アンケートに回答する
              </a>
              <a
                className="chip-btn"
                href={questUrl(e.quest, 'viewanalytics')}
                target="_blank"
                rel="noopener noreferrer"
              >
                結果だけを確認
              </a>
            </div>
          )}
          <dl className="lib-detail-info">
            {info
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            {e.comment && e.prologue && (
              <div className="wide">
                <dt>作者より</dt>
                <dd>{e.comment}</dd>
              </div>
            )}
          </dl>
        </Parchment>
      </div>
    </div>
  );
}
