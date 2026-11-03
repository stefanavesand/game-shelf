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
