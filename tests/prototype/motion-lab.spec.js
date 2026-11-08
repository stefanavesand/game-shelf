import {test,expect} from '@playwright/test';
const root='/game-shelf/prototype/motion-lab/';
const diceDurations=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.effect.target.classList.contains('die')).map(a=>a.effect.getTiming().duration));
test('motion lab tunes the shared renderer immediately and shares settings without touching account data',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});let remote=0;await context.route(/^https:\/\//,r=>{remote++;return r.abort();});
 try{
  await context.addInitScript(()=>localStorage.setItem('spelhyllan-online-auth-v1','{"labSentinel":true}'));const page=await context.newPage();await page.goto(root+'?diceMs=2300&diceRotation=360');await expect.poll(()=>diceDurations(page)).toEqual([2300,2300]);
  await page.evaluate(()=>window.labVisit=1);await page.getByRole('button',{name:'Tune animations',exact:true}).click();await page.getByLabel('Dice duration',{exact:true}).evaluate(el=>{el.value='3100';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.getByRole('button',{name:'Apply & replay',exact:true}).click();await expect.poll(()=>diceDurations(page)).toEqual([3100,3100]);expect(await page.evaluate(()=>window.labVisit)).toBe(1);
  await page.getByRole('button',{name:'Tune animations',exact:true}).click();await page.getByRole('button',{name:'Share settings',exact:true}).click();const url=await page.locator('#shared-value').inputValue();expect(new URL(url).searchParams.get('diceMs')).toBe('3100');
  expect(await page.evaluate(()=>localStorage.getItem('spelhyllan-online-auth-v1'))).toBe('{"labSentinel":true}');expect(await page.evaluate(async()=>(await indexedDB.databases()).length)).toBe(0);expect(remote).toBe(0);
  await page.goto(url);await expect.poll(()=>diceDurations(page)).toEqual([3100,3100]);
 }finally{await context.close();}
});
test('motion lab explains reduced motion and allows a lab-only override',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  const page=await context.newPage();await page.goto(root+'?diceMs=2400');await expect(page.locator('.motion-caption')).toContainText('rolled');expect(await diceDurations(page)).toEqual([]);
  await page.getByRole('button',{name:'Tune animations',exact:true}).click();await expect(page.locator('#device-status')).toContainText('reduced motion: ON');await expect(page.locator('#device-status')).toContainText('suppressed');await page.getByLabel('Respect device reduced-motion setting',{exact:true}).uncheck();await page.getByRole('button',{name:'Apply & replay',exact:true}).click();await expect.poll(()=>diceDurations(page)).toEqual([2400,2400]);
 }finally{await context.close();}
});
