import {PLANNER_POLICY,validateMemory,supportedPolicy} from './contract.js';
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
export async function botProfile(view){const level=view.seats.find(s=>s.id===view.you)?.level||'standard';return level==='easy'?import('./easy-profile.js'):level==='hard'?import('./hard-profile.js'):import('./profile.js');}
export async function decideBot(view,memory=null,policy=PLANNER_POLICY){
 if(!supportedPolicy(policy))throw Error('Unsupported bot policy.');
 const {profile,profileHash}=await botProfile(view);validateMemory(memory,view,profileHash,policy);
 const {decision}=await import('./policies/purchase-policy.js'),result=decision(freeze(view),profile.parameters,0,memory?freeze(memory.data):null);
 const next={schemaVersion:1,policyVersion:policy,profileHash,gameId:view.id,actor:view.you,engineVersion:view.engineVersion,lastRevision:view.revision,data:result.memory};validateMemory(next,view,profileHash,policy);return {action:result.action,memory:next};
}
