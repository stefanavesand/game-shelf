import {createHash} from 'node:crypto';
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {botDecision as tradePlanner} from './trade-policy.mjs';
import {botDecision as planner} from './planner-policy.mjs';
import {botDecision as parameterized} from './parameter-policy.js';
export function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const bytesHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function keys(value,expected,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!expected.includes(k))||expected.some(k=>!Object.hasOwn(value,k)))throw Error(`Invalid keys: ${label}`);}
export function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(`Invalid ${label}`);}
export function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const registry=freeze({
 settlementBase:{type:'number',unit:'legacy score',min:0,max:300,default:140},
 cityBase:{type:'number',unit:'legacy score',min:0,max:300,default:135},
 roadBase:{type:'number',unit:'legacy score',min:0,max:100,default:35},
 developmentBase:{type:'number',unit:'legacy score',min:0,max:200,default:80},
 bankTradeBase:{type:'number',unit:'legacy score',min:0,max:100,default:45},
 tradeAcceptBase:{type:'number',unit:'legacy score',min:0,max:100,default:25},
 noiseAmplitude:{type:'number',unit:'legacy score',min:0,max:35,default:0.01}
});
export const plannerRegistry=freeze({
 productionWeight:{type:'number',unit:'VP per expected card',min:0,max:0.5,default:0.08},
 horizonRolls:{type:'integer',unit:'dice rolls',min:4,max:24,default:12},
 etaPenaltyPerRoll:{type:'number',unit:'discount per roll',min:0.01,max:0.5,default:0.08},
 readinessWeight:{type:'number',unit:'VP utility',min:0,max:0.5,default:0.2},
 handReserveWeight:{type:'number',unit:'utility weight',min:0,max:2,default:0.7},
 expansionWeight:{type:'number',unit:'utility weight',min:0,max:1,default:0.08},
 developmentValue:{type:'number',unit:'expected VP utility',min:0,max:1,default:0.35},
 maxPlans:{type:'integer',unit:'plans',min:4,max:16,default:8},
 maxRoadCandidates:{type:'integer',unit:'one-road candidates',min:0,max:12,default:8},
 minActionGain:{type:'number',unit:'VP utility',min:0,max:0.25,default:0.005},
 noiseAmplitude:{type:'number',unit:'VP utility',min:0,max:0.1,default:0}
});
export const tradeRegistry=freeze({...plannerRegistry,
 minOwnUtilityGain:{type:'number',unit:'VP utility',min:0,max:0.25,default:0.01},
 retainedCardWeight:{type:'number',unit:'VP per retained card',min:0,max:0.05,default:0.005},
 leaderPenalty:{type:'number',unit:'VP utility',min:0,max:2,default:1.5},
 leaderPublicVp:{type:'integer',unit:'public VP',min:6,max:9,default:8},
 maxCardsPerSide:{type:'integer',unit:'cards',min:1,max:2,default:2},
 offersPerOwnTurn:{type:'integer',unit:'offers',min:0,max:2,default:1},
 rejectionCooldownOwnTurns:{type:'integer',unit:'completed own turns',min:0,max:3,default:1},
 maxTradeBuildPreviews:{type:'integer',unit:'immediate point-build previews',min:0,max:4,default:2},
 maxProposalBundles:{type:'integer',unit:'bundles',min:1,max:32,default:12},
 proposalDiscount:{type:'number',unit:'heuristic discount',min:0.1,max:1,default:0.65},
 publicSupplyWeight:{type:'number',unit:'public production affinity',min:0,max:1,default:0.5}
});
export const policyRegistry=version=>version==='trade-planner-0.1.0'?tradeRegistry:version==='planner-0.1.0'?plannerRegistry:version==='heuristic-1.1.0'?{}:registry;
export function template(id='heuristic-candidate',policyVersion='heuristic-params-0.1.0'){
 return {schemaVersion:1,id,policyVersion,featureSchemaVersion:1,level:'standard',parameters:policyVersion==='heuristic-1.1.0'?{}:Object.fromEntries(Object.entries(policyRegistry(policyVersion)).map(([k,v])=>[k,v.default]))};
}
export function validateProfile(input){
 keys(input,['schemaVersion','id','policyVersion','featureSchemaVersion','level','parameters'],'profile');
 if(input.schemaVersion!==1||input.featureSchemaVersion!==1||!['heuristic-1.1.0','heuristic-params-0.1.0','planner-0.1.0','trade-planner-0.1.0'].includes(input.policyVersion)||!['easy','standard'].includes(input.level)||typeof input.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.id))throw Error('Unsupported profile');
 const fields=policyRegistry(input.policyVersion),expected=Object.keys(fields);keys(input.parameters,expected,'parameters');
 for(const key of expected){const value=input.parameters[key],r=fields[key];if(r.type==='integer'&&!Number.isInteger(value))throw Error(`Invalid integer parameter: ${key}`);if(typeof value!=='number'||!Number.isFinite(value)||value<r.min||value>r.max)throw Error(`Invalid parameter: ${key}`);}
 if(Buffer.byteLength(canonical(input))>16384)throw Error('Profile too large');
 return freeze(structuredClone(input));
}
// Policy receives a cloned, frozen seat observation, never the authority snapshot.
export function decide(view,profile,decisionSeed){
 const observation=freeze(structuredClone(view));
 return profile.policyVersion==='heuristic-1.1.0'?baseline(observation,profile.level):(profile.policyVersion==='trade-planner-0.1.0'?tradePlanner:profile.policyVersion==='planner-0.1.0'?planner:parameterized)(observation,profile.level,profile.parameters,decisionSeed);
}
