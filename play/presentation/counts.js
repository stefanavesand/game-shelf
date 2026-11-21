import {reduceFeedback} from './feedback-profile.js';
import {describeMove} from './move-events.js';
import {motionInterval} from './motion-settings.js';
// Visual counters only: authoritative state and durable commands never wait here.
export function createCountPresentation({now=Date.now,reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,setTimer=setTimeout,clearTimer=clearTimeout,onChange=()=>{}}={}){
 let previous=null,latest=null,displayed=null,timer=null,due=0,external=false;
 const clear=()=>{if(timer!==null)clearTimer(timer);timer=null;due=0;external=false;};
 const counters=v=>JSON.stringify(v.state.players.players.map(p=>[p.id,p.resources,p.resourceCount,p.developmentCards,p.devCardCount]));
 const settle=()=>{clear();displayed=latest?.view||null;};
 return {
  reset(){clear();previous=latest=displayed=null;},
  observe(packet,{enabled=true}={}){
   if(!enabled||!packet?.view){this.reset();return;}
   latest=packet;if(previous?.roomId===packet.roomId&&previous?.you===packet.you&&previous.revision===packet.revision){if(due&&!external&&now()>=due)settle();return;}
   const event=describeMove(previous,packet),old=displayed;previous=packet;
   clear();if(!old||!event||reduceFeedback(event.rolled?'dice':'cards',reduced())||counters(old)===counters(packet.view)){displayed=packet.view;return;}
   const oldPlayers=new Map(old.state.players.players.map(p=>[p.id,p]));
   displayed={...packet.view,state:{...packet.view.state,players:{...packet.view.state.players,players:packet.view.state.players.players.map(p=>{const before=oldPlayers.get(p.id);return before?{...p,resources:before.resources,resourceCount:before.resourceCount,developmentCards:before.developmentCards,devCardCount:before.devCardCount}:p;})}}};
   due=now()+Math.max(motionInterval(event.action),event.resources.length?1100:0,event.scores.length?1350:0);
   timer=setTimer(()=>{settle();onChange();},due-now());
  },
  completeOn(packet,completion){
   if(!due||latest?.roomId!==packet.roomId||latest?.revision!==packet.revision||latest?.view?.you!==packet.view?.you)return;
   if(timer!==null)clearTimer(timer);timer=null;external=true;
   const finish=()=>{if(external&&latest?.roomId===packet.roomId&&latest?.revision===packet.revision&&latest?.view?.you===packet.view?.you){settle();onChange();}};
   Promise.resolve(completion).then(finish,finish);
  },
  view:()=>displayed,
  remaining:()=>due?Math.max(external?1000:50,due-now()):0,
  pending:()=>!!due
 };
}
