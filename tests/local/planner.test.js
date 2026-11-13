import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePlanner} from '../../scripts/bots/prepare-runtime.mjs';
await preparePlanner();
const {profile,profileHash}=await import('../../play/bots/profile.js');
import {decision} from '../../scripts/bots/purchase-policy.mjs';
import {createLocalClient} from '../../play/local/client.js';
import {createPlannerRunner} from '../../play/bots/client.js';
import {validateMemory,PLANNER_POLICY} from '../../play/bots/contract.js';
import {botDecision} from '../../play/catan/rules/index.js';
const locks={request:(_key,f)=>f()},blank=()=>({schemaVersion:1,local:false,current:null,games:{}});
const planner={async decide(view,memory){validateMemory(memory,view,profileHash);const d=decision(view,profile.parameters,0,memory?.data||null);return {action:d.action,memory:{schemaVersion:1,policyVersion:PLANNER_POLICY,profileHash,gameId:view.id,actor:view.you,engineVersion:view.engineVersion,lastRevision:view.revision,data:d.memory}};}};
function fixture(options={}){let data=blank(),writes=0,fail=false;const storage={load:async()=>structuredClone(data),save:async d=>{if(fail)throw Error('quota');writes++;data=structuredClone(d);}};return {get data(){return data;},get writes(){return writes;},storage,fail:()=>{fail=true;},client:()=>createLocalClient({storage,planner,locks,seed:()=>37,id:()=> 'planner-local-test',...options})};}
async function humanStep(c,p){return p.view.choices.length?c.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')},{botBudget:0}):c.refresh({botBudget:1});}
test('full experimental Solo persists isolated plans, restores them and keeps packets private',async()=>{
 const f=fixture();let c=f.client(),p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0}),n=0,reopened=false;
 assert.equal(p.botPolicy,PLANNER_POLICY);assert.equal((await c.games())[0].botLevel,'planner');
 while(p.status!=='ended'&&n++<2000){p=await humanStep(c,p);assert.ok(p.ok);assert.equal(JSON.stringify(p).includes('goalKey'),false);
  if(!reopened&&Object.keys(f.data.games[p.roomId].botMemory).length===2){const before=structuredClone(f.data.games[p.roomId]);c=f.client();assert.equal((await c.inspect()).packet.revision,p.revision);assert.deepEqual(f.data.games[p.roomId].botMemory,before.botMemory);reopened=true;}
 }
 assert.equal(p.status,'ended');assert.ok(reopened);assert.ok(n<2000);const g=f.data.games[p.roomId];assert.deepEqual(Object.keys(g.botMemory).sort(),['bot:1','bot:2']);for(const [actor,m]of Object.entries(g.botMemory)){assert.equal(m.actor,actor);assert.equal(m.gameId,p.roomId);assert.equal(m.profileHash,profileHash);}
});
test('bot state and memory commit together; failed saves preserve both previous values',async()=>{
 const f=fixture();let c=f.client(),p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);assert.equal(p.botWorkPending,true);const before=structuredClone(f.data);f.fail();await assert.rejects(c.refresh({botBudget:1}),/quota/);assert.deepEqual(f.data,before);
});
test('worker failure preserves saved human move and retries the same observation and plan',async()=>{
 let fail=true;const failing={decide:async(v,m)=>{if(fail)throw Error('worker timeout');return planner.decide(v,m);}},f=fixture({planner:failing}),c=f.client();let p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);const before=structuredClone(f.data),revision=p.revision;await assert.rejects(c.refresh({botBudget:1}),/worker timeout/);assert.deepEqual(f.data,before);fail=false;p=await c.refresh({botBudget:1});assert.equal(p.revision,revision+1);
});
test('corrupt or cross-game plan memory is rejected rather than silently switching policy',async()=>{
 const f=fixture(),c=f.client();let p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);p=await c.refresh({botBudget:1});const bad=structuredClone(f.data);bad.games[p.roomId].botMemory['bot:1'].gameId='other';const broken=createLocalClient({storage:{load:async()=>structuredClone(bad),save:async()=>assert.fail('must not overwrite')},planner,locks});await assert.rejects(broken.inspect(),/saved bot plan/);
});
test('default Solo retains the old bot and never invokes the experimental runner',async()=>{
 const f=fixture({planner:{decide:()=>assert.fail('unexpected planner')}}),c=f.client();let p=await c.execute('create',{name:'Human'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);p=await c.refresh({botBudget:1});assert.equal(p.botPolicy,null);assert.equal(f.data.games[p.roomId].botMemory,undefined);
});
test('worker lifecycle rejects startup/timeout/invalid responses and always terminates',async()=>{
 const f=fixture(),c=f.client();let p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);const {createCatanModule}=await import('../../play/catan/module.js'),module=createCatanModule('probe'),state=f.data.games[p.roomId].state,actor=module.nextBot(state).actor,v=module.view(state,actor);
 for(const mode of ['timeout','error','invalid']){let terminated=0;const runner=createPlannerRunner({timeoutMs:10,workerFactory:()=>({terminate(){terminated++;},postMessage(){if(mode==='error')queueMicrotask(()=>this.onerror());if(mode==='invalid')queueMicrotask(()=>this.onmessage({data:{action:{type:'END_TURN'}}}));}})});await assert.rejects(runner.decide(v,null));assert.equal(terminated,1);}
 const runner=createPlannerRunner({workerFactory:()=>{throw Error('unavailable');}});await assert.rejects(runner.decide(v,null),/unavailable/);
});

