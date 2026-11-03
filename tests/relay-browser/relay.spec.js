import {test,expect} from '@playwright/test';
import {fakeRelay} from '../relay/fake-relay.js';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',channel='10000000-0000-4000-8000-000000000001';
async function browserPlayer(browser,server,principal,{lose=false,storageFail=false}={}) {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(({principal,storageFail})=>{
  localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id:principal},access_token:principal,refresh_token:'fixture',expires_at:4102444800}));
  if(storageFail)Object.defineProperty(globalThis,'indexedDB',{value:{open(){throw Error('Storage denied');}}});
  if(navigator.storage)navigator.storage.persist=async()=>false;
 },{principal,storageFail});
 let loseOnce=lose;
 await context.route('**/api/public/relay/v1',async route=>{
  const body=route.request().postDataJSON();try{
   const packet=await server.transport().request(body,principal);
   if(loseOnce&&body.op==='message.append'&&body.message.type==='game.command'){loseOnce=false;await route.abort();return;}
   await route.fulfill({json:{ok:true,protocolVersion:1,requestId:body.requestId,...packet}});
  }catch(error){await route.fulfill({status:error.code==='sequence_conflict'?409:503,json:{ok:false,protocolVersion:1,requestId:body.requestId,error:{code:error.code,message:error.message,retryable:error.retryable}}});}
 });
 const page=await context.newPage();await page.goto('/game-shelf/play/relay/');
 await page.getByRole('button',{name:'Connect',exact:true}).click();
 if(!storageFail)await expect(page.locator('#admission')).toBeVisible();
 return {context,page};
}
test('two browser replicas share state, explicit effects and peer verification',async({browser})=>{
 const server=fakeRelay({creator:alice,members:[alice,bob],channelId:channel}),a=await browserPlayer(browser,server,alice),b=await browserPlayer(browser,server,bob);
 await a.page.getByRole('button',{name:'Create channel',exact:true}).click();await b.page.locator('#token').fill('fixture-only');await b.page.getByRole('button',{name:'Join channel',exact:true}).click();
 await expect(a.page.locator('#storage')).toContainText('not granted');
 await a.page.getByRole('button',{name:'Start counter',exact:true}).click();await b.page.locator('#sync').click();
 await a.page.getByRole('button',{name:'Add 1',exact:true}).click();await b.page.locator('#sync').click();await expect(b.page.locator('#value')).toHaveText('1');
 await a.page.locator('#sync').click();await expect(a.page.locator('#verification')).toHaveText('Both players agree');
 await expect(a.page.locator('#hash')).toHaveText(await b.page.locator('#hash').textContent());
 expect(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await a.context.close();await b.context.close();
});
test('IndexedDB outbox survives full reload after a lost append response',async({browser})=>{
 const server=fakeRelay({creator:alice,members:[alice,bob],channelId:channel}),a=await browserPlayer(browser,server,alice,{lose:true});
 await a.page.getByRole('button',{name:'Create channel',exact:true}).click();await a.page.getByRole('button',{name:'Start counter',exact:true}).click();await a.page.getByRole('button',{name:'Add 1',exact:true}).click();
 await expect(a.page.locator('#error')).toContainText('NETWORK_UNAVAILABLE');await expect(a.page.locator('#pending')).toHaveText('1');
 await a.page.reload();await a.page.getByRole('button',{name:'Connect',exact:true}).click();await expect(a.page.locator('#value')).toHaveText('1');await expect(a.page.locator('#pending')).toHaveText('0');
 expect(server.messages.filter(m=>m.message.type==='game.command')).toHaveLength(1);await a.context.close();
});
test('a disagreement is durable and blocks new moves after reload',async({browser})=>{
 const server=fakeRelay({creator:alice,members:[alice,bob],channelId:channel}),a=await browserPlayer(browser,server,alice);
 await a.page.locator('#create').click();await a.page.locator('#begin').click();await expect(a.page.locator('#revision')).toHaveText('0');const begin=server.messages.find(m=>m.message.type==='game.begin');
 server.messages.push({sequence:server.messages.length+1,messageId:'mismatch',senderId:bob,message:{schema:'game-shelf/session/1',type:'game.verify',payload:{gameId:begin.message.payload.gameId,revision:0,resultHash:'different'}}});
 await a.page.locator('#sync').click();await expect(a.page.locator('#error')).toContainText('Game stopped');await expect(a.page.locator('#add')).toBeDisabled();
 await a.page.reload();await a.page.getByRole('button',{name:'Connect',exact:true}).click();await expect(a.page.locator('#verification')).toHaveText('Stopped');await expect(a.page.locator('#add')).toBeDisabled();await a.context.close();
});
test('denied IndexedDB prevents channel creation',async({browser})=>{
 const server=fakeRelay({creator:alice,members:[alice,bob],channelId:channel}),a=await browserPlayer(browser,server,alice,{storageFail:true});
 await expect(a.page.locator('#error')).toContainText('STORAGE_FAILURE');expect(server.sent.filter(x=>x.body.op==='channel.create')).toHaveLength(0);await a.context.close();
});
