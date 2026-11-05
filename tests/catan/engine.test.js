import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {createEntropy} from '../../play/catan/entropy.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {generateBeginnerBoard} from '../../play/catan/rules/model.js';
import {getHexVertices,getHexEdges,getVertexEdges,getEdgeVertices,vertexKey,edgeKey,edgeToPixel} from '../../play/catan/rules/geometry.js';
import {botDecision,eligibleActors,RESOURCES} from '../../play/catan/rules/index.js';
import {roadLength} from '../../play/catan/rules/scoring.js';
import {vertexPoint,edgePoints} from '../../play/board.js';
import {digest,canonical} from '../../play/relay/protocol.js';
import {createRelayClient} from '../../play/relay/client.js';
import {createMemoryStore} from '../../play/relay/store.js';
import {fakeRelay,createLocks} from '../relay/fake-relay.js';
const m=createCatanModule(CATAN_ARTIFACT.compatibilityId),humans=[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'}];
const config=seed=>catanConfig(humans,{seed});
const initial=seed=>m.initialize(config(seed),{gameId:'deterministic-game'});
function choice(state){const bot=m.nextBot(state);if(bot)return bot;const actor=eligibleActors(state.snapshot)[0];return {actor,action:botDecision(m.view(state,actor),'standard')};}
function advance(state){const command=choice(state),seat=state.snapshot.seats.find(s=>s.id===command.actor);return {command,state:m.apply(state,seat.kind==='bot'?'alice':seat.id,command,{}, {coordinatorId:'alice'})};}
function conserved(state){for(const resource of RESOURCES){const values=[state.snapshot.state.game.bank[resource],...state.snapshot.state.players.players.map(p=>p.resources[resource])];assert.equal(values.reduce((a,b)=>a+b),19);assert.ok(values.every(v=>Number.isSafeInteger(v)&&v>=0));}}
test('artifact digest pins every runtime source and excludes provider/UI imports',async()=>{
 for(const file of CATAN_ARTIFACT.files){const bytes=await readFile(new URL('../../'+file.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);if(file.path.startsWith('play/catan/'))assert.doesNotMatch(bytes.toString(),/\b(?:document|window|localStorage|indexedDB|fetch|PartyKit|supabase)\b/);}
 assert.equal(createHash('sha256').update(JSON.stringify(CATAN_ARTIFACT.files)).digest('hex'),CATAN_ARTIFACT.digest);
 for(const file of await readdir(new URL('../../play/catan/rules/',import.meta.url)))if(file.endsWith('.js')){const code=await readFile(new URL('../../play/catan/rules/'+file,import.meta.url),'utf8');assert.doesNotMatch(code,/from ['"]@\//);assert.doesNotMatch(code,/Math\.random|Date\.now|crypto\./);}
});
test('integer topology has 19 tiles, 54 intersections, 72 roads and reciprocal incidence',()=>{
 const tiles=generateBeginnerBoard(),vertices=new Map(),edges=new Map();assert.equal(tiles.length,19);
 for(const t of tiles){for(const v of getHexVertices(t.coord))vertices.set(vertexKey(v),v);for(const e of getHexEdges(t.coord))edges.set(edgeKey(e),e);}
 assert.equal(vertices.size,54);assert.equal(edges.size,72);
 for(const v of vertices.values())for(const e of getVertexEdges(v))assert.ok(getEdgeVertices(e).some(end=>vertexKey(end)===vertexKey(v)));
 for(const e of edges.values())for(const v of getEdgeVertices(e))assert.ok(getVertexEdges(v).some(incident=>edgeKey(incident)===edgeKey(e)));
});
test('rule geometry and original UI geometry agree on every actual edge endpoint',()=>{
 for(const tile of generateBeginnerBoard())for(const edge of getHexEdges(tile.coord)){
  const expected=edgePoints(edge,1),actual=getEdgeVertices(edge).map(v=>vertexPoint(v,1));
  for(const p of actual)assert.ok(expected.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-9));
  const midpoint=edgeToPixel(edge,1);assert.ok(Math.hypot(midpoint.x-(actual[0].x+actual[1].x)/2,midpoint.y-(actual[0].y+actual[1].y)/2)<1e-9);
 }
});
test('initialization pins seed, versions, finite deck, ports and integer-only state',async()=>{
 const a=initial(123),b=initial(123);assert.equal(await digest(a),await digest(b));assert.notEqual(await digest(a),await digest(initial(124)));
 assert.equal(a.snapshot.deck.length,25);assert.equal(a.snapshot.state.board.ports.length,9);assert.equal(a.snapshot.engineVersion,'2.1.0');assert.doesNotThrow(()=>canonical(a));conserved(a);
 const portVertices=a.snapshot.state.board.ports.flatMap(p=>p.vertices.map(vertexKey));assert.equal(new Set(portVertices).size,18);
});
test('entropy resumes exactly, bounds draws and uses logical IDs/time',()=>{
 const a=createEntropy({rngState:123,idCounter:0},'game',5),prefix=Array.from({length:20},()=>a.randomInt(6));assert.ok(prefix.every(n=>n>=0&&n<6));assert.equal(a.now(),5);assert.equal(a.id(),'game:entity:1');
 const b=createEntropy(a.snapshot(),'game',6);for(let i=0;i<100;i++)assert.equal(a.randomInt(19),b.randomInt(19));assert.equal(b.id(),'game:entity:2');assert.throws(()=>a.randomInt(0));assert.throws(()=>createEntropy({rngState:0,idCounter:0},'game',0));
});
test('setup completes with six settlements/roads and resource conservation',()=>{
 let state=initial(1234);const before=structuredClone(state);
 for(let i=0;i<12;i++){state=advance(state).state;conserved(state);}
 assert.equal(state.snapshot.state.game.phase,'roll');assert.equal(state.snapshot.state.board.buildings.length,6);assert.equal(state.snapshot.state.board.roads.length,6);assert.equal(before.snapshot.revision,0);
});
test('two independent states replay the same 150 actions with identical hashes and entropy',async()=>{
 let a=initial(424242),b=initial(424242);
 for(let i=0;i<150;i++){const step=advance(a),seat=a.snapshot.seats.find(s=>s.id===step.command.actor);b=m.apply(b,seat.kind==='bot'?'alice':seat.id,step.command,{}, {coordinatorId:'alice'});a=step.state;assert.equal(await digest(a),await digest(b));conserved(a);}
});
test('forged actors, external dice and illegal moves cannot mutate state or consume entropy',()=>{
 const state=initial(9),before=structuredClone(state),actor=state.snapshot.state.game.currentPlayerId;
 assert.throws(()=>m.apply(state,'intruder',{actor,action:{type:'END_TURN'}},{},{coordinatorId:'alice'}));
 assert.throws(()=>m.apply(state,'bob',{actor:'bot:2',action:{}},{},{coordinatorId:'alice'}));
 assert.throws(()=>m.apply(state,'alice',{actor:'alice',action:{}},{die:6},{coordinatorId:'alice'}));
 assert.throws(()=>m.apply(state,actor,{actor,action:{type:'END_TURN'}},{},{coordinatorId:actor}));assert.deepEqual(state,before);
});
test('seat projections hide other hands/deck and cannot mutate the full snapshot',()=>{
 const state=initial(7),before=structuredClone(state);state.snapshot.state.players.players[1].resources.ore=3;
 const view=m.view(state,'alice');assert.equal(view.state.players.players[1].resources.ore,0);assert.equal(view.state.players.players[1].resourceCount,3);assert.equal(view.deck,undefined);view.state.players.players[0].resources.ore=99;assert.deepEqual(state.snapshot.state.players.players[0],before.snapshot.state.players.players[0]);
});
test('longest road counts a continuous trail rather than summing disconnected roads',()=>{
 const state=initial(7).snapshot.state;const tile=state.board.tiles[0].coord;state.board.roads=getHexEdges(tile).slice(0,3).map(edge=>({playerId:'alice',edge}));assert.equal(roadLength(state,'alice'),3);
 state.board.roads.push({playerId:'alice',edge:{hex:{q:20,r:20},direction:'E'}});assert.equal(roadLength(state,'alice'),3);
});
test('actual Catan setup replicates over ordered relay messages with one coordinator bot',async()=>{
 const server=fakeRelay(),store=createMemoryStore(),locks=createLocks();const make=principalId=>createRelayClient({principalId,channelId:server.channelId,creatorId:'alice',members:server.members,module:m,store,locks,transport:server.transport()});
 const alice=make('alice'),bob=make('bob');await alice.begin(config(123));await bob.sync();
 for(let i=0;i<12;i++){
  const current=(await alice.sync()).game.state,command=choice(current),seat=current.snapshot.seats.find(s=>s.id===command.actor);
  await (seat.kind==='human'&&seat.id==='bob'?bob:alice).command(command);await alice.sync();await bob.sync();
 }
 const a=await alice.sync(),b=await bob.sync();assert.equal(a.game.state.snapshot.state.game.phase,'roll');assert.equal(a.game.hash,b.game.hash);assert.equal(a.halt,null);assert.equal(b.halt,null);
});
test('natural seeded policy game reaches ten points without privileged fixtures',()=>{
 let state=initial(2026),steps=0;
 while(state.snapshot.state.game.phase!=='ended'&&steps++<3000){state=advance(state).state;conserved(state);}
 assert.equal(state.snapshot.state.game.phase,'ended',`Game did not finish after ${steps} actions`);assert.ok(state.snapshot.state.game.winnerId);assert.ok(state.snapshot.state.game.turn>1);
 console.log(`Natural Catan policy game: ${steps} actions, ${state.snapshot.state.game.turn} turns.`);
});
function mainFixture(){const state=initial(42);state.snapshot.state.game.phase='main';state.snapshot.state.game.currentPlayerId='alice';state.snapshot.state.game.turn=1;return state;}
function fund(state,seat,resource,count){const p=state.snapshot.state.players.players.find(p=>p.id===seat);state.snapshot.state.game.bank[resource]-=count-p.resources[resource];p.resources[resource]=count;}
const act=(state,actor,action)=>m.apply(state,actor,{actor,action},{},{coordinatorId:'alice'});
test('a targeted resource offer transfers once and late acceptance is rejected without mutation',()=>{
 let state=mainFixture();fund(state,'alice','brick',3);fund(state,'bob','ore',2);const before=structuredClone(state);
 state=act(state,'alice',{type:'TRADE_OFFER',to:'bob',give:{brick:2},receive:{ore:1}});assert.equal(state.snapshot.state.players.players[0].resources.brick,3);
 const offerId=state.snapshot.offer.id;state=act(state,'bob',{type:'TRADE_ACCEPT',offerId});assert.equal(state.snapshot.offer,null);assert.equal(state.snapshot.state.players.players[0].resources.brick,1);assert.equal(state.snapshot.state.players.players[1].resources.brick,2);conserved(state);
 const accepted=structuredClone(state);assert.throws(()=>act(state,'bob',{type:'TRADE_ACCEPT',offerId}));assert.deepEqual(state,accepted);assert.equal(before.snapshot.state.players.players[0].resources.brick,3);
});
test('port exchange uses the actual best rate and rejects insufficient finite bank stock atomically',()=>{
 let state=mainFixture();const port=state.snapshot.state.board.ports.find(p=>p.type==='brick');state.snapshot.state.board.buildings.push({id:'fixture-home',playerId:'alice',type:'settlement',vertex:port.vertices[0]});fund(state,'alice','brick',4);
 assert.ok(m.view(state,'alice').choices.some(c=>c.type==='BANK_TRADE'&&c.give.resource==='brick'&&c.give.amount===2));
 state=act(state,'alice',{type:'BANK_TRADE',give:{resource:'brick',amount:2},receive:{resource:'ore',amount:1}});conserved(state);assert.equal(state.snapshot.state.players.players[0].resources.ore,1);
 fund(state,'bob','ore',18);const before=structuredClone(state);assert.throws(()=>act(state,'alice',{type:'BANK_TRADE',give:{resource:'brick',amount:2},receive:{resource:'ore',amount:1}}));assert.deepEqual(state,before);
});
test('new development cards cannot be played during their purchase turn',()=>{
 let state=mainFixture();fund(state,'alice','ore',1);fund(state,'alice','grain',1);fund(state,'alice','wool',1);
 const index=state.snapshot.deck.indexOf('knight');[state.snapshot.deck[0],state.snapshot.deck[index]]=[state.snapshot.deck[index],state.snapshot.deck[0]];
 state=act(state,'alice',{type:'BUY_DEVELOPMENT_CARD'});assert.equal(state.snapshot.deck.length,24);assert.equal(state.snapshot.state.players.players[0].developmentCards[0].type,'knight');assert.ok(!m.view(state,'alice').choices.some(c=>c.type==='PLAY_KNIGHT'));
 const before=structuredClone(state);assert.throws(()=>act(state,'alice',{type:'PLAY_KNIGHT',hex:state.snapshot.state.board.robberLocation}));assert.deepEqual(state,before);conserved(state);
});
test('bots accept a useful fair offer instead of always declining',()=>{
 let state=mainFixture();fund(state,'alice','ore',2);fund(state,'bot:2','brick',2);fund(state,'bot:2','grain',2);
 state=act(state,'alice',{type:'TRADE_OFFER',to:'bot:2',give:{ore:2},receive:{brick:1}});
 const response=m.nextBot(state);assert.equal(response.actor,'bot:2');assert.equal(response.action.type,'TRADE_ACCEPT');
 const next=m.apply(state,'alice',response,{}, {coordinatorId:'alice'});assert.equal(next.snapshot.offer,null);conserved(next);
});
test('a bot-originated offer waits for a human instead of immediately cancelling itself',()=>{
 const state=mainFixture(),snapshot=state.snapshot;snapshot.state.game.currentPlayerId='bot:2';fund(state,'alice','ore',1);fund(state,'bot:2','wool',2);
 const offer=botDecision(m.view(state,'bot:2'),'standard');assert.equal(offer.type,'TRADE_OFFER');
 const next=m.apply(state,'alice',{actor:'bot:2',action:offer},{},{coordinatorId:'alice'});assert.ok(next.snapshot.offer);assert.equal(m.nextBot(next),null);
});

test('three/four seats accept every human count and deterministically fill only empty seats',()=>{
 for(const playerCount of [3,4])for(let n=1;n<=playerCount;n++){
  const humans=Array.from({length:n},(_,i)=>({id:'human:'+i,name:i===0?'Captain Turnip':'Friend '+i}));
  const a=catanConfig(humans,{playerCount,seed:8}),b=catanConfig(humans,{playerCount,seed:8});
  assert.deepEqual(a,b);assert.equal(a.seats.length,playerCount);assert.equal(a.seats.filter(s=>s.kind==='bot').length,playerCount-n);
  assert.equal(new Set(a.seats.map(s=>s.name.toLowerCase())).size,playerCount);assert.ok(a.seats.every(s=>!/^Bot \d/.test(s.name)));
  assert.equal(m.initialize(a,{gameId:'seats'}).snapshot.seats.length,playerCount);
 }
 for(const playerCount of [2,5,3.5])assert.throws(()=>catanConfig(humans,{playerCount,seed:1}));
 assert.throws(()=>catanConfig([],{seed:1}));assert.throws(()=>catanConfig([...humans,...humans],{playerCount:4,seed:1}));
});
test('four-seat snake setup completes with eight roads and settlements then finishes naturally',()=>{
 let state=m.initialize(catanConfig(humans,{playerCount:4,seed:2026}),{gameId:'four-seat-game'});
 for(let i=0;i<16;i++){state=advance(state).state;conserved(state);}
 assert.equal(state.snapshot.state.game.phase,'roll');assert.equal(state.snapshot.state.board.buildings.length,8);assert.equal(state.snapshot.state.board.roads.length,8);
 let steps=16;while(state.snapshot.state.game.phase!=='ended'&&steps++<3000){state=advance(state).state;conserved(state);}
 assert.equal(state.snapshot.state.game.phase,'ended');assert.ok(state.snapshot.state.game.winnerId);
});
