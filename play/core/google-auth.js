import {createIdentity,AUTH_KEY,AUTH_URL,PUBLISHABLE_KEY,isAccount,accountName} from './identity.js';
import {PlayError,locked} from './errors.js';
export const GOOGLE_FLOW_KEY='game-shelf-google-pkce-v1';
const LOCK='spelhyllan-online-auth';
export function isGoogleReturn(href){const u=new URL(href),f=new URLSearchParams(u.hash.slice(1));return u.searchParams.has('code')||u.searchParams.has('error')||u.searchParams.has('error_description')||['access_token','refresh_token','error','error_description'].some(k=>f.has(k));}
const google=isAccount;
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function createGoogleAuth({identity=createIdentity(),local,fetcher=globalThis.fetch,locks=globalThis.navigator?.locks,now=Date.now,random=globalThis.crypto}={}){
 const lock=work=>locked(LOCK,work,locks),storage=()=>local??globalThis.localStorage;
 const failure=(code,message)=>new PlayError(code,message);
 const store=(key,value)=>{try{if(value===null)storage().removeItem(key);else storage().setItem(key,JSON.stringify(value));}catch{throw failure('STORAGE_FAILURE','Sign-in could not be saved on this device. Your previous player identity has been kept.');}};
 async function request(path,body,token){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const r=await fetcher(AUTH_URL+'/auth/v1/'+path,{method:'POST',cache:'no-store',signal:controller.signal,headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
   if(!r.ok)throw failure('AUTH_FAILED',r.status===429?'Too many sign-in attempts. Wait a moment and try again.':'Google sign-in could not be completed. Please start sign-in again.');
   return r.status===204?null:await r.json();
  }catch(e){if(e instanceof PlayError)throw e;throw failure('NETWORK_UNAVAILABLE','Sign-in was interrupted. Reconnect and start sign-in again.');}finally{clearTimeout(timer);}
 }
 return {
  profile(){const s=identity.savedIdentity();return google(s?.user)?{id:s.user.id,email:s.user.email||'',name:accountName(s.user)}:null;},
  start(href){return lock(async()=>{
   const old=identity.savedIdentity(),returnUrl=new URL('.',href);if(!['https:','http:'].includes(returnUrl.protocol))throw failure('AUTH_FAILED','Open the installed app or website to sign in.');
   const verifier=base64url(random.getRandomValues(new Uint8Array(32))),challenge=base64url(new Uint8Array(await random.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   store(GOOGLE_FLOW_KEY,{schemaVersion:1,verifier,createdAt:now(),principal:old?.user.id??null,returnUrl:returnUrl.href,returnHash:new URL(href).hash});
   const url=new URL(AUTH_URL+'/auth/v1/authorize');for(const [key,value] of Object.entries({provider:'google',redirect_to:returnUrl.href,code_challenge:challenge,code_challenge_method:'s256',scopes:'openid email profile',prompt:'select_account'}))url.searchParams.set(key,value);
   return url.href;
  });},
  finish(href,cleanUrl){return lock(async()=>{
   const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1)),error=url.searchParams.get('error')||fragment.get('error')||((url.searchParams.has('error_description')||fragment.has('error_description'))?'oauth_error':null),code=url.searchParams.get('code');
   const implicit=fragment.has('access_token')||fragment.has('refresh_token');if(!isGoogleReturn(href))return null;
   // Remove credentials/error parameters before requests, rendering or navigation.
   cleanUrl(url.pathname+'#home');
   let flow;try{flow=JSON.parse(storage().getItem(GOOGLE_FLOW_KEY)||'null');}catch{throw failure('AUTH_FAILED','The sign-in request could not be read. Start sign-in again.');}
   try{
    if(error)throw failure('AUTH_CANCELLED',error==='access_denied'?'Google sign-in was cancelled.':'Google sign-in did not complete. Please try again.');
    if(implicit||!code||code.length>4096||!flow||flow.schemaVersion!==1||!Number.isSafeInteger(flow.createdAt)||now()-flow.createdAt<0||now()-flow.createdAt>600000||!/^[-_a-zA-Z0-9]{43}$/.test(flow.verifier)||flow.returnUrl!==new URL('.',url).href)throw failure('AUTH_FAILED','Start Google sign-in from this app and return to the same browser. Your previous identity has been kept.');
    if((identity.savedIdentity()?.user.id??null)!==flow.principal)throw failure('AUTH_CHANGED','Your player identity changed in another window. Start sign-in again.');
    const result=await request('token?grant_type=pkce',{auth_code:code,code_verifier:flow.verifier});
    if(typeof result?.access_token!=='string'||!result.access_token||typeof result.refresh_token!=='string'||!result.refresh_token||typeof result.user?.id!=='string'||!result.user.id||!google(result.user))throw failure('AUTH_FAILED','The Google account could not be verified. Your previous identity has been kept.');
    const session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:result.expires_at||Math.floor(now()/1000)+(result.expires_in||3600),user:result.user};
    store(AUTH_KEY,session);if(flow.returnHash?.startsWith('#join?'))cleanUrl(url.pathname+flow.returnHash);return {signedIn:true};
   }finally{try{store(GOOGLE_FLOW_KEY,null);}catch{/* A completed exchange cannot be replayed; an unreadable flow is rejected. */}}
  });},
  async signOut(){
   const session=await identity.identity();return lock(async()=>{
    if(identity.savedIdentity()?.user.id!==session.user.id)throw failure('AUTH_CHANGED','Your account changed in another window. Please try again.');
    if(!google(session.user))throw failure('AUTH_FAILED','Sign in with Google to manage your account.');
    await request('logout?scope=local',{},session.access_token);store(AUTH_KEY,null);store(GOOGLE_FLOW_KEY,null);
   });
  }
 };
}
