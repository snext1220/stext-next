/**
 * @stext/cli — `stext` コマンド。
 *
 * 引数と出力先を受け取って終了コードを返す。標準入出力と process への依存は bin.ts だけに置く。
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import {
  convertPlaygroundJson,
  convertScenarioXml,
  readScenarioXml,
  type ConvertOptions,
  type ConvertResult,
} from '@stext/convert';
import { ENGINE_VERSION } from '@stext/core';
import { SCENARIO_FORMAT, checkScenario, validateScenario, type CheckIssue } from '@stext/schema';

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = `使い方: stext <command> [options]

コマンド:
  convert <scenario.xml|playground.json> [-o <out.json>] [--id <id>] [--structure-conditions]
      旧形式のシナリオを ${SCENARIO_FORMAT} に変換する（-o がなければ標準出力）
  convert-all <旧リポジトリの stext ディレクトリ> -o <出力ディレクトリ> [--structure-conditions]
      <id>/scenario.xml をすべて変換し、<出力>/<id>/scenario.json、index.json、REPORT.md を書き出す
  validate <scenario.json>...
      シナリオをスキーマと整合性の両面で検査する
  play <scenario.json>
      シナリオをコマンドラインで遊ぶ（Phase 3 で実装予定）

オプション:
  -v, --version            バージョンを表示する
  -h, --help               この説明を表示する

終了コード: 0 = 問題なし、1 = エラーあり（警告だけなら 0）、2 = 使い方の誤り`;

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    io.out(USAGE);
    return 0;
  }
  if (command === '-v' || command === '--version') {
    io.out(`stext ${ENGINE_VERSION} (${SCENARIO_FORMAT})`);
    return 0;
  }
  try {
    switch (command) {
      case 'convert':
        return await convert(rest, io);
      case 'convert-all':
        return await convertAll(rest, io);
      case 'validate':
        return await validate(rest, io);
      case 'play':
        io.err('stext play はまだ実装されていません（Phase 3 で実装予定）。');
        return 1;
      default:
        io.err(`不明なコマンドです: ${command}\n\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`${e.message}\n\n${USAGE}`);
      return 2;
    }
    io.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

class UsageError extends Error {}

function parse(args: string[], options: ParseArgsOptionsConfig) {
  try {
    return parseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (e) {
    throw new UsageError(e instanceof Error ? e.message : String(e));
  }
}

async function convert(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(args, {
    out: { type: 'string', short: 'o' },
    id: { type: 'string' },
    'structure-conditions': { type: 'boolean' },
  });
  const [input] = positionals;
  if (!input || positionals.length > 1)
    throw new UsageError('変換するファイルを一つ指定してください。');
  const options: ConvertOptions = {
    id: (values.id as string | undefined) ?? defaultId(input),
    structureConditions: Boolean(values['structure-conditions']),
  };
  const result = await convertFile(input, options);
  const json = toJson(result.scenario);
  if (values.out) {
    await writeFile(values.out as string, json);
    io.err(`${input} → ${values.out as string}`);
  } else {
    io.out(json.trimEnd());
  }
  printIssues(result.issues, io, input);
  printStats(result, io);
  return hasErrors(result.issues) ? 1 : 0;
}

async function convertFile(path: string, options: ConvertOptions): Promise<ConvertResult> {
  const source = await readFile(path, 'utf8');
  if (extname(path).toLowerCase() === '.json')
    return convertPlaygroundJson(JSON.parse(source), options);
  return convertScenarioXml(source, options);
}

/** scenario.xml ならディレクトリ名、それ以外はファイル名を ID にする */
function defaultId(path: string) {
  const name = basename(path, extname(path));
  return name === 'scenario' ? basename(dirname(path)) : name;
}

interface IndexEntry {
  id: string;
  title: string;
  author?: string;
  /** 旧リポジトリの公開一覧（stext.xml）に載っているか */
  listed: boolean;
  series?: string;
  tags?: string[];
  published?: string;
  updated?: string;
  level?: number;
  comment?: string;
  scenes: number;
}

