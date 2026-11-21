import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,digest,RelayError,validatePage} from '../../play/relay/protocol.js';
import {createRelayTransport} from '../../play/relay/transport.js';
import {createMemoryStore,emptyRecord} from '../../play/relay/store.js';
import {createRelayClient} from '../../play/relay/client.js';
import {createRelayLobby} from '../../play/relay/lobby.js';
import {counterModule} from '../../play/relay/fixture.js';
import {SESSION_SCHEMA} from '../../play/relay/replica.js';
import {fakeRelay,createLocks} from './fake-relay.js';
let nextId=0;const id=()=>`fixture-${++nextId}`,now=()=>Date.parse('2026-11-03T12:00:00Z');
function harness(){const server=fakeRelay(),store=createMemoryStore(),locks=createLocks(),module=counterModule('fixture-artifact');const client=(principalId,extra={})=>createRelayClient({principalId,...server,creatorId:server.creator,module,store,locks,id,now,transport:server.transport(),...extra});return {server,store,locks,module,alice:client('alice'),bob:client('bob'),client};}
test('canonical JSON is ordered, strict and hashes equally across object insertion orders',async()=>{
 assert.equal(canonical({z:[1,true,null],a:'å'}),'{"a":"å","z":[1,true,null]}');assert.equal(await digest({b:2,a:1}),await digest({a:1,b:2}));
 for(const v of [NaN,Infinity,1.5,undefined,{bad:undefined},new Date()])assert.throws(()=>canonical(v));
});
test('two replicas initialize, replay a shared die and independently agree',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();await h.alice.command({type:'ROLL'},{die:4});const b=await h.bob.sync(),a=await h.alice.sync();
 assert.equal(a.game.state.value,4);assert.equal(a.game.hash,b.game.hash);assert.equal(a.game.revision,1);assert.equal(b.game.peerVerified.alice,1);
});
test('commit then lost acknowledgment resends exact persisted intent and applies once',async()=>{
 const h=harness();await h.alice.begin({start:0});h.server.loseResponse();await assert.rejects(h.alice.command({type:'ADD',amount:3}),e=>e.retryable);
 const before=await h.alice.state(),request=structuredClone(before.outbox[0].request);assert.equal(before.game.state.value,0);
 const reopened=h.client('alice');const after=await reopened.sync();assert.equal(after.game.state.value,3);assert.equal(after.outbox.length,0);
 const repeats=h.server.sent.filter(x=>x.body.mutationId===request.mutationId);assert.equal(repeats.length,2);assert.deepEqual(repeats[0].body,repeats[1].body);
});
test('a failed storage commit prevents any mutation from leaving the browser',async()=>{
 const h=harness(),client=h.client('alice',{store:{load:async()=>emptyRecord('alice','channel'),save:async()=>{throw new RelayError('STORAGE_FAILURE','Denied.');}}});
 await assert.rejects(client.begin({start:0}),e=>e.code==='STORAGE_FAILURE');assert.equal(h.server.messages.length,0);
});
test('CAS conflict synchronizes before re-enveloping the original game intent',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();
 let conflict=true;const transport=h.server.transport();const raced=h.client('alice',{transport:{request:async(body,p)=>{
  if(body.op==='message.append'&&body.message.type==='game.command'&&conflict){conflict=false;await h.bob.command({type:'ADD',amount:2});}
  return transport.request(body,p);
 }}});
 const immediate=await raced.command({type:'ADD',amount:1});assert.equal(immediate.outbox.length,0);const settled=await raced.sync();assert.equal(settled.game.state.value,2);assert.equal(settled.halt,null);
 const attempts=h.server.sent.filter(x=>x.body.message?.type==='game.command'&&x.principal==='alice');assert.equal(attempts.length,2);assert.notEqual(attempts[0].body.mutationId,attempts[1].body.mutationId);assert.equal(attempts[0].body.message.payload.intentId,attempts[1].body.message.payload.intentId);
});
test('result mismatch durably halts locally and propagates to the other replica',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();
 const divergent=h.client('alice',{module:{...h.module,apply:(state)=>({value:state.value+99})}});
 await divergent.command({type:'ADD',amount:1});const b=await h.bob.sync();assert.equal(b.halt.code,'DESYNC_DETECTED');assert.equal(b.game.state.value,0);
 const a=await h.alice.sync();assert.equal(a.halt.reason,'peer_report');await assert.rejects(h.alice.command({type:'ADD',amount:1}),e=>e.code==='GAME_HALTED');
});
test('an offline peer is pending verification and can catch up without false divergence',async()=>{
 const h=harness();await h.alice.begin({start:0});for(let i=0;i<3;i++)await h.alice.command({type:'ADD',amount:1});assert.equal((await h.alice.state()).halt,null);
 const b=await h.bob.sync();assert.equal(b.game.state.value,3);assert.equal(b.game.revision,3);assert.equal(b.halt,null);
});
test('incompatible artifacts stop before overwriting the saved cursor',async()=>{
 const h=harness();await h.alice.begin({start:0});await assert.rejects(h.client('bob',{module:counterModule('other')}).sync(),e=>e.code==='UNSUPPORTED_ENGINE');assert.equal((await h.bob.state()).cursor,0);
});
test('pages reject gaps, duplicates, false high watermarks and missing history',()=>{
 const item={sequence:1,senderId:'alice',messageId:'1',message:{schema:'x',type:'y',payload:{}}};
 const page={messages:[item],highWatermark:1,nextAfterSequence:1,hasMore:false,earliestAvailableSequence:1};assert.equal(validatePage(page,0),page);
 assert.throws(()=>validatePage({...page,messages:[{...item,sequence:2}]},0),e=>e.code==='SEQUENCE_GAP');
 assert.throws(()=>validatePage({...page,messages:[item,item]},0));assert.throws(()=>validatePage({...page,highWatermark:2},0));assert.throws(()=>validatePage({...page,earliestAvailableSequence:2},0),e=>e.code==='HISTORY_UNAVAILABLE');
});
test('state and outbox are scoped to a principal and channel',async()=>{
 const h=harness();await h.alice.begin({start:0});assert.equal((await h.store.load('bob','channel')).game,null);assert.equal((await h.store.load('alice','other')).game,null);
});
test('two browser windows serialize the same outbox and do not double-submit',async()=>{
 const h=harness();await h.alice.begin({start:0});h.server.loseResponse();await assert.rejects(h.alice.command({type:'ADD',amount:2}));
 await Promise.all([h.alice.sync(),h.client('alice').sync()]);assert.equal((await h.alice.state()).game.state.value,2);assert.equal(h.server.messages.filter(m=>m.message.type==='game.command').length,1);
});
test('an unknown future schema preserves the last complete checkpoint',async()=>{
 const h=harness();await h.alice.begin({start:0});const before=await h.alice.state();h.server.messages.push({sequence:h.server.messages.length+1,senderId:'bob',messageId:'future',message:{schema:'future/2',type:'game.command',payload:{}}});
 await assert.rejects(h.alice.sync(),e=>e.code==='UNSUPPORTED_PROTOCOL');assert.deepEqual(await h.alice.state(),before);
});
test('re-enveloped duplicate game command does not become another move',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.alice.command({type:'ADD',amount:2});const msg=h.server.messages.find(m=>m.message.type==='game.command');
 h.server.messages.push({...structuredClone(msg),sequence:h.server.messages.length+1,messageId:'another-relay-id'});assert.equal((await h.alice.sync()).game.state.value,2);
});
test('same-revision verification mismatch stops without majority voting',async()=>{
 const h=harness();await h.alice.begin({start:0});h.server.messages.push({sequence:h.server.messages.length+1,senderId:'bob',messageId:'bad-hash',message:{schema:SESSION_SCHEMA,type:'game.verify',payload:{gameId:(await h.alice.state()).game.id,revision:0,resultHash:'bad'}}});
 assert.equal((await h.alice.sync()).halt.reason,'peer_hash_mismatch');
});
test('admission retries a durable create instead of creating a replacement channel',async()=>{
 const h=harness(),lobby=createRelayLobby({principalId:'alice',transport:h.server.transport(),store:h.store,locks:h.locks,id,now});h.server.loseResponse();
 await assert.rejects(lobby.mutate('channel.create'));const original=await lobby.pending();await assert.rejects(lobby.mutate('channel.join',{inviteToken:'other'}),e=>e.code==='PENDING_DELIVERY');
 assert.equal((await lobby.mutate()).channelId,'channel');assert.equal(await lobby.pending(),null);assert.equal((await lobby.lastResult()).op,'channel.create');assert.equal(h.server.sent.filter(x=>x.body.mutationId===original.mutationId).length,2);
});
test('HTTP adapter preserves mutation identity while changing correlation ID',async()=>{
 const calls=[],identity=async()=>({user:{id:'alice'},access_token:'test-token'});
 const t=createRelayTransport({endpoint:'https://example.invalid/api/public/relay/v1',identity,id,fetcher:async(_url,options)=>{calls.push(JSON.parse(options.body));return new Response(JSON.stringify({ok:true,protocolVersion:1,result:{}}));}});
 const body={protocolVersion:1,op:'channel.create',mutationId:'stable',intentCreatedAt:'2026-11-03T12:00:00Z'};await t.request(body,'alice');await t.request(body,'alice');assert.equal(calls[0].mutationId,calls[1].mutationId);assert.notEqual(calls[0].requestId,calls[1].requestId);
});
test('HTTP adapter blocks changed identities, malformed replies and honors cooldown',async()=>{
 let calls=0;const identity=async()=>({user:{id:'bob'},access_token:'test'}),options={endpoint:'https://example.invalid/relay',identity,fetcher:async()=>{calls++;}};
 await assert.rejects(createRelayTransport(options).request({},'alice'),e=>e.code==='AUTH_REQUIRED');assert.equal(calls,0);
 options.identity=async()=>({user:{id:'alice'},access_token:'test'});options.fetcher=async()=>new Response('{}');await assert.rejects(createRelayTransport(options).request({},'alice'),e=>e.code==='UNSUPPORTED_PROTOCOL');
 options.fetcher=async()=>new Response('',{status:429,headers:{'Retry-After':'12'}});await assert.rejects(createRelayTransport(options).request({},'alice'),e=>e.retryAfterMs===12000);
});
test('HTTP 401 refreshes the same identity once and preserves the submitted mutation',async()=>{
 const calls=[],refresh=[];const transport=createRelayTransport({endpoint:'https://example.invalid/relay',id,identity:async options=>{refresh.push(options.forceRefresh);return {user:{id:'alice'},access_token:options.forceRefresh?'new':'old'};},fetcher:async(_url,options)=>{
  calls.push(JSON.parse(options.body));return options.headers.Authorization==='Bearer old'?new Response('',{status:401}):new Response(JSON.stringify({ok:true,protocolVersion:1,result:{}}));
 }});
 await transport.request({protocolVersion:1,op:'channel.create',mutationId:'same'},'alice');assert.deepEqual(refresh,[false,true]);assert.equal(calls[0].mutationId,calls[1].mutationId);
});
test('a guest cannot invent a die outcome in the coordinator-only fixture action',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();await assert.rejects(h.bob.command({type:'ROLL'},{die:6}),/coordinator/);assert.equal((await h.bob.state()).game.state.value,0);
});
test('local checkpoint corruption blocks play instead of advertising a restored game',async()=>{
 const h=harness();await h.alice.begin({start:0});const saved=await h.store.load('alice','channel');saved.game.state.value=123;await h.store.save(saved);await assert.rejects(h.alice.sync(),e=>e.code==='INVALID_SAVE');
});
test('an action bound to a displayed revision is never silently rebased after catch-up',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();const displayed=await h.alice.state();await h.bob.command({type:'ADD',amount:2});
 await assert.rejects(h.alice.command({type:'ADD',amount:1},{},{revision:displayed.game.revision,hash:displayed.game.hash}),e=>e.code==='STALE_GAME');assert.equal((await h.alice.state()).game.state.value,2);assert.equal(h.server.messages.filter(m=>m.message.type==='game.command').length,1);
});


