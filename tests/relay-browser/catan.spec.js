import {test,expect} from '@playwright/test';
import {fakeRelay} from '../relay/fake-relay.js';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,eligibleActors} from '../../play/catan/rules/index.js';
import {digest} from '../../play/relay/protocol.js';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',channelId='10000000-0000-4000-8000-000000000001';
async function player(browser,server,id){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(id=>localStorage.setItem('spelhyllan-online-auth-v1',JSON.stringify({user:{id,app_metadata:{provider:'google'}},access_token:id,refresh_token:'fixture',expires_at:4102444800})),id);
 await context.route('**/api/public/relay/v1',async route=>{const body=route.request().postDataJSON();try{const packet=await server.transport().request(body,id);await route.fulfill({json:{ok:true,protocolVersion:1,...packet}});}catch(error){await route.fulfill({status:409,json:{ok:false,protocolVersion:1,error:{code:error.code,message:error.message,retryable:false}}});}});
 const page=await context.newPage();await page.goto('/game-shelf/play/catan/');await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.locator('#create')).toBeEnabled();return {context,page,id};
}
async function sync(page){await page.locator('#sync').click();await expect(page.locator('#sync')).toBeEnabled();}
const saved=({page,id})=>page.evaluate(async({id,channelId})=>(await import('/game-shelf/play/relay/store.js')).createRelayStore({name:'game-shelf-catan-base-v1'}).load(id,channelId),{id,channelId});
test('browser and Node replay the same Catan trace with the same hashes',async({page})=>{
 const m=createCatanModule(CATAN_ARTIFACT.compatibilityId),config=catanConfig([{id:'a',name:'A'},{id:'b',name:'B'}],{seed:424242});let state=m.initialize(config,{gameId:'cross-runtime'});const trace=[];
 for(let i=0;i<100;i++){const command=m.nextBot(state)??(()=>{const actor=eligibleActors(state.snapshot)[0];return {actor,action:botDecision(m.view(state,actor),'standard')};})();const seat=state.snapshot.seats.find(s=>s.id===command.actor),sender=seat.kind==='bot'?'a':seat.id;state=m.apply(state,sender,command,{}, {coordinatorId:'a'});trace.push({command,sender,hash:await digest(state)});}
 await page.goto('/game-shelf/play/catan/');
 const result=await page.evaluate(async({config,trace,digestValue})=>{
  const {createCatanModule}=await import('/game-shelf/play/catan/module.js'),{digest}=await import('/game-shelf/play/relay/protocol.js');const m=createCatanModule(digestValue);let state=m.initialize(config,{gameId:'cross-runtime'});
  for(let i=0;i<trace.length;i++){const step=trace[i];state=m.apply(state,step.sender,step.command,{}, {coordinatorId:'a'});if(await digest(state)!==step.hash)return {match:false,step:i};}return {match:true,revision:state.snapshot.revision};
 },{config,trace,digestValue:CATAN_ARTIFACT.compatibilityId});assertResult(result);
});
function assertResult(result){expect(result).toEqual({match:true,revision:100});}
test('two PWAs place directly on the board with a coordinator bot and resume the same state',async({browser})=>{
 const server=fakeRelay({creator:alice,members:[alice,bob],channelId}),a=await player(browser,server,alice),b=await player(browser,server,bob);
 try{
  await a.page.locator('#create').click();await expect(a.page.locator('#begin')).toBeEnabled();await b.page.locator('#token').fill('fixture-only');await b.page.locator('#join').click();await expect(b.page.locator('#sync')).toBeEnabled();
  await a.page.locator('#begin').click();await expect(a.page.locator('#revision')).not.toHaveText('—');await expect(a.page.locator('#sync')).toBeEnabled();
  for(let i=0;i<12;i++){
   await sync(a.page);await sync(b.page);const state=await saved(a),snapshot=state.game.state.snapshot;
   if(!snapshot.state.game.phase.startsWith('setup-'))break;
   const actor=snapshot.state.game.currentPlayerId,p=actor===alice?a:b;const revision=(await saved(p)).game.revision;
   await p.page.locator('#board [role="button"]').first().click();await expect(p.page.locator('#confirm')).toBeEnabled();await p.page.locator('#confirm').click();
   await expect.poll(async()=>(await saved(p)).game.revision).toBeGreaterThan(revision);await expect(p.page.locator('#sync')).toBeEnabled();
  }
  await sync(a.page);await sync(b.page);const x=await saved(a),y=await saved(b);
  expect(x.game.state.snapshot.state.game.phase).not.toMatch(/^setup-/);expect(x.game.hash).toBe(y.game.hash);expect(x.game.state.snapshot.state.board.buildings.length).toBeGreaterThanOrEqual(6);expect(x.halt).toBeNull();
  expect(server.messages.some(m=>m.message.type==='game.command'&&m.message.payload.command.actor.startsWith('bot:'))).toBe(true);
  expect(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await b.page.reload();await b.page.getByRole('button',{name:'Connect',exact:true}).click();await expect(b.page.locator('#revision')).not.toHaveText('—');await expect(b.page.locator('#sync')).toBeEnabled();expect((await saved(b)).game.hash).toBe(x.game.hash);
 }finally{await a.context.close();await b.context.close();}
});
