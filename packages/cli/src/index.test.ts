import { describe, expect, it } from 'vitest';
import { run } from './index.js';

function capture(argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('stext', () => {
  it('prints usage with no arguments', () => {
    const r = capture([]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('使い方: stext');
  });

  it('prints the version', () => {
    const r = capture(['--version']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^stext \d+\.\d+\.\d+ \(stext\/2\)$/);
  });

  it('reports planned commands as not implemented yet', () => {
    const r = capture(['convert', 'scenario.xml']);
    expect(r.code).toBe(1);
    expect(r.err).toContain('Phase 2');
  });

  it('rejects unknown commands', () => {
    const r = capture(['fly']);
    expect(r.code).toBe(2);
    expect(r.err).toContain('不明なコマンドです: fly');
  });
});
