import {mountRelayDemo} from './demo.js';
import {counterModule} from './fixture.js';
import {digest} from './protocol.js';
const sources=await Promise.all(['fixture.js','replica.js','protocol.js'].map(async name=>[name,await (await fetch(new URL(name,import.meta.url))).text()]));
const module=counterModule(await digest(Object.fromEntries(sources))),$=id=>document.getElementById(id);
const demo=await mountRelayDemo({module,beginConfig:()=>({start:0}),render(record,{client,principalId,busy}){
 $('value').textContent=record.game?.state.value??0;
 for(const id of ['add','roll'])$(id).disabled=busy||!record.game||!!record.halt||record.outbox.length>0;
 $('roll').disabled||=principalId!==client.creatorId;
}});
$('add').onclick=()=>demo.run(async()=>demo.progress(await demo.client.command({type:'ADD',amount:1})));
$('roll').onclick=()=>demo.run(async()=>{const die=new Uint32Array(1);do{crypto.getRandomValues(die);}while(die[0]>=4294967292);await demo.progress(await demo.client.command({type:'ROLL'},{die:die[0]%6+1}));});
