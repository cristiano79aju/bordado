// Deterministic edge-aware texture reduction and bounded thread-palette fitting.
export function prepareRaster(rgba,w,h,{maxColors=6,removeWhite=true,mode='auto',width=90}={}){
 const delicate=mode==='delicate',tonal=mode==='gradient',pixels=rgba.slice();
 const transparent=rgba.some((v,i)=>i%4===3&&v<128);
 const valid=i=>rgba[i*4+3]>127&&!(removeWhite&&!transparent&&rgba[i*4]>239&&rgba[i*4+1]>239&&rgba[i*4+2]>239);
 // Ignore the photographic thread texture; retain high contrast linework.
 if(delicate||tonal){const radius=delicate?3:2,range=delicate?42:65;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!valid(i))continue;let weight=0,sum=[0,0,0];for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(!valid(j))continue;const d=[0,1,2].reduce((n,k)=>n+(rgba[i*4+k]-rgba[j*4+k])**2,0),a=Math.exp(-d/(2*range*range)-(dx*dx+dy*dy)/(radius*radius));weight+=a;for(let k=0;k<3;k++)sum[k]+=rgba[j*4+k]*a;}for(let k=0;k<3;k++)pixels[i*4+k]=Math.round(sum[k]/weight);}}
 let minX=w,maxX=-1,minY=h,maxY=-1;const bins=new Map();
 for(let i=0;i<w*h;i++)if(valid(i)){const x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const rgb=[pixels[i*4],pixels[i*4+1],pixels[i*4+2]],key=rgb.map(v=>v>>4).join(',');let bin=bins.get(key);if(!bin){bin={sum:[0,0,0],count:0};bins.set(key,bin)}for(let k=0;k<3;k++)bin.sum[k]+=rgb[k];bin.count++;}
 if(!bins.size)throw Error('A imagem ficou vazia. Desative a remoção do branco.');
 const samples=[...bins.values()].map(b=>({rgb:b.sum.map(v=>v/b.count),count:b.count})),d2=(a,b)=>a.reduce((s,v,k)=>s+(v-b[k])**2,0),palette=[];
 samples.sort((a,b)=>b.count-a.count);palette.push(samples[0].rgb.slice());
 while(palette.length<Math.min(maxColors,samples.length)){let best=null,score=-1;for(const b of samples){const d=Math.min(...palette.map(p=>d2(p,b.rgb))),s=d*Math.sqrt(b.count);if(s>score){score=s;best=b}}if(score<1)break;palette.push(best.rgb.slice())}
 // Keep a genuinely dark feature color in delicate drawings (eyes, eyelashes).
 if(delicate&&palette.length>1){const dark=samples.filter(b=>b.count>=3).sort((a,b)=>a.rgb.reduce((s,v)=>s+v,0)-b.rgb.reduce((s,v)=>s+v,0))[0];if(dark&&Math.max(...dark.rgb)<95)palette[palette.length-1]=dark.rgb.slice();}
 const nearest=p=>{let at=0,best=Infinity;palette.forEach((c,k)=>{const d=d2(c,p);if(d<best){best=d;at=k}});return at};
 for(let iteration=0;iteration<8;iteration++){const acc=palette.map(()=>({sum:[0,0,0],count:0}));for(const b of samples){const a=acc[nearest(b.rgb)];a.count+=b.count;for(let k=0;k<3;k++)a.sum[k]+=b.rgb[k]*b.count}for(let j=0;j<palette.length;j++)if(acc[j].count)palette[j]=acc[j].sum.map(v=>v/acc[j].count);}
 const labels=new Int16Array(w*h).fill(-1);for(let i=0;i<w*h;i++)if(valid(i))labels[i]=nearest([pixels[i*4],pixels[i*4+1],pixels[i*4+2]]);
 if(delicate){for(let pass=0;pass<3;pass++){const previous=labels.slice();for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=y*w+x,current=previous[at];if(current<0)continue;const counts=new Uint8Array(palette.length);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){const c=previous[yy*w+xx];if(c>=0)counts[c]++;}}let best=current;for(let c=0;c<counts.length;c++)if(counts[c]>counts[best])best=c;if(best!==current&&counts[best]>=10&&counts[current]<=6&&d2(palette[current],palette[best])<11000)labels[at]=best;}}}
 let mergedFragments=0;
 if(delicate||tonal){const seen=new Uint8Array(labels.length),unit=width/(maxX-minX+1),limit=delicate?Math.max(2,Math.floor(.5/(unit*unit))):2;for(let seed=0;seed<labels.length;seed++){if(seen[seed]||labels[seed]<0)continue;const color=labels[seed],queue=[seed],neighbors=new Uint32Array(palette.length);seen[seed]=1;for(let at=0;at<queue.length;at++){const i=queue[at],x=i%w,y=Math.floor(i/w);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&labels[j]>=0){if(labels[j]!==color)neighbors[labels[j]]++;else if(!seen[j]){seen[j]=1;queue.push(j)}}}if(queue.length>limit)continue;let best=-1;for(let c=0;c<neighbors.length;c++)if(neighbors[c]&&d2(palette[c],palette[color])<(delicate?11000:2000)&&(best<0||neighbors[c]>neighbors[best]))best=c;if(best>=0){for(const i of queue)labels[i]=best;mergedFragments++;}}}
 return {labels,mergedFragments,palette:palette.map(c=>c.map(v=>Math.round(v))),minX,maxX,minY,maxY,transparent};
}
