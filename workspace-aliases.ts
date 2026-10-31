/**
 * ワークスペース内の @stext/* を、ビルド済みの dist ではなく src に向ける別名。
 * Vite（開発サーバー）と Vitest で共有し、ビルドせずに変更を反映させる。
 */
import { fileURLToPath } from 'node:url';

const src = (name: string, entry = 'index.ts') =>
  fileURLToPath(new URL(`./packages/${name}/src/${entry}`, import.meta.url));

export const workspaceAliases = [
  { find: /^@stext\/ui\/styles\.css$/, replacement: src('ui', 'styles.css') },
  ...['schema', 'core', 'convert', 'cli', 'ui'].map((name) => ({
    find: new RegExp(`^@stext/${name}$`),
    replacement: src(name),
  })),
];
