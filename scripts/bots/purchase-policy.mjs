// Original observation-only development investment overlay. No deck sampling.
import {decision as previous} from './robber-policy.mjs';
import {generateGoals} from './shared-plan-policy.mjs';
import {production} from './planner-policy.mjs';
import {DEVELOPMENT_CARD_COUNTS} from '../../play/catan/rules/model.js';
import {score} from '../../play/catan/rules/scoring.js';
import {RESOURCES} from '../../play/catan/rules/economy.js';
const clamp=x=>Math.max(0,Math.min(1,x));
export function purchaseValue(view,p){
 const state=view.state,me=state.players.players.find(q=>q.id===view.you),cards=me.developmentCards;
 if(!state.game.developmentDeckCount)return {gain:0,types:{},queue:0};
 // Initial-mixture approximation, NOT an inferred remaining-deck distribution.
 // Public army counts already include our played Knights: count them only once.
 const known=Object.fromEntries(Object.keys(DEVELOPMENT_CARD_COUNTS).map(type=>[type,cards.filter(c=>c.type===type).length]));
 known.knight=state.players.players.reduce((n,q)=>n+q.armySize,0)+cards.filter(c=>c.type==='knight'&&!c.isPlayed).length;
 const weights=Object.fromEntries(Object.entries(DEVELOPMENT_CARD_COUNTS).map(([type,n])=>[type,known[type]>=n?0:n])),total=Object.values(weights).reduce((a,b)=>a+b,0);
 const construction=generateGoals(view,p).goals.filter(g=>g.kind!=='development');
 const goal=construction[0],missing=goal?RESOURCES.reduce((n,r)=>n+Math.max(0,goal.cost[r]-me.resources[r]),0):0;
 const rates=production(state,view.you),release=state.board.tiles.find(t=>t.coord.q===state.board.robberLocation.q&&t.coord.r===state.board.robberLocation.r);
 // Compare current production with the public board after vacating the robber.
 const freed=release?production({...state,board:{...state.board,robberLocation:{q:99,r:99}}},view.you):rates;
 const blocked=RESOURCES.reduce((n,r)=>n+Math.max(0,freed[r]-rates[r]),0);
 const holder=state.game.largestArmy,target=Math.max(3,(holder?.value||2)+1),distance=Math.max(1,target-me.armySize);
 const army=holder?.playerId===view.you?0:2/distance;
 const road=construction.filter(g=>g.kind==='settlement'&&g.route.length>0&&me.roadsRemaining>0).reduce((best,g)=>Math.max(best,Math.min(2,g.route.length,me.roadsRemaining)/2),0);
 const queue=cards.filter(c=>!c.isPlayed&&c.type!=='victoryPoint').length;
 const delay=p.purchaseDelayDiscount/(1+p.purchaseQueuePenalty*queue),vp=score(state,view.you,true),urgency=clamp(vp/Math.max(1,state.game.settings.victoryPoints-1));
 const values={
  victoryPoint:p.purchaseVpValue*(1+p.purchaseLateVpWeight*urgency),
  knight:delay*(p.purchaseKnightValue+p.purchaseArmyWeight*army+blocked*p.productionWeight*p.robberExpectedRolls),
  roadBuilding:delay*p.purchaseRoadValue*road,
  yearOfPlenty:delay*p.purchaseResourceValue*clamp(missing/2),
  monopoly:delay*p.purchaseResourceValue*clamp(missing/2)*p.purchaseMonopolyDiscount
 };
 const types=Object.fromEntries(Object.keys(weights).map(type=>[type,{probability:total?weights[type]/total:0,value:values[type],known:known[type]}]));
 const gain=Object.values(types).reduce((n,t)=>n+t.probability*t.value,0);
 return {gain,types,queue,delay,armyDistance:distance,blockedProduction:blocked,constructionGoal:goal?.key||null};
}
export function decision(view,p,seed,memory=null){
 if(!p.enablePurchaseValuation)return previous(view,p,seed,memory);
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Purchase observation exceeds work budget');
 const investment=purchaseValue(view,p);
 // One valuation per observation feeds the unchanged shared goal selector and
 // all its build/trade/bank/discard comparisons. The payment is represented by
 // the development recipe/ETA; no extra arbitrary three-card penalty is added.
 const eligible=investment.gain>p.purchaseMinValue;
 // Private availability counterfactual only; the authoritative deck is untouched.
 const observation=eligible?view:{...view,choices:view.choices.filter(a=>a.type!=='BUY_DEVELOPMENT_CARD'),state:{...view.state,game:{...view.state.game,developmentDeckCount:0}}};
 const result=previous(observation,{...p,developmentValue:investment.gain},seed,memory);
 return {...result,diagnostics:result.diagnostics?{...result.diagnostics,purchase:investment}:null};
}
