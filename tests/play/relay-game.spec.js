import {test,expect} from './account-fixture.js';
import {fakeRelay} from '../relay/fake-relay.js';
const channelId='10000000-0000-4000-8000-000000000001';
test('normal game UI runs online Catan using only relay messages and local rules',async({browser})=>{
 const server=fakeRelay({channelId}),a=await browser.newContext(),b=await browser.newContext();let oldCalls=0;
 async function setup(context,id){await context.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id,is_anonymous:false,app_metadata:{provider:'google'},user_metadata:{full_name:id==='alice'?'Alice':id==='bob'?'Bob':id}},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
 await context.route('**/api/public/catan',route=>{oldCalls++;return route.abort();});await context.route('**/api/public/relay/v1',async route=>{const body=route.request().postDataJSON();try{const packet=await server.transport().request(body,id);await route.fulfill({json:{ok:true,protocolVersion:1,...packet}});}catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}});const page=await context.newPage();await page.goto('/game-shelf/play/#home');await expect(page.locator('#connection')).toHaveText('Up to date');return page;}
 try{const x=await setup(a,'alice'),y=await setup(b,'bob');
 await x.getByRole('button',{name:'New game',exact:true}).click();await x.getByLabel('Bot level').selectOption('hard');await x.getByLabel('Robber rule').selectOption('normal');await x.getByRole('button',{name:'Create game',exact:true}).click();await expect(x.getByRole('heading',{name:'Game lobby',exact:true})).toBeVisible();
 await x.locator('#room').click();await x.getByRole('button',{name:'Invitation details',exact:true}).click();const invite=await x.getByLabel('Invitation link').inputValue();await x.getByRole('button',{name:'Close panel'}).click();
 await y.goto(invite);await y.getByRole('button',{name:'Join game',exact:true}).click();await expect(y.getByRole('heading',{name:'Game lobby',exact:true})).toBeVisible();await x.getByRole('button',{name:'Start game',exact:true}).click();await expect(x.locator('.players .bot-tag')).toHaveCount(1);await y.locator('#refresh').evaluate(button=>button.click());await expect(y.locator('.players .bot-tag')).toHaveCount(1);
 await expect.poll(()=>x.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.view.state.game.currentPlayerId;})).toMatch(/^(alice|bob)$/);
 const packet=await x.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});expect(packet.view.state.game.settings.friendlyRobber).toBe(false);expect(packet.members.find(s=>s.kind==='bot').level).toBe('hard');expect(JSON.stringify(packet).includes('goalKey')).toBe(false);const p=packet.view.state.game.currentPlayerId==='alice'?x:y;if(p===y)await y.locator('#refresh').evaluate(button=>button.click());
 await p.evaluate(async()=>{const {client}=await import('./session.js'),refresh=client.refresh;window.extraRefreshes=0;client.refresh=(...args)=>{window.extraRefreshes++;return refresh(...args);};});
 await p.locator('#board [role="button"]').first().click();await p.getByRole('button',{name:'Confirm',exact:true}).click();await expect(p.locator('#connection')).toHaveText('Up to date');expect(await p.evaluate(()=>window.extraRefreshes)).toBe(0);
 const packets=await Promise.all([x,y].map(page=>page.evaluate(async()=>{const {client}=await import('./session.js');return client.refresh();})));expect(packets[0].revision).toBe(packets[1].revision);expect(packets[0].view.state.board.buildings).toEqual(packets[1].view.state.board.buildings);expect(oldCalls).toBe(0);
 }finally{await a.close();await b.close();}
});

