import {
  applyDrop,
  attackEnemy,
  bonusItem,
  createEngine,
  dropFor,
  enemyHp,
  receiveAttack,
  rollDice,
  selectFunc,
  STATE_NAMES,
  type AttackResult,
  type GameEvent,
  type GameState,
  type GlobalState,
  type MagicName,
} from '@stext/core';
import type { Enemy, Scenario } from '@stext/schema';
import {
  ChoiceList,
  Die,
  EnemyCard,
  HeroPanel,
  ItemsPanel,
  MagicPanel,
  Parchment,
  RecordPanel,
  SceneText,
  StatusEditor,
  Toasts,
  statusLabel,
  type HistoryEntry,
  type Toast,
} from '@stext/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioDirector } from '../audio.js';
import { bgmUrl, charaImageUrl, imageUrl, seUrl, trophyUrl } from '../config.js';
import { href } from '../router.js';
import { saveGame, saveGlobal, type Settings } from '../storage.js';

interface EnemyBattle {
  enemy: Enemy;
  func: string;
  displayOnly: boolean;
  hp: number | undefined;
  drop: { drop: string; name: string } | undefined;
  dropTaken: boolean;
  /** 撃破チェック */
  defeated: boolean;
}

interface Battle {
  dice: number[];
  rolling: boolean;
  multiplier: number;
  enemies: EnemyBattle[];
}

