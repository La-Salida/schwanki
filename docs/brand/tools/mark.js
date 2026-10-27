const sharp=require('sharp');
// App mark: the goose's head (eye, beak, notebook corner) cropped from the mascot cutout,
// bleeding off the bottom and right edges of an ink square.
// k: mascot scale on the 1024 canvas; face: where the goose's eye/beak centre lands.
async function mark(size,{bg='#1A1712',radius=0.22,k=2.173,face=[535,459]}={}){
  const S=1024, src=[640,190];
  const W=Math.round(1024*k);
  const left=Math.round(face[0]-src[0]*k), top=Math.round(face[1]-src[1]*k);
  let img=sharp(await sharp('goose-1024.png').resize(W,W).toBuffer());
  const pad={top:Math.max(0,top),left:Math.max(0,left),bottom:Math.max(0,S-(top+W)),right:Math.max(0,S-(left+W)),background:{r:0,g:0,b:0,alpha:0}};
  img=sharp(await img.extend(pad).toBuffer());
  const win=await img.extract({left:Math.max(0,-left),top:Math.max(0,-top),width:S,height:S}).toBuffer();
  const base=await sharp({create:{width:S,height:S,channels:4,background:bg}}).composite([{input:win}]).png().toBuffer();
  const mask=Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${Math.round(S*radius)}" fill="#fff"/></svg>`);
  const out=await sharp(base).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  return sharp(out).resize(size,size,{kernel:'lanczos3'}).png();
}
module.exports=mark;
