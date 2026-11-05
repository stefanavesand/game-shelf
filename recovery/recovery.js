// Standalone metadata recovery: deliberately imports no cached app/engine code.
const status=document.getElementById('status'),list=document.getElementById('games');
let database;
async function db(){
 if(!navigator.locks)throw Error('This browser cannot coordinate recovery safely.');
 if(database)return database;
 database=await new Promise((resolve,reject)=>{const request=indexedDB.open('game-shelf-solo-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onsuccess=()=>resolve(request.result);request.onerror=request.onblocked=()=>reject(Error('Local storage could not be opened. Nothing was changed.'));});return database;
}
async function read(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('records'),r=tx.objectStore('records').get('library');let value;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(Error('Local games could not be read. Nothing was changed.'));});}
async function abandon(key){
 if(!confirm('Abandon this local game? Its snapshot will be kept, but it will no longer be resumable in the app.'))return;
 await navigator.locks.request('game-shelf-app-lifecycle',{mode:'exclusive'},()=>navigator.locks.request('game-shelf-local-solo',async()=>{
  const d=await db();await new Promise((resolve,reject)=>{
   const tx=d.transaction('records','readwrite'),store=tx.objectStore('records'),r=store.get('library');
   r.onsuccess=()=>{const value=r.result;if(value?.schemaVersion!==1||!value.games?.[key]){tx.abort();return;}value.games[key].abandoned=true;if(value.current===key){value.current=null;value.local=false;}store.put(value,'library');};
   tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('The save could not be updated. Recovery was not completed.'));
  });
 }));
 await render();status.textContent='Game abandoned. Return to the app, check for updates, then start a new game.';
}
async function render(){
 const value=await read();if(value&&value.schemaVersion!==1)throw Error('This library uses an unsupported format. Nothing was changed.');
 const games=Object.entries(value?.games??{}).filter(([,g])=>!g.abandoned);list.replaceChildren();
 for(const [key,g]of games){const row=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('small'),button=document.createElement('button');title.textContent=g.state?.snapshot?.seats?.map(s=>s.name).join(' · ')||'Local game';info.textContent=`Game ${key} · ${g.state?.snapshot?.state?.game?.phase||'unknown phase'}`;button.textContent='Abandon local game';button.onclick=async()=>{button.disabled=true;try{await abandon(key);}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};row.append(title,info,button);list.append(row);}
 status.textContent=games.length?'Choose the local game to abandon.':'No active local games found in this browser. Return to the app to check for updates.';
}
render().catch(error=>{status.textContent=error.message;});
