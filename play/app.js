import {client} from './session.js';
import {draw} from './board.js';
import {symbol} from '../ui/art.js';
import {PlayError} from './core/errors.js';
import {RESOURCES,RESOURCE_NAMES,CARD_NAMES,CARD_ACTION,ownPlayer,handCount,bundleLabel,uuid} from './core/protocol.js';
const $=id=>document.getElementById(id),sheet=$('sheet');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const button=(label,action,classes='',disabled=false)=>`<button type="button" data-action="${action}" class="${classes}" ${disabled?'disabled':''}>${label}</button>`;
const art=r=>symbol(r==='lumber'?'wood':r);
let packet=null,saved=null,screen='home',busy=false,ready=false,error=null,notice='',mode='',selection=null,selectionRevision=-1,spatial=[],timer=null,modalRevision=null,modalAction=null,lastRenderKey='',botSince=0,botRevision=-1;
let knownGames=[];
let activeSync=null,renderedHTML=null,renderedBoard=null;
let zoom=1,pan={x:100,y:82},tradeDraft=null,opener=null,formDraft={name:'',room:null,level:'standard',gameMode:'friends'};
function announce(s){$('announcement').textContent=s;}
const view=()=>packet?.view;
const solo=()=>packet?.members?.filter(s=>s.kind==='human').length===1&&packet?.members?.filter(s=>s.kind==='bot').length===2;
const player=id=>view()?.state.players.players.find(p=>p.id===id);
const name=id=>player(id)?.name||packet?.members?.find(s=>s.id===id)?.name||'Player';
const blocked=()=>busy||!ready||!!saved?.pending||!navigator.onLine||!!(saved?.retryAt>Date.now());
const count=id=>player(id)?.resourceCount||0;
const incoming=()=>view()?.offer?.to===view()?.you;
function closeSheet(){sheet.close();modalAction=null;modalRevision=null;if(opener?.isConnected)opener.focus();}
function openSheet(title,body){opener=document.activeElement;modalRevision=packet?.revision??null;$('sheet-title').textContent=title;$('sheet-body').innerHTML=body;if(!sheet.open)sheet.showModal();(sheet.querySelector('input:not([readonly]),select,button:not(#close-sheet):not(:disabled)')||$('close-sheet')).focus();}
$('close-sheet').onclick=closeSheet;
function staleModal(){if(modalRevision!==null&&modalRevision!==packet?.revision){closeSheet();notice='The game changed while this panel was open. Please review your choice again.';render();return true;}return false;}
function setScreen(next){screen=next;history.replaceState(null,'',`${location.pathname}#${next==='table'?'game':next}${next==='join'&&uuid(invitedRoom())?'?room='+invitedRoom():''}`);render();$('app').focus({preventScroll:true});}
function money(bundle){return bundleLabel(bundle).replaceAll('lumber','wood');}
function recovery(){
  if(!error&&!saved?.pending&&navigator.onLine)return '';
  const permanent=error&&['AUTH_REQUIRED','UNSUPPORTED_VERSION','SESSION_EXPIRED','UNSUPPORTED_BROWSER'].includes(error.code),pending=!!saved?.pending;
  const title=!navigator.onLine?'You’re offline':error?.code==='AUTH_REQUIRED'?'Your player identity needs attention':error?.code==='SESSION_EXPIRED'?'This room has expired':error?.code==='UNSUPPORTED_VERSION'?'A compatible app is needed':pending?'Let’s check your original move':busy?'Reconnecting…':'The game needs a moment';
  const text=!navigator.onLine?'Internet play is paused. Reconnect to check the game before making a move.':error?.message||(pending?'Your move is waiting for confirmation. We’ll resolve it before sending another.':'Check the connection to continue.');
  return `<section class="recovery" role="status"><div><h2>${title}</h2><p>${esc(text)}</p>${permanent?'<p class="error-help">Keep the original installation and saved data. Returning to this room requires its original player identity.</p>':''}</div>${button(pending?'Resolve move':'Reconnect','refresh','',busy||!navigator.onLine||(saved?.retryAt||0)>Date.now()||permanent)}</section>`;
}
function title(){
  const v=view(),g=v.state.game,me=v.you;
  if(g.phase==='ended')return [`${g.winnerId===me?'You win':name(g.winnerId)+' wins'}.`,'An evening well played.'];
  if(saved?.pending)return ['One moment…','Waiting for confirmation. Your preview is not committed yet.'];
  if(incoming())return ['Alex has an offer'.replace('Alex',name(v.offer.from)),'Review both sides before accepting.'];
  if(g.phase==='discard'&&v.choices.length)return ['Choose cards to return',`Return exactly ${g.discardAmounts[me]} resource cards.`];
  if(g.currentPlayerId!==me)return [`${name(g.currentPlayerId)}’s turn`,v.seats.find(s=>s.id===g.currentPlayerId)?.kind==='bot'?'The bot is choosing. Your hand stays private.':'Your next move will be here when it’s your turn.'];
  if(g.phase.startsWith('setup-settlement'))return [g.phase.endsWith('1')?'Your first settlement':'Your second settlement','Choose a highlighted intersection, then confirm.'];
  if(g.phase.startsWith('setup-road'))return ['A road to start from','Choose an edge next to your new settlement.'];
  return ({roll:['Your turn','Roll the dice, or play an eligible card.'],main:[mode?({BUILD_ROAD:'Build a road',BUILD_SETTLEMENT:'Build a settlement',BUILD_CITY:'Upgrade to a city'}[mode]):'Your turn',mode?'Preview a highlighted location, then confirm.':'Build, trade, or end your turn.'],'robber-move':['Move the robber','Choose a different highlighted tile, then confirm.'],'robber-steal':['Choose a victim','Only public card counts are shown.'],'road-building':['Your free roads',`${g.roadBuildingRemaining} road${g.roadBuildingRemaining===1?'':'s'} left. Preview each placement.`],discard:['Waiting for discards','The required players are returning cards.']})[g.phase]||['Your game','Waiting for the next decision.'];
}
function resourcesPanel(){const me=ownPlayer(view());return `<section class="panel-section"><p class="panel-label">Your resources <span class="hand-total">${handCount(me.resources)} cards</span></p><div class="resource-row">${RESOURCES.map(r=>`<div class="resource-tile ${r}">${art(r)}<span>${RESOURCE_NAMES[r]}</span><strong>${me.resources[r]}</strong></div>`).join('')}</div></section>`;}
function cardsPanel(){
  const v=view(),me=ownPlayer(v),cards=me.developmentCards.filter(c=>!c.isPlayed);if(!cards.length)return '';
  return `<section class="panel-section development-section"><p class="panel-label">Your development cards</p>${cards.map((c,index)=>`<button class="card-button" data-action="card:${index}" ${busy||!navigator.onLine?'disabled':''}><span class="card-icon" aria-hidden="true">♞</span><span class="card-title">${CARD_NAMES[c.type]}${c.type==='victoryPoint'?' <span class="card-note">Private point</span>':c.turnBought===v.state.game.turn?' <span class="card-note">Next turn</span>':''}</span><span>→</span></button>`).join('')}</section>`;
}
function selectSpatial(){
  const v=view();if(!v)return [];
  const automatic=v.state.game.phase.startsWith('setup-')||['robber-move','road-building'].includes(v.state.game.phase);
  return v.choices.filter(c=>automatic?!!(c.vertex||c.edge||c.type==='MOVE_ROBBER'):c.type===mode);
}
function placements(){
  if(!spatial.length)return '';
  return `<section class="selection-summary"><p class="spatial-hint">${selection===null?'Tap a highlighted location on the board.':'Preview selected. Confirm your move or choose another location.'}</p><div class="confirm-row">${button('Confirm','confirm','primary',selection===null||blocked())}${button('Cancel','cancel-preview','',blocked())}</div></section>`;
}
function actions(){
  const v=view(),types=new Set(v.choices.map(c=>c.type)),offered=!!v.offer;
  if(v.state.game.phase==='ended')return button('See the results','results','primary');
  if(types.has('DISCARD_RESOURCES'))return button('Choose cards to discard','discard','primary',blocked());
  if(types.has('STEAL_RESOURCE'))return button('Choose a player','victim','primary',blocked());
  if(types.has('ROLL_DICE'))return button('Roll dice','quick:ROLL_DICE','primary',blocked());
  if(v.state.game.phase==='main'&&v.state.game.currentPlayerId===v.you&&!mode)return `${button('Build','build','primary',blocked()||offered)}${button('Trade','trade','',blocked()||offered)}${button('End turn','quick:END_TURN','turn-end',blocked()||offered||!types.has('END_TURN'))}`;
  return '';
}
function drawTable(){
  const v=view(),g=v.state.game,[heading,description]=title();spatial=selectSpatial();if(selection!==null&&!spatial[selection])selection=null;
  const players=v.state.players.players.map(p=>`<article class="player ${p.id===v.you?'you':''}" style="border-left:3px solid ${{red:'#b84f3c',blue:'#396a9c',orange:'#b57d27',green:'#397252'}[p.color]}"><div><strong>${esc(p.name)}${p.id===v.you?' · You':''} · ${g.finalScores?.[p.id]??p.victoryPoints} VP${v.seats.find(s=>s.id===p.id)?.kind==='bot'?` <span class="bot-tag">Bot · ${v.seats.find(s=>s.id===p.id).level}</span>`:''}</strong><small>${p.resourceCount} resources · ${p.devCardCount} cards</small>${g.currentPlayerId===p.id&&g.phase!=='ended'?'<span class="active-marker">Current turn</span>':''}</div></article>`).join('');
  const roll=g.lastRoll;
  return `${recovery()}<div class="players" aria-label="Players">${players}</div><div class="table-layout"><div class="board-column"><section class="board-wrap"><span class="board-label">Catan · ${g.phase.startsWith('setup')?'Starting placements':`Turn ${g.turn}`}</span><svg id="board" role="group" aria-label="Island board and legal placement choices"></svg><div class="board-tools" aria-label="Board navigation">${button('+','zoom-in','icon-button')}${button('−','zoom-out','icon-button')}${button('⌖','zoom-reset','icon-button')}${zoom>1?button('←','pan-left','icon-button')+button('→','pan-right','icon-button')+button('↑','pan-up','icon-button')+button('↓','pan-down','icon-button'):''}</div></section><p class="board-caption">${g.phase.startsWith('setup')?'Two settlements and two roads each. The second round runs in reverse order.':'Your own hand stays private. Names and piece colors identify each player.'}</p><details class="public-log"><summary>Recent moves</summary><ol>${v.history.slice(-10).map(h=>`<li>${esc(name(h.playerId))}: ${esc(h.message)}</li>`).join('')||'<li>Your first move is coming.</li>'}</ol></details></div><aside class="action-panel" aria-label="Your hand and turn actions"><div class="turn-line"><span class="turn-icon" aria-hidden="true">${g.phase.startsWith('setup')?'⌂':'☼'}</span><div><h1>${esc(heading)}</h1><p>${esc(description)}</p></div></div>${resourcesPanel()}${cardsPanel()}${v.offer?`<div class="offer-row"><p class="inline-message">${incoming()?`${esc(name(v.offer.from))} sent you an offer.`:'Your offer is waiting for a response.'}</p>${button(incoming()?'Review trade':'View your offer','offer','primary full-width',busy)}</div>`:''}${placements()}<div class="action-buttons">${actions()}</div>${!v.choices.length&&g.phase!=='ended'?'<p class="turn-actions-empty">Waiting for the next eligible player. You can still read the board and your hand.</p>':''}${roll?`<div class="dice" aria-label="Last roll ${roll.total}"><span class="die">${roll.die1}</span><span class="die">${roll.die2}</span><span>Last roll · ${roll.total}</span></div>`:''}</aside></div>`;
}
function render(){
  const focused=document.activeElement?.id;
  document.body.classList.toggle('table-screen',screen==='table'&&!!view());
  if($('room').hidden!==!packet)$('room').hidden=!packet;
  const refreshDisabled=busy||!navigator.onLine||(saved?.retryAt||0)>Date.now(),connection=!navigator.onLine?'Offline':busy?'Checking table…':saved?.pending?'Move unresolved':ready?'Up to date':'Reconnect';
  if($('refresh').disabled!==refreshDisabled)$('refresh').disabled=refreshDisabled;
  if($('connection').textContent!==connection)$('connection').textContent=connection;
  let html='';
  if(screen==='home'){
    const games=[...knownGames];
    if(saved?.roomId&&!games.some(g=>g.roomId===saved.roomId))games.unshift({roomId:saved.roomId,status:packet?.status||'playing',players:packet?.members?.map(m=>m.name)||[],mode:solo()?'solo':'friends',botLevel:'standard'});
    html=`${recovery()}<section class="home-screen"><p class="eyebrow">Game Shelf</p><h1>Catan</h1><p class="muted">Continue a saved game or start a new one.</p><div class="home-actions">${button('New game','create','primary',blocked())}${button('Join a game','join','',blocked())}</div><section class="saved-games" aria-label="Saved games"><h2>Your games</h2>${games.length?games.map(g=>`<article class="saved-game"><div><h3>${esc(g.players.join(' · ')||'Saved game')}</h3><p>${g.mode==='solo'?'Solo · you + two bots':'You + a friend + one bot'} · ${g.botLevel==='easy'?'Easy':'Standard'}</p><small>${g.status==='waiting'?'Waiting for your friend':g.status==='ended'?'Finished':'In progress'} · ${esc(g.roomId.slice(0,8))}</small></div>${button(g.status==='ended'?'View result':'Resume game',`resume-game:${g.roomId}`,'',blocked())}</article>`).join(''):'<p class="muted">No saved games yet. Choose New game to get started.</p>'}<p class="safe-hint">Games opened in this browser appear here. Keep its data to retain your player identity. Internet is required to play.</p></section></section>`;
  }
  else if(['create','join'].includes(screen))html=`${recovery()}<section class="form-card">${button('← Back','home','back-link')}<p class="eyebrow">Catan</p><h1>${screen==='create'?'New game':'Join a game'}</h1><p class="muted">${screen==='create'?(formDraft.gameMode==='solo'?'Play against two bots. Your game starts right away.':'Choose players and bot level, then invite your friend.'):'The first invited friend takes the open seat.'}</p><form id="entry-form"><div class="form-fields"><label for="player-name">Your name</label><input id="player-name" maxlength="30" autocomplete="nickname" placeholder="Your name" value="${esc(formDraft.name)}" required>${screen==='create'?`<label for="game-mode">Players</label><select id="game-mode"><option value="friends" ${formDraft.gameMode==='friends'?'selected':''}>You + a friend + one bot</option><option value="solo" ${formDraft.gameMode==='solo'?'selected':''}>Solo · you + two bots</option></select><label for="bot-level">Bot level</label><select id="bot-level"><option value="standard" ${formDraft.level==='standard'?'selected':''}>Standard · resource priorities</option><option value="easy" ${formDraft.level==='easy'?'selected':''}>Easy · more varied choices</option></select>`:`<label for="room-id">Room ID</label><input id="room-id" value="${esc(formDraft.room??invitedRoom()??'')}" required autocomplete="off">`}</div><button class="primary" type="submit" ${blocked()?'disabled':''}>${screen==='create'?(formDraft.gameMode==='solo'?'Start solo game':'Create game'):'Join game'}</button></form><p class="safe-hint">No account form is needed. Clearing browser data loses access to your saved player identity.</p></section>`;
  else if(packet?.status==='waiting')html=`${recovery()}<section class="form-card"><p class="eyebrow">Your game is ready</p><h1>One seat for a friend.</h1><p class="muted">Share the invitation. Your friend joins from their own browser or installed app.</p><div class="lobby-seats">${packet.members.map(m=>`<div class="lobby-seat"><span class="avatar ${m.kind==='bot'?'bot':''}">${m.kind==='bot'?'B':'Y'}</span><div><strong>${esc(m.name)}${m.kind==='bot'?` · Bot (${m.level})`:' · You'}</strong><p class="muted">Ready to play</p></div></div>`).join('')}<div class="lobby-seat"><span class="avatar alex">?</span><div><strong>Your friend</strong><p class="muted">Waiting for the invitation</p></div></div></div><div class="lobby-buttons">${button('Share invitation','share','primary',busy)}${button('Check the game','refresh','quiet',busy)}</div><p class="lobby-status">The board opens when your friend joins. You keep your own separate seats.</p></section>`;
  else if(view())html=drawTable();else html=`${recovery()}<section class="empty-state"><h1>Checking your game.</h1><p class="muted">Your saved room and player identity are being restored.</p>${button('Return to start','home','quiet',busy)}</section>`;
  if(notice)html=`<div class="notice-bar ${error?'error':''}" role="status">${esc(notice)}</div>`+html;
  const replaced=html!==renderedHTML;
  if(replaced){$('app').innerHTML=html;renderedHTML=html;renderedBoard=null;}
  const boardKey=$('board')?JSON.stringify([view().state.board,view().state.players.players.map(p=>[p.id,p.color]),view().you,spatial,selection,blocked(),zoom,pan]):null;
  if($('board')&&boardKey!==renderedBoard){draw($('board'),view(),spatial,selection,blocked(),index=>{if(!blocked()){selection=index;selectionRevision=packet.revision;render();announce('Location selected. Confirm to commit it.');}},{zoom,pan});renderedBoard=boardKey;}
  if(replaced)for(const[action,label]of Object.entries({'zoom-in':'Zoom in on board','zoom-out':'Zoom out on board','zoom-reset':'Reset board view','pan-left':'Move board view left','pan-right':'Move board view right','pan-up':'Move board view up','pan-down':'Move board view down'}))document.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-label',label);
  if(replaced&&focused&&$(focused))$(focused).focus({preventScroll:true});
}
function apply(next){
  if(!next)return;
  if(!next.ok){notice=next.error.message;if(['room_not_found','session_expired'].includes(next.error.code))throw new PlayError('SESSION_EXPIRED',next.error.message);return;}
  if(packet?.roomId===next.roomId&&packet.revision>next.revision)return;
  const key=`${next.roomId}:${next.revision}:${next.status}`;
  if(key!==lastRenderKey){selection=null;mode='';lastRenderKey=key;}
  packet=next;
  if(screen!=='home'&&!['create','join'].includes(screen))screen='table';
  const bot=next.view?.seats.find(s=>s.id===next.view.state.game.currentPlayerId)?.kind==='bot';
  if(bot&&next.view.state.game.phase!=='discard'&&!next.view.offer){if(botRevision!==next.revision){botSince=Date.now();botRevision=next.revision;}if(Date.now()-botSince>20000)notice='The bot is taking longer than usual. Check the game to retry its next decision.';}else botSince=0;
}
function schedule(){clearTimeout(timer);if(['home','create','join'].includes(screen)&&!saved?.pending)return;if(document.hidden||!navigator.onLine||busy)return;if(error&&!error.retryable)return;if(botSince&&Date.now()-botSince>60000)return;if(saved?.pending||saved?.roomId||(saved?.retryAt||0)>Date.now()){const delay=Math.max(client.capabilities.pollIntervalMs,(saved?.retryAt||0)-Date.now());timer=setTimeout(()=>sync(),Math.min(2147483647,delay));}}
function sync(op,args={},options={}){
  if(activeSync){
    if(!op)return activeSync;
    // Keep the exact selected command while a read finishes; never drop a click.
    busy=true;ready=false;render();
    return activeSync.then(()=>{if(error||!navigator.onLine)return;return sync(op,args,options);});
  }
  activeSync=runSync(op,args,options).finally(()=>{activeSync=null;});
  return activeSync;
}
async function runSync(op,args={},options={}){
  clearTimeout(timer);
  if(!navigator.onLine){ready=false;error=new PlayError('NETWORK_UNAVAILABLE','Internet play is paused. Your saved data is still here.',{retryable:true});render();return;}
  const background=!op&&ready&&!error&&!saved?.pending&&!!packet;
  if(!background){busy=true;ready=false;error=null;render();}
  try{
    if(op){const result=op==='resume'?await client.resume(args.roomId):await client.execute(op,args,options);if(op==='resume'&&!result.ok){notice=result.error.message;ready=true;error=null;return;}apply(result);if(result?.ok){screen='table';history.replaceState(null,'',location.pathname+'#game');}}
    const recoveringEntry=['create','join'].includes(saved?.pending?.body.op);
    const latest=await client.refresh();apply(latest);if(latest?.ok&&recoveringEntry){screen='table';history.replaceState(null,'',location.pathname+'#game');}ready=true;error=null;
  }catch(e){error=e instanceof PlayError?e:new PlayError('PROTOCOL_ERROR','The game could not be safely read. Your saved data has been kept.');ready=false;notice='';if(screen==='home'&&error.code==='SESSION_EXPIRED'){notice=error.message;error=null;ready=true;}}
  finally{try{saved=(await client.inspect()).state;if(screen==='home')knownGames=await client.games();}catch(e){error=e;ready=false;}busy=false;render();schedule();}
}
async function sendAction(action){if(blocked()||!view())return;closeSheet();await sync('command',{roomId:packet.roomId,expectedRevision:packet.revision,action});}
function choose(candidates,titleText){openSheet(titleText,`<p class="muted">Choose one of the options available to your hand and the bank.</p><form id="choice-form"><label for="move-choice">Your choice</label><select id="move-choice">${candidates.map((c,i)=>`<option value="${i}">${esc(actionLabel(c))}</option>`).join('')}</select><div class="sheet-actions"><button class="primary" type="submit">Confirm choice</button></div></form>`);modalAction=candidates;}
function actionLabel(c){if(c.type==='BANK_TRADE')return `${c.give.amount} ${RESOURCE_NAMES[c.give.resource]} → ${c.receive.amount} ${RESOURCE_NAMES[c.receive.resource]}`;if(c.type==='PLAY_YEAR_OF_PLENTY')return c.resources.map(r=>RESOURCE_NAMES[r]).join(' + ');if(c.type==='PLAY_MONOPOLY')return RESOURCE_NAMES[c.resource];return c.type.toLowerCase().replaceAll('_',' ');}
function buildPanel(){const choices=view().choices,costs={BUILD_ROAD:'1 brick + 1 wood',BUILD_SETTLEMENT:'1 brick + 1 wood + 1 grain + 1 wool',BUILD_CITY:'3 ore + 2 grain',BUY_DEVELOPMENT_CARD:'1 ore + 1 grain + 1 wool'};openSheet('Make your next move',`<p class="muted">Preview a piece before committing it. Unavailable builds need more resources, a legal location, or an available piece.</p><div class="scenario-list">${[['BUILD_ROAD','Road'],['BUILD_SETTLEMENT','Settlement'],['BUILD_CITY','City'],['BUY_DEVELOPMENT_CARD','Development card']].map(([type,label])=>button(`${label}<span class="build-cost">${costs[type]}</span>`,`build:${type}`,'',!choices.some(c=>c.type===type))).join('')}</div>`);}
function offerPanel(){const v=view(),o=v.offer;if(!o)return;const mine=o.from===v.you;openSheet(mine?'Your offer is waiting':`${name(o.from)} has an offer`,`<p class="muted">${mine?'No cards move until the recipient accepts.':'Review the exact terms before accepting.'}</p><div class="offer-bundle"><span>${mine?'You give':'You receive'}</span><strong>${esc(money(o.give))}</strong></div><div class="offer-bundle"><span>${mine?'You receive':'You give'}</span><strong>${esc(money(o.receive))}</strong></div><div class="sheet-actions">${mine?button('Cancel offer','offer:TRADE_CANCEL','quiet',blocked()):button('Decline','offer:TRADE_DECLINE','quiet',blocked())+button('Accept trade','offer:TRADE_ACCEPT','primary',blocked()||!v.choices.some(c=>c.type==='TRADE_ACCEPT'))}</div>`);}
function tradePanel(){
  const me=ownPlayer(view());openSheet('A little give and take',`<p class="muted">Choose both sides of the offer. Nothing changes hands before acceptance.</p><form id="trade-form"><label for="trade-to">Offer to</label><select id="trade-to">${view().seats.filter(s=>s.id!==view().you).map(s=>`<option value="${s.id}" ${tradeDraft?.to===s.id?'selected':''}>${esc(s.name)}${s.kind==='bot'?' · Bot':''}</option>`).join('')}</select><div class="trade-grid"><span></span><span class="column-label">You give</span><span class="column-label">You receive</span>${RESOURCES.map(r=>`<label for="give-${r}">${art(r)}${RESOURCE_NAMES[r]}</label><input id="give-${r}" name="give-${r}" aria-label="Give ${RESOURCE_NAMES[r]}" type="number" inputmode="numeric" min="0" max="${me.resources[r]}" value="${tradeDraft?.give[r]||0}"><input name="receive-${r}" aria-label="Receive ${RESOURCE_NAMES[r]}" type="number" inputmode="numeric" min="0" max="19" value="${tradeDraft?.receive[r]||0}">`).join('')}</div><p id="form-error" class="error-text" role="alert"></p><div class="sheet-actions">${button('Bank or port','bank','quiet',!view().choices.some(c=>c.type==='BANK_TRADE'))}<button class="primary" type="submit">Review offer</button></div></form>`);
}
function discardPanel(){const v=view(),me=ownPlayer(v);openSheet(`Return ${v.state.game.discardAmounts[v.you]} cards`,`<p class="muted">Choose exactly the required number from your own hand. Their types stay private.</p><form id="discard-form"><div class="trade-grid"><span></span><span class="column-label">Return</span><span class="column-label">In hand</span>${RESOURCES.map(r=>`<label for="discard-${r}">${art(r)}${RESOURCE_NAMES[r]}</label><input id="discard-${r}" name="${r}" type="number" inputmode="numeric" min="0" max="${me.resources[r]}" value="0"><span class="column-label">${me.resources[r]}</span>`).join('')}</div><p id="discard-total" class="muted">0 selected</p><p id="form-error" class="error-text" role="alert"></p><div class="sheet-actions"><button class="primary" type="submit">Confirm discard</button></div></form>`);}
function cardPanel(index){const v=view(),card=ownPlayer(v).developmentCards.filter(c=>!c.isPlayed)[index];if(!card)return;const choices=v.choices.filter(c=>c.type===CARD_ACTION[card.type]);if(card.type==='victoryPoint'){openSheet('A private victory point','<p class="muted">This point counts toward your total and stays hidden from other players until the game ends. It is not an action card.</p>');return;}if(card.turnBought===v.state.game.turn){openSheet(CARD_NAMES[card.type],'<p class="muted">This card was bought this turn. It becomes playable on a later turn.</p>');return;}if(!choices.length){openSheet(CARD_NAMES[card.type],`<p class="muted">${card.turnBought===v.state.game.turn?'This card was bought this turn. It becomes playable on a later turn.':'This card cannot be played right now. You may have played another card this turn, or its effect is unavailable.'}</p>`);return;}if(choices.length>1){choose(choices,CARD_NAMES[card.type]);return;}openSheet(CARD_NAMES[card.type],`<p class="muted">${card.type==='knight'?'Move the robber, then choose an eligible victim.':'Place two free roads, one at a time.'}</p><div class="sheet-actions">${button('Not now','close','quiet')}${button(`Play ${CARD_NAMES[card.type]}`,'modal-confirm','primary',blocked())}</div>`);modalAction=choices[0];}
function resultPanel(){const v=view(),g=v.state.game;if(g.phase!=='ended')return;openSheet('An evening well played',`<div class="result"><span class="result-icon" aria-hidden="true">✧</span><p class="eyebrow">The island has a winner</p><h1>${g.winnerId===v.you?'You win.':esc(name(g.winnerId))+' wins.'}</h1><p class="muted">Thanks for a game together.</p>${v.state.players.players.map(p=>`<div class="result-score ${p.id===g.winnerId?'winner':''}"><span>${esc(p.name)}</span><span>${g.finalScores[p.id]} VP</span></div>`).join('')}<div class="sheet-actions">${button('View the board','close','quiet')}${button('New game','create','primary')}</div></div>`);}
function invitedRoom(){return new URLSearchParams(location.hash.split('?')[1]||'').get('room');}
function showInvitation(){if(!packet||solo())return;const link=new URL(location.href);link.hash=`join?room=${packet.roomId}`;openSheet('A seat for your friend',`<p class="muted">Share this private room link. Your friend joins from their own browser. The first valid guest takes the empty seat.</p><label for="invite-link">Invitation link</label><input id="invite-link" readonly value="${esc(link.href)}"><div class="sheet-actions">${button('Copy invitation','copy','primary')}</div><p id="copy-result" class="copy-result muted" role="status"></p>`);}
function begin(next){
  if(saved?.pending){notice='Resolve the original move before switching games.';render();return;}
  setScreen(next);
}
async function dispatch(action,el){
  if(action==='close'){closeSheet();return;}
  if(action==='refresh'){closeSheet();botSince=0;botRevision=-1;await sync();return;}
  if(action.startsWith('resume-game:')){closeSheet();await sync('resume',{roomId:action.slice(12)});return;}
  if(action==='home'){if(saved?.pending){notice='Your original move still needs to be resolved.';render();return;}closeSheet();knownGames=await client.games();setScreen('home');return;}
  if(action==='resume'){closeSheet();setScreen('table');await sync();return;}
  if(action==='create'||action==='solo'||action==='join'){if(action!=='join')formDraft.gameMode=action==='solo'?'solo':'friends';begin(action==='solo'?'create':action);return;}
  if(action==='room'){openSheet('Your game',`<p class="muted">${esc(packet?.members?.map(m=>m.name).join(', ')||'Your room')}</p><div class="scenario-list">${solo()?'<p class="muted">Solo · you and two bots. No invitation is needed.</p>':button('Invitation details','share')}${button('Check the game','refresh')}${button('Return to start','home')}</div><p class="safe-hint">Keep this browser or installation to retain your player identity. Internet play pauses without a connection.</p>`);return;}
  if(action==='share'){showInvitation();return;}
  if(action==='copy'){try{await navigator.clipboard.writeText($('invite-link').value);$('copy-result').textContent='Invitation copied.';}catch{$('invite-link').select();$('copy-result').textContent='Select and copy the invitation manually.';}return;}
  if(action==='results'){resultPanel();return;}
  if(action==='zoom-in'){zoom=1.4;render();return;}if(action==='zoom-out'||action==='zoom-reset'){zoom=1;render();return;}
  if(action.startsWith('pan-')){const d=action.slice(4);pan.x=Math.max(0,Math.min(200,pan.x+(d==='left'?-40:d==='right'?40:0)));pan.y=Math.max(0,Math.min(160,pan.y+(d==='up'?-40:d==='down'?40:0)));render();return;}
  if(action.startsWith('card:')){cardPanel(Number(action.split(':')[1]));return;}
  if(action==='offer'){offerPanel();return;}
  if(blocked()||!view())return;
  if(action==='build'){buildPanel();return;}
  if(action.startsWith('build:')){if(staleModal())return;const type=action.slice(6);if(type==='BUY_DEVELOPMENT_CARD'){const choice=view().choices.find(c=>c.type===type);if(choice)await sendAction(choice);return;}mode=type;selection=null;closeSheet();render();return;}
  if(action==='confirm'){if(selectionRevision===packet.revision&&spatial[selection])await sendAction(spatial[selection]);return;}
  if(action==='cancel-preview'){selection=null;mode='';render();return;}
  if(action.startsWith('quick:')){const choice=view().choices.find(c=>c.type===action.slice(6));if(choice)await sendAction(choice);return;}
  if(action==='trade'){tradePanel();return;}
  if(action==='bank'){choose(view().choices.filter(c=>c.type==='BANK_TRADE'),'Trade with the bank or port');return;}
  if(action==='discard'){discardPanel();return;}
  if(action==='victim'){const choices=view().choices.filter(c=>c.type==='STEAL_RESOURCE');openSheet('Who will you steal from?',`<p class="muted">Resource types stay hidden.</p><div class="scenario-list">${choices.map((c,i)=>button(`${esc(name(c.victimId))}<span>${count(c.victimId)} resource cards</span>`,`victim:${i}`)).join('')}</div>`);modalAction=choices;return;}
  if(action.startsWith('victim:')){if(staleModal())return;const choice=modalAction?.[Number(action.slice(7))];if(choice)await sendAction(choice);return;}
  if(action.startsWith('offer:')){if(staleModal())return;const choice=view().choices.find(c=>c.type===action.slice(6));if(choice)await sendAction(choice);return;}
  if(action==='modal-confirm'){if(staleModal())return;const choice=modalAction;if(choice&&!Array.isArray(choice))await sendAction(choice);}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;e.preventDefault();dispatch(el.dataset.action,el).catch(()=>{notice='That choice could not be completed. Please check the game.';render();});});
