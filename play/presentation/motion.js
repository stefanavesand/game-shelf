import {FEEDBACK_PROFILE,needsTurnAttention} from './feedback-profile.js';
import {diceFrames,motionSettings} from './motion-settings.js';
import {describeMove,costLabel,hexDisplayKey} from './move-events.js';
import {center,vertexPoint} from '../board.js';
import {symbol} from './art.js';
const colors={red:'#b84f3c',blue:'#396a9c',orange:'#b57d27',green:'#397252'};
const resourceFor={hills:'brick',forest:'lumber',fields:'grain',pasture:'wool',mountains:'ore'};
export function createGameMotion({reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,settings={},onCue=()=>{}}={}){
 const timing=motionSettings(settings);
 let previous=null,timers=[],animations=[],floating=[];
 function clear(){timers.forEach(clearTimeout);timers=[];animations.forEach(a=>a.cancel());animations=[];floating.forEach(el=>el.remove());floating=[];}
 function animate(el,frames,{respectReducedMotion=true,...options}={}){if(!el||respectReducedMotion&&reduced()||typeof el.animate!=='function')return;const animation=el.animate(frames,{duration:600,easing:'cubic-bezier(.2,.8,.2,1)',...options});animations.push(animation);animation.finished.catch(()=>{});}
 const later=(work,delay)=>timers.push(setTimeout(work,delay));
 const find=(selector,key)=>[...document.querySelectorAll(selector)].find(el=>el.dataset.motionKey===key);
 const player=id=>[...document.querySelectorAll('.player[data-player]')].find(el=>el.dataset.player===id);
 function fly(resource,amount,from,to,{delay=500,negative=false}={}){
  if(!from||!to||reduced())return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight)return;const el=document.createElement('div');el.className='motion-resource-flight';el.setAttribute('aria-hidden','true');el.innerHTML=symbol(resource==='lumber'?'wood':resource);const count=document.createElement('span');count.textContent=`${negative?'−':'+'}${amount}`;el.append(count);el.style.left=`${a.x+a.width/2-20}px`;el.style.top=`${a.y+a.height/2-20}px`;document.body.append(el);floating.push(el);
  animate(el,[{transform:'translate(0,0) scale(.7)',opacity:0},{transform:`translate(0,${-FEEDBACK_PROFILE.cards.lift}px) scale(1)`,opacity:1,offset:.15},{transform:`translate(${b.x+b.width/2-a.x-a.width/2}px,${b.y+b.height/2-a.y-a.height/2}px) scale(.65)`,opacity:0}],{duration:timing.flightMs,delay,fill:'both'});later(()=>el.remove(),delay+timing.flightMs+50);
 }
 return {
  reset(){clear();previous=null;},
  present(packet,{enabled=true}={}){
   if(!enabled||!packet?.view){clear();previous=null;return;}
   if(previous?.roomId===packet.roomId&&previous.revision===packet.revision)return;
   const before=previous,event=describeMove(before,packet);previous=packet;clear();if(!event)return;
   const caption=document.querySelector('.motion-caption');if(!caption)return;
   caption.hidden=false;caption.dataset.event=event.key;caption.style.setProperty('--event-color',colors[event.color]||colors.red);caption.querySelector('.motion-message').textContent=event.message;
   const detail=caption.querySelector('.motion-detail');detail.textContent='';
   if(before?.roomId===packet.roomId&&before.view?.you===packet.view.you&&!needsTurnAttention(before.view)&&needsTurnAttention(packet.view))animate(document.querySelector('.action-entry .turn-line'),[{opacity:0,transform:`translateY(${FEEDBACK_PROFILE.turn.lift}px) scale(.94)`},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:FEEDBACK_PROFILE.turn.duration});
   animate(caption,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});
   animate(player(event.actorId),[{transform:'translateY(0)'},{transform:'translateY(-4px)',offset:.4},{transform:'translateY(0)'}],{duration:280});
   for(const piece of event.pieces)animate(find(`[data-motion-piece="${piece.kind}"]`,piece.key),[{transform:`translateY(${-timing.pieceLift}px) scale(.75)`,opacity:.1},{transform:'translateY(2px) scale(1.08)',opacity:1,offset:.72},{transform:'translateY(0) scale(1)',opacity:1}],{delay:250,duration:timing.pieceMs});
   if(event.rolled){document.querySelectorAll('.activity-entry.is-latest .die').forEach((die,i)=>animate(die,diceFrames(timing),{duration:timing.diceMs,delay:i*60,easing:'linear',respectReducedMotion:FEEDBACK_PROFILE.dice.respectReducedMotion}));onCue('dice',timing.diceMs);for(const key of event.producing)animate(find('[data-motion-tile]',key),[{opacity:1,filter:'brightness(1)'},{opacity:1,filter:'brightness(1.35)',offset:.5},{opacity:1,filter:'brightness(1)'}],{delay:timing.diceMs,duration:800});}
   if(event.pieces.length)later(()=>onCue('piece'),250+FEEDBACK_PROFILE.piece.offset);
   if(event.resources.length||event.cost.length)later(()=>onCue('cards'),event.rolled?timing.diceMs+200:500);
   const v=packet.view;
   for(const delta of event.resources){const target=document.querySelector(`.resource-tile[data-motion-resource="${delta.resource}"]`);animate(target,[{transform:'scale(1)'},{transform:'scale(1.12)',offset:.5},{transform:'scale(1)'}],{delay:event.rolled?timing.diceMs+150:600,duration:450});
    if(delta.amount>0){const tile=v.state.board.tiles.find(t=>resourceFor[t.terrain]===delta.resource&&event.producing.includes(hexDisplayKey(t.coord))&&v.state.board.buildings.some(b=>b.playerId===v.you&&Math.abs(Math.hypot(vertexPoint(b.vertex).x-center(t.coord).x,vertexPoint(b.vertex).y-center(t.coord).y)-54)<1e-6));fly(delta.resource,delta.amount,tile?find('[data-motion-tile]',hexDisplayKey(tile.coord)):player(event.actorId),target,{delay:event.rolled?timing.diceMs+200:500});}
   }
   if(event.cost.length){const bank=caption.querySelector('.motion-bank');bank.hidden=false;event.cost.forEach((d,i)=>fly(d.resource,d.amount,player(event.actorId),bank,{negative:true,delay:500+i*70}));}else caption.querySelector('.motion-bank').hidden=true;
   for(const score of event.scores){
    const points=player(score.playerId)?.querySelector('.player-points');
    animate(points,[{transform:'scale(1)'},{transform:'scale(1.25)',color:'#b57d27',offset:.4},{transform:'scale(1)'}],{duration:700});
    if(points&&!reduced()){const delta=document.createElement('span');delta.className='motion-score-delta';delta.textContent=`${score.amount>0?'+':''}${score.amount} VP`;delta.setAttribute('aria-hidden','true');points.append(delta);floating.push(delta);animate(delta,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)',offset:.2},{opacity:0,transform:'translateY(-8px)'}],{duration:1000});later(()=>delta.remove(),1050);}
   }
   if(event.robber){const a=center(event.robber.from),b=center(event.robber.to);animate(document.querySelector('[data-motion-robber]'),[{transform:`translate(${a.x-b.x}px,${a.y-b.y}px)`,opacity:.45},{transform:'translate(0,0)',opacity:1}],{delay:200,duration:timing.pieceMs});}
   if(event.card)animate(player(event.actorId),[{filter:'brightness(1)'},{filter:'brightness(1.3)',offset:.5},{filter:'brightness(1)'}],{delay:300,duration:600});
   later(()=>{if(!caption.isConnected)return;detail.textContent=event.awards.length?event.awards.map(a=>`${player(a.playerId)?.querySelector('strong')?.textContent||'Player'} · ${a.name}`).join(' · '):costLabel(event.cost);},850);
   return Promise.allSettled(animations.map(animation=>animation.finished));

  }
 };
}
