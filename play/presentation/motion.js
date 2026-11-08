import {describeMove,costLabel,hexDisplayKey} from './move-events.js';
import {center,vertexPoint} from '../board.js';
import {symbol} from '../../ui/art.js';
const colors={red:'#b84f3c',blue:'#396a9c',orange:'#b57d27',green:'#397252'};
const resourceFor={hills:'brick',forest:'lumber',fields:'grain',pasture:'wool',mountains:'ore'};
export function createGameMotion({reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 let previous=null,timers=[],animations=[],floating=[];
 function clear(){timers.forEach(clearTimeout);timers=[];animations.forEach(a=>a.cancel());animations=[];floating.forEach(el=>el.remove());floating=[];}
 function animate(el,frames,options){if(!el||reduced()||typeof el.animate!=='function')return;const animation=el.animate(frames,{duration:600,easing:'cubic-bezier(.2,.8,.2,1)',...options});animations.push(animation);animation.finished.catch(()=>{});}
 const later=(work,delay)=>timers.push(setTimeout(work,delay));
 const find=(selector,key)=>[...document.querySelectorAll(selector)].find(el=>el.dataset.motionKey===key);
 const player=id=>[...document.querySelectorAll('.player[data-player]')].find(el=>el.dataset.player===id);
 function fly(resource,amount,from,to,{delay=500,negative=false}={}){
  if(!from||!to||reduced())return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),el=document.createElement('div');el.className='motion-resource-flight';el.setAttribute('aria-hidden','true');el.innerHTML=symbol(resource==='lumber'?'wood':resource);const count=document.createElement('span');count.textContent=`${negative?'−':'+'}${amount}`;el.append(count);el.style.left=`${a.x+a.width/2-20}px`;el.style.top=`${a.y+a.height/2-20}px`;document.body.append(el);floating.push(el);
  animate(el,[{transform:'translate(0,0) scale(.7)',opacity:0},{transform:'translate(0,-12px) scale(1)',opacity:1,offset:.15},{transform:`translate(${b.x+b.width/2-a.x-a.width/2}px,${b.y+b.height/2-a.y-a.height/2}px) scale(.65)`,opacity:0}],{duration:750,delay,fill:'both'});later(()=>el.remove(),delay+800);
 }
 return {
  reset(){clear();previous=null;document.querySelector('.motion-caption')?.setAttribute('hidden','');},
  present(packet,{enabled=true}={}){
   if(!enabled||!packet?.view){clear();previous=null;return;}
   if(previous?.roomId===packet.roomId&&previous.revision===packet.revision)return;
   const event=describeMove(previous,packet);previous=packet;clear();document.querySelector('.motion-caption')?.setAttribute('hidden','');if(!event)return;
   const caption=document.querySelector('.motion-caption');if(!caption)return;
   caption.hidden=false;caption.dataset.event=event.key;caption.style.setProperty('--event-color',colors[event.color]||colors.red);caption.querySelector('.motion-message').textContent=event.message;
   const detail=caption.querySelector('.motion-detail');detail.textContent='';
   animate(caption,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});
   animate(player(event.actorId),[{transform:'translateY(0)'},{transform:'translateY(-4px)',offset:.4},{transform:'translateY(0)'}],{duration:280});
   for(const piece of event.pieces)animate(find(`[data-motion-piece="${piece.kind}"]`,piece.key),[{transform:'translateY(-16px) scale(.75)',opacity:.1},{transform:'translateY(2px) scale(1.08)',opacity:1,offset:.72},{transform:'translateY(0) scale(1)',opacity:1}],{delay:250,duration:600});
   if(event.rolled){document.querySelectorAll('.die').forEach((die,i)=>animate(die,[{transform:'rotate(-20deg) translateY(-6px)'},{transform:'rotate(16deg) translateY(2px)',offset:.35},{transform:'rotate(-9deg) translateY(-2px)',offset:.65},{transform:'rotate(0) translateY(0)'}],{duration:650,delay:i*60}));for(const key of event.producing)animate(find('[data-motion-tile]',key),[{opacity:1,filter:'brightness(1)'},{opacity:1,filter:'brightness(1.35)',offset:.5},{opacity:1,filter:'brightness(1)'}],{delay:450,duration:800});}
   const v=packet.view;
   for(const delta of event.resources){const target=document.querySelector(`.resource-tile[data-motion-resource="${delta.resource}"]`);animate(target,[{transform:'scale(1)'},{transform:'scale(1.12)',offset:.5},{transform:'scale(1)'}],{delay:600,duration:450});
    if(delta.amount>0){const tile=v.state.board.tiles.find(t=>resourceFor[t.terrain]===delta.resource&&event.producing.includes(hexDisplayKey(t.coord))&&v.state.board.buildings.some(b=>b.playerId===v.you&&Math.abs(Math.hypot(vertexPoint(b.vertex).x-center(t.coord).x,vertexPoint(b.vertex).y-center(t.coord).y)-54)<1e-6));fly(delta.resource,delta.amount,tile?find('[data-motion-tile]',hexDisplayKey(tile.coord)):player(event.actorId),target);}
   }
   if(event.cost.length){const bank=caption.querySelector('.motion-bank');bank.hidden=false;event.cost.forEach((d,i)=>fly(d.resource,d.amount,player(event.actorId),bank,{negative:true,delay:500+i*70}));}else caption.querySelector('.motion-bank').hidden=true;
   for(const score of event.scores)animate(player(score.playerId)?.querySelector('.player-points'),[{transform:'scale(1)'},{transform:'scale(1.5)',color:'#b57d27',offset:.5},{transform:'scale(1)'}],{delay:650,duration:700});
   if(event.robber){const a=center(event.robber.from),b=center(event.robber.to);animate(document.querySelector('[data-motion-robber]'),[{transform:`translate(${a.x-b.x}px,${a.y-b.y}px)`,opacity:.45},{transform:'translate(0,0)',opacity:1}],{delay:200,duration:650});}
   if(event.card)animate(player(event.actorId),[{filter:'brightness(1)'},{filter:'brightness(1.3)',offset:.5},{filter:'brightness(1)'}],{delay:300,duration:600});
   later(()=>{if(!caption.isConnected)return;detail.textContent=event.awards.length?event.awards.map(a=>`${player(a.playerId)?.querySelector('strong')?.textContent||'Player'} · ${a.name}`).join(' · '):costLabel(event.cost);},850);
   later(()=>{if(caption.isConnected)caption.hidden=true;},2400);
  }
 };
}
