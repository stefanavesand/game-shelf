import {describeMove,moveSummary} from './move-events.js';
import {esc} from './html.js';
import {bundleLabel,RESOURCES} from '../core/protocol.js';
import {symbol} from './art.js';
export const ACTIVITY_LIMIT=200;
const colors={red:'#b82923',blue:'#1469ac',orange:'#b58117',green:'#397252'};
const bundle=value=>Object.fromEntries(RESOURCES.filter(r=>Number.isSafeInteger(value?.[r])&&value[r]>0&&value[r]<=19).map(r=>[r,value[r]]));
function cleanEntries(raw){if(!Array.isArray(raw))return [];return raw.filter(e=>e&&Number.isSafeInteger(e.revision)&&e.revision>=0&&typeof e.message==='string').slice(-ACTIVITY_LIMIT).map(e=>{
 const roll=e.roll&&[e.roll.die1,e.roll.die2].every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&e.roll.total===e.roll.die1+e.roll.die2?{die1:e.roll.die1,die2:e.roll.die2,total:e.roll.total}:undefined;
 return {revision:e.revision,actor:String(e.actor||'').slice(0,100),color:colors[e.color]?e.color:'red',message:e.message.slice(0,500),action:String(e.action||'').slice(0,60),roll,gains:bundle(e.gains),scores:Array.isArray(e.scores)?e.scores.filter(n=>Number.isInteger(n)&&n>0&&n<=10):[],awards:Array.isArray(e.awards)?e.awards.filter(a=>['Longest Road','Largest Army'].includes(a)):[],trade:e.trade?{give:bundle(e.trade.give),receive:bundle(e.trade.receive)}:undefined};
 });}
export function activityEntry(view,h){const p=view.state.players.players.find(p=>p.id===h.playerId);return {revision:h.revision,actor:h.playerId,color:p?.color||'red',message:moveSummary({...view,state:{...view.state,game:{...view.state.game,lastRoll:null}}},h),action:h.message};}
export function mergeActivity(entries,before,after){
 const v=after?.view;if(!v)return entries;
 const map=new Map(cleanEntries(entries).map(e=>[e.revision,e]));
 for(const h of v.history){if(!map.has(h.revision))map.set(h.revision,activityEntry(v,h));}
 const event=describeMove(before,after);
 if(event){const entry=map.get(after.revision);if(entry){entry.message=event.message;entry.roll=event.rolled?{...event.rolled}:undefined;
  entry.gains=Object.fromEntries(event.resources.filter(d=>d.amount>0).map(d=>[d.resource,d.amount]));entry.scores=event.scores.filter(s=>s.playerId===event.actorId).map(s=>s.amount);
  entry.awards=event.awards.filter(a=>a.playerId===event.actorId).map(a=>a.name);
  const trade=v.trades?.find(t=>t.revision===after.revision&&t.status==='accepted');
  if(trade)entry.trade={give:trade.give,receive:trade.receive};
 }}else if(v.history.at(-1)?.revision===after.revision&&v.history.at(-1)?.message==='roll dice'&&v.state.game.lastRoll){const entry=map.get(after.revision);entry.roll={...v.state.game.lastRoll};entry.message=moveSummary(v,v.history.at(-1));}
 return [...map.values()].sort((a,b)=>a.revision-b.revision).slice(-ACTIVITY_LIMIT);
}
export function createActivity({principal=()=>'',storage}={}){
 if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
 let key='',previous=null,entries=[],persisted='';
 return {observe(packet){if(!packet?.view)return [];const next=`game-shelf-activity-v1:${principal()}:${packet.roomId}:${packet.you}`;
  if(next!==key){key=next;previous=null;entries=[];persisted='';try{const raw=JSON.parse(storage?.getItem(key)||'[]');entries=cleanEntries(raw);}catch{}}
  if(previous?.revision===packet.revision)return entries.filter(e=>e.revision<=packet.revision);
  try{const existing=JSON.parse(storage?.getItem(key)||'[]');entries=[...new Map([...entries,...cleanEntries(existing)].map(e=>[e.revision,e])).values()];}catch{}
  entries=mergeActivity(entries,previous,packet);previous=packet;const raw=JSON.stringify(entries);if(raw!==persisted){try{storage?.setItem(key,raw);persisted=raw;}catch{}}
  return entries.filter(e=>e.revision<=packet.revision);
 },reset(){key='';previous=null;entries=[];persisted='';}};
}
const pips={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function diceMarkup(roll){return `<div class="dice" aria-label="Last roll ${Number(roll.total)}">${[roll.die1,roll.die2].map(value=>`<span class="die" aria-label="${Number(value)}">${Array.from({length:9},(_,i)=>`<i class="pip ${pips[value]?.includes(i)?'lit':''}" aria-hidden="true"></i>`).join('')}</span>`).join('')}<span class="roll-total">= ${Number(roll.total)}</span></div>`;}
export function activityMarkup(entries){return entries.map((e,i)=>{const latest=i===entries.length-1;return `<article class="activity-entry ${latest?'is-latest motion-caption':''}" data-entry="${Number(e.revision)}" ${latest?'role="status" aria-live="polite"':''} style="--event-color:${colors[e.color]||colors.red}"><p class="activity-message ${latest?'motion-message':''}">${esc(e.message)}</p>${e.roll?diceMarkup(e.roll):''}${e.gains&&Object.keys(e.gains).length?`<p class="activity-gains">You received ${Object.entries(e.gains).map(([r,n])=>`<span>${symbol(r==='lumber'?'wood':r)}${Number(n)} ${esc({brick:'Brick',lumber:'Wood',grain:'Grain',wool:'Wool',ore:'Ore'}[r])}</span>`).join(' · ')}</p>`:''}${e.trade?`<p>${esc(bundleLabel(e.trade.give))} → ${esc(bundleLabel(e.trade.receive))}</p>`:''}${e.scores?.length?`<p class="activity-points">+${e.scores.reduce((n,x)=>n+x,0)} VP${e.awards?.length?' · '+esc(e.awards.join(' · ')):''}</p>`:''}${latest?'<span class="motion-detail sr-only"></span><span class="motion-bank" hidden>Bank</span>':''}</article>`;}).join('');}
