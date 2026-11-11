import {readFile,readdir,mkdir,rename,writeFile,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker} from 'node:worker_threads';
import {hash,canonical,keys,integer,validateProfile,bytesHash} from './profiles.mjs';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
async function sourceCommit(){
 let git=path.join(root,'.git');
 try{const pointer=await readFile(git,'utf8');if(!pointer.startsWith('gitdir: '))throw Error('Invalid git directory');git=path.resolve(root,pointer.slice(8).trim());}catch(error){if(error.code!=='EISDIR')throw error;}
 const head=(await readFile(path.join(git,'HEAD'),'utf8')).trim();
 if(/^[a-f0-9]{40}$/.test(head))return head;
 if(!head.startsWith('ref: refs/'))throw Error('Unsupported git HEAD');
 const ref=head.slice(5);try{return (await readFile(path.join(git,ref),'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;}
 const packed=await readFile(path.join(git,'packed-refs'),'utf8');const entry=packed.split('\n').find(line=>line.endsWith(' '+ref));if(!entry)throw Error('Missing git reference');return entry.split(' ')[0];
}
export async function fingerprint(){
 const files=['scripts/bots/profiles.mjs','scripts/bots/match.mjs','scripts/bots/worker.mjs','scripts/bots/experiments.mjs','scripts/bots/parameter-policy.js','scripts/bots/baselines/heuristic-1.1.0.js'];
 const digests=await Promise.all(files.map(async p=>[p,bytesHash(await readFile(path.join(root,p)))]));
 return {rules:CATAN_ARTIFACT.digest,compatibility:CATAN_ARTIFACT.compatibilityId,code:hash(Object.fromEntries(digests)),node:process.version,commit:await sourceCommit()};
}
export async function loadExperiment(filename){
 const manifest=JSON.parse(await readFile(filename,'utf8'));
 keys(manifest,['schemaVersion','id','split','gameSeeds','decisionSeed','repeats','workers','maxActions','matchTimeoutMs','profiles','rosters'],'manifest');
 if(manifest.schemaVersion!==1||typeof manifest.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(manifest.id)||!['train','validation','test'].includes(manifest.split))throw Error('Invalid experiment identity');
 integer(manifest.decisionSeed,1,0xffffffff,'decisionSeed');integer(manifest.repeats,1,10,'repeats');integer(manifest.workers,1,4,'workers');integer(manifest.maxActions,1,10000,'maxActions');integer(manifest.matchTimeoutMs,1000,120000,'matchTimeoutMs');
 if(!Array.isArray(manifest.gameSeeds)||!manifest.gameSeeds.length||manifest.gameSeeds.length>1000||new Set(manifest.gameSeeds).size!==manifest.gameSeeds.length)throw Error('Invalid/duplicate game seeds');manifest.gameSeeds.forEach(s=>integer(s,1,0xffffffff,'game seed'));
 if(!manifest.profiles||Array.isArray(manifest.profiles)||typeof manifest.profiles!=='object'||!Object.keys(manifest.profiles).length||Object.keys(manifest.profiles).length>32)throw Error('Invalid profiles');
 const profiles={};for(const [id,p]of Object.entries(manifest.profiles)){if(typeof p!=='string')throw Error('Profile path required');const profile=validateProfile(JSON.parse(await readFile(path.resolve(path.dirname(filename),p),'utf8')));if(profile.id!==id)throw Error('Profile ID/path mismatch');profiles[id]=profile;}
 if(!Array.isArray(manifest.rosters)||!manifest.rosters.length||manifest.rosters.length>32)throw Error('Invalid rosters');const rosterIds=new Set();
 for(const roster of manifest.rosters){keys(roster,['id','profiles'],'roster');if(typeof roster.id!=='string'||!roster.id.length||rosterIds.has(roster.id)||!Array.isArray(roster.profiles)||![3,4].includes(roster.profiles.length)||roster.profiles.some(p=>!Object.hasOwn(profiles,p)))throw Error('Invalid/duplicate roster');rosterIds.add(roster.id);}
 return {manifest,profiles};
}
export function plan(manifest,profiles){
 const expected=manifest.rosters.reduce((n,r)=>n+r.profiles.length,0)*manifest.gameSeeds.length*manifest.repeats;
 if(expected>10000||expected*manifest.maxActions>2000000)throw Error('Experiment exceeds the 10,000-match / 2,000,000-command-slot hard cap; split into smaller batches');
 const jobs=[];
 for(const roster of manifest.rosters)for(const gameSeed of manifest.gameSeeds)for(let rotation=0;rotation<roster.profiles.length;rotation++)for(let repeat=0;repeat<manifest.repeats;repeat++){
  const ordered=roster.profiles.map((_,i)=>roster.profiles[(i+rotation)%roster.profiles.length]);
  // Keep game identity independent of candidate weights, worker count and completion order.
  const caseId=hash({experiment:manifest.id,split:manifest.split,roster:roster.id,playerCount:ordered.length,gameSeed,rotation,repeat}).slice(0,24);
  const core={caseId,roster:roster.id,gameSeed,rotation,repeat,profiles:ordered};
  jobs.push({...core,id:hash({core,profileHashes:ordered.map(id=>hash(profiles[id])),decisionSeed:manifest.decisionSeed,maxActions:manifest.maxActions})});
 }
 if(jobs.length>10000||jobs.length*manifest.maxActions>2000000)throw Error('Experiment exceeds the 10,000-match / 2,000,000-command-slot hard cap; split into smaller batches');return jobs;
}
async function atomic(file,value){const temp=file+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,file);}
function percentile(values,p){if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];}
export function summary(results){
 const groups=new Map();
 for(const result of results)for(let seat=0;seat<result.playerCount;seat++){
  const key=canonical([result.roster,result.playerCount,result.profileHashes[seat]]);
  if(!groups.has(key))groups.set(key,{roster:result.roster,playerCount:result.playerCount,profile:result.profileIds[seat],profileHash:result.profileHashes[seat],appearances:0,wins:0,failures:0,times:[]});
  const g=groups.get(key);g.appearances++;g.wins+=Number(result.winnerSeat===seat&&result.status==='ended');g.failures+=Number(result.status!=='ended');g.times.push(...result.timings.filter(t=>t.seat===seat).map(t=>t.ms));
 }
 return {schemaVersion:1,matches:results.length,ended:results.filter(r=>r.status==='ended').length,failed:results.filter(r=>r.status!=='ended').length,note:'Descriptive screening only; no confidence intervals or calibrated difficulty claims. Rotations/seats are correlated.',groups:[...groups.values()].map(({times,...g})=>({...g,winRate:g.wins/g.appearances,equalPolicyReference:1/g.playerCount,decisionMs:{samples:times.length,p50:percentile(times,.5),p95:percentile(times,.95),max:times.length?times.reduce((max,n)=>Math.max(max,n),0):null}}))};
}
function escape(text){return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
export async function writeReports(out,results){
 const report=summary(results);await atomic(path.join(out,'summary.json'),report);
 const fields=['roster','playerCount','profile','profileHash','appearances','wins','failures','winRate','equalPolicyReference'];
 await writeFile(path.join(out,'summary.csv'),[fields.join(','),...report.groups.map(g=>fields.map(k=>'"'+String(g[k]).replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
 await writeFile(path.join(out,'report.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Bot experiment report</title><h1>Bot experiment report</h1><p>'+escape(report.note)+'</p><pre>'+escape(JSON.stringify(report,null,2))+'</pre></html>');return report;
}
function execute(payload,timeoutMs,signal){return new Promise(resolve=>{
 const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:payload,resourceLimits:{maxOldGenerationSizeMb:128}});let settled=false;
 const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();resolve(result);};
 const failure=reason=>({schemaVersion:1,matchId:payload.job.id,jobHash:hash(payload.job),caseId:payload.job.caseId,gameSeed:payload.job.gameSeed,rotation:payload.job.rotation,repeat:payload.job.repeat,decisionSeed:payload.decisionSeed,status:'failed',reason,winnerSeat:null,playerCount:payload.profiles.length,roster:payload.job.roster,profileIds:payload.profiles.map(p=>p.id),profileHashes:payload.profiles.map(hash),steps:0,counts:{},trace:[],traceHash:hash([]),finalStateHash:null,timings:[],elapsedMs:null});
 const timer=setTimeout(()=>finish(failure('MATCH_WATCHDOG')),timeoutMs);
 const abort=()=>finish(null);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
 worker.once('message',finish);worker.once('error',error=>finish(failure('WORKER_ERROR: '+String(error.message).slice(0,200))));worker.once('exit',()=>{if(!settled)finish(failure('WORKER_EXIT'));});
});}
async function simulateUnlocked({manifest,profiles},out,{resume=false,signal,onProgress=()=>{}}={}){
 const jobs=plan(manifest,profiles),identity=await fingerprint();
 const {workers,...deterministicManifest}=manifest;
 const metadata={schemaVersion:1,identity,manifest:deterministicManifest,profiles,planHash:hash(jobs)};
 await mkdir(out,{recursive:true});const metadataFile=path.join(out,'experiment.json');const entries=(await readdir(out)).filter(name=>name!=='.lock');
 if(resume){const prior=JSON.parse(await readFile(metadataFile,'utf8'));if(canonical(prior)!==canonical(metadata))throw Error('Resume fingerprint/configuration mismatch');}
 else {if(entries.length)throw Error('Output directory must be empty; use --resume');await atomic(metadataFile,metadata);}
 const folder=path.join(out,'matches');await mkdir(folder,{recursive:true});const existing=new Set(await readdir(folder)),results=[];const pending=[];
 const allowed=new Set(jobs.map(j=>j.id+'.json'));if([...existing].some(f=>f.endsWith('.json')&&!allowed.has(f)))throw Error('Unknown checkpoint match');
 for(const job of jobs){if(existing.has(job.id+'.json')){const envelope=JSON.parse(await readFile(path.join(folder,job.id+'.json'),'utf8')),r=envelope.result;if(envelope.checksum!==hash(r)||r.matchId!==job.id||r.jobHash!==hash(job)||!['ended','failed'].includes(r.status)||r.traceHash!==hash(r.trace))throw Error('Corrupt checkpoint: '+job.id);results.push(r);}else pending.push(job);}
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(workers,pending.length)},async()=>{while(cursor<pending.length&&!signal?.aborted){const job=pending[cursor++],result=await execute({job,profiles:job.profiles.map(id=>profiles[id]),maxActions:manifest.maxActions,decisionSeed:manifest.decisionSeed},manifest.matchTimeoutMs,signal);if(!result)break;await atomic(path.join(folder,job.id+'.json'),{checksum:hash(result),result});results.push(result);onProgress(results.length,jobs.length);}}));
 results.sort((a,b)=>a.matchId.localeCompare(b.matchId));
 await writeFile(path.join(out,'matches.jsonl'),results.map(r=>JSON.stringify(r)).join('\n')+(results.length?'\n':''));
 const report=await writeReports(out,results);return {...report,expectedMatches:jobs.length,interrupted:!!signal?.aborted,workers};
}

export async function simulate(experiment,out,options={}){
 await mkdir(out,{recursive:true});const lockPath=path.join(out,'.lock');
 const lock=await open(lockPath,'wx');
 try{await lock.writeFile(JSON.stringify({pid:process.pid,started:new Date().toISOString()}));return await simulateUnlocked(experiment,out,options);}
 finally{await lock.close();await unlink(lockPath);}
}
