export class PlayError extends Error {
  constructor(code,message,{retryable=false,retryAfterMs=0}={}){super(message);this.name='PlayError';this.code=code;this.retryable=retryable;this.retryAfterMs=retryAfterMs;}
}
export function retryDelay(header,now=Date.now()){
  if(!header)return 0;
  const seconds=Number(header);
  return Math.max(0,Number.isFinite(seconds)?seconds*1000:(Date.parse(header)||now)-now);
}
export function locked(name,work,locks=globalThis.navigator?.locks){
  if(!locks?.request)throw new PlayError('UNSUPPORTED_BROWSER','This browser cannot safely coordinate player data across app windows. Please use a current Safari or Chrome.');
  return locks.request(name,work);
}
