import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '../../play/core/client.js';
import {PlayError,retryDelay} from '../../play/core/errors.js';
import {createTransport} from '../../play/core/transport.js';
import {validatePacket,validateSaved} from '../../play/core/protocol.js';
import {center,vertexPoint,edgePoints} from '../../play/board.js';
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/main-view.json',import.meta.url)));
const roomId=fixtures.p1.roomId,id='8c47a6a0-6b07-44cc-854b-3eb6e0346ef3';
function harness({pending=null,request,failSave=false}={}){
  let state={schemaVersion:1,roomId:pending?roomId:null,pending},clock=1000,tail=Promise.resolve();const cache=new Map(),sent=[];
  const locks={request(_name,work){const result=tail.then(work);tail=result.catch(()=>{});return result;}};
  const store={state:async()=>structuredClone(state),save:async next=>{if(failSave)throw new PlayError('STORAGE_FAILURE','Storage denied');state=structuredClone(next);},cache:async(packet,principal)=>cache.set(principal,packet),cached:async(_room,principal)=>cache.get(principal)};
  const transport={identity:async()=>({user:{id:'principal'}}),savedIdentity:()=>({user:{id:'principal'}}),request:async(body,principal)=>{sent.push(structuredClone(body));return request?request(body,principal,structuredClone(state)):structuredClone(fixtures.p1);}};
  const client=createClient({store,transport,locks,now:()=>clock,id:()=>id,sample:()=>.5});
  return {client,store,transport,locks,sent,get state(){return state;},advance:()=>{clock+=60000;}};
}
test('persist intent before send and retry the exact UUID/payload after a lost response',async()=>{
  let lost=true;const h=harness({request:async(body,_principal,saved)=>{if(body.op==='create'){assert.deepEqual(saved.pending.body,body);if(lost){lost=false;throw new PlayError('NETWORK_UNAVAILABLE','lost',{retryable:true});}}return structuredClone(fixtures.p1);}});
  await assert.rejects(h.client.execute('create',{name:'Alice',botLevel:'standard'}),e=>e.retryable);
  assert.equal(h.state.pending.body.commandId,id);const before=structuredClone(h.state.pending);h.advance();await h.client.refresh();
  assert.deepEqual(h.sent[0],h.sent[1]);assert.deepEqual(before.body,h.sent[1]);assert.equal(h.state.pending,null);assert.equal(h.state.roomId,roomId);
});
test('a failed intent save prevents any network mutation',async()=>{
  const h=harness({failSave:true});await assert.rejects(h.client.execute('create',{name:'Alice'}),e=>e.code==='STORAGE_FAILURE');assert.equal(h.sent.length,0);
});
test('unsupported replies retain the original intent and do not replace identity',async()=>{
  const h=harness({request:async()=>{validatePacket({apiVersion:99,ok:true});}});
  await assert.rejects(h.client.execute('create',{name:'Alice'}),e=>e.code==='UNSUPPORTED_VERSION');assert.equal(h.state.pending.principalId,'principal');assert.equal(h.state.pending.body.commandId,id);
});
test('a changed identity cannot replay another principal’s intent',async()=>{
  const h=harness({pending:{principalId:'original',body:{apiVersion:1,op:'command',commandId:id,roomId,expectedRevision:1,action:{type:'END_TURN'}}}});
  await assert.rejects(h.client.execute(),e=>e.code==='AUTH_REQUIRED');assert.equal(h.sent.length,0);assert.equal(h.state.pending.principalId,'original');
});
test('two concurrent resolvers share one effective request through the compatibility lock',async()=>{
  const pending={principalId:'principal',body:{apiVersion:1,op:'command',commandId:id,roomId,expectedRevision:1,action:{type:'END_TURN'}}};
  const h=harness({pending});const other=createClient({store:h.store,transport:h.transport,locks:h.locks});
  await Promise.all([h.client.execute(),other.execute()]);assert.equal(h.sent.length,1);assert.equal(h.state.pending,null);
});
test('an existing table requires an explicit room-switch decision',async()=>{
  const h=harness();await h.store.save({schemaVersion:1,roomId,pending:null});await assert.rejects(h.client.execute('create',{name:'Alice'}),e=>e.code==='ROOM_SWITCH');assert.equal(h.sent.length,0);
});
test('protocol rejects future saves and accidental disclosure of an opponent hand',()=>{
  assert.throws(()=>validateSaved({schemaVersion:2,roomId,pending:null}),e=>e.code==='UNSUPPORTED_VERSION');
  const packet=structuredClone(fixtures.p1);assert.equal(validatePacket(packet),packet);packet.view.state.players.players.find(p=>p.id!=='p1').resources.ore=1;
  assert.throws(()=>validatePacket(packet),e=>e.code==='UNSUPPORTED_VERSION');
});
test('wire-coordinate adapter matches standard v1 vertex and edge projections',()=>{
  assert.deepEqual(center({q:0,r:0},1),{x:0,y:0});assert.deepEqual(vertexPoint({hex:{q:0,r:0},direction:'N'},1),{x:0,y:-1});
  const expected={NE:[[0,-1],[Math.sqrt(3)/2,-.5]],E:[[Math.sqrt(3)/2,-.5],[Math.sqrt(3)/2,.5]],SE:[[Math.sqrt(3)/2,.5],[0,1]]};
  for(const direction of ['NE','E','SE']){const actual=edgePoints({hex:{q:0,r:0},direction},1);for(const [i,p]of actual.entries()){assert.ok(Math.abs(p.x-expected[direction][i][0])<1e-10);assert.ok(Math.abs(p.y-expected[direction][i][1])<1e-10);}}
});
test('Retry-After respects seconds and HTTP date formats',()=>{assert.equal(retryDelay('12',0),12000);assert.equal(retryDelay('Mon, 02 Nov 2026 10:00:12 GMT',Date.parse('2026-11-02T10:00:00Z')),12000);});

