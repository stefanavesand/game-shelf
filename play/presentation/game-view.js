// Pure projection of an authorized game view into turn instructions.
export function turnTitle({view:v,pending,mode,unavailable,incoming,name}){
  const g=v.state.game,me=v.you;
  if(g.phase==='ended')return [`${g.winnerId===me?'You win':name(g.winnerId)+' wins'}.`,'An evening well played.'];
  if(pending)return ['One moment…','Waiting for confirmation. Your preview is not committed yet.'];
  if(unavailable)return ['Continuing the game','Resolving a trade. Use Continue game if it does not advance.'];
  if(incoming)return ['Alex has an offer'.replace('Alex',name(v.offer.from)),'Review both sides before accepting.'];
  if(g.phase==='discard'&&v.choices.length)return ['Choose cards to return',`Return exactly ${g.discardAmounts[me]} resource cards.`];
  if(g.currentPlayerId!==me)return [`${name(g.currentPlayerId)}’s turn`,v.seats.find(s=>s.id===g.currentPlayerId)?.kind==='bot'?'The bot is choosing. Your hand stays private.':'Your next move will be here when it’s your turn.'];
  if(g.phase.startsWith('setup-settlement'))return [g.phase.endsWith('1')?'Your first settlement':'Your second settlement','Choose a highlighted intersection, then confirm.'];
  if(g.phase.startsWith('setup-road'))return ['A road to start from','Choose an edge next to your new settlement.'];
  return ({roll:['Your turn','Roll the dice, or play an eligible card.'],main:[mode?({BUILD_ROAD:'Build a road',BUILD_SETTLEMENT:'Build a settlement',BUILD_CITY:'Upgrade to a city'}[mode]):'Your turn',mode?'Preview a highlighted location, then confirm.':'Build, trade, or end your turn.'],'robber-move':['Move the robber','Choose a different highlighted tile, then confirm.'],'robber-steal':['Choose a victim','Only public card counts are shown.'],'road-building':['Your free roads',`${g.roadBuildingRemaining} road${g.roadBuildingRemaining===1?'':'s'} left. Preview each placement.`],discard:['Waiting for discards','The required players are returning cards.']})[g.phase]||['Your game','Waiting for the next decision.'];
}