const PANEL_TABS = [
  {
    id: 'hero',
    ja: '冒険者',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  },
  {
    id: 'magic',
    ja: '魔法',
    icon: 'M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6z',
  },
  { id: 'items', ja: '持ち物', icon: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2' },
  {
    id: 'record',
    ja: '記録',
    icon: 'M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2v-1h11M7 4a2 2 0 0 0-2 2v11',
  },
] as const;
type PanelTab = (typeof PANEL_TABS)[number]['id'];

const FONT_SIZES = { small: '0.9375rem', medium: '1.0625rem', large: '1.25rem' } as const;

export interface PlayProps {
  id: string;
  scenario: Scenario;
  initial: GameState;
  global: GlobalState;
  onGlobal: (g: GlobalState) => void;
  audio: AudioDirector;
  settings: Settings;
  onSettings: (s: Settings) => void;
}

export function Play({
  id,
  scenario,
  initial,
  global,
  onGlobal,
  audio,
  settings,
  onSettings,
}: PlayProps) {
  const engine = useMemo(() => createEngine(scenario, { scenarioId: id }), [scenario, id]);
  const [state, setStateRaw] = useState(initial);
  const [history, setHistory] = useState<{ state: GameState; entry: HistoryEntry }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tab, setTab] = useState<PanelTab>('hero');
  const [sheet, setSheet] = useState<PanelTab | null>(null);
  const [editing, setEditing] = useState(false);
  const toastId = useRef(0);

  const toast = useCallback((kind: Toast['kind'], title: string, message: string) => {
    const t = { id: ++toastId.current, kind, title, message };
    setToasts((list) => [...list.slice(-2), t]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 3600);
  }, []);

  /** 状態を変えて保存する。saved を渡すと、表示とは別の内容を保存する */
  const setState = useCallback(
    (s: GameState, g: GlobalState = global, saved: GameState = s) => {
      setStateRaw(s);
      saveGame(id, saved);
      if (g !== global) {
        saveGlobal(g);
        onGlobal(g);
      }
    },
    [id, global, onGlobal],
  );

  const view = useMemo(() => engine.view(state, global), [engine, state, global]);
  const itemName = (iid: string) => scenario.items.find((i) => i.id === iid)?.name ?? iid;
  const resultName = (rid: string) => scenario.results.find((r) => r.id === rid)?.name ?? rid;

  const showEvents = useCallback(
    (events: GameEvent[]) => {
      for (const e of events) {
        if (e.type === 'itemGained') toast('item', 'アイテム獲得', itemName(e.id));
        else if (e.type === 'itemLost') toast('info', 'アイテム消失', itemName(e.id));
        else if (e.type === 'resultUnlocked') toast('result', '実績獲得', resultName(e.id));
        else if (e.type === 'bonusAwarded') {
          const item = bonusItem(e.id);
          toast('result', 'ボーナスアイテム', item ? `${item.name}：${item.desc}` : e.id);
        } else if (e.type === 'stateGuarded')
          toast('info', 'シナリオボーナス', `${e.state} を防いだ！`);
        else if (e.type === 'stoneDeath')
          toast('dmg', 'あなたは死んでしまった', '石化から30シーンが経過した');
        else if (e.type === 'forgetCured')
          toast('info', '忘却解除', '20シーン経過で忘却が解消された');
        else if (e.type === 'notEnoughStars') toast('warn', '魔法', '星が不足しているようだ。');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast, scenario],
  );

  // ───── BGM・効果音 ─────
  useEffect(() => {
    const name = view.bgm || scenario.meta.bgm?.main || 'main';
    audio.playBgm(bgmUrl(id, name));
  }, [audio, id, view.bgm, scenario]);
  useEffect(() => {
    if (view.se) audio.playSe(seUrl(id, view.se));
  }, [audio, id, view.id, view.se, history.length]);

  // ───── 戦闘（シーンに入るたびに用意する） ─────
  const [battle, setBattle] = useState<Battle>(() => newBattle());
  function newBattle(): Battle {
    return {
      dice: rollDice(Math.random, view.dice).values,
      rolling: false,
      multiplier: 1,
      enemies: view.enemies.map((enemy) => {
        const f = enemy.func
          ? selectFunc(Math.random, enemy.func)
          : { func: '', displayOnly: false };
        return {
          enemy,
          func: f.func,
          displayOnly: f.displayOnly,
          hp: enemyHp(enemy, (p) => engine.paramValue(state, p)),
          drop: dropFor(Math.random, enemy),
          dropTaken: false,
          defeated: false,
        };
      }),
    };
  }
  const sceneKey = `${view.id}:${state.ellapsed_scene}`;
  const lastScene = useRef(sceneKey);
  useEffect(() => {
    if (lastScene.current !== sceneKey) {
      lastScene.current = sceneKey;
      setBattle(newBattle());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  const battleAction = (fn: (ctx: ReturnType<typeof engine.effectContext>) => void) => {
    const s = JSON.parse(JSON.stringify(state)) as GameState;
    const events: GameEvent[] = [];
    const ctx = engine.effectContext(s, global, events);
    fn(ctx);
    setState(s);
    showEvents(events);
  };

  const rollBattleDice = () => {
    audio.playSe(seUrl(id, 'dice', true));
    setBattle((b) => ({ ...b, rolling: true, dice: rollDice(Math.random, view.dice).values }));
    setTimeout(() => setBattle((b) => ({ ...b, rolling: false })), 450);
  };

  const receive = (i: number) => {
    const eb = battle.enemies[i]!;
    battleAction((ctx) => {
      const r = receiveAttack(ctx, eb.enemy.attack ?? '', eb.func, battle.dice, battle.multiplier);
      reportAttack(r, ctx.state);
    });
  };
  const reportAttack = (r: AttackResult, s: GameState) => {
    const label = (k: string) => statusLabel(scenario, k);
    if (r.kind === 'evaded') {
      audio.playSe(seUrl(id, 'guard', true));
      toast('info', '回避', '回避に成功した。');
    } else if (r.kind === 'stat') {
      audio.playSe(seUrl(id, 'state', true));
      toast('dmg', 'ステータス攻撃', `${label(r.stat)}が${r.amount}低下した！`);
    } else if (r.kind === 'state') {
      if (r.applied) {
        audio.playSe(seUrl(id, 'state', true));
        toast('dmg', '状態異常', `「${STATE_NAMES[r.state] ?? r.state}」を受けた！`);
      }
    } else if (r.kind === 'damage') {
      if (r.hp + r.mp + (r.target.startsWith('free') ? r.damage : 0) === 0) {
        audio.playSe(seUrl(id, 'guard', true));
        toast('info', '被ダメージ', '敵の攻撃を防ぎきった！');
      } else {
        audio.playSe(seUrl(id, 'damage', true));
        const msg =
          r.target === 'hp'
            ? `${label('hp')}に${r.hp}のダメージ！（現在値：${s.chara.hp}）`
            : r.target === 'mp'
              ? `${label('mp')}に${r.mp}のダメージ！（現在値：${s.chara.mp}）`
              : r.target === 'both'
                ? `${label('hp')}/${label('mp')}に${r.hp}/${r.mp}のダメージ！`
                : `${label(r.target)}に${r.damage}のダメージ！`;
        toast('dmg', '被ダメージ', msg);
      }
    }
  };
  const attack = (i: number) => {
    const eb = battle.enemies[i]!;
    battleAction((ctx) => {
      const r = attackEnemy(ctx, eb.enemy, eb.hp ?? 0, battle.dice, battle.multiplier);
      setBattle((b) => ({
        ...b,
        enemies: b.enemies.map((x, k) => (k === i ? { ...x, hp: r.hp } : x)),
      }));
      toast('info', '敵へのダメージ', `${r.damage} Hit!`);
    });
  };
  const takeDrop = (i: number) => {
    const eb = battle.enemies[i]!;
    if (!eb.drop) return;
    audio.playSe(seUrl(id, 'drop', true));
    battleAction((ctx) => applyDrop(ctx, eb.drop!.drop));
    toast('item', '戦利品', `${eb.drop.name}を手に入れた。`);
    setBattle((b) => ({
      ...b,
      enemies: b.enemies.map((x, k) => (k === i ? { ...x, dropTaken: true } : x)),
    }));
  };

  // ───── 選択・戻る・魔法 ─────
  const choose = (index: number, input?: string) => {
    const label = view.choices.find((c) => c.index === index)?.label ?? '';
    const r = engine.choose(state, global, index, input);
    if (r.kind === 'moved') {
      setHistory((h) => [
        ...h.slice(-49),
        { state, entry: { id: String(r.state.scene), label: plainLabel(label) || '（入力）' } },
      ]);
      for (const [next, s] of Object.entries(r.carryOver ?? {})) if (next !== id) saveGame(next, s);
      // 続編が同じシナリオなら、旧エンジンと同じく引き継ぎ用のデータで保存を上書きする（表示はエンディングのまま）
      setState(r.state, r.global, r.carryOver?.[id] ?? r.state);
      showEvents(r.events);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (r.kind === 'back') {
      back();
    } else {
      toast(
        'warn',
        '選択',
        {
          notEnoughStars: '星が不足しているようだ。',
          notAllowed: '指定された番号には移動できないようだ。',
          hidden: 'その選択肢は選べません。',
          missingScene: '移動先のシーンがありません。',
        }[r.reason],
      );
    }
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev || state.isEnded) return;
    setHistory((h) => h.slice(0, -1));
    setState(prev.state);
  };
  const cast = (name: MagicName) => {
    const r = engine.castMagic(state, global, name);
    if (r.events.some((e) => e.type === 'notEnoughStars')) return showEvents(r.events);
    setState(r.state, r.global);
    toast('result', '魔法の行使', `${name} を唱えた。`);
    setSheet(null);
  };
  const consumeItem = (itemId: string) => {
    const r = engine.useItem(state, global, itemId);
    const item = scenario.items.find((i) => i.id === itemId);
    if (r.events.some((e) => e.type === 'itemNotUsable')) {
      toast('warn', `${item?.name ?? itemId}を使った。`, '...しかし、なにも起こらなかった...');
      return;
    }
    setState(r.state, r.global);
    toast('item', `${item?.name ?? itemId}を使った。`, item?.text ?? '');
    showEvents(r.events);
  };
  const onParamChange = useCallback(
    (pid: string, value: string) => setState(engine.setParam(state, pid, value)),
    [engine, state, setState],
  );

  // ───── 数字キーで選ぶ ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      const go = view.choices.filter((c) => c.kind === 'go');
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && go[n - 1]) choose(go[n - 1]!.index);
      if (e.key === 'Backspace' && history.length) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const resolveImage = useCallback((src: string) => imageUrl(id, src), [id]);
  const ruleText =
    view.enemies.length && view.rule ? engine.sceneText(state, global, view.rule) : '';
  const fontSize = FONT_SIZES[settings.fontSize];
  const endLabel =
    view.end === 'happy'
      ? 'Happy End'
      : view.end === 'bad'
        ? 'Bad End'
        : view.end === 'good'
          ? 'Good End'
          : null;

  const shareUrl = shareLink(view.tweet ?? scenario.meta.description ?? DEFAULT_SHARE_TEXT);

  const panelBody = (t: PanelTab) =>
    t === 'magic' ? (
      <MagicPanel state={state} onCast={cast} />
    ) : t === 'items' ? (
      <ItemsPanel scenario={scenario} state={state} onUse={consumeItem} />
    ) : t === 'record' ? (
      <RecordPanel
        scenario={scenario}
        scenarioId={id}
        global={global}
        history={history.map((h) => h.entry)}
        trophyUrl={trophyUrl}
      />
    ) : editing ? (
      <StatusEditor
        scenario={scenario}
        state={state}
        onSave={(s) => {
          setState(s);
          setEditing(false);
          toast('info', 'ステータス', '変更を反映しました。');
        }}
        onCancel={() => setEditing(false)}
      />
    ) : (
      <div>
        <HeroPanel
          scenario={scenario}
          state={state}
          portraitUrl={charaImageUrl(id, scenario.meta.imageSet, state.chara)}
        />
        <label className="section-h" htmlFor="memo" style={{ marginTop: 14 }}>
          <span>冒険メモ</span>
        </label>
        <textarea
          id="memo"
          className="memo"
          placeholder="君は冒険中のメモをここに記録しておいても構わないし、脳裏に留めておいても構わない。"
          value={state.memos}
          onChange={(e) => setState({ ...state, memos: e.target.value })}
        />
        <button
          type="button"
          className="chip-btn"
          style={{ marginTop: 10 }}
          onClick={() => setEditing(true)}
        >
          ステータスを編集
        </button>
      </div>
    );

  return (
    <div className="play">
      <Parchment as="article" seed={7} style={{ ['--book-size' as string]: fontSize }}>
        <header className="page-head">
          <span className="title">
            {scenario.meta.title}
            {history.length > 0 && !state.isEnded && (
              <button
                type="button"
                className="mini-btn"
                style={{ marginLeft: 10 }}
                onClick={back}
                title="直前の節に戻る（Backspace）"
              >
                ← 戻る
              </button>
            )}
          </span>
          <span className="para">
            <small>{endLabel ?? (scenario.meta.showSummary ? '' : '節')}</small>
            {scenario.meta.showSummary && view.summary ? view.summary : view.id}
          </span>
        </header>
        <SceneText
          className="prose"
          markdown={view.markdown}
          resolveImage={resolveImage}
          onParamChange={onParamChange}
        />
        {battle.enemies.length > 0 && (
          <>
            {ruleText && (
              <details className="rule-box">
                <summary>この戦闘のルール</summary>
                <SceneText className="prose" markdown={ruleText} resolveImage={resolveImage} />
              </details>
            )}
            <div className="battle-controls" style={{ marginBottom: 12 }}>
              <div
                className="dice"
                onClick={rollBattleDice}
                role="button"
                tabIndex={0}
                title="ダイスを振る"
                onKeyDown={(e) => e.key === 'Enter' && rollBattleDice()}
              >
                {battle.dice.map((v, i) => (
                  <Die key={i} value={v} rolling={battle.rolling} first={i === 0} />
                ))}
              </div>
              <button type="button" className="btn" onClick={rollBattleDice}>
                ダイスを振る
              </button>
              <label className="verdict">
                ダメージ倍率{' '}
                <select
                  value={battle.multiplier}
                  onChange={(e) => setBattle({ ...battle, multiplier: Number(e.target.value) })}
                >
                  <option value={2}>×2</option>
                  <option value={1}>×1</option>
                  <option value={0.5}>×1/2</option>
                  <option value={0.25}>×1/4</option>
                </select>
              </label>
            </div>
            {battle.enemies.map((eb, i) => (
              <EnemyCard
                key={i}
                enemy={eb.enemy}
                func={eb.func}
                funcDisplayOnly={eb.displayOnly}
                {...(eb.hp !== undefined ? { hp: eb.hp } : {})}
                {...(eb.drop ? { dropName: eb.drop.name } : {})}
                dropTaken={eb.dropTaken}
                onReceive={() => receive(i)}
                onAttack={() => attack(i)}
                onDrop={() => takeDrop(i)}
                defeatedChecked={eb.defeated}
                {...(battle.enemies.length > 1
                  ? {
                      onToggleDefeated: (checked: boolean) =>
                        setBattle((b) => ({
                          ...b,
                          enemies: b.enemies.map((x, k) =>
                            k === i ? { ...x, defeated: checked } : x,
                          ),
                        })),
                    }
                  : {})}
                {...(eb.enemy.attack?.startsWith('free')
                  ? { attackLabel: statusLabel(scenario, eb.enemy.attack) }
                  : {})}
              />
            ))}
          </>
        )}
        <div className="rule" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="M10 1 12.4 7.6 19 10 12.4 12.4 10 19 7.6 12.4 1 10 7.6 7.6z" />
          </svg>
        </div>
        <ChoiceList choices={view.choices} onChoose={choose} />
        {view.afterText && (
          <SceneText
            className="prose after-text"
            markdown={view.afterText}
            resolveImage={resolveImage}
          />
        )}
        <div className="end-actions" style={{ marginTop: 16 }}>
          <a
            className="chip-btn share-link"
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            𝕏 でポスト
          </a>
        </div>
        {view.end && (
          <div className="end-actions">
            <a className="btn" href={href({ name: 'create', id })}>
              {view.end === 'bad' ? '最初から冒険に挑戦する' : 'もう一度冒険する'}
            </a>
            <a className="btn ghost" href={href({ name: 'library' })}>
              ペンタウァに帰還する
            </a>
          </div>
        )}
      </Parchment>

      <aside className="panel" aria-label="冒険者パネル">
        <div className="tabs" role="tablist">
          {PANEL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.ja}
            </button>
          ))}
        </div>
        <div className="card">{panelBody(tab)}</div>
        <div className="readset">
          <span>文字</span>
          <span className="seg">
            {(['small', 'medium', 'large'] as const).map((k, i) => (
              <button
                key={k}
                type="button"
                aria-pressed={settings.fontSize === k}
                onClick={() => onSettings({ ...settings, fontSize: k })}
              >
                {['小', '中', '大'][i]}
              </button>
            ))}
          </span>
          <span>· 数字キーで選択、Backspace で戻る</span>
        </div>
      </aside>

      <nav className="mtabs" aria-label="冒険者メニュー">
        {PANEL_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setSheet(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            {t.id === 'hero' ? <b>HP {state.chara.hp}</b> : <span>{t.ja}</span>}
          </button>
        ))}
      </nav>
      {sheet && (
        <div>
          <div className="sheet-backdrop" onClick={() => setSheet(null)} />
          <div
            className="sheet"
            role="dialog"
            aria-label={PANEL_TABS.find((t) => t.id === sheet)!.ja}
          >
            <div className="grab" />
            <div className="tabs" role="tablist" style={{ marginBottom: 14 }}>
              {PANEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={sheet === t.id}
                  onClick={() => setSheet(t.id)}
                >
                  {t.ja}
                </button>
              ))}
            </div>
            {panelBody(sheet)}
          </div>
        </div>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}

function plainLabel(markdown: string) {
  return markdown.replace(/<rt>.*?<\/rt>|<rp>.*?<\/rp>|<[^>]+>|[*_]/g, '');
}

const DEFAULT_SHARE_TEXT =
  '原作30周年記念企画「SORCERIAN Text」ユーザー参加型のゲームブック版ソーサリアン';

/** X（旧 Twitter）の投稿画面へのリンク（旧エンジンのツイートボタンと同じ文・ハッシュタグ・via） */
function shareLink(text: string) {
  const params = new URLSearchParams({
    text,
    url: location.href.split('#')[0] ?? '',
    hashtags: 'falcom,stext',
    via: 'snext1220',
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
