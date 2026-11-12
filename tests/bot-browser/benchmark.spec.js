import {test,expect} from '@playwright/test';
const url='/game-shelf/diagnostics/bots/';
test('packaged worker validates browser parity and reports timing without a memory claim',async({page})=>{
 await page.goto(url);await page.getByLabel('Device notes').fill('Automated Chromium smoke; not a physical device');
 await page.getByRole('button',{name:'Run benchmark'}).click();
 await expect(page.getByRole('status')).toContainText('Complete.',{timeout:60000});
 const report=JSON.parse(await page.locator('#result').textContent());
 expect(report.parity).toBe(true);expect(report.memory.measured).toBe(false);expect(report.fixtureIds).toHaveLength(8);
 for(const p of ['baseline','candidate']){expect(report.policies[p].decisionMs.samples).toBe(24);expect(report.policies[p].roundTripMs.samples).toBe(24);expect(report.policies[p].decisionMs.max).toBeGreaterThanOrEqual(0);}
 expect(report.metadata.rulesDigest).toMatch(/^[a-f0-9]{64}$/);expect(report.metadata.policyHashes['trade-policy.mjs']).toMatch(/^[a-f0-9]{64}$/);
 await expect(page.getByRole('button',{name:'Download report'})).toBeEnabled();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download report'}).click();expect((await downloadPromise).suggestedFilename()).toBe('game-shelf-bot-benchmark.json');
 expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});
test('cancel terminates work and stale responses cannot complete the run',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Run benchmark'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Cancelled');await expect(page.getByRole('button',{name:'Run benchmark'})).toBeEnabled();await expect(page.getByRole('button',{name:'Download report'})).toBeDisabled();expect(await page.locator('#result').textContent()).toBe('');
});
test('a worker startup error leaves the tool retryable',async({page})=>{
 await page.route('**/diagnostics/bots/worker.js',route=>route.abort());await page.goto(url);await page.getByRole('button',{name:'Run benchmark'}).click();
 await expect(page.getByRole('status')).toContainText('Worker failed');await expect(page.getByRole('button',{name:'Run benchmark'})).toBeEnabled();await expect(page.getByRole('button',{name:'Download report'})).toBeDisabled();
});