test('token refresh failure preserves the old identity and never falls back to signup',async()=>{
  const original={user:{id:'same-principal'},access_token:'old',refresh_token:'refresh',expires_at:1};let saved=JSON.stringify(original);const requests=[];
  const transport=createTransport({local:{getItem:()=>saved,setItem:(_key,value)=>{saved=value;}},locks:{request:(_name,work)=>work()},now:()=>100000,fetcher:async url=>{requests.push(url);throw Error('offline');}});
  await assert.rejects(transport.identity(),e=>e.retryable);assert.equal(saved,JSON.stringify(original));assert.equal(requests.length,1);assert.ok(requests[0].includes('grant_type=refresh_token'));assert.ok(!requests[0].includes('signup'));
});
test('a refresh response cannot silently change the principal',async()=>{
  const original={user:{id:'original'},access_token:'old',refresh_token:'refresh',expires_at:1};let saved=JSON.stringify(original);
  const transport=createTransport({local:{getItem:()=>saved,setItem:(_key,value)=>{saved=value;}},locks:{request:(_name,work)=>work()},now:()=>100000,fetcher:async()=>new Response(JSON.stringify({user:{id:'another'},access_token:'new',refresh_token:'different',expires_in:3600}))});
  await assert.rejects(transport.identity(),e=>e.code==='AUTH_REQUIRED');assert.equal(saved,JSON.stringify(original));
});
test('authentication rate limits persist a cooldown even before a room exists',async()=>{
  const h=harness();h.transport.identity=async()=>{throw new PlayError('RATE_LIMITED','Wait',{retryable:true,retryAfterMs:12000});};
  await assert.rejects(h.client.execute('create',{name:'Alice'}),e=>e.code==='RATE_LIMITED');assert.ok(h.state.retryAt>=13000);assert.equal(h.state.pending,null);assert.equal(h.sent.length,0);
});

test('resume opens a selected old game by authorized view without creating or joining a seat',async()=>{
  const older='1b70d78a-0aba-4ccf-b640-ecdc63095dea',h=harness({request:async body=>{const p=structuredClone(fixtures.p1);p.roomId=body.roomId;p.view.id=body.roomId;return p;}});
  await h.store.save({schemaVersion:1,roomId,pending:null});await h.client.resume(older);assert.equal(h.state.roomId,older);assert.deepEqual(h.sent,[{apiVersion:1,op:'view',roomId:older}]);assert.equal(h.state.pending,null);
});
test('resume preserves the active room on guest denial or a mismatched response',async()=>{
  const older='1b70d78a-0aba-4ccf-b640-ecdc63095dea',h=harness({request:async()=>({ok:false,apiVersion:1,error:{code:'room_not_found',message:'Unavailable'}})});
  await h.store.save({schemaVersion:1,roomId,pending:null});assert.equal((await h.client.resume(older)).ok,false);assert.equal(h.state.roomId,roomId);
  h.transport.request=async()=>structuredClone(fixtures.p1);await assert.rejects(h.client.resume(older),e=>e.code==='UNSUPPORTED_VERSION');assert.equal(h.state.roomId,roomId);
});
test('an unresolved move blocks a game switch and remains unchanged',async()=>{
  const pending={principalId:'principal',body:{apiVersion:1,op:'command',commandId:id,roomId,expectedRevision:1,action:{type:'END_TURN'}}},h=harness({pending});
  await assert.rejects(h.client.resume('1b70d78a-0aba-4ccf-b640-ecdc63095dea'),e=>e.code==='ROOM_SWITCH');assert.deepEqual(h.state.pending,pending);assert.equal(h.sent.length,0);
});
