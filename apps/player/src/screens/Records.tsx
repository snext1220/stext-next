import { BONUS_ITEMS, GLOBAL_SAVE_KEY, playerRank, type GlobalState } from '@stext/core';
import { Parchment } from '@stext/ui';
import { useEffect, useState } from 'react';
import { ALL, backupContent, backupFileName, downloadText, parseBackup } from '../backup.js';
import { ASSET_BASE } from '../config.js';
import { loadIndex, type ScenarioEntry } from '../data.js';
import { loadGlobal, readRaw, writeRaw } from '../storage.js';

/** 冒険者の記録：プレイヤーランク、ボーナスアイテム、セーブデータのバックアップ／リストア */
export function Records({
  global,
  onGlobal,
}: {
  global: GlobalState;
  onGlobal: (g: GlobalState) => void;
}) {
  const [entries, setEntries] = useState<ScenarioEntry[] | null>(null);
  const [target, setTarget] = useState(ALL);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadIndex().then(setEntries, (e: unknown) =>
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) }),
    );
  }, []);

  // ランクは公開シナリオ（旧 stext.xml の scenario 一覧）で数える
  const listed = (entries ?? []).filter((e) => e.listed);
  const rank = playerRank(global, listed);
  const withSaves = (entries ?? []).filter((e) => readRaw(e.id) !== null);

  const backup = () => {
    const ids = (entries ?? []).filter((e) => !e.unpublished).map((e) => e.id);
    const content = backupContent(target, ids, readRaw);
    if (!content) return setMessage({ ok: false, text: 'バックアップするデータがありません。' });
    downloadText(backupFileName(target), content);
    setMessage({ ok: true, text: `${backupFileName(target)} を保存しました。` });
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const restored = parseBackup(file.name, await file.text());
      for (const e of restored) writeRaw(e.key, e.value);
      onGlobal(loadGlobal());
      const names = restored.map((e) =>
        e.key === GLOBAL_SAVE_KEY
          ? '基本情報'
          : (entries?.find((x) => x.id === e.key)?.title ?? e.key),
      );
      setMessage({ ok: true, text: `リストアが完了しました：${names.join('、')}` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const bonusEntries = [...Object.entries(BONUS_ITEMS.happy), ...Object.entries(BONUS_ITEMS.bad)];

  return (
    <div className="records">
      <div>
        <div className="eyebrow">Adventurer</div>
        <h1 style={{ fontFamily: 'var(--f-book)', fontSize: 'var(--step-3)', margin: '4px 0 6px' }}>
          冒険者の記録
        </h1>
        <p className="lede">すべてのシナリオを通した、あなたの冒険の歩みです。</p>
      </div>

      <Parchment seed={21} curl={34}>
        <div className="rank-card">
          <img src={`${ASSET_BASE}common/rank/rank${rank.level}.png`} alt="" />
          <div>
            <div className="rank-en">
              RANK {rank.level} · {rank.en}
            </div>
            <div className="rank-name">{rank.jp}</div>
            <div className="enemy-desc">
              経験値 {rank.exp}
              {rank.next !== undefined ? `（次のランクまで ${rank.next - rank.exp}）` : ''}
            </div>
          </div>
        </div>
        <div className="stats" style={{ color: 'var(--ink)', marginTop: 16 }}>
          {(
            [
              ['クリア', `${rank.cleared} / ${rank.scenarios}`],
              ['実績', `${rank.results} / ${rank.resultsAll}`],
              ['ボーナス', `${rank.bonus} / ${rank.bonusAll}`],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="stat" style={{ borderColor: 'var(--page-edge)' }}>
              <div className="k" style={{ color: 'var(--ink-soft)' }}>
                {k}
              </div>
              <div className="v" style={{ fontSize: 'var(--step-0)' }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <p className="enemy-desc" style={{ marginTop: 12 }}>
          経験値は、ボーナスアイテム1個につき10、クリアしたシナリオのレベルに応じて100〜200、実績1個につき2です。
        </p>
      </Parchment>

      <section>
        <div className="section-h">
          <span>ボーナスアイテム</span>
          <span>
            {global.items.length} / {bonusEntries.length}
          </span>
        </div>
        <p className="lede" style={{ fontSize: 'var(--step--1)', marginTop: 0 }}>
          ハッピーエンドで必ず、バッドエンドでときどき手に入ります。冒険を始めるとき、持っているものから一つが働きます。
        </p>
        <div className="bonus-grid">
          {bonusEntries.map(([id, item]) => {
            const owned = global.items.includes(id);
            return (
              <div key={id} className={'bonus-item' + (owned ? '' : ' locked')}>
                <img src={`${ASSET_BASE}common/${id}.png`} alt="" />
                <div>
                  <div className="n">{owned ? item.name : '？？？'}</div>
                  <div className="d">
                    {owned
                      ? item.desc
                      : id.startsWith('bgi')
                        ? 'バッドエンドで手に入る'
                        : 'ハッピーエンドで手に入る'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-h">
          <span>セーブデータ</span>
        </div>
        <p className="lede" style={{ fontSize: 'var(--step--1)', marginTop: 0 }}>
          旧ソーサリアンText と同じ .stext ファイルで、バックアップとリストアができます。
        </p>
        <div className="save-tools">
          <select
            id="backup-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="バックアップする対象"
          >
            <option value={ALL}>全シナリオのデータ</option>
            <option value={GLOBAL_SAVE_KEY}>基本情報（実績／ボーナス）</option>
            {withSaves.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={backup}>
            バックアップ
          </button>
          <label className="btn ghost" style={{ cursor: 'pointer' }}>
            リストア…
            <input
              id="restore-file"
              type="file"
              accept=".stext"
              hidden
              onChange={(e) => void restore(e.target.files?.[0])}
            />
          </label>
        </div>
        {message && (
          <p
            className={message.ok ? 'enemy-desc' : 'error-box'}
            role="status"
            style={{ marginTop: 10 }}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
