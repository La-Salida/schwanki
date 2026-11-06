// Renders the overlay stickers and the end card for one vocab reel from a JSON spec.
// Usage: node render.mjs specs/<id>.json [outDir]   (default outDir: out/<id>)
// See README.md for the spec format and the full Sume production recipe.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// CommonJS require so a globally installed playwright (NODE_PATH) also resolves.
const { chromium } = createRequire(import.meta.url)('playwright');
const specPath = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(specPath)) {
  console.error('usage: node render.mjs specs/<id>.json [outDir]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const id = spec.id || path.basename(specPath, '.json');
const out = path.resolve(process.argv[3] || path.join(HERE, 'out', id));
fs.mkdirSync(out, { recursive: true });

const FS = (pkg, w) => `<link rel="stylesheet" href="file://${HERE}/node_modules/@fontsource/${pkg}/${w}.css">`;
const CJK = { ZH: 'Noto Sans SC', JA: 'Noto Sans JP', KO: 'Noto Sans KR' };
const lang = (spec.lang || '').slice(0, 2).toUpperCase();
const cjk = CJK[lang] || 'Noto Sans JP';
const fontLinks = ['archivo', 'noto-sans-jp', 'noto-sans-kr', 'noto-sans-sc']
  .flatMap((p) => (p === 'archivo' ? ['600', '800'] : ['800', '900']).map((w) => FS(p, w)))
  .join('');
const isCJK = (s) => /[぀-ヿ㐀-鿿가-힯]/.test(s || '');

const css = `
html,body{margin:0;background:transparent;width:1080px;height:1920px;overflow:hidden}
.frame{position:relative;width:1080px;height:1920px}
.slot{position:absolute;left:0;right:0;display:flex;justify-content:center}
.st{background:#fff;border:6px solid #14213D;border-radius:30px;box-shadow:8px 10px 0 #14213D;color:#14213D;padding:22px 40px;text-align:center;
 background-image:repeating-linear-gradient(#fff 0 58px,#E6ECF7 58px 61px);max-width:900px}
.en{font-family:Archivo,'${cjk}';font-weight:800;font-size:56px;line-height:1.15}
.nat{font-family:Archivo,'${cjk}';font-weight:800;font-size:88px;line-height:1.12}
.nat.cjk{font-family:'${cjk}';font-weight:900;font-size:104px;line-height:1.2}
.hl{background:linear-gradient(transparent 22%,#F5D90A 22% 88%,transparent 88%);padding:0 6px;border-radius:6px}
.rd{font-family:Archivo,'${cjk}';font-weight:600;font-size:44px;color:#2346B8;margin-top:2px}
.tr{font-family:Archivo,'${cjk}';font-weight:800;font-size:50px;margin-top:6px}
.sm{font-family:Archivo;font-weight:600;font-size:36px;color:#5a6785;margin-top:14px;letter-spacing:.5px}
`;

const box = (top, rot, inner, pad = '') =>
  `<div class="slot" style="top:${top}px"><div class="st" style="transform:rotate(${rot}deg);${pad}">${inner}</div></div>`;
const nat = (s, size) =>
  `<div class="nat${isCJK(s) ? ' cjk' : ''}"${size ? ` style="font-size:${size}px"` : ''}>${s}</div>`;

const el = {
  // Hook / scene label at the top of the frame.
  top: (e) => box(e.top ?? 130, e.rot ?? -2, `<div class="en">${e.text}</div>`),
  // Subtitle: native line, optional romanization, English translation.
  sub: (e) =>
    box(e.top ?? 1330, e.rot ?? 2,
      nat(e.native, e.size) + (e.roman ? `<div class="rd">${e.roman}</div>` : '') + (e.en ? `<div class="tr">${e.en}</div>` : '')),
  // Payoff card: big word, romanization, then lines like "says X" / "means Y".
  payoff: (e) =>
    box(e.top ?? 1150, e.rot ?? -2,
      nat(`<span class="hl">${e.native}</span>`, e.size ?? (isCJK(e.native) ? 150 : 120)) +
        (e.roman ? `<div class="rd">${e.roman}</div>` : '') +
        (e.lines || []).map((l) => `<div class="tr">${l}</div>`).join('') +
        (e.small ? `<div class="sm">${e.small}</div>` : ''),
      'padding:30px 48px'),
  html: (e) => e.html,
};

async function renderStickers(page) {
  for (const [name, elements] of Object.entries(spec.stickers || {})) {
    const body = elements.map((e) => el[e.type](e)).join('');
    const f = path.join(out, `${name}.html`);
    fs.writeFileSync(f, `<html><head><meta charset="utf-8">${fontLinks}<style>${css}</style></head><body><div class="frame">${body}</div></body></html>`);
    await page.goto('file://' + f);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${name}.png`), omitBackground: true });
    fs.unlinkSync(f);
    console.log('sticker', name);
  }
}

async function renderEndcard(page) {
  const e = spec.endcard;
  if (!e) return;
  const img = path.resolve(path.dirname(specPath), e.image);
  const esc = (s) => String(s ?? '');
  let html = fs.readFileSync(path.join(HERE, 'endcard/endcard.html'), 'utf8')
    .replaceAll('{{FONTS}}', fontLinks)
    .replaceAll('{{CJK}}', cjk)
    .replaceAll('{{BASE}}', 'file://' + path.join(HERE, 'endcard') + '/')
    .replaceAll('{{IMG}}', 'file://' + img)
    .replaceAll('{{IMGPOS}}', e.imagePosition || 'center 30%')
    .replaceAll('{{PILL}}', esc(e.pill))
    .replaceAll('{{WORD}}', esc(e.word))
    .replaceAll('{{WORDSIZE}}', String(e.wordSize || (isCJK(e.word) ? 104 : 96)))
    .replaceAll('{{MEAN}}', esc(e.mean))
    .replaceAll('{{SENT}}', esc(e.sent))
    .replaceAll('{{TR}}', esc(e.tr));
  const f = path.join(out, 'endcard.html');
  fs.writeFileSync(f, html);
  const frames = path.join(out, 'endframes');
  fs.mkdirSync(frames, { recursive: true });
  await page.goto('file://' + f);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const N = 75; // 3.125 s at 24 fps, matches the shared end card audio (~3.12 s)
  for (let i = 0; i < N; i++) {
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), (i * 1000) / 24);
    await page.screenshot({ path: path.join(frames, String(i).padStart(3, '0') + '.png') });
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', path.join(frames, '%03d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', path.join(out, 'endcard.mp4')]);
  fs.copyFileSync(path.join(frames, '074.png'), path.join(out, 'endcard-last.png'));
  fs.rmSync(frames, { recursive: true });
  fs.unlinkSync(f);
  console.log('endcard.mp4');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
if (!process.env.SKIP_STICKERS) await renderStickers(page);
if (!process.env.SKIP_ENDCARD) await renderEndcard(page);
await browser.close();
console.log('done ->', out);
