import { useId, useLayoutEffect, useState } from 'react';
import { ParamInput, type useSceneInputs } from './SceneText.js';

export function useSceneInputFocus() {
  const prefix = useId();
  const [request, setRequest] = useState<{ index: number } | null>(null);
  useLayoutEffect(() => {
    if (!request) return;
    const field = document.getElementById(`${prefix}-${request.index}`);
    field?.focus({ preventScroll: true });
    const scroller = field?.closest('.scene-action-scroll');
    if (!field || !scroller) return;
    const inset = scroller.querySelector('.battle-dice')?.getBoundingClientRect().height ?? 0;
    const top = field.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (top < inset || top + field.offsetHeight > scroller.clientHeight) {
      scroller.scrollTop += top - inset - 8;
    }
  }, [prefix, request]);
  return { prefix, focusInput: (index: number) => setRequest({ index }) };
}

export function SceneActionInputs({
  inputs,
  prefix,
  onParamChange,
}: {
  inputs: ReturnType<typeof useSceneInputs>;
  prefix: string;
  onParamChange: (id: string, value: string) => void;
}) {
  const memoCount = inputs.filter(({ param }) => !param).length;
  let memoNumber = 0;
  const occurrences = new Map<string, number>();
  return (
    <div className="scene-action-inputs">
      {inputs.map(({ param, value }, i) => {
        const label = param
          ? `パラメーター ${param}`
          : `シーン内メモ${memoCount > 1 ? ` ${++memoNumber}` : ''}`;
        const identity = param ? `param:${param}` : `memo:${value}`;
        const occurrence = (occurrences.get(identity) ?? 0) + 1;
        occurrences.set(identity, occurrence);
        const id = `${prefix}-${i}`;
        return (
          <div key={`${identity}:${occurrence}`}>
            <label htmlFor={id}>{label}</label>
            <ParamInput
              id={id}
              label={label}
              param={param}
              value={value}
              onChange={onParamChange}
            />
          </div>
        );
      })}
    </div>
  );
}
