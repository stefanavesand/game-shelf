import {performance} from 'node:perf_hooks';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {eligibleActors,RESOURCES} from '../../play/catan/rules/index.js';
import {decideWithMemory,hash,validateProfile} from './profiles.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
function resourcesConserved(state){for(const r of RESOURCES){const amounts=[state.snapshot.state.game.bank[r],...state.snapshot.state.players.players.map(p=>p.resources[r])];if(amounts.some(n=>!Number.isSafeInteger(n)||n<0)||amounts.reduce((a,b)=>a+b)!==19)throw Error(`Resource invariant: ${r}`);}}
export function runMatch({job,profiles,maxActions,decisionSeed}){
 profiles=profiles.map(validateProfile);
 const humans=profiles.map((_,i)=>({id:'p'+i,name:'Seat '+(i+1)}));
 const trace=[],timings=[],counts={},planTrace=[],memories=new Map(),lastPlans=new Map(),started=performance.now();
 let state,reason=null;
 try{
  state=module.initialize(catanConfig(humans,{playerCount:profiles.length,seed:job.gameSeed}),{gameId:'experiment-'+job.caseId});
  while(state.snapshot.state.game.phase!=='ended'&&trace.length<maxActions){
   const actor=eligibleActors(state.snapshot)[0];if(!actor)throw Error('No eligible actor');
   const seat=humans.findIndex(h=>h.id===actor),view=module.view(state,actor);
   const seed=parseInt(hash({decisionSeed,caseId:job.caseId,actor,revision:view.revision,profile:hash(profiles[seat])}).slice(0,8),16);
   const start=performance.now(),decision=decideWithMemory(view,profiles[seat],seed,memories.get(actor)||null),action=decision.action,ms=performance.now()-start;
   // Policy output is only a proposal; the ordinary rules validate every command.
   state=module.apply(state,actor,{actor,action},{},{coordinatorId:humans[0].id});resourcesConserved(state);
   if(decision.memory)memories.set(actor,decision.memory);
   if(decision.diagnostics){const d=decision.diagnostics,key=hash({plan:d.plan?{key:d.plan.key,route:d.plan.route,cost:d.plan.cost,missing:d.plan.missing}:null});if(lastPlans.get(actor)!==key||d.selection!=='KEEP_GOAL'){planTrace.push({step:trace.length,actor,revision:view.revision,...d});lastPlans.set(actor,key);}}
   trace.push({actor,action});timings.push({seat,ms});counts[action.type]=(counts[action.type]||0)+1;
  }
  if(state.snapshot.state.game.phase!=='ended')reason='ACTION_CAP';
 }catch(error){reason='DECISION_OR_RULE_FAILURE: '+String(error.message).slice(0,240);}
 const winner=reason?null:state.snapshot.state.game.winnerId;
 return {schemaVersion:1,matchId:job.id,jobHash:hash(job),caseId:job.caseId,gameSeed:job.gameSeed,rotation:job.rotation,repeat:job.repeat,decisionSeed,status:reason?'failed':'ended',reason,winnerSeat:winner?humans.findIndex(h=>h.id===winner):null,playerCount:profiles.length,roster:job.roster,profileIds:profiles.map(p=>p.id),profileHashes:profiles.map(hash),steps:trace.length,turn:state?.snapshot.state.game.turn??0,counts,trace,traceHash:hash(trace),finalStateHash:state?hash(state):null,timings,elapsedMs:performance.now()-started,...(planTrace.length?{planTrace,planTraceHash:hash(planTrace)}:{})};
}
