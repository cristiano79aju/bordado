import {compile} from './engine.mjs';
export function optimizeNativeProduction(input){
 const original=structuredClone(input),before=compile(original),baseline=before.metrics;let chosen=original,best=before;
 const accepts=m=>m.jumps<=baseline.jumps&&m.trims<=baseline.trims&&m.travel<=baseline.travel+.001&&m.thread+m.travel<=(baseline.thread+baseline.travel)*1.03+.01;
 const better=(a,b)=>a.jumps<b.jumps||a.jumps===b.jumps&&(a.trims<b.trims||a.trims===b.trims&&a.travel<b.travel-.001);
 for(const concealedTravel of [false,true]){const trial={...original,optimize:true,smartTravel:true,concealedTravel},p=compile(trial);if(accepts(p.metrics)&&better(p.metrics,best.metrics)){chosen=trial;best=p;}}
 const improved=chosen!==original;return {document:chosen,pattern:best,before:baseline,after:best.metrics,improved,joined:best.routing.joinedTravel,concealed:best.routing.concealedJoins};
}
