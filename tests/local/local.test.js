import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalClient as createClient} from '../../play/local/client.js';
import {botDecision,eligibleActors} from '../../play/catan/rules/index.js';
import {recordedDice} from '../fixtures/recorded-dice.js';
const createLocalClient=options=>createClient({effects:recordedDice,...options});
let lib={schemaVersion:1,local:false,current:null,games:{}};const storage={load:async()=>structuredClone(lib),save:async v=>{lib=structuredClone(v);}},locks={request:(_key,work)=>work()};
test('a full local solo game saves every move and resumes with no network/auth',async()=>{
 let client=createLocalClient({storage,locks,seed:()=>2026});let packet=await client.execute('create',{name:'Solo',botLevel:'standard'}),steps=0;
 assert.equal(packet.members.filter(m=>m.kind==='bot').length,2);const roomId=packet.roomId;
 while(packet.status!=='ended'&&steps++<1500){
  if(packet.view.choices.length){const action=botDecision(packet.view,'standard');packet=await client.execute('command',{roomId,expectedRevision:packet.revision,action});}
  else packet=await client.refresh();assert.ok(packet.ok);
  if(steps===10){client=createLocalClient({storage,locks});const saved=await client.inspect();assert.equal(saved.packet.revision,packet.revision);packet=await client.refresh();}
 }
 assert.equal(packet.status,'ended');assert.equal((await client.inspect()).packet.status,'ended');assert.ok(steps<1500);
});
test('storage failure rejects creation before durable success',async()=>{const client=createLocalClient({storage:{load:async()=>({schemaVersion:1,games:{}}),save:async()=>{throw Error('quota');}},locks,seed:()=>1});await assert.rejects(client.execute('create',{name:'A'}));});
test('unfinished local games block incompatible engine updates',async()=>{const client=createLocalClient({storage,locks,seed:()=>7});await client.execute('create',{name:'A'});assert.equal(await client.canUpdate('different-engine'),false);const {CATAN_ARTIFACT}=await import('../../play/catan/artifact.js');assert.equal(await client.canUpdate(CATAN_ARTIFACT.compatibilityId),true);});

test('abandoning an unfinished game unpins updates and persists across reopening',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}};
 const store={load:async()=>structuredClone(data),save:async v=>{data=structuredClone(v);}};
 let client=createLocalClient({storage:store,locks,seed:()=>7});const game=await client.execute('create',{name:'A'});
 assert.equal(await client.canUpdate('next-engine'),false);await client.abandon(game.roomId);
 client=createLocalClient({storage:store,locks});assert.deepEqual(await client.games(),[]);assert.equal((await client.inspect()).packet,null);assert.equal(await client.resume(game.roomId),null);assert.equal(await client.canUpdate('next-engine'),true);
});
test('failed abandonment storage does not hide a game or unblock an incompatible update',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}},fail=false;
 const store={load:async()=>structuredClone(data),save:async v=>{if(fail)throw Error('quota');data=structuredClone(v);}};
 const client=createLocalClient({storage:store,locks,seed:()=>7}),game=await client.execute('create',{name:'A'});fail=true;
 await assert.rejects(client.abandon(game.roomId));assert.equal((await client.games()).length,1);assert.equal((await client.inspect()).packet.roomId,game.roomId);assert.equal(await client.canUpdate('next-engine'),false);
});
test('incompatible local games remain listed and can be abandoned without interpreting their engine',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}};const store={load:async()=>structuredClone(data),save:async v=>{data=structuredClone(v);}};
 const client=createLocalClient({storage:store,locks,seed:()=>7}),game=await client.execute('create',{name:'Old game'});data.games[game.roomId].artifact='old-engine';const snapshot=structuredClone(data.games[game.roomId].state);
 await assert.rejects(client.inspect(),/original engine/);const games=await client.games();assert.equal(games.length,1);assert.equal(games[0].compatible,false);await client.abandon(game.roomId);assert.deepEqual(data.games[game.roomId].state,snapshot);assert.deepEqual(await client.games(),[]);assert.equal((await client.inspect()).packet,null);
});
test('save compatibility uses the declared release identity rather than the source-byte digest',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}};const store={load:async()=>structuredClone(data),save:async v=>{data=structuredClone(v);}};
 const {CATAN_ARTIFACT}=await import('../../play/catan/artifact.js'),client=createLocalClient({storage:store,locks,seed:()=>7});const p=await client.execute('create',{name:'Compatible'});assert.equal(data.games[p.roomId].artifact,CATAN_ARTIFACT.compatibilityId);assert.equal((await createLocalClient({storage:store,locks}).inspect()).packet.roomId,p.roomId);assert.equal(await client.canUpdate(CATAN_ARTIFACT.compatibilityId),true);
});

test('four-player offline solo saves three named bots and restores its roster',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}};
 const storage={load:async()=>structuredClone(data),save:async v=>{data=structuredClone(v);}};
 const client=createLocalClient({storage,locks,seed:()=>2026});const p=await client.execute('create',{name:'Solo',playerCount:4,botLevel:'easy'});
 assert.equal(p.members.length,4);assert.equal(p.members.filter(m=>m.kind==='bot').length,3);assert.equal(new Set(p.members.map(m=>m.name)).size,4);
 assert.deepEqual((await createLocalClient({storage,locks}).inspect()).packet.members,p.members);assert.equal((await client.games())[0].playerCount,4);
});

test('a human move commits before bots, which resume one saved step at a time',async()=>{
 let data={schemaVersion:1,local:false,current:null,games:{}},writes=0;
 const storage={load:async()=>structuredClone(data),save:async v=>{writes++;data=structuredClone(v);}};
 let c=createLocalClient({storage,locks,seed:()=>2026}),p=await c.execute('create',{name:'Fast feedback'});
 for(let i=0;i<150&&!p.view.choices.some(a=>a.type==='END_TURN');i++)p=p.view.choices.length?await c.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')}):await c.refresh();
 assert.ok(p.view.choices.some(a=>a.type==='END_TURN'));const before=p.revision,prior=structuredClone(data);writes=0;
 p=await c.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:{type:'END_TURN'}},{botBudget:0});assert.equal(p.revision,before+1);assert.equal(writes,1);assert.equal(p.botWorkPending,true);
 c=createLocalClient({storage,locks});assert.equal((await c.inspect()).packet.revision,before+1);writes=0;const one=await c.refresh({botBudget:1});assert.equal(one.revision,before+2);assert.equal(writes,1);
 let baseline=prior;const batch=createLocalClient({storage:{load:async()=>structuredClone(baseline),save:async v=>{baseline=structuredClone(v);}},locks});const expected=await batch.execute('command',{roomId:p.roomId,expectedRevision:before,action:{type:'END_TURN'}});
 while((await c.inspect()).packet.revision<expected.revision)await c.refresh({botBudget:1});assert.deepEqual(data.games[p.roomId].state,baseline.games[p.roomId].state);
});
