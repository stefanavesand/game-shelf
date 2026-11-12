import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRows} from '../../scripts/bots/cohort-analysis.mjs';
function cohort(focal){return [41,73].flatMap(gameSeed=>Array.from({length:3},(_,rotation)=>({caseId:gameSeed+'-'+rotation,gameSeed,rotation,repeat:0,roster:'three',playerCount:3,profileIds:Array.from({length:3},(_,i)=>i===rotation?focal:'opponent'),profileHashes:Array.from({length:3},(_,i)=>i===rotation?focal:'unchanged'),status:'ended',winnerSeat:rotation,trace:[{actor:'p'+rotation,action:{type:'TRADE_OFFER'}}]})));}
test('paired seed-block intervals and full failure denominators are deterministic',()=>{
 const a=cohort('focal-trade'),b=cohort('focal-planner');for(const r of b)r.winnerSeat=(r.rotation+1)%3;
 a[0].status='failed';a[0].winnerSeat=null;
 const r=compareRows(a,b),s=r.strata[0];assert.equal(s.matches,6);assert.equal(s.candidate.wins,5);assert.equal(s.candidate.failures,1);assert.equal(s.candidate.winRate,5/6);assert.equal(s.candidate.offers,6);assert.equal(s.control.wins,0);assert.deepEqual(compareRows(a,b),r);assert.ok(s.exploratory95PercentileInterval.low<=s.winRateDifference);
});
test('missing, duplicate, incomplete and changed-opponent cases are rejected',()=>{
 const a=cohort('focal-trade'),b=cohort('focal-planner');assert.throws(()=>compareRows(a,b.slice(1)),/Case sets/);assert.throws(()=>compareRows([...a,a[0]],b),/Duplicate/);assert.throws(()=>compareRows(a.slice(1),b.slice(1)),/Incomplete/);
 const changed=structuredClone(b);changed[0].profileHashes[1]='different';assert.throws(()=>compareRows(a,changed),/Opponent/);
 const duplicate=structuredClone(a);duplicate[0].profileIds[1]='focal-trade';assert.throws(()=>compareRows(duplicate,b),/focal seat/);
});
test('checkpoint loader rejects corrupt and unexpected files',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path');
 const {plan}=await import('../../scripts/bots/experiments.mjs'),{hash}=await import('../../scripts/bots/profiles.mjs'),{loadRun}=await import('../../scripts/bots/cohort-analysis.mjs');
 const root=await mkdtemp(path.join(tmpdir(),'cohort-integrity-'));
 try{
  const profile={schemaVersion:1,id:'baseline',policyVersion:'heuristic-1.1.0',featureSchemaVersion:1,level:'standard',parameters:{}},profiles={baseline:profile};
  const manifest={id:'integrity',split:'train',gameSeeds:[41],repeats:1,rosters:[{id:'three',profiles:['baseline','baseline','baseline']}],maxActions:1,decisionSeed:37};
  const jobs=plan(manifest,profiles);await mkdir(path.join(root,'matches'));await writeFile(path.join(root,'experiment.json'),JSON.stringify({manifest,profiles}));
  for(const job of jobs){const row={matchId:job.id,jobHash:hash(job),caseId:job.caseId,gameSeed:job.gameSeed,roster:job.roster,rotation:job.rotation,repeat:job.repeat,profileIds:job.profiles,profileHashes:job.profiles.map(id=>hash(profiles[id]))};await writeFile(path.join(root,'matches',job.id+'.json'),JSON.stringify({result:row,checksum:hash(row)}));}
  assert.equal((await loadRun(root)).rows.length,3);
  await writeFile(path.join(root,'matches','unexpected.json'),'{}');await assert.rejects(()=>loadRun(root),/checkpoint set/);await rm(path.join(root,'matches','unexpected.json'));
  await writeFile(path.join(root,'matches',jobs[0].id+'.json'),JSON.stringify({result:{matchId:'corrupt'},checksum:'bad'}));await assert.rejects(()=>loadRun(root),/integrity/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('identical observed seed-block differences flag a degenerate interval rather than precision',()=>{
 const report=compareRows(cohort('focal-trade'),cohort('focal-planner')),s=report.strata[0];assert.equal(s.independentSeedBlocks,2);assert.equal(s.bootstrapDegenerate,true);assert.deepEqual(s.exploratory95PercentileInterval,{low:0,high:0});assert.match(s.uncertaintyWarning,/not evidence/);
 const custom=compareRows(cohort('experiment'),cohort('reference'),{candidateProfile:'experiment',controlProfile:'reference'});assert.equal(custom.strata[0].candidate.wins,6);
});
