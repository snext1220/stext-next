import { defineConfig } from 'vitest/config';
import { workspaceAliases } from './workspace-aliases.js';

export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
