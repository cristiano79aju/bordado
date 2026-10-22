// Original centerline alphabet. These are stitch columns, not rasterized system fonts.
const line=(...v)=>v.map(([x,y])=>({x,y}));
const arc=(cx,cy,rx,ry,start,end,n=18)=>Array.from({length:n+1},(_,i)=>({x:cx+rx*Math.cos(start+(end-start)*i/n),y:cy+ry*Math.sin(start+(end-start)*i/n)}));
const P=Math.PI;
const glyphs={
 A:[line([0,7],[2.5,0],[5,7]),line([1,4.5],[4,4.5])],
 B:[line([0,7],[0,0]),[...arc(0,1.75,4.5,1.75,-P/2,P/2,16)], [...arc(0,5.25,4.8,1.75,-P/2,P/2,16)]],
 C:[arc(2.5,3.5,2.5,3.5,P*.23,P*1.77,32)],
 D:[line([0,7],[0,0]),arc(0,3.5,5,3.5,-P/2,P/2,28)],
 E:[line([5,0],[0,0],[0,7],[5,7]),line([0,3.5],[4.2,3.5])],
 F:[line([5,0],[0,0],[0,7]),line([0,3.5],[4.2,3.5])],
 G:[[...arc(2.5,3.5,2.5,3.5,P*.22,P*1.77,30).reverse()],line([5,4],[3,4])],
 H:[line([0,0],[0,7]),line([0,3.5],[5,3.5]),line([5,0],[5,7])],
 I:[line([1,0],[4,0]),line([2.5,0],[2.5,7]),line([1,7],[4,7])],
 J:[line([5,0],[5,5]),arc(2.5,5,2.5,2,0,P,18)],
 K:[line([0,0],[0,7]),line([5,0],[0,3.5],[5,7])],
 L:[line([0,0],[0,7],[5,7])],
 M:[line([0,7],[0,0],[2.5,4],[5,0],[5,7])],
 N:[line([0,7],[0,0],[5,7],[5,0])],
 O:[arc(2.5,3.5,2.5,3.5,-P/2,P*1.5,44)],
 P:[line([0,7],[0,0]),arc(0,2,5,2,-P/2,P/2,24)],
 Q:[arc(2.5,3.5,2.5,3.5,-P/2,P*1.5,40),line([3.5,5.5],[5.6,7.6])],
 R:[line([0,7],[0,0]),arc(0,2,5,2,-P/2,P/2,24),line([1,4],[5,7])],
 S:[[...arc(2.5,1.75,2.5,1.75,-P*.12,-P*1.5,20),...arc(2.5,5.25,2.5,1.75,-P/2,P*.88,20)]],
 T:[line([0,0],[5,0]),line([2.5,0],[2.5,7])],
 U:[line([0,0],[0,4.5]),arc(2.5,4.5,2.5,2.5,P,0,22),line([5,4.5],[5,0])],
 V:[line([0,0],[2.5,7],[5,0])],
 W:[line([0,0],[1,7],[2.5,3.5],[4,7],[5,0])],
 X:[line([0,0],[5,7]),line([5,0],[0,7])],
 Y:[line([0,0],[2.5,3.5],[5,0]),line([2.5,3.5],[2.5,7])],
 Z:[line([0,0],[5,0],[0,7],[5,7])],
 '0':[arc(2.5,3.5,2.5,3.5,-P/2,P*1.5,40)],
 '1':[line([1,1.5],[2.5,0],[2.5,7]),line([.7,7],[4.3,7])],
 '2':[[...arc(2.5,1.8,2.5,1.8,P,P*2.25,24),...line([0,7],[5,7])]],
 '3':[[...arc(1.3,1.75,3.4,1.75,-P/2,P/2,18),...arc(1.3,5.25,3.4,1.75,-P/2,P/2,18)]],
 '4':[line([4,0],[0,4.5],[5,4.5]),line([4,0],[4,7])],
 '5':[line([5,0],[0,0],[0,3.1]),arc(1.5,5,3.5,2,-P*.6,P*.65,22)],
 '6':[[...arc(2.5,3.5,2.5,3.5,P*1.7,P*.5,26),...arc(2.5,5,2.5,2,P/2,-P*1.5,28)]],
 '7':[line([0,0],[5,0],[1,7])],
 '8':[arc(2.5,1.7,2.2,1.7,-P/2,P*1.5,26),arc(2.5,5.2,2.5,1.8,-P/2,P*1.5,26)],
 '9':[[...arc(2.5,2,2.5,2,-P/2,P*1.5,26),...line([5,2],[5,5],[3,7],[.5,7])]],
 '-':[line([.5,3.5],[4.5,3.5])],'.':[line([2.5,6.8],[2.5,7])],
 '&':[arc(2.5,2,1.8,2,P*.2,P*1.85,22),line([1,3],[5,7]),line([5,4],[1.5,7],[0,5])],
};
function splitCorners(points){let paths=[],current=[points[0]];for(let i=1;i<points.length-1;i++){current.push(points[i]);let a=points[i-1],b=points[i],c=points[i+1],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y},cos=(u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)||1);if(cos<.35){paths.push(current);current=[points[i]];}}current.push(points.at(-1));if(current.length>1)paths.push(current);return paths;}
export function lettering(text,{height=12,stroke=1.2,style='essential',tracking=1.6}={}){
 text=String(text).trim().toUpperCase();if(!text||text.length>40)throw Error('Digite de 1 a 40 caracteres.');
 const paths=[],missing=[],scale=height/7,squash=style==='condensed'?.76:1;let cursor=0;
 for(const char of text){if(char===' '){cursor+=height*.5;continue;}const decomposed=char.normalize('NFD'),base=decomposed[0],strokes=glyphs[base];if(!strokes){missing.push(char);continue;}
  const add=(points,label,thin=false)=>{for(const segment of splitCorners(points)){paths.push({points:segment.map(p=>({x:cursor+p.x*scale*squash,y:(p.y-3.5)*scale})),width:thin?Math.min(stroke,.8):stroke,label:char+' · '+label});}};
  strokes.forEach((points,i)=>add(points,'coluna '+(i+1)));
  const accent=decomposed.slice(1);if(accent.includes('\u0301'))add(line([2,-.8],[3,-1.8]),'acento',true);if(accent.includes('\u0300'))add(line([2,-1.8],[3,-.8]),'acento',true);if(accent.includes('\u0302'))add(line([1,-.8],[2.5,-1.8],[4,-.8]),'acento',true);if(accent.includes('\u0303'))add(line([.8,-1],[1.7,-1.6],[3.2,-.8],[4,-1.4]),'til',true);if(accent.includes('\u0327'))add(line([2.5,7.1],[3.1,8],[1.8,8.5]),'cedilha',true);
  cursor+=5*scale*squash+stroke+tracking;
 }
 if(missing.length)throw Error('Caracteres ainda sem coluna: '+[...new Set(missing)].join(' '));
 const xs=paths.flatMap(p=>p.points.map(q=>q.x)),center=(Math.min(...xs)+Math.max(...xs))/2;for(const path of paths)for(const p of path.points)p.x-=center;
 return {paths,meta:{text,height,stroke,style,tracking},width:cursor};
}
