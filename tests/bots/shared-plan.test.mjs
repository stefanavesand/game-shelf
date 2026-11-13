import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {validRoads,validSettlements} from '../../play/catan/rules/board.js';
import {edgeKey,vertexKey} from '../../play/catan/rules/geometry.js';
import {template,validateProfile,decideWithMemory} from '../../scripts/bots/profiles.mjs';
import {generateGoals,selectGoal,decision} from '../../scripts/bots/shared-plan-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('shared','shared-plan-0.1.0')),p=profile.parameters;
function held(state,hand){const player=state.snapshot.state.players.players[0];for(const r of RESOURCES){state.snapshot.state.game.bank[r]+=player.resources[r]-(hand[r]||0);player.resources[r]=hand[r]||0;}return state;}
function prepared(hand={}){
 let state=module.initialize(catanConfig(['p0','p1','p2'].map(id=>({id,name:id})),{seed:37}),{gameId:'shared-probe'});
 for(let i=0;i<12;i++){const actor=state.snapshot.state.game.currentPlayerId;state=module.apply(state,actor,{actor,action:botDecision(module.view(state,actor),'standard')},{},{coordinatorId:'p0'});}
 for(const peer of state.snapshot.state.players.players.slice(1))for(const r of RESOURCES){state.snapshot.state.game.bank[r]+=peer.resources[r];peer.resources[r]=0;}
 Object.assign(state.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10,lastRoll:{die1:3,die2:3,total:6}});return held(state,hand);
}
function card(state,type){const index=state.snapshot.deck.indexOf(type);assert.ok(index>=0);state.snapshot.deck.splice(index,1);state.snapshot.state.game.developmentDeckCount--;state.snapshot.state.players.players[0].developmentCards.push({id:'card-'+type,type,isPlayed:false,turnBought:0});return state;}
const view=state=>module.view(state,'p0'),commit=(state,action)=>module.apply(state,'p0',{actor:'p0',action},{},{coordinatorId:'p0'});
const remember=key=>({schemaVersion:1,goalKey:key});
function routeGoal(state){return generateGoals(view(state),p).goals.find(g=>g.kind==='settlement'&&g.route.length===2);}
test('shortest site routes are legal, bounded and account for all remaining roads',()=>{
 const state=prepared(),v=view(state),before=structuredClone(v),generated=generateGoals(v,p);assert.ok(generated.graph.expanded<=p.maxGraphNodes);const target=routeGoal(state);assert.ok(target);
 assert.equal(target.cost.brick,3);assert.equal(target.cost.lumber,3);assert.equal(target.cost.grain,1);assert.equal(target.cost.wool,1);
 for(const goal of generated.goals.filter(g=>g.kind==='settlement')){
  const s=structuredClone(v.state);for(const edge of goal.route){assert.ok(validRoads(s,'p0').some(e=>edgeKey(e)===edgeKey(edge)));s.board.roads.push({playerId:'p0',edge});}assert.ok(validSettlements(s,'p0').some(t=>vertexKey(t)===vertexKey(goal.vertex)));
 }
 assert.deepEqual(v,before);assert.ok(generateGoals(v,{...p,maxGraphNodes:8}).graph.expanded<=8);
});
test('one concrete goal drives two roads then its settlement and is marked completed',()=>{
 let state=prepared({brick:4,lumber:4,grain:2,wool:2}),goal=routeGoal(state);assert.ok(goal);const q={...p,switchMargin:2};let memory=remember(goal.key);
 for(const expected of ['BUILD_ROAD','BUILD_ROAD','BUILD_SETTLEMENT']){
  const d=decision(view(state),q,37,memory);assert.equal(d.action.type,expected);assert.equal(d.diagnostics.plan.key,goal.key);if(expected==='BUILD_SETTLEMENT')assert.equal(vertexKey(d.action.vertex),vertexKey(goal.vertex));state=commit(state,d.action);memory=d.memory;
 }
 const next=selectGoal(view(state),q,memory);assert.equal(next.reason,'GOAL_COMPLETED');assert.notEqual(next.goal?.key,goal.key);
});
test('opponent occupation invalidates a site and occupied roads are never planned',()=>{
 const state=prepared(),goal=routeGoal(state);assert.ok(goal);const road=goal.route[0],blocked=structuredClone(state);blocked.snapshot.state.board.roads.push({playerId:'p1',edge:road});
 for(const g of generateGoals(view(blocked),p).goals)assert.ok(!g.route.some(e=>edgeKey(e)===edgeKey(road)));
 state.snapshot.state.board.buildings.push({playerId:'p1',type:'settlement',vertex:goal.vertex});const selected=selectGoal(view(state),p,remember(goal.key));assert.equal(selected.reason,'GOAL_UNAVAILABLE_WITHIN_BOUNDS');assert.notEqual(selected.goal?.key,goal.key);
});
test('a valid goal has configurable inertia but changed cards can justify a new target',()=>{
 const state=prepared(),v=view(state),goals=generateGoals(v,p).goals,old=goals.find(g=>g.value<goals[0].value);assert.ok(old);
 assert.equal(selectGoal(v,{...p,switchMargin:2},remember(old.key)).goal.key,old.key);
 assert.equal(selectGoal(v,{...p,switchMargin:0},remember(old.key)).reason,'BETTER_ALTERNATIVE');
 const cityState=prepared({ore:3,grain:2}),initial=selectGoal(view(cityState),p);assert.equal(initial.goal.kind,'city');held(cityState,{brick:3,lumber:3,grain:1,wool:1});const changed=selectGoal(view(cityState),p,remember(initial.goal.key));assert.equal(changed.reason,'BETTER_ALTERNATIVE');assert.equal(changed.goal.kind,'settlement');
});
test('same-goal discard and Year of Plenty are followed by the actual city build',()=>{
 let state=prepared({ore:3,grain:2,wool:5}),city=generateGoals(view(state),p).goals.find(g=>g.kind==='city'),q={...p,switchMargin:2};Object.assign(state.snapshot.state.game,{phase:'discard',pendingDiscard:['p0'],discardAmounts:{p0:5}});
 const discarded=decision(view(state),q,37,remember(city.key));assert.equal(discarded.diagnostics.plan.key,city.key);state=commit(state,discarded.action);assert.equal(state.snapshot.state.players.players[0].resources.ore,3);assert.equal(state.snapshot.state.players.players[0].resources.grain,2);
 state=card(prepared({ore:2,grain:1}),'yearOfPlenty');city=generateGoals(view(state),p).goals.find(g=>g.kind==='city');const chosen=decision(view(state),q,37,remember(city.key));assert.equal(chosen.action.type,'PLAY_YEAR_OF_PLENTY');assert.deepEqual([...chosen.action.resources].sort(),['grain','ore']);state=commit(state,chosen.action);const build=decision(view(state),q,37,chosen.memory);assert.equal(build.action.type,'BUILD_CITY');assert.equal(vertexKey(build.action.vertex),vertexKey(city.vertex));commit(state,build.action);
});
test('bank/port acquisition serves the same target rather than another heuristic goal',()=>{
 let state=prepared({ore:2,grain:2,lumber:4});const city=generateGoals(view(state),p).goals.find(g=>g.kind==='city'),q={...p,switchMargin:2},d=decision(view(state),q,37,remember(city.key));assert.equal(d.action.type,'BANK_TRADE');assert.equal(d.action.receive.resource,'ore');state=commit(state,d.action);const next=decision(view(state),q,37,d.memory);assert.equal(next.action.type,'BUILD_CITY');assert.equal(next.diagnostics.plan.key,city.key);commit(state,next.action);
});
test('Road Building is an explicit two-road plan recipe with free road follow-through',()=>{
 let state=card(prepared({brick:1,lumber:1,grain:1,wool:1}),'roadBuilding');const goal=routeGoal(state),q={...p,switchMargin:2};assert.ok(goal);assert.equal(goal.usesRoadCard,true);assert.equal(goal.cost.brick,1);assert.equal(goal.cost.lumber,1);let memory=remember(goal.key);
 for(const expected of ['PLAY_ROAD_BUILDING','BUILD_ROAD','BUILD_ROAD','BUILD_SETTLEMENT']){const d=decision(view(state),q,37,memory);assert.equal(d.action.type,expected);state=commit(state,d.action);memory=d.memory;}
 assert.ok(state.snapshot.state.board.buildings.some(b=>b.playerId==='p0'&&vertexKey(b.vertex)===vertexKey(goal.vertex)));
});
test('immediate wins override goal inertia even without resource cards',()=>{
 const state=prepared({ore:3,grain:2}),goal=routeGoal(state);state.snapshot.state.game.settings.victoryPoints=3;const d=decision(view(state),{...p,switchMargin:2},37,remember(goal.key));assert.equal(d.reason,'IMMEDIATE_WIN');assert.equal(commit(state,d.action).snapshot.state.game.phase,'ended');
});
test('serialized plan memory is scoped, frozen and cannot cross game/seat/profile/revision',()=>{
 const state=prepared(),v=view(state),before=structuredClone(v),first=decideWithMemory(v,profile,37);assert.ok(Object.isFrozen(first.memory));assert.deepEqual(v,before);const restored=JSON.parse(JSON.stringify(first.memory));assert.deepEqual(decideWithMemory(v,profile,37,restored).action,first.action);
 for(const mutate of [m=>m.gameId='other',m=>m.actor='p1',m=>m.profileHash='wrong',m=>m.engineVersion='old',m=>m.lastRevision=-1,m=>m.lastRevision=v.revision+1,m=>m.schemaVersion=2,m=>m.data.extra=1]){const m=structuredClone(restored);mutate(m);assert.throws(()=>decideWithMemory(v,profile,37,m));}
 const bad=template('bad','shared-plan-0.1.0');bad.parameters.maxRouteLength=2.5;assert.throws(()=>validateProfile(bad));
});
test('hidden-hand permutations preserve goals and parked player trades stay frozen',()=>{
 const a=prepared(),b=structuredClone(a);for(const state of [a,b]){state.snapshot.state.game.bank.ore-=4;state.snapshot.state.game.bank.wool-=4;}
 Object.assign(a.snapshot.state.players.players[1].resources,{ore:3,wool:1});Object.assign(a.snapshot.state.players.players[2].resources,{ore:1,wool:3});Object.assign(b.snapshot.state.players.players[1].resources,{ore:1,wool:3});Object.assign(b.snapshot.state.players.players[2].resources,{ore:3,wool:1});assert.deepEqual(view(a),view(b));assert.deepEqual(decideWithMemory(view(a),profile,37),decideWithMemory(view(b),profile,37));
 a.snapshot.state.game.currentPlayerId='p1';const offered=module.apply(a,'p1',{actor:'p1',action:{type:'TRADE_OFFER',to:'p0',give:{ore:1},receive:{wool:1}}},{},{coordinatorId:'p0'});assert.deepEqual(decideWithMemory(view(offered),profile,37).action,botDecision(view(offered),'standard'));
});
test('memory-aware full games replay actions, plan changes and final states deterministically',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),base=validateProfile(template('baseline','heuristic-1.1.0')),job={id:'shared-natural',caseId:'shared-natural',gameSeed:37,rotation:0,repeat:0,roster:'three-shared',profiles:['shared','baseline','baseline']},input={job,profiles:[profile,base,base],maxActions:2500,decisionSeed:92831};
 const a=runMatch(input),b=runMatch(input);assert.equal(a.status,'ended',a.reason);assert.ok(a.planTrace.length>1);assert.equal(a.traceHash,b.traceHash);assert.equal(a.planTraceHash,b.planTraceHash);assert.equal(a.finalStateHash,b.finalStateHash);
});
test('a blocked shortest path can reroute while retaining the same concrete target',()=>{
 const state=prepared(),q={...p,maxRouteLength:3,switchMargin:2},v=view(state);let found=null;
 for(const goal of generateGoals(v,q).goals.filter(g=>g.route.length>=1)){
  const blocked=structuredClone(v);blocked.state.board.roads.push({playerId:'p1',edge:goal.route[0]});
  const next=selectGoal(blocked,q,remember(goal.key));if(next.goal?.key===goal.key&&next.goal.route.length&&edgeKey(next.goal.route[0])!==edgeKey(goal.route[0])){found=next;assert.equal(next.reason,'KEEP_GOAL');break;}
 }
 assert.ok(found,'Prepared network must contain an alternate legal route');
});
test('public win-race urgency discounts waiting without reading opponent resource types',()=>{
 const v=view(prepared()),normal=generateGoals(v,p).goals.find(g=>g.kind==='city'&&Number.isFinite(g.eta)&&g.eta>0);assert.ok(normal);const urgent=structuredClone(v);urgent.state.players.players[1].victoryPoints=9;
 const target=generateGoals(urgent,p).goals.find(g=>g.key===normal.key);assert.ok(target.value<normal.value);
 assert.equal(generateGoals(urgent,{...p,urgentEtaWeight:0}).goals.find(g=>g.key===normal.key).value,normal.value);
});
test('an immediately winning Knight overrides an unrelated retained plan',()=>{
 const state=card(prepared(),'knight'),goal=routeGoal(state);state.snapshot.state.players.players[0].armySize=2;state.snapshot.state.game.settings.victoryPoints=4;
 const d=decision(view(state),{...p,switchMargin:2},37,remember(goal.key));assert.equal(d.action.type,'PLAY_KNIGHT');assert.equal(d.reason,'IMMEDIATE_WIN');assert.equal(commit(state,d.action).snapshot.state.game.phase,'ended');
});
