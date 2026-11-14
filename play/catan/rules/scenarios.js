// Original base-game scenario configurations. No UI, storage or RNG provider.
import {generateBeginnerBoard} from './model.js';
export const SCENARIOS=Object.freeze([
 Object.freeze({id:'classic',version:1,name:'Classic',description:'The fixed beginner island. Standard rules and a familiar starting layout.'}),
 Object.freeze({id:'random-island',version:1,name:'Random Island',description:'Random terrain, number tokens and ports. Red numbers never share an edge. Standard rules.'})
]);
const types=['generic','grain','ore','generic','wool','generic','generic','brick','lumber'];
const adjacent=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1;
const sorted=a=>JSON.stringify([...a].sort());
const shuffle=(items,randomInt)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('Invalid scenario entropy');[a[i],a[j]]=[a[j],a[i]];}return a;};
export function generateScenario(id,randomInt){
 if(id==='classic')return undefined;
 if(id!=='random-island')throw Error('Unsupported scenario');
 const base=generateBeginnerBoard(),terrain=shuffle(base.map(t=>t.terrain),randomInt),land=terrain.flatMap((t,i)=>t==='desert'?[]:[i]),sets=[];
 // At most C(18,4) candidate red sets; enumerate instead of unbounded reshuffles.
 function visit(start,picked){if(picked.length===4){sets.push(picked);return;}for(let i=start;i<land.length;i++){const n=land[i];if(picked.every(p=>!adjacent(base[p].coord,base[n].coord)))visit(i+1,[...picked,n]);}}
 visit(0,[]);if(!sets.length)throw Error('No valid red-token layout');
 const index=randomInt(sets.length);if(!Number.isInteger(index)||index<0||index>=sets.length)throw Error('Invalid scenario entropy');
 const red=sets[index],redNumbers=shuffle([6,6,8,8],randomInt),other=shuffle(base.map(t=>t.number).filter(n=>n&&n!==6&&n!==8),randomInt),numbers=terrain.map((t,i)=>t==='desert'?0:red.includes(i)?redNumbers[red.indexOf(i)]:other.pop());
 return {id,version:1,terrain,numbers,ports:shuffle(types,randomInt)};
}
export function validateScenario(value){
 if(value===undefined)return;
 if(!value||value.id!=='random-island'||value.version!==1||Object.keys(value).sort().join('|')!==['id','version','terrain','numbers','ports'].sort().join('|')||!Array.isArray(value.terrain)||!Array.isArray(value.numbers)||!Array.isArray(value.ports))throw Error('Unsupported scenario configuration');
 const base=generateBeginnerBoard();
 if(value.terrain.length!==19||value.numbers.length!==19||value.ports.length!==9||sorted(value.terrain)!==sorted(base.map(t=>t.terrain))||sorted(value.numbers)!==sorted(base.map(t=>t.number))||sorted(value.ports)!==sorted(types))throw Error('Invalid scenario inventory');
 for(let i=0;i<19;i++){
  if((value.terrain[i]==='desert')!==(value.numbers[i]===0))throw Error('Desert must have no number');
  if([6,8].includes(value.numbers[i]))for(let j=i+1;j<19;j++)if([6,8].includes(value.numbers[j])&&adjacent(base[i].coord,base[j].coord))throw Error('Red tokens must not be adjacent');
 }
}
export function scenarioTiles(value){validateScenario(value);return generateBeginnerBoard().map((t,i)=>value?{...t,terrain:value.terrain[i],number:value.numbers[i],hasRobber:value.terrain[i]==='desert'}:t);}
export const scenarioName=state=>state?.game?.settings?.scenario?.id==='random-island'?'Random Island':'Classic';
