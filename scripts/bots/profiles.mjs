import {decision as purchaseDecision} from './purchase-policy.mjs';
import {decision as robberDecision} from './robber-policy.mjs';
import {decision as buildTradeComponents} from './build-trade-components.mjs';
import {createHash} from 'node:crypto';
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {decision as buildTradeDecision} from './build-trade-policy.mjs';
import {decision as sharedPlanDecision} from './shared-plan-policy.mjs';
import {botDecision as resourceComponents} from './resource-components.mjs';
import {botDecision as resourcePlanner} from './resource-policy.mjs';
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
export const resourceRegistry=freeze({...Object.fromEntries(Object.entries(plannerRegistry).filter(([key])=>!['minActionGain','noiseAmplitude'].includes(key))),
 cardReserveWeight:{type:'number',unit:'VP utility per scarce retained card',min:0,max:0.1,default:0.01},
 resourceCardThreshold:{type:'number',unit:'minimum resource-card utility gain',min:0,max:1,default:0.08},
 cardOpportunityMargin:{type:'number',unit:'utility margin over an immediate build/bank alternative',min:0,max:1,default:0.02},
 maxDiscardCandidates:{type:'integer',unit:'validated discard bundles',min:8,max:128,default:32},
 maxCardBuildComparisons:{type:'integer',unit:'immediate economic action previews',min:0,max:16,default:4},
 allowResourceCardBeforeRoll:{type:'integer',unit:'0 defer resource cards; 1 allow before rolling',min:0,max:1,default:0}
});
export const resourceComponentRegistry=freeze({...resourceRegistry,
 enableGoalDiscard:{type:'integer',unit:'0 frozen discard; 1 goal-aware discard',min:0,max:1,default:1},
 enableResourceCards:{type:'integer',unit:'0 frozen resource-card decisions; 1 whole-hand valuation/timing',min:0,max:1,default:1}
});
export const sharedPlanRegistry=freeze({
 maxRouteLength:{type:'integer',unit:'new roads per site plan',min:0,max:3,default:2},
 maxGraphNodes:{type:'integer',unit:'expanded public vertices',min:8,max:128,default:96},
 horizonRolls:{type:'integer',unit:'acquisition-estimate rolls',min:4,max:48,default:24},
 productionWeight:{type:'number',unit:'VP per expected production card',min:0,max:0.5,default:0.08},
 etaPenalty:{type:'number',unit:'utility discount per roll',min:0.01,max:1,default:0.1},
 readinessWeight:{type:'number',unit:'utility per completed resource fraction',min:0,max:1,default:0.2},
 routePenalty:{type:'number',unit:'utility per remaining road',min:0,max:0.5,default:0.05},
 switchMargin:{type:'number',unit:'utility improvement required to abandon a valid goal',min:0,max:2,default:0.15},
 developmentValue:{type:'number',unit:'expected development purchase utility',min:0,max:1,default:0.35},
 reserveWeight:{type:'number',unit:'utility per retained card',min:0,max:0.05,default:0.005},
 cardUseThreshold:{type:'number',unit:'minimum same-goal resource-card gain',min:0,max:1,default:0.05},
 maxDiscardCandidates:{type:'integer',unit:'validated same-goal discard bundles',min:8,max:128,default:24},
 urgentPublicVp:{type:'integer',unit:'opponent public VP urgency boundary',min:6,max:9,default:8},
 urgentEtaWeight:{type:'number',unit:'extra ETA discount per public race point',min:0,max:2,default:0.5}
});
export const buildTradeRegistry=freeze({...sharedPlanRegistry,
 discardRiskWeight:{type:'number',unit:'utility per expected card discarded on next roll',min:0,max:0.5,default:0.08},
 tradeMinGain:{type:'number',unit:'minimum same-goal utility gain',min:0.001,max:0.5,default:0.01},
 tradeMaxGive:{type:'integer',unit:'maximum single-resource cards offered for one card',min:1,max:2,default:2},
 tradeOffersPerTurn:{type:'integer',unit:'outgoing offers and counters per active turn',min:0,max:2,default:1},
 tradeCooldownOwnTurns:{type:'integer',unit:'own end-turn observations before retrying declined terms',min:0,max:4,default:1},
 tradeProposalDiscount:{type:'number',unit:'speculative proposal utility fraction',min:0.1,max:1,default:0.75},
 tradeLeaderPenalty:{type:'number',unit:'utility penalty per card to a public near-winner',min:0,max:2,default:0.2},
 tradeLeaderVp:{type:'integer',unit:'public VP threat boundary',min:5,max:9,default:7}
});
export const buildTradeComponentRegistry=freeze({...buildTradeRegistry,enableCounterOffers:{type:'integer',unit:'0 decline instead of counter; 1 unchanged counteroffers',min:0,max:1,default:1}});
export const robberRegistry=freeze({...buildTradeComponentRegistry,
 enableRobberValuation:{type:'integer',unit:'0 previous robber choices; 1 public production/threat value',min:0,max:1,default:1},
 enableKnightTiming:{type:'integer',unit:'0 previous Knight use; 1 retain when gain is insufficient',min:0,max:1,default:1},
 robberExpectedRolls:{type:'integer',unit:'expected blocked rolls, heuristic horizon',min:1,max:12,default:4},
 robberOwnProductionWeight:{type:'number',unit:'own production protection multiplier',min:0.5,max:5,default:2},
 robberThreatWeight:{type:'number',unit:'public VP and near-winner weight',min:0,max:5,default:1.5},
 robberThreatVp:{type:'integer',unit:'public near-winner boundary',min:5,max:9,default:7},
 robberPlanResourceWeight:{type:'number',unit:'own missing-goal resource multiplier',min:0,max:3,default:1},
 robberStealValue:{type:'number',unit:'neutral unknown-card plus public theft-denial utility',min:0,max:0.5,default:0.05},
 knightArmyProgressWeight:{type:'number',unit:'bounded public army-distance utility',min:0,max:1,default:0.25},
 knightHoldValue:{type:'number',unit:'utility of retaining a playable Knight',min:0,max:1,default:0.04},
 knightMinGain:{type:'number',unit:'minimum net Knight utility',min:0,max:0.5,default:0.02},
 knightOtherCardWeight:{type:'number',unit:'weight of legal same-goal resource-card gain',min:0,max:2,default:1}
});
export const purchaseRegistry=freeze({...robberRegistry,
 enablePurchaseValuation:{type:'integer',unit:'0 previous purchases; 1 state-dependent investment',min:0,max:1,default:1},
 purchaseVpValue:{type:'number',unit:'VP utility',min:0,max:2,default:1},
 purchaseLateVpWeight:{type:'number',unit:'late-game VP multiplier increment',min:0,max:2,default:0.5},
 purchaseKnightValue:{type:'number',unit:'neutral Knight utility',min:0,max:2,default:0.4},
 purchaseArmyWeight:{type:'number',unit:'army-distance utility multiplier',min:0,max:2,default:0.6},
 purchaseRoadValue:{type:'number',unit:'feasible free-road utility',min:0,max:2,default:0.6},
 purchaseResourceValue:{type:'number',unit:'resource-card goal utility',min:0,max:2,default:0.5},
 purchaseMonopolyDiscount:{type:'number',unit:'uncertain future Monopoly discount',min:0,max:1,default:0.5},
 purchaseDelayDiscount:{type:'number',unit:'new action-card delay discount',min:0,max:1,default:0.8},
 purchaseQueuePenalty:{type:'number',unit:'penalty per owned unplayed action card',min:0,max:2,default:0.5},
 purchaseMinValue:{type:'number',unit:'minimum investment utility, not a hand-risk trigger',min:0,max:1,default:0.05}
});
export const policyRegistry=version=>version==='development-investment-0.1.0'?purchaseRegistry:version==='robber-knight-0.1.0'?robberRegistry:version==='build-trade-0.2.0'?buildTradeComponentRegistry:version==='build-trade-0.1.0'?buildTradeRegistry:version==='shared-plan-0.1.0'?sharedPlanRegistry:version==='resource-heuristic-0.2.0'?resourceComponentRegistry:version==='resource-heuristic-0.1.0'?resourceRegistry:version==='trade-planner-0.1.0'?tradeRegistry:version==='planner-0.1.0'?plannerRegistry:version==='heuristic-1.1.0'?{}:registry;
export function template(id='heuristic-candidate',policyVersion='heuristic-params-0.1.0'){
 return {schemaVersion:1,id,policyVersion,featureSchemaVersion:1,level:'standard',parameters:policyVersion==='heuristic-1.1.0'?{}:Object.fromEntries(Object.entries(policyRegistry(policyVersion)).map(([k,v])=>[k,v.default]))};
}
export function validateProfile(input){
 keys(input,['schemaVersion','id','policyVersion','featureSchemaVersion','level','parameters'],'profile');
 if(input.schemaVersion!==1||input.featureSchemaVersion!==1||!['development-investment-0.1.0','heuristic-1.1.0','heuristic-params-0.1.0','planner-0.1.0','trade-planner-0.1.0','resource-heuristic-0.1.0','resource-heuristic-0.2.0','robber-knight-0.1.0','build-trade-0.2.0','build-trade-0.1.0','shared-plan-0.1.0'].includes(input.policyVersion)||!['easy','standard'].includes(input.level)||typeof input.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.id))throw Error('Unsupported profile');
 if(['development-investment-0.1.0','resource-heuristic-0.1.0','resource-heuristic-0.2.0','robber-knight-0.1.0','build-trade-0.2.0','build-trade-0.1.0','shared-plan-0.1.0'].includes(input.policyVersion)&&input.level!=='standard')throw Error('Resource experiment has no calibrated Easy profile');
 const fields=policyRegistry(input.policyVersion),expected=Object.keys(fields);keys(input.parameters,expected,'parameters');
 for(const key of expected){const value=input.parameters[key],r=fields[key];if(r.type==='integer'&&!Number.isInteger(value))throw Error(`Invalid integer parameter: ${key}`);if(typeof value!=='number'||!Number.isFinite(value)||value<r.min||value>r.max)throw Error(`Invalid parameter: ${key}`);}
 if(Buffer.byteLength(canonical(input))>16384)throw Error('Profile too large');
 return freeze(structuredClone(input));
}
// Policy receives a cloned, frozen seat observation, never the authority snapshot.
export function decide(view,profile,decisionSeed){
 if(['development-investment-0.1.0','shared-plan-0.1.0','build-trade-0.1.0','build-trade-0.2.0','robber-knight-0.1.0'].includes(profile.policyVersion))return decideWithMemory(view,profile,decisionSeed).action;
 const observation=freeze(structuredClone(view));
 return profile.policyVersion==='heuristic-1.1.0'?baseline(observation,profile.level):(profile.policyVersion==='resource-heuristic-0.2.0'?resourceComponents:profile.policyVersion==='resource-heuristic-0.1.0'?resourcePlanner:profile.policyVersion==='trade-planner-0.1.0'?tradePlanner:profile.policyVersion==='planner-0.1.0'?planner:parameterized)(observation,profile.level,profile.parameters,decisionSeed);
}

