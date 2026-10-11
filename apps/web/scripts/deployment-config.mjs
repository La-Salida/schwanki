export function deploymentConfig(mode, env) {
  if (!['staging', 'production'].includes(mode)) throw new Error('Choose staging or production.');
  let url;
  try { url = new URL(env.VITE_SUPABASE_URL); }
  catch { throw new Error('Deployment needs VITE_SUPABASE_URL.'); }
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Deployment needs a hosted HTTPS Supabase URL, not the local backend.');
  }
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error('Deployment needs a Supabase anon or publishable key.');
  if (key.startsWith('sb_secret_')) throw new Error('A Supabase secret key must never enter the browser bundle.');
  if (!key.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role; }
    catch { throw new Error('Expected a Supabase anon JWT or publishable key.'); }
    if (role !== 'anon') throw new Error('Only a Supabase anon or publishable key belongs in the browser bundle.');
  }
  return {
    VITE_SUPABASE_URL: url.origin,
    VITE_SUPABASE_ANON_KEY: key,
    VITE_EXTENSION_IDS: env.VITE_EXTENSION_IDS ?? '',
    VITE_VAPID_PUBLIC_KEY: env.VITE_VAPID_PUBLIC_KEY ?? '',
  };
}
