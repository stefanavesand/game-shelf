import {decision as legacy} from './policies/build-trade-components.js';
import {decision as current} from './policies/purchase-policy.js';
import * as oldProfile from './legacy-profile.js';
import {profile,profileHash} from './profile.js';
import {validateMemory,PLANNER_POLICY,LEGACY_POLICY,supportedPolicy} from './contract.js';
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
self.onmessage=({data})=>{try{
 const {view,memory=null,policy=PLANNER_POLICY}=data;if(!supportedPolicy(policy))throw Error('Unsupported bot policy.');
 const selected=policy===LEGACY_POLICY?oldProfile:{profile,profileHash},decision=policy===LEGACY_POLICY?legacy:current;
 validateMemory(memory,view,selected.profileHash,policy);
 const result=decision(freeze(view),selected.profile.parameters,0,memory?freeze(memory.data):null);
 const next={schemaVersion:1,policyVersion:policy,profileHash:selected.profileHash,gameId:view.id,actor:view.you,engineVersion:view.engineVersion,lastRevision:view.revision,data:result.memory};validateMemory(next,view,selected.profileHash,policy);
 // Plan diagnostics never enter UI packets, rules state or internet messages.
 self.postMessage({action:result.action,memory:next});
 }catch(error){self.postMessage({error:String(error.message).slice(0,240)});}};
