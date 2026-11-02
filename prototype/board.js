import {symbol,tileArt} from '../ui/art.js';
export {symbol};
// Original presentation-only geometry and SVG artwork. No upstream engine code.
// These fixture coordinates are not persisted game/protocol coordinates.
const NS = 'http://www.w3.org/2000/svg';
export const terrain = [
  'brick','wood','grain','ore','wool','wood','wool','grain','brick',
  'desert','ore','wood','grain','wool','ore','brick','wood','grain','wool',
];
const numbers = [5,9,4,10,3,11,6,8,2,null,3,10,9,4,5,11,6,8,12];
const palettes = {brick:'#cb8661',wood:'#729978',grain:'#e3c370',ore:'#a6aca9',wool:'#b7c88b',desert:'#e2d0a2'};
export const names = {brick:'Brick',wood:'Wood',grain:'Grain',wool:'Wool',ore:'Ore'};
export const resources = Object.keys(names);
const colors = {you:'#b84f3c',alex:'#396a9c',bot:'#b57d27'};
const hexes=[];
for(let r=-2;r<=2;r++)for(let q=-2;q<=2;q++)if(Math.abs(q+r)<=2)hexes.push({q,r});
const point=(q,r)=>({x:320+Math.sqrt(3)*54*(q+r/2),y:275+81*r});
const corners=p=>Array.from({length:6},(_,i)=>({x:p.x+54*Math.cos((i*60-30)*Math.PI/180),y:p.y+54*Math.sin((i*60-30)*Math.PI/180)}));
const key=p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`;
export const vertices=[...new Map(hexes.flatMap(h=>corners(point(h.q,h.r))).map(p=>[key(p),p])).values()];
const boardEdges=hexes.flatMap(h=>{
  const c=corners(point(h.q,h.r));
  return c.map((a,i)=>{const b=c[(i+1)%6];return {a,b,id:[key(a),key(b)].sort().join('|')};});
});
export const edges=[...new Map(boardEdges.map(e=>[e.id,e])).values()];
export const sampleTargets={settlement:[3,20,44],road:[4,29,59],robber:[1,8,14]};
function node(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
function piece(root,index,owner,city=false,preview=false){
  const p=vertices[index%vertices.length];
  root.append(node('path',{d:city?`M${p.x-12} ${p.y+9}v-13h8v-8h11v10h7v11Z`:`M${p.x-9} ${p.y+8}v-13l9-7 9 7v13Z`,fill:colors[owner],stroke:preview?'#164b3e':'#fff8e8','stroke-width':preview?3:2,'stroke-dasharray':preview?'3 3':'none','pointer-events':'none',opacity:preview?0.7:1}));
}
export function drawBoard(root,{phase,selection,pieces=[],roads=[],winner=false,zoom=1,pan={x:100,y:82},setupRun=false},onSelect){
  root.replaceChildren();root.setAttribute('viewBox',zoom>1?`${pan.x} ${pan.y} 440 390`:'0 0 640 550');
  const water=node('g',{'aria-hidden':'true'});
  for(const[x,y]of[[49,145],[550,77],[80,450],[565,410]])water.append(node('path',{d:`M${x} ${y}q12 6 24 0t24 0`,fill:'none',stroke:'#8db6b0','stroke-width':2,opacity:.6}));root.append(water);
  hexes.forEach((h,i)=>{const p=point(h.q,h.r),type=terrain[i],group=node('g',{'aria-hidden':'true'});group.append(node('polygon',{points:corners(p).map(v=>`${v.x},${v.y}`).join(' '),fill:palettes[type],stroke:'#f7efd9','stroke-width':3}));
    const scene=node('g',{transform:`translate(${p.x} ${p.y+11})`});scene.innerHTML=tileArt(type);group.append(scene);
    if(numbers[i]){group.append(node('circle',{cx:p.x,cy:p.y-13,r:17,fill:'#fff8e9',stroke:'#e4d6b7'}));group.append(node('text',{x:p.x,y:p.y-7,'text-anchor':'middle','font-size':27,'font-weight':700,class:'number-token',fill:[6,8].includes(numbers[i])?'#9b3c2b':'#2b3f34'},numbers[i]));}
    group.append(node('text',{x:p.x,y:p.y+36,'text-anchor':'middle','font-size':10,'font-weight':600,class:'terrain-label',fill:'#263d30'},names[type]||'Desert'));root.append(group);
  });
  for(const[x,y,label]of[[214,56,'3:1'],[440,56,'2:1 wood'],[575,270,'2:1 wool'],[425,503,'3:1'],[205,503,'2:1 grain'],[62,270,'3:1']])root.append(node('text',{x,y,fill:'#456b65','font-size':12,'text-anchor':'middle'},label));
  const placedRoads=[{index:1,owner:'you'},{index:2,owner:'you'},{index:10,owner:'you'},{index:17,owner:'alex'},{index:18,owner:'alex'},{index:32,owner:'bot'},{index:40,owner:'bot'},...roads];
  for(const road of placedRoads){const e=edges[road.index%edges.length];root.append(node('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,stroke:'#fff8e8','stroke-width':10,'stroke-linecap':'round'}));root.append(node('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,stroke:colors[road.owner],'stroke-width':6,'stroke-linecap':'round'}));}
  const placed=setupRun||phase.startsWith('setup')?[]:[{index:0,owner:'you',city:true},{index:13,owner:'you'},{index:31,owner:'you'},{index:8,owner:'alex',city:true},{index:28,owner:'alex',city:true},{index:48,owner:'alex'},{index:17,owner:'bot'},{index:35,owner:'bot'},{index:52,owner:'bot'}];
  if(winner)placed.push({index:22,owner:'you',city:true},{index:39,owner:'you',city:true});
  for(const b of [...placed,...pieces])piece(root,b.index,b.owner,b.city);
  const type=phase==='setup-road'||phase==='build-road'?'road':phase==='robber'?'robber':phase==='setup-settlement'||phase==='build-settlement'||phase==='build-city'?'settlement':null;
  if(type)for(const index of (phase==='build-city'?[13,31]:sampleTargets[type]).filter(i=>type==='road'?!roads.some(r=>r.index===i):phase==='build-city'||!pieces.some(b=>b.index===i))){
    const p=type==='road'?{x:(edges[index].a.x+edges[index].b.x)/2,y:(edges[index].a.y+edges[index].b.y)/2}:type==='robber'?point(hexes[index].q,hexes[index].r):vertices[index];
    const target=node('g',{role:'button',tabindex:0,'aria-label':`${type==='robber'?'Robber tile':type==='road'?'Road location':'Settlement location'} ${index+1}`,'aria-pressed':selection===index,'data-target':index,class:`board-target ${selection===index?'selected':''}`});
    target.append(node('circle',{cx:p.x,cy:p.y,r:44,fill:'transparent'}));target.append(node('circle',{cx:p.x,cy:p.y,r:12,fill:selection===index?'#164b3e':'#fff9e9',stroke:'#164b3e','stroke-width':3}));target.append(node('circle',{cx:p.x,cy:p.y,r:3,fill:selection===index?'#fff9e9':'#164b3e'}));
    target.onclick=()=>onSelect(index);target.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(index);}};root.append(target);
  }
  if(selection!==null&&type==='settlement')piece(root,selection,'you',phase==='build-city',true);
}
