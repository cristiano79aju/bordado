export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function resample(points,step){if(points.length<2)return points;let out=[{...points[0]}],carry=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);if(length<1e-8)continue;let position=0;while(carry+length-position>=step){position+=step-carry;out.push({x:a.x+(b.x-a.x)*position/length,y:a.y+(b.y-a.y)*position/length});carry=0;}carry+=length-position;}if(distance(out.at(-1),points.at(-1))>step*.15)out.push({...points.at(-1)});return out;}
export function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {distance:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t),t,point:{x:a.x+dx*t,y:a.y+dy*t}};}
export function insidePolygon(p,loops){let inside=false;for(const loop of loops){for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}return inside;}
export function objectBounds(object){
 const clipped=object.clipToArtwork&&object.artworkContours?.length;const points=object.kind==='machine'?object.commands.filter(p=>p.c===0||p.c===1):(clipped?object.artworkContours:object.paths).flatMap(p=>p.points);
 if(!points.length)return null;
 const ox=object.x||0,oy=object.y||0,pad=object.kind==='satin'?(clipped?(object.pull||0):Math.max(object.width||1.2,...object.paths.map(p=>p.width||0))/2+(object.pull||0)):0;
 const b=points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
 return {minX:b.minX+ox-pad,maxX:b.maxX+ox+pad,minY:b.minY+oy-pad,maxY:b.maxY+oy+pad};
}
export function simplify(points,tolerance=.08){if(points.length<4)return points;function rdp(list){let max=0,at=0;for(let i=1;i<list.length-1;i++){const d=pointSegment(list[i],list[0],list.at(-1)).distance;if(d>max){max=d;at=i;}}if(max<=tolerance)return [list[0],list.at(-1)];return [...rdp(list.slice(0,at+1)).slice(0,-1),...rdp(list.slice(at))];}return rdp(points);}
export function segmentCrosses(a,b,c,d){const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),p=cross(a,b,c)*cross(a,b,d),q=cross(c,d,a)*cross(c,d,b);return p< -1e-8&&q< -1e-8;}
// Test every interval separated by exact polygon-edge intersections. Sampling
// alone can miss a short corner crossing through a hole.
export function segmentInside(a,b,loops,extra=null){const dx=b.x-a.x,dy=b.y-a.y,cuts=[0,1];for(const ring of loops)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const p=ring[j],q=ring[i],ex=q.x-p.x,ey=q.y-p.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const px=p.x-a.x,py=p.y-a.y,t=(px*ey-py*ex)/den,u=(px*dy-py*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t)}if(extra){const n=Math.ceil(Math.hypot(dx,dy)/.08);for(let i=1;i<n;i++)cuts.push(i/n)}cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){if(cuts[i]-cuts[i-1]<1e-10)continue;const t=(cuts[i]+cuts[i-1])/2,p={x:a.x+dx*t,y:a.y+dy*t};if(!insidePolygon(p,loops)&&!extra?.(p))return false;}return true;}
