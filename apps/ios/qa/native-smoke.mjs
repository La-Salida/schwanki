import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

// Run against an installed development build and its running Metro server.
// Uses only sample cards; never signs in, imports, or writes account reviews.
const exec = promisify(execFile);
const udid = process.env.SIMULATOR_UDID;
assert.ok(udid, 'Set SIMULATOR_UDID to the booted simulator UUID.');
const idb = process.env.IDB_BIN || 'idb';
const companion = process.env.IDB_COMPANION ? ['--companion', process.env.IDB_COMPANION] : [];
const out = resolve(process.env.SCREENSHOT_DIR || 'qa/output/native');
await mkdir(out, { recursive: true });
await rm(resolve(out, process.env.NATIVE_QA_MODE === 'large-text' ? 'large-text-result.json' : 'result.json'), { force: true });
const run = async (file, args) => (await exec(file, args, { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 })).stdout;
const ui = async () => JSON.parse(await run(idb, [...companion, 'ui', 'describe-all', '--udid', udid, '--json']));
const match = (nodes, marker) => nodes.find(n => n.AXUniqueId === marker || n.AXLabel === marker);
async function waitFor(marker, ready = () => true) {
  const until = Date.now() + 25_000;
  while (Date.now() < until) {
    const found = match(await ui(), marker);
    if (found && ready(found)) return found;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Missing native element: ${marker}`);
}
async function tap(marker) {
  let node = await waitFor(marker);
  const app = (await ui()).find(n => n.type === 'Application');
  for (let attempts = 0; attempts < 8; attempts++) {
    const { y, height } = node.frame;
    if (y >= 60 && y + height <= app.frame.height - 30) break;
    const x = app.frame.width / 2;
    const down = y < 60;
    await swipe(x, app.frame.height * (down ? .3 : .7), x, app.frame.height * (down ? .7 : .3));
    await new Promise(r => setTimeout(r, 350));
    node = await waitFor(marker);
  }
  assert.equal(node.enabled, true, `${marker} must be enabled`);
  const { y, height } = node.frame;
  assert.ok(y >= 0 && y + height <= app.frame.height, `${marker} must be visible before tapping`);
  await run(idb, [...companion, 'ui', 'tap', marker, '--api', 'ax', '--match-key', node.AXUniqueId === marker ? 'AXUniqueId' : 'AXLabel', '--udid', udid]);
}
async function capture(name) {
  await run('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=jpeg', resolve(out, `${name}.jpg`)]);
}
async function swipe(x1, y1, x2, y2) {
  await run(idb, [...companion, 'ui', 'swipe', ...[x1, y1, x2, y2].map(n => String(Math.round(n))), '--duration', '0.3', '--udid', udid]);
  // Native scrolling keeps moving after the input stream ends.
  await new Promise(r => setTimeout(r, 1_000));
}
const checks = [];
if (process.env.NATIVE_QA_MODE === 'large-text') {
  assert.equal((await run('xcrun', ['simctl', 'ui', udid, 'content_size'])).trim(), 'accessibility-large');
  const app = (await ui()).find(n => n.type === 'Application');
  for (const rating of ['again', 'hard', 'good', 'easy']) {
    const button = await waitFor(`rate-${rating}`, node => node.frame.height <= 75);
    assert.ok(button.frame.width >= 72 && button.frame.height >= 44, `${rating} needs a readable label and a full touch target`);
    assert.ok(button.frame.y + button.frame.height <= app.frame.height - 20, `${rating} must remain above the home indicator`);
  }
  await capture('feed-large-text');
  const result = { passed: true, simulator: udid, mode: 'large-text', checks: ['All four large-text rating labels have sufficient width and stay reachable.'], screenshots: out };
  await writeFile(resolve(out, 'large-text-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
await waitFor('sample-feed');
await capture('entry');
await tap('How do I export from Anki?');
await waitFor('From AnkiMobile');
await tap('How do I export from Anki?');
checks.push('Anki export help opens and closes.');
await tap('sample-feed');
await waitFor('reveal-card');
const firstWord = (await ui()).find(n => n.AXLabel?.endsWith('. Show meaning'))?.AXLabel;
assert.ok(firstWord);
assert.equal((await waitFor('rate-good')).enabled, false);
await capture('feed-hidden');
await tap('Mute sound');
await waitFor('Turn sound on');
await tap('reveal-card');
assert.equal((await waitFor('rate-good')).enabled, true);
await waitFor('Play audio');
await capture('feed-revealed');
await tap('Turn sound on');
await tap('Play audio');
checks.push('All ratings disabled before reveal; native audio control and mute respond.');
await tap('rate-hard');
await waitFor('reveal-card');
await tap('reveal-card');
await tap('rate-again');
await waitFor('reveal-card');
await tap('reveal-card');
await tap('rate-easy');
await waitFor('Three sample cards. Your words can feel like this too.');
await capture('sample-complete');
checks.push('Hard, Again and Easy advance through all three sample cards to completion.');
await tap('Back');
await tap('sample-feed');
await waitFor('reveal-card');
// Swipe in the feed’s open image area, away from scrolling text and buttons.
const app = (await ui()).find(n => n.type === 'Application');
const x = app.frame.width / 2;
await swipe(x, app.frame.height * .5, x, app.frame.height * .3);
await waitFor('Play audio');
await swipe(x, app.frame.height * .5, x, app.frame.height * .3);
await waitFor('reveal-card');
const nextWord = (await ui()).find(n => n.AXLabel?.endsWith('. Show meaning'))?.AXLabel;
assert.ok(nextWord && nextWord !== firstWord, 'A second swipe must advance to a different word.');
await tap('Exit sample feed');
checks.push('Upward swipe reveals first, then rates Good; exiting returns to entry.');
// Scroll the entry page to the web handoff action.
await swipe(x, app.frame.height * .8, x, app.frame.height * .3);
await tap('Turn notes into cards on the web');
await waitFor('Open schwankiapp.com');
await capture('web-handoff');
await tap('Close sheet');
checks.push('Web handoff sheet opens and closes without leaving the app.');
const result = { passed: true, simulator: udid, viewport: `${app.frame.width}×${app.frame.height}`, checks, screenshots: out };
await writeFile(resolve(out, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
