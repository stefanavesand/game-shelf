import {esc,button} from './html.js';
import {itemPages} from './dialog-pages.js';
import {RESOURCES,RESOURCE_NAMES,CARD_NAMES,ownPlayer,handCount} from '../core/protocol.js';
import {CARD_RULES,ACTION_CARD_TIMING,HELP_SECTIONS} from '../help.js';
import {symbol} from './art.js';
const $=id=>document.getElementById(id),art=r=>symbol(r==='lumber'?'wood':r);
// Secondary presentation components receive an authorized view and an overlay opener.
export function resourceHand(v){const me=ownPlayer(v);return `<section class="panel-section"><p class="panel-label">Your resources <span class="hand-total">${handCount(me.resources)} cards</span></p><div class="resource-row">${RESOURCES.map(r=>`<div class="resource-tile ${r}" data-motion-resource="${r}">${art(r)}<span>${RESOURCE_NAMES[r]}</span><strong>${me.resources[r]}</strong></div>`).join('')}</div></section>`;}
export function developmentCards(v,{disabled=false}={}){
  const me=ownPlayer(v),cards=me.developmentCards.filter(c=>!c.isPlayed);if(!cards.length)return '';
  return `<section class="panel-section development-section"><p class="panel-label">Your development cards</p>${cards.map((c,index)=>`<button class="card-button" data-action="card:${index}" ${disabled?'disabled':''}><span class="card-icon" aria-hidden="true">♞</span><span class="card-title">${CARD_NAMES[c.type]}${c.type==='victoryPoint'?' <span class="card-note">Private point</span>':c.turnBought===v.state.game.turn?' <span class="card-note">Next turn</span>':''}</span><span>→</span></button>`).join('')}</section>`;
}

export function showHelp(openSheet){
 const topics=[...HELP_SECTIONS,...Object.entries(CARD_RULES).map(([type,rules])=>[CARD_NAMES[type],rules.effect+' '+rules.timing+(type==='victoryPoint'?'':' '+ACTION_CARD_TIMING)])];
 openSheet('Help & rules',`<label for="help-topic">Topic</label><select id="help-topic">${topics.map(([heading],i)=>`<option value="${i}">${esc(heading)}</option>`).join('')}</select><section id="help-content"></section><div class="help-pages"><button type="button" id="help-back">Previous</button><span id="help-page"></span><button type="button" id="help-next">Next</button></div>`);
 let part=0;const chunks=text=>{const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text],result=[];for(const sentence of sentences){if(result.length&&result.at(-1).length+sentence.length<360)result[result.length-1]+=sentence;else result.push(sentence);}return result;};
 const draw=()=>{const [heading,text]=topics[Number($('help-topic').value)],pages=chunks(text);part=Math.min(part,pages.length-1);$('help-content').innerHTML=`<h3>${esc(heading)}</h3><p>${esc(pages[part])}</p>`;$('help-back').disabled=part===0;$('help-next').disabled=part===pages.length-1;$('help-page').textContent=`${part+1} / ${pages.length}`;};
 $('help-topic').onchange=()=>{part=0;draw();};$('help-back').onclick=()=>{part--;draw();};$('help-next').onclick=()=>{part++;draw();};draw();
}
export function showScores(v,openSheet){const g=v.state.game;openSheet('Score breakdown',v.state.players.players.map(p=>{
 const buildings=v.state.board.buildings.filter(b=>b.playerId===p.id),settlements=buildings.filter(b=>b.type==='settlement').length,cities=buildings.filter(b=>b.type==='city').length,road=g.longestRoad?.playerId===p.id?2:0,army=g.largestArmy?.playerId===p.id?2:0;
 const hidden=p.id===v.you?p.developmentCards.filter(c=>c.type==='victoryPoint'&&!c.isPlayed).length:g.phase==='ended'?Math.max(0,g.finalScores[p.id]-settlements-cities*2-road-army):null;
 return `<section class="score-detail"><h3>${esc(p.name)} · ${g.finalScores?.[p.id]??p.victoryPoints} VP</h3><dl><dt>Settlements (${settlements})</dt><dd>${settlements}</dd><dt>Cities (${cities})</dt><dd>${cities*2}</dd><dt>Longest Road</dt><dd>${road}</dd><dt>Largest Army</dt><dd>${army}</dd><dt>Victory Point cards${p.id===v.you?' · private':''}</dt><dd>${hidden===null?'Hidden':hidden}</dd></dl></section>`;
 }).join('')+'<p class="muted">Longest Road and Largest Army are worth 2 points each. Ties retain the holder; a larger qualifying result transfers the award. Only the active player can win.</p>');itemPages($('sheet-body'),'.score-detail',{label:'Player',labels:v.state.players.players.map(p=>p.name)});}