test('the actual generated worker matches the tested policy and returns scoped memory',async()=>{
 const {Worker:Thread}=await import('node:worker_threads');
 const f=fixture(),c=f.client();let p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);
 const {createCatanModule}=await import('../../play/catan/module.js'),module=createCatanModule('probe'),state=f.data.games[p.roomId].state,actor=module.nextBot(state).actor,v=module.view(state,actor);
 const url=new URL('../../play/bots/worker.js',import.meta.url).href;let terminated=0;
 const runner=createPlannerRunner({workerFactory:()=>{const w=new Thread(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:d=>parentPort.postMessage(d)};const ready=import(${JSON.stringify(url)});parentPort.on('message',async d=>{await ready;self.onmessage({data:d});});`,{eval:true});const adapter={postMessage:d=>w.postMessage(d),terminate:()=>{terminated++;w.terminate();}};w.on('message',data=>adapter.onmessage?.({data}));w.on('error',()=>adapter.onerror?.());return adapter;}});
 const actual=await runner.decide(v,null),expected=await planner.decide(v,null);assert.deepEqual(actual,expected);assert.equal(terminated,1);validateMemory(actual.memory,v,profileHash);module.apply(state,'p1',{actor,action:actual.action},{},{coordinatorId:'p1'});
 const {profile:old,profileHash:oldHash}=await import('../../play/bots/legacy-profile.js'),{decision:oldDecision}=await import('../../scripts/bots/build-trade-components.mjs');
 const legacy=await runner.decide(v,null,'build-trade-0.2.0');assert.deepEqual(legacy.action,oldDecision(v,old.parameters,0).action);validateMemory(legacy.memory,v,oldHash,'build-trade-0.2.0');assert.deepEqual((await runner.decide(v,legacy.memory)).action,legacy.action);
 f.data.games[p.roomId].botPolicy='build-trade-0.2.0';assert.equal((await c.inspect()).packet.botPolicy,'build-trade-0.2.0');
});

test('an illegal worker proposal cannot commit either state or its new plan',async()=>{
 const bad={async decide(v,m){const d=await planner.decide(v,m);return {...d,action:{type:'NOT_A_CATAN_ACTION'}};}},f=fixture({planner:bad}),c=f.client();let p=await c.execute('create',{name:'Human',botLevel:'planner'},{botBudget:0});while(p.view.choices.length)p=await humanStep(c,p);const before=structuredClone(f.data);await assert.rejects(c.refresh({botBudget:1}));assert.deepEqual(f.data,before);
});
