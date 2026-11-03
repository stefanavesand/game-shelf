import {test,expect} from '@playwright/test';
import {service} from './mock-service.js';
import {RESOURCES} from '../../play/core/protocol.js';
const url='http://127.0.0.1:4176/game-shelf/play/';
const bundle=values=>({...Object.fromEntries(RESOURCES.map(r=>[r,0])),...values});
async function start(browser,options={}){
  const backend=service({phase:'main',...options}),context=await browser.newContext({viewport:options.viewport||{width:1024,height:768}});await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto(url);await expect(page.locator('#connection')).toHaveText('Up to date');await page.getByRole('button',{name:'Trade',exact:true}).click();return {backend,context,page};
}
async function selectOffer(page){await page.getByRole('button',{name:'Choose Brick to give',exact:true}).click();await page.getByRole('button',{name:'Choose Brick to give',exact:true}).click();await page.getByRole('button',{name:'Request Ore to receive',exact:true}).click();}

test('own hand, kept cards, review/edit and exact player offer are consistent without early transfer',async({browser})=>{
  const expectedAction={type:'TRADE_OFFER',to:'p2',give:bundle({brick:2}),receive:bundle({ore:1})},{backend,context,page}=await start(browser,{expectedAction});
  try{
    await expect(page.getByRole('heading',{name:'Trade',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Choose Brick to give',exact:true})).toContainText('Keep 3');await selectOffer(page);
    await expect(page.getByRole('button',{name:'Choose Brick to give',exact:true})).toContainText('Keep 1');await expect(page.getByText('9 of your current cards kept')).toBeVisible();await expect(page.locator('.trade-live-summary')).toHaveText('2 Brick →for 1 Ore');await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:/^Bot\s*0 cards/}).click();await expect(page.getByText('Bot has no resource cards to trade.')).toBeVisible();await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeDisabled();await page.getByRole('button',{name:/^Bob\s*5 cards/}).click();await page.getByRole('button',{name:'Review trade',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Your hand after acceptance',exact:true})).toBeVisible();await expect(page.getByLabel('Brick after trade',{exact:true})).toHaveText('1');await expect(page.getByLabel('Ore after trade',{exact:true})).toHaveText('4');expect(backend.commands).toHaveLength(0);expect(backend.current.p1.view.state.players.players[0].resources.brick).toBe(3);
    await page.getByRole('button',{name:'Edit trade',exact:true}).click();await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('2');await expect(page.getByLabel('Ore requested',{exact:true})).toHaveText('1');await page.getByRole('button',{name:'Review trade',exact:true}).click();await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(1);expect(backend.commands[0].action).toEqual(expectedAction);expect(backend.current.p1.view.state.players.players[0].resources.brick).toBe(3);
  }finally{await context.close();}
});

test('card quantities respect the hand, mutual exclusion and public request limit',async({browser})=>{
  const {backend,context,page}=await start(browser);
  try{
    const brick=page.getByRole('button',{name:'Choose Brick to give',exact:true});for(let i=0;i<3;i++)await brick.click();await expect(brick).toBeDisabled();await expect(page.getByRole('button',{name:'Add Brick to offer',exact:true})).toBeDisabled();await expect(brick).toContainText('Keep 0');await expect(page.getByRole('button',{name:'Request Brick to receive',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Remove Brick from offer',exact:true}).click();await expect(brick).toContainText('Keep 1');
    await page.getByRole('button',{name:'Request Ore to receive',exact:true}).click();for(let i=0;i<4;i++)await page.getByRole('button',{name:'Add Ore to request',exact:true}).click();await expect(page.getByRole('button',{name:'Add Ore to request',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Choose Ore to give',exact:true})).toBeDisabled();await expect(page.getByLabel('Ore requested',{exact:true})).toHaveText('5');expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});

test('bank mode displays the actual port rate, preserves player draft and confirms an exact legal exchange',async({browser})=>{
  const {backend,context,page}=await start(browser);
  try{
    await selectOffer(page);await page.getByRole('button',{name:'Bank & ports',exact:true}).click();await expect(page.getByRole('button',{name:'Bank & ports',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Select Ore to give',exact:true})).toContainText('2 → 1');await page.getByRole('button',{name:'Select Ore to give',exact:true}).click();await page.getByRole('button',{name:'Select Brick to receive',exact:true}).click();await expect(page.locator('.trade-live-summary')).toHaveText('2 Ore →for 1 Brick');
    await page.getByRole('button',{name:'Players',exact:true}).click();await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('2');await page.getByRole('button',{name:'Bank & ports',exact:true}).click();await page.getByRole('button',{name:'Review trade',exact:true}).click();await expect(page.getByLabel('Ore after trade',{exact:true})).toHaveText('1');await expect(page.getByLabel('Brick after trade',{exact:true})).toHaveText('4');expect(backend.commands).toHaveLength(0);await page.getByRole('button',{name:'Confirm trade',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(1);expect(backend.commands[0].action).toEqual({type:'BANK_TRADE',give:{resource:'ore',amount:2},receive:{resource:'brick',amount:1}});await expect(page.locator('.resource-tile.ore strong')).toHaveText('1');await expect(page.locator('.resource-tile.brick strong')).toHaveText('4');
  }finally{await context.close();}
});

test('unchanged polling retains a trade draft; offline and changed revisions block stale trades',async({browser})=>{
  const {backend,context,page}=await start(browser);
  try{
    await selectOffer(page);await page.getByRole('button',{name:'Add Brick to offer',exact:true}).focus();await page.evaluate(()=>window.tradeFocus=document.activeElement);await page.evaluate(()=>document.getElementById('refresh').click());await page.evaluate(async()=>{const {client}=await import('/game-shelf/play/session.js');await client.inspect();await client.inspect();});expect(await page.evaluate(()=>document.activeElement===window.tradeFocus)).toBe(true);await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('2');
    await context.setOffline(true);await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeDisabled();await expect(page.getByText('Reconnect and resolve any pending move before trading.')).toBeVisible();await context.setOffline(false);await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeEnabled();
    for(const seat of ['p1','p2']){const p=backend.current[seat];p.revision++;p.view.revision=p.revision;}await page.evaluate(()=>document.getElementById('refresh').click());await expect(page.getByText('The game changed. Close and reopen Trade to review your cards.')).toBeVisible();await expect(page.getByRole('button',{name:'Review trade',exact:true})).toBeDisabled();expect(backend.commands).toHaveLength(0);await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.getByRole('button',{name:'Trade',exact:true}).click();await expect(page.getByRole('button',{name:'Choose Brick to give',exact:true})).toContainText('Keep 3');
  }finally{await context.close();}
});

for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800}])test(`trade cards reflow with readable holdings at ${viewport.width}×${viewport.height}`,async({browser},testInfo)=>{
  const {backend,context,page}=await start(browser,{viewport});
  try{
    await selectOffer(page);const dialog=await page.getByRole('dialog').boundingBox();expect(dialog.x).toBeGreaterThanOrEqual(0);expect(dialog.x+dialog.width).toBeLessThanOrEqual(viewport.width);expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);const a=await page.locator('.trade-areas>section').nth(0).boundingBox(),b=await page.locator('.trade-areas>section').nth(1).boundingBox();if(viewport.width<=640)expect(b.y).toBeGreaterThan(a.y+a.height);else expect(b.x).toBeGreaterThan(a.x+a.width);
    const card=await page.getByRole('button',{name:'Choose Wood to give',exact:true}).boundingBox();expect(card.width).toBeGreaterThanOrEqual(44);expect(card.height).toBeGreaterThanOrEqual(44);const scrollTop=await page.locator('.trade-scroll').evaluate(el=>el.scrollTop);await page.getByRole('button',{name:'Add Ore to request',exact:true}).click();expect(await page.locator('.trade-scroll').evaluate(el=>el.scrollTop)).toBeGreaterThanOrEqual(scrollTop-1);const scroller=await page.locator('.trade-scroll').boundingBox(),footer=await page.locator('.trade-footer').boundingBox();expect(scroller.y+scroller.height).toBeLessThanOrEqual(footer.y+1);const close=await page.getByRole('button',{name:'Close panel',exact:true}).boundingBox();expect(close.y).toBeGreaterThanOrEqual(0);expect(close.y+close.height).toBeLessThanOrEqual(viewport.height);await page.screenshot({path:testInfo.outputPath(`trade-${viewport.width}.png`),fullPage:true});expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});
