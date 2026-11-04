import {createIdentity} from '../core/identity.js';
import {PlayError} from '../core/errors.js';
import {createRelayTransport} from './transport.js';
import {createRelayStore} from './store.js';
import {createRelayLobby} from './lobby.js';
import {RuleRejection} from './replica.js';
import {createRelayClient} from './client.js';
import {createCatanModule,catanConfig} from '../catan/module.js';
import {CATAN_ARTIFACT} from '../catan/artifact.js';
const module=createCatanModule(CATAN_ARTIFACT.digest);
export function createOnlineGameClient({auth=createIdentity(),store=createRelayStore({name:'game-shelf-online-catan-v1'}),transport=createRelayTransport({endpoint:'https://stefan-game-shelf.lovable.app/api/public/relay/v1',identity:options=>auth.identity(options)}),id=()=>crypto.randomUUID()}={}){
 let principal=null;
 const saved=()=>auth.savedIdentity()?.user?.id??null;
 const read=async p=>{const index=await store.load(p,'@index');index.rooms??={};return index;};
 const save=index=>store.save(index);
 const lobby=index=>createRelayLobby({principalId:index.principalId,store,transport,id:()=>index.intent.ids[index.intent.stage],now:()=>index.intent.createdAt});
 async function enter(index){
  const intent=index.intent,l=lobby(index);
  if(intent.stage==='profile'){await l.mutate('profile.set',{displayName:intent.args.name||'Player'});intent.stage='channel';await save(index);}
  const result=await l.mutate(intent.op==='create'?'channel.create':'channel.join',intent.op==='create'?{}:{inviteToken:intent.args.inviteToken});
  index.current=result.channelId;index.rooms[result.channelId]={inviteToken:result.inviteToken||intent.args.inviteToken,botLevel:intent.args.botLevel||'standard'};index.intent=null;await save(index);return index;
 }
 async function binding(index,network){
  if(!index.current)return null;const room=index.rooms[index.current];
  if(network){const {result}=await transport.request({protocolVersion:1,op:'channel.read',channelId:index.current},index.principalId);Object.assign(room,result);await save(index);}
  if(!room?.creatorId)return null;
  const replica=createRelayClient({principalId:index.principalId,channelId:index.current,creatorId:room.creatorId,members:room.members.map(m=>m.playerId),module,store,transport});return {replica,room};
 }
 function packet(index,room,record){
  if(record?.halt)throw new PlayError('GAME_HALTED','The players computed different results. This game has stopped.');
  if(!record?.game)return {ok:true,apiVersion:1,roomId:index.current,status:'waiting',you:index.principalId,revision:0,members:[...room.members.map(m=>({id:m.playerId,name:m.displayName||'Player',kind:'human'})),{id:'bot:2',name:'Bot',kind:'bot',level:room.botLevel}],view:null,inviteToken:room.inviteToken};
  const state=record.game.state;return {ok:true,apiVersion:1,roomId:index.current,status:state.snapshot.state.game.phase==='ended'?'ended':'playing',you:index.principalId,revision:record.game.revision,members:state.snapshot.seats,view:module.view(state,index.principalId),inviteToken:room.inviteToken};
 }
 async function progress(index,replica,room){
  let record=await replica.sync();
  if(!record.game&&room.creatorId===index.principalId&&room.members.length===2){const seed=new Uint32Array(1);do{crypto.getRandomValues(seed);}while(!seed[0]);record=await replica.begin(catanConfig(room.members.map((m,i)=>({id:m.playerId,name:m.displayName||`Player ${i+1}`})),{seed:seed[0],level:room.botLevel}));}
  for(let i=0;i<8&&record.game&&!record.halt&&!record.outbox.length&&room.creatorId===index.principalId;i++){
   const command=module.nextBot(record.game.state);if(!command)break;
   try{record=await replica.command(command,{}, {revision:record.game.revision,hash:record.game.hash});}catch(error){if(error.code!=='STALE_GAME')throw error;record=await replica.sync();}
  }
  return packet(index,room,record);
 }
 async function refresh(){principal=(await auth.identity()).user.id;let index=await read(principal);if(index.intent)index=await enter(index);const bound=await binding(index,true);return bound?progress(index,bound.replica,bound.room):null;}
 function translate(error){if(error instanceof PlayError)return error;return new PlayError(error.code==='AUTH_REQUIRED'?'AUTH_REQUIRED':error.code==='UNSUPPORTED_ENGINE'?'UNSUPPORTED_VERSION':error.code||'NETWORK_UNAVAILABLE',error.message,{retryable:!!error.retryable,retryAfterMs:error.retryAfterMs||0});}
 return {
  capabilities:{pollIntervalMs:5000,requiresInternet:true},
  async inspect(){const p=saved();if(!p)return {state:{schemaVersion:1,roomId:null,pending:null},packet:null,principalId:null};const index=await read(p),bound=await binding(index,false),record=bound?await bound.replica.state():null;return {state:{schemaVersion:1,roomId:index.current||null,pending:index.intent?{body:{op:index.intent.op},principalId:p}:record?.outbox.length?{body:{op:'command'},principalId:p}:null,retryAt:record?.retryAt||0},principalId:p,packet:bound?packet(index,bound.room,record):null};},
  async games(){const p=saved();if(!p)return [];const index=await read(p),rows=[];for(const roomId of Object.keys(index.rooms)){const record=await store.load(p,roomId),snapshot=record.game?.state.snapshot;rows.push({roomId,status:snapshot?.state.game.phase==='ended'?'ended':snapshot?'playing':'waiting',players:snapshot?.seats.map(s=>s.name)||index.rooms[roomId].members?.map(s=>s.displayName||'Player')||[],mode:'friends',botLevel:index.rooms[roomId].botLevel});}return rows;},
  async execute(op,args={}){try{
   principal=(await auth.identity({allowCreate:op==='create'||op==='join'})).user.id;let index=await read(principal);
   if(op==='create'||op==='join'){
    if(!index.intent){index.intent={op,args,createdAt:Date.now(),stage:'profile',ids:{profile:id(),channel:id()}};await save(index);}index=await enter(index);return refresh();
   }
   if(!op)return refresh();if(args.roomId!==index.current)throw new PlayError('ROOM_SWITCH','The selected game changed.');const bound=await binding(index,true);if(!bound)throw new PlayError('PROTOCOL_ERROR','Choose a game.');
   const current=await bound.replica.state();await bound.replica.command({actor:principal,action:args.action},{},{revision:args.expectedRevision,hash:current.game?.hash});return progress(index,bound.replica,bound.room);
  }catch(error){if(error instanceof RuleRejection||error.code==='STALE_GAME')return {ok:false,apiVersion:1,error:{code:'rule_rejected',message:error.message}};throw translate(error);}},
  async refresh(){try{return await refresh();}catch(error){throw translate(error);}},
  async resume(roomId){const p=saved(),index=p?await read(p):null;if(!index?.rooms[roomId])return {ok:false,apiVersion:1,error:{code:'room_not_found',message:'This game is not available.'}};index.current=roomId;await save(index);return this.refresh();},
  async canUpdate(artifact){const p=saved();if(!p)return true;const index=await read(p);if(index.intent)return false;for(const room of Object.keys(index.rooms)){const record=await store.load(p,room);if(record.outbox.length||record.game&&record.game.state.snapshot.state.game.phase!=='ended'&&record.game.moduleDigest!==artifact)return false;}return true;}
 };
}
