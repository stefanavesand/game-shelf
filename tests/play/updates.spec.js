import {test,expect} from './account-fixture.js';
import {fakeRelay} from '../relay/fake-relay.js';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {offlineVersion} from '../../scripts/offline-version.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const packageRoot=process.env.GAME_SHELF_STATIC_ROOT==='dist'?'dist':'.';
async function updateServer({differentEngine=false,workerOnly=false,automatic=false,breaking=false}={}){
 const script=await readFile(path.join(packageRoot,'play/offline-assets.js'),'utf8');
 const assets=JSON.parse(script.match(/self\.OFFLINE_ASSETS=(\[.*\]);/)[1]),engine=JSON.parse(script.match(/self\.OFFLINE_ENGINE=("[^"]*")/)[1]);
 const version=JSON.parse(script.match(/self\.OFFLINE_VERSION=("[^"]*")/)[1]);
 const original=new Map(await Promise.all([...assets.map(a=>a.path),'play/offline-assets.js','play/sw.js'].map(async f=>[f,await readFile(path.join(packageRoot,f))])));
 const template=(await readFile('scripts/sw-template.js','utf8'))+(workerOnly?'\n// Worker-only test release.\n':'');
 const candidate=new Map(original),changed=workerOnly?original.get('play/help.js'):Buffer.concat([original.get('play/help.js'),Buffer.from('\n// Update test candidate.\n')]);candidate.set('play/help.js',changed);
 const nextAssets=assets.map(a=>a.path==='play/help.js'?{...a,sha256:sha(changed)}:a),nextVersion=offlineVersion(nextAssets,template);
 const nextScript=Buffer.from('// Generated test candidate.\nself.OFFLINE_VERSION='+JSON.stringify(nextVersion)+';self.OFFLINE_ENGINE='+JSON.stringify(differentEngine?'future-engine-test':engine)+(automatic?';self.OFFLINE_RELEASE="test-auto";self.OFFLINE_BREAKING='+JSON.stringify(breaking):'')+';self.OFFLINE_ASSETS='+JSON.stringify(nextAssets)+';\n');candidate.set('play/offline-assets.js',nextScript);
 candidate.set('play/sw.js',Buffer.from(template.replace('__OFFLINE_SCRIPT_SHA__',sha(nextScript))));
 let next=false,fail=false,failures=0;
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname,relative=pathname.replace(/^\/game-shelf\//,'').replace(/\/$/,'/index.html');
  if(!pathname.startsWith('/game-shelf/')){res.writeHead(404).end();return;}
  if(fail&&relative==='play/help.js'){failures++;res.writeHead(503).end('Interrupted download');return;}
  const body=(next?candidate:original).get(relative);if(!body){res.writeHead(404).end();return;}
  const ext=path.extname(relative),type={'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[ext]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}/game-shelf/play/`,version,nextVersion,failures:()=>failures,downgrade:()=>{next=false;fail=false;},setFailure:value=>{fail=value;},upgrade:broken=>{next=true;fail=broken;},close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
async function open(browser,options){
 const server=await updateServer(options),context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();await page.goto(server.url+'#home');await expect(page.locator('#offline-status')).toHaveText('Ready for offline',{timeout:30000});return {server,context,page};
}
async function solo(page){await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');await expect.poll(()=>page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.botWorkPending;})).toBe(false);return page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});}
async function status(page){return page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);r.active.postMessage({type:'CHECK'},[c.port2]);});});}
async function update(page){await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});}
async function cleanup(f){await f.context.close();await f.server.close();}

for(const workerOnly of [false,true])test(`a failed ${workerOnly?'worker-only':'UI'} update removes its partial cache and keeps the previous offline game`,async({browser})=>{
 const f=await open(browser,{workerOnly});try{const before=await solo(f.page);f.server.upgrade(true);await update(f.page);await expect.poll(f.server.failures).toBeGreaterThan(0);await expect(f.page.locator('#offline-status')).toContainText('Offline download failed');
  expect((await status(f.page)).version).toBe(f.server.version);expect((await status(f.page)).ready).toBe(true);
  const cachesPresent=await f.page.evaluate(()=>caches.keys());expect(cachesPresent).toContain('game-shelf-offline-'+f.server.version);expect(cachesPresent).not.toContain('game-shelf-offline-'+f.server.nextVersion);
  await f.context.setOffline(true);await f.page.reload();await expect(f.page.locator('#connection')).toHaveText('Local · saved');const after=await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});expect(after).toEqual(before);
 }finally{await cleanup(f);}
});
test('a complete compatible update waits until home and preserves the unfinished game after activation',async({browser})=>{
 const f=await open(browser);try{const before=await solo(f.page);f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toContainText('Finish the game or return home');expect((await status(f.page)).version).toBe(f.server.version);
  await f.page.getByRole('link',{name:'Game Shelf home',exact:true}).click();await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
  await f.context.setOffline(true);await f.page.getByRole('button',{name:'Resume game',exact:true}).click();await expect(f.page.locator('#connection')).toHaveText('Local · saved');const after=await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});expect(after).toEqual(before);
 }finally{await cleanup(f);}
});
test('an incompatible engine cannot install over a pinned game, including after the last window closes',async({browser})=>{
 const f=await open(browser,{differentEngine:true});try{const before=await solo(f.page);await f.page.getByRole('link',{name:'Game Shelf home',exact:true}).click();f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toContainText('Update blocked');expect((await status(f.page)).version).toBe(f.server.version);expect(await f.page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
  await f.page.close();f.page=await f.context.newPage();await f.page.goto(f.server.url+'#home');expect((await status(f.page)).version).toBe(f.server.version);expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.roomId;})).toBe(before.room);
  await f.page.getByRole('button',{name:'Abandon game',exact:true}).click();await f.page.getByRole('dialog').getByRole('button',{name:'Abandon game',exact:true}).click();await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
 }finally{await cleanup(f);}
});

