import {withUpdateLock} from './lifecycle.js';
import './offline-assets.js';
export let updates=null;
export async function setupPwa({canUpdate=async()=>false,isIdle=()=>false,onReloadPending=()=>{}}={}){
 const status=document.getElementById('offline-status');if(!status)return;
 const show=text=>{if(status.textContent!==text)status.textContent=text;};
 if(!('serviceWorker'in navigator)){show('Offline installation unavailable');return;}
 let registration,blockedInstall=false,automaticReady=false,automaticBusy=false,discoveryBusy=false,lastDiscovery=0,pendingReload=null;
 let retryAt=0,discoveryAgain=false;
 const ask=(worker,type)=>new Promise((resolve,reject)=>{if(!worker){reject(Error());return;}const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error());},15000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type},[channel.port2]);});
 async function automaticUpdate(){
  if(!automaticReady||automaticBusy||document.hidden||!navigator.onLine||!isIdle())return;
  if(pendingReload){automaticBusy=true;try{await withUpdateLock(async()=>{if(isIdle()&&await canUpdate(pendingReload.engine))location.reload();});}finally{automaticBusy=false;}return;}
  if(!registration?.waiting||Date.now()<retryAt)return;
  automaticBusy=true;
  try{const worker=registration.waiting,meta=await ask(worker,'INFO');if(typeof meta.releaseVersion!=='string'||!isIdle())return;if(isIdle())await updates.check({automatic:true});}
  catch{/* Keep the current app and retry at the next safe foreground check. */}
  finally{automaticBusy=false;}
 }
 async function check(){
  try{if(registration.waiting){show('Update ready · installs automatically on Home');automaticUpdate();return;}
   const info=await ask(registration.active,'CHECK');show(info.ready&&info.version===self.OFFLINE_VERSION?'Ready for offline':'Downloading offline package…');
  }catch{show('Offline package unavailable · retrying automatically');}
 }
 async function discover(){
  if(document.hidden||!navigator.onLine)return;
  if(discoveryBusy){discoveryAgain=true;return;}
  if(Date.now()-lastDiscovery<30000)return;
  discoveryBusy=true;lastDiscovery=Date.now();
  try{await registration.update();if(!registration.waiting&&!(await ask(registration.active,'CHECK')).ready){show('Repairing offline package…');const repaired=await ask(registration.active,'REPAIR');if(!repaired.ready){show('Offline package incomplete · retrying automatically');return;}}await check();}
  catch{/* Keep offline readiness and retry discovery on the next foreground check. */}
  finally{discoveryBusy=false;if(discoveryAgain){discoveryAgain=false;queueMicrotask(discover);}}
 }
 function watch(worker){worker?.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')check();if(worker.state==='redundant'&&!blockedInstall)show('Offline download failed · retrying automatically when online');});}
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_IDLE_QUERY')event.ports[0]?.postMessage({idle:isIdle()});});
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_BLOCKED'){blockedInstall=true;show('Update blocked · saved games or pending moves need attention');}});
  registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);
  await navigator.serviceWorker.ready;await check();
  updates={check:async(event)=>{
   try{
    if(registration.waiting){const worker=registration.waiting;let info=await ask(worker,'CHECK');
     if(!info.ready){show('Repairing update…');info=await ask(worker,'REPAIR');}
     if(!info.ready){retryAt=Date.now()+30000;show('Update incomplete · current app kept · retrying automatically');return;}
     let blocked=false;
     const activated=await withUpdateLock(async()=>{
      if(!await canUpdate(info.engine)||!isIdle()){blocked=true;show('Update waiting · finish the game or return home');return false;}
      const result=await ask(worker,'ACTIVATE');
      if(result.ready&&worker.state!=='activated')await new Promise((resolve,reject)=>{
       const changed=()=>{if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(Error('Update replaced'));}};
       const timer=setTimeout(()=>{worker.removeEventListener('statechange',changed);reject(Error('Activation timeout'));},15000);worker.addEventListener('statechange',changed);changed();
      });
      return result.ready;
     });
     if(activated===null)show('Update waiting · another window is saving or sending a move');
     else if(activated===false&&!blocked)show('Update waiting · another open window is still in use');
    }else{
     blockedInstall=false;await registration.update();
     if(!registration.waiting&&!(await ask(registration.active,'CHECK')).ready){show('Repairing offline package…');const repaired=await ask(registration.active,'REPAIR');if(!repaired.ready){show('Offline package incomplete · current files kept · retrying automatically');return;}}
     await check();
    }
   }catch{retryAt=Date.now()+30000;show('Update check failed · current app kept · retrying automatically');}
  }};
  automaticReady=true;
  let automaticTimer,discoveryTimer;
  function startTimers(){clearInterval(automaticTimer);clearInterval(discoveryTimer);automaticTimer=setInterval(automaticUpdate,1500);discoveryTimer=setInterval(discover,60000);}
  window.addEventListener('pagehide',()=>{clearInterval(automaticTimer);clearInterval(discoveryTimer);});
  window.addEventListener('pageshow',()=>{startTimers();discover();automaticUpdate();});
  window.addEventListener('focus',()=>{discover();automaticUpdate();});
  window.addEventListener('online',()=>{discover();automaticUpdate();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){discover();automaticUpdate();}});
  startTimers();discover();automaticUpdate();
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(registration.active&&navigator.serviceWorker.controller&&self.OFFLINE_VERSION!==undefined)ask(registration.active,'INFO').then(info=>{if(info.version!==self.OFFLINE_VERSION){pendingReload=info;show('Updating app…');onReloadPending();automaticUpdate();}else check();});});
 }catch{
  show('Offline package unavailable · retrying automatically');const controller=new AbortController();
  const retry=()=>{if(document.hidden||!navigator.onLine)return;clearInterval(timer);controller.abort();setupPwa({canUpdate,isIdle,onReloadPending});};
  const timer=setInterval(retry,30000);window.addEventListener('online',retry,{signal:controller.signal});document.addEventListener('visibilitychange',retry,{signal:controller.signal});
 }
}
