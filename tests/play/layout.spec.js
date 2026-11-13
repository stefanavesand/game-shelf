import {test,expect} from './account-fixture.js';
import {service} from './mock-service.js';
async function start(browser,viewport){const context=await browser.newContext({viewport}),backend=service({phase:'main'});await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('/game-shelf/play/#game');await expect(page.getByRole('button',{name:'Build',exact:true})).toBeVisible();return {context,page,backend};}
async function fits(page,selector){return page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {visible:r.width>0&&r.height>0,inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};});}
for(const [width,height] of [[390,664],[360,640],[844,390],[1024,768],[768,1024],[1366,1024]])test(`fixed game and sidebar fit ${width}×${height}`,async({browser})=>{
 const {context,page}=await start(browser,{width,height});try{
  for(const s of ['.players','#board','.action-panel','.action-buttons'])expect(await fits(page,s),s).toEqual({visible:true,inside:true});
  expect(await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}))).toEqual({height,width});
  await expect(page.locator('.board-tools')).toHaveCount(0);const square=await page.locator('.board-wrap').boundingBox();if(width>=600)expect(Math.abs(square.width-square.height)).toBeLessThan(1);else {const ratio=await page.locator('#board').evaluate(svg=>svg.viewBox.baseVal.width/svg.viewBox.baseVal.height);expect(Math.abs(square.width/square.height-ratio)).toBeLessThan(.01);}
  const framing=await page.locator('#board').evaluate(svg=>{
   const box=svg.getBoundingClientRect(),bounds=[...svg.querySelectorAll('[data-motion-tile],[data-port]')].map(el=>el.getBoundingClientRect());
   const left=Math.min(...bounds.map(b=>b.left)),right=Math.max(...bounds.map(b=>b.right)),top=Math.min(...bounds.map(b=>b.top)),bottom=Math.max(...bounds.map(b=>b.bottom));
   return {inside:left>=box.left-1&&right<=box.right+1&&top>=box.top-1&&bottom<=box.bottom+1,fill:Math.max((right-left)/box.width,(bottom-top)/box.height)};
  });expect(framing.inside).toBe(true);expect(framing.fill).toBeGreaterThan(.9);
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
  const selected=await page.locator('#board [aria-pressed=true]').getAttribute('aria-label');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.setViewportSize({width:1024,height:768});await page.evaluate(()=>{window.menuHome=document.querySelector('#sidebar [data-action=home]');window.dispatchEvent(new Event('online'));});await expect(page.locator('#sidebar')).toBeVisible();expect(await page.evaluate(()=>window.menuHome===document.querySelector('#sidebar [data-action=home]'))).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeFocused();await expect(page.locator('#board [aria-pressed=true]')).toHaveAttribute('aria-label',selected);
 }finally{await context.close();}
});

test('setup confirmation fits a short phone viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:640}});try{
  const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board [role=button]').first()).toBeVisible({timeout:15000});await page.locator('#board [role=button]').first().press('Enter');
  await expect(page.locator('.hand-strip')).toHaveCount(1);expect(await fits(page,'[data-action=confirm]')).toEqual({visible:true,inside:true});expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }finally{await context.close();}
});

test('help, score details and cards remain reachable in landscape',async({browser})=>{
 const {context,page}=await start(browser,{width:844,height:390});try{
  await page.getByRole('button',{name:'Help and rules',exact:true}).click();await page.getByLabel('Topic',{exact:true}).selectOption({label:'Knight'});expect(await fits(page,'#help-next')).toEqual({visible:true,inside:true});await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.locator('.player[data-action]').first().click();await page.getByLabel('Player',{exact:true}).selectOption({index:1});expect(await fits(page,'.score-detail:not([hidden])')).toEqual({visible:true,inside:true});await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.getByRole('button',{name:/Cards ·/}).click();expect(await fits(page,'.card-button:not([hidden])')).toEqual({visible:true,inside:true});
 }finally{await context.close();}
});


test('discard pages retain quantities and keep confirmation visible after rotation',async({browser})=>{
 const {context,page,backend}=await start(browser,{width:844,height:390});try{
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;Object.assign(p.view.state.game,{phase:'discard',pendingDiscard:['p1'],discardAmounts:{p1:5}});p.view.choices=p.you==='p1'?[{type:'DISCARD_RESOURCES'}]:[];}
  await page.locator('#refresh').evaluate(button=>button.click());await page.getByRole('button',{name:'Choose cards to discard',exact:true}).click();await page.getByRole('button',{name:'Add Brick to return',exact:true}).click();expect(await fits(page,'#discard-form button[type=submit]')).toEqual({visible:true,inside:true});
  await page.setViewportSize({width:390,height:664});await expect(page.getByLabel('Brick to return',{exact:true})).toHaveText('1');expect(await fits(page,'#discard-form button[type=submit]')).toEqual({visible:true,inside:true});
 }finally{await context.close();}
});

