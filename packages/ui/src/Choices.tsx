import type { ChoiceView } from '@stext/core';
import { useState } from 'react';
import { SceneText } from './SceneText.js';

export interface ChoiceListProps {
  choices: ChoiceView[];
  /** input は番号入力・文字入力の値 */
  onChoose: (index: number, input?: string) => void;
}

/** 選択肢。通常の選択肢には 1〜9 の番号を付ける（キーボードの数字キーで選べる） */
export function ChoiceList({ choices, onChoose }: ChoiceListProps) {
  const keys = new Map(choices.filter((c) => c.kind === 'go').map((c, i) => [c.index, i + 1]));
  return (
    <nav className="choices" aria-label="選択肢">
      {choices.map((c) => {
        const before = c.before ? (
          <SceneText className="choice-before" markdown={c.before} />
        ) : null;
        if (c.kind === 'go') {
          const n = keys.get(c.index) ?? 0;
          return (
            <div key={c.index}>
              {before}
              <button
                type="button"
                className="choice"
                data-key={n}
                onClick={() => onChoose(c.index)}
              >
                <span className="key">{n <= 9 ? n : '·'}</span>
                <SceneText inline markdown={c.label} />
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          );
        }
        return (
          <div key={c.index}>
            {before}
            <InputChoice kind={c.kind} onSubmit={(v) => onChoose(c.index, v)} />
          </div>
        );
      })}
    </nav>
  );
}

function InputChoice({
  kind,
  onSubmit,
}: {
  kind: 'jump' | 'answer';
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const id = `choice-input-${kind}`;
  return (
    <form
      className="choice-input"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() !== '') onSubmit(value.trim());
      }}
    >
      <label htmlFor={id}>{kind === 'jump' ? '移動する番号' : '答え'}</label>
      <input
        id={id}
        value={value}
        inputMode={kind === 'jump' ? 'numeric' : 'text'}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      <button type="submit" className="btn">
        {kind === 'jump' ? '移動する' : '回答する'}
      </button>
    </form>
  );
}
