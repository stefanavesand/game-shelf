import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovePacer,BOT_ACTION_MS,DICE_ACTION_MS} from '../../play/presentation/move-pacer.js';
import {describeMove} from '../../play/presentation/move-events.js';
import {createCatanModule,catanConfig} from '../../play/catan/module.js';
import {CATAN_ARTIFACT} from '../../play/catan/artifact.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId);
const initial=()=>module.initialize(catanConfig([{id:'a',name:'Alice'}],{solo:true,seed:42}),{gameId:'motion'});
const packet=g=>({ok:true,roomId:'motion',revision:g.snapshot.revision,you:'a',view:module.view(g,'a')});
test('UI advances at most one durable bot command per interval; refresh cannot bypass pacing',()=>{
 let time=1000;const pacer=createMovePacer({now:()=>time}),p={ok:true,roomId:'one',revision:4,view:{},botWorkPending:true};
 assert.equal(pacer.takeBudget(p),0);time+=BOT_ACTION_MS-1;assert.equal(pacer.takeBudget(p),0);time++;assert.equal(pacer.takeBudget(p),1);assert.equal(pacer.takeBudget(p),0);
 p.revision++;pacer.observe(p);assert.equal(pacer.remaining(p),BOT_ACTION_MS);time+=BOT_ACTION_MS;assert.equal(pacer.takeBudget({...p,botWorkPending:false}),0);assert.equal(pacer.takeBudget(p),1);
 pacer.reset();time+=30000;assert.equal(pacer.takeBudget(p),0);assert.equal(pacer.takeBudget({...p,roomId:'two'}),0);
});
test('consecutive authorized placement produces actor, piece and score; refresh and reconnect do not replay',()=>{
 const g=initial(),actor=g.snapshot.state.game.currentPlayerId,action=module.view(g,actor).choices[0],before=packet(g),next=module.apply(g,'a',{actor,action},{},{coordinatorId:'a'}),after=packet(next),event=describeMove(before,after);
 assert.ok(event.message.includes('placed a settlement'));assert.equal(event.actorId,actor);assert.equal(event.pieces[0].kind,'building');assert.equal(event.scores[0].amount,1);assert.deepEqual(event.cost,[]);
 assert.equal(describeMove(null,after),null);assert.equal(describeMove(after,after),null);assert.equal(describeMove(before,{...after,revision:after.revision+2}),null);assert.equal(describeMove(before,{...after,roomId:'other'}),null);assert.equal(describeMove(before,{...after,you:'other'}),null);
});
test('feedback uses own resource deltas and public build costs, never private opponent cards',()=>{
 const before=packet(initial()),after=structuredClone(before);after.revision++;after.view.revision++;const v=after.view,bot=v.state.players.players.find(p=>p.id!=='a');
 v.history=[{revision:after.revision,playerId:bot.id,message:'build city'}];v.state.players.players.find(p=>p.id==='a').resources.grain+=2;
 bot.resourceCount+=3;bot.devCardCount++;bot.victoryPoints+=1;
 const event=describeMove(before,after);assert.deepEqual(event.resources,[{resource:'grain',amount:2}]);assert.deepEqual(event.cost,[{resource:'ore',amount:3},{resource:'grain',amount:2}]);assert.equal(event.actorId,bot.id);assert.ok(!JSON.stringify(event).includes('developmentCards'));
 v.history[0].message='buy development card';assert.equal(describeMove(before,after).card,true);assert.deepEqual(describeMove(before,after).cost,[]);
 v.history[0].message='build road';before.view.state.game.phase='road-building';assert.deepEqual(describeMove(before,after).cost,[]);
 v.history[0].message='unknown future action';assert.equal(describeMove(before,after),null);
});

test('a roll reserves time for the full dice animation and a settled result',()=>{
 let time=0;const pacer=createMovePacer({now:()=>time}),p={ok:true,roomId:'dice',revision:9,view:{history:[{message:'roll dice'}]},botWorkPending:true};pacer.observe(p);assert.equal(pacer.remaining(p),DICE_ACTION_MS);time=1500;assert.equal(pacer.takeBudget(p),0);time=DICE_ACTION_MS;assert.equal(pacer.takeBudget(p),1);
});

