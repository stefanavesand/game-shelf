// Experimental planner + trade utility. Only an authorized observation is used.
import {decision as plan,evaluate,production,preview} from './planner-policy.mjs';
import {RESOURCES,COSTS} from '../../play/catan/rules/economy.js';
import {catanChoices} from '../../play/catan/rules/session.js';
import {score} from '../../play/catan/rules/scoring.js';
const total=o=>RESOURCES.reduce((n,r)=>n+(o[r]||0),0);
const own=v=>v.state.players.players.find(p=>p.id===v.you);
const signature=(give,receive)=>RESOURCES.map(r=>`${give[r]||0}:${receive[r]||0}`).join('|');
// Per-decision caches never survive a new observation or parameter profile.
function context(){return {evaluations:new WeakMap(),choices:new WeakMap(),opportunities:new WeakMap()};}
function cached(map,state,compute){if(!map.has(state))map.set(state,compute());return map.get(state);}
const evaluated=(state,id,p,c)=>cached(c.evaluations,state,()=>evaluate(state,id,p));
const legal=(state,id,c)=>cached(c.choices,state,()=>catanChoices(state,id,null));
function handValue(state,id,p,c){return evaluated(state,id,p,c).value+p.retainedCardWeight*total(state.players.players.find(q=>q.id===id).resources);}
function exchange(view,give,receive){const input=view.state;return {...input,players:{...input.players,players:input.players.players.map(q=>q.id===view.you?{...q,resources:Object.fromEntries(RESOURCES.map(r=>[r,q.resources[r]+(receive[r]||0)-(give[r]||0)]))}:q)}};}
// Counterfactual own-hand evaluation, not a trade reducer: no opponent hands or
// bank quantities are changed. Actual transfers remain ordinary engine commands.
function winningBuild(state,id,c){if(state.game.currentPlayerId!==id)return false;
 // A deterministic build adds at most one building VP and two Longest Road VP.
 if(score(state,id,true)+3<state.game.settings.victoryPoints)return false;return legal(state,id,c).filter(a=>['BUILD_CITY','BUILD_SETTLEMENT','BUILD_ROAD'].includes(a.type)).some(a=>score(preview(state,id,a),id,true)>=state.game.settings.victoryPoints);}
