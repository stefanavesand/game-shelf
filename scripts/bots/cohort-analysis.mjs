// Original descriptive seed-block analysis, not a difficulty promotion test.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical,hash,bytesHash} from './profiles.mjs';
import {plan} from './experiments.mjs';
const requireCondition=(ok,message)=>{if(!ok)throw Error(message);};
export async function loadRun(directory){
 const meta=JSON.parse(await readFile(path.join(directory,'experiment.json'),'utf8'));
 const jobs=plan(meta.manifest,meta.profiles),names=(await readdir(path.join(directory,'matches'))).sort();
 requireCondition(canonical(names)===canonical(jobs.map(j=>j.id+'.json').sort()),'Run must contain exactly the complete planned checkpoint set');
 const rows=[];
 for(const job of jobs){
  const envelope=JSON.parse(await readFile(path.join(directory,'matches',job.id+'.json'),'utf8')),row=envelope.result;
  requireCondition(envelope.checksum===hash(row)&&row.jobHash===hash(job)&&row.matchId===job.id,'Checkpoint integrity mismatch');
  requireCondition(row.caseId===job.caseId&&row.gameSeed===job.gameSeed&&row.roster===job.roster&&row.rotation===job.rotation&&row.repeat===job.repeat,'Checkpoint assignment mismatch');
  requireCondition(canonical(row.profileIds)===canonical(job.profiles)&&canonical(row.profileHashes)===canonical(job.profiles.map(id=>hash(meta.profiles[id]))),'Checkpoint profile mismatch');
  rows.push(row);
 }
 return {meta,rows};
}
function index(rows,focal){
 const result=new Map();
 for(const row of rows){
  requireCondition(!result.has(row.caseId),'Duplicate case ID');
  requireCondition(row.repeat===0&&[3,4].includes(row.playerCount)&&row.profileIds.length===row.playerCount&&row.profileHashes.length===row.playerCount,'Only single-repeat 3/4-seat cohorts are supported');
  requireCondition(row.profileIds.filter(p=>p===focal).length===1,'Exactly one focal seat required');
  requireCondition(row.status==='ended'||row.status==='failed','Unknown result status');
  requireCondition(row.status!=='ended'||Number.isInteger(row.winnerSeat)&&row.winnerSeat>=0&&row.winnerSeat<row.playerCount,'Terminal result needs a winner');
  result.set(row.caseId,row);
 }
 return result;
}
function bootstrap(blocks,resamples,seed){
 let state=seed>>>0;const values=[];
 for(let i=0;i<resamples;i++){
  let total=0;for(let j=0;j<blocks.length;j++){state=(Math.imul(state,1664525)+1013904223)>>>0;total+=blocks[Math.floor(state/4294967296*blocks.length)];}
  values.push(total/blocks.length);
 }
 values.sort((a,b)=>a-b);return {low:values[Math.floor(values.length*.025)],high:values[Math.min(values.length-1,Math.floor(values.length*.975))]};
}
export function compareRows(candidateRows,controlRows,{candidateProfile='focal-trade',controlProfile='focal-planner',resamples=4000,seed=92831}={}){
 requireCondition(Number.isInteger(resamples)&&resamples>=100&&resamples<=100000&&Number.isInteger(seed)&&seed>0&&seed<=0xffffffff,'Invalid bootstrap budget/seed');
 const a=index(candidateRows,candidateProfile),b=index(controlRows,controlProfile);
 requireCondition(a.size>0&&canonical([...a.keys()].sort())===canonical([...b.keys()].sort()),'Case sets differ');
 const groups=new Map();
 for(const [id,row] of a){
  const other=b.get(id),seat=row.profileIds.indexOf(candidateProfile),otherSeat=other.profileIds.indexOf(controlProfile);
  for(const k of ['gameSeed','roster','rotation','playerCount'])requireCondition(row[k]===other[k],'Case assignment differs');
  requireCondition(seat===otherSeat,'Focal seat differs');
  for(let i=0;i<row.playerCount;i++)if(i!==seat)requireCondition(row.profileHashes[i]===other.profileHashes[i],'Opponent profile differs');
  const key=row.roster;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({row,other,seat});
 }
 const strata=[];
 for(const [roster,pairs] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const playerCount=pairs[0].row.playerCount,seeds=[...new Set(pairs.map(p=>p.row.gameSeed))].sort((a,b)=>a-b),blocks=[];
  const counts={candidate:{wins:0,failures:0,offers:0,accepts:0,declines:0},control:{wins:0,failures:0,offers:0,accepts:0,declines:0}};
  for(const gameSeed of seeds){
   const block=pairs.filter(p=>p.row.gameSeed===gameSeed);
   requireCondition(block.length===playerCount&&new Set(block.map(p=>p.row.rotation)).size===playerCount&&block.every(p=>p.row.rotation>=0&&p.row.rotation<playerCount)&&new Set(block.map(p=>p.seat)).size===playerCount,'Incomplete seed/seat rotation block');
   let delta=0;
   for(const pair of block)for(const [name,row] of [['candidate',pair.row],['control',pair.other]]){
    const win=Number(row.status==='ended'&&row.winnerSeat===pair.seat);counts[name].wins+=win;counts[name].failures+=Number(row.status==='failed');delta+=(name==='candidate'?1:-1)*win;
    for(const command of row.trace||[])if(command.actor==='p'+pair.seat){const key={TRADE_OFFER:'offers',TRADE_ACCEPT:'accepts',TRADE_DECLINE:'declines'}[command.action.type];if(key)counts[name][key]++;}
   }
   blocks.push(delta/playerCount);
  }
  const matches=pairs.length;for(const c of Object.values(counts))c.winRate=c.wins/matches;
  strata.push({roster,playerCount,seeds,matches,independentSeedBlocks:seeds.length,bootstrapDegenerate:blocks.every(value=>value===blocks[0]),uncertaintyWarning:blocks.every(value=>value===blocks[0])?'No observed block variation; a zero-width bootstrap interval is not evidence of a precise population effect.':seeds.length<20?'Few independent seed blocks; percentile intervals are exploratory.':null,...counts,winRateDifference:counts.candidate.winRate-counts.control.winRate,exploratory95PercentileInterval:bootstrap(blocks,resamples,seed),resamples});
 }
 return {schemaVersion:1,note:'Descriptive screening. Percentile bootstrap resamples paired whole game-seed blocks within each stratum. No multiplicity correction, locked test or difficulty promotion. Failures remain in denominators.',candidateProfile,controlProfile,bootstrapSeed:seed,strata};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  if(![5,7].includes(process.argv.length))throw Error('Usage: node scripts/bots/cohort-analysis.mjs candidate-run control-run output.json [candidate-profile control-profile]');
  const [candidate,control]=await Promise.all(process.argv.slice(2,4).map(loadRun));
  requireCondition(canonical(candidate.meta.identity)===canonical(control.meta.identity),'Source/runtime identities differ');
  const options=process.argv.length===7?{candidateProfile:process.argv[5],controlProfile:process.argv[6]}:{};
  const report={...compareRows(candidate.rows,control.rows,options),analysisSourceSha256:bytesHash(await readFile(new URL(import.meta.url))),identity:candidate.meta.identity,manifests:{candidate:candidate.meta.manifest,control:control.meta.manifest}};
  await writeFile(process.argv[4],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.strata,null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
