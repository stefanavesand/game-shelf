// Experimental observation-only planner. Production rules remain authoritative.
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {COSTS,RESOURCES,applyEconomy} from '../../play/catan/rules/economy.js';
import {validSettlements,validRoads,bankRate} from '../../play/catan/rules/board.js';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {score} from '../../play/catan/rules/scoring.js';
const terrain={hills:'brick',forest:'lumber',mountains:'ore',fields:'grain',pasture:'wool'};
const own=(state,id)=>state.players.players.find(p=>p.id===id);
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
export function siteProduction(state,vertex){
 const out=Object.fromEntries(RESOURCES.map(r=>[r,0]));
 for(const t of state.board.tiles){const r=terrain[t.terrain];if(!r||!t.number||t.coord.q===state.board.robberLocation.q&&t.coord.r===state.board.robberLocation.r)continue;
  if(getHexVertices(t.coord).some(v=>vertexKey(v)===vertexKey(vertex)))out[r]+=(6-Math.abs(7-t.number))/36;
 }return out;
}
export function production(state,id){const out=Object.fromEntries(RESOURCES.map(r=>[r,0]));for(const b of state.board.buildings.filter(b=>b.playerId===id)){const rates=siteProduction(state,b.vertex);for(const r of RESOURCES)out[r]+=rates[r]*(b.type==='city'?2:1);}return out;}
// Fluid production approximation, evaluated at integer rolls. This is not an exact
// expected hitting time: correlation, future opponents and future bank inflows vary.
export function acquisitionRolls(state,id,cost,horizon){
 const player=own(state,id),rates=production(state,id),ratios=Object.fromEntries(RESOURCES.map(r=>[r,bankRate(state,id,r)]));
 for(let rolls=0;rolls<=horizon;rolls++){
  const stock=Object.fromEntries(RESOURCES.map(r=>[r,player.resources[r]+Math.min(state.game.bank[r],rates[r]*rolls)]));let credits=0,missing=0,possible=true;
  for(const r of RESOURCES){const deficit=Math.max(0,(cost[r]||0)-stock[r]);if(deficit>0){missing+=Math.ceil(deficit-1e-9);if(state.game.bank[r]-Math.min(state.game.bank[r],rates[r]*rolls)+1e-9<deficit)possible=false;}
   else credits+=Math.floor((stock[r]-(cost[r]||0)+1e-9)/ratios[r]);}
  if(possible&&credits>=missing)return rolls;
 }return Infinity;
}
export function buildPlans(state,id,p){
 const player=own(state,id),plans=[],estimates=new Map(),sites=validSettlements(state,id),seen=new Set(sites.map(vertexKey));
 const add=(type,cost,vertex,extra={})=>{const gain=type==='development'?p.developmentValue:1+(vertex?sum(siteProduction(state,vertex))*p.productionWeight*p.horizonRolls:0);const key=JSON.stringify(cost);if(!estimates.has(key))estimates.set(key,acquisitionRolls(state,id,cost,p.horizonRolls));const eta=estimates.get(key),completion=1-RESOURCES.reduce((n,r)=>n+Math.max(0,(cost[r]||0)-player.resources[r]),0)/sum(cost);plans.push({type,cost,vertex,...extra,eta,value:Number.isFinite(eta)?gain/(1+p.etaPenaltyPerRoll*eta)+p.readinessWeight*completion:0});};
 if(player.citiesRemaining>0)for(const b of state.board.buildings.filter(b=>b.playerId===id&&b.type==='settlement'))add('city',COSTS.city,b.vertex);
 if(player.settlementsRemaining>0){for(const v of sites)add('settlement',COSTS.settlement,v);
  if(player.roadsRemaining>0)for(const edge of validRoads(state,id).slice(0,p.maxRoadCandidates)){
   const next={...state,board:{...state.board,roads:[...state.board.roads,{playerId:id,edge}]}};
   for(const v of validSettlements(next,id))if(!seen.has(vertexKey(v)))add('expansion',Object.fromEntries(RESOURCES.map(r=>[r,(COSTS.road[r]||0)+(COSTS.settlement[r]||0)])),v,{edge});
  }
 }
 if(state.game.developmentDeckCount>0)add('development',COSTS.development);
 return plans.sort((a,b)=>b.value-a.value).slice(0,p.maxPlans);
}
export function preview(state,id,action){
 if(!['BUILD_ROAD','BUILD_SETTLEMENT','BUILD_CITY','BANK_TRADE'].includes(action.type))throw Error('Unsupported deterministic preview');
 let sequence=0;const result=applyEconomy(state,[],action,id,{id:()=>`preview-${sequence++}`,now:()=>0,randomInt:()=>{throw Error('Preview requested secret entropy');}});
 if(!result.success)throw Error('Invalid preview: '+result.error);return result.state;
}
export function evaluate(state,id,p){
 const plans=buildPlans(state,id,p),ready=plans.filter(g=>g.type==='settlement').reduce((n,g)=>n+g.value,0);
 return {value:score(state,id,true)+sum(production(state,id))*p.productionWeight*p.horizonRolls+p.handReserveWeight*(plans[0]?.value||0)+p.expansionWeight*ready,plans};
}
export function decision(view,parameters,seed){
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Planner observation exceeds work budget');
 const legacy=baseline(view,'standard');
 if(view.offer||view.state.game.phase!=='main')return {action:legacy,reason:'BASELINE_PHASE',plans:[]};
 const types=new Set(['BUILD_ROAD','BUILD_SETTLEMENT','BUILD_CITY','BANK_TRADE','BUY_DEVELOPMENT_CARD','END_TURN']);
 if(!types.has(legacy.type)&&legacy.type!=='TRADE_OFFER')return {action:legacy,reason:'BASELINE_CARD',plans:[]};
 const current=evaluate(view.state,view.you,parameters);let best={action:view.choices.find(c=>c.type==='END_TURN'),gain:0,reason:'SAVE_FOR_PLAN',plans:current.plans};
 let rng=seed>>>0;const noise=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296*parameters.noiseAmplitude;};
 for(const action of view.choices){if(!types.has(action.type)||action.type==='END_TURN')continue;let value,plans;
  if(action.type==='BUY_DEVELOPMENT_CARD'){
   // Expected-value hand feature only; never guess a real private deck/card.
   const state=structuredClone(view.state),player=own(state,view.you);for(const r of RESOURCES){player.resources[r]-=COSTS.development[r]||0;state.game.bank[r]+=COSTS.development[r]||0;}state.game.developmentDeckCount--;
   const evaluated=evaluate(state,view.you,parameters);value=evaluated.value+parameters.developmentValue;plans=evaluated.plans;
  }else{const state=preview(view.state,view.you,action);if(score(state,view.you,true)>=state.game.settings.victoryPoints)return {action,reason:'IMMEDIATE_WIN',plans:[]};const evaluated=evaluate(state,view.you,parameters);value=evaluated.value;plans=evaluated.plans;}
  const gain=value-current.value;if(gain>=parameters.minActionGain&&gain+noise()>best.gain)best={action,gain,reason:action.type==='BANK_TRADE'?'ACQUIRE_FOR_PLAN':'IMPROVE_POSITION',plans};
 }
 if(!best.action)throw Error('No legal planner action');
 if(best.action.type==='END_TURN'&&legacy.type==='TRADE_OFFER')return {action:legacy,reason:'BASELINE_PROPOSAL',plans:current.plans};return best;
}
export const botDecision=(view,_level,parameters,seed)=>decision(view,parameters,seed).action;