test('an open sidebar updates when a pending new game finishes creating',async({browser})=>{
 const context=await browser.newContext(),backend=service();let release;
 const gate=new Promise(resolve=>{release=resolve;});let entered=false;
 try{
  await backend.attach(context,'alice');await context.route('**/api/public/catan',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().op==='create'){entered=true;await gate;}await route.fallback();});
  const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Create game',exact:true}).click();await expect.poll(()=>entered).toBe(true);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.locator('#sidebar')).toBeVisible();await expect(page.getByRole('button',{name:'Invitation details',exact:true})).toHaveCount(0);
  release();await expect(page.getByRole('button',{name:'Invitation details',exact:true})).toBeVisible();await page.getByRole('button',{name:'Invitation details',exact:true}).click();await expect(page.getByLabel('Invitation link',{exact:true})).toBeVisible();await expect(page.locator('#sidebar')).not.toBeVisible();
 }finally{release();await context.close();}
});


test('discard steppers enforce holdings and the required total without a keyboard',async({browser})=>{
 const {context,page,backend}=await start(browser,{width:390,height:664});try{
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;Object.assign(p.view.state.game,{phase:'discard',pendingDiscard:['p1'],discardAmounts:{p1:5}});p.view.choices=p.you==='p1'?[{type:'DISCARD_RESOURCES'}]:[];}
  await page.locator('#refresh').evaluate(button=>button.click());await page.getByRole('button',{name:'Choose cards to discard',exact:true}).click();await expect(page.locator('#discard-form input:not([type=hidden])')).toHaveCount(0);await expect(page.getByRole('button',{name:'Confirm discard',exact:true})).toBeDisabled();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Add Brick to return',exact:true}).click();await expect(page.getByRole('button',{name:'Add Brick to return',exact:true})).toBeDisabled();
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'Add Wood to return',exact:true}).click();await expect(page.getByRole('button',{name:'Add Grain to return',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Confirm discard',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Remove Brick from return',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm discard',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Add Grain to return',exact:true}).click();await expect(page.locator('#discard-total')).toHaveText('5 / 5 selected');
  await page.getByRole('button',{name:'Confirm discard',exact:true}).click();await expect.poll(()=>backend.commands.length).toBe(1);expect(backend.commands[0].action).toEqual({type:'DISCARD_RESOURCES',resources:{brick:2,lumber:2,grain:1,wool:0,ore:0}});
 }finally{await context.close();}
});

test('readable sidebar status and all navigation fit a compact phone',async({browser})=>{
 const {context,page}=await start(browser,{width:360,height:568});try{
  await page.getByRole('button',{name:'Open menu',exact:true}).click();expect(await fits(page,'#app-version')).toEqual({visible:true,inside:true});
  const clear=await page.locator('#sidebar-body').evaluate(body=>body.scrollHeight<=body.clientHeight+1);expect(clear).toBe(true);await expect(page.locator('#sidebar #offline-status')).toHaveAttribute('role','status');
 }finally{await context.close();}
});

test('game phases keep the square board, event strip, hand and controls in fixed positions',async({browser})=>{
 const {context,page,backend}=await start(browser,{width:390,height:844});
 try{
  const geometry=()=>page.evaluate(()=>Object.fromEntries(['.players','.board-wrap','.activity-panel','.hand-panel','.control-slot'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,[r.x,r.y,r.width,r.height]];})));
  const before=await geometry(),tradePosition=await page.getByRole('button',{name:'Trade',exact:true}).boundingBox();
  for(const phase of ['roll','setup-settlement-1','main']){
   for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.view.state.game.phase=phase;if(phase==='roll')p.view.choices=[{type:'ROLL_DICE'}];else p.view.choices=[{type:'BUILD_ROAD',edge:{hex:{q:0,r:0},direction:'E'}}];}
   await page.locator('#refresh').evaluate(b=>b.click());if(phase==='roll')await expect(page.getByRole('button',{name:'Roll dice',exact:true})).toBeVisible();else if(phase==='setup-settlement-1')await expect(page.getByRole('heading',{name:'Your first settlement',exact:true})).toBeVisible();else await expect(page.getByRole('button',{name:'Build',exact:true})).toBeEnabled();await expect.poll(geometry).toEqual(before);
  }
  for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.view.state.game.currentPlayerId='p2';}
  await page.locator('#refresh').evaluate(b=>b.click());await expect(page.getByRole('heading',{name:'Bob’s turn',exact:true})).toBeVisible();expect(await geometry()).toEqual(before);expect(await page.getByRole('button',{name:'Trade',exact:true}).boundingBox()).toEqual(tradePosition);
  const images=await page.locator('#board image').evaluateAll(els=>els.map(el=>el.getAttribute('href')));expect(images.filter(src=>src.startsWith('./art/terrain-'))).toHaveLength(19);expect(images.filter(src=>src.startsWith('./art/terrain-')).every(src=>src.startsWith('./art/terrain-'))).toBe(true);
 }finally{await context.close();}
});

