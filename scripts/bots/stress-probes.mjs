// Extract only authorized synthetic observations; never use production saves.
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {canonical,decide,freeze,hash} from './profiles.mjs';
import {loadRun} from './cohort-analysis.mjs';
import {fingerprint} from './experiments.mjs';
const [directory,output]=process.argv.slice(2);
try{
 if(!directory||!output||process.argv.length!==4)throw Error('Usage: node scripts/bots/stress-probes.mjs candidate-run output.json');
 const {meta,rows}=await loadRun(directory),selected=[];
 if(canonical(meta.identity)!==canonical(await fingerprint()))throw Error('Source/runtime identity differs from the recorded run');
 for(const roster of [...new Set(rows.map(r=>r.roster))].sort()){
  const pool=[];
  for(const row of rows.filter(r=>r.roster===roster)){
   const seat=row.profileIds.indexOf('focal-trade');if(seat<0)throw Error('Expected focal-trade candidate');
   row.timings.forEach((t,index)=>{if(t.seat===seat)pool.push({row,index,screenDecisionMs:t.ms});});
  }
  pool.sort((a,b)=>b.screenDecisionMs-a.screenDecisionMs);const matches=new Set();
  for(const item of pool){if(matches.has(item.row.matchId))continue;selected.push(item);matches.add(item.row.matchId);if(matches.size===2)break;}
 }
 const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),probes=[];
 for(const {row,index,screenDecisionMs} of selected){
  const humans=row.profileIds.map((_,i)=>({id:'p'+i,name:'Seat '+(i+1)}));
  let state=module.initialize(catanConfig(humans,{playerCount:row.playerCount,seed:row.gameSeed}),{gameId:'experiment-'+row.caseId});
  for(const command of row.trace.slice(0,index))state=module.apply(state,command.actor,command,{},{coordinatorId:'p0'});
  const actor=row.trace[index].actor,view=freeze(module.view(state,actor)),profile=meta.profiles['focal-trade'];
  const decisionSeed=parseInt(hash({decisionSeed:meta.manifest.decisionSeed,caseId:row.caseId,actor,revision:view.revision,profile:hash(profile)}).slice(0,8),16);
  const expected=row.trace[index].action,timings=[];
  for(let repeat=0;repeat<4;repeat++){
   const start=performance.now(),action=decide(view,profile,decisionSeed),ms=performance.now()-start;
   if(hash(action)!==hash(expected))throw Error('Stress decision differs from recorded command');
   module.apply(state,actor,{actor,action},{},{coordinatorId:'p0'});if(repeat)timings.push(ms);
  }
  probes.push({roster:row.roster,caseId:row.caseId,matchId:row.matchId,traceIndex:index,revision:view.revision,phase:view.state.game.phase,turn:view.state.game.turn,choiceCount:view.choices.length,historyEntries:view.history.length,buildingCount:view.state.board.buildings.length,roadCount:view.state.board.roads.length,screenDecisionMs,isolatedDecisionMs:timings,view,decisionSeed,expected});
 }
 const report={schemaVersion:1,identity:meta.identity,profile:meta.profiles['focal-trade'],note:'Eight slowest observed focal decisions from distinct matches (two per stratum), selected post hoc from concurrent screening. Three isolated repetitions after warmup; observation-only policies and ordinary rules validation. This is a host stress probe, not a worst-case bound or physical device measurement.',probes};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(probes.map(({view,expected,...p})=>p),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
