import {test,expect,chromium} from '@playwright/test';
import {center,vertexPoint} from '../../play/board.js';
test.use({trace:'off'});
const root='http://127.0.0.1:4176/game-shelf/play/';
const resources=['brick','lumber','grain','wool','ore'];
const sum=hand=>resources.reduce((n,r)=>n+(hand[r]||0),0);
const diceWays=n=>{let ways=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a+b===n)ways++;return ways;};
// An original deterministic test driver, not a shipped bot or rules engine.
// Its inputs are one human seat's authorized view and legal server choices.
function choose(view){
  const own=view.state.players.players.find(p=>p.id===view.you),choices=view.choices;
  const priorities=['TRADE_ACCEPT','TRADE_DECLINE','DISCARD_RESOURCES','BUILD_CITY','BUILD_SETTLEMENT','PLAY_KNIGHT','PLAY_YEAR_OF_PLENTY','PLAY_MONOPOLY','PLAY_ROAD_BUILDING','BUY_DEVELOPMENT_CARD','ROLL_DICE','BUILD_ROAD'];
  if(choices[0]?.type==='PLACE_SETTLEMENT')return choices.reduce((best,c)=>{
    const value=choice=>{const p=vertexPoint(choice.vertex,1);return view.state.board.tiles.reduce((n,t)=>{const q=center(t.coord,1);return n+(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-1)<1e-8?diceWays(t.number):0);},0);};
    return value(c)>value(best)?c:best;
  });
  if(choices[0]?.type==='MOVE_ROBBER')return choices.reduce((best,c)=>{
    const value=choice=>{const tile=view.state.board.tiles.find(t=>t.coord.q===choice.hex.q&&t.coord.r===choice.hex.r),q=center(choice.hex,1);return view.state.board.buildings.reduce((n,b)=>{const p=vertexPoint(b.vertex,1);return n+(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-1)<1e-8?(b.playerId===view.you?-2:1)*diceWays(tile.number):0);},0);};
    return value(c)>value(best)?c:best;
  });
  if(choices[0]?.type==='STEAL_RESOURCE')return [...choices].sort((a,b)=>view.state.players.players.find(p=>p.id===b.victimId).resourceCount-view.state.players.players.find(p=>p.id===a.victimId).resourceCount)[0];
  for(const type of priorities){const action=choices.find(c=>c.type===type);if(action)return action;}
  if(choices[0]?.type==='PLACE_ROAD')return choices[0];
  const goals=[{ore:3,grain:2},{brick:1,lumber:1,grain:1,wool:1},{ore:1,grain:1,wool:1}],deficit=(hand,goal)=>resources.reduce((n,r)=>n+Math.max(0,(goal[r]||0)-hand[r]),0),goal=goals.reduce((a,b)=>deficit(own.resources,a)<=deficit(own.resources,b)?a:b);
  const exchange=choices.find(c=>{if(c.type!=='BANK_TRADE')return false;const after={...own.resources};after[c.give.resource]-=c.give.amount;after[c.receive.resource]+=c.receive.amount;return deficit(after,goal)<deficit(own.resources,goal);});
  return exchange||choices.find(c=>c.type==='END_TURN')||choices[0];
}
async function call(page,method,args=[]){
  let operation=method,inputs=args;
  for(let attempt=0;attempt<20;attempt++){
    const response=await page.evaluate(async({method,args})=>{const{client}=await import('/game-shelf/play/session.js');try{return await client[method](...args);}catch(e){return {failure:{code:e.code,message:e.message,retryAfterMs:e.retryAfterMs||0,retryable:!!e.retryable}};}},{method:operation,args:inputs});
    if(!response?.failure)return response;
    if(!response.failure.retryable)throw Error(`${response.failure.code}: ${response.failure.message}`);
    await new Promise(resolve=>setTimeout(resolve,Math.max(2000,response.failure.retryAfterMs)));
    if(method==='execute'){operation='execute';inputs=[];}
  }
  throw Error('Live request retry budget exhausted');
}
test('LIVE: two human identities and one managed bot finish a real game in Calm Table',async({},testInfo)=>{
  test.skip(process.env.GAME_SHELF_LIVE!=='1','Opt in: creates two real anonymous users and one managed game.');test.setTimeout(1800000);
  const browser=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined});
  try{
    const a=await browser.newContext({viewport:{width:1024,height:768}}),b=await browser.newContext({viewport:{width:768,height:1024}}),x=await a.newPage(),y=await b.newPage();
    await x.goto(root);await expect(x.locator('#connection')).toHaveText('Up to date');await x.getByRole('button',{name:'New game',exact:true}).click();await x.getByLabel('Your name',{exact:true}).fill('Alice');await x.getByRole('button',{name:'Create game',exact:true}).click();await expect(x.getByRole('heading',{name:'One seat for a friend.'})).toBeVisible({timeout:60000});
    await x.getByRole('button',{name:'Share invitation',exact:true}).click();const link=await x.getByLabel('Invitation link').inputValue();await x.getByRole('button',{name:'Close panel'}).click();await y.goto(link);await expect(y.locator('#connection')).toHaveText('Up to date');await y.getByLabel('Your name',{exact:true}).fill('Bob');await y.getByRole('button',{name:'Join game',exact:true}).click();await expect(y.locator('.players')).toContainText('Bot',{timeout:60000});
    const pages={p1:x,p2:y};let packet=await call(x,'refresh'),moves=0,traded=false,acceptedTrade=false,reconnected=false;
    while(packet?.ok&&packet.status!=='ended'&&moves<1500){
      const v=packet.view,g=v.state.game,actor=v.offer?v.offer.to:g.phase==='discard'?g.pendingDiscard.find(p=>pages[p]):g.currentPlayerId;
      if(!pages[actor]){await new Promise(resolve=>setTimeout(resolve,5000));packet=await call(x,'refresh');continue;}
      const page=pages[actor];packet=await call(page,'refresh');if(!packet.ok)throw Error(packet.error.code);
      const view=packet.view;if(!view.choices.length){packet=await call(x,'refresh');continue;}
      for(const p of view.state.players.players)if(p.id!==view.you){expect(Object.values(p.resources).every(n=>n===0)).toBe(true);expect(p.developmentCards).toEqual([]);}expect(view).not.toHaveProperty('deck');
      let action;
      if(!traded&&view.state.game.phase==='main'&&!view.offer){const peer=actor==='p1'?'p2':'p1',other=await call(pages[peer],'refresh');if(other?.ok){const own=view.state.players.players.find(p=>p.id===actor).resources,theirs=other.view.state.players.players.find(p=>p.id===peer).resources;const pair=resources.flatMap(give=>resources.map(receive=>({give,receive}))).find(p=>p.give!==p.receive&&own[p.give]>0&&theirs[p.receive]>0);if(pair){const blank=()=>Object.fromEntries(resources.map(r=>[r,0]));action={type:'TRADE_OFFER',to:peer,give:{...blank(),[pair.give]:1},receive:{...blank(),[pair.receive]:1}};traded=true;}}}
      action ||=choose(view);if(!action)throw Error('No legal human decision');
      const result=await call(page,'execute',['command',{roomId:packet.roomId,expectedRevision:view.revision,action}]);packet=result||await call(page,'refresh');
      if(!packet.ok&&packet.error.code==='revision_conflict'){packet=await call(page,'refresh');continue;}
      if(!packet.ok)throw Error(packet.error.code);if(action.type==='TRADE_ACCEPT')acceptedTrade=true;moves++;
      if(!reconnected&&moves>20){await x.locator('#refresh').click();await expect(x.locator('#connection')).toHaveText('Up to date');const before=(await call(x,'inspect')).principalId;await a.setOffline(true);await expect(x.getByRole('heading',{name:'You’re offline'})).toBeVisible();await a.setOffline(false);await expect(x.locator('#connection')).toHaveText('Up to date',{timeout:45000});await x.reload();await expect(x.locator('#connection')).toHaveText('Up to date',{timeout:45000});expect((await call(x,'inspect')).principalId).toBe(before);reconnected=true;packet=await call(page,'refresh');}
      if(moves%20===0)console.log('Live Calm Table:',moves,'human commands; turn',packet.view.state.game.turn,'revision',packet.revision);
    }
    expect(packet.ok).toBe(true);expect(packet.status).toBe('ended');expect(packet.view.state.game.finalScores[packet.view.state.game.winnerId]).toBeGreaterThanOrEqual(10);
    await x.locator('#refresh').click();await y.locator('#refresh').click();await expect(x.getByRole('button',{name:'See the results'})).toBeVisible({timeout:45000});await expect(y.getByRole('button',{name:'See the results'})).toBeVisible({timeout:45000});await x.getByRole('button',{name:'See the results'}).click();await expect(x.getByRole('heading',{name:'An evening well played'})).toBeVisible();
    await x.screenshot({path:testInfo.outputPath('real-calm-table-victory.png'),fullPage:true});console.log('Natural managed game complete:',moves,'human commands; trade accepted:',acceptedTrade,'reconnected:',reconnected);expect(acceptedTrade).toBe(true);
  }finally{await browser.close();}
});