function opportunity(state,id,p,c){return cached(c.opportunities,state,()=>{let best=handValue(state,id,p,c);if(state.game.currentPlayerId!==id)return best;
 const choices=legal(state,id,c);if(choices.some(a=>a.type==='BUY_DEVELOPMENT_CARD')){const next=structuredClone(state),player=next.players.players.find(q=>q.id===id);for(const r of RESOURCES){player.resources[r]-=COSTS.development[r]||0;next.game.bank[r]+=COSTS.development[r]||0;}next.game.developmentDeckCount--;best=Math.max(best,handValue(next,id,p,c)+p.developmentValue);}
 for(const a of choices.filter(a=>['BUILD_CITY','BUILD_SETTLEMENT'].includes(a.type)).slice(0,p.maxTradeBuildPreviews))best=Math.max(best,handValue(preview(state,id,a),id,p,c));return best;});
}
function bankAlternative(view,p,current,c){if(view.state.game.currentPlayerId!==view.you)return 0;let best=0;for(const a of legal(view.state,view.you,c))if(a.type==='BANK_TRADE')best=Math.max(best,opportunity(preview(view.state,view.you,a),view.you,p,c)-current);return best;}
function threat(view,id,give,p){const peer=view.state.players.players.find(q=>q.id===id),distance=Math.max(1,view.state.game.settings.victoryPoints-p.leaderPublicVp);return p.leaderPenalty*Math.max(0,Math.min(1,(peer.victoryPoints-p.leaderPublicVp+1)/distance))*total(give)/p.maxCardsPerSide;}
function supplyAffinity(view,id,give,receive){const rates=production(view.state,id),worth=bundle=>RESOURCES.reduce((n,r)=>n+(bundle[r]||0)/(0.05+rates[r]),0),gain=worth(give),cost=worth(receive);return (gain-cost)/Math.max(1,gain+cost);}
export function offerWindow(view){const history=view.history,index=history.findLastIndex(h=>h.message==='end turn');if(index<0&&history.length!==view.revision)return {known:false,count:0};return {known:true,count:history.slice(index+1).filter(h=>h.playerId===view.you&&h.message==='trade offer').length};}
function cooledDown(view,id,give,receive,p){if(p.rejectionCooldownOwnTurns===0)return false;const key=signature(give,receive);return (view.trades||[]).some(t=>{
 if(t.from!==view.you||signature(t.give,t.receive)!==key||!(t.responses?.[id]==='declined'||t.status==='declined'&&(t.recipients||[t.to]).includes(id)))return false;
 // Observed ends are a lower bound when history is truncated.
 const ended=view.history.filter(h=>h.revision>t.revision&&h.playerId===view.you&&h.message==='end turn').length;return ended<=p.rejectionCooldownOwnTurns;
});}
export function tradeDecision(view,p,c=context()){
 const offer=view.offer,choices=catanChoices(view.state,view.you,offer),allowed=type=>view.choices.find(c=>c.type===type&&c.offerId===offer.id)&&choices.find(c=>c.type===type&&c.offerId===offer.id);
 if(offer.from===view.you){const cancel=allowed('TRADE_CANCEL');if(!cancel)throw Error('Stale outgoing offer choices');return {action:cancel,reason:'CANCEL_PENDING_OFFER'};}
 const decline=allowed('TRADE_DECLINE');if(!decline)throw Error('Stale or ineligible trade choices');
 const accept=allowed('TRADE_ACCEPT');if(!accept)return {action:decline,reason:'UNAFFORDABLE_OFFER'};
 const current=opportunity(view.state,view.you,p,c),state=exchange(view,offer.receive,offer.give);
 if(winningBuild(state,view.you,c))return {action:accept,reason:'TRADE_ENABLES_WIN'};
 const gain=opportunity(state,view.you,p,c)-current,alternative=bankAlternative(view,p,current,c),penalty=threat(view,offer.from,offer.receive,p);
 return gain-penalty>=p.minOwnUtilityGain&&gain-penalty>=alternative?{action:accept,reason:'PLAN_IMPROVING_TRADE',gain,alternative,penalty}:{action:decline,reason:alternative>gain-penalty?'BANK_ALTERNATIVE_BETTER':penalty>0?'PUBLIC_WIN_THREAT':'INSUFFICIENT_PLAN_GAIN',gain,alternative,penalty};
}
export function proposal(view,p,alternativeGain,c=context()){
 const window=offerWindow(view);if(!window.known||window.count>=p.offersPerOwnTurn)return null;
 const current=opportunity(view.state,view.you,p,c),me=own(view),plans=evaluated(view.state,view.you,p,c).plans,needs=new Set(plans.slice(0,3).flatMap(g=>RESOURCES.filter(r=>me.resources[r]<(g.cost[r]||0))));
 const bundles=[];
 for(const want of RESOURCES.filter(r=>needs.has(r)))for(const give of RESOURCES.filter(r=>r!==want))for(let n=1;n<=p.maxCardsPerSide;n++)for(let m=1;m<=p.maxCardsPerSide;m++){
  if(n>me.resources[give]||n>1&&m>1)continue;
  const receive=Object.fromEntries(RESOURCES.map(r=>[r,r===want?m:0])),send=Object.fromEntries(RESOURCES.map(r=>[r,r===give?n:0]));
  const peers=view.state.players.players.filter(q=>q.id!==view.you&&q.resourceCount>=m&&!cooledDown(view,q.id,send,receive,p));if(!peers.length)continue;
  const rough=Math.max(...plans.map(g=>RESOURCES.reduce((v,r)=>v+Math.max(0,(g.cost[r]||0)-me.resources[r])-Math.max(0,(g.cost[r]||0)-me.resources[r]-(receive[r]||0)+(send[r]||0)),0)),0)-(n-m)*0.01;
  bundles.push({give:send,receive,peers,rough});
 }
 bundles.sort((a,b)=>b.rough-a.rough);let best=null;
 for(const b of bundles.slice(0,p.maxProposalBundles)){
  const state=exchange(view,b.give,b.receive),gain=opportunity(state,view.you,p,c)-current;if(gain<p.minOwnUtilityGain)continue;
  const winning=winningBuild(state,view.you,c),allPeers=view.state.players.players.filter(q=>q.id!==view.you),targets=[...(b.peers.length===allPeers.length?[{to:'all',peers:b.peers}]:[]),...b.peers.map(q=>({to:q.id,peers:[q]}))];
  for(const target of targets){const penalty=winning?0:Math.max(...target.peers.map(q=>threat(view,q.id,b.give,p))),affinity=Math.max(...target.peers.map(q=>supplyAffinity(view,q.id,b.give,b.receive))),discount=p.proposalDiscount*Math.max(0.1,Math.min(1,1+p.publicSupplyWeight*affinity)),net=(gain-penalty)*discount;
   if(net>=p.minOwnUtilityGain&&net>alternativeGain&&(!best||net>best.gain))best={action:{type:'TRADE_OFFER',to:target.to,give:b.give,receive:b.receive},reason:winning?'PROPOSE_WINNING_PLAN':'PROPOSE_PLAN_TRADE',gain:net};
  }
 }return best;
}
export function decision(view,p,seed){
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Trade planner observation exceeds work budget');
 const c=context();if(view.offer)return tradeDecision(view,p,c);
 const result=plan(view,p,seed);if(view.state.game.phase!=='main'||result.reason==='IMMEDIATE_WIN'||result.reason==='BASELINE_CARD')return result;
 const window=offerWindow(view);if(!window.known||window.count>=p.offersPerOwnTurn)return result.action.type==='TRADE_OFFER'?{action:view.choices.find(a=>a.type==='END_TURN'),reason:'TRADE_BUDGET_OR_VALUE'}:result;
 const current=opportunity(view.state,view.you,p,c),alternative=bankAlternative(view,p,current,c);
 return proposal(view,p,alternative,c)||(result.action.type==='TRADE_OFFER'?{action:view.choices.find(a=>a.type==='END_TURN'),reason:'TRADE_BUDGET_OR_VALUE'}:result);
}
export const botDecision=(view,_level,p,seed)=>decision(view,p,seed).action;
