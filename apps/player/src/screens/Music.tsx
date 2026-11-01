import { useEffect, useMemo, useState } from 'react';
import { bgmUrl, seUrl } from '../config.js';
import { loadIndex, type ScenarioEntry } from '../data.js';
import { SOUNDTRACKS } from '../links.js';
import { BGM_GROUPS, SOUND_EFFECTS, bgmUsage } from '../music.js';
import { href } from '../router.js';

/** 音楽室：共通の BGM と効果音を試聴する（旧サイトの「BGMを聴きたい」） */
export function Music() {
  const [entries, setEntries] = useState<ScenarioEntry[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);

  useEffect(() => {
    // 一覧が読めなくても曲は聴けるので、使っているシナリオを出さないだけにする
    loadIndex().then(setEntries, () => {});
  }, []);

  const usage = useMemo(() => bgmUsage(entries), [entries]);
  const label = (name: string) => BGM_GROUPS.find((g) => g.tracks.includes(name))?.label ?? '';

  const playSe = (name: string) => {
    const a = new Audio(seUrl('', name, true));
    a.volume = 0.9;
    void a.play().catch(() => {});
  };

  return (
    <div className="records music">
      <div>
        <div className="eyebrow">Music Room</div>
        <h1 className="page-title">音楽室</h1>
        <p className="lede">
          ソーサリアン Text の各シナリオで流れる標準の BGM
          と効果音です。あのシナリオ、この場面を思い出しながらお楽しみください。
        </p>
      </div>

      {BGM_GROUPS.map((group) => (
        <section key={group.label}>
          <div className="section-h">
            <span>{group.label}</span>
            <span>{group.tracks.length} 曲</span>
          </div>
          <ul className="track-list">
            {group.tracks.map((name) => {
              const used = usage.get(name) ?? [];
              const playing = current === name;
              return (
                <li key={name} className={'track' + (playing ? ' playing' : '')}>
                  <button
                    type="button"
                    className="track-play"
                    aria-pressed={playing}
                    aria-label={playing ? `${name} を止める` : `${name} を再生`}
                    onClick={() => setCurrent(playing ? null : name)}
                  >
                    {playing ? '■' : '▶'}
                  </button>
                  <div className="track-body">
                    <div className="track-name">{name}</div>
                    <div className="track-used" title={used.map((e) => e.title).join('、')}>
                      {used.length > 0
                        ? `${used.length} 編：${used.map((e) => e.title).join('、')}`
                        : entries.length > 0
                          ? '書庫のシナリオでは使われていません'
                          : ''}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section>
        <div className="section-h">
          <span>効果音</span>
          <span>{SOUND_EFFECTS.length} 種</span>
        </div>
        <div className="se-list">
          {SOUND_EFFECTS.map(([name, text]) => (
            <button key={name} type="button" className="chip-btn" onClick={() => playSe(name)}>
              ▶ {text}
              <span className="se-name">{name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-h">
          <span>サウンドトラック</span>
        </div>
        <p className="lede music-note">
          音楽は AZ さんが担当しました。曲は SoundCloud
          でも公開しています。ダウンロードするときは、SoundCloud
          のページで曲目の右端にある［…］→［Download］を選んでください（まとめてのダウンロードはできません）。
        </p>
        <ul className="link-list">
          {SOUNDTRACKS.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
              <span className="link-note">{s.note}</span>
            </li>
          ))}
        </ul>
        <p className="lede music-note">
          ※ ソーサリアン Text 以外での利用は禁止されています。シナリオで使うときは、投稿の「
          <a href={href({ name: 'materials' })}>制作者向けの素材</a>
          」も参照してください。
        </p>
      </section>

      {/* 一覧の最後に置き、スクロールしても画面の下に貼り付くようにする */}
      {current && (
        <div className="now-playing" role="region" aria-label="再生中の曲">
          <div className="now-playing-title">
            <span className="eyebrow">Now Playing</span>
            <strong>{current}</strong>
            <span className="now-playing-group">{label(current)}</span>
          </div>
          <audio
            key={current}
            src={bgmUrl('', `@${current}`)}
            controls
            autoPlay
            loop={loop}
            aria-label={`${current} の再生`}
          />
          <label className="now-playing-loop">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            くり返す
          </label>
          <button type="button" className="chip-btn" onClick={() => setCurrent(null)}>
            停止
          </button>
        </div>
      )}
    </div>
  );
}
