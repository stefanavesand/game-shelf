import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision} from '../../play/catan/rules/index.js';
import {robberPlacements} from '../../play/catan/rules/turn.js';
import {getHexVertices,vertexKey} from '../../play/catan/rules/geometry.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),humans=[0,1,2].map(i=>({id:'p'+i,name:'Seat '+i}));
function prepared(friendlyRobber=true){let s=module.initialize(catanConfig(humans,{seed:37,friendlyRobber}),{gameId:'options'});while(s.snapshot.state.game.phase.startsWith('setup')){const actor=s.snapshot.state.game.currentPlayerId;s=module.apply(s,actor,{actor,action:botDecision(module.view(s,actor),'standard')},{},{coordinatorId:'p0'});}Object.assign(s.snapshot.state.game,{phase:'robber-move',currentPlayerId:'p0',turn:10});return s;}
const has=(choices,hex)=>choices.some(h=>h.q===hex.q&&h.r===hex.r);
function target(s){return s.snapshot.state.board.tiles.find(t=>{const corners=new Set(getHexVertices(t.coord).map(vertexKey)),bs=s.snapshot.state.board.buildings.filter(b=>corners.has(vertexKey(b.vertex)));return t.terrain!=='desert'&&bs.some(b=>b.playerId==='p1')&&!bs.some(b=>b.playerId==='p2');}).coord;}
test('Friendly protects two visible VP, ignores private VP and normal rules permit the same tile',()=>{
 const s=prepared(),hex=target(s),g=s.snapshot.state;assert.equal(has(robberPlacements(g,'p0'),hex),false);
 g.players.players[1].developmentCards.push({id:'private-vp',type:'victoryPoint',isPlayed:false,turnBought:0});assert.equal(has(robberPlacements(g,'p0'),hex),false);
 assert.throws(()=>module.apply(s,'p0',{actor:'p0',action:{type:'MOVE_ROBBER',hex}},{},{coordinatorId:'p0'}),/Friendly robber/);
 g.board.buildings.find(b=>b.playerId==='p1').type='city';assert.equal(has(robberPlacements(g,'p0'),hex),true);
 const normal=prepared(false);assert.equal(has(robberPlacements(normal.snapshot.state,'p0'),hex),true);
});
test('Knight movement obeys the same friendly placement rule',()=>{
 let s=prepared(),hex=target(s);s.snapshot.state.game.phase='main';const me=s.snapshot.state.players.players[0],i=s.snapshot.deck.indexOf('knight');s.snapshot.deck.splice(i,1);s.snapshot.state.game.developmentDeckCount--;me.developmentCards.push({id:'knight-test',type:'knight',isPlayed:false,turnBought:0});
 s=module.apply(s,'p0',{actor:'p0',action:{type:'PLAY_KNIGHT',hex:s.snapshot.state.board.robberLocation}},{},{coordinatorId:'p0'});assert.equal(s.snapshot.state.game.phase,'robber-move');assert.ok(!module.view(s,'p0').choices.some(a=>a.type==='MOVE_ROBBER'&&has([a.hex],hex)));
});
test('all three levels and the robber flag survive validated lobby and initialization',()=>{
 for(const level of ['easy','standard','hard'])for(const friendlyRobber of [true,false]){const lobby=module.validateLobby({playerCount:3,level,seed:37,friendlyRobber}),config=catanConfig([humans[0]],lobby),s=module.initialize(config,{gameId:'options-'+level});assert.equal(s.snapshot.state.game.settings.friendlyRobber,friendlyRobber);assert.equal(s.snapshot.seats[1].level,level);}
 assert.throws(()=>module.validateLobby({playerCount:3,level:'standard',seed:37,friendlyRobber:'yes'}));assert.throws(()=>catanConfig([humans[0]],{seed:37,level:'planner'}));
});

test('online Hard/Friendly configuration and host-only strategic memory survive reopening',async()=>{
 const {createOnlineGameClient}=await import('../../play/relay/game-client.js'),{createMemoryStore,emptyRecord}=await import('../../play/relay/store.js'),{fakeRelay,createLocks}=await import('../relay/fake-relay.js');
 const server=fakeRelay(),store=createMemoryStore(),locks=createLocks(),room=server.channelId;
 for(const id of ['alice','bob'])await store.save({...emptyRecord(id,'@index'),current:room,rooms:{[room]:{creatorId:'alice',members:[{playerId:'alice'},{playerId:'bob'}],botLevel:'hard',playerCount:3,seed:37,friendlyRobber:true,manualStart:true}}});
 const client=id=>createOnlineGameClient({locks,store,transport:server.transport(),auth:{savedIdentity:()=>({user:{id}}),identity:async()=>({user:{id}})}});
 let host=client('alice');const guest=client('bob');await host.refresh({botBudget:0});let h=await host.execute('start',{roomId:room},{botBudget:0});
 for(let i=0;i<20;i++){const a=await host.refresh({botBudget:0}),b=await guest.refresh({botBudget:0});if(a.botWorkPending){h=await host.refresh({botBudget:1});break;}const current=a.view.choices.length?[host,a]:[guest,b];assert.ok(current[1].view.choices.length);await current[0].execute('command',{roomId:room,expectedRevision:current[1].revision,action:botDecision(current[1].view,'standard')},{botBudget:0});}
 const peer=await guest.refresh({botBudget:0});assert.equal(peer.view.state.game.settings.friendlyRobber,true);assert.equal(peer.members.find(s=>s.kind==='bot').level,'hard');assert.equal(JSON.stringify(peer).includes('goalKey'),false);
 const before=(await store.load('alice','@index')).rooms[room].botMemory;assert.ok(Object.keys(before).length);const {profileHash}=await import('../../play/bots/hard-profile.js');assert.equal(Object.values(before)[0].profileHash,profileHash);
 host=client('alice');const restored=await host.refresh({botBudget:0});assert.equal(restored.revision,h.revision);assert.deepEqual((await store.load('alice','@index')).rooms[room].botMemory,before);assert.equal((await store.load('bob','@index')).rooms[room].botMemory,undefined);
});
