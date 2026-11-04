import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {applyTurn} from '../../play/catan/rules/turn.js';
import {score,updateScores,roadLength} from '../../play/catan/rules/scoring.js';
import {getHexVertices,getHexEdges,getEdgeVertices,vertexKey} from '../../play/catan/rules/geometry.js';
import {botDecision} from '../../play/catan/rules/index.js';
const module=createCatanModule(CATAN_ARTIFACT.digest);
function fixture(){const game=module.initialize(catanConfig([{id:'a',name:'A'},{id:'b',name:'B'}],{seed:42}),{gameId:'rules-fixture'});Object.assign(game.snapshot.state.game,{phase:'main',currentPlayerId:'a',turn:5});return game;}
const act=(g,actor,action)=>module.apply(g,actor==='bot:2'?'a':actor,{actor,action},{},{coordinatorId:'a'});
function fund(g,id,r,n){const p=g.snapshot.state.players.players.find(p=>p.id===id);g.snapshot.state.game.bank[r]-=n-p.resources[r];p.resources[r]=n;}
function card(g,type){g.snapshot.deck.splice(g.snapshot.deck.indexOf(type),1);g.snapshot.state.players.players[0].developmentCards.push({id:type,type,turnBought:1,isPlayed:false});g.snapshot.state.game.developmentDeckCount=g.snapshot.deck.length;}
const players=g=>g.snapshot.state.players.players;
test('production gives one card per settlement and two per city, with no partial multi-player shortage payout',()=>{
 const g=fixture(),s=g.snapshot.state,tile=s.board.tiles.find(t=>t.terrain==='hills'),v=getHexVertices(tile.coord);s.board.tiles=[tile];s.board.robberLocation={q:99,r:99};tile.number=6;s.game.phase='roll';s.game.lastRoll=null;s.board.buildings=[{playerId:'a',type:'settlement',vertex:v[0]},{playerId:'b',type:'city',vertex:v[2]}];
 const roll=()=>applyTurn(s,{type:'ROLL_DICE'},'a',()=>2);
 let result=roll();assert.equal(result.success,true);assert.equal(result.state.players.players[0].resources.brick,1);assert.equal(result.state.players.players[1].resources.brick,2);
 s.game.bank.brick=2;result=roll();assert.equal(result.state.players.players[0].resources.brick,0);assert.equal(result.state.players.players[1].resources.brick,0);assert.equal(result.state.game.bank.brick,2);
 s.board.buildings=s.board.buildings.slice(1);s.game.bank.brick=1;result=roll();assert.equal(result.state.players.players[1].resources.brick,1);assert.equal(result.state.game.bank.brick,0);
 s.board.robberLocation=tile.coord;result=roll();assert.equal(result.state.players.players[1].resources.brick,0);
});
test('seven freezes half-hand discard, permits off-turn discard and waits for everyone',()=>{
 const g=fixture(),s=g.snapshot.state;fund(g,'a','brick',9);fund(g,'b','ore',8);s.game.phase='roll';s.game.lastRoll=null;let die=0;
 let r=applyTurn(s,{type:'ROLL_DICE'},'a',()=>[2,3][die++]);assert.equal(r.success,true);assert.equal(r.state.game.phase,'discard');assert.deepEqual(r.state.game.discardAmounts,{a:4,b:4});
 const before=structuredClone(r.state);assert.equal(applyTurn(r.state,{type:'DISCARD_RESOURCES',resources:{ore:3}},'b',()=>0).success,false);assert.deepEqual(r.state,before);
 r=applyTurn(r.state,{type:'DISCARD_RESOURCES',resources:{ore:4}},'b',()=>0);assert.equal(r.success,true);assert.equal(r.state.game.phase,'discard');
 r=applyTurn(r.state,{type:'DISCARD_RESOURCES',resources:{brick:4}},'a',()=>0);assert.equal(r.state.game.phase,'robber-move');assert.equal(r.state.players.players[0].resources.brick,5);
});
test('Longest Road needs five, retains its holder on a tie and removes an award after a blocking settlement',()=>{
 const g=fixture(),s=g.snapshot.state,ring=getHexEdges(s.board.tiles[0].coord),other=getHexEdges(s.board.tiles.at(-1).coord);
 const roads=(edges,id)=>edges.map(edge=>({playerId:id,edge}));s.board.roads=roads(ring.slice(0,4),'a');updateScores(s);assert.equal(s.game.longestRoad,null);
 s.board.roads=roads(ring.slice(0,5),'a');updateScores(s);assert.equal(s.game.longestRoad.playerId,'a');
 s.board.roads.push(...roads(other.slice(0,5),'b'));updateScores(s);assert.equal(s.game.longestRoad.playerId,'a');
 // Find the shared middle intersection of the second and third edges.
 const middle=getEdgeVertices(ring[1]).find(v=>getEdgeVertices(ring[2]).some(w=>vertexKey(v)===vertexKey(w)));
 s.board.buildings=[{type:'settlement',playerId:'b',vertex:middle}];assert.ok(roadLength(s,'a')<5);updateScores(s);assert.equal(s.game.longestRoad.playerId,'b');
});
test('Largest Army requires three knights, retains ties and transfers only on a strictly larger army',()=>{
 let g=fixture();card(g,'knight');players(g)[0].armySize=1;g=act(g,'a',{type:'PLAY_KNIGHT'});assert.equal(g.snapshot.state.game.largestArmy,null);
 g=fixture();card(g,'knight');players(g)[0].armySize=2;g=act(g,'a',{type:'PLAY_KNIGHT'});assert.deepEqual(g.snapshot.state.game.largestArmy,{playerId:'a',value:3});
 for(const [size,holder] of [[2,'b'],[3,'a']]){g=fixture();card(g,'knight');players(g)[0].armySize=size;players(g)[1].armySize=3;g.snapshot.state.game.largestArmy={playerId:'b',value:3};g=act(g,'a',{type:'PLAY_KNIGHT'});assert.equal(g.snapshot.state.game.largestArmy.playerId,holder);}
});
test('a bought victory point immediately wins at ten; off-turn points do not win',()=>{
 let g=fixture();g.snapshot.state.board.buildings=Array.from({length:5},(_,i)=>({id:'home'+i,playerId:'a',type:i<4?'city':'settlement',vertex:getHexVertices(g.snapshot.state.board.tiles[i*3].coord)[0]}));
 // Explicit scoring fixture: four cities and one settlement = nine points.
 fund(g,'a','ore',1);fund(g,'a','grain',1);fund(g,'a','wool',1);g.snapshot.deck=['victoryPoint'];g=act(g,'a',{type:'BUY_DEVELOPMENT_CARD'});assert.equal(g.snapshot.state.game.phase,'ended');assert.equal(g.snapshot.state.game.winnerId,'a');assert.equal(score(g.snapshot.state,'a',true),10);
 g=fixture();g.snapshot.state.board.buildings=Array.from({length:6},(_,i)=>({id:'home'+i,playerId:'b',type:i<4?'city':'settlement',vertex:getHexVertices(g.snapshot.state.board.tiles[i*3].coord)[0]}));updateScores(g.snapshot.state);assert.notEqual(g.snapshot.state.game.phase,'ended');
});
test('Year of Plenty rejects two equal cards when only one remains, without consuming the card',()=>{
 let g=fixture();card(g,'yearOfPlenty');fund(g,'b','ore',18);const before=structuredClone(g);
 assert.throws(()=>act(g,'a',{type:'PLAY_YEAR_OF_PLENTY',resources:['ore','ore']}));assert.deepEqual(g,before);
 g=act(g,'a',{type:'PLAY_YEAR_OF_PLENTY',resources:['ore','brick']});assert.equal(players(g)[0].resources.ore,1);assert.equal(players(g)[0].resources.brick,1);
});
test('Monopoly takes only the chosen resource from every opponent and one action card blocks the next',()=>{
 let g=fixture();card(g,'monopoly');card(g,'knight');fund(g,'b','ore',3);fund(g,'bot:2','ore',2);fund(g,'b','wool',1);
 g=act(g,'a',{type:'PLAY_MONOPOLY',resource:'ore'});assert.deepEqual(players(g).map(p=>p.resources.ore),[5,0,0]);assert.equal(players(g)[1].resources.wool,1);
 const before=structuredClone(g);assert.throws(()=>act(g,'a',{type:'PLAY_KNIGHT'}));assert.deepEqual(g,before);
});
for(const level of ['easy','standard'])test(`${level} trade policy declines an unaffordable offer and does not read opponent secrets`,()=>{
 let g=fixture();fund(g,'a','ore',3);fund(g,'a','wool',1);fund(g,'b','ore',1);fund(g,'b','wool',3);g=act(g,'a',{type:'TRADE_OFFER',to:'bot:2',give:{ore:2},receive:{brick:1}});
 const view=module.view(g,'bot:2');assert.equal(botDecision(view,level).type,'TRADE_DECLINE');
 const changed=structuredClone(g);players(changed)[0].resources.ore--;players(changed)[0].resources.wool++;players(changed)[1].resources.ore++;players(changed)[1].resources.wool--;assert.deepEqual(module.view(changed,'bot:2'),view);assert.deepEqual(botDecision(module.view(changed,'bot:2'),level),botDecision(view,level));
});
