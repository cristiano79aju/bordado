import {analyzeArtworkRaster,artworkComplexity} from './artwork-profile.mjs';
export async function importArtwork(file,{width=90,maxColors=8,removeWhite=true,mode='auto'}={}){
 if(file.size>12*1024*1024)throw Error('Use uma imagem de até 12 MB.');
 const url=URL.createObjectURL(file);let image;try{image=await new Promise((ok,no)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=()=>no(Error('Imagem inválida.'));image.src=url;});}finally{URL.revokeObjectURL(url);}
 const run=(effectiveMode,adaptive=false)=>{const ratio=(effectiveMode==='delicate'?384:768)/Math.max(image.width,image.height),canvas=document.createElement('canvas');canvas.width=Math.max(8,Math.round(image.width*ratio));canvas.height=Math.max(8,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);return analyzeArtworkRaster(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{width,maxColors,removeWhite,mode:effectiveMode,source:file.name,adaptive})};
 let objects=run(mode);if(mode==='auto'&&artworkComplexity(objects).needsDetail){await new Promise(resolve=>setTimeout(resolve,0));objects=run('delicate',true)}return objects;
}