test('LIVE SOLO: one human and two managed bots finish a game, retain identity and reject guests',async()=>{
  test.skip(process.env.GAME_SHELF_SOLO_LIVE!=='1','Opt in: creates real anonymous users and managed solo/friends rooms.');test.setTimeout(1800000);
  const browser=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined});
  try{
    const a=await browser.newContext({viewport:{width:1024,height:768}}),b=await browser.newContext(),x=await a.newPage(),y=await b.newPage();let createBody;
    x.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/public/catan')){const body=request.postDataJSON();if(body.op==='create')createBody=body;}});
    await x.goto(root);await expect(x.locator('#connection')).toHaveText('Up to date');await x.getByRole('button',{name:'New game',exact:true}).click();await x.getByLabel('Players',{exact:true}).selectOption('solo');await x.getByLabel('Your name',{exact:true}).fill('Solo tester');await x.getByRole('button',{name:'Start solo game',exact:true}).click();try{await expect(x.locator('.players .bot-tag')).toHaveCount(2,{timeout:60000});}catch{throw Error('Solo start did not reach the board: '+(await x.locator('#app').innerText()).slice(0,650));}
    const wire=async(page,body,allowCreate=false)=>page.evaluate(async({body,allowCreate})=>{const {createTransport}=await import('/game-shelf/play/core/transport.js');const transport=createTransport(),identity=await transport.identity({allowCreate});return transport.request(body,identity);},{body,allowCreate});
    let packet=await call(x,'refresh');const room=packet.roomId,principal=(await call(x,'inspect')).principalId;expect(packet.status).toBe('playing');expect(createBody.mode).toBe('solo');expect(packet.members.filter(s=>s.kind==='bot').map(s=>s.id).sort()).toEqual(['p2','p3']);expect(new Set(packet.members.map(s=>s.name)).size).toBe(3);
    const replay=await wire(x,createBody);expect(replay.ok).toBe(true);expect(replay.roomId).toBe(room);expect(replay.revision).toBeGreaterThanOrEqual(packet.revision);expect((await wire(x,{...createBody,mode:'friends'})).error.code).toBe('command_id_conflict');expect((await wire(x,{...createBody,commandId:crypto.randomUUID(),mode:'invalid'})).error.code).toBe('bad_request');
    await y.goto(root);await expect(y.locator('#connection')).toHaveText('Up to date');for(const body of [{apiVersion:1,op:'join',commandId:crypto.randomUUID(),roomId:room,name:'Guest'},{apiVersion:1,op:'view',roomId:room},{apiVersion:1,op:'command',roomId:room,commandId:crypto.randomUUID(),expectedRevision:packet.revision,action:{type:'END_TURN'}}]){const result=await wire(y,body,true);expect(result.ok).toBe(false);expect(['room_full','cannot_join','room_not_found']).toContain(result.error.code);expect(result.view).toBeUndefined();}
    let moves=0,idle=0,reconnected=false,offered=false,botResponse=false;const seenBots=new Set();
    while(packet.ok&&packet.status!=='ended'&&moves<1000){
      const v=packet.view;
      for(const p of v.state.players.players)if(p.id!=='p1'){expect(Object.values(p.resources).every(n=>n===0)).toBe(true);expect(p.developmentCards).toEqual([]);}expect(v).not.toHaveProperty('deck');
      for(const building of v.state.board.buildings)if(building.playerId!=='p1')seenBots.add(building.playerId);
      if(!v.choices.length){if(++idle>30)throw Error('Solo bot scheduler made no human progress');await new Promise(resolve=>setTimeout(resolve,5000));packet=await call(x,'refresh');continue;}idle=0;
      let action;
      if(!offered&&v.state.game.phase==='main'&&!v.offer){const own=v.state.players.players.find(p=>p.id==='p1').resources,give=resources.find(r=>own[r]>0);if(give){const receive=resources.find(r=>r!==give),blank=Object.fromEntries(resources.map(r=>[r,0]));action={type:'TRADE_OFFER',to:'p2',give:{...blank,[give]:1},receive:{...blank,[receive]:1}};}}
      action ||=choose(v);if(!action)throw Error('No legal solo human decision');
      packet=await call(x,'execute',['command',{roomId:room,expectedRevision:v.revision,action}]);if(!packet.ok&&packet.error.code==='revision_conflict'){packet=await call(x,'refresh');continue;}if(!packet.ok)throw Error(packet.error.code);moves++;
      if(action.type==='TRADE_OFFER'){offered=true;botResponse=!packet.view.offer;if(!botResponse){packet=await call(x,'refresh');botResponse=!packet.view.offer;}}
      if(!reconnected&&moves>=12){await a.setOffline(true);await expect(x.getByRole('heading',{name:'You’re offline'})).toBeVisible();await a.setOffline(false);await expect(x.locator('#connection')).toHaveText('Up to date',{timeout:45000});await x.reload();await expect(x.locator('#connection')).toHaveText('Up to date',{timeout:45000});const saved=await call(x,'inspect');expect(saved.principalId).toBe(principal);expect(saved.state.roomId).toBe(room);reconnected=true;packet=await call(x,'refresh');}
      if(moves%10===0)console.log('Live solo:',moves,'human commands; turn',packet.view.state.game.turn,'revision',packet.revision);
    }
    expect(packet.status).toBe('ended');expect(packet.view.state.game.finalScores[packet.view.state.game.winnerId]).toBeGreaterThanOrEqual(10);expect([...seenBots].sort()).toEqual(['p2','p3']);expect(reconnected).toBe(true);expect(offered&&botResponse).toBe(true);await x.locator('#refresh').click();await expect(x.getByRole('button',{name:'See the results'})).toBeVisible({timeout:45000});
    console.log('Solo natural victory:',moves,'human commands; both bots built; bot trade response and identity resume passed.');
    const easy=await call(x,'execute',['create',{name:'Easy tester',botLevel:'easy',mode:'solo'},{replace:true}]);expect(easy.ok).toBe(true);expect(easy.status).toBe('playing');expect(easy.members.filter(s=>s.kind==='bot').every(s=>s.level==='easy')).toBe(true);
    const friends=await call(x,'execute',['create',{name:'Friend tester',botLevel:'standard'},{replace:true}]);expect(friends.ok).toBe(true);expect(friends.status).toBe('waiting');const joined=await wire(y,{apiVersion:1,op:'join',commandId:crypto.randomUUID(),roomId:friends.roomId,name:'Guest'});expect(joined.ok).toBe(true);expect(joined.you).toBe('p2');expect(joined.members.filter(s=>s.kind==='human')).toHaveLength(2);expect(joined.members.filter(s=>s.kind==='bot')).toHaveLength(1);console.log('Easy solo starts and legacy friends create/join remain compatible.');
  }finally{await browser.close();}
});
