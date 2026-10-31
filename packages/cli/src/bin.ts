#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { run } from './index.js';

const rl = process.stdin.isTTY
  ? createInterface({ input: process.stdin, output: process.stdout })
  : undefined;

process.exitCode = await run(process.argv.slice(2), {
  out: (line) => process.stdout.write(line + '\n'),
  err: (line) => process.stderr.write(line + '\n'),
  ...(rl
    ? {
        ask: async (prompt: string) => {
          try {
            return await rl.question(prompt);
          } catch {
            return null;
          }
        },
      }
    : {}),
});
rl?.close();
