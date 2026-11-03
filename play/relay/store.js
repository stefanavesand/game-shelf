import {RelayError,clone,invariant} from './protocol.js';
export const emptyRecord=(principalId,channelId)=>({schemaVersion:1,principalId,channelId,cursor:0,game:null,outbox:[],halt:null,retryAt:0});
export function validateRecord(record,principalId,channelId) {
  invariant(record?.schemaVersion===1&&record.principalId===principalId&&record.channelId===channelId&&Number.isSafeInteger(record.cursor)&&record.cursor>=0&&Array.isArray(record.outbox),'INVALID_SAVE','The saved relay session is incompatible.');
  return record;
}
export function createRelayStore({indexedDB=globalThis.indexedDB,name='game-shelf-relay-v1'}={}) {
  let connection;
  const fail=()=>new RelayError('STORAGE_FAILURE','Local game storage is unavailable. No new message was sent.');
  async function db() {
    if(!connection)connection=new Promise((resolve,reject)=>{
      if(!indexedDB){reject(fail());return;}
      const req=indexedDB.open(name,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('sessions');
      req.onerror=req.onblocked=()=>{connection=null;reject(fail());};
      req.onsuccess=()=>{const value=req.result;value.onversionchange=()=>{value.close();connection=null;};resolve(value);};
    });
    return connection;
  }
  async function record(principalId,channelId,value) {
    try {
      const database=await db();return await new Promise((resolve,reject)=>{
        const tx=database.transaction('sessions',value===undefined?'readonly':'readwrite');
        const store=tx.objectStore('sessions'),key=[principalId,channelId];let result;
        const req=value===undefined?store.get(key):store.put(clone(value),key);
        req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(value===undefined?result:value);tx.onabort=tx.onerror=()=>reject(fail());
      });
    }catch(error){if(error instanceof RelayError)throw error;throw fail();}
  }
  return {
    async load(principalId,channelId){return validateRecord(await record(principalId,channelId)??emptyRecord(principalId,channelId),principalId,channelId);},
    async save(value){validateRecord(value,value.principalId,value.channelId);await record(value.principalId,value.channelId,value);},
    async requestPersistence(storage=globalThis.navigator?.storage){try{return {supported:!!storage?.persist,granted:storage?.persist?await storage.persist():false};}catch{return {supported:true,granted:false};}},
    async close(){if(connection)(await connection).close();connection=null;}
  };
}
export function createMemoryStore() {
  const values=new Map();return {async load(p,c){return clone(values.get(JSON.stringify([p,c]))??emptyRecord(p,c));},async save(v){values.set(JSON.stringify([v.principalId,v.channelId]),clone(v));}};
}
