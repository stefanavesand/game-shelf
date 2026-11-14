import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScenario,validateScenario,scenarioTiles} from '../../play/catan/rules/scenarios.js';
import {generateBeginnerBoard} from '../../play/catan/rules/model.js';
import {createEntropy} from '../../play/catan/entropy.js';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {eligibleActors,RESOURCES,botDecision} from '../../play/catan/rules/index.js';
import {template,validateProfile,decideWithMemory,hash} from '../../scripts/bots/profiles.mjs';
import {createRelayClient} from '../../play/relay/client.js';
import {createMemoryStore} from '../../play/relay/store.js';
import {fakeRelay,createLocks} from '../relay/fake-relay.js';
const module=createCatanModule('scenarios'),island=seed=>generateScenario('random-island',createEntropy({rngState:seed,idCounter:0},'layout',0).randomInt);
test('one thousand seeded random islands satisfy inventories, desert and non-adjacent red constraints',()=>{
 const seen=new Set();for(let seed=1;seed<=1000;seed++){const s=island(seed);validateScenario(s);assert.equal(s.ports.length,9);assert.equal(s.terrain.length,19);seen.add(hash(s));}assert.ok(seen.size>990);
 assert.deepEqual(island(37),island(37));assert.deepEqual(scenarioTiles(undefined),generateBeginnerBoard());assert.equal(generateScenario('classic',()=>assert.fail('Classic must not consume entropy')),undefined);assert.throws(()=>generateScenario('unknown',()=>0));
});
test('malformed or unsupported scenario recipes are rejected before initialization',()=>{
 const s=island(37);for(const patch of [{version:2},{id:'harbormaster'},{terrain:s.terrain.slice(1)},{numbers:s.numbers.map(()=>6)},{ports:Array(9).fill('ore')},{extra:1}])assert.throws(()=>validateScenario({...s,...patch}));
 const bad=structuredClone(s),red=bad.numbers.findIndex(n=>n===6),tiles=scenarioTiles(s),near=tiles.findIndex((t,i)=>i!==red&&t.number&&![6,8].includes(t.number)&&Math.max(Math.abs(t.coord.q-tiles[red].coord.q),Math.abs(t.coord.r-tiles[red].coord.r),Math.abs(t.coord.q+t.coord.r-tiles[red].coord.q-tiles[red].coord.r))===1);
 const other=bad.numbers.findIndex((n,i)=>i!==red&&[6,8].includes(n));[bad.numbers[near],bad.numbers[other]]=[bad.numbers[other],bad.numbers[near]];assert.throws(()=>validateScenario(bad),/adjacent/);
 const humans=[{id:'a',name:'A'}];assert.throws(()=>module.initialize({...catanConfig(humans,{seed:37}),scenario:{...s,version:2}},{gameId:'bad'}));
});
test('explicit recipe initializes identically, uses the desert robber and actual randomized port endpoints',()=>{
 const scenario=island(91),config=catanConfig([{id:'a',name:'A'}],{seed:37,scenario}),before=structuredClone(config),a=module.initialize(config,{gameId:'same'}),b=module.initialize(JSON.parse(JSON.stringify(config)),{gameId:'same'});assert.deepEqual(a,b);assert.deepEqual(config,before);assert.equal(a.snapshot.state.game.settings.map,'random-island');assert.deepEqual(a.snapshot.state.board.robberLocation,a.snapshot.state.board.tiles.find(t=>t.terrain==='desert').coord);
 const classic=module.initialize(catanConfig([{id:'a',name:'A'}],{seed:37}),{gameId:'same'});for(const [i,p]of a.snapshot.state.board.ports.entries()){assert.deepEqual(p.vertices,classic.snapshot.state.board.ports[i].vertices);assert.equal(p.type,scenario.ports[i]);assert.equal(p.ratio,p.type==='generic'?3:2);}
});
test('online lobby and begin carry the same explicit recipe and restore without regeneration',async()=>{
 const server=fakeRelay(),store=createMemoryStore(),locks=createLocks(),config=catanConfig([{id:'alice',name:'A'},{id:'bob',name:'B'}],{seed:37,scenario:island(37)});let n=0;
 const client=principalId=>createRelayClient({principalId,...server,creatorId:'alice',module,store,locks,id:()=>`scenario-${++n}`,transport:server.transport()}),a=client('alice'),b=client('bob');await a.configure({seed:37,level:'standard',playerCount:3,scenario:config.scenario});await a.begin(config);const aa=await a.sync(),bb=await b.sync();assert.equal(aa.game.hash,bb.game.hash);assert.deepEqual(bb.lobby.scenario,config.scenario);assert.deepEqual((await client('bob').sync()).game.state.snapshot.state.board,aa.game.state.snapshot.state.board);assert.ok(JSON.stringify(server.messages.find(m=>m.message.type==='game.begin').message.payload).length<8192);
});
test('random Solo saves its chosen island across reopening',async()=>{
 const {createLocalClient}=await import('../../play/local/client.js');let data={schemaVersion:1,local:false,current:null,games:{}};const storage={load:async()=>structuredClone(data),save:async d=>{data=structuredClone(d);}},options={storage,locks:createLocks(),seed:()=>37,id:()=> 'saved-random'};let c=createLocalClient(options),p=await c.execute('create',{name:'Solo',scenario:'random-island'},{botBudget:0});const board=structuredClone(p.view.state.board);assert.equal((await c.games())[0].scenario,'Random Island');c=createLocalClient(options);assert.deepEqual((await c.inspect()).packet.view.state.board,board);
});
test('Standard and Planner finish random-island games for three and four seats with conserved resources',{timeout:120000},()=>{
 for(const count of [3,4])for(const version of ['heuristic-1.1.0','development-investment-0.1.0']){
  const profile=validateProfile(template('scenario-test',version)),people=Array.from({length:count},(_,i)=>({id:'p'+i,name:'Seat '+i})),memory=new Map();let state=module.initialize(catanConfig(people,{seed:91,playerCount:count,scenario:island(count*37)}),{gameId:'random-'+count+'-'+version}),steps=0;
  while(state.snapshot.state.game.phase!=='ended'&&steps++<2500){const actor=eligibleActors(state.snapshot)[0],d=decideWithMemory(module.view(state,actor),profile,37,memory.get(actor)||null);state=module.apply(state,actor,{actor,action:d.action},{},{coordinatorId:'p0'});if(d.memory)memory.set(actor,d.memory);for(const r of RESOURCES)assert.equal(state.snapshot.state.game.bank[r]+state.snapshot.state.players.players.reduce((n,p)=>n+p.resources[r],0),19);}
  assert.equal(state.snapshot.state.game.phase,'ended',count+' '+version);assert.ok(steps<2500);
 }
});

test('online creation persists the generated recipe before network mutation and retries reuse it',async()=>{
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:createLocks()}});
 try{const server=fakeRelay(),store=createMemoryStore(),auth={savedIdentity:()=>({user:{id:'alice'}}),identity:async()=>({user:{id:'alice'}})},client=()=>createOnlineGameClient({auth,store,transport:server.transport()});server.loseResponse();await assert.rejects(client().execute('create',{name:'Alice',scenario:'random-island',playerCount:4}),e=>e.retryable);const pending=await store.load('alice','@index'),recipe=structuredClone(pending.intent.lobbyScenario);validateScenario(recipe);const c=client(),waiting=await c.refresh({botBudget:0});assert.equal(waiting.lobby.scenario,'Random Island');assert.deepEqual((await store.load('alice','channel')).lobby.scenario,recipe);const started=await c.execute('start',{roomId:'channel'},{botBudget:0});assert.equal(started.view.seats.length,4);assert.deepEqual(started.view.state.board.tiles.map(t=>t.terrain),recipe.terrain);assert.deepEqual(started.view.state.board.tiles.map(t=>t.number),recipe.numbers);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
