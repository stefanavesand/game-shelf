import {createCatanModule,catanConfig} from '../catan/module.js';
import {CATAN_ARTIFACT} from '../catan/artifact.js';
import {digest,clone} from '../relay/protocol.js';
import {RuleRejection} from '../relay/replica.js';
import {PlayError,locked} from '../core/errors.js';
const module=createCatanModule(CATAN_ARTIFACT.compatibilityId),blank=()=>({schemaVersion:1,local:false,current:null,games:{}});
export function createLocalStorage({indexedDB=globalThis.indexedDB}={}){
 let database;
 const failure=()=>new PlayError('STORAGE_FAILURE','Local storage is unavailable. No new move was saved.');
 async function db(){if(!database)database=new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-solo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onerror=r.onblocked=()=>reject(failure());r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();database=null;};resolve(r.result);};});return database;}
 async function record(value){try{const d=await db();return await new Promise((resolve,reject)=>{const tx=d.transaction('records',value?'readwrite':'readonly'),s=tx.objectStore('records'),r=value?s.put(value,'library'):s.get('library');let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(value??result??blank());tx.onabort=tx.onerror=()=>reject(failure());});}catch{throw failure();}}
 return {load:()=>record(),save:value=>record(clone(value))};
}
export function createLocalClient({storage=createLocalStorage(),locks=globalThis.navigator?.locks,id=()=>crypto.randomUUID(),seed=()=>{const n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(!n[0]);return n[0];}}={}){
 const lock=work=>locked('game-shelf-local-solo',work,locks);let local=false;
 async function load(){const lib=await storage.load();if(lib.schemaVersion!==1)throw new PlayError('UNSUPPORTED_VERSION','This local save needs a compatible app.');local=lib.local;return lib;}
 async function verify(game){if(game.artifact!==CATAN_ARTIFACT.compatibilityId)throw new PlayError('UNSUPPORTED_VERSION','This game needs its original engine version.');if(await digest(game.state)!==game.hash)throw new PlayError('STORAGE_FAILURE','The saved game failed its integrity check.');}
 async function commit(lib,game,next){game.state=next;game.hash=await digest(next);await storage.save(lib);}
 async function bots(lib,game){for(let i=0;i<8;i++){const command=module.nextBot(game.state);if(!command)return;await commit(lib,game,module.apply(game.state,'p1',command,{}, {coordinatorId:'p1'}));}}
 function packet(game){const s=game.state.snapshot;return {ok:true,apiVersion:1,roomId:s.id,you:'p1',status:s.state.game.phase==='ended'?'ended':'playing',revision:s.revision,members:s.seats,view:module.view(game.state,'p1'),local:true};}
 return {
  isLocal:()=>local,
  selectOnline:()=>lock(async()=>{const lib=await load();lib.local=false;await storage.save(lib);local=false;}),
  inspect:()=>lock(async()=>{const lib=await load(),g=lib.games[lib.current];if(local&&g)await verify(g);return {state:{schemaVersion:1,roomId:local?lib.current:null,pending:null,persistent:lib.persistent},principalId:'local',packet:local&&g?packet(g):null};}),
  games:()=>lock(async()=>Object.values((await load()).games).filter(g=>!g.abandoned).map(g=>({roomId:g.state.snapshot.id,status:g.state.snapshot.state.game.phase==='ended'?'ended':'playing',players:g.state.snapshot.seats.map(s=>s.name),mode:'solo',botLevel:g.state.snapshot.seats[1].level,local:true,compatible:g.artifact===CATAN_ARTIFACT.compatibilityId}))),
  resume:roomId=>lock(async()=>{const lib=await load(),g=lib.games[roomId];if(!g||g.abandoned)return null;await verify(g);lib.current=roomId;lib.local=true;await storage.save(lib);local=true;await bots(lib,g);return packet(g);}),
  refresh:()=>lock(async()=>{const lib=await load(),g=lib.games[lib.current];if(!local||!g)return null;await verify(g);await bots(lib,g);return packet(g);}),
  execute:(op,args={})=>lock(async()=>{
   const lib=await load();
   if(op==='create'){
    const roomId=id(),config=catanConfig([{id:'p1',name:(args.name||'Player').slice(0,30)}],{solo:true,level:args.botLevel||'standard',seed:seed()}),state=module.initialize(config,{gameId:roomId});
    try{lib.persistent=globalThis.navigator?.storage?.persist?await navigator.storage.persist():false;}catch{lib.persistent=false;}
    const g={artifact:CATAN_ARTIFACT.compatibilityId,state,hash:await digest(state)};lib.games[roomId]=g;lib.current=roomId;lib.local=true;await storage.save(lib);local=true;await bots(lib,g);return packet(g);
   }
   const g=lib.games[lib.current];if(!g||args.roomId!==lib.current)throw new PlayError('PROTOCOL_ERROR','Choose a saved local game.');await verify(g);
   if(args.expectedRevision!==g.state.snapshot.revision)return {ok:false,apiVersion:1,error:{code:'revision_conflict',message:'The game changed. Review your action again.'}};
   let next;try{next=module.apply(g.state,'p1',{actor:'p1',action:args.action},{},{coordinatorId:'p1'});}catch(error){if(!(error instanceof RuleRejection))throw new PlayError('GAME_ERROR','The rule engine failed. The last saved move is preserved.');return {ok:false,apiVersion:1,error:{code:'rule_rejected',message:error.message}};}
   await commit(lib,g,next);await bots(lib,g);return packet(g);
  }),
  abandon:roomId=>lock(async()=>{const lib=await load(),g=lib.games[roomId];if(!g)throw new PlayError('PROTOCOL_ERROR','Choose a saved game.');g.abandoned=true;if(lib.current===roomId){lib.current=null;lib.local=false;}await storage.save(lib);local=lib.local;}),
  canUpdate:artifact=>lock(async()=>Object.values((await load()).games).every(g=>g.abandoned||g.state.snapshot.state.game.phase==='ended'||g.artifact===artifact))
 };
}
