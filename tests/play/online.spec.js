import {test,expect} from '@playwright/test';
import {service,STATE,AUTH,roomId} from './mock-service.js';
const url='/game-shelf/play/';
const ready=page=>expect(page.locator('#connection')).toHaveText('Up to date');
async function state(page){return page.evaluate(async()=>{const {client}=await import('/game-shelf/play/session.js');return (await client.inspect()).state;});}
test('two browsers join separate seats and finish both setup rounds from authorized choices',async({browser})=>{
  const backend=service(),a=await browser.newContext(),b=await browser.newContext();
  try{
    await backend.attach(a,'alice');await backend.attach(b,'bob');const x=await a.newPage(),y=await b.newPage();await x.goto('http://127.0.0.1:4176'+url);await ready(x);
    await x.getByRole('button',{name:'Create a room',exact:true}).click();await x.getByLabel('Your name',{exact:true}).fill('Alice');await x.getByRole('button',{name:'Create room',exact:true}).click();await expect(x.getByRole('heading',{name:'One seat for a friend.'})).toBeVisible();
    await x.getByRole('button',{name:'Share invitation',exact:true}).click();const invite=await x.getByLabel('Invitation link').inputValue();await x.getByRole('button',{name:'Close panel'}).click();await y.goto(invite);await ready(y);await expect(y.getByLabel('Room ID',{exact:true})).toHaveValue(roomId);await y.getByLabel('Your name',{exact:true}).fill('Bob');await y.getByRole('button',{name:'Join the table',exact:true}).click();await ready(y);
    for(let i=0;i<8;i++){
      const actor=backend.current.p1.view.state.game.currentPlayerId,page=actor==='p1'?x:y;
      await page.locator('#refresh').click();await ready(page);const before=backend.accepted;
      await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect.poll(()=>backend.accepted).toBe(before+1);await ready(page);
    }
    await x.locator('#refresh').click();await ready(x);await expect(x.getByRole('button',{name:'Roll dice',exact:true})).toBeVisible();expect(backend.accepted).toBe(8);
    await x.reload();await ready(x);await expect(x.locator('.players')).toContainText('Alice · You');
  }finally{await a.close();await b.close();}
});
test('legacy identity/room migrate to IndexedDB and a lost reply retries one original command',async({browser})=>{
  const backend=service({phase:'main',loseReply:true}),context=await browser.newContext();
  try{
    await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);expect(backend.authCalls).toBe(0);
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByRole('heading',{name:'Let’s check your original move'})).toBeVisible();
    const original=(await state(page)).pending;expect(original.body.commandId).toBeTruthy();await page.evaluate(key=>localStorage.removeItem(key),STATE);expect((await state(page)).pending.body.commandId).toBe(original.body.commandId);await page.reload();await expect.poll(async()=>backend.commands.length,{timeout:12000}).toBeGreaterThanOrEqual(2);await ready(page);expect(backend.accepted).toBe(1);expect(backend.commands[1]).toEqual(backend.commands[0]);expect((await state(page)).pending).toBeNull();
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,AUTH)).toBe('alice');
  }finally{await context.close();}
});
test('unsupported reply keeps unresolved move and stops automatic retry',async({browser})=>{
  const backend=service({phase:'main',futureReply:true}),context=await browser.newContext();
  try{await backend.attach(context,'alice',{legacy:true});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await ready(page);await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByRole('heading',{name:'A compatible app is needed'})).toBeVisible();expect((await state(page)).pending).not.toBeNull();expect(backend.commands).toHaveLength(1);await expect(page.getByRole('button',{name:'Resolve move',exact:true})).toBeDisabled();}finally{await context.close();}
});
test('missing saved identity never creates a replacement principal',async({browser})=>{
  const backend=service({phase:'main'}),context=await browser.newContext();
  try{await backend.attach(context,'alice',{legacy:true,identity:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await expect(page.getByRole('heading',{name:'Your player identity needs attention'})).toBeVisible();expect(backend.authCalls).toBe(0);}finally{await context.close();}
});
test('IndexedDB refusal prevents creating an identity or sending a game mutation',async({browser})=>{
  const backend=service(),context=await browser.newContext();
  try{await backend.attach(context,'alice');await context.addInitScript(()=>{IDBFactory.prototype.open=()=>{throw new DOMException('Denied','SecurityError');};});const page=await context.newPage();await page.goto('http://127.0.0.1:4176'+url);await expect(page.getByText('Your player data could not be saved or read. No new move was sent. Keep this installation and fix storage before continuing.')).toBeVisible();expect(backend.authCalls).toBe(0);expect(backend.commands).toHaveLength(0);await expect(page.getByRole('button',{name:'Create a room',exact:true})).toBeDisabled();}finally{await context.close();}
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
    await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('button',{name:/^Road/}).click();await page.getByRole('button',{name:'Location 1',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
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