document.addEventListener('submit',e=>{
  const form=e.target;if(!['entry-form','trade-form','discard-form','choice-form'].includes(form.id))return;e.preventDefault();if(blocked())return;
  if(form.id==='entry-form'){const name=$('player-name').value.trim();if(!name)return;if(screen==='create')sync('create',{name,botLevel:$('bot-level').value,...($('game-mode').value==='solo'?{mode:'solo'}:{})},{replace:true});else{const roomId=$('room-id').value.trim();if(roomId===saved?.roomId){setScreen('table');sync();return;}if(!uuid(roomId)){notice='Enter a valid room ID from your invitation.';render();return;}sync('join',{name,roomId},{replace:true});}return;}
  if(staleModal())return;
  if(form.id==='choice-form'){const choice=modalAction?.[Number($('move-choice').value)];if(choice)sendAction(choice);return;}
  const data=new FormData(form),me=ownPlayer(view());
  if(form.id==='discard-form'){const resources=Object.fromEntries(RESOURCES.map(r=>[r,Number(data.get(r))]));if(handCount(resources)!==view().state.game.discardAmounts[view().you]||RESOURCES.some(r=>!Number.isSafeInteger(resources[r])||resources[r]<0||resources[r]>me.resources[r])){$('form-error').textContent='Select exactly the required number of cards from your hand.';return;}sendAction({type:'DISCARD_RESOURCES',resources});return;}
  const give=Object.fromEntries(RESOURCES.map(r=>[r,Number(data.get(`give-${r}`))])),receive=Object.fromEntries(RESOURCES.map(r=>[r,Number(data.get(`receive-${r}`))]));
  if(!handCount(give)||!handCount(receive)||RESOURCES.some(r=>!Number.isSafeInteger(give[r])||!Number.isSafeInteger(receive[r])||give[r]<0||receive[r]<0||give[r]>me.resources[r]||receive[r]>19||(give[r]&&receive[r]))){$('form-error').textContent='Offer at least one card on each side, using different resources. Give only cards you own.';return;}
  tradeDraft={to:$('trade-to').value,give,receive};openSheet('Review your offer',`<p class="muted">To ${esc(name(tradeDraft.to))}</p><div class="offer-bundle"><span>You give</span><strong>${esc(money(give))}</strong></div><div class="offer-bundle"><span>You receive</span><strong>${esc(money(receive))}</strong></div><div class="sheet-actions">${button('Edit offer','trade','quiet')}${button('Send offer','modal-confirm','primary')}</div>`);modalAction={type:'TRADE_OFFER',...tradeDraft};
});
document.addEventListener('input',e=>{if(e.target.id==='player-name')formDraft.name=e.target.value;if(e.target.id==='room-id')formDraft.room=e.target.value;if(e.target.id==='bot-level')formDraft.level=e.target.value;if(e.target.id==='game-mode'){formDraft.gameMode=e.target.value;render();}if(e.target.closest('#discard-form'))$('discard-total').textContent=`${handCount(Object.fromEntries(RESOURCES.map(r=>[r,Number($(`discard-${r}`).value)])))} selected`;});
$('refresh').onclick=()=>sync();$('room').onclick=()=>dispatch('room');
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#join')){if(saved?.pending){notice='Resolve your current move before joining another game.';render();}else setScreen('join');}else if(location.hash==='#home')dispatch('home');});
window.addEventListener('offline',()=>{clearTimeout(timer);ready=false;error=new PlayError('NETWORK_UNAVAILABLE','Internet play is paused. Your data is still here.',{retryable:true});render();});
window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else sync();});window.addEventListener('pageshow',()=>{if(saved&&!busy)sync();});
async function boot(){
  try{const existing=await client.inspect();saved=existing.state;packet=existing.packet;knownGames=await client.games();screen=location.hash==='#home'?'home':location.hash.startsWith('#join')&&invitedRoom()!==saved.roomId?'join':saved.roomId?'table':'home';ready=screen==='home'?!saved.pending:!saved.roomId&&!saved.pending;render();if(navigator.onLine&&(screen!=='home'||saved.pending))await sync();}catch(e){error=e;ready=false;render();}
}
boot();
