import {RelayError,invariant,canonical} from './protocol.js';
const timings=[];
const operationNames=new Set(['capabilities','profile.get','profile.set','channel.create','channel.join','channel.read','message.append','message.list','receipt.get']);
export function relayPerformanceSnapshot(){return [...new Set(timings.map(s=>s.op))].map(op=>{const samples=timings.filter(s=>s.op===op),values=samples.map(s=>s.ms).sort((a,b)=>a-b);return {op,count:values.length,failures:samples.filter(s=>!s.ok).length,medianMs:values[Math.floor(values.length/2)],p95Ms:values[Math.ceil(values.length*.95)-1]};});}
const recordTiming=sample=>{timings.push(sample);if(timings.length>120)timings.shift();};
export const capabilities=Object.freeze({requiresInternet:true,updates:'poll',orderedDelivery:false,maxMessageBytes:8192,readMayAdvance:false,autonomousProgress:false});
export function createRelayTransport({endpoint,identity,fetcher=globalThis.fetch,timeoutMs=15000,id=()=>crypto.randomUUID(),now=Date.now,clock=()=>globalThis.performance?.now()??Date.now(),onTiming=recordTiming}={}) {
  invariant(typeof identity==='function','AUTH_REQUIRED','An identity adapter is required.');
  const url=new URL(endpoint,globalThis.location?.href);
  invariant(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)),'INVALID_ENDPOINT','Relay requires HTTPS.');
  async function request(body,principalId,refreshed=false) {
    const auth=await identity({forceRefresh:refreshed});
    invariant(auth?.user?.id===principalId&&auth.access_token,'AUTH_REQUIRED','The original player identity is required.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    let started,status=0,ok=false;
    try {
      if(body.op==='message.append')invariant(new TextEncoder().encode(canonical(body.message.payload)).length<=8192,'PAYLOAD_TOO_LARGE','Message payload exceeds 8 KiB.');
      const encoded=JSON.stringify({...body,requestId:id()});
      invariant(new TextEncoder().encode(encoded).length<=16384,'PAYLOAD_TOO_LARGE','Relay request exceeds 16 KiB.');
      started=clock();
      const response=await fetcher(url.href,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:encoded});
      status=response.status;
      const retry=response.headers.get('Retry-After'),seconds=Number(retry);
      const retryAfterMs=retry?Math.max(0,Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-now()):0;
      if(response.status===429)throw new RelayError('rate_limited','Please wait before reconnecting.',{retryable:true,retryAfterMs:Number.isFinite(retryAfterMs)?retryAfterMs:5000});
      if(response.status===401)throw new RelayError('AUTH_REQUIRED','Sign-in could not be verified. Your pending message is preserved.');
      if(response.status>=500)throw new RelayError('unavailable','Relay unavailable. The message outcome may be unknown.',{retryable:true});
      let packet;try{packet=await response.json();}catch{throw new RelayError('INVALID_RESPONSE','Relay returned unreadable data.');}
      invariant(packet?.protocolVersion===1&&typeof packet.ok==='boolean','UNSUPPORTED_PROTOCOL','Unsupported relay response.');
      if(!packet.ok)throw new RelayError(packet.error?.code||'INVALID_RESPONSE',packet.error?.message||'Relay rejected the request.',{retryable:packet.error?.retryable===true});
      invariant(response.ok,'INVALID_RESPONSE','HTTP status contradicts successful response.');
      ok=true;return packet;
    } catch(error) {
      if(error instanceof RelayError){if(error.code==='AUTH_REQUIRED'&&!refreshed)return request(body,principalId,true);throw error;}
      throw new RelayError('NETWORK_UNAVAILABLE','Connection interrupted. Retry the original message.',{retryable:true});
    } finally {clearTimeout(timer);if(started!==undefined)try{onTiming({op:operationNames.has(body.op)?body.op:'other',ms:Math.round(Math.max(0,clock()-started)),status,ok});}catch{/* Diagnostic callbacks never change delivery semantics. */}}
  }
  return {request,capabilities};
}
