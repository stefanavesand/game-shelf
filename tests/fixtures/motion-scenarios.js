import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision} from '../../play/catan/rules/index.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),you='demo-you',roomId='motion-fixture';
function act(state,actor,action){return module.apply(state,you,{actor,action},{},{coordinatorId:you});}
function packet(state){return {ok:true,roomId,you,revision:state.snapshot.revision,view:module.view(state,you)};}
function base(){
 let state=module.initialize(catanConfig([{id:you,name:'You'}],{solo:true,seed:42}),{gameId:roomId});
 while(state.snapshot.state.game.phase.startsWith('setup')){const actor=state.snapshot.state.game.currentPlayerId;state=act(state,actor,botDecision(module.view(state,actor),'standard'));}
 const s=state.snapshot;Object.assign(s.state.game,{phase:'main',turn:8,currentPlayerId:you,lastRoll:null});s.history=[];s.revision=100;
 const own=s.state.players.players.find(p=>p.id===you);for(const r of ['brick','lumber','ore','grain','wool']){s.state.game.bank[r]+=own.resources[r]-6;own.resources[r]=6;}
 return state;
}
export function scenario(kind){
 let before=base(),actor=you,action;
 if(kind==='roll'){
  before.snapshot.state.game.phase='roll';
  for(let seed=1;seed<100;seed++){
   before.entropy.rngState=seed;const after=act(before,you,{type:'ROLL_DICE'}),a=module.view(after,you),b=module.view(before,you);
   if(a.state.game.lastRoll.total!==7&&Object.keys(a.state.players.players[0].resources).some(r=>a.state.players.players[0].resources[r]>b.state.players.players[0].resources[r]))return {before:packet(before),after:packet(after)};
  }
  action={type:'ROLL_DICE'};
 }else if(kind==='robber'){
  before.snapshot.state.game.phase='robber-move';action=module.view(before,you).choices.find(c=>c.type==='MOVE_ROBBER');
 }else{
  const type={road:'BUILD_ROAD',settlement:'BUILD_SETTLEMENT',city:'BUILD_CITY'}[kind];
  action=module.view(before,you).choices.find(c=>c.type===type);
  if(!action&&kind==='settlement'){
   for(const road of module.view(before,you).choices.filter(c=>c.type==='BUILD_ROAD')){const extended=act(before,you,road),choice=module.view(extended,you).choices.find(c=>c.type===type);if(choice){before=extended;action=choice;break;}}
  }
 }
 if(!action)throw Error('No legal demo action for '+kind);
 return {before:packet(before),after:packet(act(before,actor,action))};
}
