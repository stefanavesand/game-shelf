// Original observation-only resource decisions. Ordinary rules validate commands.
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {evaluate,buildPlans,production,preview} from './planner-policy.mjs';
import {RESOURCES,COSTS,applyEconomy} from '../../play/catan/rules/economy.js';
import {applyTurn} from '../../play/catan/rules/turn.js';
import {catanChoices} from '../../play/catan/rules/session.js';
import {score} from '../../play/catan/rules/scoring.js';
const resourceCards=new Set(['PLAY_YEAR_OF_PLENTY','PLAY_MONOPOLY']);
const builds=new Set(['BUILD_CITY','BUILD_SETTLEMENT','BUILD_ROAD']);
const own=(state,id)=>state.players.players.find(p=>p.id===id);
const sum=values=>Object.values(values).reduce((a,b)=>a+b,0);
const bundle=values=>Object.fromEntries(RESOURCES.map(r=>[r,values[r]||0]));
const actionKey=a=>JSON.stringify({type:a.type,resource:a.resource,resources:a.resources});
const context={id:()=> 'resource-preview',now:()=>0,randomInt:()=>{throw Error('Resource preview must not consume entropy');}};
export function opponentTotals(view){
 if(view.state.game.mode!=='base'||view.state.game.settings.mode!=='base'||view.state.game.settings.hideBankCards!==false)return null;
 const player=own(view.state,view.you),bank=view.state.game.bank,result={};
 for(const r of RESOURCES){
  if(!Number.isSafeInteger(bank[r])||bank[r]<0||bank[r]>19||!Number.isSafeInteger(player.resources[r])||player.resources[r]<0||player.resources[r]>19)return null;
  result[r]=19-bank[r]-player.resources[r];if(result[r]<0||result[r]>19)return null;
 }
 const count=view.state.players.players.filter(p=>p.id!==view.you).reduce((n,p)=>n+p.resourceCount,0);
 return sum(result)===count?result:null;
}
function utility(state,id,p,rates){
 const stock=own(state,id).resources;
 return evaluate(state,id,p).value+p.cardReserveWeight*RESOURCES.reduce((n,r)=>n+Math.min(stock[r],5)/(1+rates[r]*p.horizonRolls),0);
}
export function discardCandidates(view,p){
 const state=view.state,player=own(state,view.you),count=state.game.discardAmounts?.[view.you]??Math.floor(sum(player.resources)/2),rates=production(state,view.you);
 const candidates=[],seen=new Set();let nodes=0;
 const add=resources=>{
  if(candidates.length>=p.maxDiscardCandidates)return;
  const action={type:'DISCARD_RESOURCES',resources:bundle(resources)},key=JSON.stringify(action.resources);if(seen.has(key))return;
  const result=applyTurn(state,action,view.you,context.randomInt);if(!result.success)return;
  seen.add(key);candidates.push({action,state:result.state});
 };
 // The existing legal heuristic is always the first bounded-search fallback.
 for(const action of catanChoices(state,view.you,null))if(action.type==='DISCARD_RESOURCES')add(action.resources);
 const keepCount=sum(player.resources)-count,order=[...RESOURCES].sort((a,b)=>rates[a]-rates[b]);
 const costs=buildPlans(state,view.you,p).map(plan=>plan.cost);
 for(const cost of [...costs,{}]){
  const keep=bundle({});let remaining=keepCount;
  for(const r of order){const n=Math.min(player.resources[r],cost[r]||0,remaining);keep[r]=n;remaining-=n;}
  for(const r of order){const n=Math.min(player.resources[r]-keep[r],remaining);keep[r]+=n;remaining-=n;}
  add(Object.fromEntries(RESOURCES.map(r=>[r,player.resources[r]-keep[r]])));
 }
 function visit(index,remaining,resources){
  if(candidates.length>=p.maxDiscardCandidates||++nodes>p.maxDiscardCandidates*100)return;
  if(index===RESOURCES.length-1){if(remaining<=player.resources[RESOURCES[index]])add({...resources,[RESOURCES[index]]:remaining});return;}
  const r=RESOURCES[index],rest=RESOURCES.slice(index+1).reduce((n,r)=>n+player.resources[r],0);
  for(let n=Math.max(0,remaining-rest);n<=Math.min(remaining,player.resources[r]);n++){visit(index+1,remaining-n,{...resources,[r]:n});if(candidates.length>=p.maxDiscardCandidates||nodes>p.maxDiscardCandidates*100)return;}
 }
 visit(0,count,{});
 return {candidates,nodes};
}
function cardOutcome(view,action,totals){
 if(action.type==='PLAY_YEAR_OF_PLENTY'){
  const result=applyEconomy(view.state,[],action,view.you,context);if(!result.success)throw Error('Illegal resource card preview');return result.state;
 }
 // Aggregate-only counterfactual: no type is assigned to any opponent hand.
 const input=view.state;return {...input,players:{...input.players,players:input.players.players.map(p=>p.id===view.you?{...p,resources:{...p.resources,[action.resource]:p.resources[action.resource]+totals[action.resource]}}:p)}};
}
function winningBuild(state,id){
 if(score(state,id,true)+3<state.game.settings.victoryPoints)return false;
 return catanChoices(state,id,null).filter(a=>builds.has(a.type)).some(a=>score(preview(state,id,a),id,true)>=state.game.settings.victoryPoints);
}
export function decision(view,p,_seed){
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Resource policy observation exceeds work budget');
 if(view.offer)return {action:baseline(view,'standard'),reason:'UNCHANGED_TRADE'};
 if(view.state.game.phase==='discard'){
  const rates=production(view.state,view.you);
  const {candidates,nodes}=discardCandidates(view,p);if(!candidates.length)throw Error('No validated discard candidate');
  let best=null;for(const candidate of candidates){const value=utility(candidate.state,view.you,p,rates);if(!best||value>best.value)best={...candidate,value};}
  return {action:best.action,reason:'PRESERVE_BUILD_HAND',candidates:candidates.length,nodes};
 }
 const eligible=catanChoices(view.state,view.you,null),allowed=new Set(eligible.map(actionKey));
 const cards=view.choices.filter(a=>resourceCards.has(a.type)&&allowed.has(actionKey(a)));
 if(view.choices.some(a=>resourceCards.has(a.type)&&!allowed.has(actionKey(a))))throw Error('Stale or illegal resource-card choice');
 if(!cards.length)return {action:baseline(view,'standard'),reason:'UNCHANGED_PHASE'};
 const rates=production(view.state,view.you);
 const filtered={...view,choices:view.choices.filter(a=>!resourceCards.has(a.type))};
 if(!filtered.choices.length)throw Error('No non-resource-card fallback');
 const fallback=baseline(filtered,'standard');
 if(view.state.game.phase==='roll'&&!p.allowResourceCardBeforeRoll)return {action:fallback,reason:'WAIT_UNTIL_AFTER_ROLL'};
 if(score(view.state,view.you,true)+3>=view.state.game.settings.victoryPoints)for(const a of eligible.filter(a=>builds.has(a.type)))if(score(preview(view.state,view.you,a),view.you,true)>=view.state.game.settings.victoryPoints)return {action:a,reason:'IMMEDIATE_BUILD_WIN'};
 const otherDevelopment=['PLAY_KNIGHT','PLAY_ROAD_BUILDING'].includes(fallback.type);
 const current=utility(view.state,view.you,p,rates),totals=opponentTotals(view);let alternative=0;
 if(eligible.some(a=>a.type==='BUY_DEVELOPMENT_CARD')){
  // Expected purchase value only: never draw or guess a private card.
  const input=view.state,player=own(input,view.you),cost=COSTS.development;
  const next={...input,game:{...input.game,developmentDeckCount:input.game.developmentDeckCount-1,bank:Object.fromEntries(RESOURCES.map(r=>[r,input.game.bank[r]+(cost[r]||0)]))},players:{...input.players,players:input.players.players.map(q=>q.id===view.you?{...q,resources:Object.fromEntries(RESOURCES.map(r=>[r,player.resources[r]-(cost[r]||0)]))}:q)}};
  alternative=Math.max(alternative,utility(next,view.you,p,rates)+p.developmentValue-current);
 }
 const priority={BUILD_CITY:0,BUILD_SETTLEMENT:1,BANK_TRADE:2,BUILD_ROAD:3};
 for(const a of eligible.filter(a=>Object.hasOwn(priority,a.type)).sort((a,b)=>priority[a.type]-priority[b.type]).slice(0,p.maxCardBuildComparisons))alternative=Math.max(alternative,utility(preview(view.state,view.you,a),view.you,p,rates)-current);
 let best=null;
 for(const action of cards){
  if(action.type==='PLAY_MONOPOLY'&&(!totals||totals[action.resource]===0))continue;
  const next=cardOutcome(view,action,totals),gain=utility(next,view.you,p,rates)-current,win=view.state.game.phase==='main'&&winningBuild(next,view.you);
  if(win)return {action,reason:'RESOURCE_CARD_ENABLES_WIN'};
  if(gain>=p.resourceCardThreshold&&gain>=alternative+p.cardOpportunityMargin&&(!best||gain>best.gain))best={action,reason:'IMPROVE_WHOLE_HAND',gain,alternative};
 }
 if(otherDevelopment)return {action:fallback,reason:'UNCHANGED_OTHER_DEVELOPMENT'};
 return best||{action:fallback,reason:'RETAIN_RESOURCE_CARD',alternative};
}
export const botDecision=(view,_level,p,seed)=>decision(view,p,seed).action;
