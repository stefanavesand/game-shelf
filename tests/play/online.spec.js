import {test,expect} from './account-fixture.js';
import {service,STATE,AUTH,roomId} from './mock-service.js';
const url='/game-shelf/play/';
const ready=page=>expect(page.locator('#connection')).toHaveText('Up to date');
async function state(page){return page.evaluate(async()=>{const {client}=await import('/game-shelf/play/session.js');return (await client.inspect()).state;});}
test('two browsers join separate seats and finish both setup rounds from authorized choices',async({browser})=>{
  const backend=service(),a=await browser.newContext(),b=await browser.newContext();
  try{
    await backend.attach(a,'alice');await backend.attach(b,'bob');const x=await a.newPage(),y=await b.newPage();await x.goto('http://127.0.0.1:4176'+url);await ready(x);
    await x.getByRole('button',{name:'New game',exact:true}).click();await x.getByRole('button',{name:'Create game',exact:true}).click();await expect(x.getByRole('heading',{name:'One seat for a friend.'})).toBeVisible();
    await x.getByRole('button',{name:'Share invitation',exact:true}).click();const invite=await x.getByLabel('Invitation link').inputValue();await x.getByRole('button',{name:'Close panel'}).click();await y.goto(invite);await ready(y);await expect(y.getByLabel('Room ID',{exact:true})).toHaveValue(roomId);await y.getByRole('button',{name:'Join game',exact:true}).click();await ready(y);
    for(let i=0;i<8;i++){
      const actor=backend.current.p1.view.state.game.currentPlayerId,page=actor==='p1'?x:y;
      await page.locator('#refresh').click();await ready(page);const before=backend.accepted;
      await page.locator('#board [role=button]').first().press('Enter');await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(before+1);await ready(page);
    }
    await x.locator('#refresh').click();await ready(x);await expect(x.getByRole('button',{name:'Roll dice',exact:true})).toBeVisible();expect(backend.accepted).toBe(8);
    await x.reload();await ready(x);await expect(x.locator('.players')).toContainText('Alice · You');
  }finally{await a.close();await b.close();}
});
test('legacy identity/room migrate to IndexedDB and a lost reply retries one original command',async({browser})=>{
  const backend=service({phase:'main',loseReply:true}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);expect(backend.authCalls).toBe(0);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByRole('heading',{name:'Let’s check your original move'})).toBeVisible();
    const original=(await state(page)).pending;expect(original.body.commandId).toBeTruthy();await page.evaluate(key=>localStorage.removeItem(key),STATE);expect((await state(page)).pending.body.commandId).toBe(original.body.commandId);await page.reload();await expect.poll(async()=>backend.commands.length,{timeout:12000}).toBeGreaterThanOrEqual(2);await ready(page);expect(backend.accepted).toBe(1);expect(backend.commands[1]).toEqual(backend.commands[0]);expect((await state(page)).pending).toBeNull();
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,AUTH)).toBe('alice');
  }finally{await context.close();}
});
test('unsupported reply keeps unresolved move and stops automatic retry',async({browser})=>{
  const backend=service({phase:'main',futureReply:true}),context=await browser.newContext();
  try{await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByRole('heading',{name:'A compatible app is needed'})).toBeVisible();expect((await state(page)).pending).not.toBeNull();expect(backend.commands).toHaveLength(1);await expect(page.getByRole('button',{name:'Resolve move',exact:true})).toBeDisabled();}finally{await context.close();}
});
test('missing saved identity never creates a replacement principal',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{await backend.attach(context,'alice',{legacy:true,identity:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await expect(page.getByRole('button',{name:'Sign in with Google',exact:true})).toBeVisible();expect(backend.authCalls).toBe(0);}finally{await context.close();}
});
test('IndexedDB refusal prevents creating an identity or sending a game mutation',async({browser})=>{
  const backend=service(),context=await browser.newContext();
  try{await backend.attach(context,'alice');await context.addInitScript(()=>{IDBFactory.prototype.open=()=>{throw new DOMException('Denied','SecurityError');};});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await expect(page.getByText('Your player data could not be saved or read. No new move was sent. Keep this installation and fix storage before continuing.')).toBeVisible();expect(backend.authCalls).toBe(0);expect(backend.commands).toHaveLength(0);await expect(page.getByRole('button',{name:'New game',exact:true})).toBeDisabled();}finally{await context.close();}
});
test('real-view layout reflows on compact phone and pauses offline',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext({viewport:{width:390,height:844}});
  try{await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.setOffline(true);await expect(page.getByRole('heading',{name:'You’re offline'})).toBeVisible();await expect(page.getByRole('button',{name:'Build',exact:true})).toBeDisabled();await context.setOffline(false);await ready(page);}finally{await context.close();}
});

