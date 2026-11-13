import {test,expect} from './account-fixture.js';
import {service} from './mock-service.js';
test('activity action stays visible, six hand tiles and selected player scores are reachable',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:664}}),backend=service({phase:'main'});await backend.attach(context,'alice',{legacy:true});
 try{const page=await context.newPage();await page.goto('/game-shelf/play/#game');await expect(page.locator('.action-entry')).toBeVisible();
 const feed=await page.locator('#activity-feed').boundingBox(),action=await page.locator('.action-entry').boundingBox();expect(action.y).toBeGreaterThanOrEqual(feed.y);expect(action.y+action.height).toBeLessThanOrEqual(feed.y+feed.height+1);
 await expect(page.locator('.resource-row>.resource-tile')).toHaveCount(6);await page.locator('#player-p2').click();await expect(page.locator('.score-detail:not([hidden])')).toContainText('Bob');await expect(page.locator('.score-detail:not([hidden]) dd').last()).toHaveText('Hidden');await expect(page.getByLabel('Player',{exact:true})).toHaveCSS('outline-style','none');await page.getByRole('button',{name:'Close panel',exact:true}).click();await expect(page.locator('#player-p2')).toBeFocused();await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.locator('#sidebar-body [data-action=scores]')).toHaveCount(0);await page.getByRole('button',{name:'Close menu',exact:true}).click();await page.getByRole('button',{name:/Cards ·/}).click();await expect(page.getByRole('dialog')).toBeVisible();
 }finally{await context.close();}
});

test('a reader keeps their history position through new moves and can jump to the current action',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),backend=service({phase:'main'});await backend.attach(context,'alice',{legacy:true});
 for(const p of Object.values(backend.current)){p.revision=90;p.view.revision=90;p.view.history=Array.from({length:30},(_,i)=>({revision:i+61,playerId:'p1',message:'end turn'}));}
 try{const page=await context.newPage();await page.goto('/game-shelf/play/#game');const feed=page.locator('#activity-feed');await expect(page.locator('.action-entry')).toBeInViewport();await feed.evaluate(e=>{e.scrollTop=60;e.dispatchEvent(new Event('scroll'));});
 const position=await feed.evaluate(e=>e.scrollTop);
 for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.view.history.push({revision:p.revision,playerId:'p2',message:'end turn'});p.view.history=p.view.history.slice(-30);}
 await page.locator('#refresh').evaluate(e=>e.click());await expect(page.locator('.activity-entry').last()).toHaveAttribute('data-entry','91');expect(Math.abs(await feed.evaluate(e=>e.scrollTop)-position)).toBeLessThan(2);await expect(page.locator('#activity-jump')).toBeVisible();await page.locator('#activity-jump').click();await expect(page.locator('.action-entry')).toBeInViewport();await expect(page.locator('#activity-jump')).toBeHidden();
 }finally{await context.close();}
});

test('completed games expose every final score through the player chips',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}}),backend=service({phase:'main'});await backend.attach(context,'alice',{legacy:true});
 for(const p of Object.values(backend.current)){p.revision++;p.view.revision=p.revision;p.status='ended';Object.assign(p.view.state.game,{phase:'ended',winnerId:'p1',finalScores:{p1:10,p2:5,p3:4}});p.view.choices=[];}
 try{const page=await context.newPage();await page.goto('/game-shelf/play/#game');await page.locator('#player-p2').click();await expect(page.getByRole('heading',{name:'Final score breakdown',exact:true})).toBeVisible();await expect(page.locator('.score-detail:not([hidden])')).toContainText('Bob · 5 VP');await expect(page.locator('.score-detail:not([hidden]) dd').last()).not.toHaveText('Hidden');
 }finally{await context.close();}
});

test('confirmation remains a saving action until the local command is acknowledged',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:664}});
 try{const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board [role=button]').first()).toBeVisible({timeout:15000});
 await page.evaluate(async()=>{const {client}=await import('./session.js'),execute=client.execute;const gate=new Promise(resolve=>window.releaseCommand=resolve);client.execute=async(...args)=>{await gate;return execute(...args);};});
 await page.locator('#board [role=button]').first().press('Enter');const before=await page.locator('.activity-entry').count();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.locator('.action-entry')).toContainText('Saving your move');await expect(page.getByRole('button',{name:'Confirm',exact:true})).toBeDisabled();await expect(page.locator('.activity-entry')).toHaveCount(before);
 await page.evaluate(()=>window.releaseCommand());await expect(page.locator('.activity-entry').last()).toContainText('placed a settlement');await expect(page.locator('.action-entry')).not.toContainText('Saving your move');await expect(page.locator('.action-entry')).toContainText('road');
 }finally{await context.close();}
});

test('a sole robber victim is stolen from automatically without opening a picker',async({browser})=>{
 const context=await browser.newContext();try{const page=await context.newPage();await page.goto('/game-shelf/play/#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode').selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('#board')).toBeVisible();
 const prepared=await page.evaluate(async()=>{
  const {client}=await import('./session.js'),{botDecision}=await import('./catan/rules/index.js');let {packet:p}=await client.inspect();
  for(let i=0;i<30&&p.view.state.game.phase.startsWith('setup');i++)p=p.view.choices.length?await client.execute('command',{roomId:p.roomId,expectedRevision:p.revision,action:botDecision(p.view,'standard')},{botBudget:0}):await client.refresh({botBudget:1});
  const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1');r.onsuccess=()=>resolve(r.result);}),lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;
  // Prepared authoritative position: ordinary resource transfers preserve totals.
  for(const q of s.state.players.players.filter(q=>q.id!=='p1')){s.state.game.bank.brick+=q.resources.brick-1;q.resources.brick=1;}
  const {victims}=await import('./catan/rules/turn.js'),tile=s.state.board.tiles.find(t=>victims(s.state,t.coord,'p1').length===1);if(!tile)throw Error('Missing sole-victim fixture');
  const victim=victims(s.state,tile.coord,'p1')[0];Object.assign(s.state.game,{phase:'robber-steal',currentPlayerId:'p1',turn:20});s.state.board.robberLocation=tile.coord;
  const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();return {revision:s.revision,victim};
 });
 await page.reload();await expect.poll(()=>page.evaluate(async()=>{const {client}=await import('./session.js');return (await client.inspect()).packet?.view.state.game.phase;})).toBe('main');await expect(page.locator('#sheet')).not.toBeVisible();const result=await page.evaluate(async()=>{const {client}=await import('./session.js');const {packet:p}=await client.inspect();return {revision:p.revision,message:p.view.history.at(-1)?.message};});expect(result.revision).toBe(prepared.revision+1);expect(result.message).toContain('steal');
 }finally{await context.close();}
});
