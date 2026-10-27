const fs=require('fs');const opentype=require('opentype.js');
const font=opentype.parse(fs.readFileSync('node_modules/@fontsource/archivo/files/archivo-latin-900-normal.woff'));
const size=200, tracking=-0.025*size;
let x=0; const parts=[];
const glyphs=[...'Schwanki'].map(c=>font.charToGlyph(c));
glyphs.forEach((g,i)=>{ parts.push(g.getPath(x,0,size)); x+=g.advanceWidth*size/font.unitsPerEm + (i<glyphs.length-1?tracking:0); if(i<glyphs.length-1) x+=font.getKerningValue(g,glyphs[i+1])*size/font.unitsPerEm; });
const f=n=>(+n.toFixed(2)).toString();
let d=parts.map(p=>p.commands.map(c=>c.type==='Z'?'Z':c.type==='Q'?`Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`:c.type==='C'?`C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`:`${c.type}${f(c.x)} ${f(c.y)}`).join('')).join('');
const bb=parts.reduce((b,p)=>{const q=p.getBoundingBox();return{x1:Math.min(b.x1,q.x1),y1:Math.min(b.y1,q.y1),x2:Math.max(b.x2,q.x2),y2:Math.max(b.y2,q.y2)}},{x1:1e9,y1:1e9,x2:-1e9,y2:-1e9});
const pad=0; const w=(bb.x2-bb.x1).toFixed(1), h=(bb.y2-bb.y1).toFixed(1);
for (const [n,c] of [['ink','#1A1712'],['cream','#FAF6EF'],['beak','#B83D1C']]){
 fs.writeFileSync(`schwanki-wordmark-${n}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bb.x1.toFixed(1)} ${bb.y1.toFixed(1)} ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Schwanki"><title>Schwanki</title><path fill="${c}" d="${d}"/></svg>\n`);
}
console.log(w,h,d.length);
