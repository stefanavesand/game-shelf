import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,auditMatch} from '../../scripts/bots/trade-audit.mjs';
import {runMatch} from '../../scripts/bots/match.mjs';
import {hash} from '../../scripts/bots/profiles.mjs';
test('offer-level denominators include failed, replaced and unresolved proposals',()=>{
 const offers=[{give:{ore:1},receive:{wool:2},affordableRecipients:0,status:'declined'},{give:{ore:1},receive:{wool:2},affordableRecipients:1,status:'accepted'},{give:{ore:2},receive:{wool:1},affordableRecipients:1,status:'replaced'},{give:{ore:1},receive:{wool:1},affordableRecipients:1,status:'waiting'}];
 const result=summarize(offers,[{acceptedTrade:true,investmentAfterTrade:true,unlockedTrades:1},{acceptedTrade:false,investmentAfterTrade:false,unlockedTrades:0}]);
 assert.equal(result.offers,4);assert.equal(result.resolved,3);assert.equal(result.unresolved,1);assert.equal(result.acceptanceRate,.25);assert.equal(result.offersPerOwnTurn,2);assert.equal(result.noRecipientCouldAfford,1);assert.equal(result.byRatio['1:2'].acceptanceRate,.5);assert.equal(result.acceptedTradeTurnsWithSubsequentInvestment,1);assert.equal(result.acceptedTradesUnlockingInvestment,1);assert.equal(summarize([],[]).acceptanceRate,null);
});
test('a complete ordinary-rule trace audits deterministically and rejects state corruption',{timeout:30000},()=>{
 const make=id=>({schemaVersion:1,id,policyVersion:'heuristic-1.1.0',featureSchemaVersion:1,level:'standard',parameters:{}}),profiles=[make('focal'),make('other'),make('other')];
 const job={id:'audit-fixture',caseId:'audit-fixture',gameSeed:37,rotation:0,repeat:0,roster:'three-standard',profiles:profiles.map(p=>p.id)},row=runMatch({job,profiles,maxActions:2500,decisionSeed:92831});assert.equal(row.status,'ended');
 const first=auditMatch(row,'focal');assert.deepEqual(auditMatch(row,'focal'),first);assert.ok(first.turns.length>0);assert.ok(first.offers.length>0);assert.equal(first.offers.length,row.trace.filter(c=>c.actor==='p0'&&c.action.type==='TRADE_OFFER').length);assert.ok(first.offers.every(o=>o.status!=='waiting'));assert.equal(first.incoming.accepted,row.trace.filter(c=>c.actor==='p0'&&c.action.type==='TRADE_ACCEPT').length);assert.ok(first.offers.every(o=>o.affordableRecipients>=0&&o.affordableRecipients<=o.recipients));
 const altered={...row,finalStateHash:hash({different:true})};assert.throws(()=>auditMatch(altered,'focal'),/final state differs/);
});
