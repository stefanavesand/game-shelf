import {PlayError} from './errors.js';
import {validateSaved,validatePacket} from './protocol.js';
export const LEGACY_STATE='game-shelf-catan-online-v1';
export const AUTH_KEY='spelhyllan-online-auth-v1';
const blank=()=>({schemaVersion:1,roomId:null,pending:null});
const failure=()=>new PlayError('STORAGE_FAILURE','Your player data could not be saved or read. No new move was sent. Keep this installation and fix storage before continuing.');
export function createStore({idb,local}={}){
  let database;
  function readLegacy(){try{const raw=(local??globalThis.localStorage).getItem(LEGACY_STATE);return {raw,state:raw?validateSaved(JSON.parse(raw)):blank()};}catch(e){if(e instanceof PlayError)throw e;throw failure();}}
  async function db(){if(!database)database=new Promise((resolve,reject)=>{const req=(idb??globalThis.indexedDB).open('game-shelf-online',1);req.onupgradeneeded=()=>{req.result.createObjectStore('records');};req.onsuccess=()=>{const value=req.result;value.onversionchange=()=>{value.close();database=null;};resolve(value);};req.onerror=req.onblocked=()=>{database=null;reject(failure());};});return database;}
  async function record(key,value){try{const connection=await db();return await new Promise((resolve,reject)=>{const tx=connection.transaction('records',value===undefined?'readonly':'readwrite'),store=tx.objectStore('records');let result;const req=value===undefined?store.get(key):store.put(value,key);req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(failure());});}catch(e){if(e instanceof PlayError)throw e;throw failure();}}
  async function state(){
    const legacy=readLegacy(),saved=await record('current');
    if(!saved){await record('current',{state:legacy.state,legacyMirror:legacy.raw});return legacy.state;}
    validateSaved(saved.state);
    // A different legacy value indicates an old client wrote while holding the same lock.
    if(legacy.raw!==null&&legacy.raw!==saved.legacyMirror){await record('current',{state:legacy.state,legacyMirror:legacy.raw});return legacy.state;}
    const canonical=JSON.stringify(saved.state);
    if(canonical!==legacy.raw){try{(local??globalThis.localStorage).setItem(LEGACY_STATE,canonical);}catch{throw failure();}await record('current',{state:saved.state,legacyMirror:canonical});}
    return saved.state;
  }
  async function save(next){
    validateSaved(next);const legacy=readLegacy();
    // Commit IndexedDB first. If mirroring fails, its prior fingerprint prevents
    // the stale legacy copy from overwriting the new unresolved intent on reopen.
    await record('current',{state:next,legacyMirror:legacy.raw});
    const raw=JSON.stringify(next);try{(local??globalThis.localStorage).setItem(LEGACY_STATE,raw);}catch{throw failure();}
    await record('current',{state:next,legacyMirror:raw});
  }
  async function cache(packet,principalId){validatePacket(packet);if(packet.ok)await record(`view:${principalId}:${packet.roomId}`,{packet,principalId,lastSeenAt:Date.now()});}
  async function cached(roomId,principalId){const cached=await record(`view:${principalId}:${roomId}`);if(!cached||cached.principalId!==principalId)return null;return validatePacket(cached.packet);}
  async function games(principalId){
    if(!principalId)return [];
    try{
      const connection=await db();
      const rows=await new Promise((resolve,reject)=>{const tx=connection.transaction('records','readonly'),req=tx.objectStore('records').getAll();let rows;req.onsuccess=()=>{rows=req.result;};tx.oncomplete=()=>resolve(rows);tx.onabort=tx.onerror=()=>reject(failure());});
      return rows.filter(r=>r.principalId===principalId&&r.packet?.ok).map(r=>{
        const p=validatePacket(r.packet),bots=p.members.filter(m=>m.kind==='bot');
        return {roomId:p.roomId,status:p.status,players:p.members.map(m=>m.name),mode:bots.length===2?'solo':'friends',botLevel:bots[0]?.level||'standard',lastSeenAt:r.lastSeenAt||0};
      }).sort((a,b)=>b.lastSeenAt-a.lastSeenAt);
    }catch(e){if(e instanceof PlayError)throw e;throw failure();}
  }
  return {state,save,cache,cached,games};
}
