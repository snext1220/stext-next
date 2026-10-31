/**
 * ワークスペース内の @stext/* を、ビルド済みの dist ではなく src に向ける別名。
 * Vite（開発サーバー）と Vitest で共有し、ビルドせずに変更を反映させる。
 */
import { fileURLToPath } from 'node:url';

const pkg = (name: string, entry = 'index.ts') =>
  fileURLToPath(new URL(`./packages/${name}/src/${entry}`, import.meta.url));

export const workspaceAliases = {
  '@stext/schema': pkg('schema'),
  '@stext/core': pkg('core'),
  '@stext/convert': pkg('convert'),
  '@stext/cli': pkg('cli'),
  '@stext/ui': pkg('ui'),
};
