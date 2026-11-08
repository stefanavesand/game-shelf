// Shared presentation defaults. The lab passes overrides; normal games use these values.
export const MOTION_DEFAULTS=Object.freeze({diceMs:1200,diceRotation:20,diceLift:6,pieceMs:600,pieceLift:16,flightMs:750,holdMs:1000,gapMs:1500});
const limits={diceMs:[200,6000],diceRotation:[0,1080],diceLift:[0,50],pieceMs:[150,4000],pieceLift:[0,60],flightMs:[200,4000],holdMs:[0,6000],gapMs:[300,8000]};
export function motionSettings(input={}){return Object.fromEntries(Object.entries(MOTION_DEFAULTS).map(([key,fallback])=>{const value=Number(input[key]??fallback),[min,max]=limits[key];return [key,Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):fallback];}));}