test('a damaged waiting cache cannot activate, and can be repaired without another release',async({browser})=>{
 const f=await open(browser);try{f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');
  await f.page.evaluate(async version=>{await (await caches.open('game-shelf-offline-'+version)).delete(new URL('./help.js',location.href).href);},f.server.nextVersion);
  // The worker itself must reject activation, even if a client bypasses its UI check.
  const allowed=await f.page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data.ready);r.waiting.postMessage({type:'ACTIVATE'},[c.port2]);});});expect(allowed).toBe(false);expect((await status(f.page)).version).toBe(f.server.version);
  f.server.upgrade(true);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Update incomplete · current app kept · retry');expect((await status(f.page)).ready).toBe(true);
  f.server.upgrade(false);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
 }finally{await cleanup(f);}
});

test('repairing an active cache preserves remaining files on failure and restores offline game access',async({browser})=>{
 const f=await open(browser);try{const before=await solo(f.page);await f.page.evaluate(async version=>{await (await caches.open('game-shelf-offline-'+version)).delete(new URL('./help.js',location.href).href);},f.server.version);
  f.server.setFailure(true);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Offline package incomplete · current files kept · retry');
  expect(await f.page.evaluate(async version=>!!await (await caches.open('game-shelf-offline-'+version)).match(new URL('./app.js',location.href).href),f.server.version)).toBe(true);expect((await status(f.page)).ready).toBe(false);
  f.server.setFailure(false);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');await f.context.setOffline(true);await f.page.reload();await expect(f.page.locator('#connection')).toHaveText('Local · saved');
  const after=await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});expect(after).toEqual(before);
 }finally{await cleanup(f);}
});

test('a cache miss rejects newer module bytes, shows recovery, and resumes after compatible files return',async({browser})=>{
 const f=await open(browser);try{const before=await solo(f.page);await f.page.evaluate(async version=>{await (await caches.open('game-shelf-offline-'+version)).delete(new URL('./help.js',location.href).href);},f.server.version);f.server.upgrade(false);
  // The old worker must not return the newer release's module as its own.
  expect(await f.page.evaluate(async()=> (await fetch('./help.js')).status)).toBe(503);
  await f.page.reload();await expect(f.page.getByRole('heading',{name:'App resources unavailable',exact:true})).toBeVisible();
  f.server.downgrade();await f.page.getByRole('button',{name:'Reload',exact:true}).click();await expect(f.page.locator('#connection')).toHaveText('Local · saved');await expect(f.page.locator('#startup-error')).toBeHidden();
  const after=await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});expect(after).toEqual(before);
 }finally{await cleanup(f);}
});