test('two emulated human seats and the ordinary bot finish a natural relay game',async({browser},testInfo)=>{
 test.setTimeout(240000);
 const server=fakeRelay({channelId}),contexts=await Promise.all([browser.newContext(),browser.newContext()]);
 let forbiddenCalls=0,commands=0,staleRetries=0,reloaded=false,tradeReviewed=false;
 async function packet(page){return page.evaluate(async()=>{const {client}=await import('./session.js');return client.refresh();});}
 try{
  const pages=[];
  for(const [i,context] of contexts.entries()){
   const id=['alice','bob'][i];
   await context.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id,is_anonymous:false,app_metadata:{provider:'google'},user_metadata:{full_name:id==='alice'?'Alice':id==='bob'?'Bob':id}},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
   await context.route('**/api/public/catan',route=>{forbiddenCalls++;return route.abort();});
   await context.route('**/rest/v1/rpc/**',route=>{forbiddenCalls++;return route.abort();});
   await context.route('**/api/public/relay/v1',async route=>{
    try{const reply=await server.transport().request(route.request().postDataJSON(),id);await route.fulfill({json:{ok:true,protocolVersion:1,...reply}});}
    catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}
   });
   const page=await context.newPage();await page.goto('/game-shelf/play/#home');await expect(page.locator('#connection')).toHaveText('Up to date');pages.push(page);
  }
  const [host,guest]=pages;
  await host.getByRole('button',{name:'New game',exact:true}).click();await host.getByRole('button',{name:'Create game',exact:true}).click();
  await host.locator('#room').click();await host.getByRole('button',{name:'Invitation details',exact:true}).click();const invite=await host.getByLabel('Invitation link').inputValue();await host.getByRole('button',{name:'Close panel'}).click();
  await guest.goto(invite);await guest.getByRole('button',{name:'Join game',exact:true}).click();
  await expect(guest.getByRole('heading',{name:'Game lobby',exact:true})).toBeVisible();await host.getByRole('button',{name:'Start game',exact:true}).click();await expect(host.locator('.players .bot-tag')).toHaveCount(1);
  let packets;
  for(let step=0;step<1600;step++){
   // Synchronize both independent replicas before choosing from a seat's own view.
   packets=[await packet(host),await packet(guest)];
   if(packets.every(p=>p.status==='ended'))break;
   if(!tradeReviewed){
    const i=packets.findIndex(p=>p.view.state.game.phase==='main'&&!p.view.offer&&p.view.state.game.currentPlayerId===p.you);
    if(i>=0){
     const own=packets[i],other=packets[1-i],hand=p=>p.view.state.players.players.find(s=>s.id===p.you).resources;
     const give=Object.keys(hand(own)).find(r=>hand(own)[r]>0),receive=Object.keys(hand(other)).find(r=>r!==give&&hand(other)[r]>0);
     if(give&&receive){
      expect(own.roomId).not.toBe(own.view.id);
      const bundle=r=>Object.fromEntries(['brick','lumber','grain','wool','ore'].map(k=>[k,k===r?1:0]));
      const sent=await pages[i].evaluate(async({p,action})=>{const {client}=await import('./session.js');return client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action},{botBudget:0});},{p:own,action:{type:'TRADE_OFFER',to:other.you,give:bundle(give),receive:bundle(receive)}});
      expect(sent.ok).toBe(true);commands++;
      await pages[i].locator('#refresh').evaluate(button=>button.click());
      await pages[i].getByRole('button',{name:'View your offer',exact:true}).click();
      await expect(pages[i].getByRole('heading',{name:'Your trade offer',exact:true})).toBeVisible();
      await pages[i].locator('#close-sheet').click();
      await pages[i].getByRole('button',{name:'View your offer',exact:true}).click();
      await expect(pages[i].getByRole('heading',{name:'Your trade offer',exact:true})).toBeVisible();
      await pages[i].locator('#close-sheet').click();
      await pages[1-i].locator('#refresh').evaluate(button=>button.click());
      await expect(pages[1-i].locator('#trade-reply')).toBeVisible();
      await pages[1-i].locator('#close-trade-reply').click();
      await pages[1-i].getByRole('button',{name:'View offer',exact:true}).click();
      await expect(pages[1-i].locator('#trade-reply')).toBeVisible();
      await pages[1-i].getByRole('button',{name:'Decline',exact:true}).click();
      await expect(pages[1-i].locator('#trade-reply')).not.toBeVisible();
      tradeReviewed=true;continue;
     }
    }
   }
   let moved=false;
   for(let i=0;i<2;i++){
    if(!packets[i].view?.choices.length)continue;
    const result=await pages[i].evaluate(async p=>{
     const {client}=await import('./session.js'),{botDecision}=await import('./catan/rules/index.js');
     return client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')});
    },packets[i]);
    if(!result.ok){const fresh=await packet(pages[i]);if(fresh.revision!==packets[i].revision&&staleRetries<30){staleRetries++;moved=true;break;}throw Error('Human driver command rejected: '+result.error?.code+'; '+result.error?.message);}
    commands++;moved=true;break;
   }
   if(commands>=25&&!reloaded){
    await guest.reload();await expect(guest.locator('#board')).toBeVisible();
    // Reload can land on a persisted guest roll request. Service the host's
    // coordinator protocol rather than waiting for its background UI timer.
    await expect(async()=>{await packet(host);const restored=await packet(guest);expect(restored.pendingRandom).not.toBe(true);expect(restored.revision).toBeGreaterThanOrEqual(packets[1].revision);}).toPass({timeout:5000});reloaded=true;
   }
   // An eligible ordinary bot is progressed by the creator's normal refresh path.
   if(!moved)expect(packets.some(p=>p.members.some(m=>m.kind==='bot'))).toBe(true);
  }
  packets=[await packet(host),await packet(guest)];
  expect(packets.map(p=>p.status)).toEqual(['ended','ended']);expect(packets[0].revision).toBe(packets[1].revision);expect(packets[0].view.state.board).toEqual(packets[1].view.state.board);
  const checkpoints=await Promise.all(pages.map((page,i)=>page.evaluate(async({principal,roomId})=>{const {createRelayStore}=await import('./relay/store.js');const r=await createRelayStore({name:'game-shelf-online-catan-v1'}).load(principal,roomId);return {hash:r.game.hash,halt:r.halt,outbox:r.outbox.length};},{principal:['alice','bob'][i],roomId:packets[i].roomId})));
  expect(checkpoints[0]).toEqual(checkpoints[1]);expect(checkpoints[0].halt).toBeNull();expect(checkpoints[0].outbox).toBe(0);
  expect(packets[0].members.filter(m=>m.kind==='human')).toHaveLength(2);expect(packets[0].members.filter(m=>m.kind==='bot')).toHaveLength(1);expect(commands).toBeGreaterThan(25);expect(tradeReviewed).toBe(true);expect(reloaded).toBe(true);expect(forbiddenCalls).toBe(0);
  await host.reload();await expect(host.locator('#connection')).toHaveText('Up to date');expect((await packet(host)).status).toBe('ended');
  if(await host.locator('#sheet').isVisible())await host.locator('#close-sheet').click();
  await host.getByRole('button',{name:'View results',exact:true}).click();await host.getByRole('button',{name:'Statistics',exact:true}).click();
  await expect(host.getByRole('list',{name:'Distribution of dice totals from 2 to 12'})).toBeVisible();
  await testInfo.attach('emulated-game-summary',{body:JSON.stringify({humanCommands:commands,staleRetries,revision:packets[0].revision,guestReloaded:reloaded,forbiddenCalls,transport:'in-memory relay contract double',actions:'production session API; human choices from seat-restricted heuristic, not DOM clicks'}),contentType:'application/json'});
 }finally{for(const context of contexts)await context.close();}
});


