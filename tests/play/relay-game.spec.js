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
