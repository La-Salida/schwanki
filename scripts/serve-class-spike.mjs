import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../docs/fixtures/classroom-spike.html', import.meta.url));
createServer((req, res) => {
  if (req.url !== '/') { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}).listen(4179, '127.0.0.1', () => console.log('Synthetic classroom: http://127.0.0.1:4179 (no speech or microphone capture on this page)'));
