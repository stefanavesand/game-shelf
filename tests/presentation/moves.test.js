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

test('motion lab clips use ordinary engine commands and valid consecutive private views',async()=>{
 const {scenario}=await import('../../prototype/motion-lab/scenarios.js');const {motionSettings,MOTION_DEFAULTS}=await import('../../play/presentation/motion-settings.js');
 for(const clip of ['roll','road','settlement','city','robber']){const {before,after}=scenario(clip);assert.equal(after.revision,before.revision+1);assert.ok(describeMove(before,after));}
 assert.deepEqual(motionSettings(),MOTION_DEFAULTS);assert.equal(motionSettings({diceMs:Infinity}).diceMs,1200);assert.equal(motionSettings({diceMs:-20}).diceMs,200);assert.equal(motionSettings({diceRotation:5000}).diceRotation,1080);
});
