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
import {
  ENGINE_VERSION,
  STATE_NAMES,
  createEngine,
  emptyGlobalState,
  seededRandom,
  type GameEvent,
  type GameState,
  type SceneView,
} from '@stext/core';
import { SCENARIO_FORMAT, checkScenario, validateScenario, type CheckIssue } from '@stext/schema';

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  /** 入力を一行読む（入力が終われば null）。stext play で使う */
  ask?: (prompt: string) => Promise<string | null>;
}

const USAGE = `使い方: stext <command> [options]

コマンド:
  convert <scenario.xml|playground.json> [-o <out.json>] [--id <id>] [--structure-conditions]
      旧形式のシナリオを ${SCENARIO_FORMAT} に変換する（-o がなければ標準出力）
  convert-all <旧リポジトリの stext ディレクトリ> -o <出力ディレクトリ> [--structure-conditions]
      <id>/scenario.xml をすべて変換し、<出力>/<id>/scenario.json、index.json、REPORT.md を書き出す
  validate <scenario.json>...
      シナリオをスキーマと整合性の両面で検査する
  play <scenario.json> [--auto <手数>] [--seed <数値>]
      シナリオをコマンドラインで遊ぶ。--auto は選択肢を自動で選んで進める（s で状態、q で終了）

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
        return await play(rest, io);
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

// ───── play ─────

async function play(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(args, {
    auto: { type: 'string' },
    seed: { type: 'string' },
  });
  const [file] = positionals;
  if (!file || positionals.length > 1)
    throw new UsageError('遊ぶシナリオ JSON を一つ指定してください。');
  const auto = values.auto !== undefined ? Number(values.auto) : undefined;
  if (auto === undefined && !io.ask)
    throw new UsageError('対話できない環境では --auto を指定してください。');
  const v = validateScenario(JSON.parse(await readFile(file, 'utf8')));
  if (!v.ok) {
    printIssues(
      v.issues.map((i) => ({ severity: 'error', ...i })),
      io,
      file,
    );
    return 1;
  }
  const seed = values.seed !== undefined ? Number(values.seed) : undefined;
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  const chooser = seededRandom((seed ?? Date.now()) + 1);

  const engine = createEngine(v.scenario, { random });
  let { state, global, events } = engine.start(emptyGlobalState());
  const c = state.chara;
  io.out(`${v.scenario.meta.title}（${v.scenario.meta.author ?? '作者不明'}）`);
  io.out(
    `「${c.title}」${c.name}（${c.race} / ${c.sex} / ${c.age} / ${c.job}）として冒険を始めます。`,
  );
  printEvents(events, io);

  for (let turn = 0; auto === undefined || turn < auto; turn++) {
    const view = engine.view(state, global);
    printScene(view, io);
    if (view.end) {
      io.out(view.end === 'bad' ? '― BAD END ―' : '― THE END ―');
      return 0;
    }
    if (view.choices.length === 0) {
      io.out('（選択肢がありません）');
      return 0;
    }
    let index: number;
    let input: string | undefined;
    if (auto !== undefined) {
      const choice = view.choices[Math.floor(chooser() * view.choices.length)]!;
      if (choice.kind !== 'go') {
        io.out('（番号入力・文字入力の選択肢は自動では選べないため、終了します）');
        return 0;
      }
      index = choice.index;
      io.out(`> ${plain(choice.label)}`);
    } else {
      const answer = await askChoice(view, state, io);
      if (answer === null) return 0;
      ({ index, input } = answer);
    }
    const r = engine.choose(state, global, index, input);
    if (r.kind === 'moved') {
      ({ state, global, events } = r);
      if (r.carryOver)
        io.out(`（続編 ${Object.keys(r.carryOver).join('、')} に引き継ぐデータができました）`);
      printEvents(events, io);
    } else if (r.kind === 'back') {
      io.out('（戻る操作はコマンドラインでは使えません）');
    } else {
      io.out(
        {
          notEnoughStars: '星が不足しているようだ。',
          notAllowed: '指定された番号には移動できないようだ。',
          hidden: 'その選択肢は選べません。',
          missingScene: '移動先のシーンがありません。',
        }[r.reason],
      );
    }
  }
  return 0;
}

async function askChoice(
  view: SceneView,
  state: GameState,
  io: Io,
): Promise<{ index: number; input?: string } | null> {
  for (;;) {
    const line = await io.ask!('番号を選んでください（s: 状態、q: 終了）> ');
    if (line === null || line.trim() === 'q') return null;
    if (line.trim() === 's') {
      printStatus(state, io);
      continue;
    }
    const choice = view.choices[Number(line.trim()) - 1];
    if (!choice) continue;
    if (choice.kind === 'jump') {
      const to = await io.ask!('移動する番号 > ');
      if (to === null) return null;
      return { index: choice.index, input: to.trim() };
    }
    if (choice.kind === 'answer') {
      const answer = await io.ask!('答え > ');
      if (answer === null) return null;
      return { index: choice.index, input: answer.trim() };
    }
    return { index: choice.index };
  }
}

function printScene(view: SceneView, io: Io) {
  io.out('');
  io.out(`── §${view.id}${view.summary ? ` ${view.summary}` : ''} ──`);
  io.out(plain(view.markdown).trim());
  for (const e of view.enemies) io.out(`【敵】${e.name}${e.func ? `（${e.func}）` : ''}`);
  view.choices.forEach((c, i) => {
    if (c.before) io.out(plain(c.before));
    const label =
      c.kind === 'jump'
        ? '（番号を入力して移動）'
        : c.kind === 'answer'
          ? '（答えを入力）'
          : plain(c.label);
    io.out(`  ${i + 1}. ${label}`);
  });
  if (view.afterText) io.out(plain(view.afterText));
}

function printStatus(state: GameState, io: Io) {
  const c = state.chara;
  io.out(
    `HP ${c.hp}/${c.hp_m}  MP ${c.mp}/${c.mp_m}  STR ${c.str} INT ${c.int} DEX ${c.dex} KRM ${c.krm}  状態 ${STATE_NAMES[c.state] ?? c.state}`,
  );
  io.out(
    `星 ${state.stars.join(' ')}  アイテム ${state.items.join(',') || 'なし'}  フラグ ${state.flags.length}`,
  );
}

function printEvents(events: GameEvent[], io: Io) {
  for (const e of events) {
    if (e.type === 'itemGained') io.out(`【アイテム入手】${e.id}`);
    else if (e.type === 'resultUnlocked') io.out(`【実績獲得】${e.id}`);
    else if (e.type === 'bonusAwarded') io.out(`【ボーナス】${e.id}`);
    else if (e.type === 'stateGuarded') io.out(`【ボーナス】${e.state}を防いだ`);
  }
}

/** 端末向けに HTML を簡単に取り除く（ルビは「漢字（かな）」にする） */
function plain(markdown: string) {
  return markdown
    .replace(/<rt>(.*?)<\/rt>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ');
}
