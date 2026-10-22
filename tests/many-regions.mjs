import assert from 'node:assert/strict';
import {digitizeLabels} from '../dist/digitizer.mjs';
import {compile} from '../dist/engine.mjs';
const w=160,h=168,labels=new Int16Array(w*h).fill(-1);
let count=0;
for(let y=2;y<166;y+=8)for(let x=2;x<158;x+=8){const color=count++%2;for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)labels[(y+dy)*w+x+dx]=color;}
for(const mode of ['auto','fill']){
 const objects=digitizeLabels(labels,w,h,['#244ead','#cc8800'],{unit:.2,mode});
 assert(count>160);assert.equal(objects.length,152);
 assert.equal(objects.reduce((n,o)=>n+(o.groupedRegions||1),0),count);
 assert.equal(objects.reduce((n,o)=>n+o.artworkContours.length,0),count);
 assert(Math.abs(objects.reduce((n,o)=>n+o.area,0)-count*16*.04)<1e-8);
 for(const o of objects.filter(o=>o.groupedRegions)){assert.equal(o.kind,'fill');assert.equal(o.paths.length,o.groupedRegions);assert(o.paths.every(p=>p.points.length===4));}
 const restored=JSON.parse(JSON.stringify({hoop:150,trim:true,objects}));
 const pattern=compile(restored);assert(pattern.metrics.stitches>0);assert(!pattern.issues.some(i=>i.severity==='error'));
 console.log(mode,count,'regions preserved in',objects.length,'objects;',pattern.metrics.stitches,'stitches; JSON restored');
}
