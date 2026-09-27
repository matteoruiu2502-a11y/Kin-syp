import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Le cœur de mesure (TypeScript pur) est partagé avec l'application mobile.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@core': fileURLToPath(new URL('../mobile/src/core', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  build: {
    // Un seul bundle JS : plus simple à héberger (y compris comme page claude.ai).
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
});
