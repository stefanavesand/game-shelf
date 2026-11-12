import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {template,validateProfile,decide} from '../../scripts/bots/profiles.mjs';
import {tradeDecision,proposal,offerWindow,decision} from '../../scripts/bots/trade-policy.mjs';
import {score} from '../../play/catan/rules/scoring.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('trade','trade-planner-0.1.0')),p=profile.parameters;
const bundle=value=>Object.fromEntries(RESOURCES.map(r=>[r,value[r]||0]));
function prepared(held={grain:2,ore:2,wool:3},peer={ore:1},other={ore:1}){
 const humans=[0,1,2].map(i=>({id:'p'+i,name:'Seat '+i}));let state=module.initialize(catanConfig(humans,{seed:37,playerCount:3}),{gameId:'trade-policy-test'});
 while(state.snapshot.state.game.phase.startsWith('setup')){const actor=state.snapshot.state.game.currentPlayerId;state=module.apply(state,actor,{actor,action:botDecision(module.view(state,actor),'standard')},{},{coordinatorId:'p0'});}
 Object.assign(state.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10});state.snapshot.history=[{revision:state.snapshot.revision,playerId:'p2',message:'end turn'}];
 for(const [i,value]of [held,peer,other].entries())for(const r of RESOURCES){const own=state.snapshot.state.players.players[i];state.snapshot.state.game.bank[r]+=own.resources[r]-(value[r]||0);own.resources[r]=value[r]||0;}return state;
}
function offered(state,give={ore:1},receive={wool:2}){return module.apply(state,'p1',{actor:'p1',action:{type:'TRADE_OFFER',to:'p0',give:bundle(give),receive:bundle(receive)}},{},{coordinatorId:'p0'});}
test('a legal asymmetric trade that enables a city is accepted without mutating the view',()=>{
 const state=offered(prepared()),v=module.view(state,'p0'),before=structuredClone(v),d=tradeDecision(v,p);assert.equal(d.action.type,'TRADE_ACCEPT');const after=module.apply(state,'p0',{actor:'p0',action:d.action},{},{coordinatorId:'p0'});assert.ok(module.view(after,'p0').choices.some(a=>a.type==='BUILD_CITY'));assert.deepEqual(v,before);
});
test('harmful equal-count, unavailable and stale offers do not become accepts',()=>{
 const v=module.view(offered(prepared({grain:2,ore:2,wool:3},{wool:1}),{wool:1},{ore:1}),'p0');assert.equal(tradeDecision(v,p).action.type,'TRADE_DECLINE');
 const missing=module.view(offered(prepared()),'p0');missing.state.players.players[0].resources.wool=0;assert.equal(tradeDecision(missing,p).reason,'UNAFFORDABLE_OFFER');
 const stale=module.view(offered(prepared()),'p0');stale.choices=stale.choices.map(c=>({...c,offerId:'obsolete'}));assert.throws(()=>tradeDecision(stale,p),/Stale/);
});
test('a cheaper bank alternative beats a costly player offer',()=>{
 const v=module.view(offered(prepared({brick:4,grain:2,ore:2,wool:5}),{ore:1},{wool:5}),'p0'),d=tradeDecision(v,p);assert.equal(d.action.type,'TRADE_DECLINE');assert.equal(d.reason,'BANK_ALTERNATIVE_BETTER');
});
test('public near-winner risk is penalized, but our own immediate winning build dominates',()=>{
 const v=module.view(offered(prepared()),'p0');v.state.players.players.find(q=>q.id==='p1').victoryPoints=9;assert.equal(tradeDecision(v,{...p,leaderPenalty:2}).action.type,'TRADE_DECLINE');v.state.game.settings.victoryPoints=score(v.state,'p0',true)+1;assert.equal(tradeDecision(v,{...p,leaderPenalty:2}).reason,'TRADE_ENABLES_WIN');
});
test('proposals are bounded, use All when appropriate and pass ordinary engine validation',()=>{
 const state=prepared(),v=module.view(state,'p0'),d=proposal(v,{...p,minOwnUtilityGain:0.001,proposalDiscount:1,publicSupplyWeight:0},0);assert.ok(d);assert.equal(d.action.type,'TRADE_OFFER');assert.equal(d.action.to,'all');const after=module.apply(state,'p0',{actor:'p0',action:d.action},{},{coordinatorId:'p0'});assert.ok(after.snapshot.offer);
 const capped=structuredClone(v);capped.history.push({revision:capped.revision+1,playerId:'p0',message:'trade offer'});assert.equal(proposal(capped,p,0),null);
 const unknown=structuredClone(v);unknown.history=[];assert.equal(offerWindow(unknown).known,false);assert.equal(proposal(unknown,p,0),null);
 assert.equal(proposal(v,{...p,offersPerOwnTurn:0},0),null);
});
test('refusals suppress repeated terms, including when history cannot prove cooldown expiry',()=>{
 const v=module.view(prepared(),'p0'),q={...p,minOwnUtilityGain:0.001,proposalDiscount:1,publicSupplyWeight:0},first=proposal(v,q,0);assert.ok(first);
 const key=first.action;v.trades=[{id:'old',from:'p0',to:'all',recipients:['p1','p2'],give:key.give,receive:key.receive,responses:{p1:'declined',p2:'declined'},status:'declined',revision:1}];const next=proposal(v,q,0);assert.ok(!next||JSON.stringify([next.action.give,next.action.receive])!==JSON.stringify([key.give,key.receive]));
 v.history=[{revision:2,playerId:'p0',message:'end turn'},{revision:3,playerId:'p0',message:'end turn'}];const expired=proposal(v,q,0);assert.ok(expired);assert.deepEqual([expired.action.give,expired.action.receive],[key.give,key.receive]);
});
test('observationally identical private-hand redistributions do not affect the policy',()=>{
 const a=prepared({}, {ore:1},{wool:1}),before=module.view(a,'p0'),b=structuredClone(a);b.snapshot.state.players.players[1].resources=bundle({wool:1});b.snapshot.state.players.players[2].resources=bundle({ore:1});const after=module.view(b,'p0');assert.deepEqual(before,after);assert.deepEqual(decide(before,profile,17),decide(after,profile,17));
 const q=template('bad','trade-planner-0.1.0');q.parameters.maxProposalBundles=1.5;assert.throws(()=>validateProfile(q));
});
test('an already legal winning build is selected before speculative negotiation',()=>{
 const v=module.view(prepared({grain:2,ore:3}),'p0');v.state.game.settings.victoryPoints=score(v.state,'p0',true)+1;assert.equal(decision(v,p,17).reason,'IMMEDIATE_WIN');
});

