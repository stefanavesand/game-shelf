import {button} from './html.js';
import {careerStatistics} from '../core/statistics.js';
export function statisticsMarkup(game,games,tab='game'){
 const tabs=`<div class="statistics-tabs">${button('This game','statistics:game',tab==='game'?'primary':'quiet')}${button('My results','statistics:career',tab==='career'?'primary':'quiet')}</div>`;
 if(tab==='career'){
  const c=careerStatistics(games),cells=[['Games',c.games],['Wins',c.wins],['Win rate',c.winRate+'%'],['Average VP',c.average.toFixed(1)],['Best score',c.best+' VP'],['Losses',c.games-c.wins]];
  return tabs+`<p class="muted statistics-note">Finished games recorded on this device for your account. Solo and online results are included.</p><dl class="statistics-summary">${cells.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="muted statistics-note">Earlier games appear after you open their results. These records stay here when a game is removed; they are not synced between devices.</p>`;
 }
 if(!game)return tabs+'<p>No recorded rolls are available for this game.</p>';
 const max=Math.max(1,...game.counts,game.rolls/6),sevens=game.counts[5],bars=game.counts.map((count,i)=>{
  const total=i+2,chances=6-Math.abs(7-total),expected=game.rolls*chances/36;
  return `<div class="statistics-bin" role="listitem" aria-label="${total}: ${count} rolls, expected ${expected.toFixed(1)}"><span class="statistics-count">${count}</span><div class="statistics-track"><span class="statistics-bar" style="height:${100*count/max}%"></span><span class="statistics-expected" style="bottom:${100*expected/max}%"></span></div><strong>${total}</strong></div>`;
 });
 return tabs+`<p class="statistics-note"><strong>${game.rolls} recorded rolls · ${sevens} sevens</strong></p><div class="statistics-chart" role="list" aria-label="Distribution of dice totals from 2 to 12">${bars.join('')}</div><p class="muted statistics-note">Bars: actual rolls · marks: expected fair-dice distribution.</p><p class="statistics-coverage">${game.complete?'All rolls recorded.':'Partial history: earlier rolls are unavailable for this game.'}</p>`;
}
