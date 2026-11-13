import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {template,validateProfile,decideWithMemory} from '../../scripts/bots/profiles.mjs';
import {decision as previous} from '../../scripts/bots/build-trade-policy.mjs';
import {decision} from '../../scripts/bots/build-trade-components.mjs';
import {generateGoals} from '../../scripts/bots/shared-plan-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('counter','build-trade-0.2.0')),p={...profile.parameters,switchMargin:2,tradeLeaderPenalty:0};
const bundle=h=>Object.fromEntries(RESOURCES.map(r=>[r,h[r]||0]));
function prepared(){let s=module.initialize(catanConfig([0,1,2].map(i=>({id:'p'+i,name:'Seat '+(i+1)})),{seed:37}),{gameId:'counter-gate-test'});
 for(let i=0;i<12;i++){const actor=s.snapshot.state.game.currentPlayerId;s=module.apply(s,actor,{actor,action:botDecision(module.view(s,actor),'standard')},{},{coordinatorId:'p0'});}
 Object.assign(s.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10});s.snapshot.history=[{revision:s.snapshot.revision,playerId:'p2',message:'end turn'}];
 for(const [i,h]of [{ore:2,grain:2,wool:3},{ore:2,grain:1},{ore:1}].entries())for(const r of RESOURCES){const q=s.snapshot.state.players.players[i];s.snapshot.state.game.bank[r]+=q.resources[r]-(h[r]||0);q.resources[r]=h[r]||0;}return s;}
const view=s=>module.view(s,'p0'),apply=(s,id,a)=>module.apply(s,id,{actor:id,action:a},{},{coordinatorId:'p0'});
const goal=s=>generateGoals(view(s),p).goals.find(g=>g.kind==='city'),memory=g=>({schemaVersion:1,goalKey:g.key});
function offered(s,give,receive){return apply(s,'p1',{type:'TRADE_OFFER',to:'p0',give:bundle(give),receive:bundle(receive)});}
test('counter on is exactly delegated; off produces an engine-valid decline and retains goal',()=>{
 let s=prepared(),g=goal(s);s=offered(s,{grain:1},{ore:1});const v=view(s),before=structuredClone(v),m=memory(g),on=decision(v,p,37,m),old=previous(v,p,37,m);assert.deepEqual(on,old);assert.equal(on.action.type,'TRADE_OFFER');assert.ok(on.action.replaces);
 const off=decision(v,{...p,enableCounterOffers:0},37,m);assert.equal(off.action.type,'TRADE_DECLINE');assert.equal(off.reason,'COUNTER_DISABLED');assert.deepEqual(off.memory,on.memory);assert.equal(off.diagnostics.plan.key,g.key);assert.deepEqual(off.diagnostics.nextStep,off.action);assert.equal(off.diagnostics.tradeGain,undefined);apply(s,'p0',off.action);assert.deepEqual(v,before);
});
test('flag does not disable useful acceptance, ordinary proposals or construction',()=>{
 let s=prepared(),g=goal(s),m=memory(g);for(const v of [view(s),view(offered(s,{ore:1},{wool:1}))])assert.deepEqual(decision(v,p,37,m),decision(v,{...p,enableCounterOffers:0},37,m));
 const accepted=decision(view(offered(s,{ore:1},{wool:1})),{...p,enableCounterOffers:0},37,m);assert.equal(accepted.action.type,'TRADE_ACCEPT');
 s=offered(s,{ore:1},{wool:1});s=apply(s,'p0',accepted.action);assert.equal(decision(view(s),{...p,enableCounterOffers:0},37,m).action.type,'BUILD_CITY');
});
test('strict flag and scoped memory reject invalid and cross-profile input',()=>{
 for(const n of [-1,.5,2]){const bad=template('bad','build-trade-0.2.0');bad.parameters.enableCounterOffers=n;assert.throws(()=>validateProfile(bad));}
 const s=prepared(),v=view(s),on=decideWithMemory(v,profile,37),off=structuredClone(profile);off.parameters.enableCounterOffers=0;assert.throws(()=>decideWithMemory(v,validateProfile(off),37,on.memory));assert.deepEqual(decideWithMemory(v,profile,37,JSON.parse(JSON.stringify(on.memory))).action,on.action);
});
test('natural on cohort matches immutable previous policy; off has no replacement offers',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),base=validateProfile(template('baseline','heuristic-1.1.0')),old=template('counter','build-trade-0.1.0'),off=structuredClone(profile);off.parameters.enableCounterOffers=0;
 const job={id:'counter-natural',caseId:'counter-natural',gameSeed:37,rotation:0,repeat:0,roster:'three',profiles:['counter','baseline','baseline']},run=focal=>runMatch({job,profiles:[focal,base,base],maxActions:2500,decisionSeed:92831});
 const a=run(profile),b=run(validateProfile(old)),c=run(validateProfile(off)),d=run(validateProfile(off));for(const r of [a,b,c,d])assert.equal(r.status,'ended',r.reason);
 for(const k of ['traceHash','planTraceHash','finalStateHash','winnerSeat']){assert.equal(a[k],b[k]);assert.equal(c[k],d[k]);}
 assert.ok(a.trace.some(c=>c.actor==='p0'&&c.action.replaces));assert.ok(c.trace.every(c=>c.actor!=='p0'||!c.action.replaces));
});
