import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { workspaceAliases } from '../../workspace-aliases.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const scenariosDir = join(repoRoot, 'scenarios');
/** 画像・BGM・効果音（旧リポジトリから scripts/import-legacy-assets.mjs で取り込んだもの） */
const assetsDir = join(repoRoot, 'assets');

const TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8',
};

/** 開発サーバーで、リポジトリ内のディレクトリを指定のパスで配信する */
function serveDir(prefix: string, dir: string): Plugin['configureServer'] {
  return (server) => {
    server.middlewares.use(prefix, (req, res, next) => {
      const path = normalize(join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]!)));
      if (!path.startsWith(dir) || !existsSync(path) || !statSync(path).isFile()) return next();
      res.setHeader('Content-Type', TYPES[extname(path)] ?? 'application/octet-stream');
      createReadStream(path).pipe(res);
    });
  };
}

/** リポジトリのディレクトリを開発サーバーで配信し、ビルド結果にも含める（scenarios/、assets/） */
function publish(name: string, dir: string): Plugin {
  let outDir = 'dist';
  return {
    name: `stext-${name}`,
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer: serveDir(`/${name}`, dir),
    closeBundle() {
      if (existsSync(dir)) cpSync(dir, join(outDir, name), { recursive: true });
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), publish('scenarios', scenariosDir), publish('assets', assetsDir)],
  resolve: { alias: workspaceAliases },
  base: './',
  // 本体は React・zod（シナリオの検証）・Markdown の描画で約 500 kB（gzip で約 160 kB）。変換所は別に読み込む
  // ビルドした JS・CSS は _app/ に置き、素材の assets/ と混ざらないようにする
  build: { chunkSizeWarningLimit: 600, assetsDir: '_app' },
}));
