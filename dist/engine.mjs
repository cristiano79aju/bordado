import {createTravelRouter,futureCoverage} from './travel-routing.mjs';
import {buildColumn} from './columns.mjs';
import {auditQuality} from './quality.mjs';
import {distance,resample,insidePolygon,pointSegment,objectBounds,segmentInside} from './geometry.mjs';
export function compile(document){
 if(!Array.isArray(document.objects)||document.objects.length>200||!Number.isFinite(+document.hoop)||document.hoop<10||document.hoop>1000)throw Error('Projeto ou bastidor inválido.');
 for(const o of document.objects){if(!['machine','satin','running','fill'].includes(o.kind))throw Error('Tipo de objeto inválido.');if(o.kind==='machine'){if(!Array.isArray(o.commands)||o.commands.length>300000||!o.colors?.length)throw Error('Matriz inválida.');if(o.commands.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000))throw Error('Coordenadas inválidas.');}else{if(!Array.isArray(o.paths)||o.paths.length>5000||o.paths.reduce((s,p)=>s+p.points.length,0)>30000)throw Error('Geometria muito complexa.');if(o.spacing!==undefined&&(!Number.isFinite(o.spacing)||o.spacing<.25||o.spacing>1.2))throw Error('Espaçamento inválido.');if(o.paths.some(p=>p.widths&&(!Array.isArray(p.widths)||p.widths.length!==p.points.length||p.widths.some(w=>!Number.isFinite(w)||w<=0||w>1000))))throw Error('Larguras de coluna inválidas.');if(o.artworkContours&&(!Array.isArray(o.artworkContours)||o.artworkContours.reduce((n,p)=>n+p.points.length,0)>30000||o.artworkContours.some(p=>p.points.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))))throw Error('Contorno da arte inválido.');if(o.paths.some(p=>p.points.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)||Math.abs(q.x)>10000||Math.abs(q.y)>10000)))throw Error('Nó inválido.');}}

 const commands=[],issues=[],blocks=[],metrics={stitches:0,jumps:0,trims:0,travel:0,thread:0},visible=document.objects.filter(o=>o.visible!==false&&!o.reference);let cursor={x:0,y:0},color=null;
 const coverage=document.smartTravel&&document.concealedTravel?futureCoverage(visible):()=>false;const travelUsage=new Map();let joinedTravel=0,concealedJoins=0;
 const emit=(p,c,o,role='cover')=>{commands.push({x:p.x,y:p.y,c,object:o.id,color:o.color,role});if(c===0){metrics.stitches++;metrics.thread+=distance(cursor,p);}if(c===1){metrics.jumps++;metrics.travel+=distance(cursor,p);}if(c===2)metrics.trims++;if(c===0||c===1)cursor={x:p.x,y:p.y};if(commands.length>300000)throw Error('Projeto muito denso. Aumente o espaçamento.');};
 const setColor=(value,o)=>{if(color!==value){if(color!==null)emit(cursor,5,o);color=value;blocks.push({color:value,name:o.name});}};
 const issue=(o,type,message,point,severity='review')=>issues.push({object:o.id,type,message,point:point??{x:o.x||0,y:o.y||0},severity});
 for(const o of document.objects.filter(o=>o.reference&&o.raster))issue(o,'micro-reference','Microdetalhe mantido como referência, sem pontos: amplie a arte ou reconstrua o detalhe antes de produzir.');
 for(const o of visible){
  if(o.kind==='machine'){
   let localColor=0;setColor(o.colors[0],o);for(const p of o.commands){if(p.c===4)continue;if(p.c===5){localColor++;const next=o.colors[localColor]??o.colors.at(-1);emit(cursor,5,o);color=next;blocks.push({color:next,name:o.name});continue;}const q={x:p.x+(o.x||0),y:p.y+(o.y||0)};emit(q,p.c,{...o,color},'imported');}
   const cuts=o.commands.filter(p=>p.c===2).length;if(cuts>40)issue(o,'cuts',`${cuts} pedidos de corte: revise conexões por região antes de reduzir.`,null);
   if(o.notice)issue(o,'palette',o.notice,null);
   issue(o,'imported',o.routeOptimized?'Percurso otimizado por partes independentes. Pontos e blocos de cor preservados.':'Pontos importados preservados. A edição dos trilhos exige reconstruir os objetos.',null,'info');continue;
  }
  if(o.raster)issue(o,'raster',o.analysis?.reason||'Contornos extraídos da imagem: revise detalhes, letras e colunas manualmente.');
  setColor(o.color,o);const before=metrics.stitches,origin={x:o.x||0,y:o.y||0},world=p=>({x:p.x+origin.x,y:p.y+origin.y});
  const loops=o.paths.filter(p=>p.points.length>=2).map(p=>p.points.map(world));
  const artLoops=(o.artworkContours||[]).map(path=>path.points.map(world));
  const inArtwork=p=>insidePolygon(p,artLoops)||!!o.pull&&artLoops.some(loop=>loop.some((q,i)=>pointSegment(p,loop[(i+loop.length-1)%loop.length],q).distance<=o.pull+.01));
  const contains=p=>o.clipToArtwork&&artLoops.length?inArtwork(p):o.kind==='fill'?insidePolygon(p,loops):o.paths.some(path=>path.points.some((q,i)=>i&&pointSegment(p,world(path.points[i-1]),world(q)).distance<=(path.width||o.width||1.2)/2+.02));
  const safe=(a,b)=>{if(o.kind==='fill')return segmentInside(a,b,loops);const n=Math.max(2,Math.ceil(distance(a,b)/.08));for(let i=0;i<=n;i++)if(!contains({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
  const router=document.smartTravel&&o.kind==='fill'&&(o.spacing||.4)<=.5?createTravelRouter(contains,p=>coverage(p,visible.indexOf(o)),loops,travelUsage):null;
  const go=(p,role='travel')=>{const d=distance(cursor,p);if(commands.length&&d<3&&safe(cursor,p)){const a={...cursor},n=Math.max(1,Math.ceil(d/2));for(let i=1;i<=n;i++)emit({x:a.x+(p.x-a.x)*i/n,y:a.y+(p.y-a.y)*i/n},0,o,role);}else{const routed=router&&color===o.color&&commands.at(-1)?.c!==5&&commands.length?router(cursor,p):null;if(routed){joinedTravel++;if(routed.hidden)concealedJoins++;for(const q of routed.points){const a={...cursor},n=Math.max(1,Math.ceil(distance(a,q)/1.5));for(let i=1;i<=n;i++)emit({x:a.x+(q.x-a.x)*i/n,y:a.y+(q.y-a.y)*i/n},0,o,routed.hidden?'concealed':'connector');}}else{if(commands.length&&d>1.8&&document.trim!==false)emit(cursor,2,o);emit(p,1,o,'travel');}}};
  const stitch=(p,max=2.8,role='cover')=>{const a={...cursor},n=Math.max(1,Math.ceil(distance(a,p)/max));for(let i=1;i<=n;i++)emit({x:a.x+(p.x-a.x)*i/n,y:a.y+(p.y-a.y)*i/n},0,o,role);};
  if(o.kind==='satin'||o.kind==='running'){
   let firstPath=true;const pending=o.paths.map(path=>({...path,points:path.points.map(world),widths:path.widths?[...path.widths]:undefined}));
   while(pending.length){let at=0,reverse=false,best=Infinity;if(document.optimize!==false&&!o.lockOrder&&!(o.startAtFirst&&firstPath))pending.forEach((p,i)=>{if(!p.points.length)return;const a=distance(cursor,p.points[0]),b=p.fixedEntry?Infinity:distance(cursor,p.points.at(-1));if(Math.min(a,b)<best){best=Math.min(a,b);at=i;reverse=!p.fixedEntry&&b<a;}});const path=pending.splice(at,1)[0];firstPath=false;if(reverse){path.points.reverse();path.widths?.reverse();}
    if(path.points.length<2||path.points.every(p=>distance(p,path.points[0])<.01))continue;const width=(path.width||o.width||1.2)+2*(o.pull||0);
    if(o.kind==='running'){const route=resample(path.points,Math.min(o.length||2.5,1.8));go(route[0]);route.slice(1).forEach(p=>stitch(p,2.5));continue;}
    if(width>6){issue(o,'wide','Coluna acima de 6 mm. Reduza a largura ou divida em duas colunas.',path.points[Math.floor(path.points.length/2)],'error');continue;}
    if(width<.7)issue(o,'thin','Coluna abaixo de 0,7 mm: amplie e valide a leitura no tecido.',path.points[0]);
    const built=buildColumn(path,{step:Math.max(.12,(o.spacing||.4)/2),width:o.width||1.2,pull:o.pull||0,loops:o.clipToArtwork?artLoops:null});
    const sections=built.sections;
    if(built.unsafe||sections.length<2){issue(o,'outside','Coluna fora do contorno da arte. Ajuste os nós ou desative o limite ao contorno.',path.points[0],'error');continue;}
    if(built.limited)issue(o,'turn','Curva fechada: revise a direção dos pontos neste encontro.',sections[Math.floor(sections.length/2)].center);
    if(o.underlay!==false){let route=resample(path.points,1.8);go(route[0]);route.slice(1).forEach(p=>stitch(p,2,'underlay'));sections.reverse();}
    let side=distance(cursor,sections[0].left)<distance(cursor,sections[0].right)?'left':'right';go(sections[0][side]);stitch(sections[0][side==='left'?'right':'left'],6);side=side==='left'?'right':'left';
    for(let i=1;i<sections.length;i++){side=side==='left'?'right':'left';stitch(sections[i][side],6);}
   }
  }else if(o.kind==='fill'){
   const fill=(angle,spacing,role)=>{if(!loops.length)return;const pending=[];const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t),rotate=p=>({x:p.x*c+p.y*s,y:-p.x*s+p.y*c}),back=p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}),rings=loops.map(loop=>loop.map(rotate)),ys=rings.flatMap(p=>p.map(q=>q.y));let row=0;
    for(let y=Math.min(...ys)+spacing/2;y<Math.max(...ys);y+=spacing,row++){const xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>y)!==(b.y>y))xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}xs.sort((a,b)=>a-b);const spans=[];for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>.03)spans.push([back({x:xs[i]+.015,y}),back({x:xs[i+1]-.015,y})]);if(row%2)spans.reverse();for(const pair of spans)pending.push(pair);if(pending.length>6000)throw Error('Contornos complexos demais. Simplifique a arte ou separe em regiões.');}
    while(pending.length){let at=0,best=Infinity;if(document.optimize!==false)for(let i=0;i<pending.length;i++){const d=Math.min(distance(cursor,pending[i][0]),distance(cursor,pending[i][1]));if(d<best){best=d;at=i;}}if(document.smartTravel&&document.optimize!==false&&pending.length>1){let continuous=-1,cost=Math.min(3,best+2.5);for(let i=0;i<pending.length;i++){const pair=pending[i],a=distance(cursor,pair[0]),b=distance(cursor,pair[1]),q=a<=b?pair[0]:pair[1],d=Math.min(a,b);if(d<cost&&safe(cursor,q)){continuous=i;cost=d;}}if(continuous>=0)at=continuous;}
    const pair=pending.splice(at,1)[0];if(distance(cursor,pair[1])<distance(cursor,pair[0]))pair.reverse();go(pair[0],role);stitch(pair[1],o.length||2.8,role);}
   };
   // Premium fills: do not add a full crossing underlay on every small raster fragment.
   // Dense cross-underlay can double stitch count and make logos thick and rigid.
   const boundsArea=(objectBounds(o)?.maxX-objectBounds(o)?.minX)*(objectBounds(o)?.maxY-objectBounds(o)?.minY);
   const underlayArea=Number.isFinite(o.area)?o.area:boundsArea;
   if(o.underlay!==false&&(!o.raster||underlayArea>=35))fill((o.angle??45)+90,Math.max(2.5,(o.spacing||.4)*7),'underlay');
   fill(o.angle??45,o.spacing||.4,'cover');
  }
  if(metrics.stitches===before)issue(o,'empty','Objeto sem pontos. Confira a geometria e a largura.',origin,'error');
  const bounds=objectBounds(o);if(bounds&&(bounds.maxX-bounds.minX<1||bounds.maxY-bounds.minY<1))issue(o,'small','Detalhe pequeno: confira a escala e a cobertura.',origin);
 }
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=objectBounds(visible[i]),b=objectBounds(visible[j]);if(a&&b&&Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>.8&&Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY)>.8)issue(visible[j],'overlap','Objetos com áreas sobrepostas: confira a ordem, a base e a densidade no encontro.',{x:Math.max(a.minX,b.minX),y:Math.max(a.minY,b.minY)});}
 // Secure only newly digitized native runs. Imported commands remain untouched.
 const secured=[];for(let i=0;i<commands.length;i++){const p=commands[i],a=commands[i-1],next=commands[i+1];if(p.c===0&&p.role!=='imported'&&(!a||a.c!==0||a.object!==p.object)&&a&&(a.c===0||a.c===1)){const d=distance(a,p);if(d>.4){const q={...p,x:a.x+(p.x-a.x)*.35/d,y:a.y+(p.y-a.y)*.35/d,role:'tie'};secured.push(q,{...q,x:a.x,y:a.y},q);}}secured.push(p);if(p.c===0&&p.role!=='imported'&&(!next||next.c!==0||next.object!==p.object)&&a&&a.c===0){const d=distance(a,p);if(d>.4){const q={...p,x:p.x-(p.x-a.x)*.35/d,y:p.y-(p.y-a.y)*.35/d,role:'tie'};secured.push(q,{...p,role:'tie'});}}}
 commands.splice(0,commands.length);for(const p of secured)commands.push(p);metrics.stitches=metrics.jumps=metrics.trims=metrics.travel=metrics.thread=0;let metricCursor={x:0,y:0};for(const p of commands){if(p.c===0){metrics.stitches++;metrics.thread+=distance(metricCursor,p);}if(p.c===1){metrics.jumps++;metrics.travel+=distance(metricCursor,p);}if(p.c===2)metrics.trims++;if(p.c===0||p.c===1)metricCursor=p;}
 // Imported and generated commands get a geometric audit; warnings do not hide errors.
 let previous={x:0,y:0},lastNormal=null,steep=new Map(),short=new Map();for(const p of commands){if(p.c===0){const d=distance(previous,p);if(d>6.5)issues.push({object:p.object,type:'long',message:'Movimento bordado acima de 6,5 mm. Confira o trecho.',point:{...p},severity:'review'});if(d<.25&&d>.001&&p.role!=='tie')short.set(p.object,(short.get(p.object)||0)+1);
  if(lastNormal&&d>.5&&distance(lastNormal,previous)>.5){const ax=previous.x-lastNormal.x,ay=previous.y-lastNormal.y,bx=p.x-previous.x,by=p.y-previous.y,cos=(ax*bx+ay*by)/(Math.hypot(ax,ay)*d);if(cos>.75)steep.set(p.object,(steep.get(p.object)||0)+1);}lastNormal=previous;
 }else if(p.c===1||p.c===5||p.c===2)lastNormal=null;if(p.c===0||p.c===1)previous=p;}
 for(const [id,n] of short)if(n>80){const o=visible.find(o=>o.id===id);issue(o,'short',`${n} pontos abaixo de 0,25 mm: revise concentração e arremates.`,null);}
 const bounds=commands.filter(p=>p.c===0||p.c===1).reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
 if(Number.isFinite(bounds.minX)&&((bounds.maxX-bounds.minX)>document.hoop||(bounds.maxY-bounds.minY)>document.hoop))issues.push({type:'hoop',severity:'error',message:'Desenho maior que o bastidor escolhido.',point:{x:0,y:0}});
 if(metrics.trims>40&&!issues.some(i=>i.type==='cuts'))issues.push({type:'cuts',severity:'review',message:`${metrics.trims} cortes no projeto: compare o percurso e considere separar regiões.`,point:{x:0,y:0}});
 if(concealedJoins)issues.push({type:'concealed',severity:'review',message:`${concealedJoins} conexões passam sob preenchimentos posteriores. Valide a cobertura e a tensão em amostra; mover objetos recalcula estas rotas.`,point:{x:0,y:0}});
 const quality=auditQuality(commands,visible);issues.push(...quality.issues);
 const dedup=[];for(const i of issues){if(!dedup.some(j=>j.object===i.object&&j.type===i.type))dedup.push(i);}return {commands,issues:dedup,blocks,metrics,bounds,routing:{joinedTravel,concealedJoins},density:quality.cells};
}
