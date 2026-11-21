import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundPolicy} from '../../play/presentation/audio.js';
import {diceFrames,MOTION_DEFAULTS,motionInterval} from '../../play/presentation/motion-settings.js';
const packet=(revision,actor='peer',phase='main',pendingDiscard=[])=>({roomId:'room',revision,view:{id:'game',you:'me',state:{game:{phase,currentPlayerId:actor,pendingDiscard}}}});
test('turn sounds happen on a new turn, never on polls, roll/main changes or reload baseline',()=>{
 const sounds=[],audio=createSoundPolicy({play:kind=>sounds.push(kind)});
 audio.observe(packet(1));audio.observe(packet(2,'me','roll'));audio.observe(packet(2,'me','roll'));audio.observe(packet(3,'me'));audio.observe(packet(1));assert.deepEqual(sounds,['turn']);
 audio.observe(packet(4));audio.observe(packet(5,'me'));assert.deepEqual(sounds,['turn','turn']);
 audio.observe(packet(5,'me'),{active:false});audio.observe(packet(5,'me'));assert.equal(sounds.length,2);
});
test('sound preferences persist, hidden pages stay silent and failures do not block feedback',()=>{
 let stored,visible=true;const sounds=[],storage={getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},audio=createSoundPolicy({storage,visible:()=>visible,play:kind=>sounds.push(kind)});
 audio.observe(packet(1));visible=false;audio.observe(packet(2,'me'));audio.cue('dice');assert.equal(sounds.length,0);visible=true;audio.observe(packet(2,'me'));assert.deepEqual(sounds,['turn']);
 audio.setEnabled(false);audio.cue('cards');assert.equal(createSoundPolicy({storage}).enabled(),false);audio.setEnabled(true);audio.cue('piece');assert.deepEqual(sounds,['turn','piece']);
 const broken=createSoundPolicy({storage:{getItem(){throw Error();},setItem(){throw Error();}},play(){throw Error();}});assert.doesNotThrow(()=>{broken.setEnabled(true);broken.cue('turn');});
});
test('a discard request is actionable but an opponent trade does not masquerade as your turn',()=>{
 const sounds=[],audio=createSoundPolicy({play:k=>sounds.push(k)});audio.observe(packet(1));audio.observe(packet(2,'peer','discard',['me']));audio.observe(packet(3,'peer','discard',['me']));assert.deepEqual(sounds,['turn']);audio.observe(packet(4,'peer','ended'));assert.equal(sounds.length,1);
});
test('dice use a shorter one-direction motion without a decelerating final keyframe',()=>{
 const frames=diceFrames(MOTION_DEFAULTS),angles=frames.map(f=>Number(f.transform.match(/rotate\((-?[\d.]+)/)[1]));assert.equal(frames.length,2);assert.ok(angles[0]<angles[1]);assert.equal(angles[1],0);assert.equal(MOTION_DEFAULTS.diceMs,1100);assert.ok(motionInterval('roll dice')>=MOTION_DEFAULTS.diceMs+MOTION_DEFAULTS.flightMs);
});

test('accepted profiles retain all four selections and apply reduced motion per event',async()=>{
 const {FEEDBACK_PROFILE,reduceFeedback}=await import('../../play/presentation/feedback-profile.js'),{feedbackScore}=await import('../../play/presentation/sound-score.js');
 assert.deepEqual(Object.values(FEEDBACK_PROFILE).map(p=>[p.event,p.sound,p.duration,p.volume,p.offset]),[['cards','soft',2200,35,0],['turn','pluck',800,35,0],['piece','felt',1450,35,0],['dice','felt',1100,35,0]]);
 assert.equal(FEEDBACK_PROFILE.dice.rotation,510);assert.equal(reduceFeedback('dice',true),false);assert.equal(reduceFeedback('piece',true),true);assert.equal(reduceFeedback('cards',true),true);
 assert.deepEqual(feedbackScore('turn').map(e=>e.hz),[660,785,988]);assert.deepEqual(feedbackScore('cards'),[{kind:'noise',at:0,len:.45,from:400,to:1200,gain:.075}]);
 assert.equal(feedbackScore('piece').length,2);const dice=feedbackScore('dice',1100,()=>.5);assert.equal(dice.length,25);for(const e of dice){assert.ok(e.at>=0&&e.at+e.len<1.1);for(const value of Object.values(e).filter(v=>typeof v==='number'))assert.ok(Number.isFinite(value));}
});

test('rendered audio has a smooth noise envelope and mute/background stop scheduled sources',async()=>{
 const {createGameAudio}=await import('../../play/presentation/audio.js');let context;
 const param=()=>({events:[],setValueAtTime(...a){this.events.push(['set',...a]);},linearRampToValueAtTime(...a){this.events.push(['linear',...a]);},exponentialRampToValueAtTime(...a){this.events.push(['exponential',...a]);},setValueCurveAtTime(...a){this.events.push(['curve',...a]);}});
 class Context{
  constructor(){context=this;this.state='running';this.currentTime=10;this.sampleRate=1000;this.destination={};this.gains=[];this.sources=[];}
  node(){return {connect(){},disconnect(){this.disconnected=true;}};}
  createGain(){const n={...this.node(),gain:param()};this.gains.push(n);return n;}
  source(){const n={...this.node(),start(at){this.at=at;},stop(at){if(at===undefined){this.stopped=true;this.onended?.();}}};this.sources.push(n);return n;}
  createOscillator(){return Object.assign(this.source(),{frequency:param()});}
  createBufferSource(){return this.source();}
  createBuffer(_channels,size){return {getChannelData:()=>new Float32Array(size)};}
  createBiquadFilter(){return {...this.node(),frequency:param(),Q:{}};}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){return Promise.resolve();}
 }
 const target=new EventTarget();target.hidden=false;const a=createGameAudio({target,Context,storage:{getItem:()=>null,setItem(){}}});
 target.dispatchEvent(new Event('pointerdown'));a.cue('cards');assert.equal(context.sources.length,1);
 const curve=context.gains.flatMap(g=>g.gain.events).find(e=>e[0]==='curve')[1];assert.equal(curve[0],0);assert.ok(curve.at(-1)<1e-10);assert.ok(Math.max(...curve)>.07);assert.ok(curve[1]<.001);
 a.setEnabled(false);assert.equal(context.sources[0].stopped,true);a.cue('dice');assert.equal(context.sources.length,1);
 a.setEnabled(true);a.cue('turn');assert.deepEqual(context.sources.slice(1).map(s=>s.frequency.events[0][1]),[660,785,988]);target.hidden=true;target.dispatchEvent(new Event('visibilitychange'));assert.ok(context.sources.every(s=>s.stopped));a.cue('dice');assert.equal(context.sources.length,4);a.dispose();
});
