import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {template,validateProfile,decideWithMemory} from '../../scripts/bots/profiles.mjs';
import {generateGoals,decision as shared} from '../../scripts/bots/shared-plan-policy.mjs';
import {decision,proposal,expectedDiscard,value} from '../../scripts/bots/build-trade-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('build-trade','build-trade-0.1.0')),p={...profile.parameters,switchMargin:2,tradeLeaderPenalty:0};
const bundle=x=>Object.fromEntries(RESOURCES.map(r=>[r,x[r]||0]));
function prepared(hand={ore:2,grain:2,wool:3},peer={ore:2},other={ore:1}){
 let s=module.initialize(catanConfig([0,1,2].map(i=>({id:'p'+i,name:'Seat '+i})),{seed:37}),{gameId:'build-trade-test'});
 for(let i=0;i<12;i++){const actor=s.snapshot.state.game.currentPlayerId;s=module.apply(s,actor,{actor,action:botDecision(module.view(s,actor),'standard')},{},{coordinatorId:'p0'});}
 Object.assign(s.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10});s.snapshot.history=[{revision:s.snapshot.revision,playerId:'p2',message:'end turn'}];
 for(const [i,h]of [hand,peer,other].entries())for(const r of RESOURCES){const q=s.snapshot.state.players.players[i];s.snapshot.state.game.bank[r]+=q.resources[r]-(h[r]||0);q.resources[r]=h[r]||0;}return s;
}
const view=s=>module.view(s,'p0'),apply=(s,id,a)=>module.apply(s,id,{actor:id,action:a},{},{coordinatorId:'p0'});
const city=s=>generateGoals(view(s),p).goals.find(g=>g.kind==='city'),memory=g=>({schemaVersion:1,goalKey:g.key});
test('incoming exchange and actual city use the same remembered goal',()=>{
 let s=prepared(),g=city(s);s=apply(s,'p1',{type:'TRADE_OFFER',to:'p0',give:bundle({ore:1}),receive:bundle({wool:1})});const v=view(s),before=structuredClone(v),d=decision(v,p,37,memory(g));assert.equal(d.action.type,'TRADE_ACCEPT');assert.equal(d.diagnostics.plan.key,g.key);s=apply(s,'p0',d.action);const build=decision(view(s),p,37,d.memory);assert.equal(build.action.type,'BUILD_CITY');assert.equal(build.diagnostics.plan.key,g.key);apply(s,'p0',build.action);assert.deepEqual(v,before);
});
test('outgoing terms improve this goal, pass the engine, then lead to its build',()=>{
 let s=prepared(),g=city(s),d=decision(view(s),p,37,memory(g));assert.equal(d.action.type,'TRADE_OFFER');assert.equal(d.action.receive.ore,1);assert.equal(d.action.to,'all');s=apply(s,'p0',d.action);s=apply(s,'p1',{type:'TRADE_ACCEPT',offerId:s.snapshot.offer.id});const build=decision(view(s),p,37,d.memory);assert.equal(build.action.type,'BUILD_CITY');assert.equal(build.diagnostics.plan.key,g.key);apply(s,'p0',build.action);
});
test('roads, exchange and final settlement follow one concrete site plan',()=>{
 let s=prepared({brick:3,lumber:2,grain:1,wool:1,ore:2},{lumber:2}),g=generateGoals(view(s),p).goals.find(g=>g.kind==='settlement'&&g.route.length===2);assert.ok(g);let m=memory(g);
 for(let i=0;i<2;i++){const d=decision(view(s),p,37,m);assert.equal(d.action.type,'BUILD_ROAD');assert.equal(d.diagnostics.plan.key,g.key);s=apply(s,'p0',d.action);m=d.memory;}
 const offer=decision(view(s),p,37,m);assert.equal(offer.action.type,'TRADE_OFFER');assert.equal(offer.action.receive.lumber,1);s=apply(s,'p0',offer.action);s=apply(s,'p1',{type:'TRADE_ACCEPT',offerId:s.snapshot.offer.id});const build=decision(view(s),p,37,offer.memory);assert.equal(build.action.type,'BUILD_SETTLEMENT');assert.equal(build.diagnostics.plan.key,g.key);apply(s,'p0',build.action);
});
test('harmful terms get a legal same-goal counteroffer, with no repeated counters',()=>{
 let s=prepared({ore:2,grain:2,wool:3},{ore:2,grain:1}),g=city(s);s=apply(s,'p1',{type:'TRADE_OFFER',to:'p0',give:bundle({grain:1}),receive:bundle({ore:1})});let d=decision(view(s),p,37,memory(g));assert.equal(d.reason,'COUNTER_FOR_BUILD_GOAL');assert.equal(d.action.to,'p1');assert.equal(d.action.replaces,s.snapshot.offer.id);s=apply(s,'p0',d.action);assert.equal(s.snapshot.offer.from,'p0');
 const v=view(s);v.history.push({revision:v.revision,playerId:'p0',message:'trade offer'});assert.equal(proposal(v,g,p),null);
});
test('next road resources are protected even if a trade reduces hand size',()=>{
 const s=prepared({brick:1,lumber:1,wool:6,grain:1}),v=view(s),g=generateGoals(v,p).goals.find(g=>g.kind==='settlement'&&g.route.length);assert.ok(g);const d=proposal(v,g,{...p,discardRiskWeight:0.5},0);assert.ok(d);if(d){assert.equal(d.action.give.brick,0);assert.equal(d.action.give.lumber,0);assert.ok(g.cost[RESOURCES.find(r=>d.action.receive[r])]>v.state.players.players[0].resources[RESOURCES.find(r=>d.action.receive[r])]);}
});
test('hand risk is soft, configurable and applies to count-reducing bank exchanges',()=>{
 assert.equal(expectedDiscard(bundle({wool:7})),0);assert.equal(expectedDiscard(bundle({wool:8})),4/6);
 const s=prepared({ore:2,grain:2,wool:4}),v=view(s),g=city(s),next=structuredClone(v.state);next.players.players[0].resources.wool--;
 const delta=weight=>value(v,next,g,{...p,discardRiskWeight:weight})-value(v,v.state,g,{...p,discardRiskWeight:weight});assert.ok(delta(.5)>delta(0));
 const d=decision(v,p,37,memory(g));assert.ok(['BANK_TRADE','TRADE_OFFER'].includes(d.action.type));apply(s,'p0',d.action);
});
test('proposal budget, unknown history, cooldown and stale offers are fenced',()=>{
 const s=prepared(),v=view(s),g=city(s),first=proposal(v,g,p);assert.ok(first);assert.equal(proposal(v,g,{...p,tradeOffersPerTurn:0}),null);
 const unknown=structuredClone(v);unknown.history=[];assert.equal(proposal(unknown,g,p),null);
 v.trades=[{from:'p0',to:'all',recipients:['p1','p2'],give:first.action.give,receive:first.action.receive,status:'declined',revision:0}];const next=proposal(v,g,p);if(next)assert.notDeepEqual([next.action.give,next.action.receive],[first.action.give,first.action.receive]);
 const offered=apply(s,'p1',{type:'TRADE_OFFER',to:'p0',give:bundle({ore:1}),receive:bundle({wool:1})}),stale=view(offered);stale.choices=[];assert.throws(()=>decision(stale,p,37,memory(g)));
});
test('hidden peer resource permutations and memory serialization preserve decisions',()=>{
 const a=prepared({ore:2,grain:2,wool:3},{ore:2,wool:1},{ore:1,wool:2}),b=structuredClone(a);[b.snapshot.state.players.players[1].resources,b.snapshot.state.players.players[2].resources]=[b.snapshot.state.players.players[2].resources,b.snapshot.state.players.players[1].resources];assert.deepEqual(view(a),view(b));const d=decideWithMemory(view(a),profile,37);assert.deepEqual(d,decideWithMemory(view(b),profile,37));assert.deepEqual(d.action,decideWithMemory(view(a),profile,37,JSON.parse(JSON.stringify(d.memory))).action);
 const bad=template('bad','build-trade-0.1.0');bad.parameters.tradeMaxGive=3;assert.throws(()=>validateProfile(bad));
});
test('roll and existing development actions remain delegated unchanged',()=>{
 const s=prepared({ore:3,grain:2}),g=city(s);s.snapshot.state.game.phase='roll';assert.deepEqual(decision(view(s),p,37,memory(g)).action,shared(view(s),p,37,memory(g)).action);
 s.snapshot.state.game.phase='main';const i=s.snapshot.deck.indexOf('yearOfPlenty');s.snapshot.deck.splice(i,1);s.snapshot.state.game.developmentDeckCount--;s.snapshot.state.players.players[0].developmentCards.push({id:'yop',type:'yearOfPlenty',isPlayed:false,turnBought:0});s.snapshot.state.players.players[0].resources.ore--;s.snapshot.state.game.bank.ore++;
 assert.equal(shared(view(s),p,37,memory(g)).action.type,'PLAY_YEAR_OF_PLENTY');assert.deepEqual(decision(view(s),p,37,memory(g)).action,shared(view(s),p,37,memory(g)).action);
});
test('natural matches finish and reproduce action, plan and state hashes',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),base=validateProfile(template('baseline','heuristic-1.1.0')),job={id:'build-trade-natural',caseId:'build-trade-natural',gameSeed:37,rotation:0,repeat:0,roster:'three',profiles:['build-trade','baseline','baseline']},input={job,profiles:[profile,base,base],maxActions:2500,decisionSeed:92831};const a=runMatch(input),b=runMatch(input);assert.equal(a.status,'ended',a.reason);assert.equal(a.traceHash,b.traceHash);assert.equal(a.planTraceHash,b.planTraceHash);assert.equal(a.finalStateHash,b.finalStateHash);
});
