// Shared read-only save audit and update metadata for windows and classic workers.
// Game snapshots/identities are never copied into the worker cache or messages.
self.GameShelfUpdateState=(()=>{
 const META='game-shelf-update-v1';
 async function read(name,store,key,all=false){return new Promise((resolve,reject)=>{
  let absent=false;const r=indexedDB.open(name);
  r.onupgradeneeded=()=>{absent=true;r.transaction.abort();};r.onerror=()=>absent?resolve(null):reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));
  r.onsuccess=()=>{const db=r.result;if(db.version!==1||!db.objectStoreNames.contains(store)){db.close();reject(Error('Unsupported storage'));return;}const tx=db.transaction(store),s=tx.objectStore(store),q=all?s.getAll():s.get(key);let value;q.onsuccess=()=>{value=q.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Storage unavailable'));};};
 });}
 async function metadata(value,removeVersion){return new Promise((resolve,reject)=>{
  const r=indexedDB.open(META,1);r.onupgradeneeded=()=>r.result.createObjectStore('metadata');r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('metadata','readwrite'),s=tx.objectStore('metadata');if(value)s.put(value,'fence');else{const q=s.get('fence');q.onsuccess=()=>{if(q.result?.version===removeVersion)s.delete('fence');};}tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Storage unavailable'));};};
 });}
 async function fence(){const value=await read(META,'metadata','fence');if(value&&(value.schemaVersion!==1||typeof value.version!=='string'||typeof value.engine!=='string'))throw Error('Unsupported update metadata');return value;}
 async function compatible(engine){
  const local=await read('game-shelf-solo-v1','records','library');
  if(local){if(local.schemaVersion!==1||!local.games||Array.isArray(local.games))return false;for(const g of Object.values(local.games)){if(g.abandoned)continue;const phase=g.state?.snapshot?.state?.game?.phase;if(typeof phase!=='string'||phase!=='ended'&&g.artifact!==engine)return false;}}
  const rows=await read('game-shelf-online-catan-v1','sessions',undefined,true)||[],indices=new Map(rows.filter(r=>r.channelId==='@index').map(r=>[r.principalId,r]));
  for(const r of rows){if(r.schemaVersion!==1||!Array.isArray(r.outbox)||r.outbox.length||r.intent)return false;if(indices.get(r.principalId)?.rooms?.[r.channelId]?.abandoned)continue;if(r.game){const phase=r.game.state?.snapshot?.state?.game?.phase;if(typeof phase!=='string'||phase!=='ended'&&r.game.moduleDigest!==engine)return false;}}
  return true;
 }
 return {fence,setFence:value=>metadata(value),clearFence:version=>metadata(null,version),compatible};
})();
