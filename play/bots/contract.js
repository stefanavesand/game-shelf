export const PLANNER_POLICY='development-investment-0.1.0';
export const LEGACY_POLICY='build-trade-0.2.0';
export const supportedPolicy=policy=>[PLANNER_POLICY,LEGACY_POLICY].includes(policy);
const keys=(v,names)=>v&&Object.keys(v).sort().join('|')===[...names].sort().join('|');
export function validateMemory(memory,view,profileHash,policy=PLANNER_POLICY){
 if(memory===null)return;
 if(!keys(memory,['schemaVersion','policyVersion','profileHash','gameId','actor','engineVersion','lastRevision','data'])||!keys(memory.data,['schemaVersion','goalKey'])||memory.schemaVersion!==1||memory.policyVersion!==policy||memory.profileHash!==profileHash||memory.gameId!==view.id||memory.actor!==view.you||memory.engineVersion!==view.engineVersion||!Number.isSafeInteger(memory.lastRevision)||memory.lastRevision<0||memory.lastRevision>view.revision||memory.data.schemaVersion!==1||memory.data.goalKey!==null&&(typeof memory.data.goalKey!=='string'||memory.data.goalKey.length>128)||new TextEncoder().encode(JSON.stringify(memory)).length>4096)throw Error('The saved bot plan is incompatible. The last saved move is preserved.');
}
