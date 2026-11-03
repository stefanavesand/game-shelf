import {RelayError,invariant,canonical} from './protocol.js';
export const capabilities=Object.freeze({requiresInternet:true,updates:'poll',orderedDelivery:false,maxMessageBytes:8192,readMayAdvance:false,autonomousProgress:false});
export function createRelayTransport({endpoint,identity,fetcher=globalThis.fetch,timeoutMs=15000,id=()=>crypto.randomUUID(),now=Date.now}={}) {
  invariant(typeof identity==='function','AUTH_REQUIRED','An identity adapter is required.');
  const url=new URL(endpoint,globalThis.location?.href);
  invariant(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)),'INVALID_ENDPOINT','Relay requires HTTPS.');
  async function request(body,principalId,refreshed=false) {
    const auth=await identity({forceRefresh:refreshed});
    invariant(auth?.user?.id===principalId&&auth.access_token,'AUTH_REQUIRED','The original player identity is required.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      if(body.op==='message.append')invariant(new TextEncoder().encode(canonical(body.message.payload)).length<=8192,'PAYLOAD_TOO_LARGE','Message payload exceeds 8 KiB.');
      const encoded=JSON.stringify({...body,requestId:id()});
      invariant(new TextEncoder().encode(encoded).length<=16384,'PAYLOAD_TOO_LARGE','Relay request exceeds 16 KiB.');
      const response=await fetcher(url.href,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:encoded});
      const retry=response.headers.get('Retry-After'),seconds=Number(retry);
      const retryAfterMs=retry?Math.max(0,Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-now()):0;
      if(response.status===429)throw new RelayError('rate_limited','Please wait before reconnecting.',{retryable:true,retryAfterMs:Number.isFinite(retryAfterMs)?retryAfterMs:5000});
      if(response.status===401)throw new RelayError('AUTH_REQUIRED','Sign-in could not be verified. Your pending message is preserved.');
      if(response.status>=500)throw new RelayError('unavailable','Relay unavailable. The message outcome may be unknown.',{retryable:true});
      let packet;try{packet=await response.json();}catch{throw new RelayError('INVALID_RESPONSE','Relay returned unreadable data.');}
      invariant(packet?.protocolVersion===1&&typeof packet.ok==='boolean','UNSUPPORTED_PROTOCOL','Unsupported relay response.');
      if(!packet.ok)throw new RelayError(packet.error?.code||'INVALID_RESPONSE',packet.error?.message||'Relay rejected the request.',{retryable:packet.error?.retryable===true});
      invariant(response.ok,'INVALID_RESPONSE','HTTP status contradicts successful response.');
      return packet;
    } catch(error) {
      if(error instanceof RelayError){if(error.code==='AUTH_REQUIRED'&&!refreshed)return request(body,principalId,true);throw error;}
      throw new RelayError('NETWORK_UNAVAILABLE','Connection interrupted. Retry the original message.',{retryable:true});
    } finally {clearTimeout(timer);}
  }
  return {request,capabilities};
}
