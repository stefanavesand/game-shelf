import {test,expect as baseExpect} from '@playwright/test';
import {configureLiveEgress} from './live-network.js';
const expect=baseExpect.configure({timeout:20000});
test.use({trace:'off',screenshot:'off',video:'off'});
test('LIVE Catan relay: independent PWAs initialize, place and verify a real move',async({browser})=>{
 test.skip(process.env.GAME_SHELF_CATAN_RELAY_LIVE!=='1','Requires explicit live Catan relay authorization.');test.setTimeout(180000);
 if(!process.env.GAME_SHELF_ACCOUNT_A_STATE||!process.env.GAME_SHELF_ACCOUNT_B_STATE)throw Error('Provide two private, preauthenticated Google storage-state files.');
 const a=await browser.newContext({storageState:process.env.GAME_SHELF_ACCOUNT_A_STATE}),b=await browser.newContext({storageState:process.env.GAME_SHELF_ACCOUNT_B_STATE});await configureLiveEgress([a,b]);
 try{
  const host=await a.newPage(),guest=await b.newPage();for(const [page,name]of [[host,'Catan engine test A'],[guest,'Catan engine test B']]){await page.goto('/game-shelf/play/catan/');await page.locator('#name').fill(name);await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.locator('#create')).toBeEnabled();}
  await host.locator('#create').click();await expect(host.locator('#game')).toBeVisible();await expect(host.locator('#sync')).toBeEnabled();
  const invitation=await host.locator('#invite').inputValue(),token=new URLSearchParams(new URL(invitation).hash.slice(1)).get('invite');if(!token)throw Error('Missing invitation.');
  await guest.locator('#token').fill(token);await guest.locator('#join').click();await expect(guest.locator('#sync')).toBeEnabled();await host.locator('#sync').click();await expect(host.locator('#begin')).toBeEnabled();
  await host.locator('#begin').click();await expect(host.locator('#revision')).not.toHaveText('—');await expect(host.locator('#sync')).toBeEnabled();
  await guest.locator('#sync').click();await expect(guest.locator('#sync')).toBeEnabled();await expect(guest.locator('#revision')).not.toHaveText('—');
  await expect(host.locator('#hash')).toHaveText(await guest.locator('#hash').textContent());
  const countA=await host.locator('#board [role="button"]').count(),acting=countA?host:guest;
  await expect(acting.locator('#board [role="button"]').first()).toBeVisible();const before=Number(await acting.locator('#revision').textContent());await acting.locator('#board [role="button"]').first().click();await expect(acting.locator('#confirm')).toBeEnabled();await acting.locator('#confirm').click();await expect.poll(async()=>Number(await acting.locator('#revision').textContent())).toBeGreaterThan(before);await expect(acting.locator('#sync')).toBeEnabled();
  for(const page of [host,guest,host]){await page.locator('#sync').click();await expect(page.locator('#sync')).toBeEnabled();}
  await expect(host.locator('#hash')).toHaveText(await guest.locator('#hash').textContent());await expect(host.locator('#verification')).toHaveText('Both players agree');await expect(host.locator('#error')).toHaveText('');await expect(guest.locator('#error')).toHaveText('');
 }finally{await a.close();await b.close();}
});
