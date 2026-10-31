import type { Enemy } from '@stext/schema';
import { ELEMENT_NAMES, STATE_NAMES } from '@stext/core';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** ダイスの目。7以上の目は数字で表示する */
export function Die({
  value,
  rolling,
  first,
}: {
  value: number;
  rolling?: boolean;
  first?: boolean;
}) {
  const cls = 'die' + (rolling ? ' rolling' : '') + (first ? ' left' : '');
  if (!PIPS[value]) {
    return (
      <div
        className={cls}
        role="img"
        aria-label={`ダイス ${value}`}
        style={{ display: 'grid', placeItems: 'center', fontWeight: 700 }}
      >
        {value}
      </div>
    );
  }
  return (
    <div className={cls} role="img" aria-label={`ダイス ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[value]!.includes(i) ? 'on' : ''} />
      ))}
    </div>
  );
}

export interface EnemyCardProps {
  enemy: Enemy;
  /** 選ばれたダメージ式・回避式 */
  func?: string;
  /** 説明だけの式（先頭が *） */
  funcDisplayOnly?: boolean;
  /** 敵の現在 HP（HP のない敵は undefined） */
  hp?: number;
  /** 戦利品の表示名 */
  dropName?: string;
  dropTaken?: boolean;
  onReceive?: () => void;
  onAttack?: () => void;
  onDrop?: () => void;
  attackLabel?: string;
}

export function EnemyCard({
  enemy,
  func,
  funcDisplayOnly,
  hp,
  dropName,
  dropTaken,
  onReceive,
  onAttack,
  onDrop,
  attackLabel,
}: EnemyCardProps) {
  const defeated = hp !== undefined && hp <= 0;
  return (
    <section className={'enemy' + (defeated ? ' defeated' : '')} aria-label={`敵：${enemy.name}`}>
      <div className="enemy-top">
        <h3>{enemy.name}</h3>
        <div className="tags">
          <span className="tag">
            属性 <b>{ELEMENT_NAMES[enemy.element ?? ''] ?? '無'}</b>
          </span>
          {enemy.attack && (
            <span className="tag">
              攻撃{' '}
              <b>{attackLabel ?? STATE_NAMES[enemy.attack.replace(/\d+$/, '')] ?? enemy.attack}</b>
            </span>
          )}
          {func && (
            <span className="tag">
              {funcDisplayOnly ? '' : '判定 '}
              <b>{func}</b>
            </span>
          )}
        </div>
      </div>
      {enemy.text && <p className="enemy-desc">{enemy.text}</p>}
      <div className="battle-controls">
        {hp !== undefined && (
          <span className="enemy-hp">
            HP <b>{hp}</b>
          </span>
        )}
        {onReceive && func && !funcDisplayOnly && (
          <button type="button" className="btn" onClick={onReceive}>
            敵の攻撃
          </button>
        )}
        {onAttack && hp !== undefined && enemy.funcOpp && (
          <button type="button" className="btn ghost" onClick={onAttack} disabled={defeated}>
            攻撃する
          </button>
        )}
        {onDrop && dropName && (
          <button type="button" className="btn ghost" onClick={onDrop} disabled={dropTaken}>
            {dropTaken ? `${dropName}（取得済み）` : `戦利品：${dropName}`}
          </button>
        )}
      </div>
    </section>
  );
}
