import {RESOURCES,RESOURCE_NAMES,ownPlayer} from '../core/protocol.js';
import {COSTS} from '../catan/rules/economy.js';
// Canonical display keys do not depend on DOM order or player names.
export const edgeDisplayKey=edge=>`${edge.hex.q}:${edge.hex.r}:${edge.direction}`;
export const vertexDisplayKey=vertex=>`${vertex.hex.q}:${vertex.hex.r}:${vertex.direction}`;
export const hexDisplayKey=hex=>`${hex.q}:${hex.r}`;
const labels={
 'place settlement':'placed a settlement','place road':'placed a road','build settlement':'built a settlement','build road':'built a road','build city':'upgraded to a city','roll dice':'rolled the dice','end turn':'ended their turn','buy development card':'bought a development card','bank trade':'traded with the bank','trade offer':'made a trade offer','trade accept':'accepted a trade','trade decline':'declined a trade','trade cancel':'cancelled a trade','discard resources':'returned cards','move robber':'moved the robber','steal resource':'stole a card','play knight':'played a Knight','play road building':'played Road Building','play year of plenty':'played Year of Plenty','play monopoly':'played Monopoly'
};
// Consume only consecutive, authorized views. Never replay a reconnect backlog or
// infer resource types/development cards from an opponent's private hand.
export function describeMove(before,after){
 if(!before?.view||!after?.view||before.roomId!==after.roomId||before.you!==after.you||after.revision!==before.revision+1)return null;
 const v=after.view,previous=before.view,h=v.history.find(entry=>entry.revision===after.revision);
 if(!h||!labels[h.message])return null;
 const actor=v.state.players.players.find(p=>p.id===h.playerId);if(!actor)return null;
 const oldBoard=previous.state.board,board=v.state.board,oldRoads=new Set(oldBoard.roads.map(r=>edgeDisplayKey(r.edge))),oldBuildings=new Map(oldBoard.buildings.map(b=>[vertexDisplayKey(b.vertex),b.type]));
 const pieces=[...board.roads.filter(r=>!oldRoads.has(edgeDisplayKey(r.edge))).map(r=>({kind:'road',key:edgeDisplayKey(r.edge)})),...board.buildings.filter(b=>oldBuildings.get(vertexDisplayKey(b.vertex))!==b.type).map(b=>({kind:'building',key:vertexDisplayKey(b.vertex)}))];
 const mine=ownPlayer(v).resources,oldMine=ownPlayer(previous).resources;
 const resources=RESOURCES.map(resource=>({resource,amount:(mine[resource]||0)-(oldMine[resource]||0)})).filter(d=>d.amount);
 const scores=v.state.players.players.map(p=>({playerId:p.id,amount:p.victoryPoints-(previous.state.players.players.find(old=>old.id===p.id)?.victoryPoints??p.victoryPoints)})).filter(d=>d.amount>0);
 const awards=['longestRoad','largestArmy'].filter(key=>v.state.game[key]?.playerId&&v.state.game[key].playerId!==previous.state.game[key]?.playerId).map(key=>({playerId:v.state.game[key].playerId,name:key==='longestRoad'?'Longest Road':'Largest Army'}));
 const buildingType={'build road':'road','build settlement':'settlement','build city':'city'}[h.message];
 const cost=buildingType&&!(h.message==='build road'&&previous.state.game.phase==='road-building')?Object.entries(COSTS[buildingType]).map(([resource,amount])=>({resource,amount})):[];
 const rolled=h.message==='roll dice'?v.state.game.lastRoll:null;
 const producing=rolled?board.tiles.filter(t=>t.number===rolled.total&&hexDisplayKey(t.coord)!==hexDisplayKey(board.robberLocation)).map(t=>hexDisplayKey(t.coord)):[];
 const robber=h.message==='move robber'||h.message==='play knight'?{from:oldBoard.robberLocation,to:board.robberLocation}:null;
 return {key:`${after.roomId}:${after.revision}`,actorId:actor.id,color:actor.color,action:h.message,message:`${actor.name} ${rolled?`rolled ${rolled.total}`:labels[h.message]}.`,pieces,resources,scores,awards,cost,rolled,producing,robber,card:h.message==='buy development card'};
}
export const costLabel=cost=>cost.map(d=>`−${d.amount} ${RESOURCE_NAMES[d.resource]}`).join(' · ');
