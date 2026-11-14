import {scenarioName} from '../catan/rules/scenarios.js';
import {makeScenario} from '../core/scenario.js';
import {randomEffects} from '../core/random-effects.js';
import {createIdentity} from '../core/identity.js';
import {PlayError,locked} from '../core/errors.js';
import {createRelayTransport} from './transport.js';
import {createRelayStore} from './store.js';
import {createRelayLobby} from './lobby.js';
import {RuleRejection} from './replica.js';
import {createRelayClient} from './client.js';
import {createCatanModule,catanConfig} from '../catan/module.js';
import {CATAN_ARTIFACT} from '../catan/artifact.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
const pendingRoll=record=>Object.values(record?.game?.randomRequests||{}).some(r=>!r.superseded&&r.baseGameRevision===record.game.revision&&!Object.hasOwn(record.game.seen,r.intentId));
export function createOnlineGameClient({auth=createIdentity(),store=createRelayStore({name:'game-shelf-online-catan-v1'}),transport=createRelayTransport({endpoint:'https://stefan-game-shelf.lovable.app/api/public/relay/v1',identity:options=>auth.identity(options)}),id=()=>crypto.randomUUID()}={}){
 let principal=null;
 const newSeed=()=>{const n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(!n[0]);return n[0];};
 const orderedMembers=room=>[...room.members.filter(m=>m.playerId===room.creatorId),...room.members.filter(m=>m.playerId!==room.creatorId)];
 const saved=()=>auth.savedIdentity()?.user?.id??null;
 const read=async p=>{const index=await store.load(p,'@index');index.rooms??={};return index;};
 const save=index=>store.save(index);
 const lobby=index=>createRelayLobby({principalId:index.principalId,store,transport,id:()=>index.intent.ids[index.intent.stage],now:()=>index.intent.createdAt});
 async function enter(index){
  const intent=index.intent,l=lobby(index);
  if(intent.stage==='profile'){await l.mutate('profile.set',{displayName:intent.args.name||'Player'});intent.stage='channel';await save(index);}
  const result=await l.mutate(intent.op==='create'?'channel.create':'channel.join',intent.op==='create'?{}:{inviteToken:intent.args.inviteToken});
  index.current=result.channelId;index.rooms[result.channelId]={inviteToken:result.inviteToken||intent.args.inviteToken,botLevel:intent.args.botLevel||'standard',playerCount:intent.args.playerCount??3,seed:intent.lobbySeed??null,scenario:intent.lobbyScenario||null,manualStart:intent.op==='create'};index.intent=null;await save(index);return index;
 }
 async function binding(index,network){
  if(!index.current)return null;const room=index.rooms[index.current];
  if(network){const {result}=await transport.request({protocolVersion:1,op:'channel.read',channelId:index.current},index.principalId);Object.assign(room,result);await save(index);}
  if(!room?.creatorId)return null;
  const replica=createRelayClient({principalId:index.principalId,channelId:index.current,creatorId:room.creatorId,members:room.members.map(m=>m.playerId),module,store,transport,createEffects:randomEffects});return {replica,room};
 }
 function packet(index,room,record){
  if(record?.halt)throw new PlayError('GAME_HALTED','The players computed different results. This game has stopped.');
  const settings=record?.lobby||{playerCount:room.playerCount||3,level:room.botLevel||'standard',seed:room.seed||1,...(room.scenario?{scenario:room.scenario}:{})};
  const humans=orderedMembers(room).slice(0,settings.playerCount).map((m,i)=>({id:m.playerId,name:m.displayName||`Player ${i+1}`}));
  if(!record?.game){const config=catanConfig(humans,{...settings,level:settings.level});return {ok:true,apiVersion:1,roomId:index.current,status:'waiting',you:index.principalId,revision:0,members:config.seats,view:null,inviteToken:room.inviteToken,lobby:{playerCount:settings.playerCount,creatorId:room.creatorId,canStart:index.principalId===room.creatorId,scenario:settings.scenario?'Random Island':'Classic',full:!humans.some(h=>h.id===index.principalId),openSeats:settings.playerCount-humans.length}};}
  const state=record.game.state;
  if(!state.snapshot.seats.some(s=>s.id===index.principalId))return {ok:true,apiVersion:1,roomId:index.current,status:'waiting',you:index.principalId,revision:0,members:state.snapshot.seats,view:null,lobby:{playerCount:state.snapshot.seats.length,creatorId:room.creatorId,canStart:false,full:true,started:true,openSeats:0}};
  return {ok:true,apiVersion:1,roomId:index.current,status:state.snapshot.state.game.phase==='ended'?'ended':'playing',you:index.principalId,revision:record.game.revision,pendingRandom:pendingRoll(record),members:state.snapshot.seats,view:module.view(state,index.principalId),inviteToken:room.inviteToken,botWorkPending:index.principalId===room.creatorId&&module.hasBotWork(state)};
 }
 async function start(index,replica,room){
  if(room.creatorId!==index.principalId)throw new PlayError('NOT_CREATOR','Only the host can start this game.');
  let record=await replica.sync();if(record.game)return record;
  const options=record.lobby||{playerCount:room.playerCount||3,level:room.botLevel||'standard',seed:room.seed||newSeed(),...(room.scenario?{scenario:room.scenario}:{})};
  const humans=orderedMembers(room).slice(0,options.playerCount).map((m,i)=>({id:m.playerId,name:m.displayName||`Player ${i+1}`}));
  try{return await replica.begin(catanConfig(humans,{...options,diceMode:'host-random-v1'}));}catch(error){if(error.code!=='NOT_CREATOR')throw error;record=await replica.sync();if(!record.game)throw error;return record;}
 }
 async function progress(index,replica,room,record,options={}){
  if(!record){const before=(await replica.state()).game?.revision;record=await replica.sync();if(record.game&&record.game.revision!==before)return packet(index,room,record);}
  if(!record.game&&room.creatorId===index.principalId){
   if(room.manualStart&&!record.lobby)record=await replica.configure({playerCount:room.playerCount||3,level:room.botLevel||'standard',seed:room.seed||newSeed(),...(room.scenario?{scenario:room.scenario}:{})});
   // Older waiting rooms retain their original auto-start behavior.
   if(!room.manualStart&&!record.lobby&&room.members.length===2)record=await start(index,replica,room);
  }
  for(let i=0;i<Math.min(8,options.botBudget??8)&&record.game&&!record.halt&&!record.outbox.length&&room.creatorId===index.principalId;i++){
   const command=module.nextBot(record.game.state);if(!command)break;
   try{record=await replica.command(command,{}, {revision:record.game.revision,hash:record.game.hash});}catch(error){if(error.code!=='STALE_GAME')throw error;record=await replica.sync();}
  }
  return packet(index,room,record);
 }
 async function refresh(options={}){if(!saved())return null;principal=(await auth.identity()).user.id;let index=await read(principal);if(index.intent)index=await enter(index);const bound=await binding(index,true);return bound?progress(index,bound.replica,bound.room,undefined,options):null;}
 function translate(error){if(error instanceof PlayError)return error;return new PlayError(error.code==='AUTH_REQUIRED'?'AUTH_REQUIRED':['UNSUPPORTED_ENGINE','UNSUPPORTED_PROTOCOL'].includes(error.code)?'UNSUPPORTED_VERSION':error.code||'NETWORK_UNAVAILABLE',error.message,{retryable:!!error.retryable,retryAfterMs:error.retryAfterMs||0});}
 const client={
  capabilities:{pollIntervalMs:5000,requiresInternet:true},
  async inspect(){const p=saved();if(!p)return {state:{schemaVersion:1,roomId:null,pending:null},packet:null,principalId:null};const index=await read(p),bound=await binding(index,false),record=bound?await bound.replica.state():null;return {state:{schemaVersion:1,roomId:index.current||null,pending:index.intent?{body:{op:index.intent.op},principalId:p}:(record?.outbox.length||pendingRoll(record))?{body:{op:'command'},principalId:p}:null,retryAt:record?.retryAt||0},principalId:p,packet:bound?packet(index,bound.room,record):null};},
  async games(){const p=saved();if(!p)return [];const index=await read(p),rows=[];for(const roomId of Object.keys(index.rooms)){if(index.rooms[roomId].abandoned)continue;const record=await store.load(p,roomId),snapshot=record.game?.state.snapshot;rows.push({roomId,status:snapshot?.state.game.phase==='ended'?'ended':snapshot?'playing':'waiting',players:snapshot?.seats.map(s=>s.name)||index.rooms[roomId].members?.map(s=>s.displayName||'Player')||[],mode:'friends',scenario:snapshot?scenarioName(snapshot.state):(record.lobby?.scenario||index.rooms[roomId].scenario)?'Random Island':'Classic',playerCount:snapshot?.seats.length||record.lobby?.playerCount||index.rooms[roomId].playerCount||3,botLevel:index.rooms[roomId].botLevel});}return rows;},
  async execute(op,args={},options={}){try{
   principal=(await auth.identity()).user.id;let index=await read(principal);
   if(op==='create'||op==='join'){
    if(!index.intent){const scenario=op==='create'?makeScenario(args.scenario||'classic'):undefined;if(op==='create')module.validateLobby({playerCount:args.playerCount??3,level:args.botLevel||'standard',seed:1,scenario});index.intent={op,args,lobbyScenario:scenario||null,lobbySeed:op==='create'?newSeed():null,createdAt:Date.now(),stage:'profile',ids:{profile:id(),channel:id()}};await save(index);}index=await enter(index);return refresh(options);
   }
   if(!op)return refresh(options);if(args.roomId!==index.current)throw new PlayError('ROOM_SWITCH','The selected game changed.');const bound=await binding(index,true);if(!bound)throw new PlayError('PROTOCOL_ERROR','Choose a game.');
   if(op==='start'){const record=await start(index,bound.replica,bound.room);return progress(index,bound.replica,bound.room,record,options);}
   const current=await bound.replica.state(),committed=await bound.replica.command({actor:principal,action:args.action},{},{revision:args.expectedRevision,hash:current.game?.hash});return progress(index,bound.replica,bound.room,committed,options);
  }catch(error){if(error instanceof RuleRejection||error.code==='STALE_GAME')return {ok:false,apiVersion:1,error:{code:'rule_rejected',message:error.message}};throw translate(error);}},
  async refresh(options={}){try{return await refresh(options);}catch(error){throw translate(error);}},
  async resume(roomId,options={}){const p=saved(),index=p?await read(p):null;if(!index?.rooms[roomId]||index.rooms[roomId].abandoned)return {ok:false,apiVersion:1,error:{code:'room_not_found',message:'This game is not available.'}};index.current=roomId;await save(index);return refresh(options);},
  async abandon(roomId){const p=saved(),index=p?await read(p):null;if(!index?.rooms[roomId])throw new PlayError('ROOM_SWITCH','Choose a saved game.');const record=await store.load(p,roomId);if(index.intent||record.outbox.length||pendingRoll(record))throw new PlayError('PENDING_DELIVERY','Resolve the pending operation before abandoning this game.');index.rooms[roomId].abandoned=true;if(index.current===roomId)index.current=null;await save(index);},
  async canUpdate(artifact){const p=saved();if(!p)return true;const index=await read(p);if(index.intent)return false;for(const room of Object.keys(index.rooms)){const record=await store.load(p,room);if(record.outbox.length||pendingRoll(record)||!index.rooms[room].abandoned&&record.game&&record.game.state.snapshot.state.game.phase!=='ended'&&record.game.moduleDigest!==artifact)return false;}return true;}
 };
 // Fence index changes, active commands and abandonment across app windows.
 return Object.fromEntries(Object.entries(client).map(([name,value])=>[name,typeof value==='function'? (...args)=>locked('game-shelf-online-catan-index',()=>value.apply(client,args)):value]));
}
