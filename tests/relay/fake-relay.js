// In-memory contract double. It is not evidence that Lovable's backend passes.
import {RelayError,canonical,clone} from '../../play/relay/protocol.js';
export function createLocks() {
  const tails=new Map();return {request(key,work){const result=(tails.get(key)??Promise.resolve()).then(work);tails.set(key,result.catch(()=>{}));return result;}};
}
export function fakeRelay({creator='alice',members=['alice','bob'],channelId='channel'}={}) {
  const messages=[],receipts=new Map(),sent=[];let loseNext=false,readFails=false;
  function transport() {return {async request(body,principal) {
    sent.push({body:clone(body),principal});
    if(!members.includes(principal))throw new RelayError('channel_unavailable','Unavailable.');
    const {requestId:_requestId,...semantic}=body;
    const key=principal+':'+body.mutationId,hash=canonical(semantic),prior=receipts.get(key);
    if(body.op==='capabilities')return {result:{protocolVersions:[1],serverTime:'2026-11-03T12:00:00Z'}};
    if(body.op==='channel.read')return {result:{channelId,creatorId:creator,members:members.map(playerId=>({playerId})),accessExpiresAt:'2026-11-10T00:00:00Z',latestSequence:messages.length}};
    if(body.op==='message.list') {
      if(readFails)throw new RelayError('NETWORK_UNAVAILABLE','Offline.',{retryable:true});
      const batch=messages.slice(body.afterSequence,body.afterSequence+(body.limit??50));
      return {result:{channelId,messages:clone(batch),highWatermark:messages.length,nextAfterSequence:body.afterSequence+batch.length,hasMore:body.afterSequence+batch.length<messages.length,earliestAvailableSequence:1}};
    }
    if(prior) {if(hash!==prior.hash)throw new RelayError('mutation_id_conflict','Changed.');return {...clone(prior.packet),receipt:{...prior.packet.receipt,duplicate:true}};}
    if(body.op==='message.append') {
      if(body.expectedSequence!==messages.length)throw new RelayError('sequence_conflict','Moved.');
      const item={sequence:messages.length+1,senderId:principal,messageId:body.mutationId,message:clone(body.message)};
      messages.push(item);
      const packet={result:{message:clone(item)},receipt:{mutationId:body.mutationId,outcome:'stored',sequence:item.sequence,duplicate:false}};receipts.set(key,{hash,packet});
      if(loseNext){loseNext=false;throw new RelayError('NETWORK_UNAVAILABLE','Response lost.',{retryable:true});}
      return clone(packet);
    }
    if(body.op==='channel.create'||body.op==='channel.join'||body.op==='profile.set') {
      const packet={result:body.op==='profile.set'?{playerId:principal,displayName:body.displayName}:{channelId,inviteToken:'fixture-only',accessExpiresAt:'2026-11-10T00:00:00Z'},receipt:{mutationId:body.mutationId,outcome:'stored'}};
      receipts.set(key,{hash,packet});
      if(loseNext){loseNext=false;throw new RelayError('NETWORK_UNAVAILABLE','Response lost.',{retryable:true});}
      return clone(packet);
    }
    throw new Error('Unexpected operation '+body.op);
  }};}
  return {transport,messages,sent,creator,members,channelId,loseResponse:()=>{loseNext=true;},offline:value=>{readFails=value;}};
}
