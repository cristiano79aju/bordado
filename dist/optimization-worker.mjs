import {optimizeNativeProduction} from './production-optimizer.mjs';
self.onmessage=({data})=>{try{self.postMessage({ok:true,result:optimizeNativeProduction(data)})}catch(e){self.postMessage({ok:false,message:e.message})}};
