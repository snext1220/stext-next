import {
  CONDITION_FUNCTIONS,
  MAGIC_NAMES,
  parseCondition,
  type Choice,
  type Effects,
  type Scenario,
  type Scene,
} from '@stext/schema';
import { useState } from 'react';
import { Field, SelectField, TextArea, TextField, fromList, toList, toValue } from './fields.js';
import { HelpButton } from './help/HelpPanel.js';
import { moveChoice, removeChoice, updateChoice, updateScene, renameScene } from './model.js';

/** 本文に差し込むマクロ（旧 Playground の「カーソル位置にタグを追加」に当たる） */
const TEXT_TOOLBAR = [
  {
    label: '条件',
    title: '条件を満たすときだけ表示：${if 条件}…${/if}',
    before: '${if f01}',
    after: '${/if}',
  },
  {
    label: '読込',
    title: '別のシーンの本文を読み込む：${import シーンID}',
    before: '${import 99}',
  },
  { label: '名前', title: 'キャラクターの名前：${name}', before: '${name}' },
  {
    label: '種族別',
    title: '種族で文を変える：${race?ファイター:ウィザード:ドワーフ:エルフ}',
    before: '${race?ファイター:ウィザード:ドワーフ:エルフ}',
  },
  { label: '変数', title: 'アイテムなどの名前：${var?i01:name}', before: '${var?i01:name}' },
  {
    label: '赤字',
    title: '文字色：%red%…%/%（blue / red / purple、white は見えない文字）',
    before: '%red%',
    after: '%/%',
  },
  {
    label: '伏せ字',
    title: 'タップで表示する伏せ字：%secret%…%/%',
    before: '%secret%',
    after: '%/%',
  },
  { label: 'ルビ', title: 'ルビ：${漢字|かんじ}', before: '${', after: '|かな}' },
  {
    label: '演出',
    title: '文字ごとの演出：${effect fadeInDown}…${/effect}',
    before: '${effect fadeInDown}',
    after: '${/effect}',
  },
  {
    label: '共有文',
    title: 'X で共有する文：${tweet}…${/tweet}',
    before: '${tweet}',
    after: '${/tweet}',
  },
  { label: '入力欄', title: 'パラメーターの入力欄：${input?p01}', before: '${input?p01}' },
  {
    label: '画像',
    title: '挿絵：![説明](ファイル名)。画像は scenarios/<シナリオID>/capture/',
    before: '![',
    after: '](image.png)',
  },
  { label: '太字', title: '太字：**…**', before: '**', after: '**' },
] as const;

const END_OPTIONS = [
  ['', '（なし）'],
  ['happy', 'ハッピーエンド'],
  ['bad', 'バッドエンド'],
  ['good', 'グッドエンド'],
] as const;

const STATE_OPTIONS = [
  ['', '（変えない）'],
  ['poison', '毒にする'],
  ['frozen', '凍結にする'],
  ['stone', '石化にする'],
  ['curse', '呪いにする'],
  ['forget', '忘却にする'],
  ['-poison', '毒を治す'],
  ['-frozen', '凍結を治す'],
  ['-stone', '石化を治す'],
  ['-curse', '呪いを治す'],
  ['-forget', '忘却を治す'],
  ['-all', 'すべて治す'],
] as const;

export interface SceneEditorProps {
  scenario: Scenario;
  scene: Scene;
  onChange: (next: Scenario, mergeKey?: string) => void;
  onRenamed: (id: string) => void;
  onDelete: () => void;
  onAddScene: () => void;
}

