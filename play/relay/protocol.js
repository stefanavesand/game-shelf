// Provider-independent relay framing. No game rules or credentials belong here.
export class RelayError extends Error {
  constructor(code, message, {retryable=false, retryAfterMs=0}={}) {
    super(message); this.name='RelayError'; Object.assign(this,{code,retryable,retryAfterMs});
  }
}
export const clone=value=>structuredClone(value);
export function canonical(value) {
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isSafeInteger(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  throw new RelayError('INVALID_DATA','Protocol data must contain JSON values and safe integers only.');
}
export async function digest(value) {
  const bytes=new TextEncoder().encode(canonical(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export const invariant=(condition,code,message)=>{if(!condition)throw new RelayError(code,message);};
export const text=value=>typeof value==='string'&&value.length>0;
export const sequence=value=>Number.isSafeInteger(value)&&value>=0;
export function validateMessage(value) {
  invariant(value&&sequence(value.sequence)&&value.sequence>0&&text(value.senderId)&&text(value.messageId),'INVALID_RESPONSE','Invalid ordered message metadata.');
  invariant(text(value.message?.schema)&&text(value.message?.type),'INVALID_RESPONSE','Invalid message envelope.');
  canonical(value.message); return value;
}
export function validatePage(page,after) {
  invariant(page&&Array.isArray(page.messages)&&sequence(page.highWatermark)&&sequence(page.nextAfterSequence)&&typeof page.hasMore==='boolean','INVALID_RESPONSE','Invalid relay page.');
  invariant(sequence(page.earliestAvailableSequence),'INVALID_RESPONSE','Missing history boundary.');
  invariant(page.earliestAvailableSequence<=after+1,'HISTORY_UNAVAILABLE','Required messages are no longer available.');
  let next=after;
  for(const item of page.messages){validateMessage(item);invariant(item.sequence===++next,'SEQUENCE_GAP','Messages must be consecutive and in order.');}
  invariant(page.nextAfterSequence===next&&page.highWatermark>=next&&page.hasMore===(next<page.highWatermark),'INVALID_RESPONSE','Inconsistent relay cursor.');
  invariant(!page.hasMore||page.messages.length>0,'INVALID_RESPONSE','Relay pagination made no progress.');
  return page;
}
export function pendingRequest(op,fields,{id=()=>crypto.randomUUID(),now=Date.now}={}) {
  const request={protocolVersion:1,op,mutationId:id(),intentCreatedAt:new Date(now()).toISOString(),...clone(fields)};
  canonical(request); return request;
}