test('the iOS edge-sampling header stays sticky, full-width and opaque on Home and in a game',async({browser})=>{
 const {context,page}=await start(browser,{width:390,height:844});
 try{
  const sample=()=>page.locator('.app-header').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {position:s.position,top:s.top,background:s.backgroundColor,opacity:s.opacity,filter:s.filter,backdrop:s.backdropFilter,width:r.width,height:r.height,y:r.y};});
  for(const screen of ['game','home']){
   if(screen==='home'){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await page.locator('#app').evaluate(el=>{const spacer=document.createElement('div');spacer.style.height='1400px';el.append(spacer);});await page.evaluate(()=>scrollTo(0,200));await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);}
   const header=await sample();expect(header.position).toBe(screen==='home'?'sticky':'absolute');expect(header.top).toBe(screen==='home'?'0px':'10px');expect(header.background).toBe(screen==='home'?'rgb(247, 243, 233)':'rgb(250, 247, 238)');expect(header.opacity).toBe('1');expect(header.filter).toBe('none');expect(header.backdrop).toBe('none');if(screen==='home')expect(header.width).toBeGreaterThanOrEqual(390*.9);else expect(header.width).toBe(44);expect(header.height).toBeGreaterThan(10);expect(header.y).toBe(screen==='home'?0:10);
  }
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content','default');
 }finally{await context.close();}
});

test('phone navigation frees activity space and each bare harbor marker is centered outside its actual coastal edge',async({browser})=>{
 const {context,page}=await start(browser,{width:390,height:844});try{
  await expect(page.locator('.app-header .brand')).toBeHidden();const menu=await page.locator('#room').boundingBox(),players=await page.locator('.players').boundingBox();expect(Math.abs(menu.y-players.y)).toBeLessThan(1);expect(menu.width).toBeGreaterThanOrEqual(44);
  await expect.poll(()=>page.locator('.activity-panel').evaluate(e=>e.clientHeight)).toBeGreaterThan(240);
  const ports=await page.evaluate(async()=>{const {client}=await import('./session.js'),{edgePoints,vertexPoint}=await import('./board.js'),{view}= (await client.inspect()).packet;return view.state.board.ports.map((port,i)=>{const [a,b]=edgePoints(port.edge),g=document.querySelectorAll('[data-port]')[i],label=g.querySelector('text'),coast=g.querySelector('[data-port-coast]');return {midError:Math.abs(((Number(label.getAttribute('x'))-320-(a.x+b.x)/2)*(b.x-a.x)+(Number(label.getAttribute('y'))-10-275-(a.y+b.y)/2)*(b.y-a.y))/Math.hypot(b.x-a.x,b.y-a.y)),decorations:g.querySelectorAll('[data-port-connector],circle').length,coastError:Math.hypot(Number(coast.getAttribute('x1'))-320-a.x,Number(coast.getAttribute('y1'))-275-a.y),vertexErrors:port.vertices.map(v=>{const p=vertexPoint(v);return Math.min(Math.hypot(p.x-a.x,p.y-a.y),Math.hypot(p.x-b.x,p.y-b.y));})};});});
  expect(ports).toHaveLength(9);for(const p of ports){expect(p.midError).toBeLessThan(.001);expect(p.coastError).toBeLessThan(.001);expect(p.decorations).toBe(0);expect(p.vertexErrors).toHaveLength(2);for(const e of p.vertexErrors)expect(e).toBeLessThan(.001);}
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Help & rules',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.screenshot({path:'test-results/phone-compact-390x844.png'});
 }finally{await context.close();}
});
