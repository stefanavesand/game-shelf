import {test,expect} from './account-fixture.js';
const root='/game-shelf/play/';
test('rules and all five card descriptions remain available offline on a phone-sized screen',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});let external=0;await context.route(/^https:\/\//,route=>{external++;return route.abort();});
 try{const page=await context.newPage();await page.goto(root+'#home');await expect(page.locator('#offline-status')).toHaveText('Ready for offline',{timeout:30000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await context.setOffline(true);
  await page.getByRole('button',{name:'Help and rules',exact:true}).click();await page.getByText('Goal and points',{exact:true}).click();await expect(page.getByText(/Reach ten points on your turn/)).toBeVisible();
  for(const title of ['Knight','Road Building','Year of Plenty','Monopoly','Victory Point']){const topic=page.getByRole('dialog').locator('details').filter({has:page.getByText(title,{exact:true})});await topic.locator('summary').click();await expect(topic.locator('p').first()).toBeVisible();}
  const bounds=await page.getByRole('dialog').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);expect(external).toBe(0);
 }finally{await context.close();}
});
test('score breakdown explains awards while only revealing the local seat victory cards',async({browser})=>{
 const context=await browser.newContext();await context.route(/^https:\/\//,route=>route.abort());
 try{const page=await context.newPage();await page.goto(root+'#home');await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByLabel('Play mode',{exact:true}).selectOption('solo');await page.getByRole('button',{name:'Start solo game',exact:true}).click();await expect(page.locator('.players .bot-tag')).toHaveCount(2);
  // Prepared projection scenario, not natural-game evidence.
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onsuccess=()=>resolve(r.result);});const lib=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get('account:alice');r.onsuccess=()=>resolve(r.result);}),g=lib.games[lib.current],s=g.state.snapshot;Object.assign(s.state.game,{phase:'main',currentPlayerId:'p1',turn:5});for(let i=0;i<3;i++){s.deck.splice(s.deck.indexOf('victoryPoint'),1);s.state.players.players[i===0?0:1].developmentCards.push({id:'fixture-vp'+i,type:'victoryPoint',turnBought:1,isPlayed:false});}s.state.game.developmentDeckCount=s.deck.length;const {digest}=await import('./relay/protocol.js');g.hash=await digest(g.state);await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(lib,'account:alice');tx.oncomplete=resolve;});db.close();});
  await page.reload();await expect(page.locator('.actor-status')).toContainText('Alice is acting');await page.getByRole('button',{name:'Score breakdown',exact:true}).click();const sections=page.locator('.score-detail');await expect(sections).toHaveCount(3);await expect(sections.nth(0).locator('dd').last()).toHaveText('1');await expect(sections.nth(1).locator('dd').last()).toHaveText('Hidden');await expect(sections.nth(0)).toContainText('Longest Road');await expect(sections.nth(0)).toContainText('Largest Army');
  await page.getByRole('button',{name:'Close panel'}).click();await page.getByRole('button',{name:/Victory Point.*Private point/}).click();await expect(page.getByRole('dialog')).toContainText('Worth one private victory point immediately after purchase');
 }finally{await context.close();}
});