test('concurrent creator refreshes adopt one started Catan game without a false failure',async()=>{
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:createLocks()}});
 try{
  const server=fakeRelay(),store=createMemoryStore(),index=await store.load('alice','@index');
  index.current='channel';index.rooms={channel:{botLevel:'standard'}};await store.save(index);
  const auth={savedIdentity:()=>({user:{id:'alice'}}),identity:async()=>({user:{id:'alice'}})};
  const client=createOnlineGameClient({auth,store,transport:server.transport()});
  const packets=await Promise.all([client.refresh(),client.refresh()]);
  assert.ok(packets.every(p=>p.ok&&p.view));
  assert.equal(server.messages.filter(m=>m.message.type==='game.begin').length,1);
  assert.equal(packets[0].roomId,packets[1].roomId);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});

test('online abandonment preserves pending deliveries and only unpins a resolved game',async()=>{
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:createLocks()}});
 try{
  const store=createMemoryStore(),index=await store.load('alice','@index');index.current='channel';index.rooms={channel:{members:[],botLevel:'standard'}};await store.save(index);
  const record=await store.load('alice','channel');record.game={moduleDigest:'old-engine',state:{snapshot:{state:{game:{phase:'main'}}}}};record.outbox=[{message:{type:'game.command'},request:{mutationId:'pending-original'}}];await store.save(record);
  const client=createOnlineGameClient({auth:{savedIdentity:()=>({user:{id:'alice'}})},store,transport:{request:()=>{throw Error('No network should be needed');}}});
  await assert.rejects(client.abandon('channel'),e=>e.code==='PENDING_DELIVERY');assert.deepEqual(await store.load('alice','channel'),record);assert.equal(await client.canUpdate('next-engine'),false);
  record.outbox=[];await store.save(record);await client.abandon('channel');assert.equal(await client.canUpdate('next-engine'),true);assert.deepEqual(await client.games(),[]);assert.equal((await client.inspect()).packet,null);assert.equal((await client.resume('channel')).ok,false);assert.deepEqual(await store.load('alice','channel'),record);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});

