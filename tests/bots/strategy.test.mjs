import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {template,validateProfile,decideWithMemory,freeze} from '../../scripts/bots/profiles.mjs';
import {generateGoals,handValue} from '../../scripts/bots/shared-plan-policy.mjs';
import {stage,afterGoal,raceValue,handEconomy,economicGain} from '../../scripts/bots/strategy-model.mjs';
import {vertexKey} from '../../play/catan/rules/geometry.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('strategy-test','strategic-planner-0.1.0')),p=profile.parameters;
const previous=validateProfile(JSON.parse(await readFile(new URL('../../experiments/bots/purchase-on.json',import.meta.url),'utf8')));
function preparedState(){let s=module.initialize(catanConfig([0,1,2].map(i=>({id:'p'+i,name:'Seat '+i})),{seed:37}),{gameId:'strategy-test'});while(s.snapshot.state.game.phase.startsWith('setup')){const actor=s.snapshot.state.game.currentPlayerId;s=module.apply(s,actor,{actor,action:botDecision(module.view(s,actor),'standard')},{},{coordinatorId:'p0'});}Object.assign(s.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:12});for(const r of RESOURCES){const me=s.snapshot.state.players.players[0];s.snapshot.state.game.bank[r]+=me.resources[r]-2;me.resources[r]=2;}return s;}
const prepared=()=>module.view(preparedState(),'p0');
test('bounded two-build goals have real topology, deterministic successors and do not mutate observations',()=>{
 const view=freeze(prepared()),before=JSON.stringify(view),a=generateGoals(view,p),b=generateGoals(view,p);assert.deepEqual(a,b);assert.ok(a.goals.some(g=>g.followUp?.bonus>0));assert.ok(a.goals.filter(g=>g.followUp).length<=p.maxLookaheadGoals);
 for(const goal of a.goals.filter(g=>g.followUp)){const next=afterGoal(view.state,view.you,goal);assert.ok(next.board.buildings.some(b=>vertexKey(b.vertex)===vertexKey(goal.vertex)&&b.playerId===view.you));assert.ok(next.players.players[0].roadsRemaining>=0);}
 assert.equal(JSON.stringify(view),before);
});
test('public site reach penalizes a slower road plan and rewards a near contested site',()=>{
 const goal={kind:'settlement',vertex:{hex:{q:0,r:0},direction:'N'},route:[1,2]},key=vertexKey(goal.vertex),peer=n=>[{paths:new Map([[key,Array(n).fill({})]])}];
 assert.ok(raceValue(goal,peer(0),p).gain<0);assert.ok(raceValue({...goal,route:[]},peer(1),p).gain>0);assert.equal(raceValue(goal,peer(0),{...p,enableSiteCompetition:0}).gain,0);
});
test('resource economics values useful diversity and discounts excess stock independently of trade sender',()=>{
 const v=prepared(),g=generateGoals(v,p).goals.find(g=>g.kind==='city');assert.ok(economicGain(v.state,v.you,g,p)>0);
 const s=structuredClone(v.state),me=s.players.players[0];me.resources.lumber=12;const rich=handEconomy(s,v.you,g,p);me.resources.lumber=4;assert.ok(rich<handEconomy(s,v.you,g,p));
 const before=handValue(v.state,v.you,g,p);me.resources={...v.state.players.players[0].resources};const missing=RESOURCES.find(r=>me.resources[r]<g.cost[r]);assert.ok(missing);me.resources[missing]++;assert.ok(handValue(s,v.you,g,p)>before);
});
test('strategy transitions depend on score progress, including own private VP, not turn number',()=>{
 const v=prepared(),s=structuredClone(v.state);assert.equal(stage(s,v.you,p),'expansion');s.game.turn=200;assert.equal(stage(s,v.you,p),'expansion');
 s.players.players[0].developmentCards=Array.from({length:6},(_,i)=>({id:'vp'+i,type:'victoryPoint',isPlayed:false,turnBought:0}));assert.equal(stage(s,v.you,p),'finish');assert.equal(stage(s,v.you,{...p,enableStageStrategy:0}),'production');
});
test('all four gates off reproduce the frozen purchase policy action and goal',()=>{
 const off=template('strategy-off','strategic-planner-0.1.0');for(const k of ['enableBuildLookahead','enableSiteCompetition','enableResourceEconomy','enableStageStrategy'])off.parameters[k]=0;
 const v=prepared(),a=decideWithMemory(v,validateProfile(off),1),b=decideWithMemory(v,previous,1);assert.deepEqual(a.action,b.action);assert.equal(a.memory.data.goalKey,b.memory.data.goalKey);assert.deepEqual(a.diagnostics,b.diagnostics);
});
test('profile bounds reject excessive search work and nonfinite weights',()=>{
 const bad=template('bad','strategic-planner-0.1.0');bad.parameters.maxLookaheadGoals=99;assert.throws(()=>validateProfile(bad));bad.parameters.maxLookaheadGoals=3;bad.parameters.raceRiskWeight=Infinity;assert.throws(()=>validateProfile(bad));
});
test('strategic decisions are repeatable, engine accepted and keep scoped plan memory',()=>{
 const state=preparedState(),v=module.view(state,'p0'),a=decideWithMemory(v,profile,1),b=decideWithMemory(v,profile,99);assert.deepEqual(a,b);assert.equal(a.memory.policyVersion,profile.policyVersion);assert.ok(a.action.type);module.apply(state,'p0',{actor:'p0',action:a.action},{},{coordinatorId:'p0'});assert.equal(JSON.stringify(a).includes('opponentResources'),false);
});

test('planning ignores private opponent hand contents and reacts to an occupied target',()=>{
 const v=prepared(),a=generateGoals(v,p),changed=structuredClone(v);
 for(const peer of changed.state.players.players.filter(q=>q.id!==v.you)){peer.resources={brick:99,lumber:99,grain:99,wool:99,ore:99};peer.developmentCards=[{type:'victoryPoint'}];}
 assert.deepEqual(generateGoals(changed,p),a);
 const target=a.goals.find(g=>g.kind==='settlement');assert.ok(target);
 const blocked=structuredClone(v);blocked.state.board.buildings.push({playerId:'p1',type:'settlement',vertex:target.vertex});
 assert.ok(!generateGoals(blocked,p).goals.some(g=>g.key===target.key));
});

test('finishing reduces production premium and increases completion urgency',()=>{
 const v=prepared(),early=generateGoals(v,p).goals.find(g=>g.kind==='city'),late=structuredClone(v);
 late.state.players.players[0].developmentCards=Array.from({length:6},(_,i)=>({id:'vp'+i,type:'victoryPoint',isPlayed:false,turnBought:0}));
 const finish=generateGoals(late,p).goals.find(g=>g.key===early.key);assert.equal(early.stage,'expansion');assert.equal(finish.stage,'finish');assert.ok(finish.gain<early.gain);
});
