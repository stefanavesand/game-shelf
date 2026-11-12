// Original offline audit: observed card/discard outcomes, never policy input.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {COSTS,RESOURCES} from '../../play/catan/rules/economy.js';
import {hash,bytesHash} from './profiles.mjs';
import {fingerprint} from './experiments.mjs';
import {loadRun} from './cohort-analysis.mjs';
const hasCost=(hand,cost)=>RESOURCES.every(r=>hand[r]>=(cost[r]||0));
export function auditResourceMatch(row,focal){
 const seat=row.profileIds.indexOf(focal);if(seat<0||row.profileIds.filter(id=>id===focal).length!==1)throw Error('One focal resource seat required');
 const id='p'+seat,module=createCatanModule(CATAN_ARTIFACT.compatibilityId),humans=row.profileIds.map((_,i)=>({id:'p'+i,name:'Seat '+(i+1)}));
 let state=module.initialize(catanConfig(humans,{playerCount:row.playerCount,seed:row.gameSeed}),{gameId:'experiment-'+row.caseId});
 const metrics={discards:0,discardedCards:0,cityKeepOpportunities:0,cityHandsPreserved:0,yearOfPlenty:0,yearOfPlentyBeforeRoll:0,yearOfPlentyMainCityUnlocks:0,monopoly:0,monopolyBeforeRoll:0,monopolyCardsTaken:0,zeroYieldMonopoly:0};
 for(const command of row.trace){
  const before=state,phase=before.snapshot.state.game.phase,player=before.snapshot.state.players.players[seat];
  const beforeCity=command.action.type==='PLAY_YEAR_OF_PLENTY'&&command.actor===id&&phase==='main'&&module.view(before,id).choices.some(a=>a.type==='BUILD_CITY');
  state=module.apply(state,command.actor,command,{},{coordinatorId:'p0'});
  if(command.actor!==id)continue;
  const after=state.snapshot.state.players.players[seat],action=command.action;
  if(action.type==='DISCARD_RESOURCES'){
   metrics.discards++;metrics.discardedCards+=Object.values(action.resources).reduce((a,b)=>a+b,0);
   const opportunity=hasCost(player.resources,COSTS.city)&&Object.values(after.resources).reduce((a,b)=>a+b,0)>=5&&player.citiesRemaining>0&&before.snapshot.state.board.buildings.some(b=>b.playerId===id&&b.type==='settlement');
   if(opportunity){metrics.cityKeepOpportunities++;if(hasCost(after.resources,COSTS.city))metrics.cityHandsPreserved++;}
  }else if(action.type==='PLAY_YEAR_OF_PLENTY'){
   metrics.yearOfPlenty++;if(phase==='roll')metrics.yearOfPlentyBeforeRoll++;
   if(phase==='main'&&!beforeCity&&module.view(state,id).choices.some(a=>a.type==='BUILD_CITY'))metrics.yearOfPlentyMainCityUnlocks++;
  }else if(action.type==='PLAY_MONOPOLY'){
   metrics.monopoly++;if(phase==='roll')metrics.monopolyBeforeRoll++;
   const taken=after.resources[action.resource]-player.resources[action.resource];metrics.monopolyCardsTaken+=taken;if(taken===0)metrics.zeroYieldMonopoly++;
  }
 }
 if(hash(state)!==row.finalStateHash)throw Error('Resource audit final-state mismatch');
 return {caseId:row.caseId,roster:row.roster,...metrics};
}
export async function auditResourceRun(directory,focal){
 const {meta,rows}=await loadRun(directory),current=await fingerprint();for(const key of ['rules','compatibility','code','node'])if(meta.identity[key]!==current[key])throw Error('Resource audit source/runtime content mismatch');
 const matches=rows.map(r=>auditResourceMatch(r,focal)),groups=[];
 for(const roster of [...new Set(matches.map(m=>m.roster))].sort()){
  const selected=matches.filter(m=>m.roster===roster),totals={};for(const key of Object.keys(selected[0]).filter(k=>!['caseId','roster'].includes(k)))totals[key]=selected.reduce((n,m)=>n+m[key],0);
  groups.push({roster,matches:selected.length,...totals});
 }
 return {schemaVersion:1,sourceIdentity:meta.identity,auditSourceSha256:bytesHash(await readFile(new URL(import.meta.url))),focalProfile:focal,note:'Complete synthetic command replay with final-state hash verification. City preservation is a feasible resource-cost proxy, not proof that keeping a city hand is always best. Main-phase Year of Plenty unlocks concern an immediately legal city, not a future sequence or causal win. No timing/memory or strength claim.',groups};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{if(process.argv.length!==5)throw Error('Usage: node scripts/bots/resource-audit.mjs run-directory focal-profile output.json');const report=await auditResourceRun(process.argv[2],process.argv[3]);await writeFile(process.argv[4],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.groups,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
