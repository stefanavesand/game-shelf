import {RESOURCES,RESOURCE_NAMES,ownPlayer} from './core/protocol.js';
export function canSupplyOffer(view){return !!view?.offer&&RESOURCES.every(r=>(view.offer.receive[r]||0)<=ownPlayer(view).resources[r]);}
const bundle=b=>RESOURCES.filter(r=>b[r]>0).map(r=>`${b[r]} ${RESOURCE_NAMES[r]}`).join(', ');
export function updateTradeFeedback(previous,view,outgoing){
 const record=structuredClone(previous||{schemaVersion:1,watch:null,events:[]}),added=[];
 if(record.schemaVersion!==1)throw Error('Unsupported trade feedback version');
 if(view.revision<(record.seenRevision||0))return {record,added};
 record.seenRevision=view.revision;
 const names=id=>view.seats.find(s=>s.id===id)?.name||'Player';
 const label=row=>row.message.replaceAll('_',' ');
 if(outgoing)record.draft=structuredClone(outgoing);
 if(!record.watch&&record.draft){const draft=record.draft,row=view.history.find(row=>row.revision===draft.revision);if(row&&row.playerId===draft.from&&label(row)==='trade offer'){record.watch=draft;record.draft=null;}else if(view.revision>=draft.revision)record.draft=null;}
 const watch=record.watch;
 if(watch&&view.revision>watch.revision){
  const first=view.history.find(row=>row.revision>watch.revision);
  const outcome=first?.revision===watch.revision+1?label(first):'invalidated';
  const text=outcome==='trade accept'?`${names(watch.to)} accepted: ${names(watch.from)} gives ${bundle(watch.give)} and receives ${bundle(watch.receive)}.`:outcome==='trade decline'?`${names(watch.to)} declined ${names(watch.from)}’s offer.`:outcome==='trade cancel'?`${names(watch.from)} cancelled the offer.`:`The offer from ${names(watch.from)} is no longer active. Review the current game.`;
  const event={id:`${view.id}:${watch.revision}`,revision:first?.revision||view.revision,message:text};
  if(!record.events.some(e=>e.id===event.id)){record.events.push(event);added.push(event);}
  record.watch=null;
 }
 const offer=view.offer;
 if(offer&&(offer.from===view.you||offer.to===view.you))record.watch={revision:view.revision,from:offer.from,to:offer.to,give:structuredClone(offer.give),receive:structuredClone(offer.receive)};
 record.events=record.events.slice(-30);return {record,added};
}
