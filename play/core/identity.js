import {PlayError,locked,retryDelay} from './errors.js';
export const AUTH_KEY='spelhyllan-online-auth-v1';
export const AUTH_URL='https://ppaixjqaixwnebhxfjeb.supabase.co';
export const PUBLISHABLE_KEY='sb_publishable_i1LT3xs1l0Fm0ozPVlo7pA_HBfIbcoq'; // Public publishable key.
export const isAccount=user=>!!user?.id&&user.is_anonymous!==true&&(user.app_metadata?.provider==='google'||user.app_metadata?.providers?.includes('google')||user.identities?.some(i=>i.provider==='google'));
export const accountName=user=>(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Player').trim().slice(0,30)||'Player';
export function createIdentity({fetcher=globalThis.fetch,local,locks=globalThis.navigator?.locks,now=Date.now}={}){
  function savedIdentity(){try{const raw=(local??globalThis.localStorage).getItem(AUTH_KEY);if(!raw)return null;const value=JSON.parse(raw);if(!value?.user?.id||!value.refresh_token||!value.access_token)throw new Error();return value;}catch{throw new PlayError('AUTH_REQUIRED','Saved sign-in data could not be read. It has been kept and has not been replaced.');}}
  async function http(url,body,token){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      if(new TextEncoder().encode(JSON.stringify(body)).length>8192)throw new PlayError('PAYLOAD_TOO_LARGE','This move contains too much data. It has not been sent.');
      const response=await fetcher(url,{method:'POST',cache:'no-store',signal:controller.signal,headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
      if(response.status===429)throw new PlayError('RATE_LIMITED','A short pause is needed before reconnecting.',{retryable:true,retryAfterMs:retryDelay(response.headers.get('Retry-After'),now())||5000});
      if(response.status===401||response.status===403||(response.status===400&&url.includes('/auth/')))throw new PlayError('AUTH_REQUIRED','Your player sign-in could not be verified. Your identity and move have been kept.');
      if(response.status>=500||response.status===408)throw new PlayError('SERVER_UNAVAILABLE','The game could not be reached. Your unresolved move has been kept.',{retryable:true});
      try{return await response.json();}catch{throw new PlayError('UNSUPPORTED_VERSION','The response could not be read. Your unresolved move has been kept.');}
    }catch(error){if(error instanceof PlayError)throw error;throw new PlayError('NETWORK_UNAVAILABLE','The connection was interrupted. Reconnect to check your original move.',{retryable:true});}finally{clearTimeout(timer);}
  }
  function identity({forceRefresh=false}={}){return locked('spelhyllan-online-auth',async()=>{
    const saved=savedIdentity();
    if(!isAccount(saved?.user))throw new PlayError('AUTH_REQUIRED','Sign in with Google to play.');
    if(saved&&!forceRefresh&&saved.expires_at>now()/1000+60)return saved;
    const session=await http(`${AUTH_URL}/auth/v1/token?grant_type=refresh_token`,{refresh_token:saved.refresh_token});
    if(!session.access_token||!session.refresh_token||!isAccount(session.user)||saved.user.id!==session.user.id)throw new PlayError('AUTH_REQUIRED','The player identity could not be safely restored. Original data has been kept.');
    session.expires_at ||= Math.floor(now()/1000)+(session.expires_in||3600);
    try{(local??globalThis.localStorage).setItem(AUTH_KEY,JSON.stringify(session));}catch{throw new PlayError('STORAGE_FAILURE','Your player sign-in could not be saved. No room or move was created.');}
    return session;
  },locks);}
  return {identity,savedIdentity};
}
