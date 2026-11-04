/* Offline app shell only: never cache identities or API responses. */
importScripts('./offline-assets.js');
const ROOT=new URL('../',self.registration.scope),NAME='game-shelf-offline-'+self.OFFLINE_VERSION;
const FILES=[...self.OFFLINE_ASSETS,{path:'play/offline-assets.js',sha256:'bded39d1f026a94611682e617ff70ee875a87840faac27c7fe5a5f2b7a25f0ff'}];
const url=path=>new URL(path,ROOT).href;
async function valid(response,hash){if(!response?.ok)return false;const value=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('')===hash;}
async function verified(){const cache=await caches.open(NAME);for(const f of FILES)if(!await valid(await cache.match(url(f.path)),f.sha256))return false;return FILES.length>1;}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 if(!self.OFFLINE_ASSETS.length)throw Error('Offline package missing.');
 const cache=await caches.open(NAME);
 try{for(const f of FILES){const response=await fetch(url(f.path),{cache:'reload'});if(!await valid(response.clone(),f.sha256))throw Error('Incomplete offline package.');await cache.put(url(f.path),response);}if(!await verified())throw Error('Offline verification failed.');}
 catch(error){await caches.delete(NAME);throw error;}
 // Updated workers wait for an explicit safe activation request.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const name of await caches.keys())if(name.startsWith('game-shelf-offline-')&&name!==NAME)await caches.delete(name);})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE'){self.skipWaiting();return;}
 event.waitUntil((async()=>{event.ports[0]?.postMessage({version:self.OFFLINE_VERSION,engine:self.OFFLINE_ENGINE,ready:event.data?.type==='CHECK'?await verified():false});})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url);if(request.method!=='GET'||u.origin!==ROOT.origin)return;
 const path=u.pathname.slice(ROOT.pathname.length);if(!path.startsWith('play/')&&!path.startsWith('ui/'))return;
 event.respondWith((async()=>{const cache=await caches.open(NAME),key=new URL(u);key.search='';key.hash='';
  if(request.mode==='navigate'&&key.pathname.endsWith('/'))key.pathname+='index.html';
  return await cache.match(key.href)||fetch(request);
 })());
});
