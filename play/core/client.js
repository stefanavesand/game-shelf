import {PlayError,locked} from './errors.js';
import {createStore} from './store.js';
import {createTransport,capabilities} from './transport.js';
export function createClient({store=createStore(),transport=createTransport(),locks=globalThis.navigator?.locks,now=Date.now,id=()=>crypto.randomUUID(),sample=Math.random}={}){
  const lock=work=>locked('game-shelf-catan-command',work,locks);
  function cooldown(state){if((state.retryAt||0)>now())throw new PlayError('RATE_LIMITED','Please wait before checking the table again.',{retryable:true,retryAfterMs:state.retryAt-now()});}
  async function rememberFailure(state,error){
    if(!error.retryable)return;
    const count=(state.retryCount||0)+1,delay=Math.max(error.retryAfterMs||0,Math.min(30000,1000*2**Math.min(count,5))*(.8+sample()*.4));
    error.retryAfterMs=delay;await store.save({...state,retryAt:now()+delay,retryCount:count});
  }
  async function send(state,op,args={},replace=false){
    cooldown(state);
    if(state.roomId&&!state.pending&&['create','join'].includes(op)&&!replace&&!(op==='join'&&args.roomId===state.roomId))throw new PlayError('ROOM_SWITCH','Confirm that you want to switch tables before creating or joining another room.');
    let principal;try{principal=await transport.identity({allowCreate:!state.roomId&&!state.pending});}catch(error){await rememberFailure(state,error);throw error;}
    const pending=state.pending||{principalId:principal.user.id,body:{apiVersion:1,op,...args,commandId:id()}};
    if(pending.principalId!==principal.user.id)throw new PlayError('AUTH_REQUIRED','This unresolved move belongs to another player identity. It has been kept.');
    const persisted={...state,pending};if(!state.pending)await store.save(persisted);
    let packet;
    try{packet=await transport.request(pending.body,principal);}catch(error){await rememberFailure(persisted,error);throw error;}
    if(packet.ok)await store.cache(packet,principal.user.id);
    await store.save({...persisted,roomId:packet.ok?packet.roomId:state.roomId,pending:null,retryAt:0,retryCount:0});
    return packet;
  }
  async function execute(op,args={},options={}){return lock(async()=>{const state=await store.state();if(!op&&!state.pending)return null;return send(state,op,args,!!options.replace);});}
  async function refresh(){return lock(async()=>{
    let state=await store.state();
    if(state.pending){const recovered=await send(state);if(!recovered.ok)return recovered;state=await store.state();}
    if(!state.roomId)return null;
    cooldown(state);let principal;try{principal=await transport.identity({allowCreate:false});}catch(error){await rememberFailure(state,error);throw error;}
    let packet;try{packet=await transport.request({apiVersion:1,op:'view',roomId:state.roomId},principal);}catch(error){await rememberFailure(state,error);throw error;}
    if(packet.ok){await store.cache(packet,principal.user.id);if(state.retryAt||state.retryCount)await store.save({...state,retryAt:0,retryCount:0});}
    return packet;
  });}
  async function inspect(){return lock(async()=>{const state=await store.state(),principal=transport.savedIdentity();return {state,principalId:principal?.user.id||null,packet:state.roomId&&principal?await store.cached(state.roomId,principal.user.id):null};});}
  return {execute,refresh,inspect,capabilities};
}
