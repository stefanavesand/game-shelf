import {clone,invariant,pendingRequest,validatePage,RelayError,digest,canonical,validateMessage} from './protocol.js';
import {applyMessage,beginMessage,commandMessage,configureMessage,proposalMessage,resolutionMessage} from './replica.js';
import {validateRecord} from './store.js';
export function createRelayClient({principalId,channelId,creatorId,members,module,store,transport,locks=globalThis.navigator?.locks,id=()=>crypto.randomUUID(),now=Date.now,maxPages=20,createEffects=()=>({}),observeRecord=null,refreshMembers=null}={}) {
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
  async function replay(record,items){
    let next=record;
    for(const item of items){
      if(!members.includes(item.senderId)&&refreshMembers){const updated=await refreshMembers();invariant(Array.isArray(updated)&&updated.includes(principalId)&&updated.includes(creatorId),'INVALID_MEMBERS','Invalid refreshed membership.');members=updated;}
      const before=next,applied=await applyMessage(before,item,{module,creatorId,members});next=applied.record;
      if(observeRecord){const observations=observeRecord(before,next);if(observations!==undefined)next.observations=observations;}
      for(const message of applied.notifications)enqueue(next,message);
    }
    return next;
  }
  function confirmedAppend(packet,pending,record){
    const result=packet.result,receipt=packet.receipt,request=pending.request;
    if(receipt.channelId!==undefined)invariant(receipt.channelId===channelId,'INVALID_RECEIPT','Receipt belongs to another channel.');
    if(receipt.op!==undefined)invariant(receipt.op==='message.append','INVALID_RECEIPT','Receipt confirms another operation.');
    let item;
    if(result?.channelId!==undefined)invariant(result.channelId===channelId,'INVALID_RECEIPT','Append result belongs to another channel.');
    if(result?.message){item=validateMessage(result.message);invariant(item.sequence===receipt.sequence&&item.messageId===request.mutationId&&item.senderId===principalId&&canonical(item.message)===canonical(request.message),'INVALID_RECEIPT','Append echo does not match the original message.');}
    else if(result&&['channelId','messageId','sequence'].every(k=>Object.hasOwn(result,k))){
      invariant(result.channelId===channelId&&result.messageId===request.mutationId&&result.sequence===receipt.sequence,'INVALID_RECEIPT','Append result does not match its receipt.');
      item={sequence:result.sequence,messageId:result.messageId,senderId:principalId,message:clone(request.message)};
    }
    // The accepted compare-and-swap proves this is the next ordered message.
    // Opaque/older replies and non-adjacent duplicate receipts still use log replay.
    if(!item||request.expectedSequence!==record.cursor||item.sequence!==record.cursor+1)return null;
    invariant(canonical(pending.message)===canonical(request.message),'INVALID_SAVE','Pending message differs from its persisted request.');
    return item;
  }
  async function catchUp(record) {
    for(let count=0;count<maxPages;count++) {
      const {result}=await transport.request({protocolVersion:1,op:'message.list',channelId,afterSequence:record.cursor,limit:50},principalId);
      invariant(result?.channelId===channelId,'INVALID_RESPONSE','Relay page belongs to another channel.');
      const page=validatePage(result,record.cursor);
      const next=await replay(record,page.messages);
      // Cursor, state, incident and generated replies commit together.
      if(page.messages.length)await save(next);record=next;
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
      invariant(packet.receipt.sequence===pending.request.expectedSequence+1,'INVALID_RECEIPT','Receipt sequence contradicts the accepted append.');
      const item=confirmedAppend(packet,pending,record);
      if(item){
        const next=await replay(record,[item]);next.outbox.shift();next.retryAt=0;
        await save(next);record=next; // State, cursor, observations and receipt removal commit together.
      }else{record.outbox.shift();record.retryAt=0;await save(record);record=await catchUp(record);}
    }
    return record;
  }
  async function syncWork() {
    let record=await load();
    invariant(record.retryAt<=now(),'RETRY_COOLDOWN','Wait for the relay cooldown before trying again.');
    // Resolve an unknown delivery before changing its envelope or generating a replacement.
    if(record.outbox[0]?.request)record=await flush(record);
    if(record.outbox.length)record=await flush(record);
    record=await catchUp(record);
    if(principalId===creatorId&&record.game&&!record.halt){
      const request=Object.values(record.game.randomRequests||{}).find(r=>!r.superseded&&r.baseGameRevision===record.game.revision&&!Object.hasOwn(record.game.seen,r.intentId));
      if(request&&!record.outbox.some(p=>p.message.type==='game.resolve'&&p.message.payload.intentId===request.intentId)){enqueue(record,await resolutionMessage(record,module,request,createEffects(record.game.state,request.command),{coordinatorId:creatorId}));await save(record);}
    }
    return flush(record);
  }
  async function submit(messageFactory) {
    return locked(async()=>{
      let record=await syncWork();
      invariant(!record.halt,'GAME_HALTED','Game stopped because clients disagreed. Start a new game.');
      invariant(record.outbox.length===0,'PENDING_DELIVERY','Resolve pending messages before proposing another move.');
      const message=await messageFactory(record);if(!message)return record;enqueue(record,message);await save(record);return flush(record);
    });
  }
  return {
    state:()=>locked(load),
    sync:()=>locked(syncWork),
    configure:config=>submit(record=>{invariant(principalId===creatorId&&!record.game&&!record.lobby,'NOT_CREATOR','Only the creator may configure this lobby.');return configureMessage(module,config);}),
    begin:config=>submit(async record=>{invariant(principalId===creatorId&&!record.game,'NOT_CREATOR','Only the creator may start this game.');return beginMessage(module,config,id());}),
    command:(command,effects={},expected={})=>submit(record=>{
      invariant((expected.revision===undefined||expected.revision===record.game?.revision)&&(expected.hash===undefined||expected.hash===record.game?.hash),'STALE_GAME','The game changed. Review your action again.');
      const coordinated=module.requiresCoordinator?.(record.game?.state,command);
      if(Object.values(record.game?.randomRequests||{}).some(r=>!r.superseded&&r.baseGameRevision===record.game.revision&&!Object.hasOwn(record.game.seen,r.intentId)))return null;
      if(coordinated&&principalId!==creatorId)return proposalMessage(record,module,command,id(),{coordinatorId:creatorId});
      if(coordinated)module.validateRequest(record.game.state,principalId,command,{coordinatorId:creatorId});
      return commandMessage(record,module,command,coordinated?createEffects(record.game.state,command):effects,id(),{coordinatorId:creatorId});
    }),
    async haltStatus(){return (await load()).halt;}
  };
}