// Goal memory belongs to one seat/game/profile, separate from authoritative rules.
export function decideWithMemory(view,profile,decisionSeed,memory=null){
 if(!['development-investment-0.1.0','shared-plan-0.1.0','build-trade-0.1.0','build-trade-0.2.0','robber-knight-0.1.0'].includes(profile.policyVersion)){if(memory!==null)throw Error('This policy does not accept plan memory');return {action:decide(view,profile,decisionSeed),memory:null,diagnostics:null};}
 const profileHash=hash(profile);
 if(memory!==null){
  keys(memory,['schemaVersion','policyVersion','profileHash','gameId','actor','engineVersion','lastRevision','data'],'plan memory');
  keys(memory.data,['schemaVersion','goalKey'],'plan memory data');
  if(memory.schemaVersion!==1||memory.policyVersion!==profile.policyVersion||memory.profileHash!==profileHash||memory.gameId!==view.id||memory.actor!==view.you||memory.engineVersion!==view.engineVersion||!Number.isSafeInteger(memory.lastRevision)||memory.lastRevision<0||memory.lastRevision>view.revision||memory.data.schemaVersion!==1||memory.data.goalKey!==null&&(typeof memory.data.goalKey!=='string'||memory.data.goalKey.length>128)||Buffer.byteLength(canonical(memory))>4096)throw Error('Incompatible plan memory');
 }
 const policy=profile.policyVersion==='development-investment-0.1.0'?purchaseDecision:profile.policyVersion==='robber-knight-0.1.0'?robberDecision:profile.policyVersion==='build-trade-0.2.0'?buildTradeComponents:profile.policyVersion==='build-trade-0.1.0'?buildTradeDecision:sharedPlanDecision;
 const result=policy(freeze(structuredClone(view)),profile.parameters,decisionSeed,memory?freeze(structuredClone(memory.data)):null);
 const next={schemaVersion:1,policyVersion:profile.policyVersion,profileHash,gameId:view.id,actor:view.you,engineVersion:view.engineVersion,lastRevision:view.revision,data:result.memory};
 if(Buffer.byteLength(canonical(next))>4096)throw Error('Plan memory exceeds budget');
 return freeze({action:result.action,memory:next,diagnostics:result.diagnostics?{reason:result.reason,...result.diagnostics}:null});
}
