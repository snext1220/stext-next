import { convertPlaygroundJson, convertScenarioXml, type ConvertResult } from '@stext/convert';
import { useMemo, useState } from 'react';
import { registerLocalScenario } from '../data.js';
import { href } from '../router.js';

type Outcome = { result: ConvertResult } | { error: string } | null;

/** 変換所：旧形式（scenario.xml / Playground の JSON）を stext/2 に変換する */
export function Convert() {
  const [name, setName] = useState('');
  const [structure, setStructure] = useState(false);
  const [source, setSource] = useState<{ text: string; json: boolean } | null>(null);

  const outcome = useMemo<Outcome>(() => {
    if (!source) return null;
    try {
      const id = `local-${name.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '') || 'scenario'}`;
      const options = { id, structureConditions: structure };
      return {
        result: source.json
          ? convertPlaygroundJson(JSON.parse(source.text), options)
          : convertScenarioXml(source.text, options),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [source, structure, name]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setName(file.name);
    setSource({ text: await file.text(), json: /\.json$/i.test(file.name) });
  };

  const result = outcome && 'result' in outcome ? outcome.result : null;
  const errors = result?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = result?.issues.filter((i) => i.severity === 'warning') ?? [];
  const playId = result?.scenario.meta.id;

  /** 変換結果を scenario.json として保存する */
  const save = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result.scenario, null, 2) + '\n'], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/\.[^.]+$/, '') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="eyebrow">Converter</div>
      <h1 style={{ fontFamily: 'var(--f-book)', fontSize: 'var(--step-3)', margin: '4px 0 6px' }}>
        変換所
      </h1>
      <p className="lede" style={{ marginBottom: 20 }}>
        旧形式の scenario.xml、または Playground の JSON を stext/2
        に変換します。変換はこの端末の中だけで行い、どこにも送信しません。
      </p>
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        <b>scenario.xml をここにドロップ</b>
        <span style={{ fontSize: 'var(--step--1)' }}>
          または、クリックしてファイルを選ぶ（.xml / Playground の .json）
        </span>
        <input
          id="convert-file"
          type="file"
          accept=".xml,.json"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      <label className="readset" style={{ marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={structure}
          onChange={(e) => setStructure(e.target.checked)}
        />
        条件を条件 AST（構造化した JSON）で出力する
      </label>
      {outcome && 'error' in outcome && (
        <div className="error-box" role="alert">
          変換できませんでした。{outcome.error}
        </div>
      )}
      {result && (
        <>
          <div className="summary-row">
            <div>
              <b>{result.stats.scenes}</b>
              <span>シーン</span>
            </div>
            <div>
              <b>{result.stats.choices}</b>
              <span>選択肢</span>
            </div>
            <div>
              <b>{warnings.length}</b>
              <span>警告</span>
            </div>
            <div>
              <b>{errors.length}</b>
              <span>エラー</span>
            </div>
          </div>
          <div className="end-actions" style={{ marginBottom: 16 }}>
            <button type="button" className="btn" onClick={save}>
              scenario.json を保存
            </button>
            {playId && (
              <a
                className="btn ghost"
                href={href({ name: 'create', id: playId })}
                onClick={() => registerLocalScenario(playId, result.scenario)}
              >
                このシナリオで遊んでみる
              </a>
            )}
          </div>
          <div className="section-h">
            <span>変換レポート</span>
          </div>
          {result.issues.length === 0 ? (
            <p className="empty-state">問題は見つかりませんでした。</p>
          ) : (
            <ul className="report">
              {[...errors, ...warnings].map((i, k) => (
                <li key={k}>
                  <span className={`lv ${i.severity === 'error' ? 'warn' : 'info'}`}>
                    {i.severity === 'error' ? 'エラー' : '警告'}
                  </span>
                  <span>
                    <code>{i.path}</code> {i.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
