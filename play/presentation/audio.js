import {FEEDBACK_PROFILE,needsTurnAttention} from './feedback-profile.js';
import {feedbackScore} from './sound-score.js';
// Device-local feedback. Procedural sounds need no assets or network requests.
const KEY='game-shelf-sound-v1';
export function createSoundPolicy({play=()=>{},storage,visible=()=>true}={}){
 if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
 let enabled=true,previous=null;try{enabled=storage?.getItem(KEY)!=='off';}catch{}
 const cue=(kind,duration)=>{if(enabled&&visible())try{play(kind,duration);}catch{/* Feedback never blocks a move. */}};
 return {
  enabled:()=>enabled,
  setEnabled(value){enabled=!!value;try{storage?.setItem(KEY,enabled?'on':'off');}catch{}},
  cue,
  observe(packet,{active=true}={}){
   if(!active||!packet?.view){previous=null;return;}if(!visible())return;
   const v=packet.view,same=previous?.room===packet.roomId&&previous?.you===v.you;
   if(same&&packet.revision<=previous.revision)return;
   const needs=needsTurnAttention(v);
   if(same&&needs&&!previous.needs)cue('turn');
   previous={room:packet.roomId,you:v.you,revision:packet.revision,needs};
  }
 };
}
export function createGameAudio({target=globalThis.document,Context=globalThis.AudioContext||globalThis.webkitAudioContext,storage}={}){
 let context;const sources=new Set(),visible=()=>!target?.hidden;
 const stop=()=>{for(const source of sources)try{source.stop();}catch{}sources.clear();};
 const policy=createSoundPolicy({storage,visible,play(kind,duration=FEEDBACK_PROFILE[kind]?.duration){
  if(!context||context.state!=='running'||!FEEDBACK_PROFILE[kind])return;
  const cue=context.createGain(),local=new Set(),now=context.currentTime,start=now+.015;
  cue.connect(context.destination);cue.gain.setValueAtTime(0,now);cue.gain.linearRampToValueAtTime(FEEDBACK_PROFILE[kind].volume/35,now+(kind==='dice'?.18:kind==='cards'?.06:.008));
  for(const e of feedbackScore(kind,duration)){
   const at=start+e.at,amp=context.createGain();let source,filter;
   if(e.kind==='tone'){source=context.createOscillator();source.type=e.type;source.frequency.setValueAtTime(e.hz,at);source.frequency.linearRampToValueAtTime(e.end,at+e.len);amp.gain.setValueAtTime(.0001,at);amp.gain.linearRampToValueAtTime(e.gain,at+.003);amp.gain.exponentialRampToValueAtTime(.0001,at+e.len);}
   else{const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*e.len),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source=context.createBufferSource();source.buffer=buffer;filter=context.createBiquadFilter();filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(e.from,at);filter.frequency.linearRampToValueAtTime(e.to,at+e.len);amp.gain.setValueCurveAtTime(Float32Array.from({length:96},(_,i)=>e.gain*Math.sin(Math.PI*i/95)**2),at,e.len);}
   source.connect(filter||amp);if(filter)filter.connect(amp);amp.connect(cue);sources.add(source);local.add(source);
   source.onended=()=>{sources.delete(source);local.delete(source);source.disconnect();filter?.disconnect();amp.disconnect();if(!local.size)cue.disconnect();};source.start(at);source.stop(at+e.len+.01);
  }
 }});
 const unlock=()=>{if(!policy.enabled()||!visible()||!Context)return;try{context??=new Context();if(context.state!=='running'&&context.state!=='closed')context.resume().catch(()=>{});}catch{}};
 const hide=()=>{if(!visible()){stop();context?.suspend().catch(()=>{});}else unlock();};
 target?.addEventListener('pointerdown',unlock,{passive:true});target?.addEventListener('keydown',unlock,{passive:true});target?.addEventListener('visibilitychange',hide);
 return {...policy,setEnabled(value){policy.setEnabled(value);if(value)unlock();else stop();},dispose(){stop();target?.removeEventListener('pointerdown',unlock);target?.removeEventListener('keydown',unlock);target?.removeEventListener('visibilitychange',hide);context?.close().catch(()=>{});}};
}
