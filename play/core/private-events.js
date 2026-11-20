// Recipient-local observations. Never add these to commands or hashed state.
const resources=['brick','lumber','grain','wool','ore'];
export function observeThefts(previous,before,after){
 const entries=Array.isArray(previous)?previous:[];
 if(!before||!after||before.id!==after.id||before.you!==after.you||after.revision!==before.revision+1)return entries;
 const h=after.history.find(e=>e.revision===after.revision);
 if(h?.message!=='steal resource')return entries;
 const own=v=>v.state.players.players.find(p=>p.id===v.you)?.resources;
 const a=own(before),b=own(after);if(!a||!b)return entries;
 const changes=resources.map(resource=>({resource,amount:b[resource]-a[resource]})).filter(d=>d.amount);
 if(changes.length!==1||Math.abs(changes[0].amount)!==1)return entries;
 const {resource,amount}=changes[0];if((amount>0)!==(h.playerId===after.you))return entries;
 const event={gameId:after.id,revision:after.revision,recipient:after.you,actor:h.playerId,resource,direction:amount>0?'gained':'lost'};
 return [...entries.filter(e=>e.revision!==event.revision),event].slice(-200);
}
export function privateThefts(view,observations){
 return (Array.isArray(observations)?observations.slice(-200):[]).filter(e=>e.gameId===view.id&&e.recipient===view.you&&Number.isSafeInteger(e.revision)&&e.revision<=view.revision&&resources.includes(e.resource)&&['gained','lost'].includes(e.direction)&&((e.direction==='gained')===(e.actor===view.you))).map(e=>({...e}));
}
