import test from 'node:test';
import assert from 'node:assert/strict';
import {acquisitionRolls,production,preview,decision,buildPlans} from '../../scripts/bots/planner-policy.mjs';
import {template,validateProfile,decide} from '../../scripts/bots/profiles.mjs';
import {scenario} from '../fixtures/motion-scenarios.js';
import {score} from '../../play/catan/rules/scoring.js';
const profile=validateProfile(template('planner','planner-0.1.0')),p=profile.parameters;
function economy(number=6){const vertex={hex:{q:0,r:0},direction:'N'};return {game:{bank:{brick:19,lumber:19,grain:19,ore:19,wool:19}},board:{tiles:[{coord:{q:0,r:0},terrain:'forest',number}],robberLocation:{q:9,r:9},buildings:[{playerId:'p0',vertex,type:'settlement'}],ports:[]},players:{players:[{id:'p0',resources:{brick:0,lumber:0,grain:0,ore:0,wool:0}}]}};}
test('acquisition estimates distinguish production speed and respect ports and finite bank',()=>{
 assert.equal(acquisitionRolls(economy(6),'p0',{lumber:1},24),8);assert.equal(acquisitionRolls(economy(2),'p0',{lumber:1},24),Infinity);
 const s=economy();s.board.tiles=[];s.players.players[0].resources.lumber=2;
 assert.equal(acquisitionRolls(s,'p0',{grain:1},24),Infinity);s.board.ports=[{type:'lumber',vertices:[s.board.buildings[0].vertex]}];assert.equal(acquisitionRolls(s,'p0',{grain:1},24),0);
 s.game.bank.grain=0;assert.equal(acquisitionRolls(s,'p0',{grain:1},24),Infinity);
 const city=economy();city.board.buildings[0].type='city';assert.equal(production(city,'p0').lumber,2*production(economy(),'p0').lumber);
});
test('planner profiles are complete, bounded, distinct and reject fractional work limits',()=>{
 assert.equal(profile.policyVersion,'planner-0.1.0');for(const change of [q=>q.parameters.maxPlans=4.5,q=>q.parameters.horizonRolls=99,q=>delete q.parameters.readinessWeight,q=>q.parameters.secret=1]){const q=template('bad','planner-0.1.0');change(q);assert.throws(()=>validateProfile(q));}
});
test('deterministic rule previews do not mutate the observation or allow hidden transitions',()=>{
 const v=scenario('city').before.view,before=structuredClone(v),action=v.choices.find(c=>c.type==='BUILD_CITY');const next=preview(v.state,v.you,action);assert.equal(score(next,v.you,true),score(v.state,v.you,true)+1);assert.deepEqual(v,before);assert.throws(()=>preview(v.state,v.you,{type:'BUY_DEVELOPMENT_CARD'}),/Unsupported/);
 const plans=buildPlans(v.state,v.you,p);assert.ok(plans.some(g=>g.type==='city'&&g.vertex));assert.ok(plans.length<=p.maxPlans);
});
test('a direct legal winning build overrides arbitrary utility weights and leaves input intact',()=>{
 const v=scenario('city').before.view;v.state.game.settings.victoryPoints=score(v.state,v.you,true)+1;const before=structuredClone(v),d=decision(v,{...p,productionWeight:0,handReserveWeight:2,developmentValue:1},17);assert.equal(d.reason,'IMMEDIATE_WIN');assert.ok(score(preview(v.state,v.you,d.action),v.you,true)>=v.state.game.settings.victoryPoints);assert.deepEqual(v,before);
});
test('planner values a useful bank conversion and can wait rather than spend on a road',()=>{
 const v=scenario('city').before.view,me=v.state.players.players.find(x=>x.id===v.you);me.resources={brick:4,lumber:1,grain:2,ore:2,wool:0};
 const end={type:'END_TURN'},trade={type:'BANK_TRADE',give:{resource:'brick',amount:4},receive:{resource:'ore',amount:1}};
 // Prepared candidate subsets isolate acquisition and opportunity cost; production
 // rules validate previews, while natural matches exercise full choice generation.
 v.choices=[end,trade];const weights={...p,maxRoadCandidates:0,expansionWeight:0};assert.equal(decision(v,weights,1).action.type,'BANK_TRADE');
 const full=scenario('road').before.view,road=full.choices.find(c=>c.type==='BUILD_ROAD');v.choices=[end,road];assert.equal(decision(v,weights,1).action.type,'END_TURN');
});
test('policy is seeded, observation-only and bounded outside economic main turns',()=>{
 const v=scenario('city').before.view;assert.deepEqual(decide(v,profile,41),decide(v,profile,41));
 const r=scenario('robber').before.view;assert.equal(decision(r,p,41).reason,'BASELINE_PHASE');assert.ok(r.choices.some(c=>JSON.stringify(c)===JSON.stringify(decide(r,profile,41))));
});

test('redistributing indistinguishable hidden opponent hands cannot affect a decision',async()=>{
 const {createCatanModule,catanConfig}=await import('../../play/catan/module.js'),{CATAN_ARTIFACT}=await import('../../play/catan/artifact.js'),{botDecision}=await import('../../play/catan/rules/bot.js');
 const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),humans=[0,1,2].map(i=>({id:'p'+i,name:'Seat '+i}));let state=module.initialize(catanConfig(humans,{playerCount:3,seed:37}),{gameId:'planner-privacy'});
 while(state.snapshot.state.game.phase.startsWith('setup')){const actor=state.snapshot.state.game.currentPlayerId;state=module.apply(state,actor,{actor,action:botDecision(module.view(state,actor),'standard')},{},{coordinatorId:'p0'});}
 Object.assign(state.snapshot.state.game,{phase:'main',currentPlayerId:'p0'});
 const ps=state.snapshot.state.players.players;
 for(const r of ['brick','lumber','grain','wool','ore']){state.snapshot.state.game.bank[r]+=ps[1].resources[r]+ps[2].resources[r];ps[1].resources[r]=0;ps[2].resources[r]=0;}
 ps[1].resources.brick=1;ps[2].resources.ore=1;state.snapshot.state.game.bank.brick--;state.snapshot.state.game.bank.ore--;
 const a=module.view(state,'p0');ps[1].resources.brick=0;ps[1].resources.ore=1;ps[2].resources.ore=0;ps[2].resources.brick=1;const b=module.view(state,'p0');assert.deepEqual(a,b);assert.deepEqual(decide(a,profile,17),decide(b,profile,17));
});

test('planner completes an ordinary projected-input game through authoritative commands',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),{plan}=await import('../../scripts/bots/experiments.mjs');const baseline=validateProfile(template('baseline','heuristic-1.1.0'));
 const manifest={id:'planner-contract',split:'train',gameSeeds:[37],decisionSeed:71,repeats:1,maxActions:2500,rosters:[{id:'three',profiles:['planner','baseline','baseline']}]},profiles={planner:profile,baseline},job=plan(manifest,profiles)[0];
 const r=runMatch({job,profiles:job.profiles.map(id=>profiles[id]),maxActions:manifest.maxActions,decisionSeed:manifest.decisionSeed});assert.equal(r.status,'ended',r.reason);assert.ok(r.steps>12);assert.notEqual(r.winnerSeat,null);
});
