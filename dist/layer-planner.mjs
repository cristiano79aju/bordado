// BordAI layer planner: conservative geometry heuristics + dependency-safe route ordering.
// Flat raster input cannot reveal truly hidden geometry; inferred relationships are marked as heuristic.
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function bounds(o){
 const pts=[];
 for(const p of (o.artworkContours||o.paths||[]))for(const q of p.points||[])pts.push({x:q.x+(o.x||0),y:q.y+(o.y||0)});
 if(o.kind==='machine')for(const q of o.commands||[])pts.push({x:q.x+(o.x||0),y:q.y+(o.y||0)});
 if(!pts.length)return null;
 return {minX:Math.min(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxX:Math.max(...pts.map(p=>p.x)),maxY:Math.max(...pts.map(p=>p.y))};
}
const area=b=>b?Math.max(0,b.maxX-b.minX)*Math.max(0,b.maxY-b.minY):0;
const center=b=>({x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2});
function overlap(a,b){if(!a||!b)return 0;const w=Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)),h=Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));return w*h;}
function objectColor(o){return (o.colors?.[0]||o.color||'#777777').toLowerCase();}
function endpoint(o){const pts=o.kind==='machine'?(o.commands||[]).filter(p=>p.c===0||p.c===1):(o.paths||[]).flatMap(p=>p.points||[]);const p=pts.at(-1);return p?{x:p.x+(o.x||0),y:p.y+(o.y||0)}:center(bounds(o)||{minX:0,minY:0,maxX:0,maxY:0});}
function startpoint(o){const pts=o.kind==='machine'?(o.commands||[]).filter(p=>p.c===0||p.c===1):(o.paths||[]).flatMap(p=>p.points||[]);const p=pts[0];return p?{x:p.x+(o.x||0),y:p.y+(o.y||0)}:center(bounds(o)||{minX:0,minY:0,maxX:0,maxY:0});}
function labelFor(index){return index===0?'BACKGROUND':index<=5?'CAMADA '+index:'CAMADA '+index;}
export function planLayers(input){
 const objects=input.map((o,index)=>({o,index,b:bounds(o)})).filter(x=>x.b);
 if(!objects.length)return {objects:input,layers:[],dependencies:[],order:[],summary:{layers:0,objects:input.length,colors:0,heuristicRelations:0}};
 const union={minX:Math.min(...objects.map(x=>x.b.minX)),minY:Math.min(...objects.map(x=>x.b.minY)),maxX:Math.max(...objects.map(x=>x.b.maxX)),maxY:Math.max(...objects.map(x=>x.b.maxY))};
 const totalArea=Math.max(1,area(union));
 const ranked=[...objects].sort((a,b)=>area(b.b)-area(a.b));
 const largest=ranked[0];
 // Only label a background when a single region dominates the design bounds.
 const background=area(largest.b)/totalArea>=.58?largest:null;
 const layerOf=new Map(objects.map(x=>[x.o.id,background&&x===background?0:1]));
 const dependencies=[];
 // A small object almost fully enclosed by a much larger object's bounds is a likely foreground detail.
 // This is explicitly a heuristic; bounds alone are not sufficient to prove physical occlusion.
 for(const child of objects){
  if(background&&child===background)continue;
  let parent=null,best=-1;
  const ca=area(child.b);if(ca<=0)continue;
  for(const candidate of objects){
   if(candidate===child||area(candidate.b)<=ca*1.28)continue;
   const inter=overlap(child.b,candidate.b),ratio=inter/ca,c=center(child.b);
   const inside=c.x>=candidate.b.minX&&c.x<=candidate.b.maxX&&c.y>=candidate.b.minY&&c.y<=candidate.b.maxY;
   if(inside&&ratio>=.88&&ratio>best){best=ratio;parent=candidate;}
  }
  if(parent&&(!background||parent!==background)){
   const next=Math.min(100,Math.max(2,(layerOf.get(parent.o.id)||1)+1));
   layerOf.set(child.o.id,next);
   dependencies.push({before:parent.o.id,after:child.o.id,reason:'contained-bounds',confidence:'heuristic'});
  }else if(background&&child!==background){
   dependencies.push({before:background.o.id,after:child.o.id,reason:'background-first',confidence:'heuristic'});
  }
 }
 // Propagate layer depth over dependency edges; never impose a cycle.
 for(let pass=0;pass<objects.length;pass++){
  let changed=false;
  for(const edge of dependencies){const a=layerOf.get(edge.before)||0,b=layerOf.get(edge.after)||1;if(b<=a){layerOf.set(edge.after,Math.min(100,a+1));changed=true;}}
  if(!changed)break;
 }
 const byId=new Map(objects.map(x=>[x.o.id,x]));
 const incoming=new Map(objects.map(x=>[x.o.id,0])),outgoing=new Map(objects.map(x=>[x.o.id,[]]));
 for(const edge of dependencies){if(!incoming.has(edge.before)||!incoming.has(edge.after))continue;outgoing.get(edge.before).push(edge.after);incoming.set(edge.after,incoming.get(edge.after)+1);}
 const remaining=new Set(objects.map(x=>x.o.id)),ordered=[];let cursor={x:0,y:0},lastColor=null;
 while(remaining.size){
  const available=[...remaining].filter(id=>incoming.get(id)===0);
  if(!available.length){ // fail safe: preserve input order for unresolved/cyclic constraints
   for(const x of objects)if(remaining.has(x.o.id)){ordered.push(x.o);remaining.delete(x.o.id);}break;
  }
  available.sort((ia,ib)=>{
   const a=byId.get(ia),b=byId.get(ib),la=layerOf.get(ia)||0,lb=layerOf.get(ib)||0;
   if(la!==lb)return la-lb;
   const ca=objectColor(a.o),cb=objectColor(b.o),colorA=ca===lastColor?0:1,colorB=cb===lastColor?0:1;
   if(colorA!==colorB)return colorA-colorB;
   return dist(cursor,startpoint(a.o))-dist(cursor,startpoint(b.o))||a.index-b.index;
  });
  const id=available[0],item=byId.get(id);ordered.push(item.o);remaining.delete(id);cursor=endpoint(item.o);lastColor=objectColor(item.o);
  for(const next of outgoing.get(id)||[])incoming.set(next,Math.max(0,incoming.get(next)-1));
 }
 const names=new Map();
 for(const x of objects){const layer=layerOf.get(x.o.id)||1;if(!names.has(layer))names.set(layer,labelFor(layer));x.o.layerId=x.o.layerId||'layer-'+layer;x.o.layerIndex=layer;x.o.layerName=x.o.layerName||names.get(layer);x.o.layerLocked=!!x.o.layerLocked;x.o.visible=x.o.visible!==false;x.o.layerConfidence=background&&x===background?'high':'heuristic';}
 const layers=[...new Set(objects.map(x=>layerOf.get(x.o.id)||1))].sort((a,b)=>a-b).map(index=>({id:'layer-'+index,index,name:names.get(index)||labelFor(index),objectIds:objects.filter(x=>(layerOf.get(x.o.id)||1)===index).map(x=>x.o.id),visible:objects.filter(x=>(layerOf.get(x.o.id)||1)===index).every(x=>x.o.visible!==false),locked:objects.filter(x=>(layerOf.get(x.o.id)||1)===index).some(x=>x.o.layerLocked)}));
 return {objects:ordered,layers,dependencies,order:ordered.map(o=>o.id),summary:{layers:layers.length,objects:objects.length,colors:new Set(objects.map(x=>objectColor(x.o))).size,heuristicRelations:dependencies.filter(x=>x.confidence==='heuristic').length,background:background?.o.id||null}};
}
export function setLayerVisibility(objects,layerId,visible){for(const o of objects)if((o.layerId||'layer-1')===layerId)o.visible=!!visible;return objects;}
export function setLayerLock(objects,layerId,locked){for(const o of objects)if((o.layerId||'layer-1')===layerId)o.layerLocked=!!locked;return objects;}
export function validateLayerPlan(objects,plan){
 const ids=new Set(objects.map(o=>o.id)),position=new Map(plan.order.map((id,i)=>[id,i])),issues=[];
 for(const edge of plan.dependencies){if(!ids.has(edge.before)||!ids.has(edge.after))continue;if((position.get(edge.before)??Infinity)>(position.get(edge.after)??-1))issues.push({type:'layer-order',before:edge.before,after:edge.after,message:'A dependência de camada está fora de ordem.'});}
 if(plan.summary.objects!==objects.length)issues.push({type:'missing-object',message:'Um ou mais objetos não possuem limites geométricos para análise.'});
 return {valid:issues.length===0,issues};
}