function browserLocks(t){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:createLocks()}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;});
}
test('new lobbies wait for the host, replicate size/seed and fill only unclaimed seats',async t=>{
 browserLocks(t);
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 const server=fakeRelay({members:['alice']}),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{identity:async()=>({user:{id}}),savedIdentity:()=>({user:{id}})}});
 const alice=make('alice');let p=await alice.execute('create',{name:'Alice',playerCount:4,botLevel:'easy'});
 assert.equal(p.status,'waiting');assert.equal(p.lobby.playerCount,4);assert.equal(p.lobby.openSeats,3);assert.equal(server.messages.filter(m=>m.message.type==='game.begin').length,0);
 server.members.push('bob');const bob=make('bob'),guest=await bob.execute('join',{name:'Bob',inviteToken:'fixture-only'});
 assert.equal(guest.status,'waiting');assert.equal(guest.lobby.playerCount,4);assert.equal(guest.lobby.canStart,false);
 await assert.rejects(bob.execute('start',{roomId:server.channelId}),e=>e.code==='NOT_CREATOR');
 p=await alice.execute('start',{roomId:server.channelId});assert.equal(p.status,'playing');assert.equal(p.members.length,4);assert.equal(p.members.filter(m=>m.kind==='bot').length,2);assert.ok(p.members.filter(m=>m.kind==='bot').every(m=>m.level==='easy'&&!/^Bot \d/.test(m.name)));
 assert.deepEqual((await bob.refresh()).members,p.members);await alice.execute('start',{roomId:server.channelId});assert.equal(server.messages.filter(m=>m.message.type==='game.begin').length,1);
 server.members.push('carol');const late=await make('carol').execute('join',{name:'Carol',inviteToken:'fixture-only'});assert.equal(late.lobby.full,true);assert.equal(late.lobby.started,true);assert.equal(late.view,null);
});
test('host start uses fresh membership and a full four-human lobby adds no bots',async t=>{
 browserLocks(t);
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 const server=fakeRelay({members:['alice']}),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{identity:async()=>({user:{id}}),savedIdentity:()=>({user:{id}})}});
 const host=make('alice');await host.execute('create',{name:'Alice',playerCount:4});server.members.push('bob','carol','dave');
 const p=await host.execute('start',{roomId:server.channelId});assert.equal(p.members.length,4);assert.equal(p.members.filter(m=>m.kind==='bot').length,0);
 for(const id of ['bob','carol','dave']){const g=await make(id).execute('join',{name:id,inviteToken:'fixture-only'});assert.equal(g.status,'playing');assert.deepEqual(g.members,p.members);}
});
test('a fourth channel member cannot take a seat in a three-player game',async t=>{
 browserLocks(t);
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 const server=fakeRelay({members:['alice','bob','carol','dave']}),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{identity:async()=>({user:{id}}),savedIdentity:()=>({user:{id}})}});
 const host=make('alice');await host.execute('create',{name:'Alice',playerCount:3});const dave=make('dave');assert.equal((await dave.execute('join',{name:'Dave',inviteToken:'fixture-only'})).lobby.full,true);
 const p=await host.execute('start',{roomId:server.channelId});assert.equal(p.members.length,3);assert.equal(p.members.some(m=>m.id==='dave'),false);assert.equal((await dave.refresh()).lobby.started,true);
});

