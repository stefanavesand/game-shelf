import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
import {botDecision,RESOURCES} from '../../play/catan/rules/index.js';
import {score} from '../../play/catan/rules/scoring.js';
import {template,validateProfile} from '../../scripts/bots/profiles.mjs';
import {decision,discardCandidates,opponentTotals} from '../../scripts/bots/resource-policy.mjs';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),profile=validateProfile(template('resource','resource-heuristic-0.1.0')),p=profile.parameters;
function prepared(held={},peers=[{},{}]){
 let state=module.initialize(catanConfig(['p0','p1','p2'].map(id=>({id,name:id})),{seed:37}),{gameId:'resource-probe'});
 for(let i=0;i<12;i++){const id=state.snapshot.state.game.currentPlayerId;state=module.apply(state,id,{actor:id,action:botDecision(module.view(state,id),'standard')},{},{coordinatorId:'p0'});}
 Object.assign(state.snapshot.state.game,{phase:'main',currentPlayerId:'p0',turn:10,lastRoll:{die1:3,die2:3,total:6}});
 for(const [i,hand] of [held,...peers].entries())for(const r of RESOURCES){const q=state.snapshot.state.players.players[i];state.snapshot.state.game.bank[r]+=q.resources[r]-(hand[r]||0);q.resources[r]=hand[r]||0;}
 return state;
}
function card(state,type){const q=state.snapshot.state.players.players[0];q.developmentCards.push({id:'test-'+type,type,turnBought:0,isPlayed:false});const index=state.snapshot.deck.indexOf(type);assert.ok(index>=0);state.snapshot.deck.splice(index,1);state.snapshot.state.game.developmentDeckCount--;return state;}
const commit=(state,action)=>module.apply(state,'p0',{actor:'p0',action},{},{coordinatorId:'p0'});
test('discard search preserves a complete city hand and uses ordinary discard validation',()=>{
 const state=prepared({ore:3,grain:2,wool:5});Object.assign(state.snapshot.state.game,{phase:'discard',currentPlayerId:'p1',pendingDiscard:['p0'],discardAmounts:{p0:5}});
 const view=module.view(state,'p0'),before=structuredClone(view),result=decision(view,p,37);assert.equal(result.action.type,'DISCARD_RESOURCES');
 const hand=commit(state,result.action).snapshot.state.players.players[0].resources;assert.equal(hand.ore,3);assert.equal(hand.grain,2);assert.equal(hand.wool,0);assert.ok(commit(state,botDecision(view,'standard')).snapshot.state.players.players[0].resources.ore<3);assert.deepEqual(view,before);assert.ok(result.candidates<=p.maxDiscardCandidates);assert.ok(result.nodes<=p.maxDiscardCandidates*100+1);
});
test('discard generation stays bounded and every generated bundle passes the engine',()=>{
 const state=prepared({ore:10,grain:9,wool:8,brick:7,lumber:6});Object.assign(state.snapshot.state.game,{phase:'discard',pendingDiscard:['p0'],discardAmounts:{p0:20}});
 const q={...p,maxDiscardCandidates:8},result=discardCandidates(module.view(state,'p0'),q);assert.ok(result.candidates.length>0&&result.candidates.length<=8);
 for(const c of result.candidates)commit(state,c.action);
});
test('Year of Plenty evaluates the complete pair and enables an immediate winning city',()=>{
 const state=card(prepared({ore:2,grain:1}),'yearOfPlenty');state.snapshot.state.game.settings.victoryPoints=score(state.snapshot.state,'p0',true)+1;
 const v=module.view(state,'p0'),d=decision(v,p,37);assert.equal(d.action.type,'PLAY_YEAR_OF_PLENTY');assert.deepEqual([...d.action.resources].sort(),['grain','ore']);assert.equal(d.reason,'RESOURCE_CARD_ENABLES_WIN');assert.ok(module.view(commit(state,d.action),'p0').choices.some(a=>a.type==='BUILD_CITY'));
});
test('a resource card is held before rolling and after a low-value decision',()=>{
 const state=card(prepared(),'yearOfPlenty');Object.assign(state.snapshot.state.game,{phase:'roll',lastRoll:null});assert.equal(decision(module.view(state,'p0'),p,37).action.type,'ROLL_DICE');
 state.snapshot.state.game.phase='main';state.snapshot.state.game.lastRoll={die1:3,die2:3,total:6};const d=decision(module.view(state,'p0'),{...p,resourceCardThreshold:1},37);assert.notEqual(d.action.type,'PLAY_YEAR_OF_PLENTY');assert.equal(d.reason,'RETAIN_RESOURCE_CARD');
});
test('Monopoly uses only a visible exact aggregate and skips an empty preferred resource',()=>{
 const state=card(prepared({grain:1,wool:1},[{wool:4},{wool:4}]),'monopoly'),v=module.view(state,'p0'),d=decision(v,p,37);assert.equal(opponentTotals(v).wool,8);assert.equal(opponentTotals(v).ore,0);assert.equal(botDecision(v,'standard').resource,'ore');assert.equal(d.action.type,'PLAY_MONOPOLY');assert.equal(d.action.resource,'wool');assert.equal(commit(state,d.action).snapshot.state.players.players[0].resources.wool,9);
});
test('hidden-hand permutations preserve Monopoly decisions; hidden/inconsistent bank disables inference',()=>{
 const a=card(prepared({},[{ore:3,wool:1},{ore:1,wool:3}]),'monopoly'),b=structuredClone(a);[b.snapshot.state.players.players[1].resources,b.snapshot.state.players.players[2].resources]=[b.snapshot.state.players.players[2].resources,b.snapshot.state.players.players[1].resources];
 const av=module.view(a,'p0'),bv=module.view(b,'p0');assert.deepEqual(av,bv);assert.deepEqual(decision(av,p,37),decision(bv,p,37));
 av.state.game.settings.hideBankCards=true;assert.equal(opponentTotals(av),null);assert.notEqual(decision(av,p,37).action.type,'PLAY_MONOPOLY');
 bv.state.game.bank.ore=19;assert.equal(opponentTotals(bv),null);
});
test('newly purchased and already-played cards stay unavailable and stale choices are rejected',()=>{
 const state=card(prepared(),'yearOfPlenty');state.snapshot.state.players.players[0].developmentCards[0].turnBought=10;const v=module.view(state,'p0');assert.deepEqual(decision(v,p,37).action,botDecision(v,'standard'));
 v.choices.push({type:'PLAY_YEAR_OF_PLENTY',resources:['ore','ore']});assert.throws(()=>decision(v,p,37),/Stale/);
});
test('unrelated actions and incoming trade responses retain the frozen heuristic behavior',()=>{
 const state=prepared({wool:3,grain:2,ore:2},[{ore:1},{}]),view=module.view(state,'p0');assert.deepEqual(decision(view,p,37).action,botDecision(view,'standard'));
 state.snapshot.state.game.currentPlayerId='p1';const offered=module.apply(state,'p1',{actor:'p1',action:{type:'TRADE_OFFER',to:'p0',give:{ore:1},receive:{wool:2}}},{},{coordinatorId:'p0'}),v=module.view(offered,'p0');assert.deepEqual(decision(v,p,37).action,botDecision(v,'standard'));
});
test('resource work parameters are complete, immutable and reject fractional/unknown controls',()=>{
 assert.ok(Object.isFrozen(profile.parameters));for(const mutate of [q=>q.parameters.maxDiscardCandidates=8.5,q=>q.parameters.allowResourceCardBeforeRoll=2,q=>q.parameters.extra=1]){const q=template('bad','resource-heuristic-0.1.0');mutate(q);assert.throws(()=>validateProfile(q));}
});
test('immediately winning builds take priority and a depleted bank excludes duplicate choices',()=>{
 const ready=card(prepared({ore:3,grain:2}),'yearOfPlenty');ready.snapshot.state.game.settings.victoryPoints=score(ready.snapshot.state,'p0',true)+1;
 const d=decision(module.view(ready,'p0'),p,37);assert.equal(d.action.type,'BUILD_CITY');assert.equal(commit(ready,d.action).snapshot.state.game.phase,'ended');
 const scarce=card(prepared({ore:2,grain:2},[{ore:16},{}]),'yearOfPlenty');scarce.snapshot.state.game.settings.victoryPoints=score(scarce.snapshot.state,'p0',true)+1;
 const v=module.view(scarce,'p0'),a=decision(v,p,37).action;assert.equal(a.type,'PLAY_YEAR_OF_PLENTY');assert.ok(a.resources.filter(r=>r==='ore').length<=1);commit(scarce,a);
 v.choices.push({type:'PLAY_YEAR_OF_PLENTY',resources:['ore','ore']});assert.throws(()=>decision(v,p,37),/Stale/);
});
test('played-card flags and frozen inputs remain respected',()=>{
 const state=card(prepared({ore:2,grain:1}),'yearOfPlenty'),v=module.view(state,'p0'),before=structuredClone(v);
 function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;}decision(freeze(v),p,37);assert.deepEqual(v,before);
 state.snapshot.state.players.players[0].hasPlayedDevCard=true;state.snapshot.state.game.devCardPlayedThisTurn=true;const played=module.view(state,'p0');assert.deepEqual(decision(played,p,37).action,botDecision(played,'standard'));
 const bad=template('bad','resource-heuristic-0.1.0');bad.level='easy';assert.throws(()=>validateProfile(bad),/no calibrated/);
});
test('whole-hand Year of Plenty scoring avoids duplicate original deficits without a win override',()=>{
 const state=card(prepared({ore:2,grain:1}),'yearOfPlenty'),view=module.view(state,'p0'),legacy=botDecision(view,'standard'),result=decision(view,p,37);
 assert.equal(legacy.type,'PLAY_YEAR_OF_PLENTY');assert.deepEqual(legacy.resources,['wool','wool']);assert.equal(result.reason,'IMPROVE_WHOLE_HAND');assert.deepEqual([...result.action.resources].sort(),['grain','ore']);commit(state,result.action);
});
test('an already affordable development purchase can beat a speculative resource-card gain',()=>{
 const state=card(prepared({ore:1,grain:1,wool:1},[{brick:1},{}]),'monopoly');
 const result=decision(module.view(state,'p0'),{...p,developmentValue:1},37);assert.equal(result.action.type,'BUY_DEVELOPMENT_CARD');assert.equal(result.reason,'RETAIN_RESOURCE_CARD');
});
test('another development card cannot mask a resource-enabled win and variant banks stay unsupported',()=>{
 const state=card(card(prepared({ore:2,grain:1}),'yearOfPlenty'),'knight');state.snapshot.state.game.settings.victoryPoints=score(state.snapshot.state,'p0',true)+1;
 const d=decision(module.view(state,'p0'),p,37);assert.equal(d.action.type,'PLAY_YEAR_OF_PLENTY');assert.equal(d.reason,'RESOURCE_CARD_ENABLES_WIN');
 const v=module.view(state,'p0');v.state.game.mode='unsupported-variant';assert.equal(opponentTotals(v),null);
});
test('natural rule-driven resource games complete and reproduce audited outcomes',{timeout:30000},async()=>{
 const {runMatch}=await import('../../scripts/bots/match.mjs'),{auditResourceMatch}=await import('../../scripts/bots/resource-audit.mjs'),baseline=validateProfile(template('baseline','heuristic-1.1.0'));
 const row=runMatch({job:{id:'resource-natural',caseId:'resource-natural',gameSeed:37,rotation:0,repeat:0,roster:'three-resource',profiles:['resource','baseline','baseline']},profiles:[profile,baseline,baseline],maxActions:2500,decisionSeed:92831});assert.equal(row.status,'ended',row.reason);
 const audit=auditResourceMatch(row,'resource');assert.ok(audit.discards>0);assert.equal(audit.yearOfPlentyBeforeRoll,0);assert.equal(audit.monopolyBeforeRoll,0);assert.equal(audit.zeroYieldMonopoly,0);assert.throws(()=>auditResourceMatch({...row,finalStateHash:'corrupt'},'resource'),/final-state mismatch/);
});
