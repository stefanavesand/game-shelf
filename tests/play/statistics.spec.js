import {test,expect} from './account-fixture.js';
async function finished(page){
 await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board')).toBeVisible();
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-solo-v1');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);});
  const g=structuredClone(lib.games[lib.current]),s=g.state.snapshot,id='7c7948da-7476-44d0-a6bc-de562cba6e92';
  s.id=id;s.revision=3;s.history=[{revision:1,playerId:'p1',message:'roll dice',dice:[1,1]},{revision:2,playerId:'p1',message:'roll dice',dice:[6,6]},{revision:3,playerId:'p1',message:'build city'}];
  Object.assign(s.state.game,{phase:'ended',winnerId:'p1',finalScores:Object.fromEntries(s.seats.map((p,i)=>[p.id,i===0?10:5])),currentPlayerId:'p1'});
  const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);g.botMemory={};g.botMemoryHash=await digest({});lib.games[id]=g;lib.current=id;
  await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;tx.onerror=reject;});db.close();
 });
 await page.reload();await page.getByRole('button',{name:'View results',exact:true}).click();await expect(page.getByRole('button',{name:'Statistics',exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:'New game',exact:true})).toHaveCount(0);
}
for(const [width,height] of [[390,664],[844,390],[1024,1366]])test(`result statistics fit ${width}×${height} and survive reload`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height}});try{
  const page=await context.newPage();await finished(page);await page.getByRole('button',{name:'Statistics',exact:true}).click();
  await expect(page.getByText('2 recorded rolls · 0 sevens',{exact:true})).toBeVisible();await expect(page.getByText('All rolls recorded.',{exact:true})).toBeVisible();await expect(page.locator('.statistics-bin')).toHaveCount(11);
  await expect(page.getByRole('listitem',{name:'2: 1 rolls, expected 0.1',exact:true})).toBeVisible();
  for(const tab of ['This game','My results']){
   await page.getByRole('button',{name:tab,exact:true}).click();await expect(page.getByRole('button',{name:'Back to results',exact:true})).toBeInViewport();
   const size=await page.locator('#sheet-body').evaluate(e=>({content:e.scrollHeight,available:e.clientHeight}));expect(size.content,tab+' '+JSON.stringify(size)).toBeLessThanOrEqual(size.available+1);
  }
  await expect(page.locator('.statistics-summary>div').filter({hasText:'Games'}).locator('dd')).toHaveText('1');
  await page.reload();await page.getByRole('button',{name:'View results',exact:true}).click();await page.getByRole('button',{name:'Statistics',exact:true}).click();await expect(page.getByText('2 recorded rolls · 0 sevens',{exact:true})).toBeVisible();
  // The store scopes results to the principal, even on the same installation.
  const owners=await page.evaluate(async()=>{const {createStatisticsStore}=await import('./core/statistics.js'),store=createStatisticsStore();return {alice:(await store.list('alice')).filter(g=>g.result).length,bob:(await store.list('bob')).length};});expect(owners).toEqual({alice:1,bob:0});
 }finally{await context.close();}
});
test('statistics storage failure leaves the saved game and result accessible',async({browser})=>{
 const context=await browser.newContext();try{const page=await context.newPage();await finished(page);
  await context.addInitScript(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='game-shelf-statistics-v1')throw new DOMException('Denied','SecurityError');return open.call(this,name,...args);};});
  await page.reload();await page.getByRole('button',{name:'View results',exact:true}).click();await page.getByRole('button',{name:'Statistics',exact:true}).click();await expect(page.getByText('Statistics storage is unavailable on this device. Your game and result are unchanged.')).toBeVisible();await page.getByRole('button',{name:'Close panel',exact:true}).click();await expect(page.getByRole('button',{name:'View results',exact:true})).toBeEnabled();
 }finally{await context.close();}
});