async function actorPage(f){const page=await f.context.newPage();await page.goto(f.server.url+'#home');await expect(page.locator('#connection')).toHaveText('Up to date');return page;}
async function pendingUpdate(f){f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');}
const lifecycleKey='game-shelf-app-lifecycle';

test('another window cannot update while a real session creation waits to save',async({browser})=>{
 const f=await open(browser);try{const actor=await actorPage(f);await pendingUpdate(f);
  await actor.evaluate(()=>new Promise(resolve=>{window.heldLocal=navigator.locks.request('game-shelf-local-solo',()=>new Promise(done=>{window.releaseLocal=done;resolve();}));}));
  await actor.evaluate(()=>{window.createTask=import('./session.js').then(({client})=>client.execute('create',{name:'Concurrent',mode:'solo'})).catch(e=>({error:e.code}));});
  await expect.poll(()=>f.page.evaluate(async key=>(await navigator.locks.query()).held.some(l=>l.name===key&&l.mode==='shared'),lifecycleKey)).toBe(true);
  await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toContainText('Another window is saving or sending');expect((await status(f.page)).version).toBe(f.server.version);
  await actor.evaluate(()=>window.releaseLocal());const before=await actor.evaluate(async()=>{const p=await window.createTask;return {room:p.roomId,revision:p.revision};});expect(!!before.room).toBe(true);
  await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
  const after=await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});expect(after).toEqual(before);
 }finally{await cleanup(f);}
});

test('session work queued after compatibility approval cannot create a game during activation',async({browser})=>{
 const f=await open(browser,{differentEngine:true});try{const actor=await actorPage(f);await pendingUpdate(f);
  await f.page.evaluate(()=>{const post=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(data,ports){if(data?.type==='ACTIVATE'){window.releaseActivation=()=>post.call(this,data,ports);return;}return post.call(this,data,ports);};});
  await f.page.locator('#offline-status').click();await expect.poll(()=>f.page.evaluate(()=>typeof window.releaseActivation==='function')).toBe(true);
  await actor.evaluate(()=>{window.createTask=import('./session.js').then(({client})=>client.execute('create',{name:'Too late',mode:'solo'})).catch(e=>({error:e.code}));});
  await expect.poll(()=>f.page.evaluate(async key=>(await navigator.locks.query()).pending.some(l=>l.name===key&&l.mode==='shared'),lifecycleKey)).toBe(true);
  await f.page.evaluate(()=>window.releaseActivation());await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
  expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.games()).length;})).toBe(0);
 }finally{await cleanup(f);}
});

test('a stale window that missed reload is fenced before it can persist another move',async({browser})=>{
 const f=await open(browser);try{const stale=await f.context.newPage();await stale.addInitScript(()=>{const add=navigator.serviceWorker.addEventListener.bind(navigator.serviceWorker);navigator.serviceWorker.addEventListener=(type,...args)=>type==='controllerchange'?undefined:add(type,...args);});await stale.goto(f.server.url+'#home');await expect(stale.locator('#connection')).toHaveText('Up to date');await pendingUpdate(f);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');
  expect(await stale.evaluate(()=>self.OFFLINE_VERSION)).toBe(f.server.version);
  const error=await stale.evaluate(async()=>{try{const {client}=await import('./session.js');await client.execute('create',{name:'Stale',mode:'solo'});return null;}catch(e){return e.code;}});expect(error).toBe('UNSUPPORTED_VERSION');
  expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.games()).length;})).toBe(0);
  await stale.getByRole('button',{name:'New game',exact:true}).click();await stale.getByLabel('Play mode',{exact:true}).selectOption('solo');await stale.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(stale.getByRole('button',{name:'Reload app',exact:true})).toBeVisible();await stale.getByRole('button',{name:'Reload app',exact:true}).click();await expect(stale.getByRole('button',{name:'New game',exact:true})).toBeEnabled();await solo(stale);expect(await stale.evaluate(()=>self.OFFLINE_VERSION)).toBe(f.server.nextVersion);
 }finally{await cleanup(f);}
});

