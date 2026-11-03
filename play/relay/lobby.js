// Durable identity/channel intents, separate from game state and provider auth.
import {clone,invariant,pendingRequest} from './protocol.js';
export function createRelayLobby({principalId,transport,store,locks=globalThis.navigator?.locks,id=()=>crypto.randomUUID(),now=Date.now}={}) {
  const channelId='@admission';
  return {
    async pending(){return (await store.load(principalId,channelId)).outbox[0]?.request??null;},
    async mutate(op,fields) {
      invariant(locks?.request,'UNSUPPORTED_BROWSER','App window coordination is required.');
      return locks.request(`game-shelf-relay:${principalId}:admission`,async()=>{
        const record=await store.load(principalId,channelId);
        invariant(record.retryAt<=now(),'RETRY_COOLDOWN','Wait for the relay cooldown.');
        if(record.outbox.length)invariant(op===undefined,'PENDING_DELIVERY','Retry the unresolved admission request first.');
        else {
          invariant(['profile.set','channel.create','channel.join'].includes(op),'INVALID_OPERATION','Unsupported admission operation.');
          record.outbox.push({request:pendingRequest(op,fields??{},{id,now})});await store.save(record);
        }
        const pending=record.outbox[0].request;
        try {
          const packet=await transport.request(pending,principalId);
          invariant(packet.receipt?.mutationId===pending.mutationId&&packet.receipt.outcome==='stored','INVALID_RECEIPT','Admission is unresolved. Retry its original request.');
          record.outbox=[];record.retryAt=0;record.lastResult={op:pending.op,result:clone(packet.result)};if(packet.result?.channelId)record.lastChannelResult=clone(record.lastResult);await store.save(record);return packet.result;
        }catch(error){record.retryAt=now()+Math.max(0,error.retryAfterMs||0);await store.save(record);throw error;}
      });
    },
    async lastResult(){return (await store.load(principalId,channelId)).lastResult??null;},
    async lastChannel(){return (await store.load(principalId,channelId)).lastChannelResult??null;}
  };
}
