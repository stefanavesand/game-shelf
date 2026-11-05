import {withUpdateLock} from './lifecycle.js';
import './offline-assets.js';
export async function setupPwa({canUpdate=async()=>false,isIdle=()=>false}={}){
 const button=document.getElementById('offline-status');if(!button)return;
 if(!('serviceWorker'in navigator)){button.textContent='Offline installation unavailable';button.disabled=true;return;}
 let registration,blockedInstall=false,automaticReady=false,automaticBusy=false;
 const ask=(worker,type)=>new Promise((resolve,reject)=>{if(!worker){reject(Error());return;}const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error()),15000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.postMessage({type},[channel.port2]);});
 async function automaticUpdate(){
  if(!automaticReady||automaticBusy||!registration?.waiting||document.hidden||!navigator.onLine||!isIdle())return;
  automaticBusy=true;
  try{const worker=registration.waiting,meta=await ask(worker,'INFO');if(meta.breaking!==false||typeof meta.releaseVersion!=='string'||!isIdle())return;const info=await ask(worker,'CHECK');if(info.ready&&isIdle())await button.onclick({automatic:true});}
  catch{/* Keep the current app and the explicit update control available. */}
  finally{automaticBusy=false;}
 }
 async function check(){
  try{if(registration.waiting){button.textContent='Update available';automaticUpdate();return;}
   const status=await ask(registration.active,'CHECK');button.textContent=status.ready&&status.version===self.OFFLINE_VERSION?'Ready for offline':'Downloading offline package…';
  }catch{button.textContent='Offline package unavailable · retry';}
 }
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  button.onclick=()=>registration.update();
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_BLOCKED'){blockedInstall=true;button.textContent='Update blocked · saved games or pending moves need attention';}});
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')check();if(worker.state==='redundant'&&!blockedInstall)button.textContent='Offline download failed · reconnect and retry';});});
  await navigator.serviceWorker.ready;await check();
  button.onclick=async(event)=>{
   try{
    if(registration.waiting){const worker=registration.waiting;let info=await ask(worker,'CHECK');
     if(!info.ready){button.textContent='Repairing update…';info=await ask(worker,'REPAIR');}
     if(!info.ready){button.textContent='Update incomplete · current app kept · retry';return;}
     let blocked=false;
     const activated=await withUpdateLock(async()=>{
      if(!await canUpdate(info.engine)||(event?.automatic&&!isIdle())){blocked=true;button.textContent='Finish the game or return home before updating';return false;}
      const result=await ask(worker,'ACTIVATE');
      if(result.ready&&worker.state!=='activated')await new Promise((resolve,reject)=>{
       const changed=()=>{if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(Error('Update replaced'));}};
       const timer=setTimeout(()=>{worker.removeEventListener('statechange',changed);reject(Error('Activation timeout'));},15000);worker.addEventListener('statechange',changed);changed();
      });
      return result.ready;
     });
     if(activated===null)button.textContent='Another window is saving or sending a move · retry when it finishes';
     else if(activated===false&&!blocked)button.textContent='Update incomplete · current app kept · retry';
    }else{
     blockedInstall=false;await registration.update();
     if(!registration.waiting&&!(await ask(registration.active,'CHECK')).ready){button.textContent='Repairing offline package…';const repaired=await ask(registration.active,'REPAIR');if(!repaired.ready){button.textContent='Offline package incomplete · current files kept · retry';return;}}
     await check();
    }
   }catch{button.textContent='Update check failed · current app kept · retry';}
  };
  automaticReady=true;
  const automaticTimer=setInterval(automaticUpdate,1500);
  window.addEventListener('pagehide',()=>clearInterval(automaticTimer),{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)automaticUpdate();});
  automaticUpdate();
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(registration.active&&navigator.serviceWorker.controller&&self.OFFLINE_VERSION!==undefined)ask(registration.active,'INFO').then(info=>{if(info.version!==self.OFFLINE_VERSION)location.reload();else check();});});
 }catch{button.textContent='Offline package unavailable · reconnect';}
}
