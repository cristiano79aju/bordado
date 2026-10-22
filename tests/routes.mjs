import fs from 'node:fs';
import assert from 'node:assert/strict';
import {optimizeImported,movementStats} from '../dist/route-optimizer.mjs';
import {readPES,writePES,writeDST} from '../dist/formats.mjs';
import {compile} from '../dist/engine.mjs';
const p=(x,y,c)=>({x,y,c});
// Five disconnected sewn islands deliberately visit alternating far ends.
const fixture=[];for(const x of [0,40,10,30,20]){if(fixture.length)fixture.push(p(fixture.at(-1).x,0,2));fixture.push(p(x,0,1),p(x+1,0,0),p(x+1,1,0));}
const result=optimizeImported(fixture);assert(result.changed);assert(result.after.travel<result.before.travel*.6);assert(result.after.trims<=result.before.trims);assert(result.after.jumps<=result.before.jumps);assert.equal(result.after.stitches,result.before.stitches);
function signatures(commands){let previous={x:0,y:0},color=0;const segments=[];for(const p of commands){if(p.c===5)color++;if(p.c===0)segments.push([color,previous.x,previous.y,p.x,p.y].join(','));if(p.c===0||p.c===1)previous=p;}return segments.sort()}
assert.deepEqual(signatures(result.commands),signatures(fixture));assert.deepEqual(fixture.at(0),p(0,0,1));
// Overlapping sewn parts have to keep their original precedence, even when the
// route would be shorter if a later part were sewn first.
const crossing=[p(20,0,1),p(0,0,0),p(0,0,2),p(1,0,1),p(21,0,0)];const protectedRoute=optimizeImported(crossing);assert.deepEqual(protectedRoute.commands,crossing);
const special=optimizeImported([...fixture,p(20,1,3)]);assert(!special.changed);
for(const path of process.argv.slice(2)){
 const original=readPES(fs.readFileSync(path)),input=JSON.stringify(original.commands),r=optimizeImported(original.commands);
 assert.equal(JSON.stringify(original.commands),input,'optimizer mutated the imported source');assert.deepEqual(signatures(r.commands),signatures(original.commands),'directed needle segments changed');assert.equal(r.after.stitches,r.before.stitches);assert(Math.abs(r.after.thread-r.before.thread)<1e-6);assert(r.after.travel<=r.before.travel+.001);assert(r.after.trims<=r.before.trims);assert(r.after.jumps<=r.before.jumps);assert.equal(r.commands.filter(p=>p.c===5).length,original.commands.filter(p=>p.c===5).length);
 const object={id:'test',name:'Route regression',kind:'machine',x:0,y:0,color:original.colors[0],colors:original.colors,commands:r.commands,routeOptimized:r.changed};const pattern=compile({hoop:300,objects:[object]});const bytes=writePES(pattern,'Route test'),round=readPES(bytes);
 assert.deepEqual(round.colors,original.colors);assert.deepEqual(signatures(round.commands),signatures(original.commands));
 const file=path.split('/').pop();fs.writeFileSync('/tmp/route-'+file,bytes);fs.writeFileSync('/tmp/route-'+file+'.dst',writeDST(pattern,'Route test'));fs.writeFileSync('/tmp/route-'+file+'.json',JSON.stringify({pattern,original}));console.log(file,{changed:r.changed,parts:r.parts,travel:[r.before.travel,r.after.travel].map(v=>Math.round(v*10)/10),jumps:[r.before.jumps,r.after.jumps],trims:[r.before.trims,r.after.trims]});
}
console.log('Routing regressions passed; synthetic travel',Math.round(result.before.travel),'→',Math.round(result.after.travel),'mm');
