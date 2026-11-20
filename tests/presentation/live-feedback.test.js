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
 const frames=diceFrames(MOTION_DEFAULTS),angles=frames.map(f=>Number(f.transform.match(/rotate\((-?[\d.]+)/)[1]));assert.equal(frames.length,2);assert.ok(angles[0]<angles[1]);assert.equal(angles[1],0);assert.equal(MOTION_DEFAULTS.diceMs,1500);assert.ok(motionInterval('roll dice')>=MOTION_DEFAULTS.diceMs+MOTION_DEFAULTS.flightMs);
});
