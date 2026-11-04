import {test,expect} from '@playwright/test';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {offlineVersion} from '../../scripts/offline-version.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const packageRoot=process.env.GAME_SHELF_STATIC_ROOT==='dist'?'dist':'.';
async function updateServer({differentEngine=false,workerOnly=false}={}){
 const script=await readFile(path.join(packageRoot,'play/offline-assets.js'),'utf8');
 const assets=JSON.parse(script.match(/self\.OFFLINE_ASSETS=(\[.*\]);/)[1]),engine=JSON.parse(script.match(/self\.OFFLINE_ENGINE=("[^"]*")/)[1]);
 const version=JSON.parse(script.match(/self\.OFFLINE_VERSION=("[^"]*")/)[1]);
 const original=new Map(await Promise.all([...assets.map(a=>a.path),'play/offline-assets.js','play/sw.js'].map(async f=>[f,await readFile(path.join(packageRoot,f))])));
 const template=(await readFile('scripts/sw-template.js','utf8'))+(workerOnly?'\n// Worker-only test release.\n':'');
 const candidate=new Map(original),changed=workerOnly?original.get('play/help.js'):Buffer.concat([original.get('play/help.js'),Buffer.from('\n// Update test candidate.\n')]);candidate.set('play/help.js',changed);
 const nextAssets=assets.map(a=>a.path==='play/help.js'?{...a,sha256:sha(changed)}:a),nextVersion=offlineVersion(nextAssets,template);
 const nextScript=Buffer.from('// Generated test candidate.\nself.OFFLINE_VERSION='+JSON.stringify(nextVersion)+';self.OFFLINE_ENGINE='+JSON.stringify(differentEngine?'future-engine-test':engine)+';self.OFFLINE_ASSETS='+JSON.stringify(nextAssets)+';\n');candidate.set('play/offline-assets.js',nextScript);
 candidate.set('play/sw.js',Buffer.from(template.replace('__OFFLINE_SCRIPT_SHA__',sha(nextScript))));
 let next=false,fail=false,failures=0;
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname,relative=pathname.replace(/^\/game-shelf\//,'').replace(/\/$/,'/index.html');
  if(!pathname.startsWith('/game-shelf/')){res.writeHead(404).end();return;}
  if(next&&fail&&relative==='play/help.js'){failures++;res.writeHead(503).end('Interrupted download');return;}
  const body=(next?candidate:original).get(relative);if(!body){res.writeHead(404).end();return;}
  const ext=path.extname(relative),type={'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[ext]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}/game-shelf/play/`,version,nextVersion,failures:()=>failures,upgrade:broken=>{next=true;fail=broken;},close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
async function open(browser,options){
 const server=await updateServer(options),context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();await page.goto(server.url+'#home');await expect(page.locator('#offline-status')).toHaveText('Ready for offline',{timeout:30000});return {server,context,page};
}
async function solo(page){await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Update tester');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');return page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {room:p.roomId,revision:p.revision};});}
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
test('an advertised incompatible engine stays waiting until the pinned game is deliberately abandoned',async({browser})=>{
 const f=await open(browser,{differentEngine:true});try{await solo(f.page);await f.page.getByRole('link',{name:'Game Shelf home',exact:true}).click();f.server.upgrade(false);await update(f.page);await expect(f.page.locator('#offline-status')).toHaveText('Update available');await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toContainText('Finish the game or return home');expect((await status(f.page)).version).toBe(f.server.version);
  await f.page.getByRole('button',{name:'Abandon game',exact:true}).click();await f.page.getByRole('dialog').getByRole('button',{name:'Abandon game',exact:true}).click();await expect(f.page.getByRole('button',{name:'Resume game',exact:true})).toHaveCount(0);await f.page.locator('#offline-status').click();await expect(f.page.locator('#offline-status')).toHaveText('Ready for offline');expect((await status(f.page)).version).toBe(f.server.nextVersion);
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
