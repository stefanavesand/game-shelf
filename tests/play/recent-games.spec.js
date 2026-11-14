import {test,expect} from './account-fixture.js';
test('compact saved-game rows put the most recently played game first after reload',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route(/^https:\/\//,route=>route.abort());
 try{
  const page=await context.newPage();await page.goto('/game-shelf/play/#home');const ids=[];
  for(let i=0;i<2;i++)await test.step('Create Solo game '+(i+1),async()=>{
   await page.getByRole('button',{name:'New game',exact:true}).click();
   await page.getByLabel('Play mode').selectOption('solo');
   await page.getByRole('button',{name:'Start solo game',exact:true}).click();
   await expect(page.locator('#board')).toBeVisible();
   ids.push(await page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet.roomId;}));
   await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();
  });
  const rows=page.locator('.saved-game');
  await test.step('Check compact newest-first rows',async()=>{
   await expect(rows).toHaveCount(2);
   await expect(rows.first().locator(`[data-action="resume-game:${ids[1]}"]`)).toBeVisible();
   expect((await rows.first().boundingBox()).height).toBeLessThan(100);
  });
  await test.step('Resume older game and return to Home',async()=>{
   await page.locator(`[data-action="resume-game:${ids[0]}"]`).click();
   await expect(page.locator('#board')).toBeVisible();
   await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();
   await expect(rows.first().locator(`[data-action="resume-game:${ids[0]}"]`)).toBeVisible();
  });
  await test.step('Reload retains order and fits phone width',async()=>{
   await page.reload();
   await expect(rows.first().locator(`[data-action="resume-game:${ids[0]}"]`)).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
 }finally{await context.close().catch(()=>{});}
});
