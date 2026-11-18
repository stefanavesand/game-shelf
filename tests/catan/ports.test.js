import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {bankRate} from '../../play/catan/rules/board.js';
import {ownedPorts,displayedBankRate} from '../../play/trade.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
function prepared(){const g=module.initialize(catanConfig([{id:'red',name:'Red'}],{seed:37}),{gameId:'ports'}),s=g.snapshot.state;Object.assign(s.game,{phase:'main',currentPlayerId:'red',turn:4});const generic=s.board.ports.find(p=>p.type==='generic'),grain=s.board.ports.find(p=>p.type==='grain');s.board.buildings=[{playerId:'red',type:'settlement',vertex:generic.vertices[0]},{playerId:'red',type:'city',vertex:grain.vertices[1]}];return g;}
test('two owned ports supply both legal rates, independent of port order and building type',()=>{
 for(const reversed of [false,true]){let g=prepared(),s=g.snapshot.state;if(reversed)s.board.ports.reverse();for(const [r,n]of [['grain',2],['ore',3]]){s.players.players[0].resources[r]=n;s.game.bank[r]-=n;}
 assert.equal(bankRate(s,'red','grain'),2);assert.equal(bankRate(s,'red','ore'),3);const v=module.view(g,'red');assert.equal(ownedPorts(v).length,2);assert.equal(displayedBankRate(v,'grain'),2);assert.equal(displayedBankRate(v,'ore'),3);
 for(const [resource,amount]of [['grain',2],['ore',3]]){const action=module.view(g,'red').choices.find(a=>a.type==='BANK_TRADE'&&a.give.resource===resource&&a.give.amount===amount&&a.receive.resource==='brick');assert.ok(action);g=module.apply(g,'red',{actor:'red',action},{},{coordinatorId:'red'});}
 assert.equal(g.snapshot.state.players.players[0].resources.brick,2);
 }
});
test('ownership and rates remain visible without enough cards, without inventing legal exchanges',()=>{
 const g=prepared(),v=module.view(g,'red');assert.equal(ownedPorts(v).length,2);assert.equal(displayedBankRate(v,'grain'),2);assert.equal(displayedBankRate(v,'ore'),3);assert.equal(v.choices.some(a=>a.type==='BANK_TRADE'),false);
 g.snapshot.state.board.buildings=g.snapshot.state.board.buildings.filter(b=>b.type!=='settlement');const only=module.view(g,'red');assert.equal(displayedBankRate(only,'grain'),2);assert.equal(displayedBankRate(only,'ore'),4);
});
