// Explicit, reproducible diagnostic assets. Never copy arbitrary experiment files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {eligibleActors} from '../../play/catan/rules/index.js';
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {decision} from './trade-policy.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepareBotBenchmark(root){
 const base='diagnostics/bots/',files=['index.html','app.js','worker.js','style.css'].map(p=>base+p),hashes={};
 for(const name of ['trade-policy.mjs','planner-policy.mjs','baselines/heuristic-1.1.0.js']){
  const source=await readFile(path.join(root,'scripts/bots',name),'utf8');hashes[name]=digest(source);
  // Preserve layout/import depth and the frozen baseline's MIT notice.
  const target=base+'policies/'+name.replace(/\.mjs$/,'.js');
  const output=source.replace(/(from\s+['"][^'"]+)\.mjs(['"])/g,'$1.js$2').replaceAll('../../play/','../../../play/');
  await mkdir(path.dirname(path.join(root,target)),{recursive:true});await writeFile(path.join(root,target),output);files.push(target);
 }
 const profile=JSON.parse(await readFile(path.join(root,'experiments/bots/trade-default.json'),'utf8'));
 const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),fixtures=[];
 for(const count of [3,4]){
  const humans=Array.from({length:count},(_,i)=>({id:'p'+i,name:'Synthetic '+(i+1)}));
  let state=module.initialize(catanConfig(humans,{playerCount:count,seed:37}),{gameId:'device-benchmark-'+count});
  const categories=new Set();
  for(let step=0;step<1600&&state.snapshot.state.game.phase!=='ended';step++){
   const actor=eligibleActors(state.snapshot)[0],view=module.view(state,actor),turn=view.state.game.turn;
   const category=view.offer?'offer':view.state.game.phase==='main'?(turn<10?'early':turn<30?'middle':'late'):null;
   if(category&&!categories.has(category)){
    const seed=37;fixtures.push({id:count+'-'+category,view,seed,expected:{candidate:JSON.stringify(decision(structuredClone(view),profile.parameters,seed)),baseline:JSON.stringify({action:baseline(structuredClone(view),'standard')})}});categories.add(category);
   }
   state=module.apply(state,actor,{actor,action:baseline(view,'standard')},{},{coordinatorId:'p0'});
   if(categories.size===4)break;
  }
  if(categories.size!==4)throw Error('Missing synthetic benchmark categories for '+count+' seats');
 }
 const fixtureHash=digest(JSON.stringify(fixtures)),metadata={schemaVersion:1,fixtureHash,policyHashes:hashes,profileHash:digest(JSON.stringify(profile)),rulesDigest:CATAN_ARTIFACT.digest,profile};
 const target=base+'fixtures.js';await writeFile(path.join(root,target),'// Generated synthetic authorized observations; no real accounts or saves.\nexport const metadata='+JSON.stringify(metadata)+';\nexport const fixtures='+JSON.stringify(fixtures)+';\n');files.push(target);
 return files;
}
