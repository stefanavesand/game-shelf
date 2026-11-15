import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {eligibleActors,RESOURCES} from '../../play/catan/rules/index.js';
import {decideBot,botProfile} from '../../play/bots/decision.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
test('Easy, Standard and Hard finish mixed three/four-seat games with either robber rule',async()=>{
 const results=[];
 for(const playerCount of [3,4])for(const friendlyRobber of [true,false]){
  const levels=['easy','standard','hard','standard'],config=catanConfig(Array.from({length:playerCount},(_,i)=>({id:'p'+i,name:'Seat '+i})),{seed:37,playerCount,friendlyRobber});config.seats.forEach((s,i)=>s.level=levels[i]);
  let state=module.initialize(config,{gameId:'levels-'+playerCount+'-'+friendlyRobber}),steps=0;const memory=new Map();
  while(state.snapshot.state.game.phase!=='ended'&&steps++<2500){const actor=eligibleActors(state.snapshot)[0],view=module.view(state,actor),result=await decideBot(view,memory.get(actor)||null);const {profileHash}=await botProfile(view);assert.equal(result.memory.profileHash,profileHash);state=module.apply(state,actor,{actor,action:result.action},{},{coordinatorId:'p0'});memory.set(actor,result.memory);for(const r of RESOURCES)assert.equal(state.snapshot.state.game.bank[r]+state.snapshot.state.players.players.reduce((n,p)=>n+p.resources[r],0),19);}
  assert.equal(state.snapshot.state.game.phase,'ended');results.push({playerCount,friendlyRobber,steps,winner:state.snapshot.state.game.winnerId});
 }
 console.log('Strategic level mixed-game validation:',JSON.stringify(results));
});