test('a failed legacy mirror sends nothing and IndexedDB recovers the original pending intent',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await page.evaluate(key=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota','QuotaExceededError');return window.originalSet.call(this,k,v);};},STATE);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(page.getByText('Your player data could not be saved or read. No new move was sent. Keep this installation and fix storage before continuing.')).toBeVisible();expect(backend.commands).toHaveLength(0);
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});const pending=(await state(page)).pending;expect(pending.body.commandId).toBeTruthy();await page.locator('#refresh').click();await ready(page);expect(backend.commands[0].commandId).toBe(pending.body.commandId);expect(backend.accepted).toBe(1);
  }finally{await context.close();}
});

test('future saved schema is preserved and blocks identity creation',async({browser})=>{
  const backend=service(),context=await browser.newContext(),raw=JSON.stringify({schemaVersion:99,roomId,pending:null});
  try{
    await backend.attach(context,'alice');await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:STATE,raw});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await expect(page.getByRole('heading',{name:'A compatible app is needed'})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),STATE)).toBe(raw);expect(backend.authCalls).toBe(0);
  }finally{await context.close();}
});

test('a newly bought card stays unavailable even when an older card of the same type is legal',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    for(const seat of ['p1','p2']){const p=backend.current[seat].view.state.players.players.find(p=>p.id==='p1');p.devCardCount++;if(seat==='p1')p.developmentCards.push({id:'new-synthetic-knight',type:'knight',isPlayed:false,turnBought:backend.current[seat].view.state.game.turn});}
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await page.getByRole('button',{name:'Knight Next turn →',exact:true}).click();await expect(page.getByText('This card was bought this turn. It becomes playable on a later turn.')).toBeVisible();await expect(page.getByRole('button',{name:'Play Knight',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close panel'}).click();
    await page.getByRole('button',{name:'Knight →',exact:true}).click();await expect(page.getByRole('button',{name:'Play Knight',exact:true})).toBeEnabled();expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});

// These tests verify UI/outbox integration with synthetic authorized views.
// Actual two-bot scheduling and seat security are covered by the live test.
test('solo starts immediately with two bots, retains level and room after reload on a phone',async({browser})=>{
  const backend=service(),context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    await backend.attach(context,'alice');const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await expect(page.getByLabel('Play mode',{exact:true})).toHaveValue('solo');await page.getByLabel('Bot level',{exact:true}).selectOption('easy');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await ready(page);
    expect(backend.creates[0]).toMatchObject({mode:'solo',name:'Alice',botLevel:'easy'});expect(backend.current.p1.view.seats.filter(s=>s.kind==='bot')).toHaveLength(2);await expect(page.locator('.players .bot-tag')).toHaveCount(2);await expect(page.getByRole('heading',{name:'One seat for a friend.'})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.reload();await ready(page);await expect(page.locator('.players .bot-tag')).toHaveCount(2);expect((await state(page)).roomId).toBe(roomId);expect(backend.creates).toHaveLength(1);
    await page.locator('#room').click();await expect(page.getByRole('button',{name:'Invitation details',exact:true})).toHaveCount(0);await expect(page.getByText('Solo · you and 2 bots. No invitation is needed.')).toBeVisible();
  }finally{await context.close();}
});
test('a lost solo creation reply retries the same mode and UUID rather than creating a friends lobby',async({browser})=>{
  const backend=service({loseCreateReply:true}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice');const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await expect(page.getByText('Play offline against bots. Saved on this device.')).toBeVisible();await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.getByRole('heading',{name:'Let’s check your original move'})).toBeVisible();
    const pending=(await state(page)).pending;expect(pending.body.mode).toBe('solo');await page.reload();await expect.poll(()=>backend.creates.length,{timeout:15000}).toBeGreaterThanOrEqual(2);await ready(page);expect(backend.creates[1]).toEqual(backend.creates[0]);expect((await state(page)).pending).toBeNull();await expect(page.locator('.players .bot-tag')).toHaveCount(2);
  }finally{await context.close();}
});

test('unchanged automatic polls preserve board nodes, preview, focus and expanded history',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.clock.install();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');
    await page.locator('.public-log summary').click();await page.getByRole('button',{name:'Confirm',exact:true}).focus();
    await page.evaluate(()=>{window.oldBoard=document.querySelector('#board');window.oldTile=oldBoard.firstChild;window.oldFocus=document.activeElement;window.changes=0;window.watch=new MutationObserver(records=>window.changes+=records.length);watch.observe(document.querySelector('#app'),{subtree:true,childList:true,attributes:true,characterData:true});});
    let reads=0;await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().op==='view')reads++;await route.fallback();});
    for(let i=0;i<3;i++){await page.clock.runFor(5000);await expect.poll(()=>reads).toBe(i+1);await ready(page);}
    expect(await page.evaluate(()=>({board:oldBoard===document.querySelector('#board'),tile:oldTile===oldBoard.firstChild,focus:oldFocus===document.activeElement,history:document.querySelector('.public-log').open,changes}))).toEqual({board:true,tile:true,focus:true,history:true,changes:0});
    await expect(page.locator('#board [role=button]').first()).toHaveAttribute('aria-pressed','true');expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});
