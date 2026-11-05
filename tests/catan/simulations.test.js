import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,eligibleActors,BOT_VERSION,RESOURCES} from '../../play/catan/rules/index.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
function invariants(state,label){
 const s=state.snapshot,ps=s.state.players.players;
 for(const r of RESOURCES){const amounts=[s.state.game.bank[r],...ps.map(p=>p.resources[r])];assert.equal(amounts.reduce((a,b)=>a+b),19,label+' resource '+r);assert.ok(amounts.every(n=>Number.isSafeInteger(n)&&n>=0),label+' nonnegative '+r);}
 assert.equal(s.deck.length+ps.reduce((n,p)=>n+p.developmentCards.length,0),25,label+' deck');
 for(const p of ps){
  const buildings=s.state.board.buildings.filter(b=>b.playerId===p.id);
  assert.equal(p.settlementsRemaining+buildings.filter(b=>b.type==='settlement').length,5,label+' settlements');
  assert.equal(p.citiesRemaining+buildings.filter(b=>b.type==='city').length,4,label+' cities');
  assert.equal(p.roadsRemaining+s.state.board.roads.filter(r=>r.playerId===p.id).length,15,label+' roads');
 }
}
test('100 current-policy natural games finish across both levels and supported seat configurations',{timeout:180000},()=>{
 let total=0,max=0;const groups=[];
 for(const solo of [false,true])for(const level of ['easy','standard']){
  let completed=0;
  for(let i=1;i<=25;i++){
   const seed=2026000+i,humanSeats=solo?[{id:'a',name:'A'}]:i%2?[{id:'a',name:'A'},{id:'b',name:'B'}]:[{id:'b',name:'B'},{id:'a',name:'A'}];
   const label=JSON.stringify({seed,solo,level,policy:BOT_VERSION,artifact:CATAN_ARTIFACT.digest,humanOrder:humanSeats.map(h=>h.id)});
   let state=module.initialize(catanConfig(humanSeats,{solo,level,seed}),{gameId:'simulation-'+i}),steps=0;
   const coordinatorId=humanSeats[0].id;
   while(state.snapshot.state.game.phase!=='ended'&&steps<2500){
    let command=module.nextBot(state);
    if(!command){const actor=eligibleActors(state.snapshot)[0];command={actor,action:botDecision(module.view(state,actor),level)};}
    const seat=state.snapshot.seats.find(s=>s.id===command.actor);
    try{state=module.apply(state,seat.kind==='bot'?coordinatorId:seat.id,command,{},{coordinatorId});}catch(error){throw Error(label+' action '+steps+' '+command.action.type+': '+error.message);}
    steps++;invariants(state,label+' action '+steps);
   }
   assert.equal(state.snapshot.state.game.phase,'ended',label+' reached action cap (not a completion)');assert.ok(state.snapshot.state.game.winnerId,label);
   completed++;total+=steps;max=Math.max(max,steps);
  }
  groups.push({solo,level,completed});
 }
 console.log('Current policy simulation summary:',JSON.stringify({policy:BOT_VERSION,artifact:CATAN_ARTIFACT.digest,groups,totalActions:total,maxActions:max}));
});
