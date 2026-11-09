import {test,expect} from './account-fixture.js';
const root='/game-shelf/play/';
for(const reducedMotion of ['no-preference','reduce'])test(`bot placements are saved individually, paced and explained (${reducedMotion})`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:664},reducedMotion});
 try{
  await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');
  await page.evaluate(()=>navigator.locks.request('game-shelf-local-solo',async()=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);});const g=lib.games[lib.current],s=g.state.snapshot;
   s.state.board.roads=[];s.state.board.buildings=[];s.setupIndex=0;s.history=[];s.revision=30;s.offer=null;
   s.state.players.turnOrder=['bot:1','p1','bot:2'];Object.assign(s.state.game,{phase:'setup-settlement-1',currentPlayerId:'bot:1'});
   for(const p of s.state.players.players)Object.assign(p,{settlementsRemaining:5,roadsRemaining:15});
   const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();
  }));
  await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');await expect(page.locator('.action-entry')).toBeVisible();await expect(page.locator('.motion-caption')).not.toHaveAttribute('data-event',/.+/);
  const revision=()=>page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.revision;});
  expect(await revision()).toBe(30);
  // Repeated foreground checks must not fast-forward the bots.
  await page.locator('#refresh').evaluate(b=>{b.click();b.click();});expect(await revision()).toBe(30);
  await expect(page.locator('.motion-caption')).toContainText('placed a settlement');expect(await revision()).toBe(31);
  const data=await page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {pieces:p.view.state.board.buildings.length,animations:document.getAnimations().length};});expect(data.pieces).toBe(1);if(reducedMotion==='reduce')expect(data.animations).toBe(0);else expect(data.animations).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.locator('#sidebar')).toBeVisible();await page.getByRole('button',{name:'Close menu',exact:true}).click();
  await expect(page.locator('.motion-caption')).toContainText('placed a road');expect(await revision()).toBe(32);await expect(page.locator('#board [role=button]').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  // Opening a saved game establishes a baseline rather than replaying history.
  await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');await expect(page.locator('.action-entry')).toBeVisible();await expect(page.locator('.motion-caption')).not.toHaveAttribute('data-event',/.+/);expect(await revision()).toBe(32);
 }finally{await context.close();}
});

test('a real dice roll uses the approved 3.1-second motion and keeps all game regions stationary',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');
  await page.evaluate(()=>navigator.locks.request('game-shelf-local-solo',async()=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);}),lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
   s.revision=30;s.history=[];s.offer=null;Object.assign(s.state.game,{phase:'roll',currentPlayerId:'p1',turn:8,lastRoll:null});const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();
  }));
  await page.reload();await expect(page.getByRole('button',{name:'Roll dice',exact:true})).toBeEnabled();const before=await page.locator('.board-wrap').boundingBox();await page.getByRole('button',{name:'Roll dice',exact:true}).click();await expect(page.locator('.motion-caption')).toContainText('rolled');
  const result=await page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {roll:p.view.state.game.lastRoll,durations:document.getAnimations().filter(a=>a.effect.target.classList.contains('die')).map(a=>a.effect.getTiming().duration),lit:[...document.querySelectorAll('.activity-entry.is-latest .die')].map(el=>el.querySelectorAll('.pip.lit').length)};});
  expect(result.durations).toEqual([3100,3100]);expect(result.lit).toEqual([result.roll.die1,result.roll.die2]);expect(await page.locator('.board-wrap').boundingBox()).toEqual(before);await expect(page.locator('.dice')).toContainText('= '+result.roll.total);
 }finally{await context.close();}
});
