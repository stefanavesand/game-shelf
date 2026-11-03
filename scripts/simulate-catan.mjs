// Opt-in natural rule/policy regressions; no credentials, server or privileged state fixtures.
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../play/catan/module.js';
import {CATAN_ARTIFACT} from '../play/catan/artifact.js';
import {eligibleActors,botDecision,RESOURCES} from '../play/catan/rules/index.js';
const games=Number(process.argv[2]??10);assert.ok(Number.isSafeInteger(games)&&games>0&&games<=1000);
const module=createCatanModule(CATAN_ARTIFACT.digest),summary={games,finished:0,failed:[],actions:0,maxActions:0};
for(let seed=1;seed<=games;seed++){
 const config=catanConfig([{id:'a',name:'A'},{id:'b',name:'B'}],{seed});let state=module.initialize(config,{gameId:`simulation-${seed}`}),steps=0;
 try{
  while(state.snapshot.state.game.phase!=='ended'&&steps<3000){
   const actor=eligibleActors(state.snapshot)[0],seat=state.snapshot.seats.find(s=>s.id===actor),action=botDecision(module.view(state,actor),'standard');
   state=module.apply(state,seat.kind==='bot'?'a':actor,{actor,action},{},{coordinatorId:'a'});steps++;
   const s=state.snapshot;
   for(const resource of RESOURCES){assert.equal(s.state.game.bank[resource]+s.state.players.players.reduce((n,p)=>n+p.resources[resource],0),19);assert.ok(s.state.game.bank[resource]>=0);assert.ok(s.state.players.players.every(p=>p.resources[resource]>=0));}
   assert.equal(s.deck.length+s.state.players.players.reduce((n,p)=>n+p.developmentCards.length,0),25);
   for(const p of s.state.players.players){assert.equal(p.roadsRemaining+s.state.board.roads.filter(r=>r.playerId===p.id).length,15);assert.equal(p.settlementsRemaining+s.state.board.buildings.filter(b=>b.playerId===p.id&&b.type==='settlement').length,5);assert.equal(p.citiesRemaining+s.state.board.buildings.filter(b=>b.playerId===p.id&&b.type==='city').length,4);}
  }
  assert.equal(state.snapshot.state.game.phase,'ended','Action budget exhausted');assert.ok(state.snapshot.state.game.finalScores[state.snapshot.state.game.winnerId]>=10);summary.finished++;
 }catch(error){summary.failed.push({seed,steps,error:error.message});}
 summary.actions+=steps;summary.maxActions=Math.max(summary.maxActions,steps);
}
console.log(JSON.stringify(summary));if(summary.failed.length)process.exitCode=1;
