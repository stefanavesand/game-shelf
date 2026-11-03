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
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')check();});});
  await navigator.serviceWorker.ready;await check();
  button.onclick=async()=>{
   if(registration.waiting){const info=await ask(registration.waiting,'INFO');if(!await canUpdate(info.engine)){button.textContent='Finish the game or return home before updating';return;}registration.waiting.postMessage({type:'ACTIVATE'});}
   else{await registration.update();await check();}
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(registration.active&&navigator.serviceWorker.controller&&self.OFFLINE_VERSION!==undefined)ask(registration.active,'INFO').then(info=>{if(info.version!==self.OFFLINE_VERSION)location.reload();else check();});});
 }catch{button.textContent='Offline package unavailable · reconnect';}
}