test('recipient selection avoids broadcasting helpful terms to a public near-winner',()=>{
 const v=module.view(prepared(),'p0');v.state.players.players.find(q=>q.id==='p1').victoryPoints=9;
 const d=proposal(v,{...p,minOwnUtilityGain:0.001,proposalDiscount:1,publicSupplyWeight:0,leaderPenalty:2},0);assert.ok(d);assert.equal(d.action.to,'p2');
});

test('small speculative resource gains do not displace a better development investment',()=>{
 const v=module.view(prepared({grain:1,ore:1,wool:1}),'p0'),d=decision(v,{...p,developmentValue:1},17);assert.equal(d.action.type,'BUY_DEVELOPMENT_CARD');
});

test('trade planner completes a real rule-driven match with a strict own-turn offer cap',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),{plan}=await import('../../scripts/bots/experiments.mjs'),baseline=validateProfile(template('baseline','heuristic-1.1.0'));
 const profiles={trade:profile,baseline},manifest={id:'trade-contract',split:'train',gameSeeds:[37],decisionSeed:71,repeats:1,maxActions:2500,rosters:[{id:'three',profiles:['trade','baseline','baseline']}]},job=plan(manifest,profiles)[0];
 const r=runMatch({job,profiles:job.profiles.map(id=>profiles[id]),maxActions:2500,decisionSeed:71});assert.equal(r.status,'ended',r.reason);let offers=0;for(const step of r.trace){if(step.action.type==='END_TURN')offers=0;if(step.actor==='p0'&&step.action.type==='TRADE_OFFER'){offers++;assert.ok(offers<=p.offersPerOwnTurn);}}
});
