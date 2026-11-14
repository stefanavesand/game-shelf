import test from 'node:test';
import assert from 'node:assert/strict';
import {secureInteger,randomEffects} from '../../play/core/random-effects.js';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {botDecision} from '../../play/catan/rules/index.js';
import {createRelayClient} from '../../play/relay/client.js';
import {applyMessage} from '../../play/relay/replica.js';
import {createMemoryStore} from '../../play/relay/store.js';
import {digest} from '../../play/relay/protocol.js';
import {fakeRelay,createLocks} from '../relay/fake-relay.js';
const real=createCatanModule('random-test'),command={actor:'bob',action:{type:'ROLL_DICE'}};
function position(mode='host-random-v1'){
 let state=real.initialize(catanConfig([{id:'alice',name:'Alice'},{id:'bob',name:'Bob'}],{seed:37,...(mode?{diceMode:mode}:{})}),{gameId:'random-game'});
 for(let i=0;i<12;i++){const actor=state.snapshot.state.game.currentPlayerId,action=botDecision(real.view(state,actor),'standard');state=real.apply(state,actor.startsWith('bot:')?'alice':actor,{actor,action},{},{coordinatorId:'alice'});}
 Object.assign(state.snapshot.state.game,{currentPlayerId:'bob',phase:'roll',lastRoll:null});return state;
}
function harness(){
 const server=fakeRelay(),store=createMemoryStore(),locks=createLocks(),initial=position(),module={...real,initialize:()=>structuredClone(initial)};let ids=0,draws=0,loseResolution=false;
 const client=principalId=>createRelayClient({principalId,...server,creatorId:'alice',module,store,locks,id:()=>`random-${++ids}`,createEffects:(s,c)=>{draws++;return {dice:[2,6]};},transport:{async request(body,p){if(loseResolution&&body.message?.type==='game.resolve'){loseResolution=false;server.loseResponse();}return server.transport().request(body,p);}}});
 return {server,store,module,client,alice:client('alice'),bob:client('bob'),get draws(){return draws;},lose:()=>{loseResolution=true;}};
}
test('secure bounded integers reject the uneven tail and map accepted values evenly',()=>{
 const values=[0xffffffff,0xfffffffc,5],crypto={getRandomValues:a=>{a[0]=values.shift();return a;}};assert.equal(secureInteger(6,crypto),5);assert.equal(values.length,0);
 const counts=Array(6).fill(0);for(let i=0;i<6000;i++)counts[secureInteger(6,{getRandomValues:a=>{a[0]=i;return a;}})]++;assert.deepEqual(counts,Array(6).fill(1000));assert.throws(()=>secureInteger(0));
 const s=position(),before=structuredClone(s),c={getRandomValues:a=>{a[0]=4;return a;}};assert.deepEqual(randomEffects(s,command,c),{dice:[5,5]});assert.deepEqual(s,before);assert.deepEqual(randomEffects(s,{action:{type:'END_TURN'}},c),{});
});
test('recorded dice replay deterministically without advancing seeded entropy; effects are strict',()=>{
 const state=position(),a=real.apply(state,'bob',command,{dice:[2,6]},{coordinatorId:'alice'}),b=real.apply(structuredClone(state),'bob',command,{dice:[2,6]},{coordinatorId:'alice'});assert.deepEqual(a,b);assert.deepEqual(a.entropy,state.entropy);assert.deepEqual(a.snapshot.state.game.lastRoll,{die1:2,die2:6,total:8});assert.deepEqual(a.snapshot.history.at(-1).dice,[2,6]);
 for(const effects of [{},{dice:[0,6]},{dice:[1,7]},{dice:[1.1,3]},{dice:[1]},{dice:[2,3],extra:true}])assert.throws(()=>real.apply(state,'bob',command,effects,{coordinatorId:'alice'}));
 const old=position(null);assert.deepEqual(randomEffects(old,command),{});assert.ok(real.apply(old,'bob',command,{},{coordinatorId:'alice'}));assert.throws(()=>real.apply(old,'bob',command,{dice:[2,6]},{coordinatorId:'alice'}));
});
test('guest requests once, host records once, both reproduce the same hash and reconnect without draws',async()=>{
 const h=harness();await h.alice.begin({});await h.bob.sync();const requested=await h.bob.command(command);assert.equal(requested.game.revision,0);assert.equal(h.draws,0);await h.bob.command(command);assert.equal(h.server.messages.filter(x=>x.message.type==='game.propose').length,1);
 const host=await h.alice.sync(),guest=await h.bob.sync();assert.equal(h.draws,1);assert.equal(host.game.revision,1);assert.equal(host.game.hash,guest.game.hash);assert.equal(await digest(host.game.state),guest.game.hash);assert.deepEqual(guest.game.state.snapshot.state.game.lastRoll,{die1:2,die2:6,total:8});
 await h.client('alice').sync();await h.client('bob').sync();assert.equal(h.draws,1);
 const request=h.server.messages.find(x=>x.message.type==='game.propose'),dup={...request,sequence:guest.cursor+1};const again=await applyMessage(guest,dup,{module:h.module,creatorId:'alice',members:h.server.members});assert.equal(again.record.game.revision,1);
});
test('lost host acknowledgment persists exact result and retries without rerolling',async()=>{
 const h=harness();await h.alice.begin({});await h.bob.sync();await h.bob.command(command);h.lose();await assert.rejects(h.alice.sync(),e=>e.retryable);assert.equal(h.draws,1);
 const pending=(await h.store.load('alice',h.server.channelId)).outbox.find(x=>x.message.type==='game.resolve');assert.deepEqual(pending.message.payload.effects,{dice:[2,6]});assert.ok(pending.request);
 const host=await h.client('alice').sync(),guest=await h.bob.sync();assert.equal(h.draws,1);assert.equal(host.game.hash,guest.game.hash);assert.equal(host.game.revision,1);assert.equal(h.server.messages.filter(x=>x.message.type==='game.resolve').length,1);
});
test('forged or malformed resolutions cannot commit a roll',async()=>{
 const h=harness();await h.alice.begin({});await h.bob.sync();await h.bob.command(command);await h.alice.sync();const guest=await h.bob.sync(),result=h.server.messages.find(x=>x.message.type==='game.resolve');
 await assert.rejects(applyMessage(guest,{...result,senderId:'bob',sequence:guest.cursor+1},{module:h.module,creatorId:'alice',members:h.server.members}));
 const fresh=harness();await fresh.alice.begin({});await fresh.bob.sync();await fresh.bob.command(command);const record=await fresh.store.load('bob',fresh.server.channelId),tampered=structuredClone(result);tampered.message.payload.effects={dice:[9,6]};tampered.sequence=record.cursor+1;const bad=await applyMessage(record,tampered,{module:fresh.module,creatorId:'alice',members:fresh.server.members});assert.equal(bad.record.halt.code,'DESYNC_DETECTED');assert.equal(bad.record.game.revision,0);
});

