import {test,expect} from '@playwright/test';
const base='/game-shelf/prototype/';
const data=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('game-shelf-ui-prototype-v1')));
async function scene(page,label){await page.getByRole('button',{name:'Explore scenarios'}).click();await page.getByRole('button',{name:label,exact:false}).click();}
async function settled(page){await expect.poll(async()=>!!(await data(page)).pending).toBe(false);}
async function location(page){await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await settled(page);}

test('create, invitation lobby and both human setup rounds are clickable',async({page})=>{
  await page.goto(base);await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('Your name', {exact:true}).fill('Sam');await page.getByLabel('Bot level').selectOption('easy');await page.getByRole('button',{name:'Create room',exact:true}).click();
  await expect(page.getByRole('heading',{name:'One seat for a friend.'})).toBeVisible();await expect(page.locator('.bot-tag')).toHaveText('Easy');
  await page.getByRole('button',{name:'Share invitation',exact:true}).click();await expect(page.getByLabel('Invitation link')).toHaveValue(/#join$/);await page.getByRole('button',{name:'Close panel'}).click();
  await page.getByRole('button',{name:'Preview Alex joining',exact:true}).click();await page.getByRole('button',{name:'Place your first settlement'}).click();
  await expect(page.getByRole('heading',{name:'Your first settlement'})).toBeVisible();await location(page);await expect(page.getByRole('heading',{name:'A road to start from'})).toBeVisible();await location(page);
  await expect(page.getByRole('heading',{name:'Your second settlement'})).toBeVisible();await location(page);await location(page);await expect(page.getByRole('button',{name:'Roll dice'})).toBeVisible();
  const state=await data(page);expect(state.pieces.filter(p=>p.owner==='you')).toHaveLength(2);expect(state.roads.filter(p=>p.owner==='you')).toHaveLength(2);expect(state.hand).toEqual({brick:1,wood:1,grain:1,wool:0,ore:0});
});

test('unresolved placement survives reload, blocks switching, and resolves once',async({page})=>{
  await page.goto(base+'?scenario=main');await page.getByRole('button',{name:'Explore scenarios'}).click();await page.getByRole('button',{name:'Lose the next response',exact:true}).click();
  await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Settlement/}).click();await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Waiting to resolve your move'})).toBeVisible();const pending=(await data(page)).pending;expect((await data(page)).pieces).toHaveLength(0);
  await page.getByRole('link',{name:'Game Shelf home'}).click();await expect(page.getByRole('heading',{name:'Resolve your move first'})).toBeVisible();await page.getByRole('button',{name:'Stay here',exact:true}).click();
  await page.reload();expect((await data(page)).pending.id).toBe(pending.id);await page.getByRole('button',{name:'Resolve move',exact:true}).click();await settled(page);await expect(page.getByRole('heading',{name:'Your turn',exact:true})).toBeVisible();
  expect((await data(page)).lastReceipt).toBe(pending.id);expect((await data(page)).pieces).toHaveLength(1);await page.reload();expect((await data(page)).pieces).toHaveLength(1);
});

