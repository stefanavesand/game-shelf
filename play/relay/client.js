import {clone,invariant,pendingRequest,validatePage,RelayError,digest} from './protocol.js';
import {applyMessage,beginMessage,commandMessage} from './replica.js';
import {validateRecord} from './store.js';
export function createRelayClient({principalId,channelId,creatorId,members,module,store,transport,locks=globalThis.navigator?.locks,id=()=>crypto.randomUUID(),now=Date.now,maxPages=20}={}) {
  invariant(members.includes(principalId)&&members.includes(creatorId),'INVALID_MEMBERS','Invalid channel participant binding.');
  const key=`game-shelf-relay:${principalId}:${channelId}`;
  const locked=work=>{invariant(locks?.request,'UNSUPPORTED_BROWSER','This browser cannot coordinate app windows safely.');return locks.request(key,work);};
  const load=async()=>{
    const record=validateRecord(await store.load(principalId,channelId),principalId,channelId);
    if(record.game){
      invariant(record.game.moduleId===module.id&&record.game.moduleVersion===module.version&&record.game.moduleDigest===module.digest,'UNSUPPORTED_ENGINE','Saved game requires the exact pinned engine.');
      invariant(await digest(record.game.state)===record.game.hash,'INVALID_SAVE','Saved game state failed its integrity check.');
    }
    return record;
  };
  const save=record=>store.save(record);
  function enqueue(record,message){record.outbox.push({message:clone(message),request:null});}
  async function catchUp(record) {
    for(let count=0;count<maxPages;count++) {
      const {result}=await transport.request({protocolVersion:1,op:'message.list',channelId,afterSequence:record.cursor,limit:50},principalId);
      invariant(result?.channelId===channelId,'INVALID_RESPONSE','Relay page belongs to another channel.');
      const page=validatePage(result,record.cursor);
      let next=record;
      for(const item of page.messages) {
        const applied=await applyMessage(next,item,{module,creatorId,members});next=applied.record;
        for(const message of applied.notifications)enqueue(next,message);
      }
      // Cursor, state, incident and generated replies commit together.
      await save(next);record=next;
      if(!page.hasMore)return record;
    }
    throw new RelayError('CATCH_UP_LIMIT','More history remains. Synchronize again before playing.',{retryable:true});
  }
  async function flush(record) {
    for(let count=0;record.outbox.length&&count<20;count++) {
      const pending=record.outbox[0];
      if(!pending.request) {
        pending.request=pendingRequest('message.append',{channelId,expectedSequence:record.cursor,message:pending.message},{id,now});
        await save(record); // Persist exact ID/body before a single network mutation.
      }
      let packet;
      try {packet=await transport.request(pending.request,principalId);}
      catch(error) {
        if(error.code==='sequence_conflict') {
          // Definitive CAS rejection. Keep the game intent but generate a new relay ID next pass.
          pending.request=null;await save(record);record=await catchUp(record);continue;
        }
        record.retryAt=now()+Math.max(0,error.retryAfterMs||0);await save(record);throw error;
      }
      invariant(packet.receipt?.mutationId===pending.request.mutationId&&packet.receipt?.outcome==='stored'&&Number.isSafeInteger(packet.receipt.sequence)&&packet.receipt.sequence>0,'INVALID_RECEIPT','Delivery could not be confirmed. Original intent is preserved.');
      record.outbox.shift();record.retryAt=0;await save(record);
      record=await catchUp(record);
    }
    return record;
  }
  async function syncWork() {
    let record=await load();
    invariant(record.retryAt<=now(),'RETRY_COOLDOWN','Wait for the relay cooldown before trying again.');
    // Resolve an unknown delivery before changing its envelope or generating a replacement.
    if(record.outbox[0]?.request)record=await flush(record);
    record=await catchUp(record);return flush(record);
  }
  async function submit(messageFactory) {
    return locked(async()=>{
      let record=await syncWork();
      invariant(!record.halt,'GAME_HALTED','Game stopped because clients disagreed. Start a new game.');
      invariant(record.outbox.length===0,'PENDING_DELIVERY','Resolve pending messages before proposing another move.');
      enqueue(record,await messageFactory(record));await save(record);return flush(record);
    });
  }
  return {
    state:()=>locked(load),
    sync:()=>locked(syncWork),
    begin:config=>submit(async record=>{invariant(principalId===creatorId&&!record.game,'NOT_CREATOR','Only the creator may start this game.');return beginMessage(module,config,id());}),
    command:(command,effects={})=>submit(record=>commandMessage(record,module,command,effects,id(),{coordinatorId:creatorId})),
    async haltStatus(){return (await load()).halt;}
  };
}
