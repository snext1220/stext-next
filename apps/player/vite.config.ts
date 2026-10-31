import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { workspaceAliases } from '../../workspace-aliases.js';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAliases },
  base: './',
});