test('refreshing an empty installation needs no identity and never creates one',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js');let calls=0;
 const client=createOnlineGameClient({store:createMemoryStore(),auth:{savedIdentity:()=>null,identity:async()=>{calls++;throw Error('Identity must not be requested');}},transport:{request:()=>{throw Error('No network');}}});
 assert.equal(await client.refresh(),null);assert.equal(await client.refresh(),null);assert.equal((await client.inspect()).packet,null);assert.deepEqual(await client.games(),[]);assert.equal(calls,0);
});
test('a saved identity failure is preserved rather than treated as an empty installation',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js');const {PlayError}=await import('../../play/core/errors.js');
 const client=createOnlineGameClient({store:createMemoryStore(),auth:{savedIdentity:()=>{throw new PlayError('AUTH_REQUIRED','Unreadable saved identity');}},transport:{request:()=>{throw Error('No network');}}});
 await assert.rejects(client.refresh(),e=>e.code==='AUTH_REQUIRED');
});

test('an unchanged relay poll does not rewrite the full game checkpoint',async()=>{
 const h=harness();await h.alice.begin({start:0});let writes=0;const save=h.store.save;h.store.save=async r=>{writes++;return save(r);};
 const before=await h.alice.state();await h.alice.sync();assert.equal(writes,0);assert.deepEqual(await h.alice.state(),before);
 await h.bob.command({type:'ADD',amount:2});await h.alice.sync();assert.ok(writes>0);assert.equal((await h.alice.state()).game.state.value,2);
});
test('an online human placement returns committed state without a redundant catch-up',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js');const server=fakeRelay(),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id}}),identity:async()=>({user:{id}})}}),clients={alice:make('alice'),bob:make('bob')};
 await clients.alice.execute('create',{name:'Alice'});await clients.bob.execute('join',{name:'Bob',inviteToken:'fixture-only'});const started=await clients.alice.execute('start',{roomId:server.channelId});const client=clients[started.view.state.game.currentPlayerId],p=await client.refresh(),before=server.sent.length;
 const result=await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:p.view.choices[0]});
 assert.ok(result.ok);assert.equal(result.revision,p.revision+1);assert.equal(result.view.state.board.buildings.length,p.view.state.board.buildings.length+1);assert.ok(server.sent.length-before<=6,'A placement must not perform another poll after commit');
});

