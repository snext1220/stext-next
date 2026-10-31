import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { workspaceAliases } from '../../workspace-aliases.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const scenariosDir = join(repoRoot, 'scenarios');
/** 旧リポジトリ（snext1220/stext）の素材。../stext に clone してあれば開発サーバーで使う */
const legacyAssets = join(repoRoot, '..', 'stext', 'stext');

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

/** scenarios/ を開発サーバーで配信し、ビルド結果にも含める */
function scenarios(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stext-scenarios',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer: serveDir('/scenarios', scenariosDir),
    closeBundle() {
      cpSync(scenariosDir, join(outDir, 'scenarios'), { recursive: true });
    },
  };
}

function legacy(): Plugin {
  return { name: 'stext-legacy-assets', configureServer: serveDir('/legacy-assets', legacyAssets) };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), scenarios(), legacy()],
  resolve: { alias: workspaceAliases },
  base: './',
  // 本体は React・zod（シナリオの検証）・Markdown の描画で約 500 kB（gzip で約 160 kB）。変換所は別に読み込む
  build: { chunkSizeWarningLimit: 600 },
  define: {
    // 画像・BGM の配信元。開発時に ../stext があればそれを使う
    __DEFAULT_ASSET_BASE__: JSON.stringify(
      command === 'serve' && existsSync(legacyAssets)
        ? '/legacy-assets/'
        : 'https://snext1220.github.io/stext/stext/',
    ),
  },
}));
