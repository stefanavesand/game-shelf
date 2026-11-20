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
   const v=packet.view,g=v.state.game,same=previous?.room===packet.roomId&&previous?.you===v.you;
   if(same&&packet.revision<=previous.revision)return;
   const needs=g.phase!=='ended'&&(g.phase==='discard'?g.pendingDiscard?.includes(v.you):g.currentPlayerId===v.you);
   if(same&&needs&&!previous.needs)cue('turn');
   previous={room:packet.roomId,you:v.you,revision:packet.revision,needs};
  }
 };
}
export function createGameAudio({target=globalThis.document,Context=globalThis.AudioContext||globalThis.webkitAudioContext,storage}={}){
 let context;const sources=new Set(),visible=()=>!target?.hidden;
 const stop=()=>{for(const source of sources)try{source.stop();}catch{}sources.clear();};
 function envelope(source,at,duration,volume,filter){
  const gain=context.createGain();source.connect(filter||gain);if(filter)filter.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.005);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  sources.add(source);source.onended=()=>{sources.delete(source);source.disconnect();filter?.disconnect();gain.disconnect();};source.start(at);source.stop(at+duration+.01);
 }
 function tone(frequency,at,duration,volume=.06,type='sine',end=frequency){
  const source=context.createOscillator();source.type=type;source.frequency.setValueAtTime(frequency,at);source.frequency.linearRampToValueAtTime(end,at+duration);envelope(source,at,duration,volume);
 }
 function noise(at,duration,from,to,volume){
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
  // Noise is an audio texture only; gameplay randomness lives in core/random-effects.
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=context.createBufferSource();source.buffer=buffer;const filter=context.createBiquadFilter();filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(from,at);filter.frequency.linearRampToValueAtTime(to,at+duration);envelope(source,at,duration,volume,filter);
 }
 const policy=createSoundPolicy({storage,visible,play(kind,duration=1500){
  if(!context||context.state!=='running')return;const at=context.currentTime+.005;
  if(kind==='turn'){tone(660,at,.16);tone(880,at+.12,.2);}
  else if(kind==='piece')tone(650,at,.035,.07,'triangle',260);
  else if(kind==='cards')noise(at,.18,600,2400,.11);
  else if(kind==='dice')for(const offset of [0,.1,.23,.37,.52,.68,.84])noise(at+offset*duration/1000,.035,1400,500,.1);
 }});
 const unlock=()=>{if(!policy.enabled()||!visible()||!Context)return;try{context??=new Context();if(context.state==='suspended')context.resume().catch(()=>{});}catch{}};
 const hide=()=>{if(!visible()){stop();context?.suspend().catch(()=>{});}else unlock();};
 target?.addEventListener('pointerdown',unlock,{passive:true});target?.addEventListener('keydown',unlock,{passive:true});target?.addEventListener('visibilitychange',hide);
 return {...policy,setEnabled(value){policy.setEnabled(value);if(value)unlock();else stop();},dispose(){stop();target?.removeEventListener('pointerdown',unlock);target?.removeEventListener('keydown',unlock);target?.removeEventListener('visibilitychange',hide);context?.close().catch(()=>{});}};
}
