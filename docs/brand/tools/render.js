const { chromium } = require('playwright');
const fs=require('fs');
const css=`@font-face{font-family:Archivo;font-weight:500;src:url(archivo-latin-500-normal.woff2)}
@font-face{font-family:Archivo;font-weight:700;src:url(archivo-latin-700-normal.woff2)}
@font-face{font-family:Archivo;font-weight:900;src:url(archivo-latin-900-normal.woff2)}
*{margin:0;box-sizing:border-box}body{font-family:Archivo;color:#1A1712}`;
const og=({eyebrow,head,sub})=>`<!doctype html><html><head><style>${css}
body{width:1200px;height:630px;background:#FAF6EF;position:relative;overflow:hidden}
.copy{position:absolute;left:72px;top:64px;width:640px;height:502px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:16px}.brand img{width:64px;height:64px}.brand svg{height:40px;width:273px}
.eyebrow{margin-top:56px;font-weight:700;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#B83D1C}
h1{margin-top:14px;font-weight:900;font-size:76px;line-height:1.02;letter-spacing:-.025em}
mark{background:#F5D90A;color:#1A1712;padding:0 .08em;border-radius:4px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
p{margin-top:22px;font-weight:500;font-size:28px;line-height:1.35;color:rgba(26,23,18,.72)}
.url{margin-top:auto;font-weight:700;font-size:24px;color:#B83D1C}
.slab{position:absolute;right:-60px;top:70px;width:470px;height:620px;border-radius:40px;background:#1A1712;box-shadow:-14px 14px 0 #B83D1C}
.goose{position:absolute;right:-70px;top:80px;width:600px;transform:rotate(-4deg)}
</style></head><body>
<div class="slab"></div><img class="goose" src="goose-1024.png">
<div class="copy"><div class="brand"><img src="mark-1024.png">${fs.readFileSync('schwanki-wordmark-ink.svg','utf8').replace(/ width="[^"]*" height="[^"]*"/,'')}</div>
${eyebrow?`<div class="eyebrow">${eyebrow}</div>`:'<div class="eyebrow" style="visibility:hidden">.</div>'}
<h1>${head}</h1><p>${sub}</p><div class="url">schwankiapp.com</div></div></body></html>`;
const lockup=(color,markBg)=>`<!doctype html><html><head><style>${css}
body{background:transparent;display:inline-flex;align-items:center;gap:28px;padding:0}
img{width:160px;height:160px}svg{height:100px;width:683px}svg path{fill:${color}}</style></head><body>
<img src="mark-1024.png">${fs.readFileSync('schwanki-wordmark-ink.svg','utf8').replace(/ width="[^"]*" height="[^"]*"/,'')}</body></html>`;
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:630}});
 const jobs={
  'og-home':og({eyebrow:'Spaced repetition, swipe by swipe',head:'A modern take on <mark>Anki</mark>.',sub:'Review in a feed that ends. Bring your Anki decks and keep your progress.'}),
  'og-anki-alternative':og({eyebrow:'Anki alternative',head:'Keep your decks.<br>Lose the <mark>grind</mark>.',sub:'Import .apkg with review history and FSRS scheduling, then swipe through reviews.'}),
  'og-pricing':og({eyebrow:'Pricing',head:'Free deck.<br>Cinema from <mark>3.3¢</mark>.',sub:'Decks, reviews and Anki imports cost nothing. Pay only for AI pictures and audio.'}),
  'og-export-anki-guide':og({eyebrow:'Guide',head:'Export Anki decks <mark>without</mark> losing progress.',sub:'The one checkbox that keeps your review history. Desktop, AnkiMobile and AnkiDroid.'}),
 };
 for(const [n,html] of Object.entries(jobs)){fs.writeFileSync(n+'.html',html);await p.goto('file://'+process.cwd()+'/'+n+'.html');await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:n+'.png'});}
 for(const [n,c] of [['lockup-ink','#1A1712'],['lockup-cream','#FAF6EF']]){
  fs.writeFileSync(n+'.html',lockup(c));const q=await b.newPage({viewport:{width:900,height:160},deviceScaleFactor:2});
  await q.goto('file://'+process.cwd()+'/'+n+'.html');await q.evaluate(()=>document.fonts.ready);
  const el=await q.$('body');await el.screenshot({path:n+'.png',omitBackground:true});}
 await b.close();
})();