export function SceneEditor({
  scenario,
  scene,
  onChange,
  onRenamed,
  onDelete,
  onAddScene,
}: SceneEditorProps) {
  const [newId, setNewId] = useState(scene.id);
  const [renameError, setRenameError] = useState<string | null>(null);
  const set = (patch: Partial<Scene>, key: string) =>
    onChange(updateScene(scenario, scene.id, patch), `${scene.id}:${key}`);
  const setEffects = (patch: Partial<Effects>, key: string) => {
    const effects = Object.fromEntries(
      Object.entries({ ...scene.effects, ...patch }).filter(
        ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
      ),
    );
    set(
      { effects: Object.keys(effects).length ? (effects as Effects) : undefined },
      `effects.${key}`,
    );
  };
  const e = scene.effects ?? {};

  const rename = () => {
    try {
      onChange(renameScene(scenario, scene.id, newId));
      setRenameError(null);
      onRenamed(newId.trim());
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="pg-editor">
      <div className="pg-row">
        <Field label="シーン ID" help="scene.id" hint={renameError}>
          {(id) => (
            <span className="pg-inline">
              <input id={id} value={newId} onChange={(ev) => setNewId(ev.target.value)} />
              <button type="button" onClick={rename} disabled={newId.trim() === scene.id}>
                変更
              </button>
            </span>
          )}
        </Field>
        <TextField
          label="サマリー"
          help="scene.summary"
          value={scene.summary}
          onChange={(v) => set({ summary: v }, 'summary')}
          wide
        />
      </div>

      <TextArea
        label="本文"
        help="scene.text"
        value={scene.text}
        onChange={(v) => set({ text: v }, 'text')}
        toolbar={TEXT_TOOLBAR}
      />

      <section className="pg-section">
        <div className="pg-section-head">
          <h3>選択肢</h3>
          <HelpButton topic="scene.choices" />
          <button
            type="button"
            onClick={() =>
              onChange(
                updateScene(scenario, scene.id, {
                  choices: [...scene.choices, { label: '次へ', to: [scene.id] }],
                }),
              )
            }
          >
            ＋ 選択肢
          </button>
          <button
            type="button"
            onClick={onAddScene}
            title="新しいシーンを作り、そこへの選択肢を加える"
          >
            ＋ 新しいシーンへ
          </button>
        </div>
        {scene.choices.length === 0 && <p className="pg-hint">選択肢がありません。</p>}
        {scene.choices.map((c, i) => (
          <ChoiceEditor
            key={i}
            scenario={scenario}
            choice={c}
            onChange={(next) =>
              onChange(updateChoice(scenario, scene.id, i, next), `${scene.id}:choice${i}`)
            }
            onMove={(d) => onChange(moveChoice(scenario, scene.id, i, d))}
            onRemove={() => onChange(removeChoice(scenario, scene.id, i))}
          />
        ))}
        <TextArea
          label="選択肢の後ろの文章"
          help="scene.afterText"
          value={scene.afterText ?? ''}
          onChange={(v) => set({ afterText: v }, 'afterText')}
          rows={2}
        />
      </section>

      <section className="pg-section">
        <div className="pg-section-head">
          <h3>シーンに入ったときの効果</h3>
          <HelpButton topic="scene.effects" />
        </div>
        <div className="pg-grid">
          <TextField
            label="アイテム"
            help="effects.items"
            value={fromList(e.items)}
            onChange={(v) => setEffects({ items: toList(v) }, 'items')}
            placeholder="i01, -i02, i03:2"
          />
          <TextField
            label="フラグ"
            help="effects.flags"
            value={fromList(e.flags)}
            onChange={(v) => setEffects({ flags: toList(v) }, 'flags')}
            placeholder="f01, -f02"
          />
          <TextField
            label="パラメーター"
            help="effects.params"
            value={fromList(e.params)}
            onChange={(v) => setEffects({ params: toList(v) }, 'params')}
            placeholder="p01:1, p02:@5"
          />
          <TextField
            label="実績"
            help="effects.result"
            value={e.result}
            onChange={(v) => setEffects({ result: v }, 'result')}
            placeholder="r01"
          />
          <TextField
            label="HP"
            help="effects.hp"
            value={e.hp}
            onChange={(v) => setEffects({ hp: toValue(v) as never }, 'hp')}
            placeholder="-5 / -5..-1 / full"
          />
          <TextField
            label="MP"
            help="effects.mp"
            value={e.mp}
            onChange={(v) => setEffects({ mp: toValue(v) as never }, 'mp')}
            placeholder="-5 / full / half"
          />
          {(['str', 'int', 'dex', 'krm'] as const).map((k) => (
            <TextField
              key={k}
              label={k.toUpperCase()}
              help={`effects.${k}`}
              value={e[k]}
              onChange={(v) => setEffects({ [k]: toValue(v) }, k)}
              placeholder="1 / @5 / full"
            />
          ))}
          {(['free1', 'free2', 'free3'] as const).map((k) => (
            <TextField
              key={k}
              label={k.toUpperCase()}
              help={`effects.${k}`}
              value={e[k]}
              onChange={(v) => setEffects({ [k]: toValue(v) }, k)}
              placeholder="1 / @5 / -3..-1"
            />
          ))}
          <TextField
            label="星"
            help="effects.stars"
            value={Array.isArray(e.stars) ? e.stars.join(', ') : e.stars}
            onChange={(v) =>
              setEffects(
                {
                  stars: v.trim().startsWith('div')
                    ? v.trim()
                    : v.trim() === ''
                      ? undefined
                      : toList(v).map(Number),
                },
                'stars',
              )
            }
            placeholder="月,火,水,木,金,土,太 / div2"
          />
          <SelectField
            label="状態異常"
            help="effects.state"
            value={e.state}
            options={STATE_OPTIONS}
            onChange={(v) => setEffects({ state: v }, 'state')}
          />
        </div>
      </section>

      <section className="pg-section">
        <h3>そのほか</h3>
        <div className="pg-grid">
          <TextField
            label="敵"
            help="scene.enemies"
            value={fromList(scene.enemies)}
            onChange={(v) => set({ enemies: toList(v).length ? toList(v) : undefined }, 'enemies')}
            placeholder="m01, m02"
            hint={
              scenario.enemies.length
                ? `定義済み：${scenario.enemies.map((m) => m.id).join(', ')}`
                : '敵は「定義」の「敵」で作ります'
            }
          />
          <SelectField
            label="エンディング"
            help="scene.end"
            value={scene.end}
            options={END_OPTIONS}
            onChange={(v) => set({ end: (v || undefined) as Scene['end'] }, 'end')}
          />
          <TextField
            label="続編（シナリオ ID）"
            help="scene.nexts"
            value={fromList(scene.nexts)}
            onChange={(v) => set({ nexts: toList(v).length ? toList(v) : undefined }, 'nexts')}
          />
          <TextField
            label="BGM"
            help="scene.bgm"
            value={scene.bgm}
            onChange={(v) => set({ bgm: v === '' ? undefined : v }, 'bgm')}
            placeholder="@field05"
          />
          <TextField
            label="効果音"
            help="scene.se"
            value={scene.se}
            onChange={(v) => set({ se: v }, 'se')}
          />
          <TextField
            label="戦闘ルールのシーン"
            help="scene.rule"
            value={scene.rule}
            onChange={(v) => set({ rule: v }, 'rule')}
          />
          <TextField
            label="ダイス"
            help="scene.dice"
            value={scene.dice}
            onChange={(v) => set({ dice: v }, 'dice')}
            placeholder="6:2（6面を2個）"
          />
          <TextField
            label="フロー図の色"
            help="scene.editor.color"
            value={scene.editor?.color}
            onChange={(v) =>
              set(
                { editor: { ...scene.editor, color: v || undefined } as Scene['editor'] },
                'color',
              )
            }
            placeholder="#c0473a"
          />
          <Field label="共通フッター" help="scene.excludeFooter">
            {(id) => (
              <label className="pg-check">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(scene.excludeFooter)}
                  onChange={(ev) =>
                    set({ excludeFooter: ev.target.checked || undefined }, 'excludeFooter')
                  }
                />
                このシーンには付けない
              </label>
            )}
          </Field>
        </div>
      </section>

      <div className="pg-danger">
        <button
          type="button"
          onClick={onDelete}
          disabled={scene.id === '0'}
          title={scene.id === '0' ? 'シーン 0 は冒険の始まりなので消せません' : undefined}
        >
          このシーンを削除
        </button>
      </div>
    </div>
  );
}

