import {test,expect} from '@playwright/test';
const root='/game-shelf/play/';
test('solo starts without auth, plays, and fully reloads from the verified offline cache',async({browser})=>{
 const context=await browser.newContext();let external=0;await context.route(/^https:\/\//,route=>{external++;return route.abort();});
 try{const page=await context.newPage();await page.goto(root+'#home');await expect(page.locator('#offline-status')).toHaveText('Ready for offline',{timeout:30000});
  await context.setOffline(true);await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Offline player');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');await expect(page.locator('.players .bot-tag')).toHaveCount(2);
  await expect(page.locator('#board [role="button"]').first()).toBeVisible();await page.locator('#board [role="button"]').first().click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  const before=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(before.revision).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');const after=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(after.roomId).toBe(before.roomId);expect(after.revision).toBeGreaterThanOrEqual(before.revision);expect(external).toBe(0);
 }finally{await context.close();}
});
test('a missing cached resource never reports offline readiness',async({browser})=>{
 const context=await browser.newContext();try{const page=await context.newPage();await page.goto(root+'#home');await expect(page.locator('#offline-status')).toHaveText('Ready for offline',{timeout:30000});
 await page.evaluate(async()=>{const names=await caches.keys();for(const name of names)if(name.startsWith('game-shelf-offline-'))await (await caches.open(name)).delete(new URL('./catan/module.js',location.href).href);});
 await context.setOffline(true);await page.locator('#offline-status').click();await expect(page.locator('#offline-status')).not.toHaveText('Ready for offline');
 await context.setOffline(false);await page.locator('#offline-status').click();await expect(page.locator('#offline-status')).toHaveText('Ready for offline');
 }finally{await context.close();}
});
test('a purchased development card is shown, saved and usable as a card offline',async({browser})=>{
 const context=await browser.newContext();try{const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Card test');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(2);
 await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('library');r.onsuccess=()=>resolve(r.result);});const g=lib.games[lib.current],s=g.state.snapshot;s.state.game.phase='main';s.state.game.currentPlayerId='p1';s.state.game.turn=4;s.state.game.lastRoll={die1:2,die2:3,total:5};for(const p of s.state.players.players)for(const r of ['brick','lumber','grain','wool','ore']){s.state.game.bank[r]+=p.resources[r];p.resources[r]=0;}const p=s.state.players.players.find(p=>p.id==='p1');for(const r of ['ore','grain','wool']){p.resources[r]=1;s.state.game.bank[r]--;}s.deck[0]='knight';const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'library');tx.oncomplete=resolve;tx.onerror=reject;});db.close();});
 await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');await page.getByRole('button',{name:'Build',exact:true}).click();await page.locator('[data-action="build:BUY_DEVELOPMENT_CARD"]').click();await expect(page.getByRole('heading',{name:'Your new development card'})).toBeVisible();await expect(page.getByRole('heading',{name:'Knight',exact:true})).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.development-section')).toContainText('Knight');await page.reload();await expect(page.locator('.development-section')).toContainText('Knight');
 }finally{await context.close();}
});

test('abandon confirmation keeps a solo game until confirmed and unpins updates after reload',async({browser})=>{
 const context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());
 try{
  const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Abandon test');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(2);
  await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();await page.getByRole('button',{name:'Abandon game',exact:true}).click();await page.getByRole('button',{name:'Keep game',exact:true}).click();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Abandon game',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Abandon game',exact:true}).click();await expect(page.getByText('No saved games yet. Choose New game to get started.')).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toHaveCount(0);expect(await page.evaluate(async()=>{const {client}=await import('./session.js');return client.canUpdate('next-engine');})).toBe(true);
 }finally{await context.close();}
});

test('an unaffordable incoming offer is declined through ordinary commands and feedback survives reload',async({browser})=>{
 const context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());
 try{const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Trade tester');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(2);
  // Prepared pending-offer fixture; human does not own the requested Brick.
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('library');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;for(const p of s.state.players.players)for(const r of ['brick','lumber','ore','grain','wool']){s.state.game.bank[r]+=p.resources[r];p.resources[r]=0;}s.state.players.players[1].resources.ore=2;s.state.game.bank.ore-=2;Object.assign(s.state.game,{phase:'main',currentPlayerId:'bot:1',turn:5});s.revision=20;s.history=[{revision:20,playerId:'bot:1',message:'trade offer'}];s.offer={id:'fixture-offer',from:'bot:1',to:'p1',give:{ore:1},receive:{brick:1}};const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'library');tx.oncomplete=resolve;});db.close();});
  await page.reload();await expect(page.getByText(/was automatically declined because you cannot supply/)).toBeVisible();await expect(page.getByRole('button',{name:'Review trade',exact:true})).toHaveCount(0);
  expect(await page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return !p.view.offer&&p.view.history.some(h=>h.revision===21&&h.playerId==='p1'&&h.message==='trade decline');})).toBe(true);
  await page.getByText('Trade activity',{exact:true}).click();await expect(page.locator('.trade-log li').filter({hasText:'declined'})).toHaveCount(1);await page.reload();await page.getByText('Trade activity',{exact:true}).click();await expect(page.locator('.trade-log li').filter({hasText:'declined'})).toHaveCount(1);
 }finally{await context.close();}
});
