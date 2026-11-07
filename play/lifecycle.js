import './update-state.js';
import {PlayError} from './core/errors.js';
const KEY='game-shelf-app-lifecycle';
function locks(){if(!globalThis.navigator?.locks)throw new PlayError('UNSUPPORTED_BROWSER','This browser cannot coordinate app updates safely.');return navigator.locks;}
async function currentVersion(){
 if(!globalThis.OFFLINE_VERSION||!navigator.serviceWorker)return;
 const worker=(await navigator.serviceWorker.getRegistration())?.active;
 if(worker){const info=await new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new PlayError('UNSUPPORTED_VERSION','The active app version could not be checked. Reload before playing.'));},5000);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
  try{worker.postMessage({type:'INFO'},[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
 });
 if(info.version!==globalThis.OFFLINE_VERSION)throw new PlayError('UNSUPPORTED_VERSION','The app was updated in another window. Reload before making another move.');}
 let fence;try{fence=await self.GameShelfUpdateState.fence();}catch{throw new PlayError('STORAGE_FAILURE','Update state could not be read. No new move was sent.');}
 if(fence&&fence.engine!==globalThis.OFFLINE_ENGINE){
  const registration=await navigator.serviceWorker.getRegistration();
  if(registration?.installing||registration?.waiting)throw new PlayError('UPDATE_PENDING',registration.waiting?'An engine update is ready. Return home and it will install automatically before another game.':'An engine update is downloading. It will install automatically on Home before another game.');
  await self.GameShelfUpdateState.clearFence(fence.version);
 }
}
// Session work can overlap; existing game/index locks serialize actual writes.
export const withSessionLock=work=>locks().request(KEY,{mode:'shared'},async()=>{await currentVersion();return work();});
// Do not queue an update behind a long/unknown delivery. Keep the old app usable.
export const withUpdateLock=work=>locks().request(KEY,{mode:'exclusive',ifAvailable:true},lock=>lock?work():null);
