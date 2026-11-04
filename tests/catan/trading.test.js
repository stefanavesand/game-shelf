import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {getHexVertices} from '../../play/catan/rules/geometry.js';
const module=createCatanModule(CATAN_ARTIFACT.digest);
const pairs=[['human to bot',true,'a','bot:1'],['bot to human',true,'bot:1','a'],['bot to bot',true,'bot:1','bot:2'],['human to human',false,'a','b']];
function fixture(solo,level,active='a'){
 const humans=solo?[{id:'a',name:'A'}]:[{id:'a',name:'A'},{id:'b',name:'B'}],g=module.initialize(catanConfig(humans,{solo,level,seed:42}),{gameId:'trade-fixture'});
 Object.assign(g.snapshot.state.game,{phase:'main',turn:5,currentPlayerId:active,lastRoll:{die1:2,die2:3,total:5}});return g;
}
const player=(g,id)=>g.snapshot.state.players.players.find(p=>p.id===id);
function fund(g,id,r,n){const p=player(g,id);g.snapshot.state.game.bank[r]-=n-p.resources[r];p.resources[r]=n;}
function act(g,actor,action){const seat=g.snapshot.seats.find(s=>s.id===actor);return module.apply(g,seat.kind==='bot'?'a':actor,{actor,action},{},{coordinatorId:'a'});}
function conserved(g){for(const r of RESOURCES){const values=[g.snapshot.state.game.bank[r],...g.snapshot.state.players.players.map(p=>p.resources[r])];assert.equal(values.reduce((a,b)=>a+b),19);assert.ok(values.every(n=>Number.isSafeInteger(n)&&n>=0));}}
const generous={ore:3,grain:2,wool:1,lumber:2};
function prepared(solo,level,from,to){const g=fixture(solo,level,from);for(const [r,n]of Object.entries(generous))fund(g,from,r,n);fund(g,to,'brick',1);g.snapshot.state.board.buildings=[{playerId:to,type:'settlement',vertex:getHexVertices({q:0,r:0})[0]}];player(g,to).settlementsRemaining--;return g;}
for(const level of ['easy','standard'])for(const [label,solo,from,to]of pairs){
 test(`${level}: ${label} accepts a clearly useful offer once through ordinary commands`,()=>{
  let g=prepared(solo,level,from,to);const before=structuredClone(g);g=act(g,from,{type:'TRADE_OFFER',to,give:generous,receive:{brick:1}});assert.deepEqual(g.snapshot.state.players,before.snapshot.state.players);
  const id=g.snapshot.offer.id,recipient=g.snapshot.seats.find(s=>s.id===to),third=g.snapshot.seats.find(s=>s.id!==from&&s.id!==to).id,pending=structuredClone(g);
  assert.throws(()=>act(g,third,{type:'TRADE_ACCEPT',offerId:id}));assert.deepEqual(g,pending);
  if(recipient.kind==='human')assert.equal(module.nextBot(g),null);
  const response=recipient.kind==='bot'?module.nextBot(g):{actor:to,action:{type:'TRADE_ACCEPT',offerId:id}};assert.equal(response.actor,to);assert.equal(response.action.type,'TRADE_ACCEPT');g=act(g,to,response.action);
  assert.equal(g.snapshot.offer,null);assert.equal(player(g,from).resources.brick,1);assert.equal(player(g,to).resources.brick,0);for(const [r,n]of Object.entries(generous)){assert.equal(player(g,from).resources[r],0);assert.equal(player(g,to).resources[r],n);}conserved(g);
  const accepted=structuredClone(g);assert.throws(()=>act(g,to,{type:'TRADE_ACCEPT',offerId:id}));assert.deepEqual(g,accepted);
 });
 test(`${level}: ${label} cannot accept what the recipient does not own and can decline without transfer`,()=>{
  let g=prepared(solo,level,from,to);g=act(g,from,{type:'TRADE_OFFER',to,give:generous,receive:{brick:2}});const id=g.snapshot.offer.id,before=structuredClone(g);
  assert.ok(!module.view(g,to).choices.some(c=>c.type==='TRADE_ACCEPT'));assert.throws(()=>act(g,to,{type:'TRADE_ACCEPT',offerId:id}));assert.deepEqual(g,before);
  if(g.snapshot.seats.find(s=>s.id===to).kind==='human')assert.equal(module.nextBot(g),null);
  const response=g.snapshot.seats.find(s=>s.id===to).kind==='bot'?module.nextBot(g):{actor:to,action:{type:'TRADE_DECLINE',offerId:id}};assert.equal(response.action.type,'TRADE_DECLINE');g=act(g,to,response.action);assert.equal(g.snapshot.offer,null);assert.deepEqual(g.snapshot.state.players,before.snapshot.state.players);conserved(g);
 });
}
test('Standard declines a resource-losing offer even if it could pay',()=>{
 let g=fixture(true,'standard');fund(g,'a','ore',1);fund(g,'bot:1','brick',3);g=act(g,'a',{type:'TRADE_OFFER',to:'bot:1',give:{ore:1},receive:{brick:3}});assert.ok(module.view(g,'bot:1').choices.some(c=>c.type==='TRADE_ACCEPT'));assert.equal(module.nextBot(g).action.type,'TRADE_DECLINE');
});
for(const level of ['easy','standard']){
 test(`${level}: a bot proposes a bounded offer, waits for the recipient, and does not immediately reoffer after decline`,()=>{
  let g=fixture(true,level,'bot:1');fund(g,'a','brick',1);fund(g,'bot:1','wool',2);const command=module.nextBot(g);assert.equal(command.actor,'bot:1');assert.equal(command.action.type,'TRADE_OFFER');assert.equal(Object.values(command.action.give).reduce((a,b)=>a+b),1);assert.equal(Object.values(command.action.receive).reduce((a,b)=>a+b),1);
  g=act(g,'bot:1',command.action);assert.equal(g.snapshot.offer.to,'a');assert.equal(module.nextBot(g),null);assert.ok(!module.view(g,'a').choices.some(c=>c.type==='TRADE_ACCEPT'));
  g=act(g,'a',{type:'TRADE_DECLINE',offerId:g.snapshot.offer.id});assert.equal(module.nextBot(g).action.type,'END_TURN');conserved(g);
 });
 test(`${level}: opponent hand types, hidden cards, deck order and future entropy do not influence a bot response`,()=>{
  let g=prepared(false,level,'a','bot:2');fund(g,'a','ore',4);fund(g,'a','wool',2);fund(g,'b','ore',1);fund(g,'b','wool',3);
  g.snapshot.deck.splice(g.snapshot.deck.indexOf('knight'),1);player(g,'a').developmentCards.push({id:'hidden',type:'knight',turnBought:1,isPlayed:false});g.snapshot.state.game.developmentDeckCount=g.snapshot.deck.length;
  g=act(g,'a',{type:'TRADE_OFFER',to:'bot:2',give:{ore:1},receive:{brick:1}});const changed=structuredClone(g);
  player(changed,'a').resources.ore--;player(changed,'a').resources.wool++;player(changed,'b').resources.ore++;player(changed,'b').resources.wool--;
  player(changed,'a').developmentCards[0].type='victoryPoint';changed.snapshot.deck[changed.snapshot.deck.indexOf('victoryPoint')]='knight';changed.snapshot.deck.reverse();changed.entropy.rngState=12345;
  assert.deepEqual(module.view(changed,'bot:2'),module.view(g,'bot:2'));assert.deepEqual(module.nextBot(changed),module.nextBot(g));assert.deepEqual(botDecision(module.view(g,'bot:2'),level),botDecision(module.view(g,'bot:2'),level));conserved(g);conserved(changed);
 });
}
test('accept versus cancel has exactly one outcome in either command order',()=>{
 let g=prepared(false,'standard','a','b');g=act(g,'a',{type:'TRADE_OFFER',to:'b',give:generous,receive:{brick:1}});const offerId=g.snapshot.offer.id;
 for(const first of ['TRADE_ACCEPT','TRADE_CANCEL']){const actor=first==='TRADE_ACCEPT'?'b':'a',next=act(g,actor,{type:first,offerId}),saved=structuredClone(next);assert.throws(()=>act(next,actor==='a'?'b':'a',{type:first==='TRADE_ACCEPT'?'TRADE_CANCEL':'TRADE_ACCEPT',offerId}));assert.deepEqual(next,saved);conserved(next);}
});
test('an old response cannot accept or cancel a replacement offer',()=>{
 let g=prepared(false,'standard','a','b');g=act(g,'a',{type:'TRADE_OFFER',to:'b',give:generous,receive:{brick:1}});const old=g.snapshot.offer.id;g=act(g,'b',{type:'TRADE_DECLINE',offerId:old});g=act(g,'a',{type:'TRADE_OFFER',to:'b',give:{ore:1},receive:{brick:1}});assert.notEqual(g.snapshot.offer.id,old);const before=structuredClone(g);
 assert.throws(()=>act(g,'b',{type:'TRADE_ACCEPT',offerId:old}));assert.throws(()=>act(g,'a',{type:'TRADE_CANCEL',offerId:old}));assert.deepEqual(g,before);
});
test('invalid quantities, unowned resources and both-sided resources reject without state or entropy changes',()=>{
 const g=prepared(false,'standard','a','b'),before=structuredClone(g);
 for(const [give,receive]of [[{ore:-1},{brick:1}],[{ore:0.5},{brick:1}],[{ore:NaN},{brick:1}],[{ore:1},{brick:0}],[{brick:1},{ore:1}],[{ore:1},{ore:1}]]){assert.throws(()=>act(g,'a',{type:'TRADE_OFFER',to:'b',give,receive}));assert.deepEqual(g,before);}
});
