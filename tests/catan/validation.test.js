import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {applyTurn} from '../../play/catan/rules/turn.js';
import {score,updateScores,roadLength} from '../../play/catan/rules/scoring.js';
import {getHexVertices,getHexEdges,getEdgeVertices,getVertexEdges,edgeKey,vertexKey} from '../../play/catan/rules/geometry.js';
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
 for(const [size,holder] of [[2,'b'],[3,'a']]){g=fixture();card(g,'knight');players(g)[0].armySize=size;players(g)[1].armySize=3;g.snapshot.state.game.largestArmy={playerId:'b',value:3};g=act(g,'a',{type:'PLAY_KNIGHT'});assert.equal(g.snapshot.state.game.largestArmy.playerId,holder);assert.equal(score(g.snapshot.state,holder),2);assert.equal(score(g.snapshot.state,holder==='a'?'b':'a'),0);}
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

test('Road Building gives two free placements before rolling and cannot grant a third road',()=>{
 let g=fixture();card(g,'roadBuilding');const s=g.snapshot.state,p=players(g)[0];s.game.phase='roll';s.game.lastRoll=null;s.board.buildings=[{playerId:'a',type:'settlement',vertex:getHexVertices(s.board.tiles[0].coord)[0]}];p.settlementsRemaining--;
 const resources=structuredClone(p.resources);g=act(g,'a',{type:'PLAY_ROAD_BUILDING'});assert.equal(g.snapshot.state.game.roadBuildingRemaining,2);
 for(let i=0;i<2;i++){const move=module.view(g,'a').choices.find(c=>c.type==='BUILD_ROAD');assert.ok(move);g=act(g,'a',move);assert.deepEqual(players(g)[0].resources,resources);}
 assert.equal(g.snapshot.state.board.roads.length,2);assert.equal(players(g)[0].roadsRemaining,13);assert.equal(g.snapshot.state.game.phase,'roll');assert.ok(module.view(g,'a').choices.some(c=>c.type==='ROLL_DICE'));
 const before=structuredClone(g);assert.throws(()=>act(g,'a',{type:'BUILD_ROAD',edge:getHexEdges(s.board.tiles[0].coord)[2]}));assert.deepEqual(g,before);
});
test('Road Building stops after one placement when only one road piece remains',()=>{
 let g=fixture();card(g,'roadBuilding');g.snapshot.state.game.lastRoll={die1:2,die2:3,total:5};g.snapshot.state.board.buildings=[{playerId:'a',type:'settlement',vertex:getHexVertices(g.snapshot.state.board.tiles[0].coord)[0]}];players(g)[0].roadsRemaining=1;
 // Isolated piece-limit fixture, not a natural fourteen-road construction trace.
 g=act(g,'a',{type:'PLAY_ROAD_BUILDING'});assert.equal(g.snapshot.state.game.roadBuildingRemaining,1);g=act(g,'a',module.view(g,'a').choices.find(c=>c.type==='BUILD_ROAD'));
 assert.equal(players(g)[0].roadsRemaining,0);assert.equal(g.snapshot.state.game.roadBuildingRemaining,0);assert.equal(g.snapshot.state.game.phase,'main');
});
test('a pre-roll Knight requires a new tile and an eligible victim, then restores the roll phase',()=>{
 let g=fixture();card(g,'knight');g.snapshot.state.game.phase='roll';g.snapshot.state.game.lastRoll=null;
 const s=g.snapshot.state,tile=s.board.tiles.find(t=>t.coord.q!==s.board.robberLocation.q||t.coord.r!==s.board.robberLocation.r);s.board.buildings=[{playerId:'b',type:'settlement',vertex:getHexVertices(tile.coord)[0]}];fund(g,'b','brick',3);
 g=act(g,'a',{type:'PLAY_KNIGHT'});let before=structuredClone(g);assert.throws(()=>act(g,'a',{type:'MOVE_ROBBER',hex:g.snapshot.state.board.robberLocation}));assert.deepEqual(g,before);
 g=act(g,'a',{type:'MOVE_ROBBER',hex:tile.coord});assert.equal(g.snapshot.state.game.phase,'robber-steal');before=structuredClone(g);
 for(const action of [{type:'STEAL_RESOURCE',victimId:'a'},{type:'STEAL_RESOURCE',victimId:'bot:2'},{type:'SKIP_STEAL'}]){assert.throws(()=>act(g,'a',action));assert.deepEqual(g,before);}
 const bank=structuredClone(g.snapshot.state.game.bank);g=act(g,'a',{type:'STEAL_RESOURCE',victimId:'b'});assert.equal(players(g)[0].resources.brick,1);assert.equal(players(g)[1].resources.brick,2);assert.deepEqual(g.snapshot.state.game.bank,bank);assert.equal(g.snapshot.state.game.phase,'roll');
});
test('a Knight on an empty tile needs no victim and still leaves a pre-roll player needing to roll',()=>{
 let g=fixture();card(g,'knight');g.snapshot.state.game.phase='roll';g.snapshot.state.game.lastRoll=null;const prior=g.snapshot.state.board.robberLocation;
 const tile=g.snapshot.state.board.tiles.find(t=>t.coord.q!==prior.q||t.coord.r!==prior.r);g=act(g,'a',{type:'PLAY_KNIGHT'});g=act(g,'a',{type:'MOVE_ROBBER',hex:tile.coord});assert.equal(g.snapshot.state.game.phase,'roll');assert.equal(players(g)[0].armySize,1);
});
test('three two-edge road arms count as a four-edge trail, not six connected pieces',()=>{
 const g=fixture(),s=g.snapshot.state,center=getHexVertices({q:0,r:0})[0],used=new Set([vertexKey(center)]),roads=[];
 const first=getVertexEdges(center);for(const edge of first){const end=getEdgeVertices(edge).find(v=>vertexKey(v)!==vertexKey(center));used.add(vertexKey(end));roads.push({playerId:'a',edge});}
 for(const edge of first){const end=getEdgeVertices(edge).find(v=>vertexKey(v)!==vertexKey(center));const second=getVertexEdges(end).find(e=>edgeKey(e)!==edgeKey(edge)&&getEdgeVertices(e).some(v=>!used.has(vertexKey(v))));assert.ok(second);for(const v of getEdgeVertices(second))used.add(vertexKey(v));roads.push({playerId:'a',edge:second});}
 assert.equal(used.size,7);s.board.roads=roads;assert.equal(roadLength(s,'a'),4);updateScores(s);assert.equal(s.game.longestRoad,null);
});
test('a closed six-road loop counts each road exactly once',()=>{
 const s=fixture().snapshot.state;s.board.roads=getHexEdges({q:0,r:0}).map(edge=>({playerId:'a',edge}));assert.equal(roadLength(s,'a'),6);updateScores(s);assert.deepEqual(s.game.longestRoad,{playerId:'a',value:6});
});
test('a tie has no Longest Road holder unless an existing holder is part of that tie',()=>{
 const s=fixture().snapshot.state,coords=[{q:-2,r:0},{q:2,r:0},{q:0,r:-2}],ids=['a','b','bot:2'];
 s.board.roads=coords.flatMap((coord,i)=>getHexEdges(coord).slice(0,5).map(edge=>({playerId:ids[i],edge})));updateScores(s);assert.equal(s.game.longestRoad,null);
 s.game.longestRoad={playerId:'a',value:5};const ring=getHexEdges(coords[0]),middle=getEdgeVertices(ring[1]).find(v=>getEdgeVertices(ring[2]).some(w=>vertexKey(v)===vertexKey(w)));s.board.buildings=[{playerId:'b',type:'settlement',vertex:middle}];updateScores(s);assert.equal(s.game.longestRoad,null);assert.equal(score(s,'b'),1);
});
test('a player reaching ten off-turn wins when their own turn begins, before rolling',()=>{
 let g=fixture();const s=g.snapshot.state;s.players.turnOrder=['a','b','bot:2'];s.board.roads=getHexEdges({q:0,r:0}).slice(0,5).map(edge=>({playerId:'b',edge}));s.board.buildings=Array.from({length:4},(_,i)=>({playerId:'b',type:'city',vertex:getHexVertices(s.board.tiles[i*3].coord)[0]}));players(g)[1].citiesRemaining=0;players(g)[1].roadsRemaining=10;
 updateScores(s);assert.equal(score(s,'b'),10);assert.equal(s.game.phase,'main');g=act(g,'a',{type:'END_TURN'});assert.equal(g.snapshot.state.game.currentPlayerId,'b');assert.equal(g.snapshot.state.game.winnerId,'b');assert.equal(g.snapshot.state.game.phase,'ended');assert.equal(g.snapshot.state.game.lastRoll,null);
});

