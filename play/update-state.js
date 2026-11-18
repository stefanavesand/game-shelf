// Shared read-only save audit and update metadata for windows and classic workers.
// Game snapshots/identities are never copied into the worker cache or messages.
self.GameShelfUpdateState=(()=>{
 const META='game-shelf-update-v1';
 async function read(name,store,key,all=false){return new Promise((resolve,reject)=>{
  let absent=false;const r=indexedDB.open(name);
  r.onupgradeneeded=()=>{absent=true;r.transaction.abort();};r.onerror=()=>absent?resolve(null):reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));
  r.onsuccess=()=>{const db=r.result;if(db.version!==1||!db.objectStoreNames.contains(store)){db.close();reject(Error('Unsupported storage'));return;}const tx=db.transaction(store),s=tx.objectStore(store),q=all?s.getAll(all==='accounts'?IDBKeyRange.bound('account:','account:\uffff'):undefined):s.get(key);let value;q.onsuccess=()=>{value=q.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Storage unavailable'));};};
 });}
 async function metadata(value,removeVersion){return new Promise((resolve,reject)=>{
  const r=indexedDB.open(META,1);r.onupgradeneeded=()=>r.result.createObjectStore('metadata');r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('metadata','readwrite'),s=tx.objectStore('metadata');if(value)s.put(value,'fence');else{const q=s.get('fence');q.onsuccess=()=>{if(q.result?.version===removeVersion)s.delete('fence');};}tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Storage unavailable'));};};
 });}
 async function fence(){const value=await read(META,'metadata','fence');if(value&&(value.schemaVersion!==1||typeof value.version!=='string'||typeof value.engine!=='string'))throw Error('Unsupported update metadata');return value;}
 async function compatible(engine,{ignoreEnginePins=false}={}){
  const libraries=await read('game-shelf-solo-v1','records',undefined,'accounts')||[];
  for(const local of libraries){if(local.schemaVersion!==1||!local.games||Array.isArray(local.games))return false;for(const g of Object.values(local.games)){if(g.abandoned||ignoreEnginePins&&g.artifact!==engine)continue;const phase=g.state?.snapshot?.state?.game?.phase;if(typeof phase!=='string'||phase!=='ended'&&!ignoreEnginePins&&g.artifact!==engine)return false;}}
  const rows=await read('game-shelf-online-catan-v1','sessions',undefined,true)||[],indices=new Map(rows.filter(r=>r.channelId==='@index').map(r=>[r.principalId,r]));
  for(const r of rows){if(ignoreEnginePins&&r.channelId!=='@index'&&r.schemaVersion===1&&r.game&&r.game.moduleDigest!==engine)continue;if(r.schemaVersion!==1||!Array.isArray(r.outbox)||r.outbox.length||r.intent)return false;if(indices.get(r.principalId)?.rooms?.[r.channelId]?.abandoned)continue;if(r.game){if(Object.values(r.game.randomRequests||{}).some(p=>!p.superseded&&p.baseGameRevision===r.game.revision&&!Object.hasOwn(r.game.seen||{},p.intentId)))return false;const phase=r.game.state?.snapshot?.state?.game?.phase;if(typeof phase!=='string'||phase!=='ended'&&!ignoreEnginePins&&r.game.moduleDigest!==engine)return false;}}
  return true;
 }

 async function localEntries(){return new Promise((resolve,reject)=>{
  let absent=false;const r=indexedDB.open('game-shelf-solo-v1');r.onupgradeneeded=()=>{absent=true;r.transaction.abort();};r.onerror=()=>absent?resolve([]):reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));
  r.onsuccess=()=>{const db=r.result;if(db.version!==1||!db.objectStoreNames.contains('records')){db.close();reject(Error('Unsupported storage'));return;}const tx=db.transaction('records'),q=tx.objectStore('records').openCursor(IDBKeyRange.bound('account:','account:\uffff')),entries=[];q.onsuccess=()=>{const c=q.result;if(c){entries.push({key:c.key,value:c.value});c.continue();}};tx.oncomplete=()=>{db.close();resolve(entries);};tx.onerror=tx.onabort=()=>{db.close();reject(Error('Storage unavailable'));};};
 });}
 async function incompatible(engine,policies=null){
  const found=[];
  for(const {key,value}of await localEntries()){if(value.schemaVersion!==1||!value.games||Array.isArray(value.games))throw Error('Unsupported local library');for(const [roomId,g]of Object.entries(value.games))if(!g.abandoned&&(g.artifact!==engine||policies&&!policies.includes(g.botPolicy)))found.push({kind:'solo',owner:key,roomId});}
  const rows=await read('game-shelf-online-catan-v1','sessions',undefined,true)||[],indices=new Map(rows.filter(r=>r.channelId==='@index').map(r=>[r.principalId,r]));
  for(const r of rows)if(r.channelId!=='@index'&&!indices.get(r.principalId)?.rooms?.[r.channelId]?.abandoned&&r.game&&r.game.moduleDigest!==engine)found.push({kind:'online',owner:r.principalId,roomId:r.channelId});
  return found;
 }
 // The caller holds the exclusive lifecycle lock. Recheck compatibility inside
 // each write transaction; keep identities, compatible games and snapshots intact.
 async function discardIncompatible(engine,approved,policies=null){
  for(const item of approved){if(!['solo','online'].includes(item.kind)||typeof item.owner!=='string'||typeof item.roomId!=='string')throw Error('Unsupported game reference');await new Promise((resolve,reject)=>{
   const local=item.kind==='solo';let stopped=false,absent=false;const r=indexedDB.open(local?'game-shelf-solo-v1':'game-shelf-online-catan-v1',1);r.onupgradeneeded=()=>{absent=true;r.transaction.abort();};r.onerror=()=>{stopped=true;absent?resolve():reject(Error('Storage unavailable'));};r.onblocked=()=>{stopped=true;reject(Error('Storage unavailable'));};
   r.onsuccess=()=>{const db=r.result,name=local?'records':'sessions';if(stopped){db.close();return;}if(!db.objectStoreNames.contains(name)){db.close();reject(Error('Unsupported storage'));return;}const tx=db.transaction(name,'readwrite'),store=tx.objectStore(name);
    if(local){const q=store.get(item.owner);q.onsuccess=()=>{const lib=q.result,g=lib?.games?.[item.roomId];if(!lib)return;if(lib.schemaVersion!==1){tx.abort();return;}if(!g||g.abandoned||g.artifact===engine&&(!policies||policies.includes(g.botPolicy)))return;g.abandoned=true;if(lib.current===item.roomId){lib.current=null;lib.local=false;}store.put(lib,item.owner);};}
    else{let index,game,done=0;const update=()=>{if(++done!==2)return;if(index&&index.schemaVersion!==1||game&&game.schemaVersion!==1){tx.abort();return;}if(!index?.rooms?.[item.roomId]||index.rooms[item.roomId].abandoned||!game?.game||game.game.moduleDigest===engine)return;index.rooms[item.roomId].abandoned=true;if(index.current===item.roomId)index.current=null;game.abandonedOutbox=game.outbox;game.outbox=[];game.halt={code:'GAME_REMOVED',message:'This incompatible game was removed on this device.'};store.put(index,[item.owner,'@index']);store.put(game,[item.owner,item.roomId]);};const a=store.get([item.owner,'@index']),b=store.get([item.owner,item.roomId]);a.onsuccess=()=>{index=a.result;update();};b.onsuccess=()=>{game=b.result;update();};}
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(Error('The game could not be removed. Try again.'));};
   };
  });}
 }
 return {fence,setFence:value=>metadata(value),clearFence:version=>metadata(null,version),compatible,incompatible,discardIncompatible};
})();
