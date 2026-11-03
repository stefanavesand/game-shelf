import {mountRelayDemo} from '../relay/demo.js';
import {createCatanModule,catanConfig} from './module.js';
import {CATAN_ARTIFACT} from './artifact.js';
import {draw,choicePoint} from '../board.js';
import {canonical,invariant} from '../relay/protocol.js';
const $=id=>document.getElementById(id),module=createCatanModule(CATAN_ARTIFACT.digest);
let selected=null,selectionRevision=-1,currentChoices=[],boardKey='';
const label=action=>action.type.toLowerCase().replaceAll('_',' ')+(action.resource?` · ${action.resource}`:'')+(action.victimId?` · ${action.victimId}`:'')+(action.give?` · ${action.give.amount} ${action.give.resource} → ${action.receive.amount} ${action.receive.resource}`:'');
const demo=await mountRelayDemo({module,
 beginConfig({client}) {
  invariant(client.members.length===2,'WAITING_FOR_FRIEND','Invite your friend before starting Catan.');
  const value=new Uint32Array(1);do{crypto.getRandomValues(value);}while(!value[0]);
  return catanConfig(client.memberProfiles.map((p,i)=>({id:p.playerId,name:p.displayName||`Player ${i+1}`})),{seed:value[0],level:$('level').value});
 },
 async onProgress(record,{client,principalId,notify}) {
  // Bounded foreground scheduling; no browser is expected to keep running in the background.
  for(let step=0;step<8&&record.game&&!record.halt&&!record.outbox.length&&principalId===client.creatorId;step++){
   const next=module.nextBot(record.game.state);if(!next)break;
   try{record=await client.command(next,{}, {revision:record.game.revision,hash:record.game.hash});}
   catch(error){if(error.code!=='STALE_GAME')throw error;record=await client.sync();}
   notify(record);
  }
  return record;
 },
 render(record,{client,principalId,busy,run,progress}) {
  $('level').disabled=!!record.game||busy;
  $('begin').disabled||=client.members.length!==2;
  $('confirm').disabled=true;
  if(!record.game)return;
  const state=record.game.state,snapshot=state.snapshot,seat=snapshot.seats.find(s=>s.id===principalId);
  if(!seat){$('turn').textContent='You are not seated in this game.';return;}
  const view=module.view(state,principalId),own=view.state.players.players.find(p=>p.id===principalId);
  const actor=snapshot.seats.find(s=>s.id===view.state.game.currentPlayerId),ended=view.state.game.phase==='ended';
  $('turn').textContent=ended?`Game finished · Winner: ${snapshot.seats.find(s=>s.id===view.state.game.winnerId)?.name}`:`${actor?.name||'Players'} · ${view.state.game.phase.replaceAll('-',' ')} · Turn ${view.state.game.turn}`;
  $('hand').textContent=Object.entries(own.resources).map(([name,count])=>`${name==='lumber'?'wood':name}: ${count}`).join(' · ')+` · Points: ${own.victoryPoints}`;
  if(selectionRevision!==record.game.revision){selectionRevision=record.game.revision;selected=null;}
  currentChoices=view.choices;
  const disabled=busy||!!record.halt||record.outbox.length>0;
  const key=canonical({hash:record.game.hash,selected,disabled});
  if(boardKey!==key){boardKey=key;draw($('board'),view,currentChoices,selected,disabled,index=>{if(busy||record.halt)return;selected=index;boardKey='';renderSelection();});}
  function renderSelection(){
   const action=currentChoices[selected];$('selection').textContent=action?`Selected: ${label(action)}`:'Tap a board target or choose an action.';
   $('confirm').disabled=disabled||!action;
   if(action&&choicePoint(action))draw($('board'),view,currentChoices,selected,disabled,index=>{selected=index;renderSelection();});
  }
  const other=currentChoices.map((action,index)=>({action,index})).filter(c=>!choicePoint(c.action));
  const options=JSON.stringify(other);if($('action').dataset.options!==options){$('action').dataset.options=options;$('action').replaceChildren(new Option('Choose an action',''),...other.map(({action,index})=>new Option(label(action),String(index))));}
  $('action').disabled=disabled||other.length===0;
  $('action').onchange=()=>{selected=$('action').value===''?null:Number($('action').value);renderSelection();};
  renderSelection();
  $('confirm').onclick=()=>run(async()=>{invariant(selected!==null,'NO_SELECTION','Select a legal action.');const command={actor:principalId,action:structuredClone(currentChoices[selected])};selected=null;await progress(await client.command(command,{}, {revision:record.game.revision,hash:record.game.hash}));});
 }
});
// Only safe status/selection data is exposed in the UI; the developer page has no automatic play loop for humans.
void demo;
