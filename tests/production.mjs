import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTravelRouter,futureCoverage} from '../dist/travel-routing.mjs';
import {insidePolygon} from '../dist/geometry.mjs';
import {compile} from '../dist/engine.mjs';
import {optimizeNativeProduction} from '../dist/production-optimizer.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const loops=[rect(0,0,8,8),rect(3,2,2,4)],contains=p=>insidePolygon(p,loops),a={x:2.8,y:1.8},b={x:5.2,y:1.8};
const route=createTravelRouter(contains)(a,b);assert(route);let previous=a;for(const p of route.points){for(let t=0;t<=1;t+=.01)assert(contains({x:previous.x+(p.x-previous.x)*t,y:previous.y+(p.y-previous.y)*t}));previous=p;}
assert.equal(createTravelRouter(p=>insidePolygon(p,[rect(0,0,1,1),rect(3,0,1,1)]))({x:.5,y:.5},{x:3.5,y:.5}),null,'disconnected exposed regions need a jump');
const future={id:'later',kind:'fill',paths:[{points:rect(0,0,8,8)},{points:rect(3,3,2,2)}],color:'#112233',underlay:false,spacing:.4};const covered=futureCoverage([future]);assert(!covered({x:4,y:4},-1),'future hole stays uncovered');assert(!covered({x:.1,y:2},-1),'boundary clearance');assert(covered({x:2,y:2},-1));assert(!covered({x:2,y:2},0),'already sewn object cannot hide a new thread');
const doc={hoop:150,trim:true,objects:[{id:'ring',name:'ring',kind:'fill',color:'#112244',paths:loops.map(points=>({points})),underlay:true,spacing:.4,angle:45,length:2.8}]},source=JSON.stringify(doc),r=optimizeNativeProduction(doc);assert.equal(JSON.stringify(doc),source);assert(r.after.jumps<=r.before.jumps);assert(r.after.trims<=r.before.trims);assert(r.after.travel<=r.before.travel+.001);
const check=compile(r.document);previous={x:0,y:0};for(const p of check.commands){if(p.c===0)for(let t=.01;t<1;t+=.02)assert(contains({x:previous.x+(p.x-previous.x)*t,y:previous.y+(p.y-previous.y)*t}),'sewn segment crossed a hole');if(p.c===0||p.c===1)previous=p;}
for(const path of process.argv.slice(2)){const doc=JSON.parse(fs.readFileSync(path));const original=JSON.stringify(doc.objects),result=optimizeNativeProduction(doc);assert.equal(JSON.stringify(result.document.objects),original);assert(result.after.jumps<=result.before.jumps);assert(result.after.trims<=result.before.trims);assert(result.after.travel<=result.before.travel+.001);assert(result.after.thread+result.after.travel<=(result.before.thread+result.before.travel)*1.03+.01);console.log(path,result.before.jumps,'→',result.after.jumps,'jumps;',result.before.trims,'→',result.after.trims,'cuts');}
console.log('Production routing: geometry retained, holes and exposed gaps protected, future coverage clearance and cost guard passed');