test('online UI budgets commit the human move before coordinator bot processing',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),{botDecision}=await import('../../play/catan/rules/index.js');
 const server=fakeRelay({members:['alice']}),client=createOnlineGameClient({store:createMemoryStore(),transport:server.transport(),auth:{savedIdentity:()=>({user:{id:'alice'}}),identity:async()=>({user:{id:'alice'}})}});
 await client.execute('create',{name:'Alice'},{botBudget:0});let p=await client.execute('start',{roomId:server.channelId},{botBudget:0});
 for(let i=0;i<80&&!p.view.choices.some(a=>a.type==='END_TURN');i++)p=p.botWorkPending?await client.refresh({botBudget:1}):await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')},{botBudget:0});
 assert.ok(p.view.choices.some(a=>a.type==='END_TURN'));const revision=p.revision,n=server.messages.length;
 p=await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:{type:'END_TURN'}},{botBudget:0});assert.equal(p.revision,revision+1);assert.equal(p.botWorkPending,true);assert.equal(server.messages.slice(n).filter(m=>m.message.type==='game.command').length,1);
 const next=await client.refresh({botBudget:1});assert.equal(next.revision,p.revision+1);
});

test('started-game polls reuse room metadata without skipping ordered message reads',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),server=fakeRelay(),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id}}),identity:async()=>({user:{id}})}}),a=make('alice'),b=make('bob');
 await a.execute('create',{name:'Alice'});await b.execute('join',{name:'Bob',inviteToken:'fixture-only'});await a.execute('start',{roomId:server.channelId});await b.refresh({botBudget:0});await a.refresh({botBudget:0});
 const n=server.sent.length;for(let i=0;i<3;i++)await a.refresh({botBudget:0});const ops=server.sent.slice(n).map(s=>s.body.op);
 assert.deepEqual(ops,['message.list','message.list','message.list']);assert.equal(a.capabilities.pollIntervalMs,2500);
});
test('a later channel participant refreshes cached membership without changing the fixed game seats',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),server=fakeRelay({members:['alice']}),store=createMemoryStore();
 const make=id=>createOnlineGameClient({store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id}}),identity:async()=>({user:{id}})}}),a=make('alice');
 await a.execute('create',{name:'Alice'},{botBudget:0});await a.execute('start',{roomId:server.channelId},{botBudget:0});server.members.push('bob');const b=make('bob');const late=await b.execute('join',{name:'Bob',inviteToken:'fixture-only'},{botBudget:0});assert.equal(late.lobby.full,true);
 const n=server.sent.length,result=await a.refresh({botBudget:0});assert.ok(result.view);assert.ok(!result.view.seats.some(s=>s.id==='bob'));assert.equal(server.sent.slice(n).filter(s=>s.body.op==='channel.read').length,1);
});
test('HTTP timing diagnostics contain only operation, duration, status and success',async()=>{
 let time=100;const samples=[],options={endpoint:'https://example.test/relay',identity:async()=>({user:{id:'alice'},access_token:'test-token'}),clock:()=>time,fetcher:async()=>{time+=120;return new Response(JSON.stringify({ok:true,protocolVersion:1,result:{}}),{status:200});}};
 const t=createRelayTransport({...options,onTiming:s=>samples.push(s)});await t.request({op:'message.list',channelId:'private-channel'},'alice');assert.deepEqual(samples,[{op:'message.list',ms:120,status:200,ok:true}]);
 const broken=createRelayTransport({...options,onTiming(){throw Error('Diagnostics failed');}});assert.equal((await broken.request({op:'message.list',channelId:'private-channel'},'alice')).ok,true);
});

