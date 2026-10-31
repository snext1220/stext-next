/**
 * @stext/cli — `stext` コマンド。
 *
 * 引数と出力先を受け取って終了コードを返す。process への依存は bin.ts だけに置く。
 */
import { ENGINE_VERSION } from '@stext/core';
import { SCENARIO_FORMAT } from '@stext/schema';

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** 未実装のコマンドと、実装予定のフェーズ */
const PLANNED: Record<string, string> = {
  convert: 'Phase 2',
  validate: 'Phase 2',
  play: 'Phase 3',
};

const USAGE = `使い方: stext <command> [options]

コマンド:
  convert <scenario.xml>   旧形式のシナリオを ${SCENARIO_FORMAT} に変換する（${PLANNED.convert}）
  validate <scenario.json> シナリオを検証する（${PLANNED.validate}）
  play <scenario.json>     シナリオをコマンドラインで遊ぶ（${PLANNED.play}）

オプション:
  -v, --version            バージョンを表示する
  -h, --help               この説明を表示する`;

export function run(argv: readonly string[], io: Io): number {
  const [command] = argv;
  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    io.out(USAGE);
    return 0;
  }
  if (command === '-v' || command === '--version') {
    io.out(`stext ${ENGINE_VERSION} (${SCENARIO_FORMAT})`);
    return 0;
  }
  const phase = PLANNED[command];
  if (phase) {
    io.err(`stext ${command} はまだ実装されていません（${phase} で実装予定）。`);
    return 1;
  }
  io.err(`不明なコマンドです: ${command}\n\n${USAGE}`);
  return 2;
}
