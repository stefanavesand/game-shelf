import {test,expect} from './account-fixture.js';
const root='/game-shelf/play/';
async function scenario(browser,accept){
 const context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());const page=await context.newPage();
 await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Local · saved');
 // Prepared hands isolate the composer and real scheduler; no live service/mock engine.
 await page.evaluate(accept=>navigator.locks.request('game-shelf-local-solo',async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
  for(const p of s.state.players.players)for(const r of ['brick','lumber','ore','grain','wool']){s.state.game.bank[r]+=p.resources[r];p.resources[r]=0;}
  const fund=(i,r,n)=>{s.state.players.players[i].resources[r]=n;s.state.game.bank[r]-=n;};fund(0,'ore',2);fund(0,'brick',3);fund(1,'grain',2);fund(2,'grain',1);
  if(accept){fund(1,'brick',2);const {getHexVertices}=await import('./catan/rules/geometry.js');s.state.board.buildings=[{playerId:'bot:1',type:'settlement',vertex:getHexVertices({q:0,r:0})[0]}];s.state.players.players[1].settlementsRemaining=4;}else s.state.board.buildings=[];
  Object.assign(s.state.game,{phase:'main',currentPlayerId:'p1',turn:5,lastRoll:{die1:2,die2:3,total:5}});s.offer=null;s.trades=[];s.history=[];s.revision=30;
  const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 }),accept);
 await page.reload();await expect(page.locator('#connection')).toHaveText('Local · saved');await page.getByRole('button',{name:'Trade',exact:true}).click();return {context,page};
}
for(const accept of [true,false])test(`real local All offer stays open after bots ${accept?'accept':'decline'} and persists outcomes`,async({browser})=>{
 const {context,page}=await scenario(browser,accept);
 try{
  await expect(page.locator('#trade-target')).toHaveValue('all');
  await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await page.getByRole('button',{name:'Add Brick to request',exact:true}).click();
  await page.getByRole('button',{name:'Send offer',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('.trade-responses')).toContainText(accept?'Trade completed.':'Everyone declined.',{timeout:15000});await expect(dialog.getByRole('button',{name:accept?'Close':'Send offer',exact:true})).toBeVisible();
  const packet=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(packet.view.offer).toBeNull();expect(packet.view.trades.at(-1).status).toBe(accept?'accepted':'declined');expect(packet.view.trades.at(-1).to).toBe('all');
  // Original terms remain editable in the same open dialog after completion.
  if(accept){await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).not.toBeVisible();}else{await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('2');await page.getByRole('button',{name:'Remove Ore from offer',exact:true}).click();await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('1');}
  if(!accept)await page.getByRole('button',{name:'Close panel'}).click();await page.getByRole('button',{name:'Trade',exact:true}).click();await expect(page.locator('#sheet .trade-responses')).toHaveCount(0);await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('0');await expect(page.getByLabel('Brick requested',{exact:true})).toHaveText('0');await expect(page.locator('#trade-target')).toHaveValue('all');await page.getByRole('button',{name:'Close panel'}).click();
  await page.reload();await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Activity',exact:true}).click();await expect(page.locator('#sheet-body')).toContainText(accept?'accepted':'declined');
 }finally{await context.close();}
});

for(const response of ['Accept','Decline'])test(`an affordable bot offer opens automatically, stays pending across refresh, and ${response} closes it`,async({browser})=>{
 const {context,page}=await scenario(browser,false);
 try{
  await page.getByRole('button',{name:'Close panel'}).click();
  await page.evaluate(async()=>navigator.locks.request('game-shelf-local-solo',async()=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current];g.state.snapshot.state.game.currentPlayerId='bot:1';
   const {createCatanModule}=await import('./catan/module.js'),{CATAN_ARTIFACT}=await import('./catan/artifact.js'),{digest}=await import('./relay/protocol.js');g.state=createCatanModule(CATAN_ARTIFACT.compatibilityId).apply(g.state,'p1',{actor:'bot:1',action:{type:'TRADE_OFFER',to:'p1',give:{grain:1},receive:{brick:1}}},{},{coordinatorId:'p1'});g.hash=await digest(g.state);
   await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();
  }));
  await page.reload();const dialog=page.locator('#trade-reply');await expect(dialog).toBeVisible();await expect(dialog).toContainText('1 Grain');await expect(dialog.getByRole('button',{name:'Accept',exact:true})).toBeEnabled();const offerId=await dialog.getAttribute('data-offer-id');
  for(let i=0;i<2;i++){await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.locator('#connection')).toHaveText('Local · saved');await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('data-offer-id',offerId);}
  await dialog.getByRole('button',{name:response,exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('#sheet')).not.toBeVisible();
  await expect.poll(async()=>page.evaluate(async id=>{const {client}=await import('./session.js');return (await client.inspect()).packet.view.trades.find(t=>t.id===id)?.status;},offerId)).toBe(response==='Accept'?'accepted':'declined');
 }finally{await context.close();}
});