test('backend Solo starts one human with bots, persists its mode and uses the ordinary relay after reopening',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js');
 for(const playerCount of [3,4]){const server=fakeRelay({members:['alice']}),store=createMemoryStore(),make=()=>createOnlineGameClient({store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id:'alice'}}),identity:async()=>({user:{id:'alice'}})}}),client=make();
  let p=await client.execute('create',{name:'Alice',mode:'solo-relay',playerCount,botLevel:'standard'},{botBudget:0});assert.equal(p.status,'playing');assert.equal(p.relaySolo,true);assert.equal(p.members.filter(m=>m.kind==='human').length,1);assert.equal(p.members.filter(m=>m.kind==='bot').length,playerCount-1);
  assert.equal((await make().inspect()).packet.relaySolo,true);assert.equal((await make().games())[0].mode,'solo-relay');
  for(let i=0;i<8&&!p.view.choices.length;i++)p=await client.refresh({botBudget:1});assert.ok(p.view.choices.length);
  const action=p.view.choices.find(c=>c.type==='PLACE_SETTLEMENT')||p.view.choices[0],next=await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action},{botBudget:0});assert.equal(next.ok,true,JSON.stringify({playerCount,actor:p.view.state.game.currentPlayerId,choices:p.view.choices.slice(0,2),next}));assert.equal(next.revision,p.revision+1);
  const append=server.sent.filter(x=>x.body.op==='message.append');assert.ok(append.some(x=>x.body.message.type==='game.begin'));assert.ok(append.some(x=>x.body.message.type==='game.command'));assert.equal((await make().refresh({botBudget:0})).revision,next.revision);
 }
});

