import {SCENARIOS,generateScenario,scenarioTiles} from '../catan/rules/scenarios.js';
import {createEntropy} from '../catan/entropy.js';
const colors={mountains:'#929e9b',pasture:'#acbf7f',forest:'#4f865e',fields:'#e4c464',hills:'#c47d58',desert:'#e3d09b'},previews=new Map();
function preview(id){
 if(previews.has(id))return previews.get(id);
 const rng=createEntropy({rngState:2026,idCounter:0},'scenario-preview',0),tiles=scenarioTiles(generateScenario(id,rng.randomInt));
 const html=`<svg viewBox="-78 -72 156 144" role="img" aria-label="${id==='classic'?'Classic island':'Example random island'}">${tiles.map(t=>{const x=Math.sqrt(3)*16*(t.coord.q+t.coord.r/2),y=24*t.coord.r,points=Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return `${x+16*Math.cos(a)},${y+16*Math.sin(a)}`;}).join(' ');return `<polygon points="${points}" fill="${colors[t.terrain]}" stroke="#fff8e7" stroke-width="1"/>${t.number?`<circle cx="${x}" cy="${y}" r="6" fill="#fff9e9"/><text x="${x}" y="${y+2}" text-anchor="middle" font-size="6" fill="${[6,8].includes(t.number)?'#ac3d2a':'#214334'}">${t.number}</text>`:''}`;}).join('')}</svg>`;
 previews.set(id,html);return html;
}
export function scenarioPicker(id='classic'){
 const selected=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
 return `<label for="scenario">Scenario</label><select id="scenario">${SCENARIOS.map(s=>`<option value="${s.id}" ${s.id===selected.id?'selected':''}>${s.name}</option>`).join('')}</select><div class="scenario-preview">${preview(selected.id)}<div><strong>${selected.name}</strong><p>${selected.description}</p>${selected.id==='random-island'?'<small>Example island. The final layout is generated when you create the game.</small>':''}</div></div>`;
}
