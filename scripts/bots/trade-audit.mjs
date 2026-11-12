// Offline synthetic evidence only. Recipient views never reach a proposing policy.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {catanChoices} from '../../play/catan/rules/session.js';
import {hash,bytesHash} from './profiles.mjs';
import {fingerprint} from './experiments.mjs';
import {loadRun} from './cohort-analysis.mjs';
const investments=new Set(['BUILD_ROAD','BUILD_SETTLEMENT','BUILD_CITY','BUY_DEVELOPMENT_CARD']);
const total=b=>Object.values(b).reduce((n,v)=>n+v,0);
const ratio=o=>`${total(o.give)}:${total(o.receive)}`;
const rate=(n,d)=>d?n/d:null;
export function summarize(offers,turns){
 const resolved=offers.filter(o=>o.status!=='waiting'),accepted=offers.filter(o=>o.status==='accepted');
 const result={offers:offers.length,resolved:resolved.length,unresolved:offers.length-resolved.length,accepted:accepted.length,acceptanceRate:rate(accepted.length,offers.length),noRecipientCouldAfford:offers.filter(o=>o.affordableRecipients===0).length,ownTurns:turns.length,offersPerOwnTurn:rate(offers.length,turns.length),acceptedTradeTurns:turns.filter(t=>t.acceptedTrade).length,acceptedTradeTurnsWithSubsequentInvestment:turns.filter(t=>t.acceptedTrade&&t.investmentAfterTrade).length,acceptedTradesUnlockingInvestment:turns.reduce((n,t)=>n+t.unlockedTrades,0),byRatio:{}};
 for(const key of [...new Set(offers.map(ratio))].sort()){
  const group=offers.filter(o=>ratio(o)===key);result.byRatio[key]={offers:group.length,accepted:group.filter(o=>o.status==='accepted').length,noRecipientCouldAfford:group.filter(o=>o.affordableRecipients===0).length,acceptanceRate:rate(group.filter(o=>o.status==='accepted').length,group.length)};
 }
 return result;
}
export function auditMatch(row,focal){
 const seat=row.profileIds.indexOf(focal);if(seat<0||row.profileIds.filter(p=>p===focal).length!==1)throw Error('Exactly one focal seat required');
 const id='p'+seat,module=createCatanModule(CATAN_ARTIFACT.compatibilityId),humans=row.profileIds.map((_,i)=>({id:'p'+i,name:'Seat '+(i+1)}));
 let state=module.initialize(catanConfig(humans,{playerCount:row.playerCount,seed:row.gameSeed}),{gameId:'experiment-'+row.caseId});
 const offers=new Map(),turns=new Map(),incoming={responses:0,accepted:0,declined:0,unaffordableDeclines:0},completed=[];
 for(const command of row.trace){
  const before=state.snapshot,game=before.state.game,ownTurn=game.turn>0&&game.currentPlayerId===id;
  if(ownTurn&&!turns.has(game.turn))turns.set(game.turn,{turn:game.turn,acceptedTrade:false,investmentAfterTrade:false,unlockedTrades:0});
  const ownResponse=command.actor===id&&['TRADE_ACCEPT','TRADE_DECLINE'].includes(command.action.type);
  if(ownResponse){incoming.responses++;incoming[command.action.type==='TRADE_ACCEPT'?'accepted':'declined']++;if(command.action.type==='TRADE_DECLINE'&&!module.view(state,id).choices.some(c=>c.type==='TRADE_ACCEPT'))incoming.unaffordableDeclines++;}
  const accepted=command.action.type==='TRADE_ACCEPT'?before.offer:null;
  const focalTrade=accepted&&(accepted.from===id||command.actor===id);
  const priorTypes=focalTrade&&ownTurn?new Set(catanChoices(module.view(state,id).state,id,null).filter(a=>investments.has(a.type)).map(a=>a.type)):new Set();
  state=module.apply(state,command.actor,command,{},{coordinatorId:'p0'});
  if(command.action.type==='TRADE_OFFER'&&command.actor===id){
   const offer=state.snapshot.offer;
   const affordableRecipients=offer.recipients.filter(peer=>module.view(state,peer).choices.some(a=>a.type==='TRADE_ACCEPT')).length;
   offers.set(offer.id,{id:offer.id,give:offer.give,receive:offer.receive,to:offer.to,recipients:offer.recipients.length,affordableRecipients,status:'waiting',turn:game.turn});
  }
  // The authoritative ledger distinguishes one recipient's decline from final rejection.
  for(const entry of state.snapshot.trades){const record=offers.get(entry.id);if(record)record.status=entry.status;}
  if(focalTrade){
   const publicPeer=module.view({snapshot:before},id).state.players.players.find(p=>p.id===(accepted.from===id?command.actor:accepted.from));
   completed.push({turn:game.turn,proposedByFocal:accepted.from===id,peerPublicVp:publicPeer.victoryPoints,give:accepted.from===id?accepted.give:accepted.receive,receive:accepted.from===id?accepted.receive:accepted.give});
   if(ownTurn){const turn=turns.get(game.turn);turn.acceptedTrade=true;
    const nowTypes=new Set(catanChoices(module.view(state,id).state,id,null).filter(a=>investments.has(a.type)).map(a=>a.type));if([...nowTypes].some(t=>!priorTypes.has(t)))turn.unlockedTrades++;
   }
  }
  if(ownTurn&&command.actor===id&&investments.has(command.action.type)&&turns.get(game.turn).acceptedTrade)turns.get(game.turn).investmentAfterTrade=true;
 }
 if(hash(state)!==row.finalStateHash)throw Error('Audited replay final state differs');
 return {caseId:row.caseId,roster:row.roster,gameSeed:row.gameSeed,playerCount:row.playerCount,offers:[...offers.values()],turns:[...turns.values()],incoming,completed};
}
export async function auditRun(directory,focal){
 const {meta,rows}=await loadRun(directory),current=await fingerprint();
 // Commit metadata may differ for analysis-only changes; exact runner/policy/rule bytes must match.
 for(const key of ['rules','compatibility','code','node'])if(meta.identity[key]!==current[key])throw Error('Recorded rule/policy/runtime content differs');
 const matches=rows.map(row=>auditMatch(row,focal)),groups=[];
 for(const roster of [...new Set(matches.map(m=>m.roster))].sort()){
  const games=matches.filter(m=>m.roster===roster),offers=games.flatMap(g=>g.offers),turns=games.flatMap(g=>g.turns),incoming=Object.fromEntries(['responses','accepted','declined','unaffordableDeclines'].map(k=>[k,games.reduce((n,g)=>n+g.incoming[k],0)]));
  groups.push({roster,matches:games.length,...summarize(offers,turns),incoming,completedWithPeerAtLeast8PublicVp:games.flatMap(g=>g.completed).filter(t=>t.peerPublicVp>=8).length});
 }
 return {schemaVersion:1,focalProfile:focal,sourceIdentity:meta.identity,auditIdentity:{...current,auditSourceSha256:bytesHash(await readFile(new URL(import.meta.url)))},note:'Offline synthetic replay. Opponent affordability uses each recipient’s own authorized view for post-hoc diagnosis only, never proposer input. Build-unlock and subsequent-investment metrics concern the active focal turn, are proxies and do not establish causal benefit. All original final-state hashes verified.',groups,matches};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{if(process.argv.length!==5)throw Error('Usage: node scripts/bots/trade-audit.mjs run-directory focal-profile output.json');const report=await auditRun(process.argv[2],process.argv[3]);await writeFile(process.argv[4],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.groups,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
