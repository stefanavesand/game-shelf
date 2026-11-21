import {test,expect} from './account-fixture.js';
test('red uses both owned ports and still sees an unaffordable port after trading',async({browser})=>{
 const context=await browser.newContext();await context.route(/^https:\/\//,r=>r.abort());try{
 const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board')).toBeVisible();
 await page.evaluate(()=>navigator.locks.request('game-shelf-local-solo',async()=>{
 const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1');r.onsuccess=()=>resolve(r.result);}),lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
 for(const p of s.state.players.players)for(const r of ['brick','lumber','grain','wool','ore']){s.state.game.bank[r]+=p.resources[r];p.resources[r]=0;}
 const me=s.state.players.players.find(p=>p.id==='p1');for(const [r,n]of [['grain',2],['ore',3]]){me.resources[r]=n;s.state.game.bank[r]-=n;}
 const generic=s.state.board.ports.find(p=>p.type==='generic'),grain=s.state.board.ports.find(p=>p.type==='grain');s.state.board.buildings=[{playerId:'p1',type:'settlement',vertex:generic.vertices[0]},{playerId:'p1',type:'city',vertex:grain.vertices[1]}];s.state.board.roads=[];Object.assign(s.state.game,{phase:'main',currentPlayerId:'p1',turn:12});s.revision=30;s.offer=null;s.history=[];
 const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();
 }));await page.reload();
 const open=async()=>{await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('button',{name:'Bank & ports',exact:true}).click();};
 await open();await expect(page.locator('#sheet-body')).toContainText('Your ports:');await expect(page.locator('#sheet-body')).toContainText('Grain 2:1');await expect(page.locator('#sheet-body')).toContainText('Any resource 3:1');
 await page.getByRole('button',{name:'Add Grain to give',exact:true}).click();await expect(page.getByLabel('Grain offered',{exact:true})).toHaveText('2');await page.getByRole('button',{name:'Add Brick to receive',exact:true}).click();await page.getByRole('button',{name:'Trade with bank',exact:true}).click();await expect(page.locator('#sheet')).not.toBeVisible();
 await open();await expect(page.locator('.trade-row[data-resource=grain]')).toContainText('2:1');await expect(page.getByRole('button',{name:'Add Grain to give',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('3');await page.getByRole('button',{name:'Add Wood to receive',exact:true}).click();await page.getByRole('button',{name:'Trade with bank',exact:true}).click();await expect(page.locator('#sheet')).not.toBeVisible();
 // Closing the sheet starts submission; it does not acknowledge the saved move.
 await expect.poll(()=>page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {revision:p.revision,hand:p.view.state.players.players.find(x=>x.id===p.you).resources};})).toEqual({revision:32,hand:{brick:1,lumber:1,grain:0,wool:0,ore:0}});
 }finally{await context.close();}
});
