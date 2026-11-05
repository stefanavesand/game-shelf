import {test,expect} from '@playwright/test';
const root='/game-shelf/play/';
async function scenario(browser,accept){
 const context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();
 await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Trader');await page.getByLabel('Players',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');
 // Prepared hands isolate the composer and real scheduler; no live service/mock engine.
 await page.evaluate(accept=>navigator.locks.request('game-shelf-local-solo',async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('library');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
  for(const p of s.state.players.players)for(const r of ['brick','lumber','ore','grain','wool']){s.state.game.bank[r]+=p.resources[r];p.resources[r]=0;}
  const fund=(i,r,n)=>{s.state.players.players[i].resources[r]=n;s.state.game.bank[r]-=n;};fund(0,'ore',2);fund(0,'brick',3);fund(1,'grain',2);fund(2,'grain',1);
  if(accept){fund(1,'brick',2);const {getHexVertices}=await import('./catan/rules/geometry.js');s.state.board.buildings=[{playerId:'bot:1',type:'settlement',vertex:getHexVertices({q:0,r:0})[0]}];s.state.players.players[1].settlementsRemaining=4;}else s.state.board.buildings=[];
  Object.assign(s.state.game,{phase:'main',currentPlayerId:'p1',turn:5,lastRoll:{die1:2,die2:3,total:5}});s.offer=null;s.trades=[];s.history=[];s.revision=30;
  const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'library');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 }),accept);
 await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');await page.getByRole('button',{name:'Trade',exact:true}).click();return {context,page};
}
for(const accept of [true,false])test(`real local All offer stays open after bots ${accept?'accept':'decline'} and persists outcomes`,async({browser})=>{
 const {context,page}=await scenario(browser,accept);
 try{
  await expect(page.locator('#trade-target')).toHaveValue('all');
  await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await page.getByRole('button',{name:'Add Brick to request',exact:true}).click();
  await page.getByRole('button',{name:'Send offer',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('.trade-responses')).toContainText(accept?'Trade completed.':'Everyone declined.');await expect(dialog.getByRole('button',{name:accept?'Close':'Send offer',exact:true})).toBeVisible();
  const packet=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(packet.view.offer).toBeNull();expect(packet.view.trades.at(-1).status).toBe(accept?'accepted':'declined');expect(packet.view.trades.at(-1).to).toBe('all');
  // Original terms remain editable in the same open dialog after completion.
  if(accept){await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).not.toBeVisible();}else{await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('2');await page.getByRole('button',{name:'Remove Ore from offer',exact:true}).click();await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('1');}
  await page.reload();await page.getByText('Trade activity',{exact:true}).click();await expect(page.locator('.trade-log')).toContainText(accept?'accepted':'declined');
 }finally{await context.close();}
});
