import {test,expect} from '@playwright/test';
// Explicit opt-in only. Never capture tokens, invitations or private HTTP traces.
test.use({trace:'off',screenshot:'off',video:'off'});
test('LIVE relay: two new identities create, join, replicate and reopen a counter',async({browser})=>{
 test.skip(process.env.GAME_SHELF_RELAY_LIVE!=='1','Requires explicit live relay authorization.');
 test.setTimeout(90000);
 const options=process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}}:{};
 const a=await browser.newContext(options),b=await browser.newContext(options);
 try {
  const host=await a.newPage(),guest=await b.newPage();await host.goto('/game-shelf/play/relay/');await guest.goto('/game-shelf/play/relay/');
  await host.locator('#name').fill('Relay test A');await guest.locator('#name').fill('Relay test B');
  await host.getByRole('button',{name:'Connect',exact:true}).click();await expect(host.locator('#admission')).toBeVisible();await expect(host.locator('#create')).toBeEnabled();
  await guest.getByRole('button',{name:'Connect',exact:true}).click();await expect(guest.locator('#admission')).toBeVisible();await expect(guest.locator('#join')).toBeEnabled();
  await host.locator('#create').click();await expect(host.locator('#game')).toBeVisible();await expect(host.locator('#begin')).toBeEnabled();
  const invitation=await host.locator('#invite').inputValue();const token=new URLSearchParams(new URL(invitation).hash.slice(1)).get('invite');
  // Avoid assertions whose failure output could include the invitation capability.
  if(!token)throw Error('Creator did not receive a usable invitation.');
  await guest.locator('#token').fill(token);await guest.locator('#join').click();await expect(guest.locator('#game')).toBeVisible();await expect(guest.locator('#sync')).toBeEnabled();
  await host.locator('#sync').click();await expect(host.locator('#begin')).toBeEnabled();await host.locator('#begin').click();await expect(host.locator('#revision')).toHaveText('0');
  await guest.locator('#sync').click();await expect(guest.locator('#revision')).toHaveText('0');
  await host.locator('#add').click();await expect(host.locator('#value')).toHaveText('1');
  await guest.locator('#sync').click();await expect(guest.locator('#value')).toHaveText('1');
  await host.locator('#sync').click();await expect(host.locator('#verification')).toHaveText('Both players agree');
  const oldIdentity=await guest.locator('#identity').textContent();await guest.reload();await guest.getByRole('button',{name:'Connect',exact:true}).click();await expect(guest.locator('#value')).toHaveText('1');await expect(guest.locator('#identity')).toHaveText(oldIdentity);
  await expect(guest.locator('#error')).toHaveText('');
 } finally {await a.close();await b.close();}
});
