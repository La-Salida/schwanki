import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/fixtures/classroom-spike.html', import.meta.url));
const server = createServer((request, response) => {
  if (request.url !== '/') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(html);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4179, '127.0.0.1', () => console.log('Synthetic classroom: http://127.0.0.1:4179 (no microphone capture on this page)'));
