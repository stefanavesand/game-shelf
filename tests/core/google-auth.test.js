import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createGoogleAuth,GOOGLE_FLOW_KEY,isGoogleReturn} from '../../play/core/google-auth.js';
import {createIdentity,AUTH_KEY} from '../../play/core/identity.js';
import {createLocks} from '../relay/fake-relay.js';
const href='https://stefanavesand.github.io/game-shelf/play/#home',callback='https://stefanavesand.github.io/game-shelf/play/?code=one-use-code';
const guest={access_token:'guest-access',refresh_token:'guest-refresh',expires_at:9999999999,user:{id:'guest',is_anonymous:true}};
const session={access_token:'google-access',refresh_token:'google-refresh',expires_in:3600,user:{id:'google-player',email:'player@example.test',is_anonymous:false,app_metadata:{provider:'google'}}};
function harness({saved=guest,respond=()=>new Response(JSON.stringify(session),{status:200})}={}){
 const data=new Map(saved?[[AUTH_KEY,JSON.stringify(saved)]]:[]),local={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},locks=createLocks(),calls=[];let now=1000000;
 const fetcher=async(url,options)=>{calls.push({url,options});return respond(url,options);},identity=createIdentity({local,locks,fetcher,now:()=>now}),auth=createGoogleAuth({identity,local,locks,fetcher,now:()=>now});
 return {auth,identity,local,data,calls,advance:n=>{now+=n;}};
}
test('Google authorization uses random PKCE and does not replace the guest before exchange',async()=>{
 const h=harness(),url=new URL(await h.auth.start(href)),flow=JSON.parse(h.local.getItem(GOOGLE_FLOW_KEY));assert.equal(url.host,'ppaixjqaixwnebhxfjeb.supabase.co');assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('redirect_to'),href.split('#')[0]);
 assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(flow.verifier).digest('base64url'));assert.equal(flow.verifier.length,43);assert.equal(h.identity.savedIdentity().user.id,'guest');assert.equal(h.calls.length,0);
 let clean;assert.deepEqual(await h.auth.finish(callback,p=>{clean=p;}),{signedIn:true});assert.equal(clean,'/game-shelf/play/#home');assert.equal(h.identity.savedIdentity().user.id,'google-player');assert.equal(h.auth.profile().email,'player@example.test');assert.equal(h.local.getItem(GOOGLE_FLOW_KEY),null);
 assert.deepEqual(JSON.parse(h.calls[0].options.body),{auth_code:'one-use-code',code_verifier:flow.verifier});assert.match(h.calls[0].url,/grant_type=pkce/);
 await assert.rejects(h.auth.finish(callback,()=>{}));assert.equal(h.calls.length,1);
});
test('fresh Google login creates no preliminary anonymous account',async()=>{
 const h=harness({saved:null});assert.equal(h.auth.profile(),null);await h.auth.start(href);await h.auth.finish(callback,()=>{});assert.equal(h.identity.savedIdentity().user.id,'google-player');assert.equal(h.calls.length,1);assert.ok(h.calls.every(c=>!c.url.includes('signup')));
});
test('normal app navigation performs no authentication request',async()=>{const h=harness();assert.equal(isGoogleReturn(href),false);assert.equal(await h.auth.finish(href,()=>assert.fail()),null);assert.equal(h.calls.length,0);});
test('cancelled consent scrubs the callback and keeps the guest identity',async()=>{const h=harness();await h.auth.start(href);let cleaned=false;await assert.rejects(h.auth.finish(callback.replace('code=one-use-code','error=access_denied'),()=>{cleaned=true;}),e=>e.code==='AUTH_CANCELLED');assert.ok(cleaned);assert.deepEqual(h.identity.savedIdentity(),guest);assert.equal(h.calls.length,0);});
test('unsolicited implicit tokens, missing verifier and expired flow never replace identity',async()=>{
 for(const mode of ['implicit','missing','expired','empty','oversized']){const h=harness();if(mode!=='missing')await h.auth.start(href);if(mode==='expired')h.advance(600001);let cleaned=false;const url=mode==='implicit'?href.replace('#home','#access_token=untrusted&refresh_token=untrusted'):mode==='empty'?callback.replace('one-use-code',''):mode==='oversized'?callback.replace('one-use-code','x'.repeat(4097)):callback;assert.equal(isGoogleReturn(url),true);await assert.rejects(h.auth.finish(url,()=>{cleaned=true;}));assert.ok(cleaned);assert.deepEqual(h.identity.savedIdentity(),guest);assert.equal(h.calls.length,0);}
});
test('another window changing player identity invalidates the pending flow',async()=>{const h=harness();await h.auth.start(href);h.local.setItem(AUTH_KEY,JSON.stringify({...guest,user:{id:'other'}}));await assert.rejects(h.auth.finish(callback,()=>{}),e=>e.code==='AUTH_CHANGED');assert.equal(h.identity.savedIdentity().user.id,'other');assert.equal(h.calls.length,0);});
test('exchange failure or non-Google result preserves the previous identity',async()=>{
 for(const respond of [()=>{throw Error('offline');},()=>new Response('{}',{status:400}),()=>new Response(JSON.stringify(guest),{status:200}),()=>new Response(JSON.stringify({...session,access_token:{invalid:true}}),{status:200})]){const h=harness({respond});await h.auth.start(href);await assert.rejects(h.auth.finish(callback,()=>{}));assert.deepEqual(h.identity.savedIdentity(),guest);}
});
test('storage failure prevents redirect or replacing the saved session',async()=>{
 const h=harness();const set=h.local.setItem;h.local.setItem=()=>{throw Error('quota');};await assert.rejects(h.auth.start(href),e=>e.code==='STORAGE_FAILURE');assert.equal(h.calls.length,0);h.local.setItem=set;await h.auth.start(href);h.local.setItem=(k,v)=>{if(k===AUTH_KEY)throw Error('quota');set(k,v);};await assert.rejects(h.auth.finish(callback,()=>{}),e=>e.code==='STORAGE_FAILURE');assert.deepEqual(h.identity.savedIdentity(),guest);
});
test('sign-out revokes only the current session and keeps credentials if the request fails',async()=>{
 const signed={...session,expires_at:9999999999};const h=harness({saved:signed,respond:()=>new Response(null,{status:204})});await h.auth.signOut();assert.equal(h.identity.savedIdentity(),null);assert.match(h.calls[0].url,/logout\?scope=local$/);assert.equal(h.calls[0].options.headers.Authorization,'Bearer google-access');
 const failed=harness({saved:signed,respond:()=>new Response('{}',{status:500})});await assert.rejects(failed.auth.signOut());assert.equal(failed.identity.savedIdentity().user.id,'google-player');
 const anonymous=harness();await assert.rejects(anonymous.auth.signOut());assert.equal(anonymous.calls.length,0);
});

test('game identity never creates an anonymous account, even when an old caller requests it',async()=>{
 for(const saved of [null,guest]){const h=harness({saved});await assert.rejects(h.identity.identity({allowCreate:true}),e=>e.code==='AUTH_REQUIRED');assert.equal(h.calls.length,0);}
});
test('Google flow restores an invitation after a successful exchange',async()=>{
 const h=harness({saved:null});await h.auth.start(href.replace('#home','#join?room=room-id&invite=private-token'));let clean;await h.auth.finish(callback,path=>{clean=path;});assert.equal(clean,'/game-shelf/play/#join?room=room-id&invite=private-token');
});
