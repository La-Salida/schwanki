import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig } from './deployment-config.mjs';

const jwt = role => `fixture.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`;
const env = { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_ANON_KEY: jwt('anon') };
test('deployment refuses a local backend and missing browser credentials', () => {
  for (const url of ['http://127.0.0.1:54321', 'https://localhost', 'https://[::1]']) {
    assert.throws(() => deploymentConfig('production', { ...env, VITE_SUPABASE_URL: url }), /hosted HTTPS/);
  }
  assert.throws(() => deploymentConfig('staging', { ...env, VITE_SUPABASE_ANON_KEY: '' }), /needs a Supabase/);
});
test('service-role and secret API keys cannot enter deployment bundles', () => {
  for (const key of [jwt('service_role'), 'sb_secret_fixture', 'malformed-key']) {
    assert.throws(() => deploymentConfig('production', { ...env, VITE_SUPABASE_ANON_KEY: key }));
  }
});
test('both targets accept hosted endpoints and browser-safe keys', () => {
  for (const mode of ['staging', 'production']) {
    for (const key of [jwt('anon'), 'sb_publishable_fixture']) {
      const result = deploymentConfig(mode, { ...env, VITE_SUPABASE_ANON_KEY: key });
      assert.equal(result.VITE_SUPABASE_URL, env.VITE_SUPABASE_URL);
      assert.equal(result.VITE_SUPABASE_ANON_KEY, key);
      assert.equal(result.VITE_EXTENSION_IDS, '');
    }
  }
});
