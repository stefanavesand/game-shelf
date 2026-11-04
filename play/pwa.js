import './offline-assets.js';
export async function setupPwa({canUpdate=async()=>false}={}){
 const button=document.getElementById('offline-status');if(!button)return;
 if(!('serviceWorker'in navigator)){button.textContent='Offline installation unavailable';button.disabled=true;return;}
 let registration;
 const ask=(worker,type)=>new Promise((resolve,reject)=>{if(!worker){reject(Error());return;}const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error()),15000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.postMessage({type},[channel.port2]);});
 async function check(){
  try{if(registration.waiting){button.textContent='Update available';return;}
   const status=await ask(registration.active,'CHECK');button.textContent=status.ready&&status.version===self.OFFLINE_VERSION?'Ready for offline':'Downloading offline package…';
  }catch{button.textContent='Offline package unavailable · retry';}
 }
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  button.onclick=()=>registration.update();
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')check();if(worker.state==='redundant')button.textContent='Offline download failed · reconnect and retry';});});
  await navigator.serviceWorker.ready;await check();
  button.onclick=async()=>{
   try{
    if(registration.waiting){const worker=registration.waiting;let info=await ask(worker,'CHECK');
     if(!info.ready){button.textContent='Repairing update…';info=await ask(worker,'REPAIR');}
     if(!info.ready){button.textContent='Update incomplete · current app kept · retry';return;}
     if(!await canUpdate(info.engine)){button.textContent='Finish the game or return home before updating';return;}
     if(!(await ask(worker,'ACTIVATE')).ready)button.textContent='Update incomplete · current app kept · retry';
    }else{
     await registration.update();
     if(!registration.waiting&&!(await ask(registration.active,'CHECK')).ready){button.textContent='Repairing offline package…';const repaired=await ask(registration.active,'REPAIR');if(!repaired.ready){button.textContent='Offline package incomplete · current files kept · retry';return;}}
     await check();
    }
   }catch{button.textContent='Update check failed · current app kept · retry';}
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(registration.active&&navigator.serviceWorker.controller&&self.OFFLINE_VERSION!==undefined)ask(registration.active,'INFO').then(info=>{if(info.version!==self.OFFLINE_VERSION)location.reload();else check();});});
 }catch{button.textContent='Offline package unavailable · reconnect';}
}
