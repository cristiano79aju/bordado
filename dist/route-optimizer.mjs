import {distance} from './geometry.mjs';

// Imported stitch islands are atomic: never reverse their needle sequence,
// cross a color change, or change the precedence of overlapping envelopes.
export function movementStats(commands,start={x:0,y:0}){
 let previous=start;const stats={stitches:0,jumps:0,trims:0,travel:0,thread:0};
 for(const p of commands){if(p.c===0){stats.stitches++;stats.thread+=distance(previous,p)}if(p.c===1){stats.jumps++;stats.travel+=distance(previous,p)}if(p.c===2)stats.trims++;if(p.c===0||p.c===1)previous=p;}
 return stats;
}
const moving=p=>p.c===0||p.c===1;
function collapseJumps(commands){
 const result=[];
 for(const p of commands){if(p.c===1&&result.at(-1)?.c===1)result[result.length-1]=p;else result.push(p)}
 return result;
}
function envelope(points){return points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity})}
function overlaps(a,b){const margin=.3;return Math.min(a.maxX,b.maxX)+margin>=Math.max(a.minX,b.minX)&&Math.min(a.maxY,b.maxY)+margin>=Math.max(a.minY,b.minY)}
function splitBlock(commands,start){
 const units=[];let pending=[],entry={...start},previous={...start},trims=0;
 const flush=()=>{const first=pending.findIndex(p=>p.c===0);if(first<0){pending=[];return}const before=pending.slice(0,first).filter(moving),begin=before.at(-1)||entry,body=collapseJumps(pending.slice(first));const sewn=[];let needlePrevious=begin;for(const p of body){if(p.c===0)sewn.push(needlePrevious,p);if(moving(p))needlePrevious=p;}units.push({index:units.length,entry:{x:begin.x,y:begin.y},end:{...previous},body,bounds:envelope(sewn),trims});pending=[];trims=0;};
 for(const p of commands){if(p.c===2){flush();trims++;entry={...previous}}else{if(!pending.length)entry={...previous};pending.push(p);if(moving(p))previous=p;}}
 flush();return {units,trailingTrims:trims,ending:previous};
}
function availableOrder(units,start,fixedFirst=false){
 const n=units.length,edges=Array.from({length:n},()=>[]),indegree=new Uint16Array(n);let dependencies=0;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(overlaps(units[i].bounds,units[j].bounds)){edges[i].push(j);indegree[j]++;dependencies++;}
 const remaining=new Set(units.map((_,i)=>i)),order=[];let cursor=start;
 while(remaining.size){let at=-1,best=Infinity;for(const i of remaining){if(indegree[i])continue;const cost=distance(cursor,units[i].entry);if(cost<best){best=cost;at=i}}if(!order.length&&fixedFirst)at=0;if(at<0)return {order:units.map((_,i)=>i),dependencies};order.push(at);remaining.delete(at);cursor=units[at].end;for(const j of edges[at])indegree[j]--;}
 return {order,dependencies};
}
function refineOrder(units,input,start,nextEntry){
 const order=[...input],n=order.length;if(n>500)return order;
 const pointEnd=id=>id===undefined?start:units[id].end,pointStart=id=>id===undefined?nextEntry:units[id].entry;
 const edge=(a,b)=>{const to=pointStart(b);return to?distance(pointEnd(a),to):0},jump=(a,b)=>edge(a,b)>.000001?1:0;
 for(let pass=0;pass<3;pass++){let changed=false;for(let i=0;i<n;i++){
  const u=order[i],a=order[i-1],b=order[i+1],removed=-edge(a,u)-edge(u,b)+edge(a,b),removedJ=-jump(a,u)-jump(u,b)+jump(a,b);let best=0,target=i;
  const at=k=>k<0||k>=n-1?undefined:order[k>=i?k+1:k];
  for(let j=Math.max(0,i-24);j<=Math.min(n-1,i+24);j++){if(j===i)continue;let allowed=true;for(let k=Math.min(i,j);k<=Math.max(i,j);k++)if(k!==i&&overlaps(units[u].bounds,units[order[k]].bounds)){allowed=false;break}if(!allowed)continue;const c=at(j-1),d=at(j),delta=removed-edge(c,d)+edge(c,u)+edge(u,d),jumpDelta=removedJ-jump(c,d)+jump(c,u)+jump(u,d);if(delta<best-.001&&jumpDelta<=0){best=delta;target=j}}
  if(target!==i){order.splice(i,1);order.splice(target,0,u);changed=true;}
 }if(!changed)break;}return order;
}
function emitBlock(units,order,start,trailingTrims){
 const result=[];let cursor={...start};
 for(let i=0;i<order.length;i++){const unit=units[order[i]];if(i||unit.trims){result.push({x:cursor.x,y:cursor.y,c:2});}if(distance(cursor,unit.entry)>.000001)result.push({x:unit.entry.x,y:unit.entry.y,c:1});for(const p of unit.body)result.push({...p});cursor=unit.end;}
 if(trailingTrims)result.push({x:cursor.x,y:cursor.y,c:2});return {commands:result,end:cursor};
}
export function optimizeImported(commands,{start={x:0,y:0},refineRuns=true}={}){
 const before=movementStats(commands,start);if(commands.some(p=>![0,1,2,5].includes(p.c)))return {commands,changed:false,before,after:before,parts:0,dependencies:0,reason:'A matriz contém comandos especiais; o percurso foi preservado.'};
 const blocks=[];let block=[];for(const p of commands){if(p.c===5){blocks.push({commands:block,color:p});block=[]}else block.push(p)}blocks.push({commands:block,color:null});
 let originalCursor={...start},cursor={...start},output=[],parts=0,dependencies=0;
 for(let bi=0;bi<blocks.length;bi++){const block=blocks[bi],parsed=splitBlock(block.commands,originalCursor),units=parsed.units;originalCursor=parsed.ending;parts+=units.length;
  if(refineRuns)for(const unit of units){
   const virtual=[];let sewing=false;for(const p of unit.body){if(p.c===1&&sewing){virtual.push({x:p.x,y:p.y,c:2});sewing=false}virtual.push(p);if(p.c===0)sewing=true;}
   if(virtual.filter(p=>p.c===2).length<2)continue;
   const inner=optimizeImported(virtual,{start:unit.entry,refineRuns:false});if(inner.changed){unit.body=inner.commands.filter(p=>p.c!==2);unit.end=unit.body.filter(moving).at(-1)||unit.entry;}
  }
  if(!units.length||units.length>1200){for(const p of block.commands)output.push({...p});const last=block.commands.filter(moving).at(-1);if(last)cursor=last;}
  else{
   const original=units.map((_,i)=>i),greedy=availableOrder(units,cursor),fixed=availableOrder(units,cursor,true);dependencies+=greedy.dependencies;
   const nextBlock=blocks[bi+1],nextParsed=nextBlock?splitBlock(nextBlock.commands,originalCursor):null,nextEntry=nextParsed?.units[0]?.entry;
   let best=emitBlock(units,original,cursor,parsed.trailingTrims),bestStats=movementStats(best.commands,cursor);
   const cost=(result,stats)=>stats.travel+(nextEntry?distance(result.end,nextEntry):0);
   for(const order of [greedy.order,fixed.order,refineOrder(units,original,cursor,nextEntry),refineOrder(units,greedy.order,cursor,nextEntry),refineOrder(units,fixed.order,cursor,nextEntry)]){const trial=emitBlock(units,order,cursor,parsed.trailingTrims),stats=movementStats(trial.commands,cursor);if(cost(trial,stats)<cost(best,bestStats)-1e-6||(Math.abs(cost(trial,stats)-cost(best,bestStats))<1e-6&&stats.jumps<bestStats.jumps)){best=trial;bestStats=stats}}
   // The final whole-file check includes transitions to following color blocks.
   for(const p of best.commands)output.push(p);cursor=best.end;
  }
  if(block.color)output.push({...block.color,x:cursor.x,y:cursor.y});
 }
 output=collapseJumps(output);const after=movementStats(output,start),sameStitches=before.stitches===after.stitches&&Math.abs(before.thread-after.thread)<.000001;
 const improves=after.travel<before.travel-.001||(Math.abs(after.travel-before.travel)<=.001&&after.jumps<before.jumps);
 if(!sameStitches||after.trims>before.trims||after.jumps>before.jumps||!improves)return {commands,changed:false,before,after:before,parts,dependencies,reason:'O percurso atual já é o melhor entre as alternativas que preservam os pontos e as sobreposições.'};
 return {commands:output,changed:true,before,after,parts,dependencies,reason:'Partes independentes reorganizadas dentro de cada cor. Pontos, bases e ordem dos encontros preservados.'};
}
