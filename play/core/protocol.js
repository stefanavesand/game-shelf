import {PlayError} from './errors.js';
export const RESOURCES=Object.freeze(['brick','lumber','grain','wool','ore']);
export const RESOURCE_NAMES=Object.freeze({brick:'Brick',lumber:'Wood',grain:'Grain',wool:'Wool',ore:'Ore'});
export const CARD_NAMES=Object.freeze({knight:'Knight',roadBuilding:'Road Building',yearOfPlenty:'Year of Plenty',monopoly:'Monopoly',victoryPoint:'Victory Point'});
export const CARD_ACTION=Object.freeze({knight:'PLAY_KNIGHT',roadBuilding:'PLAY_ROAD_BUILDING',yearOfPlenty:'PLAY_YEAR_OF_PLENTY',monopoly:'PLAY_MONOPOLY'});
export const ACTIONS=new Set(['PLACE_SETTLEMENT','PLACE_ROAD','BUILD_SETTLEMENT','BUILD_ROAD','BUILD_CITY','ROLL_DICE','END_TURN','BUY_DEVELOPMENT_CARD','BANK_TRADE','DISCARD_RESOURCES','MOVE_ROBBER','STEAL_RESOURCE','PLAY_KNIGHT','PLAY_ROAD_BUILDING','PLAY_YEAR_OF_PLENTY','PLAY_MONOPOLY','TRADE_OFFER','TRADE_ACCEPT','TRADE_DECLINE','TRADE_CANCEL']);
const ERRORS=new Set(['bad_request','unauthenticated','room_not_found','room_full','cannot_join_own_room','cannot_join','not_started','game_over','revision_conflict','command_id_conflict','session_expired','payload_too_large','rule_rejected','rate_limited','internal']);
const PHASES=new Set(['setup-settlement-1','setup-road-1','setup-settlement-2','setup-road-2','roll','main','discard','robber-move','robber-steal','road-building','ended']);
const fail=()=>{throw new PlayError('UNSUPPORTED_VERSION','This game response needs a compatible app. Your saved identity and unresolved move have been kept.');};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateSaved(value){
  if(!plain(value)||value.schemaVersion!==1||!(value.roomId===null||uuid(value.roomId)))fail();
  if(value.pending!==null){const p=value.pending;if(!plain(p)||typeof p.principalId!=='string'||!plain(p.body)||p.body.apiVersion!==1||!uuid(p.body.commandId)||!['create','join','command'].includes(p.body.op))fail();}
  return value;
}
export function validateView(v,you,roomId){
  if(!plain(v)||v.apiVersion!==1||v.engineVersion!=='1.0.0'||v.you!==you||v.id!==roomId||!Number.isSafeInteger(v.revision)||v.revision<0||!plain(v.state)||!PHASES.has(v.state.game?.phase)||!Array.isArray(v.seats)||v.seats.length!==3||!Array.isArray(v.choices)||v.choices.length>256||!Array.isArray(v.history)||v.history.length>50||'deck' in v)fail();
  const {board,players,game}=v.state;
  if(!plain(board)||!Array.isArray(board.tiles)||board.tiles.length!==19||!Array.isArray(board.buildings)||board.buildings.length>30||!Array.isArray(board.roads)||board.roads.length>45||!Array.isArray(board.ports)||!Array.isArray(players?.players)||players.players.length!==3||!Array.isArray(players.turnOrder))fail();
  for(const p of players.players){
    if(typeof p.id!=='string'||typeof p.name!=='string'||!['red','blue','orange','green'].includes(p.color)||!plain(p.resources)||!Array.isArray(p.developmentCards)||!Number.isInteger(p.resourceCount)||p.resourceCount<0||!Number.isInteger(p.devCardCount))fail();
    for(const r of RESOURCES)if(!Number.isSafeInteger(p.resources[r])||p.resources[r]<0||p.resources[r]>19)fail();
    if(p.id!==you&&(Object.values(p.resources).some(n=>n!==0)||p.developmentCards.length))fail();
    if(p.developmentCards.some(c=>!CARD_NAMES[c.type]||typeof c.isPlayed!=='boolean'||!Number.isSafeInteger(c.turnBought)))fail();
  }
  if(!players.players.some(p=>p.id===you)||!v.seats.every(s=>players.players.some(p=>p.id===s.id)&&['human','bot'].includes(s.kind))||v.choices.some(c=>!plain(c)||!ACTIONS.has(c.type)))fail();
  if(game.phase!=='ended'&&!players.players.some(p=>p.id===game.currentPlayerId))fail();
  return v;
}
export function validatePacket(packet){
  if(!plain(packet)||packet.apiVersion!==1||typeof packet.ok!=='boolean')fail();
  if(!packet.ok){if(!plain(packet.error)||!ERRORS.has(packet.error.code)||typeof packet.error.message!=='string')fail();return packet;}
  if(!uuid(packet.roomId)||!['p1','p2'].includes(packet.you)||!['waiting','playing','ended'].includes(packet.status)||!Number.isSafeInteger(packet.revision)||packet.revision<0||!Array.isArray(packet.members))fail();
  if(packet.status==='waiting'){if(packet.view!==null)fail();}else{validateView(packet.view,packet.you,packet.roomId);if(packet.view.revision!==packet.revision)fail();}
  return packet;
}
export const ownPlayer=view=>view.state.players.players.find(p=>p.id===view.you);
export const handCount=bundle=>RESOURCES.reduce((n,r)=>n+(bundle[r]||0),0);
export const bundleLabel=bundle=>RESOURCES.filter(r=>bundle[r]).map(r=>`${bundle[r]} ${RESOURCE_NAMES[r].toLowerCase()}`).join(' + ')||'nothing';
export const sameChoice=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
