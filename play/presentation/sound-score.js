import {FEEDBACK_PROFILE} from './feedback-profile.js';
// Exact selected Sites recipes. This randomness is audio texture, never game entropy.
export function feedbackScore(event,duration=FEEDBACK_PROFILE[event]?.duration,random=Math.random){
 const events=[],tone=(at,hz,len,gain,type='sine',end=hz)=>events.push({kind:'tone',at,hz,len,gain,type,end}),noise=(at,len,from,to,gain)=>events.push({kind:'noise',at,len,from,to,gain});
 if(event==='dice'){
  const seconds=(Number.isFinite(duration)?Math.max(200,Math.min(6000,duration)):1100)/1000;
  noise(0,seconds*.8,240,130,.035);
  for(let i=0;i<12;i++){const at=Math.max(0,(i/12)**.82*seconds*.91+(random()-.5)*seconds*.025),gain=(1-i/16)*.07;noise(at,.045,650,240,gain);tone(at,180,.055,gain*.42,'triangle',100);}
 }else if(event==='piece'){tone(0,180,.075,.09,'sine',100);noise(0,.035,500,250,.045);}
 else if(event==='cards')noise(0,.45,400,1200,.075);
 else if(event==='turn')[660,785,988].forEach((hz,i)=>tone(i*.09,hz,.14,.05,'triangle'));
 return events;
}