test('a signed-in account opens a fresh invitation without network calls',async({browser})=>{
 const context=await browser.newContext();let externalCalls=0;
 try{
  await context.route(/^https:\/\//,route=>{externalCalls++;return route.abort();});
  const page=await context.newPage();await page.goto('/game-shelf/play/#join?room=10000000-0000-4000-8000-000000000001&invite=fixture-only');

  await expect(page.getByRole('button',{name:'Join game',exact:true})).toBeEnabled();
  await expect(page.locator('#connection')).toHaveText('Up to date');
  expect(externalCalls).toBe(0);
 }finally{await context.close();}
});

test('four human browsers join the configured lobby and start without bots',async({browser})=>{
 const ids=['alice','bob','carol','dave'],server=fakeRelay({channelId,members:ids}),contexts=[],pages=[];
 try{
  for(const id of ids){const c=await browser.newContext();contexts.push(c);await c.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id,is_anonymous:false,app_metadata:{provider:'google'},user_metadata:{full_name:id==='alice'?'Alice':id==='bob'?'Bob':id}},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
   await c.route('**/api/public/relay/v1',async route=>{try{const p=await server.transport().request(route.request().postDataJSON(),id);await route.fulfill({json:{ok:true,protocolVersion:1,...p}});}catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}});
   const page=await c.newPage();await page.goto('/game-shelf/play/#home');await expect(page.locator('#connection')).toHaveText('Up to date');pages.push(page);
  }
  const host=pages[0];await host.getByRole('button',{name:'New game',exact:true}).click();await host.getByLabel('Game size').selectOption('4');await host.getByRole('button',{name:'Create game',exact:true}).click();await expect(host.getByRole('heading',{name:'Game lobby',exact:true})).toBeVisible();await expect(host.locator('.lobby-seat')).toHaveCount(4);
  await host.getByRole('button',{name:'Share invitation',exact:true}).click();const invite=await host.getByLabel('Invitation link').inputValue();await host.getByRole('button',{name:'Close panel'}).click();
  for(let i=1;i<4;i++){await pages[i].goto(invite);await pages[i].getByRole('button',{name:'Join game',exact:true}).click();await expect(pages[i].getByRole('heading',{name:'Game lobby',exact:true})).toBeVisible();await expect(pages[i].getByRole('button',{name:'Start game',exact:true})).toHaveCount(0);}
  await host.getByRole('button',{name:'Start game',exact:true}).click();await expect(host.locator('.players .player')).toHaveCount(4);
  for(const page of pages.slice(1)){await page.locator('#refresh').evaluate(button=>button.click());await expect(page.locator('#board')).toBeVisible();await expect(page.locator('.players .bot-tag')).toHaveCount(0);}
  const states=await Promise.all(pages.map(page=>page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.members;})));for(const seats of states)expect(seats).toEqual(states[0]);
 }finally{for(const c of contexts)await c.close();}
});

