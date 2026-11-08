import {createGameMotion} from '../../play/presentation/motion.js';
import {motionSettings,MOTION_DEFAULTS} from '../../play/presentation/motion-settings.js';
import {gameScreen} from '../../play/presentation/game-screen.js';
import {resourceHand} from '../../play/presentation/panels.js';
import {trackViewport} from '../../play/presentation/viewport.js';
import {draw} from '../../play/board.js';
import {scenario} from './scenarios.js';
const $=id=>document.getElementById(id),key='game-shelf-motion-lab-v1',media=matchMedia('(prefers-reduced-motion: reduce)'),clips=['roll','road','settlement','city','robber'];
const controls={diceMs:['Dice duration',200,6000,100,'ms'],diceRotation:['Dice rotation',0,1080,10,'°'],diceLift:['Dice lift',0,50,1,'px'],pieceMs:['Piece landing duration',150,4000,50,'ms'],pieceLift:['Piece landing height',0,60,1,'px'],flightMs:['Resource flight duration',200,4000,50,'ms'],holdMs:['Settled dice result hold',0,6000,100,'ms'],gapMs:['Minimum interval between demo moves',300,8000,100,'ms']};
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
const query=Object.fromEntries(new URLSearchParams(location.search));let settings=motionSettings({...saved,...query}),respect=(query.respect??saved.respect??'true')!=='false',clip=clips.includes(query.clip||saved.clip)?query.clip||saved.clip:'roll',motion=null,sequenceTimer=null,run=0,tracks=0;
function writeControls(){
 $('clip').value=clip;$('respect-motion').checked=respect;
 $('ranges').innerHTML=Object.entries(controls).map(([name,[label,min,max,step,unit]])=>`<label class="lab-range">${label}<output id="${name}-value">${settings[name]} ${unit}</output><input type="range" id="${name}" data-setting="${name}" min="${min}" max="${max}" step="${step}" value="${settings[name]}" aria-label="${label}"></label>`).join('');
 diagnostics();
}
function persist(){try{localStorage.setItem(key,JSON.stringify({...settings,respect:String(respect),clip}));$('settings-status').textContent='Saved on this device. Replay without a build or deployment.';}catch{$('settings-status').textContent='Storage unavailable. Settings still work for this visit; copy a link to keep them.';}}
function diagnostics(){
 $('motion-state').textContent=media.matches?'Device: reduced motion':'';
 $('device-status').textContent=`Web Animations: ${typeof Element.prototype.animate==='function'?'supported':'unavailable'}. Device reduced motion: ${media.matches?'ON':'OFF'}. ${media.matches&&respect?'Movement is suppressed. Uncheck the preference above to test movement in this lab only.':'Movement is enabled in this lab.'}`;
 $('playback-status').textContent=`Last replay started ${tracks} animation tracks. Clip: ${clip}.`;
}
function stop(){run++;clearTimeout(sequenceTimer);motion?.reset();}
function render(packet){const v=packet.view,g=v.state.game;const actor=v.state.players.players.find(p=>p.id===g.currentPlayerId);$('app').innerHTML=gameScreen({view:v,heading:'Animation preview',description:'Scripted demo · use Tune to change timing.',actor:actor.name,actors:[g.currentPlayerId],resources:resourceHand(v),placements:'',actions:'<button data-lab="tune">Tune</button><button data-lab="sequence">Sequence</button><button class="primary" data-lab="replay">Replay</button>',recovery:'',cards:0,offer:'',continueOffer:''});draw($('board'),v,[],null,true,()=>{});}
async function play(next=clip,{inSequence=false}={}){
 if(!inSequence)stop();const token=run;clip=next;persist();const demo=scenario(next);motion?.reset();motion=createGameMotion({settings,reduced:()=>respect&&media.matches});render(demo.before);motion.present(demo.before);
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(token!==run)return;
 render(demo.after);motion.present(demo.after);tracks=document.getAnimations?.().length||0;diagnostics();
}
async function sequence(index=0){const token=run;await play(clips[index%clips.length],{inSequence:true});if(token!==run)return;const duration=clip==='roll'?Math.max(settings.gapMs,settings.diceMs+settings.holdMs+400,settings.diceMs+settings.flightMs+250):Math.max(settings.gapMs,settings.pieceMs+300,settings.flightMs+700);sequenceTimer=setTimeout(()=>sequence(index+1),duration);}
function open(){stop();writeControls();$('tuning').showModal();}
$('tune').onclick=open;$('replay').onclick=()=>play();$('close').onclick=()=>$('tuning').close();$('stop').onclick=()=>{stop();diagnostics();};
$('settings-form').onsubmit=e=>{e.preventDefault();$('tuning').close();play();};$('sequence').onclick=()=>{stop();$('tuning').close();sequence();};
$('settings-form').oninput=e=>{if(e.target.dataset.setting){const name=e.target.dataset.setting;settings=motionSettings({...settings,[name]:e.target.value});$(name+'-value').textContent=`${settings[name]} ${controls[name][4]}`;}if(e.target.id==='respect-motion')respect=e.target.checked;if(e.target.id==='clip')clip=e.target.value;persist();diagnostics();};
$('settings-form').onclick=e=>{const preset=e.target.closest('[data-preset]')?.dataset.preset;if(!preset)return;settings=motionSettings(preset==='clear'?{diceMs:1800,diceRotation:360,diceLift:16,pieceMs:900,pieceLift:24,flightMs:1100,holdMs:1400,gapMs:2000}:preset==='slow'?{diceMs:2600,diceRotation:720,diceLift:24,pieceMs:1500,pieceLift:35,flightMs:1600,holdMs:2000,gapMs:3000}:MOTION_DEFAULTS);writeControls();persist();};
async function copy(value){$('share-output').hidden=false;$('shared-value').value=value;try{await navigator.clipboard.writeText(value);$('settings-status').textContent='Copied. Paste it into the chat to share these settings.';}catch{$('settings-status').textContent='Select and copy the value below.';$('shared-value').select();}}
$('share').onclick=()=>{const url=new URL(location.href);url.search=new URLSearchParams({...settings,respect:String(respect),clip}).toString();copy(url.href);};$('export').onclick=()=>copy(JSON.stringify({...settings,respectReducedMotion:respect,clip},null,2));
$('reset').onclick=()=>{settings=motionSettings();respect=true;clip='roll';writeControls();persist();};
$('app').onclick=e=>{const action=e.target.closest('[data-lab]')?.dataset.lab;if(action==='tune')open();if(action==='replay')play();if(action==='sequence'){stop();sequence();}};
media.addEventListener('change',()=>{stop();diagnostics();});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
trackViewport();writeControls();play();
