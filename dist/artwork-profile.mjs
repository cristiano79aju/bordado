import {prepareRaster} from './raster.mjs';
import {digitizeLabels} from './digitizer.mjs';
export function artworkComplexity(objects){let nodes=0,maxContours=0;for(const o of objects){nodes+=o.paths.reduce((n,p)=>n+p.points.length,0);maxContours=Math.max(maxContours,o.paths.length)}return {nodes,maxContours,needsDetail:nodes>24000||maxContours>4000};}
export function analyzeArtworkRaster(rgba,w,h,{width=90,maxColors=8,removeWhite=true,mode='auto',source='Imagem',adaptive=false}={}){
 const {labels,palette,minX,maxX,minY,maxY,mergedFragments}=prepareRaster(rgba,w,h,{maxColors,removeWhite,mode,width});
 const unit=width/(maxX-minX+1),height=(maxY-minY+1)*unit;
 const objects=digitizeLabels(labels,w,h,palette,{unit,minX,minY,width,height,contourTolerance:mode==='delicate'?Math.max(.025,unit*.7):.025,mode:mode==='delicate'?'auto':mode==='gradient'?'contours':mode,source});
 for(const o of objects){o.preparation={mode,mergedFragments,adaptive};if(mode==='delicate'){o.detailProfile=true;o.length=o.kind==='running'?1.2:2.8;if(o.kind==='running')o.underlay=false;o.analysis.reason+=(adaptive?' Preparação delicada ativada automaticamente.':'')+' Textura da referência suavizada; confira cílios, olhos e contornos na escala final.';}if(mode==='gradient'){o.tonalProfile=true;o.angle=0;o.analysis.reason='Degradê aproximado por faixas de cores de linha, sem sobrepor preenchimentos completos. Confira a transição em amostra bordada.';}}
 return objects;
}