test('a command clicked during a slow poll is sent once after the read, with a real board update',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();let release;
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');const before=backend.current.p1.view.state.board.roads.length;
    let held=false;const gate=new Promise(resolve=>release=resolve);await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(!held&&route.request().method()==='POST'&&route.request().postDataJSON().op==='view'){held=true;await gate;}await route.fallback();});
    await page.locator('#refresh').click();await expect.poll(()=>held).toBe(true);await ready(page);await expect(page.getByRole('button',{name:'Confirm',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Confirm',exact:true}).click();expect(backend.commands).toHaveLength(0);release();
    await expect.poll(()=>backend.accepted).toBe(1);await ready(page);expect(backend.commands).toHaveLength(1);expect(backend.current.p1.view.state.board.roads).toHaveLength(before+1);await expect(page.getByRole('button',{name:'Build',exact:true})).toBeVisible();
  }finally{release?.();await context.close();}
});
test('a failed background poll shows recovery and disables game actions',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().op==='view'){await route.abort('failed');return;}await route.fallback();});await page.locator('#refresh').click();
    await expect(page.getByText('The connection was interrupted. Reconnect to check your original move.')).toBeVisible();await expect(page.getByRole('button',{name:'Build',exact:true})).toBeDisabled();expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});
test('a new board revision is painted even when the surrounding panel markup is unchanged',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);await page.evaluate(()=>{window.oldBoard=document.querySelector('#board');window.oldTile=oldBoard.firstChild;});const lines=await page.locator('#board > line').count();
    // Synthetic wire update isolates the renderer's board invalidation from panel text.
    for(const seat of ['p1','p2']){const p=backend.current[seat];p.revision++;p.view.revision=p.revision;p.view.state.board.roads.push({id:'remote-road',type:'road',playerId:'p2',edge:backend.current.p1.view.choices.find(c=>c.type==='BUILD_ROAD').edge});}
    await page.locator('#refresh').click();await expect(page.locator('#board > line')).toHaveCount(lines+2);expect(await page.evaluate(()=>oldBoard===document.querySelector('#board')&&oldTile!==oldBoard.firstChild)).toBe(true);expect(backend.commands).toHaveLength(0);
  }finally{await context.close();}
});
test('a queued placement keeps its original revision and is rejected safely if a poll reveals a newer turn',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();let release;
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.locator('#board [role=button]').first().press('Enter');const revision=backend.current.p1.revision,edge=structuredClone(backend.current.p1.view.choices.find(c=>c.type==='BUILD_ROAD').edge);
    let held=false;const gate=new Promise(resolve=>release=resolve);await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(!held&&route.request().method()==='POST'&&route.request().postDataJSON().op==='view'){held=true;await gate;}await route.fallback();});await page.locator('#refresh').click();await expect.poll(()=>held).toBe(true);await page.getByRole('button',{name:'Confirm',exact:true}).click();
    for(const seat of ['p1','p2']){const p=backend.current[seat];p.revision++;p.view.revision=p.revision;p.view.state.game.phase='roll';p.view.choices=seat==='p1'?[{type:'ROLL_DICE'}]:[];}release();
    await expect(page.getByRole('button',{name:'Roll dice',exact:true})).toBeVisible();await ready(page);expect(backend.accepted).toBe(0);expect(backend.commands).toHaveLength(1);expect(backend.commands[0]).toMatchObject({expectedRevision:revision,action:{type:'BUILD_ROAD',edge}});expect((await state(page)).pending).toBeNull();
  }finally{release?.();await context.close();}
});

