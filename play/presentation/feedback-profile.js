// Owner-selected settings from the standalone Sites studio, 2026-11-21.
export const FEEDBACK_PROFILE=Object.freeze(Object.fromEntries(Object.entries({
 cards:{sound:'soft',motion:'current',respectReducedMotion:true,duration:2200,volume:35,rotation:140,lift:12,offset:0},
 turn:{sound:'pluck',motion:'current',respectReducedMotion:true,duration:800,volume:35,rotation:140,lift:12,offset:0},
 piece:{sound:'felt',motion:'current',respectReducedMotion:true,duration:1450,volume:35,rotation:140,lift:9,offset:0},
 dice:{sound:'felt',motion:'current',respectReducedMotion:false,duration:1100,volume:35,rotation:510,lift:0,offset:0}
}).map(([event,value])=>[event,Object.freeze({studioVersion:1,event,...value})])));
export const reduceFeedback=(event,reduced)=>!!reduced&&FEEDBACK_PROFILE[event].respectReducedMotion;
export function needsTurnAttention(view){const g=view.state.game;return g.phase!=='ended'&&(g.phase==='discard'?g.pendingDiscard?.includes(view.you):g.currentPlayerId===view.you);}