test('motion fixtures use ordinary engine commands and valid consecutive private views',async()=>{
 const {scenario}=await import('../fixtures/motion-scenarios.js');const {motionSettings,MOTION_DEFAULTS}=await import('../../play/presentation/motion-settings.js');
 for(const clip of ['roll','road','settlement','city','robber']){const {before,after}=scenario(clip);assert.equal(after.revision,before.revision+1);assert.ok(describeMove(before,after));}
 assert.deepEqual(motionSettings(),MOTION_DEFAULTS);assert.equal(motionSettings({diceMs:Infinity}).diceMs,1100);assert.equal(motionSettings({diceMs:-20}).diceMs,200);assert.equal(motionSettings({diceRotation:5000}).diceRotation,1080);
});

test('the approved short gap cannot truncate long rolls, flights or piece moves',async()=>{
 const {motionInterval}=await import('../../play/presentation/motion-settings.js');
 assert.equal(motionInterval('ROLL_DICE'),3550);assert.equal(motionInterval('BUILD_SETTLEMENT'),2950);assert.equal(motionInterval('MOVE_ROBBER'),1700);assert.equal(motionInterval('END_TURN'),300);
 let time=0;const pacer=createMovePacer({now:()=>time}),p={ok:true,roomId:'long',revision:1,view:{history:[{message:'build settlement'}]},botWorkPending:true};pacer.observe(p);time=300;assert.equal(pacer.takeBudget(p),0);time=2949;assert.equal(pacer.takeBudget(p),0);time=2950;assert.equal(pacer.takeBudget(p),1);
});

test('trade responses wait a stable random 2–5 seconds without sleeping or rerolling on refresh',()=>{
 for(const [random,expected]of [[0,2000],[1,5000]]){let time=0,draws=0;const p={ok:true,roomId:'trade',revision:1,botWorkPending:true,view:{offer:{id:'offer'},history:[]}},pacer=createMovePacer({now:()=>time,random:()=>{draws++;return random;}});
  assert.equal(pacer.takeBudget(p),0);time=1000;assert.equal(pacer.remaining(p),expected-1000);assert.equal(draws,1);time=expected-1;assert.equal(pacer.takeBudget(p),0);time++;assert.equal(pacer.takeBudget(p),1);assert.equal(pacer.takeBudget(p),0);
  p.revision++;pacer.observe(p);assert.equal(pacer.remaining(p),expected);assert.equal(draws,2);
 }
});
test('only a sole mandatory legal theft is automatic',async()=>{
 const {automaticSteal}=await import('../../play/presentation/forced-action.js'),a={type:'STEAL_RESOURCE',victimId:'a'},v={state:{game:{phase:'robber-steal'}},choices:[a]};assert.deepEqual(automaticSteal(v),a);assert.equal(automaticSteal({...v,choices:[]}),null);assert.equal(automaticSteal({...v,choices:[a,{...a,victimId:'b'}]}),null);assert.equal(automaticSteal({...v,state:{game:{phase:'main'}}}),null);assert.equal(automaticSteal(null),null);
});

