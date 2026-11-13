import {decision} from './policies/build-trade-components.js';
import {profile,profileHash} from './profile.js';
import {validateMemory,PLANNER_POLICY} from './contract.js';
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
self.onmessage=({data})=>{try{
 const {view,memory=null}=data;validateMemory(memory,view,profileHash);
 const result=decision(freeze(view),profile.parameters,0,memory?freeze(memory.data):null);
 const next={schemaVersion:1,policyVersion:PLANNER_POLICY,profileHash,gameId:view.id,actor:view.you,engineVersion:view.engineVersion,lastRevision:view.revision,data:result.memory};validateMemory(next,view,profileHash);
 // Plan diagnostics never enter UI packets, rules state or internet messages.
 self.postMessage({action:result.action,memory:next});
 }catch(error){self.postMessage({error:String(error.message).slice(0,240)});}};
