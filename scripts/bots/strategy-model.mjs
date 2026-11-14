// Original bounded, public-information strategy estimates. No hidden-hand sampling.
import {production,siteProduction} from './planner-policy.mjs';
import {bankRate} from '../../play/catan/rules/board.js';
import {vertexKey} from '../../play/catan/rules/geometry.js';
import {RESOURCES} from '../../play/catan/rules/economy.js';
import {score} from '../../play/catan/rules/scoring.js';
const sum=o=>RESOURCES.reduce((n,r)=>n+(o[r]||0),0);
export function stage(state,id,p){
 const progress=score(state,id,true)/state.game.settings.victoryPoints;
 return p.enableStageStrategy?(progress<.4?'expansion':progress<.75?'production':'finish'):'production';
}
export function afterGoal(state,id,goal){
 if(goal.kind==='development')return null;
 // Hypothetical completion, not a legal command or a sampled future. Missing
 // cards are assumed acquired at the separately estimated ETA; do not invent a hand.
 const paid=goal.cost,buildings=goal.kind==='city'?state.board.buildings.map(b=>b.playerId===id&&vertexKey(b.vertex)===vertexKey(goal.vertex)?{...b,type:'city'}:b):[...state.board.buildings,{playerId:id,type:'settlement',vertex:goal.vertex}];
 const stock=state.players.players.find(q=>q.id===id).resources;
 let used=false;
 return {...state,game:{...state.game,phase:'main',roadBuildingRemaining:0,bank:Object.fromEntries(RESOURCES.map(r=>[r,state.game.bank[r]+Math.min(stock[r],paid[r])]))},board:{...state.board,buildings,roads:[...state.board.roads,...goal.route.map(edge=>({playerId:id,edge}))]},players:{...state.players,players:state.players.players.map(q=>q.id!==id?q:{...q,developmentCards:q.developmentCards.map(c=>{if(goal.usesRoadCard&&!used&&c.type==='roadBuilding'&&!c.isPlayed){used=true;return {...c,isPlayed:true};}return c;}),resources:Object.fromEntries(RESOURCES.map(r=>[r,Math.max(0,q.resources[r]-paid[r])])),roadsRemaining:q.roadsRemaining-goal.route.length,settlementsRemaining:q.settlementsRemaining+(goal.kind==='city'?1:-1),citiesRemaining:q.citiesRemaining-(goal.kind==='city'?1:0)})}};
}
export function economicGain(state,id,goal,p){
 if(!p.enableResourceEconomy||!goal.vertex)return 0;
 const current=production(state,id),extra=siteProduction(state,goal.vertex),after=afterGoal(state,id,goal);
 const diversity=RESOURCES.reduce((n,r)=>n+Math.min(1,extra[r]/(current[r]+1/36)),0);
 const port=RESOURCES.reduce((n,r)=>n+Math.max(0,1/bankRate(after,id,r)-1/bankRate(state,id,r))*current[r]*p.horizonRolls,0);
 return p.balanceWeight*diversity+p.portWeight*port;
}
export function handEconomy(state,id,goal,p){
 if(!p.enableResourceEconomy)return 0;
 const hand=state.players.players.find(q=>q.id===id).resources;
 // Keep the recipe and one bank-exchange bundle. Extra cards have diminishing
 // value; a favorable port lowers the cost of converting a production surplus.
 const surplus=RESOURCES.reduce((n,r)=>n+Math.max(0,hand[r]-(goal.cost[r]||0)-bankRate(state,id,r)+1)*bankRate(state,id,r)/4,0);
 return -p.surplusWeight*surplus;
}
export function raceValue(goal,opponentRoutes,p){
 if(!p.enableSiteCompetition||goal.kind!=='settlement')return {gain:0,opponentRoads:null};
 const distances=opponentRoutes.map(g=>g.paths.get(vertexKey(goal.vertex))?.length).filter(Number.isInteger),other=distances.length?Math.min(...distances):null;
 if(other===null)return {gain:0,opponentRoads:null};
 const ours=goal.route.length;
 // A road count is public reach, not knowledge of affordability or intent.
 const risk=Math.max(0,ours-other)/(1+ours),urgency=ours<=other&&other<=2?1/(1+other):0;
 return {gain:p.raceUrgencyWeight*urgency-p.raceRiskWeight*risk,opponentRoads:other};
}
export function adjustedGain(state,id,goal,p,opponentRoutes){
 const phase=stage(state,id,p),base=goal.gain;
 const productionPart=goal.kind==='development'?0:Math.max(0,base-1);
 const horizon=phase==='expansion'?p.earlyProductionScale:phase==='finish'?p.lateProductionScale:1;
 const race=raceValue(goal,opponentRoutes,p);
 return {gain:base+(p.enableStageStrategy?productionPart*(horizon-1):0)+economicGain(state,id,goal,p)+race.gain,stage:phase,opponentRoads:race.opponentRoads};
}
export function affordableWinningGoal(state,id,goal){return goal.kind!=='development'&&score(state,id,true)+1>=state.game.settings.victoryPoints;}
