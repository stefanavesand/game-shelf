// Synthetic host benchmark of the exact shipped profile and real worker entrypoint.
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {Worker as Thread} from 'node:worker_threads';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {preparePlanner} from './prepare-runtime.mjs';
import {hash,bytesHash,validateProfile,decideWithMemory} from './profiles.mjs';
import {fingerprint} from './experiments.mjs';
import {createLocalClient} from '../../play/local/client.js';
import {createPlannerRunner} from '../../play/bots/client.js';
import {botDecision} from '../../play/catan/rules/index.js';
const root=new URL('../../',import.meta.url),fixed=JSON.parse(await readFile(new URL('experiments/bots/counter-on.json',root),'utf8')),profile=validateProfile(fixed),baseline=validateProfile(JSON.parse(await readFile(new URL('experiments/bots/baseline-standard.json',root),'utf8')));
const selected=d=>({action:d.action,memory:d.memory});
const stats=values=>{const s=[...values].sort((a,b)=>a-b);return {samples:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],max:s.at(-1)};};
async function fixtures(){
 const out=[];
 for(const playerCount of [3,4]){const captured=new Map();
  for(const seed of [37,91]){let data={schemaVersion:1,local:false,current:null,games:{}};
   const planner={async decide(view,memory){const d=decideWithMemory(view,profile,0,memory),phase=view.state.game.phase,hand=Object.values(view.state.players.players.find(p=>p.id===view.you).resources).reduce((a,b)=>a+b,0);
    const category=phase.startsWith('setup')?'setup':view.offer&&view.offer.from!==view.you&&view.choices.some(a=>a.type==='TRADE_ACCEPT')?'offer-affordable':phase==='discard'?'discard':phase==='main'&&view.state.game.turn<12?'main-early':phase==='main'&&view.state.game.turn>=30?'main-late':null;
    const rank=category==='discard'?hand:category==='offer-affordable'?Number(!!d.action.replaces)*100+view.choices.length:view.choices.length;
    if(category&&(!captured.has(category)||rank>captured.get(category).rank))captured.set(category,{id:playerCount+'-'+category,rank,view:structuredClone(view),memory:structuredClone(memory),expected:selected(d)});
    return d;}};
   const c=createLocalClient({planner,storage:{load:async()=>structuredClone(data),save:async v=>{data=structuredClone(v);}},locks:{request:(_key,f)=>f()},seed:()=>seed,id:()=>`shipped-runtime-${playerCount}-${seed}`});
   let p=await c.execute('create',{name:'Synthetic human',botLevel:'planner',playerCount},{botBudget:0}),steps=0;
   while(p.status!=='ended'&&steps++<2500){p=p.view.choices.length?await c.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')},{botBudget:1}):await c.refresh({botBudget:1});if(!p.ok)throw Error('Synthetic fixture command failed');}
   if(p.status!=='ended')throw Error('Synthetic fixture game hit action cap');
   if(captured.size===5)break;
  }
  if(captured.size!==5)throw Error('Missing runtime fixture categories: '+playerCount);
  out.push(...[...captured.values()].sort((a,b)=>a.id.localeCompare(b.id)));
 }
 return out;
}
function threadFactory(){const url=new URL('../../play/bots/worker.js',import.meta.url).href;
 const w=new Thread(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:d=>parentPort.postMessage(d)};const ready=import(${JSON.stringify(url)});parentPort.on('message',async d=>{await ready;self.onmessage({data:d});});`,{eval:true});
 const adapter={postMessage:d=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>adapter.onmessage?.({data}));w.on('error',()=>adapter.onerror?.());return adapter;
}
export async function benchmark({rounds=7}={}){
 if(!Number.isInteger(rounds)||rounds<1||rounds>20)throw Error('Invalid runtime benchmark rounds');
 await preparePlanner(fileURLToPath(root));const shipped=await import('../../play/bots/profile.js');if(hash(shipped.profile)!==hash(profile)||shipped.profileHash!==hash(profile))throw Error('The shipped profile differs from the benchmark');
 const positions=await fixtures(),runner=createPlannerRunner({workerFactory:threadFactory}),samples=[];
 const expectedBaseline=new Map(positions.map(f=>[f.id,hash(selected(decideWithMemory(f.view,baseline,0,null)))]));
 for(let round=-1;round<rounds;round++)for(const f of positions){
  const order=round%2?['planner-controller','standard-controller']:['standard-controller','planner-controller'];
  for(const policy of order){const start=performance.now(),result=selected(decideWithMemory(f.view,policy==='planner-controller'?profile:baseline,0,policy==='planner-controller'?f.memory:null)),ms=performance.now()-start;
   if(hash(result)!==(policy==='planner-controller'?hash(f.expected):expectedBaseline.get(f.id)))throw Error('Controller parity failed: '+f.id);if(round>=0)samples.push({round,fixture:f.id,policy,ms});}
  const start=performance.now(),result=await runner.decide(f.view,f.memory),ms=performance.now()-start;
  if(hash(selected(result))!==hash(f.expected))throw Error('Runtime worker parity failed: '+f.id);if(round>=0)samples.push({round,fixture:f.id,policy:'planner-fresh-worker',ms});
 }
 const sourceHashes={};for(const name of ['client.js','contract.js','worker.js','profile.js','policies/planner-policy.js','policies/resource-policy.js','policies/trade-policy.js','policies/shared-plan-policy.js','policies/build-trade-policy.js','policies/build-trade-components.js','policies/baselines/heuristic-1.1.0.js'])sourceHashes[name]=bytesHash(await readFile(new URL('play/bots/'+name,root)));
 return {schemaVersion:1,sourceIdentity:await fingerprint(),benchmarkSourceSha256:bytesHash(await readFile(new URL(import.meta.url))),release:JSON.parse(await readFile(new URL('release.json',root),'utf8')).version,profileHash:hash(profile),policyVersion:profile.policyVersion,fixtureHash:hash(positions),host:{platform:process.platform,arch:process.arch,node:process.version},warmupRounds:1,measuredRounds:rounds,parity:true,memory:{measured:false,reason:'No incremental heap/device memory measurement.'},note:'Synthetic authorized Solo observations, including retained per-seat plan envelopes. Controllers clone/freeze observations; timing is host wall time, not CPU cycles. Fresh-worker timing uses the real shipped worker via a Node worker-thread shim including startup/import/postMessage overhead, not browser/Safari or physical iPad latency. Repeated fixtures are not independent positions or worst-case bounds. Frozen Standard is a controller baseline, not worker startup.',runtimeSourceHashes:sourceHashes,fixtures:positions.map(f=>({id:f.id,phase:f.view.state.game.phase,turn:f.view.state.game.turn,choices:f.view.choices.length,handCards:Object.values(f.view.state.players.players.find(p=>p.id===f.view.you).resources).reduce((a,b)=>a+b,0),selectedAction:f.expected.action.type,hasRetainedGoal:!!f.memory?.data.goalKey})),statistics:Object.fromEntries(['standard-controller','planner-controller','planner-fresh-worker'].map(policy=>[policy,stats(samples.filter(s=>s.policy===policy).map(s=>s.ms))])),samples};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Usage: node scripts/bots/shipped-runtime-benchmark.mjs output.json');const report=await benchmark();await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({profileHash:report.profileHash,fixtures:report.fixtures,statistics:report.statistics},null,2));}catch(error){console.error(error);process.exitCode=1;}}
