import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { deploymentConfig } from './deployment-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.argv[2];
try {
  const config = deploymentConfig(mode, loadEnv(mode, root, 'VITE_'));
  const result = spawnSync('corepack', ['pnpm', 'exec', 'tsc', '-b'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  const build = spawnSync('corepack', ['pnpm', 'exec', 'vite', 'build', '--mode', mode], {
    cwd: root, stdio: 'inherit', env: { ...process.env, ...config },
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
  const prerender = spawnSync('node', ['scripts/prerender.mjs'], { cwd: root, stdio: 'inherit' });
  if (prerender.error) throw prerender.error;
  process.exit(prerender.status ?? 1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
