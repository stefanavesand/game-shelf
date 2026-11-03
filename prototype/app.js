import {drawBoard,symbol,resources,names,sampleTargets} from './board.js';

// UI-only fixture controller: no server, credentials, upstream engine or real moves.
const KEY='game-shelf-ui-prototype-v1';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const empty=()=>Object.fromEntries(resources.map(r=>[r,0]));
const fresh=()=>({schema:1,screen:'home',phase:'main',name:'You',botLevel:'standard',hand:{brick:3,wood:2,grain:1,wool:1,ore:0},card:'Knight',cards:[{type:'Knight',used:false,boughtThisTurn:false}],selectedCard:0,cardUsed:false,turn:12,net:'online',selection:null,pieces:[],roads:[],setupRound:1,pending:null,lastReceipt:null,simulation:'normal',notice:'Your game. Your next move.',zoom:1,winner:false,freeRoads:0,offer:null,friendJoined:false,hasGame:false,setupRun:false,pan:{x:100,y:82}});
function read(){try{const v=JSON.parse(sessionStorage.getItem(KEY));return v?.schema===1&&Array.isArray(v.pieces)&&Array.isArray(v.roads)?{...fresh(),...v}:fresh();}catch{return fresh();}}
let state=read(),timer=null,focusReturn=null;
const sheet=$('sheet');
function save(){try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{/* A disposable design preview never writes real game data. */}}
function announce(message){$('announcement').textContent=message;}
function closeSheet(){sheet.close();if(focusReturn?.isConnected)focusReturn.focus();}
function openSheet(title,html){focusReturn=document.activeElement;$('sheet-title').textContent=title;$('sheet-body').innerHTML=html;if(!sheet.open)sheet.showModal();const first=sheet.querySelector('input:not([readonly]),select,button:not(#close-sheet):not(:disabled)');(first||$('close-sheet')).focus();}
$('close-sheet').onclick=closeSheet;
const button=(label,action,classes='',disabled=false)=>`<button type="button" data-action="${action}" class="${classes}" ${disabled?'disabled':''}>${label}</button>`;
const person=(id,name,count,points)=>`<article class="player ${id}"><span class="avatar ${id}" aria-hidden="true">${id==='bot'?'B':id==='you'?'Y':'A'}</span><div><strong>${escape(name)} · ${points} VP${id==='bot'?` <span class="bot-tag">${state.botLevel==='easy'?'Easy':'Standard'}</span>`:''}</strong><small>${count} resource cards</small></div></article>`;
const blocked=()=>state.net!=='online'||!!state.pending;
const sum=bundle=>Object.values(bundle).reduce((a,b)=>a+b,0);
const bundleText=bundle=>resources.filter(r=>bundle[r]).map(r=>`${bundle[r]} ${names[r].toLowerCase()}`).join(' + ')||'nothing';
function hand(){return `<div class="resource-row">${resources.map(r=>`<div class="resource-tile ${r}">${symbol(r)}<span>${names[r]}</span><strong>${state.hand[r]}</strong></div>`).join('')}</div>`;}
function heading(){
  if(state.winner)return ['A lovely game.','You reached ten points.'];
  if(state.pending)return ['One moment…','Waiting for confirmation. Your preview is not committed yet.'];
  return ({'setup-settlement':[`Your ${state.setupRound===1?'first':'second'} settlement`,'Choose a highlighted intersection. Preview it, then confirm.'],'setup-road':['A road to start from','Choose an edge, then confirm your road.'],roll:['Your turn','Roll the dice, or play an eligible development card.'],main:['Your turn','Build, trade, or end your turn.'],'build-road':[state.freeRoads?`${state.freeRoads} free road${state.freeRoads===1?'':'s'} remaining`:'Build a road','Choose a highlighted edge.'],'build-settlement':['Build a settlement','Choose a highlighted intersection.'],'build-city':['Upgrade to a city','Choose one of your highlighted settlements.'],discard:['Time to discard','You have 10 resource cards. Choose exactly 5 to return.'],robber:['Move the robber','Choose a different highlighted tile, then confirm.'],steal:['Choose a victim','Only public resource-card counts are shown.'],waiting:['Alex’s turn','Take a breath. Your hand stays private.'],'bot-waiting':['The bot is choosing','The board updates after its move is confirmed.']})[state.phase]||['Your game','Choose the next action.'];
}
function recovery(){
  if(state.net==='online')return '';
  const data={offline:['You’re offline','The internet game is paused. Your current view is still here.','Reconnect'],unknown:['Waiting to resolve your move','The response was lost. We’ll check the original move before you can make another.','Resolve move'],reconnecting:['Reconnecting…','Checking the current game and the original move.','Checking…'],rate:['A short pause','The service asked us to wait. Retry is available after the cooldown.','Retry'],identity:['Your saved identity is missing','A room link cannot restore this seat. Return with the original installation, or start a separate new game.','Back to start'],expired:['This room has expired','The inactive room is no longer available. You can return to start and create another.','Back to start'],version:['An update is needed','This game needs a compatible app version. Your saved data has been kept.','Back to start'],bot:['The bot needs a moment','Its decision could not be completed. You can retry without taking over its seat.','Retry bot']};
  const [title,text,action]=data[state.net]||data.offline;
  return `<section class="recovery" role="status"><div><h2>${title}</h2><p>${text}</p></div>${button(action,['identity','expired','version'].includes(state.net)?'home':'reconnect','',state.net==='reconnecting'||(state.net==='rate'&&Date.now()<(state.retryAt||0)))}</section>`;
}
const costs={road:{brick:1,wood:1},settlement:{brick:1,wood:1,grain:1,wool:1},city:{grain:2,ore:3},development:{grain:1,wool:1,ore:1}};
const affordable=type=>Object.entries(costs[type]).every(([r,n])=>state.hand[r]>=n);
function targetType(){return state.phase.includes('road')?'road':state.phase==='robber'?'robber':'settlement';}
function targets(){const type=targetType();return (state.phase==='build-city'?[13,31]:sampleTargets[type]).filter(i=>type==='road'?!state.roads.some(r=>r.index===i):state.phase==='build-city'||!state.pieces.some(p=>p.index===i));}
function targetPanel(){
  if(!['setup-settlement','setup-road','build-road','build-settlement','build-city','robber'].includes(state.phase))return '';
  const type=targetType(),selected=state.selection!==null;
  const cost=state.phase.startsWith('build-')&&!state.freeRoads?`Cost: ${bundleText(costs[state.phase.slice(6)])}. `:'';
  return `<div class="selection-summary"><p>${cost}${selected?'Preview selected. Confirm to commit, or choose another location.':'Tap a highlighted location on the board.'}</p><div class="confirm-row">${button('Confirm','confirm','primary',!selected||blocked())}${button('Cancel','cancel-selection','',blocked())}</div></div>`;
}
function actions(){
  const disabled=blocked()||!!state.offer;
  if(state.phase==='roll')return button('Roll dice <span aria-hidden="true">⚄</span>','roll','primary',disabled);
  if(state.phase==='main')return `${button('Build <span class="arrow" aria-hidden="true">→</span>','build','primary',disabled)}${button('Trade <span class="arrow" aria-hidden="true">⇄</span>','trade','',disabled)}${button('End turn','end-turn','turn-end',disabled)}`;
  if(state.phase==='discard')return button('Choose cards to discard','discard','primary',disabled);
  if(state.phase==='steal')return button('Choose a player','victim','primary',disabled);
  if(state.phase==='waiting'||state.phase==='bot-waiting')return button('Preview next turn','next-turn','quiet',disabled);
  return '';
}
function render(){
  const activeId=document.activeElement?.id;document.body.classList.toggle('table-screen',state.screen==='table');
  const connection=$('connection');connection.className=`connection ${state.net!=='online'?'paused':''}`;connection.innerHTML=`<span class="status-dot"></span>${state.net==='online'?'Preview online':state.net==='reconnecting'?'Reconnecting…':state.net==='unknown'?'Move unresolved':'Play paused'}`;
  $('room').hidden=!['table','lobby'].includes(state.screen);
  if(state.screen==='home'){
    $('app').innerHTML=`<section class="entry"><div class="entry-copy"><p class="eyebrow">Catan · Game Shelf</p><h1>A little island.<br>A good evening.</h1><p class="muted">A game for you, a friend, and one bot.<br>Settle in. There’s no rush.</p><div class="entry-actions">${state.hasGame?button('Resume your game','resume','primary'):button('Create a room','create','primary')}${state.hasGame?button('Create another room','create'):''}${button('Join a friend','join')}${button('Explore the game','explore','quiet')}</div><a href="#" class="subtle-link" data-action="experiments">Looking for the earlier experiments?</a></div><div class="entry-art"><div class="entry-motif"><h2>Design preview</h2><p>Scripted examples for reviewing controls.</p><a href="../play/#home">Open the real game</a></div></div></section>`;
  }else if(['create','join'].includes(state.screen)){
    $('app').innerHTML=`<section class="form-card">${button('← Back','home','back-link')}<p class="eyebrow">Catan</p><h1>${state.screen==='create'?'Make an evening of it.':'Join your friend.'}</h1><p class="muted">${state.screen==='create'?'Invite a friend. A bot takes the third seat.':'Open your invitation, choose your name, and settle in.'}</p><form id="entry-form"><div class="form-fields"><label for="player-name">Your name</label><input id="player-name" name="name" maxlength="30" autocomplete="nickname" value="${state.name==='You'?'':escape(state.name)}" placeholder="Your name" required>${state.screen==='create'?'<label for="bot-level">Bot level</label><select id="bot-level"><option value="standard">Standard · resource priorities</option><option value="easy">Easy · more varied choices</option></select>':'<label for="invite-code">Invitation</label><input id="invite-code" value="EXAMPLE-GAME" readonly aria-describedby="invite-hint"><span id="invite-hint" class="muted">An example invitation for this design preview.</span>'}</div><button class="primary" type="submit">${state.screen==='create'?'Create room':'Join the game'}</button></form><p class="muted" style="font-size:11px;margin:17px 0 0">No account needed. Keep the same installation to return to your seat. Clearing its data loses access.</p></section>`;
  }else if(state.screen==='lobby'){
    $('app').innerHTML=`<section class="form-card">${button('← Back','home','back-link')}<p class="eyebrow">Your game is ready</p><h1>${state.friendJoined?'Everyone’s here.':'One seat for a friend.'}</h1><p class="muted">${state.friendJoined?'Two friends. One bot. Let’s find your first home.':'Share the invitation. The first friend to join takes the open seat.'}</p><div class="lobby-seats"><div class="lobby-seat"><span class="avatar">Y</span><div><strong>${escape(state.name)} <span class="muted">· You</span></strong><p class="muted">Ready to play</p></div></div><div class="lobby-seat"><span class="avatar alex">A</span><div><strong>${state.friendJoined?'Alex':'Your friend'}</strong><p class="muted">${state.friendJoined?'Ready to play':'Waiting for an invitation'}</p></div></div><div class="lobby-seat"><span class="avatar bot">B</span><div><strong>Bot <span class="bot-tag">${state.botLevel==='easy'?'Easy':'Standard'}</span></strong><p class="muted">The third seat is taken care of</p></div></div></div>${state.friendJoined?button('Place your first settlement','start-setup','primary'):button('Share invitation','share','primary')}<div class="sample-step"><p>This is a single-device design preview. No real room is created.</p>${button(state.friendJoined?'Explore a turn instead':'Preview Alex joining',state.friendJoined?'explore':'friend-joins','quiet')}</div></section>`;
  }else{
    const [title,description]=heading();
    $('app').innerHTML=`${recovery()}<div class="players" aria-label="Players">${person('you',state.name,sum(state.hand),state.winner?10:(state.setupRun?0:4)+state.pieces.filter(p=>p.owner==='you').length)}${person('alex','Alex',4,state.winner?7:state.setupRun?(state.setupRound===1?0:2):5)}${person('bot','Bot',6,state.winner?5:state.setupRun?(state.setupRound===1?0:2):3)}</div><div class="table-layout"><div class="board-column"><section class="board-wrap" aria-label="Game board"><span class="board-label">Catan · ${state.phase.startsWith('setup')?'Starting placements':`Turn ${state.turn}`}</span><svg id="board" role="group" aria-label="Island board and placement choices"></svg><div class="board-tools" aria-label="Board zoom">${button('+','zoom-in','icon-button')}${button('−','zoom-out','icon-button')}${button('⌖','zoom-reset','icon-button')}${state.zoom>1?button('←','pan-left','icon-button')+button('→','pan-right','icon-button')+button('↑','pan-up','icon-button')+button('↓','pan-down','icon-button'):''}</div></section><div class="board-caption">${state.phase.startsWith('setup')?'Two settlements and two roads each. The second round goes in reverse order.':state.winner?'The island has a winner. Thanks for an evening together.':'Red is you · blue is Alex · ochre is the bot'}</div><div class="history-row"><span class="history-dot"></span><span>${escape(state.notice||'Your next move is yours to choose.')}</span></div></div><aside class="action-panel" aria-label="Your hand and turn actions"><div class="turn-line"><div class="turn-icon" aria-hidden="true">${state.winner?'✧':state.phase.startsWith('setup')?'⌂':'☼'}</div><div><h1>${title}</h1><p>${description}</p></div></div>${state.phase.startsWith('setup')?`<div class="stepper" aria-label="Round ${state.setupRound} of 2"><span class="active"></span><span class="${state.setupRound===2?'active':''}"></span></div>`:''}<section class="panel-section"><p class="panel-label">Your resources <span class="muted">· ${sum(state.hand)} cards</span></p>${hand()}</section>${state.cards.some(c=>!c.used)?`<section class="panel-section development-section"><p class="panel-label">Your development cards</p>${state.cards.map((card,index)=>card.used?'':`<button data-action="card-index:${index}" class="card-button" ${blocked()||state.cardUsed||state.offer||!['main','roll'].includes(state.phase)?'disabled':''}><span class="card-icon" aria-hidden="true">♞</span> ${escape(card.type)} 1${card.boughtThisTurn?' · next turn':''} <span>→</span></button>`).join('')}</section>`:''}${state.offer?`<p class="inline-message">${state.offer.incoming?'Alex sent you an offer.':'Your offer is waiting for Alex.'}</p>${button('View trade','view-offer','full-width')}`:''}${targetPanel()}<div class="action-buttons">${actions()}</div>${state.phase==='main'?'<div class="dice" aria-label="Last roll: six and two, total eight"><span class="die">6</span><span class="die">2</span><span>Last roll · 8</span></div>':''}${state.winner?button('See the results','results','primary full-width'):''}</aside></div>`;
    drawBoard($('board'),state,index=>selectTarget(index));
    $('board').querySelectorAll('[role=button]').forEach(n=>{n.setAttribute('aria-disabled',String(blocked()));if(blocked())n.setAttribute('tabindex','-1');});
  }
  for(const [action,label]of Object.entries({'zoom-in':'Zoom in on board','zoom-out':'Zoom out on board','zoom-reset':'Reset board view','pan-left':'Move board view left','pan-right':'Move board view right','pan-up':'Move board view up','pan-down':'Move board view down'}))document.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-label',label);
  save();if(activeId&&$(activeId))$(activeId).focus({preventScroll:true});
}
function navigate(screen){if(state.pending&&screen!=='table'){openSheet('Resolve your move first',`<p class="muted">Your previous move is still unresolved. Check its outcome before switching games.</p><div class="sheet-actions">${button('Stay here','close','quiet')}${button('Resolve move','resolve-and-close','primary')}</div>`);return;}closeSheet();state.screen=screen;if(screen==='table')state.hasGame=true;state.selection=null;history.replaceState(null,'',`${location.pathname}#${screen==='table'?'table':screen}`);render();$('app').focus({preventScroll:true});}
function selectTarget(index){if(blocked())return;state.selection=index;render();announce('Location selected. Review the preview, then confirm.');}
function spend(cost){for(const[r,n]of Object.entries(cost))state.hand[r]-=n;}
function useCard(){state.cardUsed=true;if(state.cards[state.selectedCard])state.cards[state.selectedCard].used=true;}
function commitPending(){
  const move=state.pending;if(!move)return;
  if(state.lastReceipt!==move.id){
    const {kind,payload}=move;
    if(kind==='setup-settlement'){state.pieces.push({index:payload.target,owner:'you'});state.phase='setup-road';state.notice='Settlement confirmed. Now choose a road.';}
    if(kind==='setup-road'){state.roads.push({index:payload.target,owner:'you'});if(state.setupRound===1){state.pieces.push({index:8,owner:'alex'},{index:28,owner:'alex'},{index:17,owner:'bot'},{index:35,owner:'bot'});state.roads.push({index:17,owner:'alex'},{index:18,owner:'alex'},{index:32,owner:'bot'},{index:40,owner:'bot'});state.setupRound=2;state.phase='setup-settlement';state.notice='Example friend and bot placements complete. Round two returns in reverse order.';}else{state.phase='roll';state.hand={brick:1,wood:1,grain:1,wool:0,ore:0};state.notice='Starting placements complete. Resources come from your second settlement.';}}
    if(kind==='build-road'){state.roads.push({index:payload.target,owner:'you'});if(state.freeRoads){state.freeRoads--;state.phase=state.freeRoads?'build-road':'main';}else{spend(costs.road);state.phase='main';}state.notice='Your road is confirmed.';}
    if(kind==='build-settlement'){spend(costs.settlement);state.pieces.push({index:payload.target,owner:'you'});state.phase='main';state.notice='Your settlement is confirmed.';}
    if(kind==='build-city'){spend(costs.city);state.pieces.push({index:payload.target,owner:'you',city:true});state.phase='main';state.notice='Your city upgrade is confirmed.';}
    if(kind==='roll'){state.hand.wood++;state.phase='main';state.notice='You rolled eight. One wood collected in this example.';}
    if(kind==='end-turn'){state.phase='waiting';state.notice='Your turn is complete. Alex is up next.';}
    if(kind==='discard'){spend(payload);state.phase='robber';state.notice='Five cards returned. Now move the robber.';}
    if(kind==='robber'){state.phase='steal';state.notice='Robber move confirmed. Choose a player to steal from.';}
    if(kind==='steal'){state.hand.ore++;state.phase=state.afterRobber||'main';state.afterRobber=null;state.notice=`One ore drawn from ${payload.victim==='alex'?'Alex':'the bot'} in this example.`;}
    if(kind==='card'){useCard();if(payload.card==='Knight'){state.afterRobber=state.phase;state.phase='robber';}if(payload.card==='Road Building'){state.freeRoads=2;state.phase='build-road';}state.notice=`${payload.card} confirmed. Choose its effect.`;}
    if(kind==='plenty'){useCard();for(const r of payload.resources)state.hand[r]++;state.notice=`Collected ${payload.resources.map(r=>names[r].toLowerCase()).join(' and ')} in this example.`;}
    if(kind==='monopoly'){useCard();state.hand[payload.resource]+=3;state.notice=`Three ${names[payload.resource].toLowerCase()} collected in this example.`;}
    if(kind==='buy-card'){spend(costs.development);state.cards.push({type:'Knight',used:false,boughtThisTurn:true});state.notice='A new Knight. It becomes playable on your next turn.';}
    if(kind==='trade-offer'){state.tradeDraft=null;state.offer={incoming:false,...payload};state.notice='Your offer is waiting for a response.';}
    if(kind==='trade-accept'){for(const r of resources)state.hand[r]+=payload.receive[r]-payload.give[r];state.offer=null;state.notice='Trade accepted. Your resource counts have been updated in this example.';}
    if(kind==='trade-close'){state.offer=null;state.notice=payload.stale?'That offer was withdrawn. No resources were exchanged.':'The offer is closed. No resources were exchanged.';}
    if(kind==='bank-trade'){state.hand[payload.give]-=payload.ratio;state.hand[payload.receive]++;state.notice='Bank trade confirmed.';}
    state.lastReceipt=move.id;
  }
  state.pending=null;state.selection=null;state.net='online';state.simulation='normal';render();announce(state.notice);if(move.kind==='trade-offer')offerSheet();
}
function submitMove(kind,payload={}){
  if(blocked())return;closeSheet();state.pending={id:crypto.randomUUID(),kind,payload};render();clearTimeout(timer);
  timer=setTimeout(()=>{
    if(state.net!=='online'){state.notice='Your move remains unresolved until you reconnect.';render();return;}
    if(state.simulation==='lost-response'){state.net='unknown';state.notice='The original move is still unresolved.';render();announce('The move outcome is unknown. Resolve it before another move.');}
    else if(state.simulation==='rejection'){state.pending=null;state.selection=null;state.simulation='normal';state.notice='That location is no longer available. Please choose again.';render();announce(state.notice);}
    else commitPending();
  },450);
}
function reconnect(){
  if(!navigator.onLine){state.net='offline';render();return;}
  if(state.net==='reconnecting'||(state.net==='rate'&&Date.now()<(state.retryAt||0)))return;
  state.net='reconnecting';render();clearTimeout(timer);timer=setTimeout(()=>{if(state.pending)commitPending();else{state.net='online';state.notice='Back at the game. Your current view has been restored.';render();announce(state.notice);}},650);
}
function explore(){state={...fresh(),name:state.name,botLevel:state.botLevel,screen:'table',hasGame:true};navigate('table');}
function buildSheet(){openSheet('Make your next move',`<p class="muted">Choose what to build. You’ll preview its location before confirming.</p><div class="scenario-list">${[['road','Road'],['settlement','Settlement'],['city','City']].map(([key,title])=>button(`${title}<span>${bundleText(costs[key])}</span>`,`choose-build:${key}`,'',!affordable(key))).join('')}${button(`Development card<span>${bundleText(costs.development)}</span>`,'buy-card','',!affordable('development'))}</div>`);}
function tradeSheet(){const draft=state.tradeDraft;openSheet('A little give and take',`<p class="muted">Choose both sides of your offer. Nothing changes hands until it is accepted.</p><form id="trade-form"><label for="trade-to">Offer to</label><select id="trade-to"><option value="alex" ${draft?.to==='alex'?'selected':''}>Alex</option><option value="bot" ${draft?.to==='bot'?'selected':''}>Bot · ${state.botLevel}</option></select><div class="trade-grid"><span></span><span class="column-label">You give</span><span class="column-label">You receive</span>${resources.map(r=>`<label for="give-${r}">${symbol(r)}${names[r]}</label><input id="give-${r}" name="give-${r}" aria-label="Give ${names[r]}" type="number" inputmode="numeric" min="0" max="${state.hand[r]}" value="${draft?.give?.[r]??(r==='brick'?Math.min(1,state.hand[r]):0)}"><input name="receive-${r}" aria-label="Receive ${names[r]}" type="number" inputmode="numeric" min="0" max="19" value="${draft?.receive?.[r]??(r==='ore'?1:0)}">`).join('')}</div><p id="trade-error" class="error-text" role="alert"></p><div class="sheet-actions">${button('Bank or port trade','bank','quiet')}<button class="primary" type="submit">Review offer</button></div></form>`);}
function offerSheet(){
  const offer=state.offer;if(!offer)return;
  const canAccept=resources.every(r=>state.hand[r]>=offer.receive[r]);
  openSheet(offer.incoming?'Alex has an offer':'Your offer is waiting',`<p class="muted">${offer.incoming?'Review both sides before accepting.':'Your resources stay in your hand until the other player accepts.'}</p><div class="offer-bundle"><span>${offer.incoming?'You receive':'You give'}</span><strong>${escape(bundleText(offer.give))}</strong></div><div class="offer-bundle"><span>${offer.incoming?'You give':'You receive'}</span><strong>${escape(bundleText(offer.receive))}</strong></div>${offer.incoming?`<div class="sheet-actions">${button('Decline','decline-offer','quiet',blocked())}${button('Accept trade','accept-offer','primary',!canAccept||blocked())}</div>`:`<div class="sheet-actions">${button('Cancel offer','cancel-offer','quiet',blocked())}</div><div class="sample-step"><p>Preview the other player’s response.</p>${button('Preview acceptance','accept-outgoing','primary')}${button('Preview withdrawal','stale-offer','quiet')}</div>`}`);
}
function discardSheet(){openSheet('Choose five cards',`<p class="muted">You have ten resource cards. Return exactly five. Other players cannot see which cards you choose.</p><form id="discard-form"><div class="trade-grid discard-grid"><span></span><span class="column-label">Return</span><span class="column-label">In hand</span>${resources.map(r=>`<label for="discard-${r}">${symbol(r)}${names[r]}</label><input id="discard-${r}" name="${r}" type="number" inputmode="numeric" min="0" max="${state.hand[r]}" value="0"><span class="column-label">${state.hand[r]}</span>`).join('')}</div><p id="discard-total" class="muted">0 of 5 selected</p><p id="discard-error" class="error-text" role="alert"></p><div class="sheet-actions"><button class="primary" type="submit">Confirm discard</button></div></form>`);}
function bankSheet(){openSheet('Trade with the bank',`<p class="muted">An example 4:1 bank trade. A 3:1 port option is included to review the layout.</p><form id="bank-form"><div class="form-fields"><label for="bank-ratio">Exchange rate</label><select id="bank-ratio"><option value="4">Bank · 4 for 1</option><option value="3">Example port · 3 for 1</option><option value="2">Example wood port · 2 for 1</option></select><label for="bank-give">Give</label><select id="bank-give">${resources.map(r=>`<option value="${r}">${names[r]} · ${state.hand[r]} in hand</option>`).join('')}</select><label for="bank-receive">Receive</label><select id="bank-receive">${resources.map(r=>`<option value="${r}" ${r==='ore'?'selected':''}>${names[r]}</option>`).join('')}</select></div><p id="bank-error" class="error-text" role="alert"></p><div class="sheet-actions"><button class="primary" type="submit">Confirm exchange</button></div></form>`);}
function cardSheet(){
  if(state.cards[state.selectedCard]?.boughtThisTurn){openSheet('Ready for your next turn','<p class="muted">You bought this card this turn. It becomes playable on your next turn.</p>');return;}
  if(state.card==='Year of Plenty'){openSheet('Year of Plenty',`<p class="muted">Choose two resources from the bank.</p><form id="plenty-form"><div class="form-fields">${[1,2].map(i=>`<label for="plenty-${i}">Resource ${i}</label><select id="plenty-${i}">${resources.map(r=>`<option value="${r}">${names[r]}</option>`).join('')}</select>`).join('')}</div><div class="sheet-actions"><button class="primary" type="submit">Confirm resources</button></div></form>`);return;}
  if(state.card==='Monopoly'){openSheet('Monopoly',`<p class="muted">Choose one resource type. The preview uses an example collection of three cards.</p><form id="monopoly-form"><div class="form-fields"><label for="monopoly-resource">Resource</label><select id="monopoly-resource">${resources.map(r=>`<option value="${r}">${names[r]}</option>`).join('')}</select></div><div class="sheet-actions"><button class="primary" type="submit">Play Monopoly</button></div></form>`);return;}
  openSheet(state.card,`<p class="muted">${state.card==='Knight'?'Move the robber, then choose an eligible player to steal from.':'Place two free roads, one at a time. Preview and confirm each road.'}</p><div class="sheet-actions">${button('Not now','close','quiet')}${button(`Play ${escape(state.card)}`,'play-card','primary')}</div>`);
}
function results(){openSheet('An evening well played',`<div class="result"><span class="result-icon" aria-hidden="true">✧</span><p class="eyebrow">The island has a winner</p><h1>${state.name==='You'?'You win.':`${escape(state.name)} wins.`}</h1><p class="muted">Ten points. A few good trades. Thanks for playing.</p><div class="result-score winner"><span>${escape(state.name)}</span><span>10 VP</span></div><div class="result-score"><span>Alex</span><span>7 VP</span></div><div class="result-score"><span>Bot · ${state.botLevel}</span><span>5 VP</span></div><p class="muted" style="font-size:11px;margin-top:13px">Example result: three cities, two settlements and largest army.</p><div class="sheet-actions">${button('View the board','close','quiet')}${button('Create another room','create','primary')}</div></div>`);}
const scenarios=[['home','Start / resume'],['lobby','Room and invitation'],['setup','Starting placements'],['main','Ordinary turn'],['city','Upgrade to a city'],['trade','Incoming trade'],['discard','Discard and robber'],['knight','Play a Knight'],['roads','Road Building'],['plenty','Year of Plenty'],['monopoly','Monopoly'],['offline','Lost connection'],['unknown','Unresolved move'],['rate','Rate cooldown'],['identity','Missing identity'],['expired','Expired room'],['version','Incompatible version'],['bot','Bot needs help'],['victory','Victory']];
function scenarioMenu(){openSheet('Explore the design',`<p class="muted">Each scene uses disposable example data. These controls are for reviewing the prototype, not the final game interface.</p><div class="scenario-list">${scenarios.map(([id,label])=>button(`${label}<span>→</span>`,`scenario:${id}`)).join('')}</div><div class="sample-step"><p>Explore an interruption on the next confirmed placement.</p>${button('Lose the next response','simulate-lost')}${button('Reject the next placement','simulate-rejection','quiet')}</div><div class="sheet-actions">${button('Reset preview','reset','quiet')}</div>`);}
function loadScenario(id){
  clearTimeout(timer);closeSheet();const name=state.name,level=state.botLevel;state={...fresh(),name,botLevel:level,screen:'table',hasGame:true};
  if(id==='home')state.screen='home';
  if(id==='lobby')state.screen='lobby';
  if(id==='setup'){state.phase='setup-settlement';state.hand=empty();state.cards=[];state.setupRun=true;}
  if(id==='city'){state.hand={brick:1,wood:1,grain:2,wool:1,ore:3};state.phase='build-city';}
  if(id==='discard'){state.phase='discard';state.hand={brick:4,wood:3,grain:2,wool:1,ore:0};}
  if(id==='trade')state.offer={incoming:true,give:{...empty(),ore:1},receive:{...empty(),brick:1}};
  if(id==='roads')state.card='Road Building';
  if(id==='plenty')state.card='Year of Plenty';
  if(id==='monopoly')state.card='Monopoly';
  if(['roads','plenty','monopoly','knight'].includes(id))state.cards=[{type:state.card,used:false,boughtThisTurn:false}];
  if(['offline','rate','identity','expired','version','bot'].includes(id))state.net=id;
  if(id==='rate'){state.retryAt=Date.now()+3000;timer=setTimeout(render,3100);}
  if(id==='unknown'){state.phase='build-settlement';state.net='unknown';state.pending={id:crypto.randomUUID(),kind:'build-settlement',payload:{target:sampleTargets.settlement[0]}};state.notice='A settlement preview is awaiting its original outcome.';}
  if(id==='victory')state.winner=true;
  history.replaceState(null,'',`${location.pathname}#${state.screen}`);render();$('app').focus({preventScroll:true});if(id==='trade')offerSheet();if(id==='victory')results();
}
function dispatch(action,el){
  if(action.startsWith('scenario:')){loadScenario(action.slice(9));return;}
  if(action.startsWith('choose-build:')){const type=action.split(':')[1];if(!affordable(type))return;state.phase=`build-${type}`;state.selection=null;closeSheet();render();return;}
  if(action==='home'){clearTimeout(timer);navigate('home');return;}
  if(action==='resume'){navigate('table');return;}
  if(action==='resolve-and-close'){closeSheet();state.screen='table';reconnect();return;}
  if(action==='create'||action==='join'){if(state.hasGame||state.pending){openSheet('Start a different example?',`<p class="muted">Keep your current game, or reset this disposable design example. In the real app, switching rooms must preserve the previous room and unresolved moves.</p><div class="sheet-actions">${button('Keep this game','resume','quiet')}${button('Start another example',`reset-to:${action}`,'primary')}</div>`);}else navigate(action);return;}
  if(action.startsWith('reset-to:')){state={...fresh(),name:state.name,botLevel:state.botLevel};navigate(action.split(':')[1]);return;}
  if(action==='explore'){explore();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reset'){clearTimeout(timer);state=fresh();navigate('home');return;}
  if(action==='friend-joins'){state.friendJoined=true;render();return;}
  if(action==='start-setup'){state.net='online';state.setupRun=true;state.hand=empty();state.cards=[];state.phase='setup-settlement';state.setupRound=1;state.pieces=[];state.roads=[];navigate('table');return;}
  if(action==='share'){const url=new URL(location.href);url.hash='join';openSheet('A seat for your friend',`<p class="muted">A sample invitation for this design preview. Opening it shows the join flow, not a connected multiplayer room.</p><label for="invite-link">Invitation link</label><input id="invite-link" readonly value="${escape(url.href)}"><div class="sheet-actions">${button('Copy invitation','copy-link','primary')}</div><p id="copy-status" role="status" class="muted"></p>`);return;}
  if(action==='copy-link'){navigator.clipboard?.writeText($('invite-link').value).then(()=>{$('copy-status').textContent='Invitation copied.';}).catch(()=>{$('invite-link').select();$('copy-status').textContent='Select and copy the invitation.';});if(!navigator.clipboard){$('invite-link').select();$('copy-status').textContent='Select and copy the invitation.';}return;}
  if(action==='experiments'){openSheet('A little room for experiments','<p class="muted">Hello world, tic-tac-toe and local starting placements will live away from the main game flow. They are not included in this design preview.</p>');return;}
  if(action==='zoom-in'){state.zoom=1.4;render();return;}
  if(action.startsWith('pan-')){const p=state.pan;const direction=action.slice(4);p.x=Math.max(0,Math.min(200,p.x+(direction==='left'?-40:direction==='right'?40:0)));p.y=Math.max(0,Math.min(160,p.y+(direction==='up'?-40:direction==='down'?40:0)));render();return;}
  if(action==='zoom-out'||action==='zoom-reset'){state.zoom=1;render();return;}
  if(action==='reconnect'){closeSheet();reconnect();return;}
  if(action==='results'){results();return;}
  if(action==='view-offer'){offerSheet();return;}
  if(action==='simulate-lost'||action==='simulate-rejection'){state.simulation=action==='simulate-lost'?'lost-response':'rejection';closeSheet();state.notice=action==='simulate-lost'?'The next confirmed placement will demonstrate a lost response.':'The next confirmed placement will demonstrate a rejection.';render();return;}
  if(action==='decline-offer'||action==='cancel-offer'||action==='stale-offer'){if(blocked())return;submitMove('trade-close',{stale:action==='stale-offer'});return;}
  if(action==='accept-offer'||action==='accept-outgoing'){
    const offer=state.offer;if(!offer)return;const give=offer.incoming?offer.receive:offer.give,receive=offer.incoming?offer.give:offer.receive;
    if(resources.some(r=>state.hand[r]<give[r]))return;
    submitMove('trade-accept',{give,receive});return;
  }
  if(blocked())return;
  if(action==='target'){selectTarget(Number(el.dataset.index));return;}
  if(action==='confirm'){if(state.selection!==null)submitMove(state.phase,{target:state.selection});return;}
  if(action==='cancel-selection'){state.selection=null;if(!state.phase.startsWith('setup')&&state.phase!=='robber'&&!state.freeRoads)state.phase='main';render();return;}
  if(action==='build'){buildSheet();return;}
  if(action==='trade'){tradeSheet();return;}
  if(action==='bank'){bankSheet();return;}
  if(action==='discard'){discardSheet();return;}
  if(action.startsWith('card-index:')){state.selectedCard=Number(action.split(':')[1]);state.card=state.cards[state.selectedCard].type;cardSheet();return;}
  if(action==='play-card'){submitMove('card',{card:state.card});return;}
  if(action==='victim'){openSheet('Who will you steal from?',`<p class="muted">Choose an eligible player. Their resource types stay hidden.</p><div class="scenario-list">${button('Alex <span>4 resource cards</span>','steal:alex')}${button('Bot <span>6 resource cards</span>','steal:bot')}</div>`);return;}
  if(action.startsWith('steal:')){submitMove('steal',{victim:action.split(':')[1]});return;}
  if(action==='buy-card'){if(affordable('development'))submitMove('buy-card');return;}
  if(action==='roll'||action==='end-turn'){submitMove(action);return;}
  if(action==='next-turn'){state.phase='roll';state.turn++;state.cardUsed=false;state.cards.forEach(c=>{c.boughtThisTurn=false;});state.notice='Alex and the bot finished their example turns. Back to you.';render();return;}
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;event.preventDefault();dispatch(el.dataset.action,el);});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['entry-form','trade-form','discard-form','bank-form','plenty-form','monopoly-form'].includes(form.id))return;event.preventDefault();
  if(form.id==='entry-form'){state.name=$('player-name').value.trim()||'You';state.botLevel=$('bot-level')?.value||state.botLevel;state.friendJoined=state.screen==='join';navigate('lobby');return;}
  if(blocked())return;
  if(form.id==='trade-form'){
    const data=new FormData(form),give=empty(),receive=empty();for(const r of resources){give[r]=Number(data.get(`give-${r}`));receive[r]=Number(data.get(`receive-${r}`));}
    if(!sum(give)||!sum(receive)||resources.some(r=>!Number.isInteger(give[r])||!Number.isInteger(receive[r])||give[r]<0||receive[r]<0||give[r]>state.hand[r]||(give[r]&&receive[r]))){$('trade-error').textContent='Choose at least one card on each side. Give only cards you own; use different resources on each side.';return;}
    const to=$('trade-to').value;state.tradeDraft={give,receive,to};save();
    openSheet('Review your offer',`<p class="muted">To ${to==='alex'?'Alex':'the bot'}</p><div class="offer-bundle"><span>You give</span><strong>${escape(bundleText(give))}</strong></div><div class="offer-bundle"><span>You receive</span><strong>${escape(bundleText(receive))}</strong></div><div class="sheet-actions">${button('Edit offer','trade','quiet')}${button('Send offer','send-reviewed-offer','primary')}</div>`);
    $('sheet-body').querySelector('[data-action=send-reviewed-offer]').onclick=()=>{submitMove('trade-offer',{give,receive,to});};return;
  }
  if(form.id==='discard-form'){const values=Object.fromEntries(resources.map(r=>[r,Number(new FormData(form).get(r))]));if(sum(values)!==5||resources.some(r=>!Number.isInteger(values[r])||values[r]<0||values[r]>state.hand[r])){$('discard-error').textContent='Select exactly five cards from your hand.';return;}submitMove('discard',values);return;}
  if(form.id==='bank-form'){const ratio=Number($('bank-ratio').value),give=$('bank-give').value,receive=$('bank-receive').value;if(give===receive||state.hand[give]<ratio||(ratio===2&&give!=='wood')){$('bank-error').textContent='Choose different resources and give only cards you own. The example 2:1 port accepts wood.';return;}submitMove('bank-trade',{give,receive,ratio});return;}
  if(form.id==='plenty-form'){submitMove('plenty',{resources:[$('plenty-1').value,$('plenty-2').value]});return;}
  if(form.id==='monopoly-form')submitMove('monopoly',{resource:$('monopoly-resource').value});
});
document.addEventListener('input',event=>{if(event.target.closest('#discard-form')){const count=sum(Object.fromEntries(resources.map(r=>[r,Number($(`discard-${r}`).value)])));$('discard-total').textContent=`${count} of 5 selected`;}});
$('review').onclick=scenarioMenu;
$('room').onclick=()=>openSheet('Your game',`<p class="muted">${escape(state.name)}, Alex, and one ${state.botLevel} bot. Example data only.</p><div class="scenario-list">${button('Invitation details','share')}${button('Return to start','home')}</div><p class="muted" style="margin-top:18px;font-size:12px">In the real game, keep the same installation to retain your seat. A room link does not restore a lost identity.</p>`);
window.addEventListener('hashchange',()=>{if(location.hash==='#join')navigate('join');else if(location.hash==='#home')navigate('home');});
window.addEventListener('offline',()=>{state.net='offline';render();});
window.addEventListener('online',()=>{if(state.net==='offline')reconnect();});
if(state.pending&&state.net==='online')state.net='unknown';
const requested=new URL(location.href).searchParams.get('scenario');
if(location.hash==='#join')navigate('join');else if(requested&&scenarios.some(([id])=>id===requested)&&!sessionStorage.getItem(KEY))loadScenario(requested);else render();
