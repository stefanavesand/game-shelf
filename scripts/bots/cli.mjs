import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {canonical,hash,template,validateProfile,registry,plannerRegistry,tradeRegistry,resourceRegistry,resourceComponentRegistry,sharedPlanRegistry,buildTradeRegistry,buildTradeComponentRegistry} from './profiles.mjs';
import {loadExperiment,plan,simulate,fingerprint} from './experiments.mjs';
import {runMatch} from './match.mjs';
const args=process.argv.slice(2),command=args.shift();
function options(args){const result={};while(args.length){const k=args.shift();if(!['--manifest','--out','--resume','--dry-run','--match'].includes(k)||Object.hasOwn(result,k))throw Error('Unknown/duplicate option: '+k);if(['--resume','--dry-run'].includes(k))result[k]=true;else{const value=args.shift();if(!value||value.startsWith('--'))throw Error('Missing value: '+k);result[k]=value;}}return result;}
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
try{
 if(command==='profile'){
  const action=args.shift();
  if(action==='template'){if(args.length>1)throw Error('Expected optional policy version');const p=validateProfile(template('heuristic-candidate',args[0]||'heuristic-params-0.1.0'));console.log(JSON.stringify(p,null,2));}
  else if(action==='registry'){if(args.length)throw Error('Unexpected arguments');console.log(JSON.stringify({legacy:registry,planner:plannerRegistry,trade:tradeRegistry,resource:resourceRegistry,resourceComponents:resourceComponentRegistry,sharedPlanRegistry,buildTradeRegistry,buildTradeComponentRegistry},null,2));}
  else if(action==='validate'){if(args.length!==1)throw Error('Expected profile file');const p=validateProfile(await readJson(args[0]));console.log(JSON.stringify({profile:p,sha256:hash(p)},null,2));}
  else throw Error('Use bots:profile -- template [policyVersion] | registry | validate file.json');
 }else if(command==='simulate'){
  const opts=options(args);if(!opts['--manifest']||(!opts['--out']&&!opts['--dry-run']))throw Error('Expected --manifest and --out (or --dry-run)');
  const experiment=await loadExperiment(path.resolve(opts['--manifest'])),jobs=plan(experiment.manifest,experiment.profiles);
  console.log(JSON.stringify({matches:jobs.length,commandSlotCap:jobs.length*experiment.manifest.maxActions,workers:experiment.manifest.workers,profiles:Object.fromEntries(Object.entries(experiment.profiles).map(([id,p])=>[id,hash(p)])),strata:experiment.manifest.rosters.map(r=>({id:r.id,playerCount:r.profiles.length,matches:jobs.filter(j=>j.roster===r.id).length}))},null,2));
  if(!opts['--dry-run']){const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
   try{const result=await simulate(experiment,path.resolve(opts['--out']),{resume:!!opts['--resume'],signal:controller.signal,onProgress:(done,total)=>process.stderr.write(`Completed ${done}/${total}\n`)});console.log(JSON.stringify(result,null,2));if(result.interrupted)process.exitCode=130;else if(result.failed)process.exitCode=1;}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}}
 }else if(command==='replay'){
  const opts=options(args);if(!opts['--out']||!opts['--match'])throw Error('Expected --out run-directory --match match-id');if(!/^[a-f0-9]{64}$/.test(opts['--match']))throw Error('Invalid match ID');
  const meta=await readJson(path.join(opts['--out'],'experiment.json'));if(canonical(meta.identity)!==canonical(await fingerprint()))throw Error('Replay source/runtime mismatch');
  const jobs=plan(meta.manifest,meta.profiles),job=jobs.find(j=>j.id===opts['--match']);if(!job)throw Error('Unknown match');
  const envelope=await readJson(path.join(opts['--out'],'matches',job.id+'.json'));if(envelope.checksum!==hash(envelope.result))throw Error('Corrupt checkpoint');
  if(['MATCH_WATCHDOG','WORKER_EXIT'].includes(envelope.result.reason)||envelope.result.reason?.startsWith('WORKER_ERROR'))throw Error('Infrastructure failure has no complete deterministic replay; rerun as a separate experiment');
  const actual=runMatch({job,profiles:job.profiles.map(id=>meta.profiles[id]),maxActions:meta.manifest.maxActions,decisionSeed:meta.manifest.decisionSeed});
  for(const k of ['status','reason','traceHash','finalStateHash','winnerSeat',...(envelope.result.planTraceHash?['planTraceHash']:[])])if(canonical(actual[k])!==canonical(envelope.result[k]))throw Error('Replay mismatch: '+k);
  console.log(JSON.stringify({matchId:job.id,reproduced:true,traceHash:actual.traceHash,steps:actual.steps}));
 }else if(command==='compare'){
  if(args.length!==2)throw Error('Expected two run directories');const [a,b]=await Promise.all(args.map(p=>readJson(path.join(p,'summary.json'))));console.log(JSON.stringify({note:'Descriptive comparison only; not paired inference or a difficulty rating.',runs:args.map((directory,i)=>({directory,summary:i?b:a}))},null,2));
 }else throw Error('Commands: profile, simulate, replay, compare');
}catch(error){console.error('Bot experiment error: '+error.message);process.exitCode=1;}
