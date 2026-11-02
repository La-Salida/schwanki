import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

// Public values: the Supabase project URL and publishable key are meant to ship in clients.
const PROD = {
  web: 'https://schwankiapp.com',
  api: 'https://oiemotutqshdohmfhtdw.supabase.co',
  key: 'sb_publishable_Eo50gUst1dJARapbl17cjA_3Qz3iTQ7',
};
// Pins `pnpm build:unpacked` to extension ID edebmddcigmjeocbjiamldcjeikhelca so the web app's
// connect page can allow it. The Chrome Web Store assigns its own ID, so `pnpm build` leaves it out.
const UNPACKED_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuyXhqe6u6AIugqy+eRFQCz8HL01kw6WZPjDpdLjLQyAHqSdia5pbmdWYph5grHQ/HeLM4u5OGuFlj/+UGBi9WHk2pWcOcT+W5ZduD7jweBPzoPlwCGwRcXw0aCzLvNpdI9bEvuq7aGzxvC632bg8rg5wvVFJouK9qVTT1VT5Hv2gakZDpXvKnwhRD9yb+M24EPqhUh8dMOH09UiCCPfn+0LX2pENlVVt74W2n7W4rnf3ZO6q0Xlf7oM45jmwfoy5RtJ8BJ3iS/+J5H6XHDiYXxb9Qe3sG+lHKGD6xAXkajDI974aptm2aJYKagLhs4u0ICw2CBoPYqHd242Q0dZb0QIDAQAB';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const spike = mode === 'spike';
  const web = new URL(env.VITE_WEB_ORIGIN ?? (spike ? 'http://localhost:5173' : PROD.web)).origin;
  const api = new URL(env.VITE_API_ORIGIN ?? (spike ? 'http://127.0.0.1:54321' : PROD.api)).origin;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? PROD.key;
  return {
    define: {
      'import.meta.env.VITE_WEB_ORIGIN': JSON.stringify(web),
      'import.meta.env.VITE_API_ORIGIN': JSON.stringify(api),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    },
    plugins: [{ name: 'manifest', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify({
        manifest_version: 3,
        name: spike ? 'Schwanki recorded classes (development)' : 'Schwanki: lesson recorder',
        short_name: 'Schwanki',
        description: 'Record your online language lessons and turn what your tutor taught into Schwanki flashcards.',
        version: '1.0.0',
        minimum_chrome_version: '116',
        ...(mode === 'unpacked' ? { key: UNPACKED_PUBLIC_KEY } : {}),
        icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
        permissions: ['activeTab','tabCapture','offscreen','storage','sidePanel','alarms'],
        host_permissions: [`${api}/*`], externally_connectable: { matches: [`${web}/*`] },
        background: { service_worker: 'background.js', type: 'module' },
        action: { default_title: 'Record this lesson with Schwanki', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
        side_panel: { default_path: 'panel.html' },
        content_security_policy: { extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' ${api}` },
      }, null, 2) });
    } }],
    build: { outDir: spike?'spike-dist':'dist', rollupOptions: { input: {
      background: resolve('src/background/sw.ts'), panel: resolve('panel.html'),
      offscreen: resolve('offscreen.html'), preflight: resolve('preflight.html'),
      ...(spike?{benchmark:resolve('benchmark.html'),export:resolve('export.html')}:{}),
    }, output: { entryFileNames: '[name].js' } } },
  };
});
