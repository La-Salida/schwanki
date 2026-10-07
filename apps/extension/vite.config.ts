import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const web = new URL(env.VITE_WEB_ORIGIN ?? 'http://localhost:5173').origin;
  const api = new URL(env.VITE_API_ORIGIN ?? 'http://127.0.0.1:54321').origin;
  return {
    plugins: [{ name: 'manifest', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify({
        manifest_version: 3, name: 'Schwanki recorded classes (development)', version: '0.1.0',
        minimum_chrome_version: '116',
        permissions: ['activeTab','tabCapture','offscreen','storage','sidePanel','alarms'],
        host_permissions: [`${api}/*`], externally_connectable: { matches: [`${web}/*`] },
        background: { service_worker: 'background.js', type: 'module' },
        action: { default_title: 'Record class with Schwanki' },
        side_panel: { default_path: 'panel.html' },
        content_security_policy: { extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' ${api}` },
      }, null, 2) });
    } }],
    build: { outDir: mode==='spike'?'spike-dist':'dist', rollupOptions: { input: {
      background: resolve('src/background/sw.ts'), panel: resolve('panel.html'),
      offscreen: resolve('offscreen.html'), preflight: resolve('preflight.html'),
      ...(mode==='spike'?{benchmark:resolve('benchmark.html'),export:resolve('export.html')}:{}),
    }, output: { entryFileNames: '[name].js' } } },
  };
});
