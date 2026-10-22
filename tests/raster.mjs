import assert from 'node:assert/strict';
import {prepareRaster} from '../dist/raster.mjs';
import {digitizeLabels} from '../dist/digitizer.mjs';
import {compile} from '../dist/engine.mjs';
const w=60,h=40,rgba=new Uint8ClampedArray(w*h*4);
for(let y=5;y<35;y++)for(let x=5;x<55;x++){const i=(y*w+x)*4;rgba.set(x===29?[20,20,20,255]:[245,245,245,255],i)}
const original=rgba.slice();const a=prepareRaster(rgba,w,h,{maxColors:3,mode:'delicate'});
assert.deepEqual(rgba,original);assert(a.transparent);assert(a.labels[10*w+10]>=0,'white interior retained');assert.equal(a.labels[0],-1);assert.notEqual(a.labels[15*w+29],a.labels[15*w+20],'high contrast fine line retained');
const gradient=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)gradient.set([Math.round(x/(w-1)*255),50,255-Math.round(x/(w-1)*255),255],(y*w+x)*4);
const g=prepareRaster(gradient,w,h,{maxColors:8,mode:'gradient'});assert.equal(g.palette.length,8);assert(g.labels.every(l=>l>=0));assert.equal(new Set(g.labels).size,8);
const tiny=new Int16Array(100).fill(-1);tiny[55]=0;const objects=digitizeLabels(tiny,10,10,['#112244'],{unit:.1,mode:'contours'});assert(objects[0].reference);const pattern=compile({hoop:150,objects});assert.equal(pattern.metrics.stitches,0);assert(pattern.issues.some(i=>i.type==='micro-reference'));
console.log('Transparent whites, thin contrast lines, bounded tonal palette, immutable input and explicit microdetail warnings passed');
