// A geometric inspection aid, not a physical embroidery quality certificate.
export function auditQuality(commands,objects){
 const cells=new Map(),longFloats=new Map();let previous={x:0,y:0},cut=true;
 for(const p of commands){if(p.c===2||p.c===5)cut=true;if(p.c===1&&!cut&&Math.hypot(p.x-previous.x,p.y-previous.y)>3){const n=longFloats.get(p.object)||{n:0,point:p};n.n++;longFloats.set(p.object,n)}if(p.c===0){const x=Math.floor(p.x),y=Math.floor(p.y),key=x+','+y;let cell=cells.get(key);if(!cell){cell={x,y,count:0,cover:0,object:p.object};cells.set(key,cell)}cell.count++;if(p.role!=='tie'&&p.role!=='underlay')cell.cover++;cut=false;}if(p.c===0||p.c===1)previous=p;}
 const issues=[],byObject=new Map();for(const c of cells.values())if(c.cover>18||c.count>35){const old=byObject.get(c.object);if(!old||c.count>old.count)byObject.set(c.object,c)}
 for(const [object,c]of byObject)issues.push({object,type:'concentration',severity:'review',point:{x:c.x+.5,y:c.y+.5},message:`Concentração de ${c.count} perfurações em uma célula de 1 mm². Confira encontros e arremates.`});
 for(const [object,item]of longFloats)issues.push({object,type:'floating',severity:'review',point:item.point,message:`${item.n} saltos acima de 3 mm sem corte explícito. Confira o fio entre as partes e o comportamento da máquina.`});
 for(const o of objects)if(o.analysis?.coverage!==null&&o.analysis?.coverage!==undefined&&o.kind==='satin'&&o.analysis.coverage<.95)issues.push({object:o.id,type:'coverage',severity:'review',point:{x:o.x||0,y:o.y||0},message:`Cobertura geométrica estimada de ${Math.round(o.analysis.coverage*100)}% na análise da arte. Revise terminais e encontros.`});
 return {cells:[...cells.values()],issues};
}
