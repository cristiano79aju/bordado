import assert from 'node:assert/strict';
import {planLayers,validateLayerPlan} from '../dist/layer-planner.mjs';
const rect=(id,x,y,w,h,color,kind='fill')=>({id,name:id,kind,color,x:0,y:0,paths:[{points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]}]});
const cases=[
 {name:'rena natalina (estrutura sintética)',objects:[rect('fundo',0,0,100,100,'#173c80'),rect('folhas',15,25,65,55,'#238443'),rect('corpo-rena',30,20,45,50,'#9b623c'),rect('chifres',38,10,28,20,'#7a4b2a'),rect('olhos-frutos',47,29,8,8,'#d82131'),rect('acabamento',49,31,3,3,'#f2cc42')]},
 {name:'Nossa Senhora (estrutura sintética)',objects:[rect('fundo',0,0,100,100,'#e9e0d0'),rect('auréola',30,8,40,40,'#d9aa30'),rect('manto',22,15,56,75,'#2049a0'),rect('vestido',35,28,30,45,'#f0e7db'),rect('rosto-maos',43,25,14,25,'#d8a078'),rect('coroa-terço-detalhes',45,20,10,9,'#c7a02c')]},
 {name:'desenho vermelho 86 (estrutura sintética)',objects:[rect('fundo',0,0,100,100,'#ffffff'),rect('bandeira',8,15,30,24,'#d51d2a'),rect('numero-86',28,20,45,45,'#d51d2a'),rect('folhas',25,55,45,25,'#d51d2a'),rect('contornos',30,23,35,35,'#d51d2a','running')]},
 {name:'renda floral (estrutura sintética)',objects:[rect('base-renda',0,0,100,100,'#ffffff'),rect('estrutura',10,20,80,60,'#d8d1c2','running'),rect('folhas',20,25,60,45,'#2c844c','running'),rect('flores',30,30,40,30,'#e4a1b8'),rect('acabamentos',43,38,14,14,'#f7d24a','running')]}
];
for(const fixture of cases){
 const plan=planLayers(fixture.objects);
 assert.equal(plan.summary.objects,fixture.objects.length,fixture.name);
 assert.equal(new Set(plan.order).size,fixture.objects.length,fixture.name+' no lost objects');
 assert.deepEqual(validateLayerPlan(fixture.objects,plan).issues,[],fixture.name+' dependency order');
 const background=fixture.objects.find(o=>o.id==='fundo'||o.id==='base-renda');
 if(background)assert.equal(plan.order[0],background.id,fixture.name+' background first');
 assert(plan.summary.layers>=2,fixture.name+' dynamic layers');
 console.log(fixture.name,JSON.stringify({layers:plan.summary.layers,objects:plan.summary.objects,colors:plan.summary.colors,dependencies:plan.dependencies.length,order:plan.order}));
}
console.log('Four synthetic layer archetypes passed. These are geometry fixtures, not the user's original image files.');
