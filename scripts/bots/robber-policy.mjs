// Original public-board robber valuation and optional Knight retention gate.
import {decision as previous} from './build-trade-components.mjs';
import {selectGoal} from './shared-plan-policy.mjs';
import {value as goalValue,expectedDiscard} from './build-trade-policy.mjs';
import {opponentTotals} from './resource-policy.mjs';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {robberPlacements,victims,applyTurn} from '../../play/catan/rules/turn.js';
import {catanChoices} from '../../play/catan/rules/session.js';
import {applyEconomy} from '../../play/catan/rules/economy.js';
import {score} from '../../play/catan/rules/scoring.js';
const resource={hills:'brick',forest:'lumber',mountains:'ore',fields:'grain',pasture:'wool'},same=(a,b)=>a.q===b.q&&a.r===b.r,compare=(a,b)=>a<b?-1:a>b?1:0;
const own=v=>v.state.players.players.find(q=>q.id===v.you),ctx={id:()=> 'robber-preview',now:()=>0,randomInt:()=>{throw Error('Robber preview requested hidden entropy');}};
export function threat(view,id,p){const peer=view.state.players.players.find(q=>q.id===id),vp=Math.max(0,peer?.victoryPoints||0),target=view.state.game.settings.victoryPoints;return 1+p.robberThreatWeight*(Math.min(1,vp/target)+Math.min(1,Math.max(0,vp-p.robberThreatVp+1)/Math.max(1,target-p.robberThreatVp+1)));}
export function chooseVictim(view,ids,p){return [...ids].sort((a,b)=>threat(view,b,p)-threat(view,a,p)||compare(a,b))[0]||null;}
function theftValue(view,victim,p){if(!victim)return 0;const stock=own(view).resources;return p.robberStealValue*threat(view,victim,p)-p.discardRiskWeight*(expectedDiscard({...stock,brick:stock.brick+1})-expectedDiscard(stock));}
export function rankRobber(view,p,memory=null){
 const goal=selectGoal(view,p,memory).goal,stock=own(view).resources,tiles=new Map();
 for(const tile of view.state.board.tiles){const corners=new Set(getHexVertices(tile.coord).map(vertexKey)),rate=tile.number?(6-Math.abs(7-tile.number))/36:0,r=resource[tile.terrain];let self=0,denial=0;
  if(r)for(const b of view.state.board.buildings.filter(b=>corners.has(vertexKey(b.vertex)))){const units=b.type==='city'?2:1;if(b.playerId===view.you){const scarcity=goal?.cost[r]?Math.max(0,goal.cost[r]-stock[r])/goal.cost[r]:0;self+=rate*units*p.robberOwnProductionWeight*(1+p.robberPlanResourceWeight*scarcity);}else denial+=rate*units*threat(view,b.playerId,p);}
  tiles.set(tile.coord.q+','+tile.coord.r,{self,denial});
 }
 const old=tiles.get(view.state.board.robberLocation.q+','+view.state.board.robberLocation.r),scale=p.productionWeight*p.robberExpectedRolls;
 // Only the hand count changes in this risk proxy; no stolen resource type is guessed.
 const options=robberPlacements(view.state,view.you).map(hex=>{const after=tiles.get(hex.q+','+hex.r),victim=chooseVictim(view,victims(view.state,hex,view.you),p),ownRelease=(old.self-after.self)*scale,opponentDenial=(after.denial-old.denial)*scale,steal=theftValue(view,victim,p);return {hex,victim,ownRelease,opponentDenial,steal,value:ownRelease+opponentDenial+steal};});
 if(options.length>18)throw Error('Unsupported robber board exceeds base-game bounds');
 return options.sort((a,b)=>b.value-a.value||a.hex.q-b.hex.q||a.hex.r-b.hex.r);
}
function armyProgress(state,id,p){const me=state.players.players.find(q=>q.id===id),holder=state.game.largestArmy;
 if(holder?.playerId===id){const peer=Math.max(0,...state.players.players.filter(q=>q.id!==id).map(q=>q.armySize));return p.knightArmyProgressWeight*Math.min(1,Math.max(0,me.armySize-peer)/3);}
 const target=Math.max(3,(holder?.value||2)+1);return p.knightArmyProgressWeight/(1+Math.max(0,target-me.armySize));
}
function competingCardGain(view,p,memory){const goal=selectGoal(view,p,memory).goal;if(!goal)return 0;const current=goalValue(view,view.state,goal,p),totals=opponentTotals(view);let best=0;
 for(const a of catanChoices(view.state,view.you,null)){
  let next;if(a.type==='PLAY_YEAR_OF_PLENTY')next=applyEconomy(view.state,[],a,view.you,ctx).state;
  else if(a.type==='PLAY_MONOPOLY'&&totals?.[a.resource])next={...view.state,players:{...view.state.players,players:view.state.players.players.map(q=>q.id===view.you?{...q,resources:{...q.resources,[a.resource]:q.resources[a.resource]+totals[a.resource]}}:q)}};
  if(next)best=Math.max(best,goalValue(view,next,goal,p)-current);
 }return best;
}
function withoutKnight(view){return {...view,choices:view.choices.filter(a=>a.type!=='PLAY_KNIGHT'),state:{...view.state,players:{...view.state.players,players:view.state.players.players.map(q=>q.id===view.you?{...q,developmentCards:q.developmentCards.map(c=>c.type==='knight'?{...c,isPlayed:true}:c)}:q)}}};}
export function decision(view,p,seed,memory=null){
 const base=previous(view,p,seed,memory),phase=view.state.game.phase;if(!p.enableRobberValuation&&!p.enableKnightTiming)return base;
 const finish=(result,action,reason,extra)=>({...result,action,reason,diagnostics:{...(result.diagnostics||{selection:'ROBBER_DECISION',plan:null,alternatives:[]}),nextStep:action,...extra}});
 if(p.enableRobberValuation&&phase==='robber-move'){
  const ranked=rankRobber(view,p,memory),best=ranked.find(o=>view.choices.some(a=>a.type==='MOVE_ROBBER'&&same(a.hex,o.hex)));if(!best)throw Error('No legal robber placement');
  return finish(base,view.choices.find(a=>a.type==='MOVE_ROBBER'&&same(a.hex,best.hex)),'ROBBER_PUBLIC_VALUE',{robber:best});
 }
 if(p.enableRobberValuation&&phase==='robber-steal'){
  const ids=victims(view.state,view.state.board.robberLocation,view.you).filter(id=>view.choices.some(a=>a.type==='STEAL_RESOURCE'&&a.victimId===id)),victim=chooseVictim(view,ids,p);if(!victim)throw Error('No legal robber victim');
  return finish(base,view.choices.find(a=>a.type==='STEAL_RESOURCE'&&a.victimId===victim),'ROBBER_PUBLIC_THREAT',{robber:{victim}});
 }
 // Timing only gates a Knight the old policy would play. Existing winning actions
 // and selected builds/trades/other action cards remain untouched in this slice.
 if(!p.enableKnightTiming||base.action.type!=='PLAY_KNIGHT'||base.reason==='IMMEDIATE_WIN')return base;
 const preview=applyEconomy(view.state,[],base.action,view.you,ctx);if(!preview.success)throw Error('Invalid Knight preview');
 const next={...view,revision:view.revision+1,state:preview.state,choices:catanChoices(preview.state,view.you,null)},ranked=rankRobber(next,p,base.memory);
 let robber=ranked[0];
 if(!p.enableRobberValuation){const oldMove=previous(next,p,seed,base.memory).action;robber=ranked.find(o=>oldMove.type==='MOVE_ROBBER'&&same(o.hex,oldMove.hex));
  if(robber){const moved=applyTurn(preview.state,oldMove,view.you,ctx.randomInt);if(!moved.success)throw Error('Invalid legacy robber preview');let victim=null;
   if(moved.state.game.phase==='robber-steal'){const after={...next,revision:next.revision+1,state:moved.state,choices:catanChoices(moved.state,view.you,null)};victim=previous(after,p,seed,base.memory).action.victimId;}
   robber={...robber,victim,steal:theftValue(view,victim,p)};robber.value=robber.ownRelease+robber.opponentDenial+robber.steal;
  }
 }
 const award=score(preview.state,view.you,true)-score(view.state,view.you,true),progress=award?0:armyProgress(preview.state,view.you,p)-armyProgress(view.state,view.you,p),other=competingCardGain(view,p,base.memory)*p.knightOtherCardWeight;
 const gain=(robber?.value||0)+award+progress-p.knightHoldValue-other,knight={gain,award,progress,otherCardGain:other,robber:robber||null};
 if(gain>=p.knightMinGain)return finish(base,base.action,'KNIGHT_STRATEGIC_GAIN',{knight});
 // Mask availability only in a private counterfactual to preserve the old
 // build/trade/card alternative selector. The real Knight is never consumed.
 const alternative=previous(withoutKnight(view),p,seed,memory);
 return finish(alternative,alternative.action,'HOLD_KNIGHT',{knight,alternativeReason:alternative.reason});
}