test('a lost guest acknowledgment retries the same request without sampling',async()=>{
 const h=harness();await h.alice.begin({});await h.bob.sync();h.server.loseResponse();await assert.rejects(h.bob.command(command),e=>e.retryable);await h.client('bob').sync();assert.equal(h.draws,0);assert.equal(h.server.messages.filter(x=>x.message.type==='game.propose').length,1);await h.alice.sync();await h.bob.sync();assert.equal(h.draws,1);
});
test('local save and reload retain the roll; an old revision cannot reroll',async()=>{
 const {createLocalClient}=await import('../../play/local/client.js');let data={schemaVersion:1,current:null,games:{},local:false},draws=0;
 const storage={load:async()=>structuredClone(data),save:async d=>{data=structuredClone(d);}},options={storage,locks:createLocks(),id:()=> 'local-crypto',seed:()=>37,effects:(s,c)=>{if(c.action.type==='ROLL_DICE'){draws++;return {dice:[3,5]};}return {};}};
 let client=createLocalClient(options),p=await client.execute('create',{name:'Local'},{botBudget:0});const g=data.games[p.roomId];Object.assign(g.state.snapshot.state.game,{phase:'roll',currentPlayerId:'p1',lastRoll:null});g.hash=await digest(g.state);
 const args={roomId:p.roomId,expectedRevision:p.revision,action:{type:'ROLL_DICE'}};p=await client.execute('command',args,{botBudget:0});assert.equal(draws,1);assert.deepEqual(p.view.state.game.lastRoll,{die1:3,die2:5,total:8});assert.equal((await client.execute('command',args,{botBudget:0})).ok,false);assert.equal(draws,1);
 client=createLocalClient(options);const restored=(await client.inspect()).packet;assert.equal(restored.revision,p.revision);assert.deepEqual(restored.view.state.game.lastRoll,p.view.state.game.lastRoll);assert.deepEqual(restored.view.history.at(-1).dice,[3,5]);
});
test('presentation ignores the request and animates only the confirmed result once',async()=>{
 const {describeMove}=await import('../../play/presentation/move-events.js'),state=position(),before={ok:true,roomId:'random-game',you:'bob',revision:state.snapshot.revision,view:real.view(state,'bob')},request={...structuredClone(before),pendingRandom:true};assert.equal(describeMove(before,request),null);
 const next=real.apply(state,'bob',command,{dice:[2,6]},{coordinatorId:'alice'}),after={...before,revision:next.snapshot.revision,view:real.view(next,'bob')};assert.deepEqual(describeMove(request,after).rolled,{die1:2,die2:6,total:8});assert.equal(describeMove(after,after),null);assert.equal(describeMove(null,after),null);
});
