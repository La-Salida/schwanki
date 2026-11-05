const sharp=require('sharp');
const path=require('node:path');
// Render the approved face-on-paper app mark, with an optional corner mask.
async function mark(size,{radius=0.22}={}){
  // Approved November 2026 face-on-paper master; radius 0 supplies full bleed.
  const source=path.join(__dirname,'../mascot/goose-face-paper-1024.png');
  const master=await sharp(source).resize(size,size,{kernel:'lanczos3'}).toBuffer();
  if(radius===0)return sharp(master).png();
  const shape=Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size*radius)}" fill="#fff"/></svg>`);
  return sharp(master).composite([{input:shape,blend:'dest-in'}]).png();
}
module.exports=mark;
