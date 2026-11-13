import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {template,validateProfile,decideWithMemory} from '../../scripts/bots/profiles.mjs';
import {decision as old} from '../../scripts/bots/build-trade-components.mjs';
import {decision,rankRobber,chooseVictim} from '../../scripts/bots/robber-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('robber','robber-knight-0.1.0')),p=profile.parameters;
const view=s=>module.view(s,'p0'),apply=(s,id,a)=>module.apply(s,id,{actor:id,action:a},{},{coordinatorId:'p0'}),same=(a,b)=>a.q===b.q&&a.r===b.r;
function prepared(hand={}){let s=module.initialize(catanConfig([0,1,2].map(i=>({id:'p'+i,name:'Seat '+(i+1)})),{seed:37}),{gameId:'robber-probe'});for(let i=0;i<12;i++){const actor=s.snapshot.state.game.currentPlayerId;s=apply(s,actor,botDecision(module.view(s,actor),'standard'));}for(const [i,h]of [hand,{},{}].entries())for(const r of RESOURCES){const q=s.snapshot.state.players.players[i];s.snapshot.state.game.bank[r]+=q.resources[r]-(h[r]||0);q.resources[r]=h[r]||0;}Object.assign(s.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10,lastRoll:{die1:3,die2:3,total:6}});return s;}
function held(s,id,resources){const q=s.snapshot.state.players.players.find(p=>p.id===id);for(const r of RESOURCES){s.snapshot.state.game.bank[r]+=q.resources[r]-(resources[r]||0);q.resources[r]=resources[r]||0;}}
function knight(s,type='knight'){const i=s.snapshot.deck.indexOf(type);assert.ok(i>=0);s.snapshot.deck.splice(i,1);s.snapshot.state.game.developmentDeckCount--;s.snapshot.state.players.players[0].developmentCards.push({id:'known-'+type,type,isPlayed:false,turnBought:0});return s;}
function bare(s){s.snapshot.state.board.buildings=[];s.snapshot.state.board.roads=[];return s;}
function vertex(tile,exclude=[]){const forbidden=new Set(exclude.flatMap(t=>getHexVertices(t.coord).map(vertexKey)));return getHexVertices(tile.coord).find(v=>!forbidden.has(vertexKey(v)));}
const tile=(s,n)=>s.snapshot.state.board.tiles.filter(t=>t.number===n),place=(id,type,v)=>({playerId:id,type,vertex:v});
test('cities deny exactly twice the production of settlements on equal-number tiles',()=>{
 const s=bare(prepared()),[a,b]=tile(s,10);s.snapshot.state.board.buildings=[place('p1','city',vertex(a,[b])),place('p1','settlement',vertex(b,[a]))];s.snapshot.state.game.phase='robber-move';const v=view(s),before=structuredClone(v),q={...p,robberStealValue:0},ranked=rankRobber(v,q);const x=ranked.find(o=>same(o.hex,a.coord)),y=ranked.find(o=>same(o.hex,b.coord));assert.ok(Math.abs(x.opponentDenial-2*y.opponentDenial)<1e-12);assert.deepEqual(v,before);apply(s,'p0',decision(v,q,37).action);
});
test('own production is protected and a blocked own city gives Knight release value',()=>{
 const s=bare(knight(prepared())),[a,b]=tile(s,10);s.snapshot.state.board.buildings=[place('p0','city',vertex(a,[b])),place('p1','settlement',vertex(b,[a]))];s.snapshot.state.game.phase='robber-move';let v=view(s),ranked=rankRobber(v,p);assert.ok(ranked.find(o=>same(o.hex,a.coord)).ownRelease<0);assert.ok(!same(decision(v,p,37).action.hex,a.coord));
 s.snapshot.state.board.robberLocation=a.coord;s.snapshot.state.game.phase='roll';s.snapshot.state.game.lastRoll=null;v=view(s);const d=decision(v,p,37);assert.equal(d.action.type,'PLAY_KNIGHT');assert.equal(d.reason,'KNIGHT_STRATEGIC_GAIN');assert.ok(d.diagnostics.knight.robber.ownRelease>0);
 let next=apply(s,'p0',d.action),m=d.memory,move=decision(view(next),p,37,m);assert.deepEqual(move.action.hex,d.diagnostics.knight.robber.hex);next=apply(next,'p0',move.action);if(next.snapshot.state.game.phase==='robber-steal')next=apply(next,'p0',decision(view(next),p,37,m).action);assert.equal(next.snapshot.state.game.phase,'roll');assert.equal(next.snapshot.state.players.players[0].armySize,1);
});
test('victim choice favors public threat, not a larger unknown hand',()=>{
 const s=bare(prepared()),a=tile(s,6)[0],vs=getHexVertices(a.coord);s.snapshot.state.board.buildings=[place('p1','settlement',vs[0]),place('p2','settlement',vs[3])];held(s,'p1',{ore:1});held(s,'p2',{wool:5});s.snapshot.state.board.robberLocation=a.coord;s.snapshot.state.game.phase='robber-steal';const v=view(s);v.state.players.players[1].victoryPoints=8;v.state.players.players[2].victoryPoints=3;const d=decision(v,p,37);assert.equal(d.action.victimId,'p1');apply(s,'p0',d.action);assert.equal(chooseVictim(v,['p1','p2'],{...p,robberThreatWeight:0}),'p1');
});
test('an unhelpful Knight is retained without spending it or changing the real observation',()=>{
 const s=bare(knight(prepared()));s.snapshot.state.game.phase='roll';s.snapshot.state.game.lastRoll=null;const v=view(s),before=structuredClone(v),d=decision(v,p,37);assert.equal(old(v,p,37).action.type,'PLAY_KNIGHT');assert.equal(d.reason,'HOLD_KNIGHT');assert.equal(d.action.type,'ROLL_DICE');assert.deepEqual(v,before);const after=apply(s,'p0',d.action);assert.equal(after.snapshot.state.players.players[0].developmentCards[0].isPlayed,false);assert.equal(after.snapshot.state.players.players[0].armySize,0);
});
test('Largest Army acquisition, ties and immediate winning Knight use ordinary scores',()=>{
 for(const [army,holder,award]of [[2,null,2],[2,{playerId:'p1',value:3},0],[3,{playerId:'p1',value:3},2]]){const s=bare(knight(prepared()));s.snapshot.state.players.players[0].armySize=army;s.snapshot.state.players.players[1].armySize=holder?.value||0;s.snapshot.state.game.largestArmy=holder;const d=decision(view(s),{...p,knightHoldValue:0,knightMinGain:0},37);assert.equal(d.action.type,'PLAY_KNIGHT');assert.equal(d.diagnostics.knight.award,award);const after=apply(s,'p0',d.action);assert.equal(after.snapshot.state.game.largestArmy?.playerId,award?'p0':holder?.playerId);}
 const s=knight(prepared());s.snapshot.state.players.players[0].armySize=2;s.snapshot.state.game.settings.victoryPoints=4;const d=decision(view(s),{...p,knightHoldValue:1,knightMinGain:.5},37);assert.equal(d.reason,'IMMEDIATE_WIN');assert.equal(apply(s,'p0',d.action).snapshot.state.game.phase,'ended');
});
test('a winning construction still takes priority over robber/Knight changes',()=>{
 const s=knight(prepared({ore:3,grain:2}));s.snapshot.state.game.settings.victoryPoints=3;const d=decision(view(s),p,37);assert.equal(d.action.type,'BUILD_CITY');assert.equal(d.reason,'IMMEDIATE_WIN');assert.equal(apply(s,'p0',d.action).snapshot.state.game.phase,'ended');
});
test('all-zero flags reproduce old decisions and keep purchases/build/trade behavior intact',()=>{
 const s=prepared({ore:2,grain:2,wool:3}),v=view(s);assert.deepEqual(decision(v,{...p,enableRobberValuation:0,enableKnightTiming:0},37),old(v,p,37));assert.deepEqual(decision(v,p,37),old(v,p,37));
 const k=bare(knight(prepared()));k.snapshot.state.game.phase='roll';k.snapshot.state.game.lastRoll=null;const w=view(k);assert.deepEqual(decision(w,{...p,enableRobberValuation:0,enableKnightTiming:0},37),old(w,p,37));
});
test('hidden-hand/card permutations and scoped memory cannot reveal private opponents',()=>{
 const a=knight(prepared());for(const [i,type]of [[1,'knight'],[2,'victoryPoint']]){const n=a.snapshot.deck.indexOf(type);a.snapshot.deck.splice(n,1);a.snapshot.state.game.developmentDeckCount--;a.snapshot.state.players.players[i].developmentCards=[{id:'hidden-'+i,type,isPlayed:false,turnBought:0}];}const b=structuredClone(a);b.snapshot.state.players.players[1].developmentCards[0].type='victoryPoint';b.snapshot.state.players.players[2].developmentCards[0].type='knight';held(a,'p1',{ore:2,wool:1});held(a,'p2',{ore:1,wool:2});held(b,'p1',{ore:1,wool:2});held(b,'p2',{ore:2,wool:1});assert.deepEqual(view(a),view(b));assert.deepEqual(decideWithMemory(view(a),profile,37),decideWithMemory(view(b),profile,37));const d=decideWithMemory(view(a),profile,37),m=JSON.parse(JSON.stringify(d.memory));assert.deepEqual(decideWithMemory(view(a),profile,37,m).action,d.action);m.actor='p2';assert.throws(()=>decideWithMemory(view(a),profile,37,m));
 const bad=template('bad','robber-knight-0.1.0');bad.parameters.robberExpectedRolls=13;assert.throws(()=>validateProfile(bad));
});
test('natural games are deterministic and all-zero gates match the shipped policy',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),base=validateProfile(template('baseline','heuristic-1.1.0')),off=structuredClone(profile);off.parameters.enableRobberValuation=off.parameters.enableKnightTiming=0;const prior=validateProfile(template('robber','build-trade-0.2.0')),job={id:'robber-natural',caseId:'robber-natural',gameSeed:37,rotation:0,repeat:0,roster:'three',profiles:['robber','baseline','baseline']},run=focal=>runMatch({job,profiles:[focal,base,base],maxActions:2500,decisionSeed:92831});const a=run(profile),b=run(profile),c=run(validateProfile(off)),d=run(prior);for(const r of [a,b,c,d])assert.equal(r.status,'ended',r.reason);for(const k of ['traceHash','planTraceHash','finalStateHash','winnerSeat']){assert.equal(a[k],b[k]);assert.equal(c[k],d[k]);}
});