test('a lost online acknowledgment blocks another window update until the original intent resolves once',async({browser})=>{
 const f=await open(browser),server=fakeRelay({channelId:'10000000-0000-4000-8000-000000000001'});try{
  await f.context.route('**/api/public/relay/v1',async route=>{try{const packet=await server.transport().request(route.request().postDataJSON(),'alice');await route.fulfill({json:{ok:true,protocolVersion:1,...packet}});}catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:!!e.retryable}}});}});
  await f.page.evaluate(()=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id:'alice',app_metadata:{provider:'google'},user_metadata:{full_name:'Alice'}},access_token:'alice',refresh_token:'fixture',expires_at:4102444800})));
  // A fixed fixture seed gives Alice the first human placement.
  await f.context.addInitScript(()=>{const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=value=>{if(value instanceof Uint32Array&&value.length===1){value[0]=42;return value;}return random(value);};});
  const actor=await actorPage(f);await actor.evaluate(async()=>{const {client}=await import('./session.js');const p=await client.execute('create',{name:'Alice'});await client.execute('start',{roomId:p.roomId});});server.loseResponse();
  await actor.evaluate(async()=>{const {client}=await import('./session.js'),p=(await client.inspect()).packet;try{await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:p.view.choices[0]});}catch{}});
  f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toContainText('Update blocked');expect(await f.page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
  await actor.evaluate(async()=>{const {client}=await import('./session.js');await client.refresh();});await pendingUpdate(f);server.loseResponse();
  const error=await actor.evaluate(async()=>{const {client}=await import('./session.js'),p=(await client.inspect()).packet;try{await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:p.view.choices[0]});return null;}catch(e){return e.code;}});expect(error).toBe('NETWORK_UNAVAILABLE');
  await actor.evaluate(async channel=>{const {createRelayStore}=await import('./relay/store.js');const r=await createRelayStore({name:'game-shelf-online-catan-v1'}).load('alice',channel);window.originalIntent=r.outbox[0].request.mutationId;},server.channelId);
  await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toContainText('Finish the game or return home');expect((await status(f.page)).version).toBe(f.server.version);
  expect(await actor.evaluate(async channel=>{const {createRelayStore}=await import('./relay/store.js'),r=await createRelayStore({name:'game-shelf-online-catan-v1'}).load('alice',channel);return r.outbox.length===1&&r.outbox[0].request.mutationId===window.originalIntent;},server.channelId)).toBe(true);
  const original=await actor.evaluate(()=>window.originalIntent);await actor.evaluate(async()=>{const {client}=await import('./session.js');await client.refresh();});expect(server.messages.filter(m=>m.messageId===original).length).toBe(1);
  await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
 }finally{await cleanup(f);}
});

test('a waiting engine update fences old game creation before automatic activation on last-window close',async({browser})=>{
 const f=await open(browser,{differentEngine:true});try{await pendingUpdate(f);
  const error=await f.page.evaluate(async()=>{try{const {client}=await import('./session.js');await client.execute('create',{name:'Old engine',mode:'solo'});return null;}catch(e){return e.code;}});expect(error).toBe('UPDATE_PENDING');
  let candidate;for(const worker of f.context.serviceWorkers())if(await worker.evaluate(()=>self.OFFLINE_VERSION).catch(()=>null)===f.server.nextVersion)candidate=worker;expect(!!candidate).toBe(true);
  await f.page.close();await expect.poll(()=>candidate.evaluate(()=>!self.registration.waiting&&self.registration.active?.state==='activated')).toBe(true);
  f.page=await f.context.newPage();await f.page.goto(f.server.url+'#home');await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect(await f.page.evaluate(()=>self.OFFLINE_VERSION)).toBe(f.server.nextVersion);expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.games()).length;})).toBe(0);
 }finally{await cleanup(f);}
});

test('a first-install engine fence is enforced even without an active controller',async({browser})=>{
 const f=await open(browser);try{
  const error=await f.page.evaluate(async()=>{const {client}=await import('./session.js'),state=self.GameShelfUpdateState;await state.setFence({schemaVersion:1,version:'first-install-fixture',engine:'future-engine-test'});const get=navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);navigator.serviceWorker.getRegistration=async()=>({active:null,installing:{}});
   try{await client.execute('create',{name:'Too early',mode:'solo'});return null;}catch(e){return e.code;}finally{navigator.serviceWorker.getRegistration=get;await state.clearFence('first-install-fixture');}
  });expect(error).toBe('UPDATE_PENDING');expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.games()).length;})).toBe(0);
 }finally{await cleanup(f);}
});

test('a failed engine download releases its obsolete fence so the previous app can still start a game',async({browser})=>{
 const f=await open(browser,{differentEngine:true});try{f.server.upgrade(true);await update(f.page);await expect(f.page.locator('#offline-status')).toContainText('Offline download failed');
  await expect.poll(()=>f.page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;})).toBe(true);
  expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.execute('create',{name:'Previous version',mode:'solo'})).ok;})).toBe(true);
  expect(await f.page.evaluate(()=>self.GameShelfUpdateState.fence())).toBeFalsy();expect((await status(f.page)).version).toBe(f.server.version);
 }finally{await cleanup(f);}
});