test('backend Solo admission resumes the original intent after a lost response',async t=>{
 browserLocks(t);const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),server=fakeRelay({members:['alice']}),store=createMemoryStore(),make=()=>createOnlineGameClient({store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id:'alice'}}),identity:async()=>({user:{id:'alice'}})}});server.loseResponse();await assert.rejects(make().execute('create',{mode:'solo-relay',name:'Alice'},{botBudget:0}),e=>e.retryable);
 const p=await make().refresh({botBudget:0});assert.equal(p.relaySolo,true);assert.equal(p.status,'playing');assert.equal(p.members.filter(m=>m.kind==='human').length,1);assert.equal(server.sent.filter(x=>x.body.op==='channel.create').length,1);
 server.offline(true);await assert.rejects(make().refresh({botBudget:0}));assert.equal((await make().inspect()).packet.roomId,p.roomId);assert.equal((await make().inspect()).packet.relaySolo,true);
});

test('confirmed flat and echoed append results avoid two reads per move; opaque replies retain replay',async()=>{
 for(const appendReply of ['flat','echo','opaque']){
  const server=fakeRelay({appendReply}),store=createMemoryStore(),client=createRelayClient({principalId:'alice',...server,creatorId:'alice',module:counterModule('fixture-artifact'),store,locks:createLocks(),id,now,transport:server.transport()});
  await client.begin({start:0});const before=server.sent.length,result=await client.command({type:'ADD',amount:3});assert.equal(result.game.state.value,3);assert.equal(result.game.peerVerified.alice,1);assert.equal(result.outbox.length,0);
  const ops=server.sent.slice(before).map(x=>x.body.op);assert.equal(ops.filter(x=>x==='message.append').length,2);assert.equal(ops.filter(x=>x==='message.list').length,appendReply==='opaque'?3:1);
 }
});

