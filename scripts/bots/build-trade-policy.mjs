// Original shared-goal trade overlay. Counterfactuals change only our own hand.
import {decision as sharedDecision,selectGoal,handValue} from './shared-plan-policy.mjs';
import {offerWindow} from './trade-policy.mjs';
import {preview} from './planner-policy.mjs';
import {catanChoices} from '../../play/catan/rules/session.js';
import {RESOURCES,COSTS} from '../../play/catan/rules/economy.js';
const total=o=>RESOURCES.reduce((n,r)=>n+(o[r]||0),0);
const own=(v,state=v.state)=>state.players.players.find(q=>q.id===v.you);
const signature=(give,receive)=>RESOURCES.map(r=>`${give[r]||0}:${receive[r]||0}`).join('|');
export const expectedDiscard=hand=>total(hand)>7?Math.floor(total(hand)/2)/6:0;
export function value(view,state,goal,p){return handValue(state,view.you,goal,p)-p.discardRiskWeight*expectedDiscard(own(view,state).resources);}
function exchange(view,give,receive){return {...view.state,players:{...view.state.players,players:view.state.players.players.map(q=>q.id===view.you?{...q,resources:Object.fromEntries(RESOURCES.map(r=>[r,q.resources[r]-(give[r]||0)+(receive[r]||0)]))}:q)}};}
function nextCost(goal){return goal.kind==='city'?COSTS.city:goal.kind==='development'?COSTS.development:goal.route.length?COSTS.road:COSTS.settlement;}
function protectsStep(view,state,goal){const cost=nextCost(goal),before=own(view).resources,after=own(view,state).resources;return RESOURCES.every(r=>Math.max(0,(cost[r]||0)-after[r])<=Math.max(0,(cost[r]||0)-before[r]));}
function threat(view,id,give,p){const peer=view.state.players.players.find(q=>q.id===id);return p.tradeLeaderPenalty*Math.max(0,peer.victoryPoints-p.tradeLeaderVp+1)/Math.max(1,view.state.game.settings.victoryPoints-p.tradeLeaderVp)*total(give);}
function cooled(view,id,give,receive,p){return p.tradeCooldownOwnTurns>0&&(view.trades||[]).some(t=>t.from===view.you&&signature(t.give,t.receive)===signature(give,receive)&&(t.responses?.[id]==='declined'||t.status==='declined'&&(t.recipients||[t.to]).includes(id))&&view.history.filter(h=>h.revision>t.revision&&h.playerId===view.you&&h.message==='end turn').length<=p.tradeCooldownOwnTurns);}
function bankOption(view,goal,p){if(view.state.game.currentPlayerId!==view.you)return null;const current=value(view,view.state,goal,p);let best=null;
 for(const action of catanChoices(view.state,view.you,null).filter(a=>a.type==='BANK_TRADE')){const next=preview(view.state,view.you,action);if(!protectsStep(view,next,goal))continue;const gain=value(view,next,goal,p)-current;if(gain>0.000001&&(!best||gain>best.gain))best={action,gain};}return best;
}
export function proposal(view,goal,p,alternative=0){const window=offerWindow(view);if(!window.known||window.count>=p.tradeOffersPerTurn)return null;
 const stock=own(view).resources,current=value(view,view.state,goal,p),candidates=[];
 for(const want of RESOURCES.filter(r=>stock[r]<goal.cost[r]))for(const give of RESOURCES.filter(r=>r!==want))for(let n=1;n<=p.tradeMaxGive;n++){
  if(stock[give]<n)continue;const send=Object.fromEntries(RESOURCES.map(r=>[r,r===give?n:0])),receive=Object.fromEntries(RESOURCES.map(r=>[r,r===want?1:0])),next=exchange(view,send,receive);
  if(!protectsStep(view,next,goal))continue;
  const gain=value(view,next,goal,p)-current;if(gain<p.tradeMinGain)continue;
  // Public totals can rule out an impossible recipient, never reveal its types.
  const peers=view.state.players.players.filter(q=>q.id!==view.you&&(!view.offer||q.id===view.offer.from)&&q.resourceCount>=1&&!cooled(view,q.id,send,receive,p));if(!peers.length)continue;
  const all=view.state.players.players.filter(q=>q.id!==view.you),targets=[...(!view.offer&&peers.length===all.length?[{to:'all',peers}]:[]),...peers.map(q=>({to:q.id,peers:[q]}))];
  for(const target of targets){const net=(gain-Math.max(...target.peers.map(q=>threat(view,q.id,send,p))))*p.tradeProposalDiscount;if(net>=p.tradeMinGain&&net>alternative)candidates.push({action:{type:'TRADE_OFFER',to:target.to,give:send,receive,...(view.offer?{replaces:view.offer.id}:{})},gain:net});}
 }
 candidates.sort((a,b)=>b.gain-a.gain);return candidates[0]||null;
}
export function decision(view,p,seed,memory=null){
 const base=sharedDecision(view,p,seed,memory);
 // Setup, robber, discards and development actions retain the existing policy.
 if(!view.offer&&!['main','roll'].includes(view.state.game.phase))return base;
 const selected=selectGoal(view,p,memory),goal=selected.goal;
 if(!goal)return base;
 const finish=(action,reason,extra={})=>({...base,action,reason,memory:{schemaVersion:1,goalKey:goal.key},diagnostics:{...(base.diagnostics||{}),selection:selected.reason,plan:goal,alternatives:selected.alternatives,graphNodes:selected.graph.expanded,graphTruncated:selected.graph.truncated,nextStep:action,...extra}});
 if(view.offer){
  const offer=view.offer,choices=catanChoices(view.state,view.you,offer),allowed=type=>choices.find(a=>a.type===type&&a.offerId===offer.id&&view.choices.some(c=>c.type===type&&c.offerId===offer.id));
  if(offer.from===view.you){const cancel=allowed('TRADE_CANCEL');if(!cancel)throw Error('Stale outgoing offer');return finish(cancel,'CANCEL_PENDING_OFFER');}
  const decline=allowed('TRADE_DECLINE');if(!decline)throw Error('Stale incoming offer');const accept=allowed('TRADE_ACCEPT');if(!accept)return finish(decline,'UNAFFORDABLE_OFFER');
  const next=exchange(view,offer.receive,offer.give);const protectedStep=protectsStep(view,next,goal);
  const gain=value(view,next,goal,p)-value(view,view.state,goal,p)-threat(view,offer.from,offer.receive,p),bank=bankOption(view,goal,p)?.gain||0;
  if(protectedStep&&gain>=p.tradeMinGain&&gain>=bank)return finish(accept,'ACCEPT_FOR_BUILD_GOAL',{tradeGain:gain,bankGain:bank});
  const counter=proposal(view,goal,p,bank);if(counter)return finish(counter.action,'COUNTER_FOR_BUILD_GOAL',{tradeGain:counter.gain});
  return finish(decline,protectedStep?'INSUFFICIENT_BUILD_GAIN':'PROTECT_NEXT_BUILD',{tradeGain:gain,bankGain:bank});
 }
 if(view.state.game.phase!=='main'||!['BANK_TRADE','END_TURN','TRADE_OFFER'].includes(base.action.type))return base;
 const bank=bankOption(view,goal,p),offer=proposal(view,goal,p,bank?.gain||0);
 if(offer)return finish(offer.action,'PROPOSE_FOR_BUILD_GOAL',{tradeGain:offer.gain});
 if(bank)return finish(bank.action,'BANK_FOR_BUILD_AND_HAND_RISK',{tradeGain:bank.gain});
 const end=view.choices.find(a=>a.type==='END_TURN');if(!end)throw Error('No legal end turn');return finish(end,'WAIT_FOR_BUILD_GOAL');
}