test('active city resource needs increase protection of ore relative to equal-rate brick',()=>{
 const s=bare(prepared()),[a,b]=tile(s,10),va=vertex(a,[b]),vb=vertex(b,[a]);s.snapshot.state.board.buildings=[place('p0','settlement',va),place('p0','settlement',vb)];s.snapshot.state.game.phase='robber-move';const v=view(s),m={schemaVersion:1,goalKey:'city|'+vertexKey(va)},q={...p,switchMargin:2,robberStealValue:0},ranked=rankRobber(v,q,m),ore=ranked.find(o=>same(o.hex,a.coord)),brick=ranked.find(o=>same(o.hex,b.coord));assert.ok(ore.ownRelease<brick.ownRelease);const neutral=rankRobber(v,{...q,robberPlanResourceWeight:0},m);assert.ok(Math.abs(neutral.find(o=>same(o.hex,a.coord)).ownRelease-neutral.find(o=>same(o.hex,b.coord)).ownRelease)<1e-12);assert.deepEqual(decision(v,q,37,m).memory,m);
});
test('friendly-robber protections and empty victims stay authoritative',()=>{
 const s=bare(prepared()),a=tile(s,6)[0],vs=getHexVertices(a.coord);s.snapshot.state.board.buildings=[place('p1','settlement',vs[0]),place('p2','settlement',vs[3])];s.snapshot.state.game.phase='robber-move';s.snapshot.state.game.settings.friendlyRobber=true;const v=view(s);assert.ok(!rankRobber(v,p).some(o=>same(o.hex,a.coord)));apply(s,'p0',decision(v,p,37).action);
 s.snapshot.state.game.settings.friendlyRobber=false;s.snapshot.state.board.robberLocation=a.coord;s.snapshot.state.game.phase='robber-steal';held(s,'p2',{wool:1});const w=view(s);w.state.players.players[1].victoryPoints=9;const d=decision(w,p,37);assert.equal(d.action.victimId,'p2');apply(s,'p0',d.action);
});
test('a useful competing resource card can justify retaining Knight before rolling',()=>{
 const s=bare(knight(prepared({ore:1})));s.snapshot.state.game.phase='roll';s.snapshot.state.game.lastRoll=null;const q={...p,knightHoldValue:0,knightMinGain:0};assert.equal(decision(view(s),q,37).action.type,'PLAY_KNIGHT');knight(s,'yearOfPlenty');const d=decision(view(s),q,37);assert.equal(d.reason,'HOLD_KNIGHT');assert.equal(d.action.type,'ROLL_DICE');assert.ok(d.diagnostics.knight.otherCardGain>0);
});
test('timing-only mode predicts the legacy destination and victim and returns to main',()=>{
 let s=bare(knight(prepared())),a=tile(s,6)[0],vs=getHexVertices(a.coord);s.snapshot.state.board.buildings=[place('p1','settlement',vs[0]),place('p2','settlement',vs[3])];held(s,'p1',{ore:1});held(s,'p2',{wool:5});s.snapshot.state.players.players[0].armySize=2;const q={...p,enableRobberValuation:0,knightHoldValue:0,knightMinGain:0},d=decision(view(s),q,37);assert.equal(d.action.type,'PLAY_KNIGHT');s=apply(s,'p0',d.action);const move=decision(view(s),q,37,d.memory);assert.deepEqual(move.action.hex,d.diagnostics.knight.robber.hex);s=apply(s,'p0',move.action);assert.equal(s.snapshot.state.game.phase,'robber-steal');const steal=decision(view(s),q,37,d.memory);assert.equal(steal.action.victimId,d.diagnostics.knight.robber.victim);assert.equal(steal.action.victimId,'p2');s=apply(s,'p0',steal.action);assert.equal(s.snapshot.state.game.phase,'main');
});