type Kind = 'go' | 'random' | 'jump' | 'answer';

function kindOf(c: Choice): Kind {
  if ('kind' in c) return c.kind;
  return c.to.length > 1 ? 'random' : 'go';
}

function ChoiceEditor({
  scenario,
  choice,
  onChange,
  onMove,
  onRemove,
}: {
  scenario: Scenario;
  choice: Choice;
  onChange: (c: Choice) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const kind = kindOf(choice);
  const sceneIds = scenario.scenes.map((s) => s.id);
  const setKind = (k: Kind) => {
    const target =
      'kind' in choice ? (choice.kind === 'jump' ? choice.allow[0] : choice.to) : choice.to[0];
    const t = target ?? sceneIds[0] ?? '0';
    if (k === 'jump') onChange({ kind: 'jump', allow: [t] });
    else if (k === 'answer') onChange({ kind: 'answer', answer: '', to: t, else: t });
    else
      onChange({
        label: 'label' in choice ? choice.label : '次へ',
        to: k === 'random' ? [t, t] : [t],
      });
  };

  return (
    <div className="pg-choice">
      <div className="pg-choice-head">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          aria-label="選択肢の種類"
        >
          <option value="go">通常</option>
          <option value="random">ランダム</option>
          <option value="jump">番号入力</option>
          <option value="answer">文字入力</option>
        </select>
        <HelpButton topic="choice.kind" />
        <span className="pg-spacer" />
        <button type="button" onClick={() => onMove(-1)} aria-label="上へ">
          ↑
        </button>
        <button type="button" onClick={() => onMove(1)} aria-label="下へ">
          ↓
        </button>
        <button type="button" onClick={onRemove} aria-label="この選択肢を削除">
          ✕
        </button>
      </div>
      {'kind' in choice && choice.kind === 'jump' ? (
        <TextField
          label="移動できる番号"
          help="choice.jump"
          value={fromList(choice.allow)}
          onChange={(v) => onChange({ ...choice, allow: toList(v) })}
          wide
        />
      ) : 'kind' in choice && choice.kind === 'answer' ? (
        <div className="pg-grid">
          <TextField
            label="正解"
            help="choice.answer"
            value={choice.answer}
            onChange={(v) => onChange({ ...choice, answer: v })}
          />
          <TextField
            label="正解のとき"
            help="choice.answer"
            value={choice.to}
            onChange={(v) => onChange({ ...choice, to: v })}
          />
          <TextField
            label="不正解のとき"
            help="choice.answer"
            value={choice.else}
            onChange={(v) => onChange({ ...choice, else: v })}
          />
        </div>
      ) : (
        <>
          <div className="pg-grid">
            <TextField
              label="文言"
              help="choice.label"
              value={choice.label}
              onChange={(v) => onChange({ ...choice, label: v })}
              wide
            />
            <TextField
              label={kind === 'random' ? '遷移先（ランダム）' : '遷移先'}
              help="choice.to"
              value={fromList(choice.to)}
              onChange={(v) => onChange({ ...choice, to: toList(v).length ? toList(v) : [''] })}
            />
            {kind === 'random' && (
              <TextField
                label="結果を保持する日数"
                help="choice.randomCacheDays"
                value={choice.randomCacheDays}
                onChange={(v) =>
                  onChange({
                    ...choice,
                    randomCacheDays: Number(v) > 0 ? Number(v) : undefined,
                  } as Choice)
                }
              />
            )}
          </div>
          <ConditionField
            scenario={scenario}
            value={
              typeof choice.if === 'string' ? choice.if : choice.if ? JSON.stringify(choice.if) : ''
            }
            onChange={(v) => onChange({ ...choice, if: v === '' ? undefined : v } as Choice)}
          />
          <TextField
            label="選んだときに唱える魔法（星を消費）"
            help="choice.cast"
            value={fromList(choice.cast)}
            onChange={(v) =>
              onChange({ ...choice, cast: (toList(v).length ? toList(v) : undefined) as never })
            }
            placeholder="HEAL"
            wide
          />
        </>
      )}
      <TextField
        label="選択肢の前に出す文章"
        help="choice.before"
        value={choice.before}
        onChange={(v) => onChange({ ...choice, before: v || undefined } as Choice)}
        wide
      />
    </div>
  );
}

/** 差し込み候補の表示名。「名前（説明）」の形にする */
function describe(name: string, text: string | undefined): string {
  const t = text?.replace(/\s+/g, ' ').trim();
  if (!t) return name;
  return `${name}（${t.length > 30 ? `${t.slice(0, 30)}…` : t}）`;
}

/** 表示条件の入力欄。旧 Playground の条件ビルダーのように、項目を選んで差し込める */
function ConditionField({
  scenario,
  value,
  onChange,
}: {
  scenario: Scenario;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed =
    value.trim() === ''
      ? null
      : value.trim().startsWith('{')
        ? { ok: true as const }
        : parseCondition(value, {
            flags: scenario.flags.map((f) => f.id),
            items: scenario.items.map((i) => i.id),
          });
  const add = (token: string) => {
    if (!token) return;
    const v = value.trim();
    onChange(v === '' || /[&|!(]$/.test(v) ? v + token : `${v}&${token}`);
  };
  const groups: [string, (string | [token: string, label: string])[]][] = [
    ['フラグ', scenario.flags.map((f) => [f.id, describe(f.id, f.text)])],
    ['アイテム', scenario.items.map((i) => [i.id, describe(i.name || i.id, i.text)])],
    ['パラメーター', scenario.params.map((p) => [`${p.id}:@0`, describe(p.id, p.text)])],
    ['魔法', MAGIC_NAMES.map((m) => `m${m}`)],
    ['ステータス', ['oHP10', 'oMP10', 'oSTR5', 'oINT5', 'oDEX5', 'oKRM5', 'oFREEI1']],
    [
      '基本情報',
      [
        'xFIGHTER',
        'xWIZARD',
        'xDWARF',
        'xELF',
        'xMALE',
        'xFEMALE',
        'xYOUNG',
        'xADULT',
        'xOLD',
        'xPOISON',
      ],
    ],
    [
      '関数',
      CONDITION_FUNCTIONS.map(
        (f) =>
          ({
            rand: 'fn:rand(50)',
            include: 'fn:include(2,f01,f02)',
            range: 'fn:range(str,5,10)',
            cycle: 'fn:cycle(30,10,1)',
          })[f],
      ),
    ],
  ];
  return (
    <Field
      label="表示条件"
      help="choice.if"
      wide
      hint={
        parsed === null ? undefined : parsed.ok ? (
          <span className="pg-ok">✓ 条件として読めます</span>
        ) : (
          <span className="pg-error">{parsed.error}</span>
        )
      }
    >
      {(id) => (
        <>
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="f01&!i01"
            spellCheck={false}
          />
          <div className="pg-toolbar">
            {['&', '|', '!', '('].map((op) => (
              <button key={op} type="button" onClick={() => onChange(value + op)}>
                {op}
              </button>
            ))}
            <button type="button" onClick={() => onChange(value + ')')}>
              )
            </button>
            {groups.map(([label, tokens]) => (
              <select
                key={label}
                value=""
                onChange={(e) => add(e.target.value)}
                aria-label={`${label}を差し込む`}
                disabled={tokens.length === 0}
              >
                <option value="">{label}…</option>
                {tokens.map((t) => {
                  const [token, text] = typeof t === 'string' ? [t, t] : t;
                  return (
                    <option key={token} value={token} title={token}>
                      {text}
                    </option>
                  );
                })}
              </select>
            ))}
          </div>
        </>
      )}
    </Field>
  );
}