async function convertAll(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(args, {
    out: { type: 'string', short: 'o' },
    'structure-conditions': { type: 'boolean' },
  });
  const [source] = positionals;
  const outDir = values.out as string | undefined;
  if (!source || !outDir || positionals.length > 1) {
    throw new UsageError('旧リポジトリの stext ディレクトリと、-o で出力先を指定してください。');
  }
  const catalog = await readCatalog(join(source, 'stext.xml'));
  const ids = (await readdir(source, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && existsSync(join(source, d.name, 'scenario.xml')))
    .map((d) => d.name)
    .sort();
  if (ids.length === 0) throw new Error(`${source} に <id>/scenario.xml が見つかりません`);

  const index: IndexEntry[] = [];
  const reports: { id: string; result: ConvertResult }[] = [];
  for (const id of ids) {
    const result = await convertFile(join(source, id, 'scenario.xml'), {
      id,
      structureConditions: Boolean(values['structure-conditions']),
    });
    await mkdir(join(outDir, id), { recursive: true });
    await writeFile(join(outDir, id, 'scenario.json'), toJson(result.scenario));
    reports.push({ id, result });
    const meta = result.scenario.meta;
    const listed = catalog.get(id);
    const entry: IndexEntry = {
      id,
      title: listed?.['title'] ?? meta.title,
      listed: Boolean(listed),
      scenes: result.stats.scenes,
    };
    const author = listed?.['author'] ?? meta.author;
    if (author) entry.author = author;
    if (listed) {
      for (const k of ['series', 'published', 'updated', 'comment'] as const)
        if (listed[k]) entry[k] = listed[k];
      if (listed['tags'])
        entry.tags = listed['tags']
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      if (listed['level']) entry.level = Number(listed['level']);
    }
    index.push(entry);
    const errors = result.issues.filter((i) => i.severity === 'error').length;
    const warnings = result.issues.length - errors;
    io.err(`${id}: ${result.stats.scenes} シーン、エラー ${errors}、警告 ${warnings}`);
  }
  await writeFile(join(outDir, 'index.json'), toJson(index));
  await writeFile(join(outDir, 'REPORT.md'), report(reports));
  io.err(`${ids.length} 本を ${outDir} に書き出しました（詳細は REPORT.md）`);
  return 0;
}

async function readCatalog(path: string): Promise<Map<string, Record<string, string>>> {
  const catalog = new Map<string, Record<string, string>>();
  if (!existsSync(path)) return catalog;
  // stext.xml の <scenario> 内の <work id=".." title=".." ..> を、scenario.xml の licence と同じ読み方で読む
  const xml = await readFile(path, 'utf8');
  const section = /<scenario>([\s\S]*?)<\/scenario>/.exec(xml)?.[1] ?? '';
  const legacy = readScenarioXml(`<scenario><licence>${section}</licence></scenario>`);
  for (const work of legacy.licence)
    if (work.attrs['id']) catalog.set(work.attrs['id'], work.attrs);
  return catalog;
}

function report(entries: { id: string; result: ConvertResult }[]): string {
  const lines = [
    '# 旧シナリオの変換レポート',
    '',
    '`stext convert-all` が snext1220/stext の scenario.xml を stext/2 に変換した結果です。',
    'エラーは旧エンジンでも正しく動いていなかった箇所（存在しない遷移先、解釈できない条件など）です。元のシナリオで直してから変換し直してください。',
    '',
    '| ID | シーン | 選択肢 | 条件 | エラー | 警告 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  let total = { scenes: 0, choices: 0, conditions: 0, errors: 0, warnings: 0 };
  for (const { id, result } of entries) {
    const errors = result.issues.filter((i) => i.severity === 'error').length;
    const warnings = result.issues.length - errors;
    const s = result.stats;
    lines.push(
      `| ${id} | ${s.scenes} | ${s.choices} | ${s.conditions} | ${errors} | ${warnings} |`,
    );
    total = {
      scenes: total.scenes + s.scenes,
      choices: total.choices + s.choices,
      conditions: total.conditions + s.conditions,
      errors: total.errors + errors,
      warnings: total.warnings + warnings,
    };
  }
  lines.push(
    `| **合計** | ${total.scenes} | ${total.choices} | ${total.conditions} | ${total.errors} | ${total.warnings} |`,
    '',
  );
  for (const { id, result } of entries) {
    if (result.issues.length === 0) continue;
    lines.push(`## ${id}`, '');
    const sorted = [...result.issues].sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
    );
    for (const i of sorted) {
      lines.push(
        `- ${i.severity === 'error' ? '**エラー**' : '警告'} \`${withSceneId(i.path, result)}\` ${i.message}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** scenes[12] のような位置に、シーン ID を添える */
function withSceneId(path: string, result: ConvertResult) {
  return path.replace(/^scenes\[(\d+)\]/, (m, i: string) => {
    const scene = result.scenario.scenes[Number(i)];
    return scene ? `${m}（§${scene.id}）` : m;
  });
}

async function validate(files: string[], io: Io): Promise<number> {
  if (files.length === 0) throw new UsageError('検査するシナリオ JSON を指定してください。');
  let failed = false;
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      io.err(`${file}: 読み込めません: ${e instanceof Error ? e.message : String(e)}`);
      failed = true;
      continue;
    }
    const v = validateScenario(data);
    const issues: CheckIssue[] = v.ok
      ? checkScenario(v.scenario)
      : v.issues.map((i) => ({ severity: 'error', ...i }));
    printIssues(issues, io, file);
    const errors = issues.filter((i) => i.severity === 'error').length;
    io.err(`${file}: エラー ${errors}、警告 ${issues.length - errors}`);
    if (errors > 0) failed = true;
  }
  return failed ? 1 : 0;
}

function printIssues(issues: CheckIssue[], io: Io, file: string) {
  for (const i of issues)
    io.err(`${file}: ${i.severity === 'error' ? 'エラー' : '警告'} ${i.path}: ${i.message}`);
}

function printStats(result: ConvertResult, io: Io) {
  const s = result.stats;
  io.err(
    `シーン ${s.scenes}、選択肢 ${s.choices}、条件 ${s.conditions}（AST に変換 ${s.structuredConditions}）`,
  );
}

function hasErrors(issues: CheckIssue[]) {
  return issues.some((i) => i.severity === 'error');
}

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2) + '\n';
}
