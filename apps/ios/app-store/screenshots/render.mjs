import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const font = async (weight, folder) => `@font-face{font-family:Archivo;font-weight:${weight};src:url(data:font/ttf;base64,${(await readFile(new URL(`../../node_modules/@expo-google-fonts/archivo/${folder}/Archivo_${folder}.ttf`, import.meta.url))).toString('base64')})}`;
const data = async path => `data:image/png;base64,${(await readFile(`${root}${path}`)).toString('base64')}`;
const fonts = await font(900, '900Black') + await font(500, '500Medium');
const icon = `data:image/png;base64,${(await readFile(new URL('../../assets/icon.png', import.meta.url))).toString('base64')}`;
const slides = [
  { id: '01-vocab-feed', title: 'Doomscroll<br>your <mark>vocab.</mark>', body: 'Your words. A much better feed.', image: 'feed-revealed.png', theme: 'paper' },
  { id: '02-active-recall', title: 'A little recall.<br><mark>Every scroll.</mark>', body: 'Remember it. Reveal it. Rate it.', image: 'feed-hidden.png', theme: 'blue' },
  { id: '03-bring-your-deck', title: 'Your deck.<br><mark>A better feed.</mark>', body: 'Bring an Anki export from Files.', image: 'entry.png', theme: 'paper' },
  { id: '04-web-companion', title: 'Create there.<br><mark>Review here.</mark>', body: 'Make cards on the web. Review on iPhone.', image: 'web-handoff.png', theme: 'blue' },
];
await mkdir(`${root}iphone-69`, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
const images = [];
try {
  for (const slide of slides) {
    const capture = await data(`raw/${slide.image}`);
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${slide.id}</title><style>
      ${fonts}
      *{box-sizing:border-box}html,body{margin:0;width:1320px;height:2868px;overflow:hidden}body{font-family:Archivo,sans-serif;color:#14213D;background:#fff}
      .artboard{position:relative;width:1320px;height:2868px;overflow:hidden;background:repeating-linear-gradient(to bottom,#fff 0,#fff 87px,#e6ecf7 87px,#e6ecf7 90px)}
      .blue{background:#2346B8;color:#fff}.blue:after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,transparent 0,transparent 87px,#ffffff0d 87px,#ffffff0d 90px)}
      .masthead{position:absolute;top:96px;left:104px;display:flex;align-items:center;gap:24px;font-size:32px;letter-spacing:3px;font-weight:900;z-index:1}.masthead img{width:80px;height:80px;border-radius:20px}
      h1{position:absolute;top:228px;left:104px;right:80px;margin:0;font-size:108px;line-height:1.09;letter-spacing:-5px;font-weight:900;z-index:1}mark{background:#F5D90A;color:#14213D;padding:0 10px;box-decoration-break:clone}
      p{position:absolute;top:506px;left:108px;right:80px;margin:0;font-size:39px;line-height:1.3;font-weight:500;z-index:1;letter-spacing:-.5px}
      .screen{position:absolute;top:652px;left:200px;width:920px;height:2000.398px;border-radius:64px;overflow:hidden;box-shadow:0 0 0 10px #14213D,0 24px 50px #14213d33;z-index:1;background:#14213d}.screen img{display:block;width:920px;height:2000.398px;object-fit:fill}
      .footer{position:absolute;bottom:95px;left:108px;right:108px;display:flex;align-items:center;justify-content:space-between;font-size:28px;font-weight:500;z-index:1}.count{font-size:25px;opacity:.65;letter-spacing:3px}.line{width:100px;height:5px;background:#F5D90A}
    </style><div class="artboard ${slide.theme}"><div class="masthead"><img alt="" src="${icon}">SCHWANKI</div><h1>${slide.title}</h1><p>${slide.body}</p><div class="screen"><img alt="Actual Schwanki iPhone sample screen" src="${capture}"></div><div class="footer"><span>Vocabulary, with personality.</span><span class="line"></span><span class="count">0${slides.indexOf(slide)+1} / 04</span></div></div></html>`;
    await page.setContent(html);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const validation = await page.evaluate(() => ({ fontReady: document.fonts.check('900 108px Archivo'), imagesReady: [...document.images].every(image => image.complete && image.naturalWidth > 0), overflow: document.documentElement.scrollWidth > 1320 || document.documentElement.scrollHeight > 2868 }));
    if (!validation.fontReady || !validation.imagesReady || validation.overflow) throw new Error(`Slide validation failed: ${slide.id}`);
    await page.screenshot({ path: `${root}iphone-69/${slide.id}.png`, omitBackground: false });
    images.push({ ...slide, file: `iphone-69/${slide.id}.png`, width: 1320, height: 2868, validation });
  }
  const review = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Schwanki — App Store screenshot draft</title><style>body{font:16px system-ui;background:#e6ecf7;color:#14213d;margin:32px}h1{font-size:30px}p{max-width:900px;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}figure{margin:0}img{width:100%;display:block;border-radius:12px}figcaption{padding:12px 0;line-height:1.5}a{color:inherit}</style><h1>Schwanki · App Store draft</h1><p>English (US) · 1320 × 2868 · Four real iPhone sample screens, captured on an isolated simulator. No account data. The import and web screens describe their real boundaries. These are draft listing assets, not a submitted release.</p><div class="grid">${images.map(image => `<figure><a href="${image.file}"><img src="${image.file}" alt="${image.body}"></a><figcaption>${image.id}: ${image.body}</figcaption></figure>`).join('')}</div></html>`;
  await writeFile(`${root}index.html`, review);
  await writeFile(`${root}manifest.json`, JSON.stringify({ generatedAt: new Date().toISOString(), deviceType: 'IPHONE_69', sourceResolution: [1206,2622], source: 'Native iPhone 18 Pro simulator, iOS 27, bundled sample content; no altered UI.', slides: images }, null, 2) + '\n');
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(new URL('index.html', import.meta.url).href);
  await page.locator('img').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${root}contact-sheet.png`, fullPage: true });
  console.log(JSON.stringify({ screenshots: images.length, dimensions: '1320x2868', gallery: `${root}index.html` }));
} finally { await browser.close(); }