test('four-player solo shows three named bots and reloads offline on a phone',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Game size').selectOption('4');await page.getByLabel('Play mode').selectOption('solo');await expect(page.getByLabel('Game size')).toHaveValue('4');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(3);
 const names=await page.locator('.players strong').allTextContents();expect(names.join(' ')).not.toMatch(/Bot [123]/);await expect(page.locator('#offline-status')).toHaveText('Ready for offline');await context.setOffline(true);await page.reload();await expect(page.locator('.players .bot-tag')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});

test('signed-in home survives refresh and foreground events without network calls',async({browser})=>{
 const context=await browser.newContext();let calls=0;
 try{await context.route(/^https:\/\//,route=>{calls++;return route.abort();});const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.locator('#refresh').evaluate(button=>button.click());await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});await expect(page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();expect(calls).toBe(0);}finally{await context.close();}
});

test('Solo via backend starts without an invitation, sends moves through the relay and shows request timing',async({browser})=>{
 const server=fakeRelay({channelId,members:['alice']}),context=await browser.newContext();let legacy=0;
 try{
  await context.route('**/api/public/catan',r=>{legacy++;return r.abort();});
  await context.route('**/api/public/relay/v1',async route=>{try{const p=await server.transport().request(route.request().postDataJSON(),'alice');await route.fulfill({json:{ok:true,protocolVersion:1,...p}});}catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}});
  const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo-relay');await page.getByLabel('Game size').selectOption('4');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board')).toBeVisible();await expect(page.locator('.players .bot-tag')).toHaveCount(3);
  const inspect=()=>page.evaluate(async()=>{const {client}=await import('./session.js');const p=(await client.inspect()).packet;return {local:client.isLocal(),relaySolo:p.relaySolo,room:p.roomId,revision:p.revision};});const before=await inspect();expect(before.local).toBe(false);expect(before.relaySolo).toBe(true);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Connection timing',exact:true}).click();await expect(page.getByRole('heading',{name:'Connection timing',exact:true})).toBeVisible();await expect(page.locator('#sheet-body')).toContainText('median');await page.getByRole('button',{name:'Reset measurements',exact:true}).click();await expect(page.locator('#sheet-body')).toContainText('No requests measured yet.');await page.locator('#close-sheet').click();
  await expect(page.locator('#offline-status')).toHaveText('Ready for offline');await page.reload();await expect(page.locator('#board')).toBeVisible();expect((await inspect()).room).toBe(before.room);expect((await inspect()).local).toBe(false);expect(legacy).toBe(0);
  expect(server.sent.some(x=>x.body.op==='message.append'&&x.body.message.type==='game.begin')).toBe(true);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.saved-game')).toContainText('Solo via backend');
 }finally{await context.close();}
});
