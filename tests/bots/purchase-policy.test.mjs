import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {template,validateProfile,decideWithMemory} from '../../scripts/bots/profiles.mjs';
import {decision as previous} from '../../scripts/bots/robber-policy.mjs';
import {decision,purchaseValue} from '../../scripts/bots/purchase-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('robber','development-investment-0.1.0')),p=profile.parameters;
const view=s=>module.view(s,'p0'),apply=(s,id,a)=>module.apply(s,id,{actor:id,action:a},{},{coordinatorId:'p0'}),same=(a,b)=>a.q===b.q&&a.r===b.r;
function prepared(hand={}){let s=module.initialize(catanConfig([0,1,2].map(i=>({id:'p'+i,name:'Seat '+(i+1)})),{seed:37}),{gameId:'robber-probe'});for(let i=0;i<12;i++){const actor=s.snapshot.state.game.currentPlayerId;s=apply(s,actor,botDecision(module.view(s,actor),'standard'));}for(const [i,h]of [hand,{},{}].entries())for(const r of RESOURCES){const q=s.snapshot.state.players.players[i];s.snapshot.state.game.bank[r]+=q.resources[r]-(h[r]||0);q.resources[r]=h[r]||0;}Object.assign(s.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10,lastRoll:{die1:3,die2:3,total:6}});return s;}
function held(s,id,resources){const q=s.snapshot.state.players.players.find(p=>p.id===id);for(const r of RESOURCES){s.snapshot.state.game.bank[r]+=q.resources[r]-(resources[r]||0);q.resources[r]=resources[r]||0;}}
function knight(s,type='knight'){const i=s.snapshot.deck.indexOf(type);assert.ok(i>=0);s.snapshot.deck.splice(i,1);s.snapshot.state.game.developmentDeckCount--;s.snapshot.state.players.players[0].developmentCards.push({id:'known-'+type,type,isPlayed:false,turnBought:0});return s;}
function bare(s){s.snapshot.state.board.buildings=[];s.snapshot.state.board.roads=[];return s;}
function vertex(tile,exclude=[]){const forbidden=new Set(exclude.flatMap(t=>getHexVertices(t.coord).map(vertexKey)));return getHexVertices(tile.coord).find(v=>!forbidden.has(vertexKey(v)));}
const tile=(s,n)=>s.snapshot.state.board.tiles.filter(t=>t.number===n),place=(id,type,v)=>({playerId:id,type,vertex:v});
test('off delegates exactly, input is immutable and profiles enforce strict bounds',()=>{
 const v=view(prepared({ore:1,grain:1,wool:1})),before=structuredClone(v);
 assert.deepEqual(decision(v,{...p,enablePurchaseValuation:0},37),previous(v,p,37));decision(v,p,37);assert.deepEqual(v,before);
 const bad=template('bad','development-investment-0.1.0');bad.parameters.purchaseQueuePenalty=-1;assert.throws(()=>validateProfile(bad));
});
test('army distance, blocked own production and queued cards affect investment',()=>{
 const s=knight(prepared()),v=view(s),a=purchaseValue(v,p);v.state.players.players[0].armySize=2;assert.ok(purchaseValue(v,p).gain>a.gain);
 v.state.players.players[0].armySize=0;const b=v.state.board.buildings.find(b=>b.playerId==='p0');const tile=v.state.board.tiles.find(t=>t.number&&getHexVertices(t.coord).some(x=>vertexKey(x)===vertexKey(b.vertex)));v.state.board.robberLocation=tile.coord;assert.ok(purchaseValue(v,p).blockedProduction>0);
 const x=purchaseValue(v,p);v.state.players.players[0].developmentCards.push({id:'queued',type:'yearOfPlenty',isPlayed:false,turnBought:10});const y=purchaseValue(v,p);assert.ok(y.gain<x.gain);assert.equal(y.types.victoryPoint.value,x.types.victoryPoint.value);
});
test('exhaustion uses own cards/public army once; no road route has no road benefit',()=>{
 const v=view(bare(prepared()));v.state.players.players[0].roadsRemaining=0;let a=purchaseValue(v,p);assert.equal(a.types.roadBuilding.value,0);
 v.state.players.players[0].armySize=10;v.state.players.players[1].armySize=3;v.state.players.players[0].developmentCards=[{id:'played',type:'knight',isPlayed:true,turnBought:0}];a=purchaseValue(v,p);assert.equal(a.types.knight.known,13);assert.ok(a.types.knight.probability>0);
 v.state.players.players[0].developmentCards.push({id:'held',type:'knight',isPlayed:false,turnBought:0});a=purchaseValue(v,p);assert.equal(a.types.knight.probability,0);
 v.state.players.players[0].developmentCards.push(...Array.from({length:2},(_,i)=>({id:'road'+i,type:'roadBuilding',isPlayed:!!i,turnBought:0})));assert.equal(purchaseValue(v,p).types.roadBuilding.probability,0);
});
test('empty deck excludes investment and hand size alone never forces a purchase',()=>{
 const s=prepared({ore:1,grain:1,wool:1,brick:5});s.snapshot.state.game.developmentDeckCount=0;assert.equal(purchaseValue(view(s),p).gain,0);assert.notEqual(decision(view(s),p,37).action.type,'BUY_DEVELOPMENT_CARD');
 const zero={...p,purchaseVpValue:0,purchaseKnightValue:0,purchaseArmyWeight:0,purchaseRoadValue:0,purchaseResourceValue:0};assert.notEqual(decision(view(prepared({ore:1,grain:1,wool:1,brick:5})),zero,37).action.type,'BUY_DEVELOPMENT_CARD');
});
test('affordable investment buys via reducer, new action cards wait and VP scores automatically',()=>{
 for(const type of ['knight','victoryPoint']){const s=prepared({ore:1,grain:1,wool:1});const v=view(s);v.state.board.buildings=[];v.state.board.roads=[];s.snapshot.state.board=structuredClone(v.state.board);
 const i=s.snapshot.deck.indexOf(type);[s.snapshot.deck[0],s.snapshot.deck[i]]=[s.snapshot.deck[i],s.snapshot.deck[0]];
 const d=decision(view(s),p,37);assert.equal(d.action.type,'BUY_DEVELOPMENT_CARD');const before=module.view(s,'p0').state.players.players[0].victoryPoints,next=apply(s,'p0',d.action),q=next.snapshot.state.players.players[0];assert.equal(q.developmentCards.at(-1).type,type);assert.equal(q.resources.ore,0);
 if(type==='knight')assert.ok(!module.view(next,'p0').choices.some(a=>a.type==='PLAY_KNIGHT'));else assert.equal(module.view(next,'p0').state.players.players[0].victoryPoints,before+1);
 }
});
test('winning city takes precedence and remembered construction goal resists marginal switches',()=>{
 const s=prepared({ore:3,grain:2,wool:1});s.snapshot.state.game.settings.victoryPoints=3;assert.equal(decision(view(s),p,37).action.type,'BUILD_CITY');
 const v=view(prepared({ore:3,grain:2,wool:1})),b=v.state.board.buildings.find(b=>b.playerId==='p0'),m={schemaVersion:1,goalKey:'city|'+vertexKey(b.vertex)},d=decision(v,p,37,m);assert.equal(d.action.type,'BUILD_CITY');assert.equal(d.memory.goalKey,m.goalKey);
});
test('hidden deck order and opponent card types cannot change purchase decisions',()=>{
 const a=prepared({ore:1,grain:1,wool:1});for(const [i,type]of [[1,'knight'],[2,'victoryPoint']]){const j=a.snapshot.deck.indexOf(type);a.snapshot.deck.splice(j,1);a.snapshot.state.game.developmentDeckCount--;a.snapshot.state.players.players[i].developmentCards=[{id:'secret'+i,type,isPlayed:false,turnBought:0}];}
 const b=structuredClone(a);b.snapshot.deck.reverse();b.snapshot.state.players.players[1].developmentCards[0].type='victoryPoint';b.snapshot.state.players.players[2].developmentCards[0].type='knight';assert.deepEqual(view(a),view(b));assert.deepEqual(decideWithMemory(view(a),profile,37),decideWithMemory(view(b),profile,37));
 const d=decideWithMemory(view(a),profile,37);assert.deepEqual(decideWithMemory(view(a),profile,37,JSON.parse(JSON.stringify(d.memory))).action,d.action);
});
test('natural decision/memory/state replay and gate-off parity',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),base=validateProfile(template('baseline','heuristic-1.1.0')),off=structuredClone(profile);off.parameters.enablePurchaseValuation=0;const prior=validateProfile(template('robber','robber-knight-0.1.0')),job={id:'purchase-natural',caseId:'purchase-natural',gameSeed:37,rotation:0,repeat:0,roster:'three',profiles:['robber','baseline','baseline']},run=focal=>runMatch({job,profiles:[focal,base,base],maxActions:2500,decisionSeed:92831});const a=run(profile),b=run(profile),c=run(validateProfile(off)),d=run(prior);for(const r of [a,b,c,d])assert.equal(r.status,'ended',r.reason);for(const k of ['traceHash','planTraceHash','finalStateHash','winnerSeat']){assert.equal(a[k],b[k]);assert.equal(c[k],d[k]);}
});
test('a changed hand reverses investment versus construction and owned VP raises late value',()=>{
 const s=prepared({ore:1,grain:1,wool:1}),q={...p,purchaseVpValue:2,purchaseLateVpWeight:2,purchaseKnightValue:2,purchaseArmyWeight:2,purchaseDelayDiscount:1},v=view(s);
 const city=v.state.board.buildings.find(b=>b.playerId==='p0');const m={schemaVersion:1,goalKey:'city|'+vertexKey(city.vertex)};
 const a=decision(v,q,37,m);assert.equal(a.action.type,'BUY_DEVELOPMENT_CARD');assert.ok(a.memory.goalKey.startsWith('development|'));
 held(s,'p0',{ore:3,grain:2,wool:1});const b=decision(view(s),p,37,m);assert.equal(b.action.type,'BUILD_CITY');
 const before=purchaseValue(v,p).types.victoryPoint.value;v.state.players.players[0].developmentCards.push({id:'known-vp',type:'victoryPoint',isPlayed:false,turnBought:0});assert.ok(purchaseValue(v,p).types.victoryPoint.value>before);
});
