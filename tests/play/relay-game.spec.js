import {test,expect} from '@playwright/test';
import {fakeRelay} from '../relay/fake-relay.js';
const channelId='10000000-0000-4000-8000-000000000001';
test('normal game UI runs online Catan using only relay messages and local rules',async({browser})=>{
 const server=fakeRelay({channelId}),a=await browser.newContext(),b=await browser.newContext();let oldCalls=0;
 async function setup(context,id){await context.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
 await context.route('**/api/public/catan',route=>{oldCalls++;return route.abort();});await context.route('**/api/public/relay/v1',async route=>{const body=route.request().postDataJSON();try{const packet=await server.transport().request(body,id);await route.fulfill({json:{ok:true,protocolVersion:1,...packet}});}catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}});const page=await context.newPage();await page.goto('/game-shelf/play/#home');await expect(page.locator('#connection')).toHaveText('Up to date');return page;}
 try{const x=await setup(a,'alice'),y=await setup(b,'bob');
 await x.getByRole('button',{name:'New game',exact:true}).click();await x.getByLabel('Your name',{exact:true}).fill('Alice');await x.getByRole('button',{name:'Create game',exact:true}).click();await expect(x.locator('.players .bot-tag')).toHaveCount(1);
 await x.locator('#room').click();await x.getByRole('button',{name:'Invitation details',exact:true}).click();const invite=await x.getByLabel('Invitation link').inputValue();await x.getByRole('button',{name:'Close panel'}).click();
 await y.goto(invite);await y.getByLabel('Your name',{exact:true}).fill('Bob');await y.getByRole('button',{name:'Join game',exact:true}).click();await expect(y.locator('.players .bot-tag')).toHaveCount(1);
 const packet=await x.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet;});const p=packet.view.state.game.currentPlayerId==='alice'?x:y;
 await p.locator('#board [role="button"]').first().click();await p.getByRole('button',{name:'Confirm',exact:true}).click();await expect(p.locator('#connection')).toHaveText('Up to date');
 const packets=await Promise.all([x,y].map(page=>page.evaluate(async()=>{const {client}=await import('./session.js');return client.refresh();})));expect(packets[0].revision).toBe(packets[1].revision);expect(packets[0].view.state.board.buildings).toEqual(packets[1].view.state.board.buildings);expect(oldCalls).toBe(0);
 }finally{await a.close();await b.close();}
});

test('two emulated human seats and the ordinary bot finish a natural relay game',async({browser},testInfo)=>{
 test.setTimeout(240000);
 const server=fakeRelay({channelId}),contexts=await Promise.all([browser.newContext(),browser.newContext()]);
 let forbiddenCalls=0,commands=0,reloaded=false;
 async function packet(page){return page.evaluate(async()=>{const {client}=await import('./session.js');return client.refresh();});}
 try{
  const pages=[];
  for(const [i,context] of contexts.entries()){
   const id=['alice','bob'][i];
   await context.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
   await context.route('**/api/public/catan',route=>{forbiddenCalls++;return route.abort();});
   await context.route('**/rest/v1/rpc/**',route=>{forbiddenCalls++;return route.abort();});
   await context.route('**/api/public/relay/v1',async route=>{
    try{const reply=await server.transport().request(route.request().postDataJSON(),id);await route.fulfill({json:{ok:true,protocolVersion:1,...reply}});}
    catch(e){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:e.code,message:e.message,retryable:false}}});}
   });
   const page=await context.newPage();await page.goto('/game-shelf/play/#home');await expect(page.locator('#connection')).toHaveText('Up to date');pages.push(page);
  }
  const [host,guest]=pages;
  await host.getByRole('button',{name:'New game',exact:true}).click();await host.getByLabel('Your name',{exact:true}).fill('Alice');await host.getByRole('button',{name:'Create game',exact:true}).click();
  await host.locator('#room').click();await host.getByRole('button',{name:'Invitation details',exact:true}).click();const invite=await host.getByLabel('Invitation link').inputValue();await host.getByRole('button',{name:'Close panel'}).click();
  await guest.goto(invite);await guest.getByLabel('Your name',{exact:true}).fill('Bob');await guest.getByRole('button',{name:'Join game',exact:true}).click();
  let packets;
  for(let step=0;step<1600;step++){
   // Synchronize both independent replicas before choosing from a seat's own view.
   packets=[await packet(host),await packet(guest)];
   if(packets.every(p=>p.status==='ended'))break;
   let moved=false;
   for(let i=0;i<2;i++){
    if(!packets[i].view?.choices.length)continue;
    const result=await pages[i].evaluate(async p=>{
     const {client}=await import('./session.js'),{botDecision}=await import('./catan/rules/index.js');
     return client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')});
    },packets[i]);
    expect(result.ok).toBe(true);commands++;moved=true;break;
   }
   if(commands>=25&&!reloaded){await guest.reload();await expect(guest.locator('#connection')).toHaveText('Up to date');reloaded=true;}
   // An eligible ordinary bot is progressed by the creator's normal refresh path.
   if(!moved)expect(packets.some(p=>p.members.some(m=>m.kind==='bot'))).toBe(true);
  }
  packets=[await packet(host),await packet(guest)];
  expect(packets.map(p=>p.status)).toEqual(['ended','ended']);expect(packets[0].revision).toBe(packets[1].revision);expect(packets[0].view.state.board).toEqual(packets[1].view.state.board);
  const checkpoints=await Promise.all(pages.map((page,i)=>page.evaluate(async({principal,roomId})=>{const {createRelayStore}=await import('./relay/store.js');const r=await createRelayStore({name:'game-shelf-online-catan-v1'}).load(principal,roomId);return {hash:r.game.hash,halt:r.halt,outbox:r.outbox.length};},{principal:['alice','bob'][i],roomId:packets[i].roomId})));
  expect(checkpoints[0]).toEqual(checkpoints[1]);expect(checkpoints[0].halt).toBeNull();expect(checkpoints[0].outbox).toBe(0);
  expect(packets[0].members.filter(m=>m.kind==='human')).toHaveLength(2);expect(packets[0].members.filter(m=>m.kind==='bot')).toHaveLength(1);expect(commands).toBeGreaterThan(25);expect(reloaded).toBe(true);expect(forbiddenCalls).toBe(0);
  await host.reload();await expect(host.locator('#connection')).toHaveText('Up to date');expect((await packet(host)).status).toBe('ended');
  await testInfo.attach('emulated-game-summary',{body:JSON.stringify({humanCommands:commands,revision:packets[0].revision,guestReloaded:reloaded,forbiddenCalls,transport:'in-memory relay contract double',actions:'production session API; human choices from seat-restricted heuristic, not DOM clicks'}),contentType:'application/json'});
 }finally{for(const context of contexts)await context.close();}
});


test('a fresh invitation allows joining before an anonymous identity exists',async({browser})=>{
 const context=await browser.newContext();let externalCalls=0;
 try{
  await context.route(/^https:\/\//,route=>{externalCalls++;return route.abort();});
  const page=await context.newPage();await page.goto('/game-shelf/play/#join?room=10000000-0000-4000-8000-000000000001&invite=fixture-only');
  await page.getByLabel('Your name',{exact:true}).fill('New guest');
  await expect(page.getByRole('button',{name:'Join game',exact:true})).toBeEnabled();
  await expect(page.locator('#connection')).toHaveText('Up to date');
  expect(externalCalls).toBe(0);
 }finally{await context.close();}
});
