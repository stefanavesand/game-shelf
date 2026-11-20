import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {observeThefts,privateThefts} from '../../play/core/private-events.js';
import {createActivity,mergeActivity,activityMarkup} from '../../play/presentation/activity.js';
import {createRelayClient} from '../../play/relay/client.js';
import {createMemoryStore} from '../../play/relay/store.js';
import {fakeRelay,createLocks} from '../relay/fake-relay.js';
const module=createCatanModule('theft-test');
function position(){
 let state=module.initialize(catanConfig(['a','b','c'].map(id=>({id,name:id})),{seed:37}),{gameId:'theft'});
 for(let i=0;i<12;i++){const actor=state.snapshot.state.game.currentPlayerId;state=module.apply(state,actor,{actor,action:botDecision(module.view(state,actor),'standard')},{},{coordinatorId:'a'});}
 const s=state.snapshot,victim=s.state.board.buildings.find(b=>b.playerId==='b');
 s.state.board.robberLocation=s.state.board.tiles.find(t=>getHexVertices(t.coord).some(v=>vertexKey(v)===vertexKey(victim.vertex))).coord;
 for(const player of s.state.players.players)for(const r of RESOURCES){s.state.game.bank[r]+=player.resources[r];player.resources[r]=0;}
 s.state.players.players.find(p=>p.id==='b').resources.wool=1;s.state.game.bank.wool--;
 Object.assign(s.state.game,{phase:'robber-steal',currentPlayerId:'a',lastRoll:{die1:2,die2:4,total:6}});s.revision=0;s.history=[];return state;
}
const command={actor:'a',action:{type:'STEAL_RESOURCE',victimId:'b'}};
test('only the two involved authorized views reveal the stolen type and the journal retains it',()=>{
 const before=position(),after=module.apply(before,'a',command,{},{coordinatorId:'a'}),db=new Map(),storage={getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,v)};
 for(const you of ['a','b','c']){
  const packet=state=>({ok:true,roomId:'transport-room',you,revision:state.snapshot.revision,view:module.view(state,you)}),old=packet(before),next=packet(after),observations=observeThefts([],old.view,next.view);
  assert.equal(observations.length,you==='c'?0:1);assert.deepEqual(observeThefts(observations,old.view,next.view),observations);
  const journal=createActivity({principal:()=>you,storage});journal.observe(old);journal.observe(next);const restored=createActivity({principal:()=>you,storage}).observe(next),html=activityMarkup(restored);
  if(you==='c'){assert.ok(!html.includes('Wool'));assert.deepEqual(privateThefts(next.view,observeThefts([],module.view(before,'b'),module.view(after,'b'))),[]);}else assert.match(html,you==='a'?/You stole[\s\S]*Wool/:/You lost[\s\S]*Wool/);
 }
 assert.ok(!JSON.stringify(after).includes('observations'));assert.ok(!JSON.stringify(module.view(after,'c').history).includes('privateThefts'));
});
test('batched relay catch-up persists private theft observations without transmitting them or changing hashes',async()=>{
 const server=fakeRelay({creator:'a',members:['a','b','c']}),store=createMemoryStore(),locks=createLocks(),start=position(),fixture={...module,initialize:()=>structuredClone(start)};let n=0;
 const client=id=>createRelayClient({principalId:id,...server,creatorId:'a',members:[...server.members],module:fixture,store,locks,id:()=>`theft-${++n}`,transport:server.transport(),observeRecord:(before,after)=>before.game&&after.game.revision===before.game.revision+1?observeThefts(before.observations,module.view(before.game.state,id),module.view(after.game.state,id)):before.observations});
 const a=client('a'),b=client('b'),c=client('c');await a.begin({});await b.sync();await c.sync();
 server.loseResponse();await assert.rejects(a.command(command));await a.sync();await a.command({actor:'a',action:{type:'END_TURN'}});
 const victim=await b.sync(),observer=await c.sync(),actor=await a.sync();assert.equal(victim.observations.length,1);assert.equal(victim.observations[0].direction,'lost');assert.equal(victim.observations[0].resource,'wool');assert.equal(observer.observations.length,0);assert.equal(actor.observations[0].direction,'gained');assert.equal(actor.game.hash,victim.game.hash);assert.equal(victim.game.hash,observer.game.hash);
 const again=await client('b').sync();assert.equal(again.observations.length,1);assert.ok(!JSON.stringify(server.messages).includes('observations'));assert.ok(!JSON.stringify(server.messages).includes('privateThefts'));
 // A reconnect can render the private entry even without a previous UI packet.
 const view={...module.view(victim.game.state,'b'),privateThefts:privateThefts(module.view(victim.game.state,'b'),victim.observations)};
 assert.match(activityMarkup(mergeActivity([],null,{view,revision:victim.game.revision})),/You lost[\s\S]*Wool/);
});
