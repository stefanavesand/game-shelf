import {edgeDisplayKey,vertexDisplayKey,hexDisplayKey} from './presentation/move-events.js';

// Independently implemented pointy-hex rendering for the deployed v1 wire format.
// N/S name top/bottom vertices. NE/E/SE name outward-facing edge normals.
const NS='http://www.w3.org/2000/svg',SIZE=54;
export const center=(hex,size=SIZE)=>({x:Math.sqrt(3)*size*(hex.q+hex.r/2),y:1.5*size*hex.r});
export function vertexPoint(vertex,size=SIZE){const c=center(vertex.hex,size);return {x:c.x,y:c.y+(vertex.direction==='N'?-size:size)};}
export function edgePoints(edge,size=SIZE){
  const c=center(edge.hex,size),angle=({NE:-60,E:0,SE:60}[edge.direction])*Math.PI/180;
  const midpoint={x:c.x+Math.cos(angle)*Math.sqrt(3)*size/2,y:c.y+Math.sin(angle)*Math.sqrt(3)*size/2};
  const tangent={x:-Math.sin(angle)*size/2,y:Math.cos(angle)*size/2};
  return [{x:midpoint.x-tangent.x,y:midpoint.y-tangent.y},{x:midpoint.x+tangent.x,y:midpoint.y+tangent.y}];
}
const paint={red:'#c53328',blue:'#167dc1',orange:'#e3a52b',green:'#397252'};
const tiles={hills:['#cb8661','brick','Brick'],forest:['#729978','wood','Wood'],fields:['#e3c370','grain','Grain'],mountains:['#a6aca9','ore','Ore'],pasture:['#b7c88b','wool','Wool'],desert:['#e2d0a2','desert','Desert']};
const n=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;};
const p=pos=>({x:pos.x+320,y:pos.y+275});
export function choicePoint(choice){if(choice.vertex)return p(vertexPoint(choice.vertex));if(choice.edge){const[a,b]=edgePoints(choice.edge);return p({x:(a.x+b.x)/2,y:(a.y+b.y)/2});}if(choice.hex)return p(center(choice.hex));return null;}
export function draw(root,view,choices,selected,disabled,onSelect){
  root.replaceChildren();root.setAttribute('viewBox','0 0 640 550');root.setAttribute('preserveAspectRatio','xMidYMid meet');
  for(const tile of view.state.board.tiles){const c=p(center(tile.coord)),[fill,art,name]=tiles[tile.terrain]||tiles.desert,group=n('g',{'aria-hidden':true,'data-motion-tile':hexDisplayKey(tile.coord),'data-motion-key':hexDisplayKey(tile.coord)});
    const points=Array.from({length:6},(_,i)=>({x:c.x+SIZE*Math.cos((i*60-30)*Math.PI/180),y:c.y+SIZE*Math.sin((i*60-30)*Math.PI/180)}));
    const outline=points.map(v=>`${v.x},${v.y}`).join(' '),clipId=`terrain-${tile.coord.q}-${tile.coord.r}`;
    const clip=n('clipPath',{id:clipId});clip.append(n('polygon',{points:outline}));group.append(clip);
    group.append(n('image',{href:`./art/terrain-${art}.webp`,x:c.x-Math.sqrt(3)*SIZE/2,y:c.y-SIZE,width:Math.sqrt(3)*SIZE,height:SIZE*2,preserveAspectRatio:'none','clip-path':`url(#${clipId})`}));
    group.append(n('polygon',{points:outline,fill:'none',stroke:'#fff4d3','stroke-width':3}));
    if(tile.number){group.append(n('circle',{cx:c.x,cy:c.y-13,r:15,fill:'#fff7da',stroke:'#8c845e','stroke-width':.65}));group.append(n('text',{x:c.x,y:c.y-13,'text-anchor':'middle','dominant-baseline':'central','font-size':21,'font-family':'Georgia,serif','font-weight':700,fill:[6,8].includes(tile.number)?'#9b3c2b':'#263d30'},tile.number));}
    const robber=view.state.board.robberLocation;if(robber.q===tile.coord.q&&robber.r===tile.coord.r)group.append(n('path',{d:`M${c.x+20} ${c.y-18}a6 6 0 1 1 12 0l4 18h-20Z`,'data-motion-robber':'',fill:'#37453c',stroke:'#fff8e9','stroke-width':1.5}));root.append(group);
  }
  const players=view.state.players.players;
  for(const port of view.state.board.ports){const[a,b]=edgePoints(port.edge),pos=p({x:(a.x+b.x)*.56,y:(a.y+b.y)*.56}),g=n('g',{'data-port':'',transform:`translate(${pos.x} ${pos.y})`});
   g.append(n('path',{d:'M-19-12Q0-15 19-12L16-3 19 12Q0 9-19 12L-16 3Z',fill:'#fff5cf',stroke:'#8b815a','stroke-width':1}));
   const text=n('text',{'text-anchor':'middle','font-size':10,'font-family':'Georgia,serif','font-weight':700,fill:'#293d22'});
   if(port.type==='generic')text.append(n('tspan',{x:0,y:3},'3:1'));else {const type=port.type==='lumber'?'Wood':port.type[0].toUpperCase()+port.type.slice(1);text.append(n('tspan',{x:0,y:-2},type));text.append(n('tspan',{x:0,y:8},'2:1'));}g.append(text);root.append(g);
  }
  // Fit static board art and complete port labels. Buildings and selection markers
  // fit inside this padding, so choosing a move never changes the framing.
  const bounds=root.getBBox(),padding=10;
  root.setAttribute('viewBox',`${bounds.x-padding} ${bounds.y-padding} ${bounds.width+padding*2} ${bounds.height+padding*2}`);
  for(const road of view.state.board.roads){const[a,b]=edgePoints(road.edge).map(p),color=paint[players.find(player=>player.id===road.playerId)?.color]||paint.red;for(const[stroke,width]of[['#fff8e9',10],[color,6]])root.append(n('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke,'stroke-width':width,'stroke-linecap':'round',...(width===6?{'data-motion-piece':'road','data-motion-key':edgeDisplayKey(road.edge)}:{})}));}
  function piece(position,color,city,preview=false,key=null){const c=p(position);const pieceGroup=n('g',{'data-piece-art':'',...(!preview&&key?{'data-motion-piece':'building','data-motion-key':key}:{})});root.append(pieceGroup);pieceGroup.append(n('path',{d:city?`M${c.x-12} ${c.y+9}v-13h8v-8h11v10h7v11Z`:`M${c.x-9} ${c.y+8}v-13l9-7 9 7v13Z`,fill:color,stroke:preview?'#164b3e':'#fff8e9','stroke-width':preview?3:1.6,opacity:preview?0.65:1,'stroke-dasharray':preview?'4 3':'none','pointer-events':'none'}));if(!preview)pieceGroup.append(n('path',{d:`M${c.x+1} ${c.y-9}v16h7v-13Z`,fill:'#000',opacity:.14,'pointer-events':'none'}));}
  for(const b of view.state.board.buildings)piece(vertexPoint(b.vertex),paint[players.find(player=>player.id===b.playerId)?.color]||paint.red,b.type==='city',false,vertexDisplayKey(b.vertex));
  const hitRadius=Math.max(22,22/(root.getScreenCTM()?.a||.5));
  choices.forEach((choice,index)=>{
    const c=choicePoint(choice);if(!c)return;const group=n('g',{role:'button',tabindex:disabled?-1:0,'aria-disabled':disabled,'aria-label':`Board location ${index+1}`,'aria-pressed':selected===index});
    group.append(n('circle',{cx:c.x,cy:c.y,r:hitRadius,fill:'transparent'}));group.append(n('circle',{cx:c.x,cy:c.y,r:11,fill:selected===index?'#164b3e':'#fff9e8',stroke:'#164b3e','stroke-width':3}));group.append(n('circle',{cx:c.x,cy:c.y,r:3,fill:selected===index?'#fff':'#164b3e'}));group.onclick=e=>{if(disabled)return;const point=root.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const ctm=root.getScreenCTM();if(!ctm)return;const hit=point.matrixTransform(ctm.inverse());const nearest=choices.map((c,i)=>({i,p:choicePoint(c)})).filter(c=>c.p).sort((a,b)=>Math.hypot(a.p.x-hit.x,a.p.y-hit.y)-Math.hypot(b.p.x-hit.x,b.p.y-hit.y))[0];if(nearest)onSelect(nearest.i);};group.onkeydown=e=>{if(!disabled&&['Enter',' '].includes(e.key)){e.preventDefault();onSelect(index);}};root.append(group);
  });
  if(selected!==null){const choice=choices[selected],color=paint[players.find(player=>player.id===view.you)?.color]||paint.red;if(choice?.vertex)piece(vertexPoint(choice.vertex),color,choice.type==='BUILD_CITY',true);if(choice?.edge){const[a,b]=edgePoints(choice.edge).map(p);root.append(n('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':7,'stroke-dasharray':'6 3','pointer-events':'none'}));}}
}
