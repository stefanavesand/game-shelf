import {decideBot} from '../../play/bots/decision.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {landEdges} from '../../play/catan/rules/board.js';
import {getEdgeVertices,edgeKey,vertexKey} from '../../play/catan/rules/geometry.js';
import {validSetupSettlements} from '../../play/catan/rules/setup.js';
import {setupRoadCandidates,decision} from '../../scripts/bots/shared-plan-policy.mjs';
import {profile} from '../../play/bots/profile.js';
const module=createCatanModule('setup-probe'),p=profile.parameters;
function trapped(){
 let s=module.initialize(catanConfig(['a','b','c'].map(id=>({id,name:id})),{seed:37}),{gameId:'setup-probe'});
 s.snapshot.state.game.currentPlayerId='a';s.snapshot.state.players.turnOrder=['a','b','c'];
 const a={hex:{q:0,r:0},direction:'N'},edges=landEdges(s.snapshot.state),incident=v=>edges.filter(e=>getEdgeVertices(e).some(w=>vertexKey(w)===vertexKey(v)));
 const edge=incident(a).find(e=>{const b=getEdgeVertices(e).find(v=>vertexKey(v)!==vertexKey(a));return incident(b).length===3;}),b=getEdgeVertices(edge).find(v=>vertexKey(v)!==vertexKey(a)),blocking=incident(b).filter(e=>edgeKey(e)!==edgeKey(edge));
 s=module.apply(s,'a',{actor:'a',action:{type:'PLACE_SETTLEMENT',vertex:a}},{},{coordinatorId:'a'});
 blocking.forEach((e,i)=>{const id=['b','c'][i],vertex=getEdgeVertices(e).find(v=>vertexKey(v)!==vertexKey(b));s.snapshot.state.board.buildings.push({playerId:id,vertex,type:'settlement'});s.snapshot.state.board.roads.push({playerId:id,edge:e});});
 // The occupied ends are two edges from our start, so the distance rule permits it.
 const withoutOwn={...s.snapshot.state,board:{...s.snapshot.state.board,buildings:s.snapshot.state.board.buildings.filter(b=>b.playerId!=='a')}};
 assert.ok(validSetupSettlements(withoutOwn).some(v=>vertexKey(v)===vertexKey(a)));
 return {s,edge};
}
test('setup roads avoid an engine-legal cul-de-sac enclosed by opponent roads',async()=>{
 const {s,edge}=trapped(),view=module.view(s,'a'),ranked=setupRoadCandidates(view,p),dead=ranked.find(c=>edgeKey(c.action.edge)===edgeKey(edge));
 assert.ok(dead);assert.equal(dead.sites,0);assert.ok(ranked[0].sites>0);
 const selected=decision(view,p,0);assert.equal(selected.reason,'SETUP_ROAD_TO_REACHABLE_SITE');assert.notEqual(edgeKey(selected.action.edge),edgeKey(edge));
 const shipped=await decideBot(view);assert.notEqual(edgeKey(shipped.action.edge),edgeKey(edge));
 assert.doesNotThrow(()=>module.apply(s,'a',{actor:'a',action:shipped.action},{},{coordinatorId:'a'}));
 // A legal action is not necessarily a useful action: the engine accepts the trap.
 assert.doesNotThrow(()=>module.apply(s,'a',{actor:'a',action:dead.action},{},{coordinatorId:'a'}));
});
test('setup search is bounded, deterministic and does not mutate its observation',()=>{
 const {s}=trapped(),v=module.view(s,'a'),before=structuredClone(v),first=decision(v,p,0);
 assert.deepEqual(decision(v,p,99),first);assert.deepEqual(v,before);assert.ok(first.diagnostics.setupRoads.every(c=>c.nodes<=p.maxGraphNodes));
});
