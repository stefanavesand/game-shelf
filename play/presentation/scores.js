// Derive points from the authorized view; never reconstruct an opponent's live VP hand.
export function scoreBreakdowns(v){const g=v.state.game;return v.state.players.players.map(p=>{
 const buildings=v.state.board.buildings.filter(b=>b.playerId===p.id),settlements=buildings.filter(b=>b.type==='settlement').length,cities=buildings.filter(b=>b.type==='city').length,road=g.longestRoad?.playerId===p.id?2:0,army=g.largestArmy?.playerId===p.id?2:0,publicPoints=settlements+cities*2+road+army;
 const final=g.phase==='ended'?g.finalScores?.[p.id]:undefined,own=p.id===v.you;
 const cards=Number.isSafeInteger(final)&&final>=publicPoints?final-publicPoints:own?p.developmentCards.filter(c=>c.type==='victoryPoint'&&!c.isPlayed).length:null;
 return {id:p.id,name:p.name,total:final??p.victoryPoints,settlements,cities,road,army,cards,own,final:g.phase==='ended',roadLength:p.longestRoadLength,armySize:p.armySize};
 });}