test('two consecutive unaffordable offers resolve without leaving the human stuck',async({browser})=>{
 const {context,page}=await scenario(browser,false);
 try{
  await page.getByRole('button',{name:'Close panel'}).click();
  await page.evaluate(async()=>{
   const {client}=await import('./session.js'),{createCatanModule}=await import('./catan/module.js'),{CATAN_ARTIFACT}=await import('./catan/artifact.js'),{digest}=await import('./relay/protocol.js');
   const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
   // Prepared legal offers isolate the UI chain; this is not a natural-game test.
   async function offerFrom(bot){
    await navigator.locks.request('game-shelf-local-solo',async()=>{
     const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});
     const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
     const human=s.state.players.players.find(p=>p.id==='p1'),donor=s.state.players.players.find(p=>p.id===bot);s.state.game.bank.wool+=human.resources.wool;human.resources.wool=0;
     if(donor.resources.grain<1){s.state.game.bank.grain--;donor.resources.grain++;}
     s.state.players.turnOrder=['bot:1','bot:2','p1'];Object.assign(s.state.game,{phase:'main',currentPlayerId:bot,turn:39});s.offer=null;
     g.state=module.apply(g.state,'p1',{actor:bot,action:{type:'TRADE_OFFER',to:'p1',give:{grain:1},receive:{wool:1}}},{},{coordinatorId:'p1'});g.hash=await digest(g.state);
     await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    });return (await client.inspect()).packet;
   }
   await offerFrom('bot:1');const execute=client.execute;window.skippedOffers=0;
   client.execute=async(op,args,...rest)=>{const p=await execute(op,args,...rest);if(args?.action?.type==='TRADE_DECLINE'&&p.ok){window.skippedOffers++;if(window.skippedOffers===1)return offerFrom('bot:2');}return p;};
  });
  await page.locator('#refresh').evaluate(button=>button.click());await expect.poll(()=>page.evaluate(()=>window.skippedOffers)).toBe(2);await expect(page.locator('#connection')).toHaveText('Local · saved');
  await expect(page.locator('#trade-reply')).not.toBeVisible();await expect(page.getByRole('button',{name:'Roll dice',exact:true})).toBeEnabled();
  const p=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(p.view.offer).toBeNull();expect(p.view.trades.filter(t=>t.status==='declined')).toHaveLength(2);
 }finally{await context.close();}
});

test('End turn is shown as saved while a following bot step is held',async({browser})=>{
 const {context,page}=await scenario(browser,false);
 try{
  await page.getByRole('button',{name:'Close panel'}).click();
  const before=await page.evaluate(async()=>{const {client}=await import('./session.js'),p=(await client.inspect()).packet,refresh=client.refresh;window.botStarted=false;const gate=new Promise(resolve=>window.releaseBot=resolve);let held=false;client.refresh=async options=>{if(options?.botBudget===1&&!held){held=true;window.botStarted=true;await gate;}return refresh(options);};return p.revision;});
  await page.getByRole('button',{name:'End turn',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.botStarted),{timeout:2500}).toBe(true);
  await expect(page.locator('#connection')).toHaveText('Local · saved');const saved=await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(saved.revision).toBe(before+1);expect(saved.botWorkPending).toBe(true);
  await page.getByRole('button',{name:'Help and rules',exact:true}).click();await expect(page.locator('#sheet')).toBeVisible();await page.evaluate(()=>window.releaseBot());
  await expect.poll(()=>page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.revision;})).toBeGreaterThan(before+1);
 }finally{await page.evaluate(()=>window.releaseBot?.()).catch(()=>{});await context.close();}
});
