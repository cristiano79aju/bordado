import {distance,resample,insidePolygon} from './geometry.mjs';
// Nearest positive intersection of a ray with an even-odd polygon boundary.
function rayLimit(p,dx,dy,loops){let best=Infinity;for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i],ex=b.x-a.x,ey=b.y-a.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-9)continue;const qx=a.x-p.x,qy=a.y-p.y,t=(qx*ey-qy*ex)/det,u=(qx*dy-qy*dx)/det;if(t>=-1e-6&&u>=-1e-6&&u<=1+1e-6)best=Math.min(best,Math.max(0,t));}return best;}
export function buildColumn(path,{step=.2,width=1.2,pull=0,loops=null}={}){
 const points=path.points,centers=resample(points,step),widths=path.widths,sections=[];let total=0,at=0,edgeStart=0,angle=null,limited=0,unsafe=false;
 const lengths=[];for(let i=1;i<points.length;i++){const d=distance(points[i-1],points[i]);lengths.push(d);total+=d;}
 for(let i=0;i<centers.length;i++){
  const p=centers[i],pos=i===centers.length-1?total:Math.min(total,i*step);while(at<lengths.length-1&&edgeStart+lengths[at]<pos){edgeStart+=lengths[at++];}
  const mix=Math.max(0,Math.min(1,(pos-edgeStart)/(lengths[at]||1))),base=widths?.length===points.length?widths[at]*(1-mix)+widths[Math.min(at+1,widths.length-1)]*mix:(path.width||width);
  const a=centers[Math.max(0,i-2)],b=centers[Math.min(centers.length-1,i+2)];let theta=Math.atan2(b.y-a.y,b.x-a.x);if(angle!==null){const delta=Math.atan2(Math.sin(theta-angle),Math.cos(theta-angle));if(Math.abs(delta)>.3){theta=angle+Math.sign(delta)*.3;limited++;}}angle=theta;
  const nx=-Math.sin(theta),ny=Math.cos(theta);let left=base/2,right=base/2;
  if(loops?.length){if(!insidePolygon(p,loops)){unsafe=true;continue;}left=Math.min(left,Math.max(0,rayLimit(p,nx,ny,loops)-.008));right=Math.min(right,Math.max(0,rayLimit(p,-nx,-ny,loops)-.008));}
  left+=pull;right+=pull;sections.push({center:p,left:{x:p.x+nx*left,y:p.y+ny*left},right:{x:p.x-nx*right,y:p.y-ny*right},width:left+right});
 }
 return {sections,limited,unsafe};
}
