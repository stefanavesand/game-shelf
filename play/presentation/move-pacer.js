import {MOTION_DEFAULTS,motionInterval} from './motion-settings.js';
// Foreground UI pacing only. Headless clients and the deterministic engine stay fast.
export const BOT_ACTION_MS=MOTION_DEFAULTS.gapMs;
export const DICE_ACTION_MS=motionInterval('roll dice');
export function createMovePacer({now=Date.now,delay=BOT_ACTION_MS,random=Math.random}={}){
 let key=null,due=0,changed=0;
 function observe(packet){const next=packet?.ok&&packet.view?`${packet.roomId}:${packet.revision}`:null;if(next!==key){key=next;changed=now();due=changed+Math.max(delay,motionInterval(packet.view.history?.at(-1)?.message),packet.view.offer?2000+Math.floor(Math.max(0,Math.min(1,random()))*3000):0);}}
 return {
  observe,
  remaining(packet){observe(packet);return Math.max(0,due-now());},
  takeBudget(packet){observe(packet);if(!packet?.botWorkPending||now()<due)return 0;due=now()+delay;return 1;},
  recentlyChanged(){return now()-changed<15000;},
  reset(){key=null;due=changed=0;}
 };
}
