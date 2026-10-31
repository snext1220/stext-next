import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { workspaceAliases } from '../../workspace-aliases.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
};

/**
 * 開発サーバーで scenarios/ と assets/ を配信する。
 * 公開サイトでは Playground は /playground/ に置かれ、../scenarios/ と ../assets/ を使う
 */
function repoDirs(): Plugin {
  return {
    name: 'stext-repo-dirs',
    configureServer(server) {
      for (const name of ['scenarios', 'assets']) {
        const dir = join(repoRoot, name);
        server.middlewares.use(`/${name}`, (req, res, next) => {
          const path = normalize(join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]!)));
          if (!path.startsWith(dir) || !existsSync(path) || !statSync(path).isFile()) return next();
          res.setHeader(
            'Content-Type',
            TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
          );
          createReadStream(path).pipe(res);
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), repoDirs()],
  resolve: { alias: workspaceAliases },
  base: './',
  // 本体は React・React Flow・zod・Markdown の描画・変換器で約 800 kB
  build: { chunkSizeWarningLimit: 1000, assetsDir: '_app' },
  server: { port: 5174 },
});
