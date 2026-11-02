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
export function symbol(resource){
  const art={
    brick:'<path d="M5 14 19 7l13 7-14 8zM5 14v11l13 8V22m0 11 14-8V14M12 11l13 7M12 18v11"/>',
    wood:'<path d="m8 22 15-12a6 6 0 0 1 8 8L15 30a6 6 0 0 1-7-8Z"/><ellipse cx="11" cy="26" rx="5" ry="6"/><path d="m17 18 11-8M20 22l12-10"/>',
    grain:'<path d="M19 34V8m0 9C8 17 8 9 8 9c10 0 11 8 11 8Zm0 8C8 25 8 17 8 17c10 0 11 8 11 8Zm0-8c11 0 11-8 11-8-10 0-11 8-11 8Zm0 8c11 0 11-8 11-8-10 0-11 8-11 8Z"/>',
    wool:'<path d="M9 27v6m16-6v6"/><path d="M9 25a6 6 0 0 1-3-10 6 6 0 0 1 8-7 7 7 0 0 1 12 3 6 6 0 0 1 3 12c-1 6-15 7-20 2Z"/><path d="M28 13h5v10h-7"/>',
    ore:'<path d="m4 29 7-17 11-6 12 24-16 4zM11 12l7 22 4-28m0 0 4 22-8 6"/>',
  };
  return `<svg viewBox="0 0 38 40" aria-hidden="true" class="resource-icon ${resource}">${art[resource]||''}</svg>`;
}
function illustration(type){
  if(type==='wood')return '<path d="m-23 7 8-22 8 22zm22-4 8-23 8 23zm21 10 7-20 8 20z" fill="#376d4e"/><path d="M-15 7v8M7 3v9M27 13v5" stroke="#4b5941" stroke-width="3"/>';
  if(type==='ore')return '<path d="m-31 17 17-34L1 17zm18 0 20-40 24 40z" fill="#717d7d"/><path d="m-19-8 5-9 5 9M1-10l6-13 8 13" stroke="#d4d7d0" stroke-width="2" fill="#d4d7d0"/>';
  if(type==='grain')return '<g stroke="#ac883b" stroke-width="2" fill="none"><path d="M-20 15V-12M-20 0l-7-8m7 16-7-8m7-2 7-8m-7 16 7-8M7 15v-34M7-7l-7-8m7 16L0-7m7 0 7-8M7 1l7-8M28 13v-19"/></g>';
  if(type==='brick')return '<g fill="#a96347" stroke="#cb8661" stroke-width="2"><path d="M-30-10h18V0h-18zM-12-10H6V0h-18zM6-10h18V0H6zM-21 0h18v10h-18zM-3 0h18v10H-3zM-24 10h18v10h-18zM-6 10h18v10H-6z"/></g>';
  if(type==='wool')return '<g fill="#f7f5e6" stroke="#87996d" stroke-width="1.5"><ellipse cx="-19" cy="0" rx="9" ry="6"/><ellipse cx="13" cy="11" rx="9" ry="6"/></g><g fill="#5f6e52"><circle cx="-10" cy="0" r="3"/><circle cx="22" cy="11" r="3"/></g><path d="M-24 4v4m7-4v4M8 15v4m7-4v4" stroke="#5f6e52" stroke-width="2"/>';
  return '<path d="M-10 14 0-15l10 29z" fill="#8d8b72"/><path d="M0-15v29" stroke="#b0a98a" stroke-width="2"/>';
}
function piece(root,index,owner,city=false,preview=false){
  const p=vertices[index%vertices.length];
  root.append(node('path',{d:city?`M${p.x-12} ${p.y+9}v-13h8v-8h11v10h7v11Z`:`M${p.x-9} ${p.y+8}v-13l9-7 9 7v13Z`,fill:colors[owner],stroke:preview?'#164b3e':'#fff8e8','stroke-width':preview?3:2,'stroke-dasharray':preview?'3 3':'none','pointer-events':'none',opacity:preview?0.7:1}));
}
export function drawBoard(root,{phase,selection,pieces=[],roads=[],winner=false,zoom=1,pan={x:100,y:82},setupRun=false},onSelect){
  root.replaceChildren();root.setAttribute('viewBox',zoom>1?`${pan.x} ${pan.y} 440 390`:'0 0 640 550');
  const water=node('g',{'aria-hidden':'true'});
  for(const[x,y]of[[49,145],[550,77],[80,450],[565,410]])water.append(node('path',{d:`M${x} ${y}q12 6 24 0t24 0`,fill:'none',stroke:'#8db6b0','stroke-width':2,opacity:.6}));root.append(water);
  hexes.forEach((h,i)=>{const p=point(h.q,h.r),type=terrain[i],group=node('g',{'aria-hidden':'true'});group.append(node('polygon',{points:corners(p).map(v=>`${v.x},${v.y}`).join(' '),fill:palettes[type],stroke:'#f7efd9','stroke-width':3}));
    const scene=node('g',{transform:`translate(${p.x} ${p.y+11})`});scene.innerHTML=illustration(type);group.append(scene);
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