test('home has one new-game flow, explicit configuration and no decorative board or design branding',async({browser})=>{
  const backend=service(),context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    await backend.attach(context,'alice');const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url+'#home');await ready(page);await expect(page.getByRole('heading',{name:'Catan',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'New game',exact:true})).toHaveCount(1);await expect(page.locator('svg')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toMatch(/\btable\b|calm table/i);
    await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Bot level',{exact:true}).selectOption('easy');await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await expect(page.getByLabel('Your name',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Bot level',{exact:true})).toHaveValue('easy');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(2);expect(backend.creates[0]).toMatchObject({mode:'solo',botLevel:'easy'});
    await expect(page.getByRole('button',{name:/^Location \d+$/})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await context.close();}
});

test('saved games are principal-bound and an earlier game resumes without joining or overwriting the other save',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext(),older='1b70d78a-0aba-4ccf-b640-ecdc63095dea',foreign='2b70d78a-0aba-4ccf-b640-ecdc63095dea';
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    const old=structuredClone(backend.current.p1);old.roomId=older;old.view.id=older;await page.evaluate(async({old,foreign})=>{const{createStore}=await import('/game-shelf/play/core/store.js'),store=createStore();await store.cache(old,'alice');await store.cache({...old,roomId:foreign,view:{...old.view,id:foreign}},'another-player');},{old,foreign});
    let joins=0;await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.op==='join')joins++;if(body.op==='view'&&body.roomId===older){await route.fulfill({headers:{'access-control-allow-origin':'*'},json:old});return;}}await route.fallback();});
    await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();await expect(page.locator('.saved-game')).toHaveCount(2);await page.locator(`[data-action="resume-game:${older}"]`).click();await expect(page.locator('.players')).toBeVisible();expect((await state(page)).roomId).toBe(older);expect(joins).toBe(0);
    await page.goto('http://127.0.0.1:4176'+url+'#home');await ready(page);await expect(page.locator('.saved-game')).toHaveCount(2);await expect(page.locator(`[data-action="resume-game:${roomId}"]`)).toBeVisible();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,AUTH)).toBe('alice');
    await context.route('https://stefan-game-shelf.lovable.app/api/public/catan',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().roomId===roomId){await route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},json:{ok:false,apiVersion:1,error:{code:'room_not_found',message:'This saved game is unavailable.'}}});return;}await route.fallback();});
    await page.locator(`[data-action="resume-game:${roomId}"]`).click();await expect(page.getByText('This saved game is unavailable.')).toBeVisible();await expect(page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();expect((await state(page)).roomId).toBe(older);
  }finally{await context.close();}
});

for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}])test(`board taps and number-token alignment at ${viewport.width}×${viewport.height}`,async({browser},testInfo)=>{
  const backend=service({phase:'main'}),context=await browser.newContext({viewport,hasTouch:true});
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);
    const offsets=await page.locator('#board').evaluate(svg=>[...svg.querySelectorAll('g[aria-hidden="true"]')].flatMap(g=>{const circle=g.querySelector(':scope > circle'),text=g.querySelector(':scope > text');if(!circle||!text)return [];const b=text.getBBox(),cy=Number(circle.getAttribute('cy'));return [Math.abs(b.y+b.height/2-cy)];}));expect(offsets).toHaveLength(18);expect(Math.max(...offsets)).toBeLessThan(3);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();const targetSize=await page.locator('#board [role=button]').first().boundingBox();expect(targetSize.width).toBeGreaterThanOrEqual(43.9);expect(targetSize.height).toBeGreaterThanOrEqual(43.9);await page.locator('#board [role=button]').first().tap();await expect(page.getByRole('button',{name:'Confirm',exact:true})).toBeEnabled();await expect(page.locator('#board [aria-pressed="true"]')).toHaveCount(1);await expect(page.getByRole('button',{name:/^Location \d+$/})).toHaveCount(0);expect(backend.commands).toHaveLength(0);await page.screenshot({path:testInfo.outputPath(`board-${viewport.width}.png`),fullPage:true});
    await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath(`home-${viewport.width}.png`),fullPage:true});
  }finally{await context.close();}
});

test('legacy-only home can resume without guessing players or bot level',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url+'#home');await ready(page);await expect(page.getByText('Open to check players and bot level')).toBeVisible();await expect(page.locator('.saved-game')).not.toContainText('Standard');expect(backend.authCalls).toBe(0);await page.getByRole('button',{name:'Resume game',exact:true}).click();await expect(page.locator('.players')).toBeVisible();expect((await state(page)).roomId).toBe(roomId);await page.getByRole('link',{name:'Game Shelf home',exact:true}).click();await expect(page.locator('.saved-game')).toContainText('Standard');
  }finally{await context.close();}
});
