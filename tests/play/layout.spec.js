import {test,expect} from './account-fixture.js';
import {service} from './mock-service.js';
async function start(browser,viewport){const context=await browser.newContext({viewport}),backend=service({phase:'main'});await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('/game-shelf/play/#game');await expect(page.getByRole('button',{name:'Build',exact:true})).toBeVisible();return {context,page,backend};}
async function fits(page,selector){return page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {visible:r.width>0&&r.height>0,inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};});}
for(const [width,height] of [[390,664],[360,640],[844,390],[1024,768],[768,1024],[1366,1024]])test(`fixed game and sidebar fit ${width}×${height}`,async({browser})=>{
 const {context,page}=await start(browser,{width,height});try{
  for(const s of ['.players','#board','.action-panel','.action-buttons'])expect(await fits(page,s),s).toEqual({visible:true,inside:true});
  expect(await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}))).toEqual({height,width});
  await page.screenshot({path:`test-results/game-${width}x${height}.png`});
  const before=await page.locator('#board').boundingBox();await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Game Shelf',exact:true})).toBeVisible();expect(await fits(page,'#sidebar')).toEqual({visible:true,inside:true});expect(await page.locator('#board').boundingBox()).toEqual(before);
  await page.getByRole('button',{name:'Close menu',exact:true}).click();await page.getByRole('button',{name:'Trade',exact:true}).click();expect(await fits(page,'#sheet')).toEqual({visible:true,inside:true});await expect(page.locator('#trade-form button[type=submit]')).toBeVisible();
  expect(await page.locator('#sheet').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  const resources=new Set();for(let i=0;i<5;i++){for(const r of await page.locator('.trade-row[data-resource]:visible').evaluateAll(rows=>rows.map(r=>r.dataset.resource)))resources.add(r);const next=page.getByRole('button',{name:'Next resources',exact:true});if(!await next.count()||await next.isDisabled())break;const current=await page.locator('.resource-pages span').textContent();await next.click();await expect(page.locator('.resource-pages span')).not.toHaveText(current);}expect(resources.size).toBe(5);
  await page.screenshot({path:`test-results/layout-${width}x${height}.png`});
 }finally{await context.close();}
});

test('trade draft and board preview survive rotation, polling and sidebar navigation',async({browser})=>{
 const {context,page}=await start(browser,{width:390,height:664});try{
  await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('button',{name:'Add Brick to give',exact:true}).click();await page.getByRole('button',{name:'Add Ore to request',exact:true}).click();
  await page.setViewportSize({width:844,height:390});await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('1');await expect(page.getByLabel('Ore requested',{exact:true})).toHaveText('1');
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByRole('heading',{name:'Trade',exact:true})).toBeVisible();await expect(page.getByLabel('Brick offered',{exact:true})).toHaveText('1');
  await page.setViewportSize({width:390,height:664});await expect(page.getByLabel('Ore requested',{exact:true})).toHaveText('1');await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');
  const selected=await page.locator('#board [aria-pressed=true]').getAttribute('aria-label');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.setViewportSize({width:1024,height:768});await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('#sidebar')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeFocused();await expect(page.locator('#board [aria-pressed=true]')).toHaveAttribute('aria-label',selected);
 }finally{await context.close();}
});

test('setup confirmation fits a short phone viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:640}});try{
  const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board [role=button]').first()).toBeVisible();await page.locator('#board [role=button]').first().press('Enter');
  await expect(page.locator('.hand-strip')).toHaveCount(0);expect(await fits(page,'[data-action=confirm]')).toEqual({visible:true,inside:true});expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context.close();}
});

test('help, score details and cards remain reachable in landscape',async({browser})=>{
 const {context,page}=await start(browser,{width:844,height:390});try{
  await page.getByRole('button',{name:'Help and rules',exact:true}).click();await page.getByLabel('Topic',{exact:true}).selectOption({label:'Knight'});expect(await fits(page,'#help-next')).toEqual({visible:true,inside:true});await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Score breakdown',exact:true}).click();await page.getByLabel('Player',{exact:true}).selectOption({index:1});expect(await fits(page,'.score-detail:not([hidden])')).toEqual({visible:true,inside:true});await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.getByRole('button',{name:/Cards ·/}).click();expect(await fits(page,'.card-button:not([hidden])')).toEqual({visible:true,inside:true});
 }finally{await context.close();}
});


test('discard pages retain quantities and keep confirmation visible after rotation',async({browser})=>{
 const {context,page,backend}=await start(browser,{width:844,height:390});try{
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;Object.assign(p.view.state.game,{phase:'discard',pendingDiscard:['p1'],discardAmounts:{p1:5}});p.view.choices=p.you==='p1'?[{type:'DISCARD_RESOURCES'}]:[];}
  await page.locator('#refresh').click();await page.getByRole('button',{name:'Choose cards to discard',exact:true}).click();await page.getByLabel('Brick to return',{exact:true}).fill('1');expect(await fits(page,'#discard-form button[type=submit]')).toEqual({visible:true,inside:true});
  await page.setViewportSize({width:390,height:664});await expect(page.getByLabel('Brick to return',{exact:true})).toHaveValue('1');expect(await fits(page,'#discard-form button[type=submit]')).toEqual({visible:true,inside:true});
 }finally{await context.close();}
});