for(const [type,action]of [['knight',{type:'PLAY_KNIGHT'}],['roadBuilding',{type:'PLAY_ROAD_BUILDING'}],['yearOfPlenty',{type:'PLAY_YEAR_OF_PLENTY',resources:['ore','brick']}],['monopoly',{type:'PLAY_MONOPOLY',resource:'wool'}]])test(`${type} cannot be played on its purchase turn but works on a later turn`,()=>{
 let g=fixture();g.snapshot.state.game.lastRoll={die1:2,die2:3,total:5};g.snapshot.state.board.buildings=[{playerId:'a',type:'settlement',vertex:getHexVertices({q:0,r:0})[0]}];players(g)[0].settlementsRemaining--;card(g,type);players(g)[0].developmentCards[0].turnBought=5;const before=structuredClone(g);
 assert.ok(!module.view(g,'a').choices.some(c=>c.type===action.type));assert.throws(()=>act(g,'a',action));assert.deepEqual(g,before);
 players(g)[0].developmentCards[0].turnBought=1;assert.ok(module.view(g,'a').choices.some(c=>c.type===action.type));g=act(g,'a',action);assert.equal(players(g)[0].developmentCards[0].isPlayed,true);assert.equal(players(g)[0].hasPlayedDevCard,true);assert.equal(g.snapshot.state.game.devCardPlayedThisTurn,true);
});