test('player trade review, acceptance and stale-offer example preserve explicit terms',async({page})=>{
  await page.goto(base+'?scenario=main');await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('button',{name:'Review offer',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your offer'})).toBeVisible();
  await page.getByRole('button',{name:'Send offer',exact:true}).click();await expect(page.getByRole('heading',{name:'Your offer is waiting'})).toBeVisible();
  await page.getByRole('button',{name:'Preview acceptance',exact:true}).click();await settled(page);expect((await data(page)).hand.brick).toBe(2);expect((await data(page)).hand.ore).toBe(1);
  await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('button',{name:'Review offer',exact:true}).click();await page.getByRole('button',{name:'Send offer',exact:true}).click();await page.getByRole('button',{name:'Preview withdrawal',exact:true}).click();await settled(page);
  expect((await data(page)).hand.brick).toBe(2);expect((await data(page)).offer).toBeNull();await expect(page.locator('.history-row').getByText('That offer was withdrawn. No resources were exchanged.')).toBeVisible();
});

test('off-turn discard enforces the quantity and leads to robber and victim decisions',async({page})=>{
  await page.goto(base+'?scenario=discard');await page.getByRole('button',{name:'Choose cards to discard'}).click();await page.getByRole('button',{name:'Confirm discard'}).click();await expect(page.getByRole('alert')).toHaveText('Select exactly five cards from your hand.');
  await page.locator('#discard-brick').fill('4');await page.locator('#discard-wood').fill('1');await expect(page.getByText('5 of 5 selected')).toBeVisible();await page.getByRole('button',{name:'Confirm discard'}).click();await settled(page);
  await expect(page.getByRole('heading',{name:'Move the robber'})).toBeVisible();await page.getByRole('button',{name:'Tile 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await settled(page);
  await page.getByRole('button',{name:'Choose a player',exact:true}).click();await page.getByRole('button',{name:'Alex 4 resource cards'}).click();await settled(page);await expect(page.getByRole('heading',{name:'Your turn',exact:true})).toBeVisible();expect((await data(page)).hand.ore).toBe(1);
});

test('development card decisions include free roads and resource choices',async({page})=>{
  await page.goto(base+'?scenario=roads');await page.getByRole('button',{name:/Road Building 1/}).click();await page.getByRole('button',{name:'Play Road Building',exact:true}).click();await settled(page);const before=(await data(page)).hand;
  await location(page);await expect(page.getByRole('heading',{name:'1 free road remaining'})).toBeVisible();await location(page);expect((await data(page)).hand).toEqual(before);await expect(page.getByRole('heading',{name:'Your turn',exact:true})).toBeVisible();
  await scene(page,'Year of Plenty');await page.getByRole('button',{name:/Year of Plenty 1/}).click();await page.getByLabel('Resource 1', {exact:true}).selectOption('ore');await page.getByLabel('Resource 2', {exact:true}).selectOption('grain');await page.getByRole('button',{name:'Confirm resources'}).click();await settled(page);expect((await data(page)).hand.ore).toBe(1);expect((await data(page)).hand.grain).toBe(2);
});

test('recovery, permanent failure, victory and resume are distinct review states',async({page})=>{
  await page.goto(base+'?scenario=offline');await expect(page.getByRole('button',{name:'Build',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Reconnect',exact:true}).click();await expect(page.getByRole('button',{name:'Build',exact:true})).toBeEnabled();
  await scene(page,'Missing identity');await expect(page.getByRole('heading',{name:'Your saved identity is missing'})).toBeVisible();await expect(page.getByRole('button',{name:'Build',exact:true})).toBeDisabled();
  await scene(page,'Rate cooldown');await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeEnabled({timeout:6000});
  await scene(page,'Victory');await expect(page.getByRole('heading',{name:'You win.'})).toBeVisible();await page.getByRole('button',{name:'View the board'}).click();await page.getByRole('link',{name:'Game Shelf home'}).click();await page.getByRole('button',{name:'Resume your table'}).click();await expect(page.getByRole('button',{name:'See the results'})).toBeVisible();
});

test('buying a card preserves the existing card and explains the new-card restriction',async({page})=>{
  await page.goto(base+'?scenario=city');await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Development card/}).click();await settled(page);
  const state=await data(page);expect(state.cards.filter(c=>!c.used)).toHaveLength(2);
  await page.getByRole('button',{name:/Knight 1 · next turn/}).click();await expect(page.getByRole('heading',{name:'Ready for your next turn'})).toBeVisible();await page.getByRole('button',{name:'Close panel'}).click();
  await page.getByRole('button',{name:'Knight 1 →',exact:true}).click();await expect(page.getByRole('button',{name:'Play Knight',exact:true})).toBeVisible();
});

test('editing a reviewed offer retains the chosen bundles without transferring resources',async({page})=>{
  await page.goto(base+'?scenario=main');await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('spinbutton',{name:'Give Brick',exact:true}).fill('2');await page.getByRole('button',{name:'Review offer',exact:true}).click();await page.getByRole('button',{name:'Edit offer',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Give Brick',exact:true})).toHaveValue('2');expect((await data(page)).hand.brick).toBe(3);
});

for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800}])test(`board and trade sheet reflow at ${viewport.width}×${viewport.height}`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);const external=[];page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:4176'))external.push(req.url());});await page.goto(base+'?scenario=main');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const board=await page.locator('.board-wrap').boundingBox(),panel=await page.locator('.action-panel').boundingBox();if(viewport.width<=900)expect(panel.y).toBeGreaterThanOrEqual(board.y+board.height);else expect(panel.x).toBeGreaterThanOrEqual(board.x+board.width);await expect(page.getByRole('heading',{name:'Your turn',exact:true})).toBeVisible();
  for(const label of ['Build','Trade','End turn']){const size=await page.getByRole('button',{name:label,exact:true}).boundingBox();expect(size.height).toBeGreaterThanOrEqual(44);}
  await page.getByRole('button',{name:'Knight 1 →',exact:true}).click();await expect(page.getByRole('button',{name:'Play Knight',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close panel'}).click();
  await page.screenshot({path:testInfo.outputPath(`calm-table-${viewport.width}.png`),fullPage:true});await page.getByRole('button',{name:'Trade',exact:true}).click();const dialog=await page.getByRole('dialog').boundingBox();expect(dialog.x).toBeGreaterThanOrEqual(0);expect(dialog.width).toBeLessThanOrEqual(viewport.width);expect(external).toEqual([]);
});
