/**
 * 編集フォームの小さな部品と、入力文字列と値の変換。
 */
import { useId, useRef, type ReactNode } from 'react';
import { HelpButton, useHelp } from './help/HelpPanel.js';

/** カンマ区切りの文字列 ⇔ 配列 */
export const toList = (v: string): string[] =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');
export const fromList = (v: readonly string[] | undefined): string => (v ?? []).join(', ');

/** 整数なら数値、それ以外は文字列のまま（"full"、"-5..-1"、"@3" など）。空なら undefined */
export function toValue(v: string): number | string | undefined {
  const t = v.trim();
  if (t === '') return undefined;
  return /^[+-]?\d+$/.test(t) ? Number(t) : t;
}

/** 入力欄の共通の引数。help はヘルプのキー（help/reference.md） */
interface Common {
  label: string;
  help?: string;
}

/** help の指定を、undefined を渡さずに引き継ぐ（exactOptionalPropertyTypes のため） */
const helpOf = (help: string | undefined) => (help !== undefined ? { help } : {});

export function Field({
  label,
  help,
  hint,
  children,
  wide,
}: Common & {
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const openHelp = useHelp();
  return (
    <div className={`pg-field${wide ? ' wide' : ''}`}>
      <div className="pg-label">
        <label htmlFor={id} {...(help && openHelp ? { onDoubleClick: () => openHelp(help) } : {})}>
          {label}
        </label>
        {help && <HelpButton topic={help} />}
      </div>
      {children(id)}
      {hint && <div className="pg-hint">{hint}</div>}
    </div>
  );
}

export function TextField({
  label,
  help,
  value,
  onChange,
  placeholder,
  hint,
  wide,
}: Common & {
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Field
      label={label}
      {...helpOf(help)}
      {...(hint !== undefined ? { hint } : {})}
      {...(wide ? { wide } : {})}
    >
      {(id) => (
        <input
          id={id}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  help,
  value,
  options,
  onChange,
}: Common & {
  value: string | undefined;
  options: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} {...helpOf(help)}>
      {(id) => (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** カーソル位置に文字列を差し込める複数行の入力欄 */
export function TextArea({
  label,
  help,
  value,
  onChange,
  toolbar,
  rows = 12,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  /** 差し込む文字列の候補（before…after でカーソル位置・選択範囲を挟む） */
  toolbar?: readonly { label: string; title: string; before: string; after?: string }[];
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (before: string, after = '') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const next = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = a + before.length;
      el.selectionEnd = b + before.length;
    });
  };
  return (
    <Field label={label} {...helpOf(help)} wide>
      {(id) => (
        <>
          {toolbar && (
            <div className="pg-toolbar" role="toolbar" aria-label={`${label}に差し込む`}>
              {toolbar.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  title={t.title}
                  onClick={() => insert(t.before, t.after)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            id={id}
            ref={ref}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </>
      )}
    </Field>
  );
}
