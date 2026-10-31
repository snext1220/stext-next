import { defineConfig } from 'vitest/config';
import { workspaceAliases } from './workspace-aliases.js';

export default defineConfig({
  resolve: { alias: workspaceAliases },
  // apps/player の vite.config.ts が決める値（テストでは固定）
  define: { __DEFAULT_ASSET_BASE__: JSON.stringify('/assets/') },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
