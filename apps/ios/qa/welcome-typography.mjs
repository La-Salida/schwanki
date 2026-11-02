import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run against real simulator screenshots, not mocked Text styles. A split or
// truncated word fails even if the accessible label still contains its full text.
const screenshots = process.argv.slice(2);
assert.ok(screenshots.length, 'Pass native welcome screenshot paths.');
const recognizer = fileURLToPath(new URL('./recognize-text.swift', import.meta.url));
for (const screenshot of screenshots) {
  const lines = JSON.parse(execFileSync('swift', [recognizer, screenshot], { encoding: 'utf8' }));
  assert.ok(lines.some(line => line === 'Doomscroll'), `${screenshot}: Doomscroll must render intact on one line. OCR: ${JSON.stringify(lines)}`);
  assert.ok(lines.some(line => line === 'your vocab.'), `${screenshot}: the second headline line must remain intact.`);
  console.log(`PASS ${screenshot}: both headline lines render intact.`);
}
