import {botProfile,decideBot} from './decision.js';
import {validateMemory,PLANNER_POLICY,supportedPolicy} from './contract.js';
export function createPlannerRunner({workerFactory=typeof Worker==='function'?()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}):null,timeoutMs=5000}={}){
 return {async decide(view,memory=null,policy=memory?.policyVersion||PLANNER_POLICY){
  if(!supportedPolicy(policy))throw Error('Unsupported bot policy.');
  const {profileHash}=await botProfile(view);validateMemory(memory,view,profileHash,policy);
  if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Bot observation exceeds its work budget.');
  if(!workerFactory)return decideBot(structuredClone(view),memory?structuredClone(memory):null,policy);
  return new Promise((resolve,reject)=>{let worker,timer,done=false;
   const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();error?reject(error):resolve(result);};
   try{worker=workerFactory();worker.onmessage=({data})=>{try{if(data?.error)throw Error(data.error);if(!data?.action||typeof data.action.type!=='string'||JSON.stringify(data.action).length>16384)throw Error('Invalid bot proposal.');validateMemory(data.memory,view,profileHash,policy);finish(null,data);}catch(error){finish(error);}};
    worker.onerror=()=>finish(Error('The bot could not run. The last saved move is preserved.'));
    timer=setTimeout(()=>finish(Error('The bot timed out. The last saved move is preserved.')),timeoutMs);worker.postMessage({view,memory,policy});
   }catch(error){finish(error);}
  });
 }};
}
