import test from 'node:test';import assert from 'node:assert/strict';
import {updateTradeFeedback,canSupplyOffer,resolveUnavailableOffers,unavailableIncomingOffer} from '../../play/trade-feedback.js';
const offer={id:'offer',from:'a',to:'b',give:{ore:2},receive:{brick:1}};
const view=(revision,history=[],active=null)=>({id:'room',you:'a',revision,history,offer:active,seats:[{id:'a',name:'Alice'},{id:'b',name:'Bob'}],state:{players:{players:[{id:'a',resources:{brick:0,lumber:0,ore:3,grain:0,wool:0}}]}}});
test('an immediate bot response retains the exact proposed terms and survives reload without duplicate feedback',()=>{
 const v=view(12,[{revision:11,playerId:'a',message:'trade offer'},{revision:12,playerId:'b',message:'trade accept'}]);const outgoing={revision:11,...offer};let result=updateTradeFeedback(null,v,outgoing);assert.equal(result.added.length,1);assert.match(result.added[0].message,/2 Ore/);assert.match(result.added[0].message,/1 Brick/);result=updateTradeFeedback(JSON.parse(JSON.stringify(result.record)),v,outgoing);assert.equal(result.added.length,0);assert.equal(result.record.events.length,1);
});
test('a declined offer is not confused with a later accepted offer',()=>{
 let record=updateTradeFeedback(null,view(10,[],offer)).record;
 const v=view(15,[{revision:11,playerId:'b',message:'trade decline'},{revision:12,playerId:'a',message:'trade offer'},{revision:13,playerId:'b',message:'trade accept'}]);const r=updateTradeFeedback(record,v);assert.match(r.added[0].message,/declined/);assert.doesNotMatch(r.added[0].message,/accepted/);
});
test('history gaps produce an invalidation notice rather than inventing acceptance',()=>{
 const record=updateTradeFeedback(null,view(10,[],offer)).record;const r=updateTradeFeedback(record,view(50,[{revision:40,playerId:'b',message:'trade accept'}]));assert.match(r.added[0].message,/no longer active/);assert.doesNotMatch(r.added[0].message,/accepted/);
});
test('a cancelled offer is reported once and only own quantities determine supply eligibility',()=>{
 const v=view(10,[],offer);assert.equal(canSupplyOffer(v),false);v.state.players.players[0].resources.brick=1;assert.equal(canSupplyOffer(v),true);
 const record=updateTradeFeedback(null,v).record,r=updateTradeFeedback(record,view(11,[{revision:11,playerId:'a',message:'trade cancel'}]));assert.match(r.added[0].message,/cancelled/);assert.equal(updateTradeFeedback(r.record,view(11)).added.length,0);
});
test('a draft saved before submission recovers immediate acceptance after a lost reply and reload',()=>{
 const outgoing={revision:11,...offer},prepared=updateTradeFeedback(null,view(10),outgoing).record;
 const restored=JSON.parse(JSON.stringify(prepared)),v=view(12,[{revision:11,playerId:'a',message:'trade offer'},{revision:12,playerId:'b',message:'trade accept'}]);
 const result=updateTradeFeedback(restored,v);assert.match(result.added[0].message,/accepted/);assert.equal(updateTradeFeedback(result.record,v).added.length,0);
});
test('an older browser view cannot overwrite a newer pending offer tracker',()=>{
 const newer=updateTradeFeedback(null,view(20,[],offer)).record,older=updateTradeFeedback(newer,view(10,[],offer));assert.deepEqual(older.record,newer);assert.equal(older.added.length,0);
});
test('persisted public results recover all recipient responses even when every intermediate poll was missed',()=>{
 const v=view(20);v.trades=[{...offer,id:'all-offer',to:'all',recipients:['b','c'],responses:{b:'declined',c:'accepted'},status:'accepted',by:'c',revision:20}];v.seats.push({id:'c',name:'Carol'});
 const result=updateTradeFeedback(null,v);assert.equal(result.added.length,1);assert.match(result.added[0].message,/Carol accepted/);assert.match(result.added[0].message,/2 Ore/);assert.equal(updateTradeFeedback(JSON.parse(JSON.stringify(result.record)),v).added.length,0);
});


test('consecutive unaffordable offers are declined until an actionable offer arrives',async()=>{
 const offers=[{...offer,id:'first',from:'b',to:'a'},{...offer,id:'second',from:'b',to:'a'},{...offer,id:'third',from:'b',to:'a',receive:{ore:1}}];let index=0;const ids=[];
 const read=()=>view(index,[],offers[index]);await resolveUnavailableOffers(read,async id=>{ids.push(id);index++;return true;});
 assert.deepEqual(ids,['first','second']);assert.equal(canSupplyOffer(read()),true);
});
test('auto-decline stops on failed delivery, stale repeats, other recipients and a bounded chain',async()=>{
 let calls=0;const v=view(1,[],{...offer,to:'a'});assert.equal(unavailableIncomingOffer(v),true);
 await resolveUnavailableOffers(()=>v,async()=>{calls++;return false;});assert.equal(calls,1);
 calls=0;await resolveUnavailableOffers(()=>v,async()=>{calls++;return true;});assert.equal(calls,1);
 calls=0;await resolveUnavailableOffers(()=>view(1,[],offer),async()=>{calls++;});assert.equal(calls,0);
 let id=0;await resolveUnavailableOffers(()=>view(id,[],{...offer,id:String(id++),to:'a'}),async()=>true,3);assert.equal(id,3);
});
