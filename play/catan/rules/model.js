// Original minimal factories and base-game facts. No legacy application helpers/types.
const resourceNames=['brick','lumber','ore','grain','wool'];
export const DEVELOPMENT_CARD_COUNTS=Object.freeze({knight:14,victoryPoint:5,roadBuilding:2,yearOfPlenty:2,monopoly:2});
export function createPlayer(id,name,color,isHost=false) {
  return {id,name,color,isHost,isConnected:true,isReady:false,sessionToken:'',resources:Object.fromEntries(resourceNames.map(r=>[r,0])),developmentCards:[],hasPlayedDevCard:false,devCardsBoughtThisTurn:[],roadsRemaining:15,settlementsRemaining:5,citiesRemaining:4,longestRoadLength:0,armySize:0,totalResourcesCollected:0,totalTradesMade:0,timesRobbed:0,timesWasRobbed:0};
}
// Fixed base-game layout, specified in rows from top to bottom (axial radius two).
// Layout values are game configuration, not copied board-generator code or artwork.
const rows=[
 [['mountains',10],['pasture',2],['forest',9]],
 [['fields',12],['hills',6],['pasture',4],['hills',10]],
 [['fields',9],['forest',11],['desert',0],['forest',3],['mountains',8]],
 [['forest',8],['mountains',3],['fields',4],['pasture',5]],
 [['hills',5],['fields',6],['pasture',11]]
];
export function generateBeginnerBoard() {
  return rows.flatMap((row,index)=>{const r=index-2,start=Math.max(-2,-r-2);return row.map(([terrain,number],column)=>({id:`hex:${start+column}:${r}`,coord:{q:start+column,r},terrain,number,hasRobber:terrain==='desert'}));});
}
