import {createIdentity} from '../core/identity.js';
import {createRelayTransport} from './transport.js';
import {createRelayStore} from './store.js';
import {createRelayLobby} from './lobby.js';
import {createRelayClient} from './client.js';
import {counterModule} from './fixture.js';
import {invariant,digest} from './protocol.js';
const $=id=>document.getElementById(id),store=createRelayStore();
const auth=createIdentity();let transport,principalId,lobby,client,channelId,inviteToken='',busy=false,timer;
const initialToken=new URLSearchParams(location.hash.slice(1)).get('invite');if(initialToken)$('token').value=initialToken;
const sources=await Promise.all(['fixture.js','replica.js','protocol.js'].map(async name=>[name,await (await fetch(new URL(name,import.meta.url))).text()]));
const artifactDigest=await digest(Object.fromEntries(sources));
const module=counterModule(artifactDigest);
function show(record) {
 $('value').textContent=record.game?.state.value??0;$('revision').textContent=record.game?.revision??'—';$('cursor').textContent=record.cursor;$('pending').textContent=record.outbox.length;
 $('hash').textContent=record.game?`State hash: ${record.game.hash}`:'';
 const peers=client.members.filter(p=>p!==principalId),verified=record.game&&peers.length&&peers.every(p=>record.game.peerVerified[p]>=record.game.revision);
 $('verification').textContent=record.halt?'Stopped':verified?'Both players agree':'Waiting for peer verification';
 $('begin').disabled=busy||!!record.game||principalId!==client.creatorId||!!record.halt;
 for(const id of ['add','roll'])$(id).disabled=busy||!record.game||!!record.halt||record.outbox.length>0;
 $('roll').disabled||=principalId!==client.creatorId;
 if(record.halt){$('error').textContent='Game stopped: clients disagreed. No automatic recovery. Start a new channel to play again.';$('status').textContent='Stopped';}
 else $('status').textContent=record.outbox.length?'Delivery pending. Synchronize to resolve the original message.':'Synchronized locally. Peer verification may still be pending.';
}
async function bind(id) {
 const {result}=await transport.request({protocolVersion:1,op:'channel.read',channelId:id},principalId);
 invariant(result?.channelId===id&&typeof result.creatorId==='string'&&Array.isArray(result.members),'INVALID_RESPONSE','Invalid channel details.');
 const members=result.members.map(m=>m.playerId);
 channelId=id;client=createRelayClient({principalId,channelId,creatorId:result.creatorId,members,module,store,transport});Object.assign(client,{members,creatorId:result.creatorId});
 $('game').hidden=false;$('channel').textContent=`Channel ${id} · Access expires ${new Date(result.accessExpiresAt).toLocaleString()}`;
 $('invite').value=inviteToken?`${location.origin}${location.pathname}#invite=${encodeURIComponent(inviteToken)}`:'Invitation is available on the creator’s device.';
 const local=await client.state();show(local);return client;
}
async function sync(){await bind(channelId);show(await client.sync());}
async function work(task) {
 if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>{b.disabled=true;});$('error').textContent='';
 try{await task();}catch(error){$('error').textContent=`${error.code??'ERROR'}: ${error.message}`;if(client)show(await client.state());}
 finally{busy=false;document.querySelectorAll('button').forEach(b=>{b.disabled=false;});if(client)show(await client.state());if(lobby)$('retry-admission').hidden=!(await lobby.pending());}
}
$('connection').onsubmit=event=>{event.preventDefault();work(async()=>{
 const endpoint=new URL($('endpoint').value);invariant(endpoint.hostname==='localhost'||endpoint.hostname==='127.0.0.1'||endpoint.hostname.endsWith('.lovable.app'),'INVALID_ENDPOINT','Use the configured Lovable relay or localhost.');
 const identity=await auth.identity({allowCreate:true});principalId=identity.user.id;
 transport=createRelayTransport({endpoint:endpoint.href,identity:options=>auth.identity(options)});
 await transport.request({protocolVersion:1,op:'capabilities'},principalId);
 lobby=createRelayLobby({principalId,transport,store});
 $('identity').textContent=`Player ID: ${principalId}`;$('admission').hidden=false;
 if(!await lobby.pending())await lobby.mutate('profile.set',{displayName:$('name').value.trim()});
 const last=await lobby.lastChannel();if(last?.result?.channelId){inviteToken=last.result.inviteToken??'';await bind(last.result.channelId);await sync();}
 const persistence=await store.requestPersistence();$('storage').textContent=persistence.granted?'Persistent local storage granted.':'Persistent storage unavailable or not granted. Saves may be cleared by the browser.';
 clearInterval(timer);timer=setInterval(()=>{if(channelId&&!document.hidden&&navigator.onLine)work(sync);},5000);
 $('status').textContent='Connected. Create or join a channel.';
 });};
async function admitted(op,fields){const result=await lobby.mutate(op,fields);inviteToken=result.inviteToken??'';await bind(result.channelId);await sync();if(op==='channel.join')history.replaceState(null,'',location.pathname);}
$('create').onclick=()=>work(()=>admitted('channel.create'));
$('join').onclick=()=>work(()=>admitted('channel.join',{inviteToken:$('token').value.trim()}));
$('retry-admission').onclick=()=>work(async()=>{const result=await lobby.mutate();if(result.channelId){inviteToken=result.inviteToken??'';await bind(result.channelId);await sync();}});
$('begin').onclick=()=>work(async()=>show(await client.begin({start:0})));
$('add').onclick=()=>work(async()=>show(await client.command({type:'ADD',amount:1})));
$('roll').onclick=()=>work(async()=>{const die=new Uint32Array(1);do{crypto.getRandomValues(die);}while(die[0]>=4294967292);show(await client.command({type:'ROLL'},{die:die[0]%6+1}));});
$('sync').onclick=()=>work(sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&channelId)work(sync);});
