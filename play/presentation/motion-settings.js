// Shared presentation defaults. The lab passes overrides; normal games use these values.
export const MOTION_DEFAULTS=Object.freeze({diceMs:3100,diceRotation:140,diceLift:0,pieceMs:1450,pieceLift:9,flightMs:2200,holdMs:0,gapMs:300});
const limits={diceMs:[200,6000],diceRotation:[0,1080],diceLift:[0,50],pieceMs:[150,4000],pieceLift:[0,60],flightMs:[200,4000],holdMs:[0,6000],gapMs:[300,8000]};
export function motionSettings(input={}){return Object.fromEntries(Object.entries(MOTION_DEFAULTS).map(([key,fallback])=>{const value=Number(input[key]??fallback),[min,max]=limits[key];return [key,Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):fallback];}));}

// A gap is a minimum interval, never permission to cut an animation short.
// These bounds include the renderer's lead-in, stagger and a short settling margin.
export function motionInterval(action,settings=MOTION_DEFAULTS){
 const t=motionSettings(settings),type=(action||'').toLowerCase().replaceAll('_',' ');
 if(type==='roll dice')return Math.max(t.gapMs,t.diceMs+t.holdMs+400,t.diceMs+t.flightMs+250);
 if(type==='buy development card')return Math.max(t.gapMs,950);
 if(type==='discard resources')return Math.max(t.gapMs,1100);
 if(['move robber','play knight'].includes(type))return Math.max(t.gapMs,t.pieceMs+250);
 if(type==='place road')return Math.max(t.gapMs,t.pieceMs+300);
 if(type==='place settlement')return Math.max(t.gapMs,t.pieceMs+300,t.flightMs+550);
 if(['build road','build settlement','build city'].includes(type))return Math.max(t.gapMs,t.pieceMs+300,t.flightMs+750);
 if(['trade accept','bank trade','play year of plenty','play monopoly','steal resource'].includes(type))return Math.max(t.gapMs,t.flightMs+550);
 return t.gapMs;
}