test('same-engine UI repair can install despite an already-incompatible local save and reveal abandonment after reopening',async({browser})=>{
 const f=await open(browser);try{
  const before=await solo(f.page);
  await f.page.evaluate(async()=>navigator.locks.request('game-shelf-local-solo',async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),r=store.get('account:alice');r.onsuccess=()=>{const lib=r.result;lib.games[lib.current].artifact='previous-engine-fixture';store.put(lib,'account:alice');};tx.oncomplete=resolve;});db.close();}));
  await f.page.goto(f.server.url+'#home');await f.page.reload();await expect(f.page.getByRole('heading',{name:'An older saved game needs attention'})).toBeVisible();await expect(f.page.getByRole('button',{name:'Abandon game',exact:true})).toHaveCount(1);
  f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');
  await f.page.close();f.page=await f.context.newPage();await f.page.goto(f.server.url+'#home');await expect.poll(async()=>(await status(f.page)).version).toBe(f.server.nextVersion);
  await expect(f.page.getByRole('button',{name:'Abandon game',exact:true})).toHaveCount(1);await f.page.getByRole('button',{name:'Abandon game',exact:true}).click();await f.page.getByRole('dialog').getByRole('button',{name:'Abandon game',exact:true}).click();await expect(f.page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();
  expect(await f.page.evaluate(async room=>{const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);});db.close();return {abandoned:lib.games[room].abandoned,artifact:lib.games[room].artifact,revision:lib.games[room].state.snapshot.revision};},before.room)).toEqual({abandoned:true,artifact:'previous-engine-fixture',revision:before.revision});
 }finally{await cleanup(f);}
});

test('a declared non-breaking update activates automatically on idle home and keeps a saved game',async({browser})=>{
 const f=await open(browser,{automatic:true});try{const before=await solo(f.page);await f.page.getByRole('link',{name:'Game Shelf home',exact:true}).click();f.server.upgrade(false);await update(f.page);await expect(async()=>{expect((await status(f.page)).version).toBe(f.server.nextVersion);}).toPass({timeout:15000});await expect(f.page.getByRole('button',{name:'Resume game',exact:true})).toBeEnabled();await f.page.getByRole('button',{name:'Resume game',exact:true}).click();await expect(f.page.locator('#connection')).toHaveText('Local · saved');expect(await f.page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};})).toEqual(before);}finally{await cleanup(f);}
});

test('automatic updates wait while a dialog is open, then activate after it closes',async({browser})=>{
 const f=await open(browser,{automatic:true});try{await f.page.getByRole('button',{name:'Help and rules',exact:true}).click();f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');expect((await status(f.page)).version).toBe(f.server.version);await expect(f.page.getByRole('dialog')).toBeVisible();await f.page.getByRole('button',{name:'Close panel'}).click();await expect(async()=>{expect((await status(f.page)).version).toBe(f.server.nextVersion);}).toPass({timeout:15000});}finally{await cleanup(f);}
});

test('an explicitly breaking update never auto-activates even on idle home',async({browser})=>{
 const f=await open(browser,{automatic:true,breaking:true});try{f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');await f.page.getByRole('button',{name:'Help and rules',exact:true}).click();await f.page.getByRole('button',{name:'Close panel'}).click();expect((await status(f.page)).version).toBe(f.server.version);expect(await f.page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);}finally{await cleanup(f);}
});

test('foreground checks discover a release without pressing the update button',async({browser})=>{
 const f=await open(browser);try{
  await f.page.clock.install();f.server.upgrade(false);await f.page.clock.fastForward(31000);await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(f.page.locator('#offline-status')).toHaveText('Update available');expect((await status(f.page)).version).toBe(f.server.version);
 }finally{await cleanup(f);}
});

test('an explicit update from the Home sidebar closes it before safe activation',async({browser})=>{
 const f=await open(browser);try{
  f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');await f.page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(f.page.locator('#sidebar-offline')).toHaveText('Update available');await f.page.locator('#sidebar-offline').click();await expect(f.page.locator('#sidebar')).not.toBeVisible();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
 }finally{await cleanup(f);}
});
