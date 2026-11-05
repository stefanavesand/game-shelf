import {test,expect} from '@playwright/test';
import {service} from './mock-service.js';
import {RESOURCES} from '../../play/core/protocol.js';
const url='http://127.0.0.1:4176/game-shelf/play/';
const bundle=values=>({...Object.fromEntries(RESOURCES.map(r=>[r,0])),...values});
async function start(browser,options={}){
  const backend=service({phase:'main',...options}),context=await browser.newContext({viewport:options.viewport||{width:1024,height:768}});await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto(url);await expect(page.locator('#connection')).toHaveText('Up to date');await page.getByRole('button',{name:'Trade',exact:true}).click();return {backend,context,page};
}
async function selectOffer(page){await page.getByRole('button',{name:'Add Brick to give',exact:true}).click();await page.getByRole('button',{name:'Add Brick to give',exact:true}).click();await page.getByRole('button',{name:'Add Ore to request',exact:true}).click();}

test('resource rows send the exact offer directly and show holdings before submission',async({browser})=>{
 const expectedAction={type:'TRADE_OFFER',to:'p2',give:bundle({brick:2}),receive:bundle({ore:1})},{backend,context,page}=await start(browser,{expectedAction});
 try{
  await expect(page.locator('#trade-target')).toHaveValue('all');await expect(page.locator('.trade-row[data-resource]')).toHaveCount(5);await expect(page.getByLabel('Brick in hand',{exact:true})).toHaveText('3');await selectOffer(page);await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('2');await expect(page.getByText('9 of your current cards kept')).toBeVisible();
  await page.locator('#trade-target').selectOption('p3');await expect(page.getByRole('button',{name:'Send offer',exact:true})).toBeDisabled();await page.locator('#trade-target').selectOption('p2');
  expect(backend.commands).toHaveLength(0);await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(1);expect(backend.commands[0].action).toEqual(expectedAction);await expect(page.getByRole('dialog')).toBeVisible();
 }finally{await context.close();}
});
test('quantities respect holdings and public limits, with stale drafts blocked',async({browser})=>{
 const {backend,context,page}=await start(browser);try{
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Add Brick to give',exact:true}).click();await expect(page.getByRole('button',{name:'Add Brick to give',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Add Brick to request',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Remove Brick from offer',exact:true}).click();
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Add Ore to request',exact:true}).click();await expect(page.getByRole('button',{name:'Add Ore to request',exact:true})).toBeDisabled();
  await context.setOffline(true);await expect(page.getByRole('button',{name:'Send offer',exact:true})).toBeDisabled();await context.setOffline(false);for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;}await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.getByText('The game changed. Close and reopen Trade to review your cards.')).toBeVisible();expect(backend.commands).toHaveLength(0);
 }finally{await context.close();}
});
test('bank rows show the actual rate and send one exact legal exchange',async({browser})=>{
 const {backend,context,page}=await start(browser);try{
  await selectOffer(page);await page.getByRole('button',{name:'Bank & ports',exact:true}).click();await expect(page.locator('[data-resource="ore"]')).toContainText('2:1');await page.getByRole('button',{name:'Add Ore to give',exact:true}).click();await page.getByRole('button',{name:'Add Brick to receive',exact:true}).click();await expect(page.getByLabel('Ore offered',{exact:true})).toHaveText('2');await page.getByRole('button',{name:'Trade with bank',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect.poll(()=>backend.accepted).toBe(1);expect(backend.commands[0].action).toEqual({type:'BANK_TRADE',give:{resource:'ore',amount:2},receive:{resource:'brick',amount:1}});
 }finally{await context.close();}
});
for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800}])test(`resource rows fit ${viewport.width}×${viewport.height}`,async({browser})=>{
 const {context,page}=await start(browser,{viewport});try{await selectOffer(page);expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);const box=await page.getByRole('button',{name:'Add Wood to give',exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);await expect(page.getByRole('button',{name:'Send offer',exact:true})).toBeInViewport();}finally{await context.close();}
});

test('waiting All offer shows individual replies and can be replaced in the same dialog',async({browser})=>{
 const expectedAction={type:'TRADE_OFFER',to:'all',give:bundle({brick:2}),receive:bundle({ore:1})};const {backend,context,page}=await start(browser,{expectedAction});
 try{
  await selectOffer(page);await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect(page.getByRole('heading',{name:'Your trade offer',exact:true})).toBeVisible();await expect(page.locator('.trade-responses li')).toHaveCount(2);
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.view.offer.responses.p3='declined';p.view.trades=[{...structuredClone(p.view.offer),status:'waiting',revision:p.revision}];}
  await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.locator('.trade-responses li').filter({hasText:'Declined'})).toHaveCount(1);await expect(page.locator('.trade-responses li').filter({hasText:'Waiting'})).toHaveCount(1);
  await page.getByRole('button',{name:'Edit offer',exact:true}).click();await page.getByRole('button',{name:'Remove Brick from offer',exact:true}).click();await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('1');
  Object.assign(expectedAction,{give:bundle({brick:1}),replaces:'mock-offer-1'});await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(2);await expect(page.getByRole('heading',{name:'Your trade offer',exact:true})).toBeVisible();expect(backend.commands[1].action.replaces).toBe('mock-offer-1');
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.view.trades=[{...structuredClone(p.view.offer),responses:{p2:'accepted'},status:'accepted',by:'p2',revision:p.revision}];p.view.offer=null;}
  await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.trade-responses')).toContainText('Trade completed.');
 }finally{await context.close();}
});

for(const response of ['TRADE_ACCEPT','TRADE_DECLINE'])test(`counteroffer overlays the original dialog and ${response} closes both`,async({browser})=>{
 const expectedAction={type:'TRADE_OFFER',to:'all',give:bundle({brick:2}),receive:bundle({ore:1})}, {backend,context,page}=await start(browser,{expectedAction});
 try{
  await selectOffer(page);await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect(page.getByRole('heading',{name:'Your trade offer',exact:true})).toBeVisible();
  for(const p of Object.values(backend.current)){
   const previous={...p.view.offer,status:'replaced',by:'p2',revision:p.revision+1};p.revision++;p.view.revision=p.revision;
   p.view.offer={id:'counter-offer',from:'p2',to:'p1',recipients:['p1'],responses:{},give:bundle({ore:2}),receive:bundle({brick:1})};p.view.trades=[previous,{...structuredClone(p.view.offer),status:'waiting',revision:p.revision}];p.view.choices=[{type:'TRADE_ACCEPT',offerId:'counter-offer'},{type:'TRADE_DECLINE',offerId:'counter-offer'}];
  }
  await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.locator('#sheet')).toHaveAttribute('open','');await expect(page.locator('#trade-reply')).toBeVisible();await expect(page.locator('#trade-reply')).toContainText('counteroffers');await expect(page.locator('#trade-reply')).toContainText('2 Ore');
  await page.locator('#trade-reply').getByRole('button',{name:response==='TRADE_ACCEPT'?'Accept':'Decline',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(2);await expect(page.locator('#sheet')).not.toBeVisible();await expect(page.locator('#trade-reply')).not.toBeVisible();expect(backend.commands.at(-1).action).toEqual({type:response,offerId:'counter-offer'});
 }finally{await context.close();}
});
