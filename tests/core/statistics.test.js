import test from 'node:test';
import assert from 'node:assert/strict';
import {collectStatistics,careerStatistics} from '../../play/core/statistics.js';
import {statisticsMarkup} from '../../play/presentation/statistics.js';
const packet=(revision,history,{ended=false,won=false}={})=>({local:true,revision,view:{id:'game',you:'me',revision,seats:[],history,state:{game:{phase:ended?'ended':'main',winnerId:won?'me':'peer',finalScores:ended?{me:6}:undefined}}}});
const event=(revision,dice)=>({revision,playerId:'me',message:dice?'roll dice':'end turn',...(dice?{dice}:{})});
test('roll totals survive bounded history, reload and duplicate or stale observations',()=>{
 let stats=null;
 for(let i=1;i<=80;i++){const p=packet(i,Array.from({length:Math.min(i,30)},(_,n)=>event(i-Math.min(i,30)+n+1,[3,4]))),before=structuredClone(p);stats=collectStatistics(structuredClone(stats),p);assert.deepEqual(p,before);}
 assert.equal(stats.rolls,80);assert.equal(stats.counts[5],80);assert.equal(stats.complete,true);
 assert.deepEqual(collectStatistics(stats,packet(80,[event(80,[3,4])])),stats);
 assert.deepEqual(collectStatistics(stats,packet(10,[event(10,[1,1])])),stats);
});
test('missing events and legacy rolls are marked partial instead of invented',()=>{
 let stats=collectStatistics(null,packet(40,[event(39,[1,1]),event(40,[6,6])]));assert.equal(stats.complete,false);assert.equal(stats.rolls,2);
 stats=collectStatistics(null,packet(1,[{revision:1,message:'roll dice',playerId:'me'}]));assert.equal(stats.complete,false);assert.equal(stats.rolls,0);
 assert.match(statisticsMarkup(stats,[]),/Partial history/);
});
test('a confirmed current legacy roll can be counted once without guessing other rolls',()=>{
 const p=packet(1,[{revision:1,playerId:'me',message:'roll dice'}]);p.view.state.game.lastRoll={die1:2,die2:5,total:7};
 const s=collectStatistics(null,p);assert.equal(s.counts[5],1);assert.equal(s.complete,true);assert.equal(collectStatistics(s,p).rolls,1);
});
test('career records count a completed game once and do not include unfinished games',()=>{
 const first=collectStatistics(null,packet(1,[event(1)],{ended:true,won:true}),100),repeat=collectStatistics(first,packet(1,[event(1)],{ended:true,won:true}),200);
 assert.equal(repeat.result.finishedAt,100);
 const second=collectStatistics(null,packet(1,[event(1)],{ended:true}),300),running=collectStatistics(null,packet(1,[event(1)]));
 const c=careerStatistics([repeat,second,running]);assert.equal(c.games,2);assert.equal(c.wins,1);assert.equal(c.winRate,50);assert.equal(c.average,6);
});
test('the chart contains all eleven totals, expected probabilities and accessible counts',()=>{
 const s=collectStatistics(null,packet(2,[event(1,[1,1]),event(2,[6,6])])),html=statisticsMarkup(s,[]);
 assert.equal((html.match(/role="listitem"/g)||[]).length,11);assert.match(html,/2: 1 rolls, expected 0.1/);assert.match(html,/12: 1 rolls/);assert.match(html,/All rolls recorded/);
 assert.match(statisticsMarkup(s,[s],'career'),/Finished games recorded on this device/);
});
