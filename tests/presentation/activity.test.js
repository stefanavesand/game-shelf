import test from 'node:test';
import assert from 'node:assert/strict';
import {createActivity,mergeActivity,ACTIVITY_LIMIT,activityMarkup} from '../../play/presentation/activity.js';
import {scoreBreakdowns} from '../../play/presentation/scores.js';
import {scenario} from '../fixtures/motion-scenarios.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
test('confirmed roll details survive end turn/reload and stay isolated by account',()=>{
 const db=storage(),{before,after}=scenario('roll'),journal=createActivity({principal:()=> 'alice',storage:db});journal.observe(before);const records=journal.observe(after),roll=records.at(-1);assert.equal(roll.roll.total,after.view.state.game.lastRoll.total);assert.ok(Object.keys(roll.gains).length);
 const ended=structuredClone(after);ended.revision++;ended.view.revision++;ended.view.state.game.lastRoll=null;ended.view.history.push({revision:ended.revision,playerId:ended.you,message:'end turn'});journal.observe(ended);
 const resumed=createActivity({principal:()=> 'alice',storage:db}).observe(ended);assert.deepEqual(resumed.find(e=>e.revision===roll.revision).roll,roll.roll);assert.deepEqual(resumed.find(e=>e.revision===roll.revision).gains,roll.gains);
 const other=createActivity({principal:()=> 'bob',storage:db}).observe(ended);assert.equal(other.find(e=>e.revision===roll.revision).roll,undefined);assert.deepEqual(other.find(e=>e.revision===roll.revision).gains||{},{});
 assert.ok(!journal.observe(before).some(e=>e.revision>before.revision));assert.equal(journal.observe(ended).length,resumed.length);
});
test('history ignores unavailable storage and malformed records, bounds entries and escapes text',()=>{
 const {before,after}=scenario('road'),broken={getItem(){return '[null,{"revision":4,"message":"<img onerror=evil>","roll":{"die1":4,"die2":3,"total":8},"scores":{},"gains":{"secret":7}}]';},setItem(){throw Error('quota');}},journal=createActivity({storage:broken});journal.observe(before);const records=journal.observe(after);assert.ok(records.some(e=>e.revision===after.revision));const html=activityMarkup(records);assert.ok(!html.includes('<img onerror'));assert.ok(html.includes('&lt;img onerror=evil&gt;'));assert.ok(!html.includes('Last roll 8'));
 const many=Array.from({length:ACTIVITY_LIMIT+30},(_,revision)=>({revision,message:'move'}));assert.equal(mergeActivity(many,null,after).length,ACTIVITY_LIMIT);
});
test('scores explain public awards and reveal opponents VP-card points only at game end',()=>{
 const v=scenario('city').before.view,opponent=v.state.players.players.find(p=>p.id!==v.you);v.state.game.longestRoad={playerId:opponent.id,value:5};v.state.game.largestArmy={playerId:opponent.id,value:3};opponent.developmentCards=[{type:'victoryPoint',isPlayed:false}];
 let scores=scoreBreakdowns(v),s=scores.find(p=>p.id===opponent.id);assert.equal(s.cards,null);assert.equal(s.road,2);assert.equal(s.army,2);
 v.state.game.phase='ended';v.state.game.finalScores=Object.fromEntries(scores.map(p=>[p.id,p.settlements+p.cities*2+p.road+p.army+2]));opponent.developmentCards=[];s=scoreBreakdowns(v).find(p=>p.id===opponent.id);assert.equal(s.cards,2);assert.equal(s.total,s.settlements+s.cities*2+s.road+s.army+s.cards);
});
