import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './index.js';

async function capture(argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const XML = `<?xml version="1.0" encoding="utf-8"?>
<scenario title="テスト" author="Rio">
<init></init><items></items><flags><flag id="f01">a</flag></flags><enemies></enemies><results></results>
<scene id="0">はじまり
[次へ](1 "f01")</scene>
<scene id="1" end="happy">おわり</scene>
</scenario>`;

function legacyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'stext-'));
  mkdirSync(join(dir, 'demo'));
  writeFileSync(join(dir, 'demo', 'scenario.xml'), XML);
  writeFileSync(
    join(dir, 'stext.xml'),
    '<stext><scenario><work id="demo" title="デモ" author="Rio" tags="短編, テスト" level="2" /></scenario></stext>',
  );
  return dir;
}

describe('stext', () => {
  it('prints usage with no arguments', async () => {
    const r = await capture([]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('使い方: stext');
  });

  it('prints the version', async () => {
    const r = await capture(['--version']);
    expect(r.out).toMatch(/^stext \d+\.\d+\.\d+ \(stext\/2\)$/);
  });

  it('rejects unknown commands and options', async () => {
    expect((await capture(['fly'])).code).toBe(2);
    expect((await capture(['convert', 'a.xml', '--nope'])).code).toBe(2);
  });

  it('converts a scenario.xml to JSON', async () => {
    const dir = legacyRepo();
    const out = join(dir, 'out.json');
    const r = await capture([
      'convert',
      join(dir, 'demo', 'scenario.xml'),
      '-o',
      out,
      '--structure-conditions',
    ]);
    expect(r.code).toBe(0);
    const json = JSON.parse(readFileSync(out, 'utf8'));
    expect(json.meta.id).toBe('demo');
    expect(json.scenes[0].choices[0].if).toEqual({ flag: 'f01' });
  });

  it('converts a whole legacy repository with an index and a report', async () => {
    const dir = legacyRepo();
    const out = join(dir, 'scenarios');
    const r = await capture(['convert-all', dir, '-o', out]);
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))).toEqual([
      {
        id: 'demo',
        title: 'デモ',
        author: 'Rio',
        listed: true,
        tags: ['短編', 'テスト'],
        level: 2,
        scenes: 2,
      },
    ]);
    expect(readFileSync(join(out, 'REPORT.md'), 'utf8')).toContain('| demo | 2 | 1 | 1 | 0 | 0 |');
  });

  it('validates scenario JSON and fails on errors', async () => {
    const dir = legacyRepo();
    const good = join(dir, 'good.json');
    await capture(['convert', join(dir, 'demo', 'scenario.xml'), '-o', good]);
    expect((await capture(['validate', good])).code).toBe(0);

    const bad = join(dir, 'bad.json');
    const json = JSON.parse(readFileSync(good, 'utf8'));
    json.scenes[0].choices[0].to = ['404'];
    writeFileSync(bad, JSON.stringify(json));
    const r = await capture(['validate', bad]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('遷移先のシーン「404」がありません');
  });

  it('plays a scenario automatically', async () => {
    const dir = legacyRepo();
    const json = join(dir, 'demo.json');
    await capture(['convert', join(dir, 'demo', 'scenario.xml'), '-o', json]);
    // 条件 f01 を満たさないので選択肢がなく、そこで終わる
    const r = await capture(['play', json, '--auto', '5', '--seed', '1']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('── §0 ──');
    expect(r.out).toContain('（選択肢がありません）');
  });

  it('plays a scenario interactively', async () => {
    const dir = legacyRepo();
    const json = join(dir, 'demo.json');
    const data = JSON.parse((await capture(['convert', join(dir, 'demo', 'scenario.xml')])).out);
    data.scenes[0].choices[0].if = undefined;
    writeFileSync(json, JSON.stringify(data));
    const answers = ['s', '9', '1'];
    const out: string[] = [];
    const code = await run(['play', json, '--seed', '1'], {
      out: (l) => out.push(l),
      err: () => {},
      ask: async () => answers.shift() ?? null,
    });
    expect(code).toBe(0);
    const text = out.join('\n');
    expect(text).toContain('  1. 次へ');
    expect(text).toMatch(/HP \d+\/\d+/);
    expect(text).toContain('── §1 ──');
    expect(text).toContain('― THE END ―');
  });

  it('asks for --auto when it cannot read input', async () => {
    const r = await capture(['play', 'x.json']);
    expect(r.code).toBe(2);
  });
});
