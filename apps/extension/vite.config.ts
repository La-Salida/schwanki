import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [{
    name: 'mv3-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: readFileSync('manifest.json', 'utf8') });
    },
  }],
  build: {
    rollupOptions: {
      input: { panel: 'panel.html', permission: 'permission.html', offscreen: 'offscreen.html', background: 'src/background.ts' },
      output: { entryFileNames: '[name].js' },
    },
  },
});
