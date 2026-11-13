// Original adaptive goal policy. Uses public topology and the bot's own hand only.
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {siteProduction,acquisitionRolls,preview} from './planner-policy.mjs';
import {opponentTotals} from './resource-policy.mjs';
import {landEdges,validRoads,validSettlements} from '../../play/catan/rules/board.js';
import {validSetupSettlements} from '../../play/catan/rules/setup.js';
import {edgeKey,vertexKey,getEdgeVertices} from '../../play/catan/rules/geometry.js';
import {RESOURCES,COSTS,applyEconomy} from '../../play/catan/rules/economy.js';
import {applyTurn} from '../../play/catan/rules/turn.js';
import {catanChoices} from '../../play/catan/rules/session.js';
import {score} from '../../play/catan/rules/scoring.js';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const own=(state,id)=>state.players.players.find(p=>p.id===id);
const sum=o=>Object.values(o).reduce((n,v)=>n+v,0);
const bundle=o=>Object.fromEntries(RESOURCES.map(r=>[r,o[r]||0]));
const context={id:()=> 'goal-preview',now:()=>0,randomInt:()=>{throw Error('Shared plan preview requested hidden entropy');}};
const sameAction=(a,b)=>a.type===b.type&&(a.vertex?vertexKey(a.vertex)===vertexKey(b.vertex):a.edge?edgeKey(a.edge)===edgeKey(b.edge):true);
const buildTypes=new Set(['BUILD_CITY','BUILD_SETTLEMENT','BUILD_ROAD']);
const cardTypes=new Set(['PLAY_YEAR_OF_PLENTY','PLAY_MONOPOLY','PLAY_ROAD_BUILDING']);
const keyFor=(kind,vertex)=>kind+'|'+vertexKey(vertex);
function virtualRoad(state,id,edge){return {...state,board:{...state.board,roads:[...state.board.roads,{playerId:id,edge}]},players:{...state.players,players:state.players.players.map(p=>p.id===id?{...p,roadsRemaining:p.roadsRemaining-1}:p)}};}
// Multi-source shortest paths: every owned road/building is an expansion source.
// Opponent buildings cannot be crossed, occupied roads cannot be purchased.
export function routes(state,id,p){
 const edges=landEdges(state).sort((a,b)=>compare(edgeKey(a),edgeKey(b))),adj=new Map(),vertices=new Map();
 for(const edge of edges){const ends=getEdgeVertices(edge);for(const [i,v]of ends.entries()){const key=vertexKey(v);vertices.set(key,v);if(!adj.has(key))adj.set(key,[]);adj.get(key).push({edge,next:ends[1-i]});}}
 const occupied=new Set(state.board.roads.map(r=>edgeKey(r.edge))),blocked=new Set(state.board.buildings.filter(b=>b.playerId!==id).map(b=>vertexKey(b.vertex))),sources=new Set();
 for(const b of state.board.buildings.filter(b=>b.playerId===id))sources.add(vertexKey(b.vertex));
 for(const road of state.board.roads.filter(r=>r.playerId===id))for(const v of getEdgeVertices(road.edge))if(!blocked.has(vertexKey(v)))sources.add(vertexKey(v));
 const queue=[...sources].filter(k=>vertices.has(k)&&!blocked.has(k)).sort().map(key=>({key,path:[]})),seen=new Map(queue.map(n=>[n.key,n.path]));let expanded=0;
 const depth=Math.min(p.maxRouteLength,own(state,id).roadsRemaining);
 for(let i=0;i<queue.length&&expanded<p.maxGraphNodes;i++){
  const node=queue[i];expanded++;if(node.path.length>=depth)continue;
  for(const {edge,next} of adj.get(node.key)||[]){const key=vertexKey(next);if(occupied.has(edgeKey(edge))||blocked.has(key)||seen.has(key))continue;const path=[...node.path,edge];seen.set(key,path);queue.push({key,path});}
 }
 return {paths:seen,expanded,truncated:queue.length>expanded};
}
function goalGain(state,goal,p){return goal.kind==='development'?p.developmentValue:1+sum(siteProduction(state,goal.vertex))*p.productionWeight*p.horizonRolls;}
function etaDiscount(state,id,p){const peers=state.players.players.filter(q=>q.id!==id),highest=Math.max(0,...peers.map(q=>q.victoryPoints));return p.etaPenalty*(1+p.urgentEtaWeight*Math.max(0,highest-p.urgentPublicVp+1));}
export function handValue(state,id,goal,p,knownEta=undefined){
 const stock=own(state,id).resources,eta=knownEta??acquisitionRolls(state,id,goal.cost,p.horizonRolls),completion=1-RESOURCES.reduce((n,r)=>n+Math.max(0,goal.cost[r]-stock[r]),0)/Math.max(1,sum(goal.cost));
 return (Number.isFinite(eta)?goal.gain/(1+etaDiscount(state,id,p)*eta):0)+p.readinessWeight*completion+p.reserveWeight*sum(stock)-p.routePenalty*goal.route.length;
}
export function generateGoals(view,p){
 const state=view.state,id=view.you,player=own(state,id),goals=[],graph=routes(state,id,p),costCache=new Map(),roadCard=catanChoices(state,id,null).some(a=>a.type==='PLAY_ROAD_BUILDING');
 const add=goal=>{goal.gain=goalGain(state,goal,p);goal.missing=bundle(Object.fromEntries(RESOURCES.map(r=>[r,Math.max(0,goal.cost[r]-player.resources[r])])));const costKey=JSON.stringify(goal.cost);if(!costCache.has(costKey))costCache.set(costKey,acquisitionRolls(state,id,goal.cost,p.horizonRolls));goal.eta=costCache.get(costKey);goal.value=handValue(state,id,goal,p,goal.eta);goals.push(goal);};
 if(player.citiesRemaining>0)for(const b of state.board.buildings.filter(b=>b.playerId===id&&b.type==='settlement'))add({key:keyFor('city',b.vertex),kind:'city',vertex:b.vertex,route:[],cost:bundle(COSTS.city)});
 if(player.settlementsRemaining>0)for(const vertex of validSetupSettlements(state)){
  const route=graph.paths.get(vertexKey(vertex));if(!route)continue;
  // Validate route construction and final placement with the existing topology helpers.
  let topology=state,valid=true;for(const edge of route){if(!validRoads(topology,id).some(e=>edgeKey(e)===edgeKey(edge))){valid=false;break;}topology=virtualRoad(topology,id,edge);}
  if(!valid||!validSettlements(topology,id).some(v=>vertexKey(v)===vertexKey(vertex)))continue;
  const usesRoadCard=state.game.phase!=='road-building'&&roadCard&&route.length>=2,free=state.game.phase==='road-building'?state.game.roadBuildingRemaining:usesRoadCard?2:0,paid=Math.max(0,route.length-free);
  add({key:keyFor('settlement',vertex),kind:'settlement',vertex,route,usesRoadCard,cost:bundle(Object.fromEntries(RESOURCES.map(r=>[r,(COSTS.settlement[r]||0)+paid*(COSTS.road[r]||0)])))});
 }
 if(state.game.developmentDeckCount>0)add({key:'development|'+player.developmentCards.length,kind:'development',route:[],cost:bundle(COSTS.development)});
 goals.sort((a,b)=>b.value-a.value||compare(a.key,b.key));return {goals,graph};
}
function completed(state,id,key){
 for(const b of state.board.buildings.filter(b=>b.playerId===id))if(key===keyFor('settlement',b.vertex)||b.type==='city'&&key===keyFor('city',b.vertex))return true;
 if(key?.startsWith('development|'))return own(state,id).developmentCards.length>Number(key.split('|')[1]);return false;
}
export function selectGoal(view,p,memory=null){
 const generated=generateGoals(view,p),best=generated.goals[0]||null,previous=generated.goals.find(g=>g.key===memory?.goalKey);let goal=best,reason='NEW_GOAL';
 if(previous){if(!best||best.value-previous.value<=p.switchMargin){goal=previous;reason='KEEP_GOAL';}else reason='BETTER_ALTERNATIVE';}
 else if(memory?.goalKey)reason=completed(view.state,view.you,memory.goalKey)?'GOAL_COMPLETED':'GOAL_UNAVAILABLE_WITHIN_BOUNDS';
 const alternatives=['city','settlement','development'].map(kind=>generated.goals.find(g=>g.kind===kind)).filter(Boolean);
 return {goal,reason,alternatives,goals:generated.goals,graph:generated.graph};
}
function summary(g){return g?{key:g.key,kind:g.kind,...(g.vertex?{vertex:g.vertex}:{}),route:g.route,cost:g.cost,missing:g.missing,usesRoadCard:!!g.usesRoadCard,gain:g.gain,eta:Number.isFinite(g.eta)?g.eta:null,value:g.value}:null;}
function discard(view,goal,p){
 const candidates=[],seen=new Set(),state=view.state,player=own(state,view.you),count=state.game.discardAmounts?.[view.you]??Math.floor(sum(player.resources)/2),keepCount=sum(player.resources)-count;let nodes=0;
 const add=resources=>{if(candidates.length>=p.maxDiscardCandidates)return;const action={type:'DISCARD_RESOURCES',resources:bundle(resources)},key=JSON.stringify(action.resources);if(seen.has(key))return;const next=applyTurn(state,action,view.you,context.randomInt);if(next.success){seen.add(key);candidates.push({action,state:next.state});}};
 for(const a of catanChoices(state,view.you,null))if(a.type==='DISCARD_RESOURCES')add(a.resources);
 const keep=bundle({});let left=keepCount;
 const order=[...RESOURCES].sort((a,b)=>Math.max(0,goal.cost[b]-player.resources[b])-Math.max(0,goal.cost[a]-player.resources[a])||goal.cost[b]-goal.cost[a]||compare(a,b));
 for(const r of order){const n=Math.min(left,player.resources[r],goal.cost[r]);keep[r]=n;left-=n;}
 for(const r of order){const n=Math.min(left,player.resources[r]-keep[r]);keep[r]+=n;left-=n;}
 add(Object.fromEntries(RESOURCES.map(r=>[r,player.resources[r]-keep[r]])));
 function visit(i,remaining,partial){if(candidates.length>=p.maxDiscardCandidates||++nodes>p.maxDiscardCandidates*100)return;if(i===4){if(remaining<=player.resources[RESOURCES[i]])add({...partial,[RESOURCES[i]]:remaining});return;}const r=RESOURCES[i],rest=RESOURCES.slice(i+1).reduce((n,r)=>n+player.resources[r],0);for(let n=Math.max(0,remaining-rest);n<=Math.min(remaining,player.resources[r]);n++){visit(i+1,remaining-n,{...partial,[r]:n});if(candidates.length>=p.maxDiscardCandidates||nodes>p.maxDiscardCandidates*100)return;}}
 visit(0,count,{});let best=null;for(const c of candidates){const value=handValue(c.state,view.you,goal,p);if(!best||value>best.value)best={...c,value};}if(!best)throw Error('No engine-validated planned discard');return {action:best.action,candidates:candidates.length,nodes};
}
function immediateWin(view,legal){
 if(score(view.state,view.you,true)+3<view.state.game.settings.victoryPoints)return null;
 for(const action of legal.filter(a=>buildTypes.has(a.type)||a.type==='PLAY_KNIGHT')){
  const next=action.type==='PLAY_KNIGHT'?applyEconomy(view.state,[],action,view.you,context).state:preview(view.state,view.you,action);
  if(next&&score(next,view.you,true)>=view.state.game.settings.victoryPoints)return action;
 }return null;
}
export function decision(view,p,_seed,memory=null){
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Shared plan observation exceeds work budget');
 if(memory&&(memory.schemaVersion!==1||typeof memory.goalKey!=='string'&&memory.goalKey!==null))throw Error('Unsupported shared plan memory');
 const phase=view.state.game.phase;
 const frozen=()=>baseline(view,'standard');
 if(view.offer||phase.startsWith('setup-')||['robber-move','robber-steal'].includes(phase))return {action:frozen(),reason:view.offer?'FROZEN_PLAYER_TRADE':'FROZEN_PHASE',memory:memory||{schemaVersion:1,goalKey:null},diagnostics:null};
 const selected=selectGoal(view,p,memory),goal=selected.goal;
 const finish=(action,reason,extra={})=>({action,reason,memory:{schemaVersion:1,goalKey:goal?.key||null},diagnostics:{selection:selected.reason,plan:summary(goal),alternatives:selected.alternatives.map(summary),graphNodes:selected.graph.expanded,graphTruncated:selected.graph.truncated,nextStep:action,...extra}});
 const legal=catanChoices(view.state,view.you,null),win=immediateWin(view,legal);if(win)return finish(win,'IMMEDIATE_WIN');
 if(!goal)return finish(frozen(),'NO_REACHABLE_GOAL');
 if(phase==='discard'){const result=discard(view,goal,p);return finish(result.action,'DISCARD_FOR_GOAL',{discardCandidates:result.candidates,discardNodes:result.nodes});}
 if(phase==='road-building'){
  const choices=[goal,...selected.goals.filter(g=>g.key!==goal.key)];
  for(const g of choices)if(g.route.length){const action=legal.find(a=>a.type==='BUILD_ROAD'&&edgeKey(a.edge)===edgeKey(g.route[0]));if(action)return finish(action,g.key===goal.key?'FREE_ROAD_FOR_GOAL':'FREE_ROAD_FOR_ALTERNATIVE');}
  return finish(frozen(),'MANDATORY_FREE_ROAD_FALLBACK');
 }
 if(goal.usesRoadCard&&legal.some(a=>a.type==='PLAY_ROAD_BUILDING'))return finish(legal.find(a=>a.type==='PLAY_ROAD_BUILDING'),'ROAD_CARD_FOR_GOAL');
 const desired=goal.kind==='city'?{type:'BUILD_CITY',vertex:goal.vertex}:goal.kind==='settlement'?(goal.route.length?{type:'BUILD_ROAD',edge:goal.route[0]}:{type:'BUILD_SETTLEMENT',vertex:goal.vertex}):{type:'BUY_DEVELOPMENT_CARD'};
 const step=legal.find(a=>sameAction(desired,a));if(step)return finish(step,'EXECUTE_GOAL_STEP');
 const current=handValue(view.state,view.you,goal,p);let best=null;
 const consider=(action,next,reason)=>{const gain=handValue(next,view.you,goal,p)-current,threshold=cardTypes.has(action.type)?p.cardUseThreshold:0.000001;if(gain>threshold&&(!best||gain>best.gain))best={action,gain,reason};};
 if(phase==='main'){
  for(const a of legal.filter(a=>a.type==='BANK_TRADE'))consider(a,preview(view.state,view.you,a),'BANK_FOR_GOAL');
  const totals=opponentTotals(view);
  for(const a of legal.filter(a=>a.type==='PLAY_YEAR_OF_PLENTY'||a.type==='PLAY_MONOPOLY')){
   let next;if(a.type==='PLAY_YEAR_OF_PLENTY')next=applyEconomy(view.state,[],a,view.you,context).state;
   else{if(!totals||!totals[a.resource])continue;const state=view.state;next={...state,players:{...state.players,players:state.players.players.map(q=>q.id===view.you?{...q,resources:{...q.resources,[a.resource]:q.resources[a.resource]+totals[a.resource]}}:q)}};}
   consider(a,next,'RESOURCE_CARD_FOR_GOAL');
  }
 }
 if(best)return finish(best.action,best.reason,{handGain:best.gain});
 // Player-trade generation stays in the frozen helper until its own integration.
 const wait={...view,choices:legal.filter(a=>['ROLL_DICE','END_TURN','PLAY_KNIGHT'].includes(a.type))};
 if(!wait.choices.length)throw Error('No planned action or legal wait');
 return finish(baseline(wait,'standard'),'FROZEN_WAIT_OR_PLAYER_OFFER');
}
