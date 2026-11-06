import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
// Explicitly authorized single-game smoke, never enabled by ordinary CI.
// No traces/screenshots: identities, invitations and game state are private.
test.use({trace:'off',screenshot:'off',video:'off',actionTimeout:30000,navigationTimeout:30000});
test('LIVE: two emulated humans and the normal PWA bot finish over the real relay',async({browser},testInfo)=>{
 test.skip(process.env.GAME_SHELF_FULL_RELAY_LIVE!=='1','Opt in with two preauthenticated Google browser storage-state files.');
 if(!process.env.GAME_SHELF_ACCOUNT_A_STATE||!process.env.GAME_SHELF_ACCOUNT_B_STATE)throw Error('Set GAME_SHELF_ACCOUNT_A_STATE and GAME_SHELF_ACCOUNT_B_STATE to private Playwright storage-state files for two distinct Google accounts. Never commit these files.');
 test.setTimeout(5400000);
 const contexts=await Promise.all([process.env.GAME_SHELF_ACCOUNT_A_STATE,process.env.GAME_SHELF_ACCOUNT_B_STATE].map(storageState=>browser.newContext({storageState})));
 let requests=0,forbidden=0,commands=0,staleRetries=0,reloaded=false,lastLog=Date.now();
 const counts={};
 try{
  for(const context of contexts){
   // Real, TLS-verified HTTPS via Node's environment-configured egress.
   // Pace every real request per principal, including reads/verifications.
   let chain=Promise.resolve(),last=0;
   await context.route(/^https:\/\//,route=>{
    const work=chain.then(async()=>{
     const req=route.request(),url=new URL(req.url());
     if(url.pathname==='/api/public/catan'||url.pathname.includes('/rest/v1/rpc/')){forbidden++;await route.abort();return;}
     if(!['stefan-game-shelf.lovable.app','ppaixjqaixwnebhxfjeb.supabase.co'].includes(url.hostname)){await route.abort();return;}
     const delay=Math.max(0,last+650-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
     requests++;let op='auth';try{op=req.postDataJSON()?.op||'auth';}catch{}counts[op]=(counts[op]||0)+1;
     try{
      const res=await fetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})});
      if(!res.ok)console.log('Live HTTP failure:',JSON.stringify({op,status:res.status}));
      // Stop on quota or service failure; preserve the original pending command.
      if(res.status===429)throw Error('Live service quota reached; stop this single-game run.');
      const headers=Object.fromEntries(res.headers);for(const key of ['content-encoding','content-length','transfer-encoding'])delete headers[key];
      await route.fulfill({status:res.status,headers,body:Buffer.from(await res.arrayBuffer())});
     }catch(error){await route.abort();throw error;}
    });chain=work.catch(()=>{});return work;
   });
  }
  const pages=await Promise.all(contexts.map(c=>c.newPage())),[host,guest]=pages;
  await host.goto('/game-shelf/play/#home');await expect(host.locator('#connection')).toHaveText('Up to date');
  await host.getByRole('button',{name:'New game',exact:true}).click();await host.getByRole('button',{name:'Create game',exact:true}).click();
  await expect(host.locator('#connection')).toHaveText('Up to date');console.log('Live stage: creator ready');
  await host.locator('#room').click();await host.getByRole('button',{name:'Invitation details',exact:true}).click();const invite=await host.getByLabel('Invitation link').inputValue();await host.getByRole('button',{name:'Close panel'}).click();
  console.log('Live stage: invite read');await guest.goto(invite);await guest.getByRole('button',{name:'Join game',exact:true}).click();await expect(guest.locator('#connection')).toHaveText('Up to date');
  console.log('Live stage: guest joined');
  // Home stops automatic foreground polling; the driver explicitly synchronizes
  // the unmodified production session, avoiding unrelated polling/quota traffic.
  for(const page of pages)await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();
  async function refresh(page){return page.evaluate(async()=>{const {client}=await import('./session.js');return client.refresh();});}
  let packets=[null,null];
  for(let step=0;step<1600;step++){
   // Reuse the submitting seat's returned projection. Synchronize the other
   // replica when it needs to act, rather than polling both after every click.
   let ended=false;
   for(let i=0;i<2;i++){
    if(packets[i]&&packets[1-i]&&packets[i].revision!==packets[1-i].revision)packets[i]=null;
    packets[i]??=await refresh(pages[i]);
    if(packets[i].status==='ended'){ended=true;break;}
    if(!packets[i].view?.choices.length)continue;
    const outcome=await pages[i].evaluate(async packet=>{
     const {client}=await import('./session.js'),{botDecision}=await import('./catan/rules/index.js');
     return client.execute('command',{roomId:packet.roomId,expectedRevision:packet.revision,action:botDecision(packet.view,'standard')});
    },packets[i]);
    if(!outcome.ok){
     const fresh=await refresh(pages[i]);
     if(fresh.revision!==packets[i].revision&&staleRetries<30){staleRetries++;packets=[null,null];packets[i]=fresh;break;}
     throw Error('Human command rejected: '+outcome.error?.code+'; '+outcome.error?.message);
    }
    commands++;packets=[null,null];packets[i]=outcome;break;
   }
   if(ended)break;
   // When neither human can act, refresh the creator to drain ordinary bots.
   if(packets.every(p=>p&&!p.view?.choices.length))packets=[null,null];
   if(commands>=25&&!reloaded){await guest.reload();await expect(guest.locator('#connection')).toHaveText('Up to date');reloaded=true;packets[1]=null;}
   if(Date.now()-lastLog>30000){console.log('Live progress:',JSON.stringify({commands,revision:packets.find(Boolean)?.revision,requests}));lastLog=Date.now();}
  }
  packets=[await refresh(host),await refresh(guest),await refresh(host)];
  expect(packets.every(p=>p.status==='ended')).toBe(true);expect(packets[0].revision===packets[1].revision&&packets[1].revision===packets[2].revision).toBe(true);
  const checkpoints=await Promise.all(pages.map((page,i)=>page.evaluate(async({principal,roomId})=>{
   const {createRelayStore}=await import('./relay/store.js'),r=await createRelayStore({name:'game-shelf-online-catan-v1'}).load(principal,roomId);
   return {hash:r.game.hash,halt:!!r.halt,pending:r.outbox.length};
  },{principal:packets[i].you,roomId:packets[i].roomId})));
  expect(checkpoints[0].hash===checkpoints[1].hash).toBe(true);expect(checkpoints.every(c=>!c.halt&&!c.pending)).toBe(true);
  expect(packets[0].members.filter(m=>m.kind==='human').length).toBe(2);expect(packets[0].members.filter(m=>m.kind==='bot').length).toBe(1);expect(reloaded).toBe(true);expect(forbidden).toBe(0);
  await host.reload();await expect(host.locator('#connection')).toHaveText('Up to date');expect((await refresh(host)).status==='ended').toBe(true);
  const summary={commands,staleRetries,revision:packets.find(Boolean)?.revision,requests,operations:counts,guestReloaded:reloaded,forbiddenCalls:forbidden,transport:'real HTTPS auth and relay via TLS-verifying Node egress',actions:'production session API, seat-restricted heuristic'};
  console.log('Live game complete:',JSON.stringify(summary));await testInfo.attach('live-game-summary',{body:JSON.stringify(summary),contentType:'application/json'});
 }finally{for(const context of contexts)await context.close();}
});
