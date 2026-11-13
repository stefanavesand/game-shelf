import {validateMemory} from './contract.js';
export function createPlannerRunner({workerFactory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),timeoutMs=5000}={}){
 return {async decide(view,memory=null){
  const {profileHash}=await import('./profile.js');validateMemory(memory,view,profileHash);
  if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Bot observation exceeds its work budget.');
  return new Promise((resolve,reject)=>{let worker,timer,done=false;
   const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();error?reject(error):resolve(result);};
   try{worker=workerFactory();worker.onmessage=({data})=>{try{if(data?.error)throw Error(data.error);if(!data?.action||typeof data.action.type!=='string'||JSON.stringify(data.action).length>16384)throw Error('Invalid bot proposal.');validateMemory(data.memory,view,profileHash);finish(null,data);}catch(error){finish(error);}};
    worker.onerror=()=>finish(Error('The experimental bot could not run. The last saved move is preserved.'));
    timer=setTimeout(()=>finish(Error('The experimental bot timed out. The last saved move is preserved.')),timeoutMs);worker.postMessage({view,memory});
   }catch(error){finish(error);}
  });
 }};
}