test('a save failure after a confirmed append preserves the exact intent and retries it once',async()=>{
 const h=harness();await h.alice.begin({start:0});let failed=false;
 const flaky=h.client('alice',{store:{load:h.store.load,save:async r=>{if(!failed&&r.game?.revision===1){failed=true;throw new RelayError('STORAGE_FAILURE','Interrupted checkpoint');}return h.store.save(r);}}});
 await assert.rejects(flaky.command({type:'ADD',amount:7}),e=>e.code==='STORAGE_FAILURE');const pending=await h.store.load('alice',h.server.channelId),original=structuredClone(pending.outbox[0].request);assert.equal(pending.game.revision,0);
 const restored=await h.client('alice').sync();assert.equal(restored.game.state.value,7);assert.equal(restored.game.revision,1);assert.equal(restored.outbox.length,0);
 const attempts=h.server.sent.filter(x=>x.body.mutationId===original.mutationId);assert.equal(attempts.length,2);assert.deepEqual(attempts[0].body,attempts[1].body);assert.equal(h.server.messages.filter(x=>x.message.type==='game.command').length,1);
});

test('contradictory append metadata never commits state or drops the durable pending request',async()=>{
 for(const field of ['channelId','messageId','sequence']){
  const h=harness();await h.alice.begin({start:0});const transport=h.server.transport(),bad=h.client('alice',{transport:{request:async(body,p)=>{const reply=await transport.request(body,p);if(body.message?.type==='game.command')reply.result[field]=field==='sequence'?999:'wrong';return reply;}}});
  await assert.rejects(bad.command({type:'ADD',amount:4}),e=>e.code==='INVALID_RECEIPT');const pending=await h.store.load('alice',h.server.channelId);assert.equal(pending.game.revision,0);assert.ok(pending.outbox[0].request);const recovered=await h.alice.sync();assert.equal(recovered.game.state.value,4);assert.equal(recovered.game.revision,1);
 }
});

test('concurrent peer verification uses CAS catch-up without skipping a message',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.bob.sync();let once=true;const transport=h.server.transport(),racing=h.client('alice',{transport:{request:async(body,p)=>{const reply=await transport.request(body,p);if(once&&body.message?.type==='game.command'){once=false;await h.bob.sync();}return reply;}}});
 const result=await racing.command({type:'ADD',amount:2});assert.equal(result.game.state.value,2);assert.equal(result.halt,null);const peer=await h.bob.sync();assert.equal(result.game.hash,peer.game.hash);assert.equal(result.cursor<=h.server.messages.length,true);
});

test('an already-replayed duplicate receipt uses log catch-up and does not apply twice',async()=>{
 const h=harness();await h.alice.begin({start:0});await h.alice.command({type:'ADD',amount:5});
 const request=structuredClone(h.server.sent.find(x=>x.body.message?.type==='game.command').body),record=await h.store.load('alice',h.server.channelId),cursor=record.cursor;record.outbox.unshift({message:request.message,request});await h.store.save(record);
 const before=h.server.sent.length,result=await h.alice.sync();assert.equal(result.game.state.value,5);assert.equal(result.game.revision,1);assert.equal(result.outbox.length,0);assert.ok(result.cursor>=cursor);assert.ok(h.server.sent.slice(before).some(x=>x.body.op==='message.list'));
});

test('an altered full-message echo preserves pending delivery until the correct receipt is replayed',async()=>{
 const server=fakeRelay({appendReply:'echo'}),store=createMemoryStore(),module=counterModule('fixture-artifact'),locks=createLocks(),options={principalId:'alice',...server,creatorId:'alice',module,store,locks,id,now},transport=server.transport();const client=createRelayClient({...options,transport});await client.begin({start:0});
 const bad=createRelayClient({...options,transport:{request:async(body,p)=>{const reply=await transport.request(body,p);if(body.message?.type==='game.command')reply.result.message.message.payload.command.amount=999;return reply;}}});await assert.rejects(bad.command({type:'ADD',amount:2}),e=>e.code==='INVALID_RECEIPT');assert.equal((await store.load('alice',server.channelId)).game.revision,0);assert.equal((await client.sync()).game.state.value,2);
});