test('resource counts settle only after motion, without delaying authoritative state or restarting on polls',async()=>{
 const {createCountPresentation}=await import('../../play/presentation/counts.js'),{scenario}=await import('../fixtures/motion-scenarios.js'),{before,after}=scenario('roll');let time=0,notify=0,id=0;const timers=new Map(),p=createCountPresentation({now:()=>time,reduced:()=>false,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},clearTimer:i=>timers.delete(i),onChange:()=>notify++}),own=v=>v.state.players.players.find(x=>x.id===v.you).resources;
 const actual=structuredClone(after);p.observe(before);p.observe(after);assert.deepEqual(own(p.view()),own(before.view));assert.deepEqual(after,actual);assert.equal(p.pending(),true);const duration=p.remaining();time=1000;p.observe(after);assert.equal(timers.size,1);assert.equal(p.remaining(),duration-1000);time=duration-1;assert.deepEqual(own(p.view()),own(before.view));time++;for(const t of [...timers.values()])if(t.at<=time)t.fn();assert.deepEqual(own(p.view()),own(after.view));assert.equal(p.pending(),false);assert.equal(notify,1);
});
test('counter presentation catches up immediately on reconnect/reduced motion and cancels on leaving',async()=>{
 const {createCountPresentation}=await import('../../play/presentation/counts.js'),{scenario}=await import('../fixtures/motion-scenarios.js'),{before,after}=scenario('road');const reduced=createCountPresentation({reduced:()=>true});reduced.observe(before);reduced.observe(after);assert.deepEqual(reduced.view(),after.view);assert.equal(reduced.pending(),false);
 let canceled=0;const p=createCountPresentation({reduced:()=>false,setTimer:()=>1,clearTimer:()=>canceled++});p.observe(before);p.observe(after);assert.equal(p.pending(),true);p.observe(after,{enabled:false});assert.equal(canceled,1);p.observe(after);assert.deepEqual(p.view(),after.view);assert.equal(p.pending(),false);p.observe({...after,revision:after.revision+3});assert.equal(p.pending(),false);
});
test('recent game ordering combines modes, preserves input and has a stable legacy fallback',async()=>{
 const {recentGames}=await import('../../play/presentation/recent-games.js'),games=[{roomId:'a',mode:'solo',lastPlayedAt:10},{roomId:'b',mode:'friends',lastPlayedAt:30},{roomId:'c',lastPlayedAt:20}],copy=structuredClone(games);assert.deepEqual(recentGames(games,'a').map(g=>g.roomId),['b','c','a']);assert.deepEqual(games,copy);assert.deepEqual(recentGames([{roomId:'old'},{roomId:'current'},{roomId:'new'}],'current').map(g=>g.roomId),['current','new','old']);
});

test('actual animation completion overrides the clock estimate and an old completion cannot settle a new view',async()=>{
 const {createCountPresentation}=await import('../../play/presentation/counts.js'),{scenario}=await import('../fixtures/motion-scenarios.js'),{before,after}=scenario('roll');let time=0,finish,notified=0;const p=createCountPresentation({now:()=>time,reduced:()=>false,setTimer:()=>1,clearTimer:()=>{},onChange:()=>notified++});p.observe(before);p.observe(after);p.completeOn(after,new Promise(resolve=>finish=resolve));time=20000;p.observe(after);assert.equal(p.pending(),true);finish();await Promise.resolve();assert.equal(p.pending(),false);assert.equal(notified,1);assert.deepEqual(p.view(),after.view);
 let oldFinish;p.observe(before);p.observe(after);p.completeOn(after,new Promise(resolve=>oldFinish=resolve));const next={...after,roomId:'other'};p.observe(next);oldFinish();await Promise.resolve();assert.equal(p.view(),next.view);assert.equal(notified,1);
});


test('card presentation never holds back confirmed victory points',async()=>{
 const {createCountPresentation}=await import('../../play/presentation/counts.js'),{scenario}=await import('../fixtures/motion-scenarios.js'),{before,after}=scenario('city');
 const p=createCountPresentation({reduced:()=>false,setTimer:()=>1,clearTimer:()=>{}});p.observe(before);p.observe(after);
 assert.equal(p.pending(),true);
 for(const actual of after.view.state.players.players)assert.equal(p.view().state.players.players.find(x=>x.id===actual.id).victoryPoints,actual.victoryPoints);
});

test('reduced-motion resource counters still await the explicitly enabled dice animation',async()=>{
 const {createCountPresentation}=await import('../../play/presentation/counts.js'),{scenario}=await import('../fixtures/motion-scenarios.js'),{before,after}=scenario('roll');
 const p=createCountPresentation({reduced:()=>true,setTimer:()=>1,clearTimer:()=>{}});p.observe(before);p.observe(after);assert.equal(p.pending(),true);let finish;p.completeOn(after,new Promise(resolve=>finish=resolve));finish();await Promise.resolve();assert.equal(p.pending(),false);assert.deepEqual(p.view(),after.view);
});
