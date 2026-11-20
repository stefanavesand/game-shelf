// Device-local observations only; never part of rules, hashes or relay commands.
export function collectStatistics(previous,packet,now=Date.now()){
 const v=packet?.view;if(!v||!Number.isSafeInteger(packet.revision))return previous;
 if(previous&&packet.revision<previous.revision)return previous;
 const s=structuredClone(previous||{gameId:v.id,revision:0,complete:true,counts:Array(11).fill(0),actions:{},rolls:0});
 let cursor=s.revision;
 for(const h of [...v.history].sort((a,b)=>a.revision-b.revision)){
  if(h.revision<=cursor)continue;
  if(h.revision!==cursor+1)s.complete=false;
  cursor=h.revision;
  if(h.message==='roll dice'){
   const dice=h.dice||(h.revision===v.revision&&v.state.game.lastRoll?[v.state.game.lastRoll.die1,v.state.game.lastRoll.die2]:null);
   if(dice?.length===2&&dice.every(n=>Number.isInteger(n)&&n>=1&&n<=6)){s.counts[dice[0]+dice[1]-2]++;s.rolls++;}else s.complete=false;
  }
  if(h.playerId===v.you)s.actions[h.message]=(s.actions[h.message]||0)+1;
 }
 if(cursor<packet.revision)s.complete=false;
 s.revision=packet.revision;s.mode=packet.local?'solo':'online';s.level=v.seats.find(p=>p.kind==='bot')?.level||null;
 const g=v.state.game;
 if(g.phase==='ended'&&Number.isFinite(g.finalScores?.[v.you]))s.result={won:g.winnerId===v.you,points:g.finalScores[v.you],finishedAt:s.result?.finishedAt||now};
 return s;
}
export function careerStatistics(games){
 const results=games.filter(g=>g.result).sort((a,b)=>a.result.finishedAt-b.result.finishedAt),wins=results.filter(g=>g.result.won).length;
 return {games:results.length,wins,winRate:results.length?Math.round(100*wins/results.length):0,average:results.length?results.reduce((n,g)=>n+g.result.points,0)/results.length:0,best:Math.max(0,...results.map(g=>g.result.points))};
}
export function createStatisticsStore({indexedDB=globalThis.indexedDB}={}){
 let database;const seen=new Map();
 const db=()=>database??=new Promise((resolve,reject)=>{const r=indexedDB.open('game-shelf-statistics-v1',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('games',{keyPath:['owner','gameId']});s.createIndex('owner','owner');};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();database=null;};resolve(r.result);};r.onerror=r.onblocked=()=>{database=null;reject(Error('Statistics storage unavailable.'));};});
 return {
  async record(owner,packet){if(!owner||!packet?.view)return;const key=JSON.stringify([owner,packet.view.id]);if((seen.get(key)??-1)>=packet.revision)return;const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('games','readwrite'),store=tx.objectStore('games'),r=store.get([owner,packet.view.id]);r.onsuccess=()=>{try{const next=collectStatistics(r.result,packet);store.put({...next,owner});}catch{tx.abort();}};tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Statistics could not be saved.'));});seen.set(key,Math.max(seen.get(key)??-1,packet.revision));},
  async list(owner){if(!owner)return [];const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('games'),r=tx.objectStore('games').index('owner').getAll(owner);let rows;r.onsuccess=()=>{rows=r.result;};tx.oncomplete=()=>resolve(rows);tx.onerror=tx.onabort=()=>reject(Error('Statistics could not be read.'));});}
 };
}
