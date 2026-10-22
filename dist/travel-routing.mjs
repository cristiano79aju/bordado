import {distance,objectBounds,segmentInside} from './geometry.mjs';
// Conservative raster of future FULL fill interiors. No imported/satin/reference
// object can be used as a promise of future coverage. Holes retain parity.
export function futureCoverage(objects,step=.25){
 const fills=objects.map((o,index)=>({o,index,b:objectBounds(o)})).filter(({o,b})=>o.kind==='fill'&&(o.spacing||.4)<=.5&&b),bounds=fills.reduce((a,{b})=>({minX:Math.min(a.minX,b.minX),minY:Math.min(a.minY,b.minY),maxX:Math.max(a.maxX,b.maxX),maxY:Math.max(a.maxY,b.maxY)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
 if(!fills.length)return ()=>false;const w=Math.ceil((bounds.maxX-bounds.minX)/step)+4,h=Math.ceil((bounds.maxY-bounds.minY)/step)+4;if(w*h>1600000)return ()=>false;
 const origin={x:bounds.minX-step,y:bounds.minY-step},last=new Int16Array(w*h).fill(-1);
 for(const {o,index,b} of fills){const mask=new Uint8Array(w*h),rings=o.paths.map(p=>p.points.map(q=>({x:q.x+(o.x||0),y:q.y+(o.y||0)})));const lo=Math.max(1,Math.floor((b.minY-origin.y)/step)),hi=Math.min(h-2,Math.ceil((b.maxY-origin.y)/step));
  for(let y=lo;y<=hi;y++){const wy=origin.y+y*step,xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>wy)!==(b.y>wy))xs.push(a.x+(b.x-a.x)*(wy-a.y)/(b.y-a.y))}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)for(let x=Math.max(1,Math.ceil((xs[i]-origin.x)/step));x<=Math.min(w-2,Math.floor((xs[i+1]-origin.x)/step));x++)mask[y*w+x]=1;}
  // Two cells of clearance (0.5mm) keep future routes off color boundaries.
  for(let y=lo;y<=hi;y++)for(let x=Math.max(2,Math.floor((b.minX-origin.x)/step));x<=Math.min(w-3,Math.ceil((b.maxX-origin.x)/step));x++){const at=y*w+x;if(!mask[at])continue;let safe=true;for(let dy=-2;dy<=2&&safe;dy++)for(let dx=-2;dx<=2;dx++)if(y+dy<0||y+dy>=h||!mask[at+dy*w+dx]){safe=false;break}if(safe)last[at]=index;}
 }
 return (p,index)=>{const x=Math.round((p.x-origin.x)/step),y=Math.round((p.y-origin.y)/step);return x>=0&&y>=0&&x<w&&y<h&&last[y*w+x]>index;};
}
export function createTravelRouter(contains,future=()=>false,loops=null,used=new Map()){
 const step=.3,key=p=>Math.round(p.x/step)+','+Math.round(p.y/step);
 const allowed=p=>contains(p)||future(p);
 const segment=(a,b)=>{if(loops)return segmentInside(a,b,loops,future);const n=Math.max(2,Math.ceil(distance(a,b)/.08));for(let i=0;i<=n;i++)if(!allowed({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
 return (a,b)=>{
  const direct=distance(a,b);if(direct<.02||direct>6)return null;const max=Math.min(8,direct*2.5+.6);let route=null;
  if(segment(a,b))route=[b];
  else{
   const width=Math.ceil((Math.abs(b.x-a.x)+max*2)/step)+1,height=Math.ceil((Math.abs(b.y-a.y)+max*2)/step)+1,origin={x:Math.min(a.x,b.x)-max,y:Math.min(a.y,b.y)-max};
   const point=id=>({x:origin.x+(id%width)*step,y:origin.y+Math.floor(id/width)*step}),id=p=>Math.round((p.y-origin.y)/step)*width+Math.round((p.x-origin.x)/step),start=id(a),goal=id(b),g=new Map([[start,0]]),parent=new Map(),open=new Set([start]),closed=new Set(),allowedCache=new Map();
   if(!segment(a,point(start))||!segment(point(goal),b))return null;
   for(let iterations=0;open.size&&iterations<1200;iterations++){
    let at=-1,best=Infinity;for(const candidate of open){const f=g.get(candidate)+distance(point(candidate),b);if(f<best){best=f;at=candidate}}if(best>max)break;
    if(at===goal){route=[b];while(at!==start){route.unshift(point(at));at=parent.get(at)}route.unshift(point(start));break;}
    open.delete(at);closed.add(at);const p=point(at),x=at%width,y=Math.floor(at/width);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const xx=x+dx,yy=y+dy,next=yy*width+xx;if(xx<0||yy<0||xx>=width||yy>=height||closed.has(next))continue;const q=point(next);if(!allowedCache.has(next))allowedCache.set(next,allowed(q));if(!allowedCache.get(next)||!segment(p,q))continue;const value=g.get(at)+distance(p,q);if(value>max||value>=(g.get(next)??Infinity))continue;g.set(next,value);parent.set(next,at);open.add(next);}
   }
  }
  if(!route)return null;
  // Collapse grid stairs only if the whole shortcut stays in the allowed mask.
  const simple=[];let from=a;for(let i=0;i<route.length;){let j=i;while(j+1<route.length&&segment(from,route[j+1]))j++;simple.push(route[j]);from=route[j];i=j+1;}
  let length=0,previous=a;const touched=new Set();let hidden=false;for(const p of simple){length+=distance(previous,p);const n=Math.max(1,Math.ceil(distance(previous,p)/step));for(let i=0;i<=n;i++){const q={x:previous.x+(p.x-previous.x)*i/n,y:previous.y+(p.y-previous.y)*i/n};if(!contains(q))hidden=true;touched.add(key(q))}previous=p;}
  if(length>max||[...touched].some(k=>(used.get(k)||0)>=2))return null;
  for(const k of touched)used.set(k,(used.get(k)||0)+1);return {points:simple,hidden,length};
 };
}
