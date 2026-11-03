import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

// Real Supabase client + SQLite + library queue, with every backend request mocked.
// Export with EXPO_NO_DOTENV=1 and serve via qa/serve-preview.py. No real account writes.
const out = resolve('qa/output/creation-e2e');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const userId = '10000000-0000-4000-8000-000000000001';
const sourceId = '20000000-0000-4000-8000-000000000001';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const sources = [], cards = [], states = [], unexpected = [];
let candidates = [], candidateReads = 0;
const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'signature'].join('.');
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('sb-not-configured-auth-token', JSON.stringify({ access_token: token, refresh_token: 'qa-only', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { user, token });
  await page.route('https://**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== 'not-configured.supabase.co') { unexpected.push(request.url()); return route.abort(); }
    const path = url.pathname, method = request.method();
    let data = [], status = 200;
    if (path === '/auth/v1/user') data = user;
    else if (path === '/rest/v1/sources') {
      if (method === 'POST') { const body = request.postDataJSON(); const row = { ...body, id: sourceId, status: 'active', created_at: new Date().toISOString() }; sources.push(row); data = row; }
      else data = request.headers().accept?.includes('object') ? sources[0] : sources;
    } else if (path === '/rest/v1/cards') {
      if (method === 'POST') {
        const input = request.postDataJSON();
        data = (Array.isArray(input) ? input : [input]).map((row, i) => ({ ...row, id: `30000000-0000-4000-8000-${String(cards.length + i + 1).padStart(12, '0')}`, created_at: new Date().toISOString() }));
        cards.push(...data);
        if (!Array.isArray(input) && request.headers().accept?.includes('object')) data = data[0];
      } else if (url.searchParams.get('select') === 'front') data = cards.map(({ front }) => ({ front }));
      else data = []; // no cards missing a scheduling row
    } else if (path === '/rest/v1/card_state') {
      if (method === 'POST') { const body = request.postDataJSON(); states.push(...(Array.isArray(body) ? body : [body])); status = 201; data = null; }
      else data = states.map(state => ({ ...state, cards: cards.find(card => card.id === state.card_id) }));
    } else if (path === '/rest/v1/candidate_cards') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (method === 'PATCH') {
        const candidate = candidates.find(row => row.id === id);
        Object.assign(candidate, request.postDataJSON()); data = { id };
      } else if (id) data = candidates.find(row => row.id === id);
      else { candidateReads++; data = candidates.filter(row => row.status === 'pending'); }
    } else if (['/rest/v1/review_events', '/rest/v1/card_media'].includes(path)) data = [];
    else if (path === '/rest/v1/rpc/source_sync_progress') data = [];
    else { unexpected.push(`${method} ${path}`); return route.abort(); }
    await route.fulfill({ status, json: data, headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' } });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4184', { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => crossOriginIsolated), true);
  await page.getByTestId('import-deck').click();
  await page.getByRole('button', { name: 'Try a starter set', exact: true }).click();
  await page.getByRole('button', { name: 'Thai', exact: true }).click();
  await page.getByRole('button', { name: 'Add 10 words', exact: true }).click();
  await page.getByText('10 words ready.', { exact: true }).waitFor();
  assert.equal(cards.length, 10); assert.equal(states.length, 10); assert.equal(sources.length, 1);
  assert.equal(sources[0].type, 'manual'); assert.equal(sources[0].language, 'th');
  assert.ok(cards.every(card => card.source_id === sourceId && card.user_id === userId && card.language === 'th'));
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await page.getByTestId('reveal-card').waitFor();
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.getByTestId('reveal-card').click();
  await page.getByText('hello', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/starter-in-feed.png` });
  const candidate = { id: '40000000-0000-4000-8000-000000000001', source_id: sourceId, front: 'ใหม่', back: 'new', raw_context: 'new word', status: 'pending', confidence: .5, created_at: new Date().toISOString() };
  candidates = [candidate];
  await page.getByRole('button', { name: 'Choose a deck', exact: true }).click();
  await page.getByRole('button', { name: /Check (?:\d+ )?new words/ }).click();
  const front = page.getByRole('textbox', { name: 'Word or phrase', exact: true });
  const meaning = page.getByRole('textbox', { name: 'Meaning', exact: true });
  await front.waitFor();
  await meaning.fill('my edited meaning');
  const reads = candidateReads;
  candidates.unshift({ ...candidate, id: '40000000-0000-4000-8000-000000000002', front: 'เก่า', back: 'old', confidence: .99 });
  const until = Date.now() + 12_000;
  while (candidateReads <= reads && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(candidateReads > reads, 'The inbox must receive the newly completed parse.');
  assert.equal(await front.inputValue(), 'ใหม่');
  assert.equal(await meaning.inputValue(), 'my edited meaning');
  await page.getByRole('button', { name: 'Add this word', exact: true }).click();
  await page.getByText('1 word added.', { exact: true }).waitFor();
  assert.ok(cards.some(card => card.front === 'ใหม่' && card.back === 'my edited meaning' && card.language === 'th'));
  await page.screenshot({ path: `${out}/inbox-after-approval.png` });
  assert.deepEqual(unexpected, []);
  console.log(JSON.stringify({ passed: true, cards: cards.length, scheduled: states.length, language: 'th', checks: ['Starter saves ten cards and their schedules under the signed-in account.', 'New deck is selected and its first word reaches the real review feed.', 'An arriving higher-confidence parse preserves the active candidate and unsaved edits; approval saves those edits.', 'No extraction or generation calls; no production requests.'], screenshots: out }, null, 2));
} finally { await browser.close(); }
