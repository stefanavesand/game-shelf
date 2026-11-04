import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalClient} from '../../play/local/client.js';
import {botDecision,eligibleActors} from '../../play/catan/rules/index.js';
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
test('unfinished local games block incompatible engine updates',async()=>{const client=createLocalClient({storage,locks,seed:()=>7});await client.execute('create',{name:'A'});assert.equal(await client.canUpdate('different-engine'),false);const {CATAN_ARTIFACT}=await import('../../play/catan/artifact.js');assert.equal(await client.canUpdate(CATAN_ARTIFACT.digest),true);});
