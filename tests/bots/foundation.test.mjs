import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateProfile,template,hash,bytesHash,decide} from '../../scripts/bots/profiles.mjs';
import {botDecision as live} from '../../play/catan/rules/bot.js';
import {scenario} from '../fixtures/motion-scenarios.js';
import {plan,loadExperiment,simulate} from '../../scripts/bots/experiments.mjs';
import {runMatch} from '../../scripts/bots/match.mjs';
const baseline=validateProfile(template('baseline','heuristic-1.1.0'));
const candidate=validateProfile(template('candidate'));
const experiment=(workers=1,maxActions=10)=>({manifest:{schemaVersion:1,id:'test-foundation',split:'train',gameSeeds:[37],decisionSeed:71,repeats:1,workers,maxActions,matchTimeoutMs:60000,profiles:{baseline:'unused',candidate:'unused'},rosters:[{id:'three',profiles:['candidate','baseline','baseline']},{id:'four',profiles:['candidate','baseline','baseline','baseline']}]},profiles:{baseline,candidate}});
async function temp(fn){const dir=await mkdtemp(path.join(os.tmpdir(),'bot-tests-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('profiles reject ambiguous/inert/unsafe configuration and are immutable',()=>{
 const p=validateProfile(template());assert.ok(Object.isFrozen(p.parameters));assert.throws(()=>{p.parameters.roadBase=0;});
 for(const change of [p=>p.parameters.roadBase=NaN,p=>p.parameters.noiseAmplitude=-1,p=>p.parameters.unknown=1,p=>delete p.parameters.cityBase,p=>p.policyVersion='unknown',p=>p.unexpected=true]){const p=template();change(p);assert.throws(()=>validateProfile(p));}
 const invalidBaseline=template('baseline','heuristic-1.1.0');invalidBaseline.parameters.roadBase=5;assert.throws(()=>validateProfile(invalidBaseline));
 assert.equal(hash({b:1,a:2}),hash({a:2,b:1}));assert.notEqual(hash(template()),hash({...template(),parameters:{...template().parameters,roadBase:0}}));
});
test('frozen baseline is pinned and matches live decisions in both existing levels',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../scripts/bots/baselines/manifest.json',import.meta.url)));
 assert.equal(bytesHash(await readFile(new URL('../../scripts/bots/baselines/heuristic-1.1.0.js',import.meta.url))),manifest.snapshotSha256);
 const source=await readFile(new URL('../../play/catan/rules/bot.js',import.meta.url),'utf8');assert.equal(bytesHash(source),manifest.sourceSha256);
 for(const kind of ['roll','road','city','robber'])for(const level of ['easy','standard']){const v=scenario(kind).before.view,p=validateProfile({...template('baseline','heuristic-1.1.0'),level});assert.deepEqual(decide(v,p,1),live(v,level));}
});
test('parameter edits change an actual legal decision without mutating its observation',()=>{
 const v=scenario('city').before.view;v.choices=v.choices.filter(c=>['BUILD_CITY','BUY_DEVELOPMENT_CARD'].includes(c.type));assert.ok(v.choices.some(c=>c.type==='BUILD_CITY'));assert.ok(v.choices.some(c=>c.type==='BUY_DEVELOPMENT_CARD'));
 const before=structuredClone(v);assert.equal(decide(v,baseline,11).type,'BUILD_CITY');
 const p=template('candidate');p.parameters.cityBase=0;p.parameters.developmentBase=200;assert.equal(decide(v,validateProfile(p),11).type,'BUY_DEVELOPMENT_CARD');assert.deepEqual(v,before);
});
test('plans rotate every seat and do not depend on worker count or candidate weights',()=>{
 const a=experiment(1),b=experiment(4);const p=plan(a.manifest,a.profiles),q=plan(b.manifest,b.profiles);assert.equal(p.length,7);assert.deepEqual(p,q);
 const changed=structuredClone(a.profiles);changed.candidate.parameters.roadBase=1;const other=plan(a.manifest,changed);assert.deepEqual(p.map(j=>j.caseId),other.map(j=>j.caseId));assert.notDeepEqual(p.map(j=>j.id),other.map(j=>j.id));
 const enormous=experiment(1,2500);enormous.manifest.gameSeeds=Array.from({length:1000},(_,i)=>i+1);assert.throws(()=>plan(enormous.manifest,enormous.profiles),/hard cap/);
});
test('headless ordinary-rule game replays exactly; action caps remain failures',{timeout:30000},()=>{
 const e=experiment(1,2500),job=plan(e.manifest,e.profiles)[0],input={job,profiles:job.profiles.map(id=>e.profiles[id]),maxActions:2500,decisionSeed:71};
 const a=runMatch(input),b=runMatch(input);assert.equal(a.status,'ended');assert.equal(a.traceHash,b.traceHash);assert.equal(a.finalStateHash,b.finalStateHash);assert.deepEqual(a.trace,b.trace);
 const capped=runMatch({...input,maxActions:1});assert.equal(capped.status,'failed');assert.equal(capped.reason,'ACTION_CAP');assert.equal(capped.winnerSeat,null);
});
test('parallel scheduling, interrupted resume and report output preserve the same matches',{timeout:30000},()=>temp(async dir=>{
 const sequential=path.join(dir,'sequential'),parallel=path.join(dir,'parallel'),e=experiment();
 const a=await simulate(e,sequential);assert.equal(a.matches,7);assert.equal(a.failed,7);
 const controller=new AbortController();await simulate(experiment(2),parallel,{signal:controller.signal,onProgress:()=>controller.abort()});
 const resumed=await simulate(experiment(2),parallel,{resume:true});assert.equal(resumed.matches,7);
 const load=async out=>(await readFile(path.join(out,'matches.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).map(r=>[r.matchId,r.traceHash,r.finalStateHash]);assert.deepEqual(await load(sequential),await load(parallel));
 await simulate(experiment(3),parallel,{resume:true});assert.equal((await readdir(path.join(parallel,'matches'))).filter(s=>s.endsWith('.json')).length,7);
 assert.match(await readFile(path.join(parallel,'report.html'),'utf8'),/Descriptive screening/);
 const file=path.join(parallel,'matches',(await readdir(path.join(parallel,'matches'))).find(s=>s.endsWith('.json'))),corrupt=JSON.parse(await readFile(file,'utf8'));corrupt.result.status='ended';await writeFile(file,JSON.stringify(corrupt));await assert.rejects(()=>simulate(experiment(),parallel,{resume:true}),/Corrupt checkpoint/);
}));
test('strict manifest validation rejects duplicate seeds and unknown settings',()=>temp(async dir=>{
 await writeFile(path.join(dir,'baseline.json'),JSON.stringify(baseline));await writeFile(path.join(dir,'candidate.json'),JSON.stringify(candidate));const e=experiment();e.manifest.profiles={baseline:'baseline.json',candidate:'candidate.json'};
 const file=path.join(dir,'experiment.json');await writeFile(file,JSON.stringify(e.manifest));assert.equal((await loadExperiment(file)).profiles.baseline.id,'baseline');
 e.manifest.gameSeeds=[1,1];await writeFile(file,JSON.stringify(e.manifest));await assert.rejects(()=>loadExperiment(file),/duplicate game seeds/);
 e.manifest.gameSeeds=[37];e.manifest.secretState=true;await writeFile(file,JSON.stringify(e.manifest));await assert.rejects(()=>loadExperiment(file),/Invalid keys/);
}));

test('an output lock prevents concurrent writers without removing the owner lock',()=>temp(async dir=>{
 const lock=path.join(dir,'.lock');await writeFile(lock,'existing owner');await assert.rejects(()=>simulate(experiment(),dir),{code:'EEXIST'});assert.equal(await readFile(lock,'utf8'),'existing owner');
}));
