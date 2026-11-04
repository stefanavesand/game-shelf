/* Offline app shell only: never cache identities or API responses. */
importScripts('./offline-assets.js','./update-state.js');
const ROOT=new URL('../',self.registration.scope),NAME='game-shelf-offline-'+self.OFFLINE_VERSION;
const FILES=[...self.OFFLINE_ASSETS,{path:'play/offline-assets.js',sha256:'68806f8ce1413476d5debd62bf6495f81653fac3a9331ab4614c9f810a09fc68'}];
const url=path=>new URL(path,ROOT).href;
async function valid(response,hash){if(!response?.ok)return false;const value=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('')===hash;}
async function verified(){const cache=await caches.open(NAME);for(const f of FILES)if(!await valid(await cache.match(url(f.path)),f.sha256))return false;return FILES.length>1;}
let downloadTask;
async function download(){
 if(downloadTask)return downloadTask;
 downloadTask=(async()=>{
  const existed=await caches.has(NAME),staging=NAME+'-download';
  try{
   if(!self.OFFLINE_ASSETS.length)throw Error('Offline package missing.');
   const temporary=await caches.open(staging);
   for(const f of FILES){const response=await fetch(url(f.path),{cache:'reload'});if(!await valid(response.clone(),f.sha256))throw Error('Incomplete offline package.');await temporary.put(url(f.path),response);}
   const cache=await caches.open(NAME);
   for(const f of FILES)await cache.put(url(f.path),await temporary.match(url(f.path)));
   if(!await verified())throw Error('Offline verification failed.');
  }catch(error){if(!existed)await caches.delete(NAME);throw error;}
  finally{await caches.delete(staging);}
 })();
 try{await downloadTask;}finally{downloadTask=null;}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{await navigator.locks.request('game-shelf-app-lifecycle',{mode:'exclusive'},async()=>{
  if(!await self.GameShelfUpdateState.compatible(self.OFFLINE_ENGINE))throw Error('Saved games or pending moves block this update');
  await self.GameShelfUpdateState.setFence({schemaVersion:1,version:self.OFFLINE_VERSION,engine:self.OFFLINE_ENGINE});
 });}catch(error){for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'UPDATE_BLOCKED'});throw error;}
 await download();
})()));
// Updated workers wait for an explicit safe activation request.
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const name of await caches.keys())if(name.startsWith('game-shelf-offline-')&&name!==NAME)await caches.delete(name);})()));
self.addEventListener('message',event=>{
 event.waitUntil((async()=>{
  const type=event.data?.type;
  if(type==='REPAIR'){try{await download();}catch{/* Keep the current app; report verification failure below. */}}
  const ready=['CHECK','REPAIR','ACTIVATE'].includes(type)?await verified():false;
  event.ports[0]?.postMessage({version:self.OFFLINE_VERSION,engine:self.OFFLINE_ENGINE,ready});
  if(type==='ACTIVATE'&&ready)await self.skipWaiting();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url);if(request.method!=='GET'||u.origin!==ROOT.origin)return;
 const path=u.pathname.slice(ROOT.pathname.length);if(!path.startsWith('play/')&&!path.startsWith('ui/'))return;
 event.respondWith((async()=>{const cache=await caches.open(NAME),key=new URL(u);key.search='';key.hash='';
  if(request.mode==='navigate'&&key.pathname.endsWith('/'))key.pathname+='index.html';
  const cached=await cache.match(key.href);if(cached)return cached;
  const expected=FILES.find(f=>url(f.path)===key.href);
  if(!expected)return fetch(request);
  try{const response=await fetch(request);if(!await valid(response.clone(),expected.sha256))return new Response('Compatible app resources unavailable. Saved games have not been deleted.',{status:503});await cache.put(key.href,response.clone());return response;}
  catch{return new Response('App resource unavailable. Reconnect to restore compatible files.',{status:503});}
 })());
});
