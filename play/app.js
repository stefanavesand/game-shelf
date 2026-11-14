import {scenarioPicker} from './presentation/scenarios.js';
import {automaticSteal} from './presentation/forced-action.js';
import {resourceHand,developmentCards,showHelp,showScores,refreshScores} from './presentation/panels.js';
import {trackViewport} from './presentation/viewport.js';
import {createTradePages,itemPages} from './presentation/dialog-pages.js';
import {esc,button} from './presentation/html.js';
import {turnTitle} from './presentation/game-view.js';
import {createGameMotion} from './presentation/motion.js';
import {createMovePacer} from './presentation/move-pacer.js';
import {createActivity} from './presentation/activity.js';
import {createActivityScroll} from './presentation/activity-scroll.js';
import {gameScreen} from './presentation/game-screen.js';
import {createOverlays} from './presentation/overlays.js';
import {createGoogleAuth,isGoogleReturn} from './core/google-auth.js';
import {withUpdateLock} from './lifecycle.js';
import {canSupplyOffer,updateTradeFeedback,unavailableIncomingOffer,resolveUnavailableOffers} from './trade-feedback.js';
import {CARD_RULES,ACTION_CARD_TIMING} from './help.js';
import {setupPwa} from './pwa.js';
import {offerDraft,offerIssue,tradeLimit,tradeLabel,bankChoices,bankBundles} from './trade.js';
import {client} from './session.js';
import {draw} from './board.js';
import {symbol} from './presentation/art.js';
import {PlayError} from './core/errors.js';
import {RESOURCES,RESOURCE_NAMES,CARD_NAMES,CARD_ACTION,ownPlayer,handCount,bundleLabel,uuid} from './core/protocol.js';
const $=id=>document.getElementById(id),sheet=$('sheet'),reply=$('trade-reply');
const art=r=>symbol(r==='lumber'?'wood':r);
let packet=null,saved=null,screen='home',busy=false,ready=false,error=null,notice='',mode='',selection=null,selectionRevision=-1,spatial=[],timer=null,modalRevision=null,modalRoom=null,modalYou=null,modalAction=null,lastRenderKey='',botSince=0,botRevision=-1;
let knownGames=[],tradeFeedback=[],accountBusy=false,updateReloadPending=false;
const googleAuth=createGoogleAuth(),motion=createGameMotion(),movePacer=createMovePacer();
const activity=createActivity({principal:()=>googleAuth.profile()?.id||''}),activityScroll=createActivityScroll();
let invitationToken=new URLSearchParams(location.hash.split('?')[1]||'').get('invite');
let tradeMode='players',bankGive=null,bankReceive=null,bankRevision=null,bankRatio=null,tradeViewKey=null,tradeEditing=false,counterDraftOfferId=null,tradeStartRevision=null,lastIncomingOffer=null;
let activeSync=null,renderedHTML=null,renderedBoard=null,renderedMenu=null;
let tradeDraft=null,opener=null,formDraft={room:null,level:'standard',scenario:'classic',gameMode:'friends',playerCount:3};
function announce(s){$('announcement').textContent=s;}
const view=()=>packet?.view;
const solo=()=>client.isLocal()||(packet?.status!=='waiting'&&packet?.members?.filter(s=>s.kind==='human').length===1&&packet?.members?.filter(s=>s.kind==='bot').length>=2);
const player=id=>view()?.state.players.players.find(p=>p.id===id);
const name=id=>player(id)?.name||packet?.members?.find(s=>s.id===id)?.name||'Player';
const offlineAllowed=()=>client.isLocal()||['home','create'].includes(screen);
const blocked=()=>updateReloadPending||busy||accountBusy||packet?.pendingRandom||!ready||!!saved?.pending||(!navigator.onLine&&!offlineAllowed())||!!(saved?.retryAt>Date.now());
const count=id=>player(id)?.resourceCount||0;
const offerRecipients=o=>o?(o.recipients||[o.to]):[];
const pendingRecipients=o=>offerRecipients(o).filter(id=>!o.responses?.[id]);
const incoming=()=>pendingRecipients(view()?.offer).includes(view()?.you);
const recipientName=id=>id==='all'?'All':name(id);
function currentTradeResult(v=view()){return tradeStartRevision===null||!v?null:[...(v.trades||[])].reverse().find(t=>t.from===v.you&&t.revision>=tradeStartRevision);}
function closeSheet(){counterDraftOfferId=null;if(sheet.dataset.trade==='live'&&currentTradeResult()?.status==='accepted')tradeDraft=null;tradeStartRevision=null;reply.close();reply.dataset.offerId='';sheet.dataset.trade='';tradeViewKey=null;sheet.close();modalAction=null;modalRevision=null;modalRoom=null;modalYou=null;if(opener?.isConnected)opener.focus({preventScroll:true});else if(opener?.id)$(opener.id)?.focus({preventScroll:true});}
function openSheet(title,body){overlays.closeDrawer();reply.close();sheet.dataset.trade='';opener=document.activeElement;modalRevision=packet?.revision??null;modalRoom=packet?.roomId??null;modalYou=packet?.you??null;$('sheet-title').textContent=title;$('sheet-body').innerHTML=body;if(!sheet.open)overlays.show(sheet);(sheet.querySelector('input:not([readonly]),select,button:not(#close-sheet):not(:disabled)')||$('close-sheet')).focus();}
const tradePages=createTradePages(sheet);
const overlays=createOverlays({sheet,reply,drawer:$('sidebar'),closeSheet});
$('close-sheet').onclick=closeSheet;
$('close-trade-reply').onclick=()=>reply.close();
const modalChanged=()=>modalRevision!==null&&(modalRevision!==packet?.revision||modalRoom!==packet?.roomId||modalYou!==packet?.you);
function staleModal(){if(modalChanged()){closeSheet();notice='The game changed while this panel was open. Please review your choice again.';render();return true;}return false;}
function setScreen(next){screen=next;history.replaceState(null,'',`${location.pathname}#${next==='table'?'game':next}${next==='join'&&uuid(invitedRoom())?'?room='+invitedRoom()+(invitationToken?'&invite='+encodeURIComponent(invitationToken):''):''}`);render();$('app').focus({preventScroll:true});}
function money(bundle){return bundleLabel(bundle).replaceAll('lumber','wood');}
function recovery(){
  if(!error&&packet?.pendingRandom&&navigator.onLine&&screen==='table')return '';
  if(!error&&!saved?.pending&&(navigator.onLine||offlineAllowed()))return '';
  const permanent=error&&['AUTH_REQUIRED','UNSUPPORTED_VERSION','UPDATE_PENDING','SESSION_EXPIRED','UNSUPPORTED_BROWSER'].includes(error.code),pending=!!saved?.pending;
  const oldLocal=error?.code==='UNSUPPORTED_VERSION'&&knownGames.some(g=>g.local&&g.compatible===false);
  const title=oldLocal?'An older saved game needs attention':!navigator.onLine?'You’re offline':error?.code==='AUTH_REQUIRED'?'Your player identity needs attention':error?.code==='SESSION_EXPIRED'?'This room has expired':error?.code==='UNSUPPORTED_VERSION'?'A compatible app is needed':pending?'Let’s check your original move':busy?'Reconnecting…':'The game needs a moment';
  const text=oldLocal?'This saved game uses an older engine. It is still stored on this device. Abandon it below to start a new game.':!navigator.onLine?'Internet play is paused. Reconnect to check the game before making a move.':error?.message||(pending?'Your move is waiting for confirmation. We’ll resolve it before sending another.':'Check the connection to continue.');
  return `<section class="recovery" role="status"><div><h2>${title}</h2><p>${esc(text)}</p>${oldLocal?'<p class="error-help">Reloading cannot change a saved game’s engine. Abandonment keeps the saved snapshot and leaves your player identity intact.</p>':permanent?'<p class="error-help">Keep the original installation and saved data. Returning to this room requires its original player identity.</p>':''}</div>${oldLocal?button('Review saved games','home','primary',busy):error?.code==='UPDATE_PENDING'?button('Return home','apply-update','primary',busy):error?.code==='UNSUPPORTED_VERSION'?(button('Reload app','reload-app','primary',busy)+(pending?button('Resolve move','refresh','',true):'')):button(pending?'Resolve move':'Reconnect','refresh','',busy||(!navigator.onLine&&!offlineAllowed())||(saved?.retryAt||0)>Date.now()||permanent)}</section>`;
}
function title(){if(packet?.pendingRandom)return ['Rolling dice…','Waiting for the host to record the result. Keep this game open.'];return turnTitle({view:view(),pending:saved?.pending,mode,unavailable:unavailableIncomingOffer(view()),incoming:incoming(),name});}
function resourcesPanel(){return resourceHand(view());}
function cardsPanel(){return developmentCards(view(),{disabled:busy||(!navigator.onLine&&!client.isLocal())});}
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
 const v=view(),g=v.state.game,types=new Set(v.choices.map(c=>c.type)),main=g.phase==='main'&&!v.offer&&!mode;
 return button('Build','build','primary',blocked()||!main||g.currentPlayerId!==v.you)+button('Trade','trade','',blocked()||!main)+button('End turn','quick:END_TURN','turn-end',blocked()||!main||!types.has('END_TURN'));
}
function flowActions(){const v=view(),types=new Set(v.choices.map(c=>c.type));
 if(v.state.game.phase==='ended')return button('View results','results','primary');
 if(types.has('ROLL_DICE'))return button('Roll dice','quick:ROLL_DICE','primary',blocked());
 if(types.has('DISCARD_RESOURCES'))return button('Choose cards to discard','discard','primary',blocked());
 if(types.has('STEAL_RESOURCE'))return button('Choose a player','victim','primary',blocked());
 return '';
}
function actingPlayers(v){const g=v.state.game;return g.phase==='ended'?[]:v.offer?pendingRecipients(v.offer):g.phase==='discard'?g.pendingDiscard:[g.currentPlayerId];}
function actorStatus(v){if(unavailableIncomingOffer(v))return 'Resolving trade';const g=v.state.game,actors=actingPlayers(v).map(name).join(', ');return g.phase==='ended'?'Game finished':v.offer?`${actors} responds to the trade · Turn owner: ${name(g.currentPlayerId)}`:g.phase==='discard'?`${actors} must discard · Turn owner: ${name(g.currentPlayerId)}`:`${actors} is acting`;}
function drawTable(){
 const v=view(),[heading,description]=title();spatial=selectSpatial();if(selection!==null&&!spatial[selection])selection=null;
 return gameScreen({view:v,heading,description,actor:actorStatus(v),actors:actingPlayers(v),entries:activity.observe(packet),flowActions:flowActions(),saving:(busy||!!saved?.pending)&&!packet?.pendingRandom,resources:resourcesPanel(),placements:placements(),actions:actions(),recovery:recovery(),cards:ownPlayer(v).developmentCards.filter(c=>!c.isPlayed).length,offer:v.offer&&!(incoming()&&!canSupplyOffer(v))?button(incoming()?'View offer':v.offer.from===v.you?'View your offer':'View trade','offer','primary',blocked()):'',continueOffer:unavailableIncomingOffer(v)?button('Continue game','skip-offer','primary',blocked()):''});
}
function render(){
  const focused=document.activeElement?.id,feedPosition=activityScroll.capture();
  document.body.classList.toggle('table-screen',screen==='table'&&!!view()&&!!googleAuth.profile());
  const hasAccount=!!googleAuth.profile();$('room').hidden=false;$('room').disabled=updateReloadPending;$('help').disabled=updateReloadPending;document.querySelector('.header-turn').textContent=screen==='table'&&view()?title()[0]:'';
  const refreshDisabled=updateReloadPending||busy||(!navigator.onLine&&!offlineAllowed())||(saved?.retryAt||0)>Date.now(),connection=client.isLocal()?(busy?'Saving…':'Local · saved'):!navigator.onLine?'Offline':busy?'Checking game…':packet?.pendingRandom?'Waiting for host':saved?.pending?'Move unresolved':ready?'Up to date':'Reconnect';
  if($('refresh').disabled!==refreshDisabled)$('refresh').disabled=refreshDisabled;
  $('refresh').classList.toggle('paused',(!navigator.onLine&&!client.isLocal())||!!error);
  if($('connection').textContent!==connection)$('connection').textContent=connection;
  let html='';
  if(!hasAccount){screen='home';html=`<section class="home-screen"><p class="eyebrow">Game Shelf</p><h1>Let’s play.</h1>${accountPanel()}</section>`;}
  else if(screen==='home'){
    const games=[...knownGames];
    if(saved?.roomId&&!games.some(g=>g.roomId===saved.roomId))games.unshift({roomId:saved.roomId,status:packet?.status||'playing',players:packet?.members?.map(m=>m.name)||[],mode:packet?(solo()?'solo':'friends'):null,botLevel:packet?.botPolicy?'planner':packet?.members?.find(m=>m.kind==='bot')?.level||null});
    html=`${recovery()}<section class="home-screen"><p class="eyebrow">Game Shelf</p><h1>Catan</h1><p class="muted">Continue a saved game or start a new one.</p><div class="home-actions">${button('New game','create','primary',blocked())}${button('Join a game','join','',blocked())}</div><section class="saved-games" aria-label="Saved games"><h2>Your games</h2>${games.length?games.map(g=>`<article class="saved-game"><div><h3>${esc(g.players.join(' · ')||'Saved game')}</h3><p>${g.mode?`${g.mode==='solo'?'Solo':'Online'} · ${g.playerCount||3} players`:'Open to check players and bot level'}${g.scenario?' · '+esc(g.scenario):''}${g.botLevel?' · '+(g.botLevel==='planner'?'Planner (experimental)':g.botLevel==='easy'?'Easy':'Standard'):''}</p><small>${g.status==='waiting'?'Waiting in lobby':g.status==='ended'?'Finished':'In progress'} · ${esc(g.roomId.slice(0,8))}</small></div><div class="saved-game-actions">${button(g.status==='ended'?'View result':'Resume game',`resume-game:${g.roomId}`,'',blocked())}${button('Abandon game',`abandon-game:${g.roomId}`,'quiet',busy||!!saved?.pending)}</div></article>`).join(''):'<p class="muted">No saved games yet. Choose New game to get started.</p>'}<p class="safe-hint">Games opened in this browser appear here. Keep its data to retain your player identity. Solo games work offline. Games with a friend require internet.</p></section>${accountPanel()}</section>`;
  }
  else if(['create','join'].includes(screen))html=`${recovery()}<section class="form-card">${button('← Back','home','back-link')}<p class="eyebrow">Catan</p><h1>${screen==='create'?'New game':'Join a game'}</h1><p class="muted">${screen==='create'?(formDraft.gameMode==='solo'?'Play offline against bots. Saved on this device.':'Choose the game size, invite friends, then start. Bots fill any empty seats.'):'Join the lobby before the host starts the game.'}</p><form id="entry-form"><div class="form-fields">${screen==='create'?`${scenarioPicker(formDraft.scenario)}<label for="player-count">Game size</label><select id="player-count"><option value="3" ${formDraft.playerCount===3?'selected':''}>3 players</option><option value="4" ${formDraft.playerCount===4?'selected':''}>4 players</option></select><label for="game-mode">Play mode</label><select id="game-mode"><option value="friends" ${formDraft.gameMode==='friends'?'selected':''}>Online · invite friends</option><option value="solo" ${formDraft.gameMode==='solo'?'selected':''}>Solo offline · play against bots</option></select><label for="bot-level">Bot level</label><select id="bot-level"><option value="standard" ${formDraft.level==='standard'?'selected':''}>Standard · resource priorities</option><option value="easy" ${formDraft.level==='easy'?'selected':''}>Easy · more varied choices</option>${formDraft.gameMode==='solo'?`<option value="planner" ${formDraft.level==='planner'?'selected':''}>Planner (experimental) · builds, trades &amp; cards</option>`:''}</select>`:`<label for="room-id">Room ID</label><input id="room-id" value="${esc(formDraft.room??invitedRoom()??'')}" autocomplete="off"><label for="invite-token">Invitation link or token</label><input id="invite-token" value="${esc(invitationToken||'')}" required autocomplete="off">`}</div><button class="primary" type="submit" ${blocked()||(!navigator.onLine&&(screen==='join'||formDraft.gameMode!=='solo'))?'disabled':''}>${screen==='create'?(formDraft.gameMode==='solo'?'Start solo game':'Create game'):'Join game'}</button></form><p class="safe-hint">${saved?.persistent===false&&client.isLocal()?'Persistent storage was not granted. Your browser may remove local saves.':'Local games stay on this device. Clearing browser data removes saves and identity.'}</p></section>`;
  else if(packet?.status==='waiting'&&packet.lobby)html=recovery()+renderLobby();
  else if(packet?.status==='waiting')html=`${recovery()}<section class="form-card"><p class="eyebrow">Your game is ready</p><h1>One seat for a friend.</h1><p class="muted">Share the invitation. Your friend joins from their own browser or installed app.</p>${packet.lobby?.scenario?`<p class="muted">Scenario: ${esc(packet.lobby.scenario)}</p>`:''}<div class="lobby-seats">${packet.members.map(m=>`<div class="lobby-seat"><span class="avatar ${m.kind==='bot'?'bot':''}">${m.kind==='bot'?'B':'Y'}</span><div><strong>${esc(m.name)}${m.kind==='bot'?` · Bot (${m.level})`:' · You'}</strong><p class="muted">Ready to play</p></div></div>`).join('')}<div class="lobby-seat"><span class="avatar alex">?</span><div><strong>Your friend</strong><p class="muted">Waiting for the invitation</p></div></div></div><div class="lobby-buttons">${button('Share invitation','share','primary',busy)}${button('Check the game','refresh','quiet',busy)}</div><p class="lobby-status">The board opens when your friend joins. You keep your own separate seats.</p></section>`;
  else if(view())html=drawTable();else html=`${recovery()}<section class="empty-state"><h1>Checking your game.</h1><p class="muted">Your saved room and player identity are being restored.</p>${button('Return to start','home','quiet',busy)}</section>`;
  if(notice&&!(screen==='table'&&view()))html=`<div class="notice-bar ${error?'error':''}" role="${tradeFeedback.some(e=>e.message===notice)?'note':'status'}">${esc(notice)}</div>`+html;
  const replaced=html!==renderedHTML;
  if(replaced){$('app').innerHTML=html;renderedHTML=html;renderedBoard=null;}
  const boardKey=$('board')?JSON.stringify([view().state.board,view().state.players.players.map(p=>[p.id,p.color]),view().you,spatial,selection,blocked()]):null;
  if($('board')&&boardKey!==renderedBoard){draw($('board'),view(),spatial,selection,blocked(),index=>{if(!blocked()){selection=index;selectionRevision=packet.revision;render();announce('Location selected. Confirm to commit it.');}});renderedBoard=boardKey;}

  activityScroll.restore(feedPosition);
  if(sheet.open&&view()&&$('sheet-body').querySelector('.score-detail'))refreshScores(view());
  motion.present(packet,{enabled:screen==='table'&&!!googleAuth.profile()&&!document.hidden});
  if(replaced&&focused&&$(focused))$(focused).focus({preventScroll:true});
  if($('sidebar').open)renderMenu();
  if(notice&&screen==='table'&&view())announce(notice);
  if(sheet.open&&sheet.dataset.trade==='live')refreshTradeDialog();
  if(sheet.open&&sheet.dataset.trade)updateTradeStatus();
  if(screen==='table'&&ready&&!busy&&!saved?.pending&&incoming()&&canSupplyOffer(view())&&!reply.open&&lastIncomingOffer!==`${view().id}:${view().you}:${view().offer.id}`)showReplyOffer(view().offer);
  if(reply.open){if(reply.dataset.offerId!==view()?.offer?.id||!incoming())reply.close();else for(const el of reply.querySelectorAll('button[data-action]'))el.disabled=blocked();}
}
function apply(next){
  if(!next)return;
  if(!next.ok){notice=next.error.message;if(['room_not_found','session_expired'].includes(next.error.code))throw new PlayError('SESSION_EXPIRED',next.error.message);return;}
  if(packet?.roomId===next.roomId&&packet.revision>next.revision)return;
  const key=`${next.roomId}:${next.revision}:${next.status}`;
  if(key!==lastRenderKey){selection=null;mode='';lastRenderKey=key;}
  packet=next;movePacer.observe(next);
  if(screen!=='home'&&!['create','join'].includes(screen))screen='table';
  const bot=next.view?.seats.find(s=>s.id===next.view.state.game.currentPlayerId)?.kind==='bot';
  if(bot&&next.view.state.game.phase!=='discard'&&!next.view.offer){if(botRevision!==next.revision){botSince=Date.now();botRevision=next.revision;}if(Date.now()-botSince>20000)notice='The bot is taking longer than usual. Check the game to retry its next decision.';}else botSince=0;
}
function schedule(){
 clearTimeout(timer);
 if(['home','create','join'].includes(screen)&&!saved?.pending)return;
 if(document.hidden||(!navigator.onLine&&!client.isLocal())||busy)return;
 if(error&&!error.retryable)return;
 if(botSince&&Date.now()-botSince>60000)return;
 if(saved?.pending||saved?.roomId||(saved?.retryAt||0)>Date.now()){
  const watchingBot=packet?.view&&actingPlayers(packet.view).some(id=>packet.view.seats.find(s=>s.id===id)?.kind==='bot');
  const interval=packet?.botWorkPending&&!saved?.pending&&!error?Math.max(50,movePacer.remaining(packet)):watchingBot&&movePacer.recentlyChanged()?1500:client.capabilities.pollIntervalMs;
  timer=setTimeout(()=>sync(),Math.min(2147483647,Math.max(interval,(saved?.retryAt||0)-Date.now())));
 }
}
function sync(op,args={},options={}){
  if(updateReloadPending||!googleAuth.profile())return Promise.resolve();
  if(activeSync){
    if(!op)return activeSync;
    // Keep the exact selected command while a read finishes; never drop a click.
    busy=true;ready=false;render();
    return activeSync.then(()=>{if(error||(!navigator.onLine&&!offlineAllowed()))return;return sync(op,args,options);});
  }
  activeSync=runSync(op,args,options).finally(()=>{activeSync=null;});
  return activeSync;
}
async function observeTrades(v,outgoing){
 if(!v)return;
 try{await navigator.locks.request('game-shelf-trade-feedback',async()=>{const key=`game-shelf-trade-feedback-v1:${v.you}:${v.id}`,raw=localStorage.getItem(key),{record,added}=updateTradeFeedback(raw?JSON.parse(raw):null,v,outgoing);const encoded=JSON.stringify(record);if(encoded!==raw)localStorage.setItem(key,encoded);tradeFeedback=record.events;if(added.length){notice=added.at(-1).message;announce(notice);}});}catch{notice='Trade feedback could not be saved on this device. Check Recent moves for outcomes.';}
}
async function runSync(op,args={},options={}){
  clearTimeout(timer);
  if(!navigator.onLine&&!offlineAllowed()){ready=false;error=new PlayError('NETWORK_UNAVAILABLE','Internet play is paused. Your saved data is still here.',{retryable:true});render();return;}
  const background=!op&&ready&&!error&&(!saved?.pending||packet?.pendingRandom)&&!!packet;
  if(!background){busy=true;ready=false;error=null;render();}
  try{
    const outgoing=op==='command'&&args.action?.type==='TRADE_OFFER'?{revision:args.expectedRevision+1,from:packet.you,to:args.action.to,give:args.action.give,receive:args.action.receive}:null;
    await observeTrades(view(),outgoing);
    let operationResult;
    if(op){const result=operationResult=op==='resume'?await client.resume(args.roomId,{botBudget:0}):await client.execute(op,args,{...options,botBudget:0});if(op==='resume'&&!result.ok){notice=result.error.message;ready=true;error=null;return;}apply(result);if(result?.ok){screen='table';history.replaceState(null,'',location.pathname+'#game');}}
    const recoveringEntry=['create','join'].includes(saved?.pending?.body.op);
    const latest=operationResult?.ok&&client.capabilities.commandReturnsCurrentState?operationResult:await client.refresh({botBudget:movePacer.takeBudget(packet)});apply(latest);await observeTrades(view(),outgoing);
    if(saved?.pending&&latest?.ok)saved=(await client.inspect()).state;
    if(!saved?.pending)await resolveUnavailableOffers(view,async offerId=>{
     const declined=await client.execute('command',{roomId:packet.roomId,expectedRevision:packet.revision,action:{type:'TRADE_DECLINE',offerId}},{botBudget:0});apply(declined);
     if(!declined?.ok||!client.capabilities.commandReturnsCurrentState)apply(await client.refresh({botBudget:movePacer.takeBudget(packet)}));
     await observeTrades(view());return !!declined?.ok;
    });
    const steal=automaticSteal(view());
    if(!saved?.pending&&steal){const result=await client.execute('command',{roomId:packet.roomId,expectedRevision:packet.revision,action:steal},{botBudget:0});apply(result);}
    if(latest?.ok&&recoveringEntry){screen='table';history.replaceState(null,'',location.pathname+'#game');}ready=true;error=null;
  }catch(e){error=e instanceof PlayError?e:new PlayError('PROTOCOL_ERROR','The game could not be safely read. Your saved data has been kept.');ready=false;notice='';if(screen==='home'&&error.code==='SESSION_EXPIRED'){notice=error.message;error=null;ready=true;}}
  finally{try{saved=(await client.inspect()).state;if(screen==='home')knownGames=await client.games();}catch(e){error=e;ready=false;}busy=false;render();schedule();}
}
async function sendAction(action){if(blocked()||!view())return;const roomId=packet.roomId,before=new Set(ownPlayer(view()).developmentCards.map(c=>c.id));if(action.type==='TRADE_OFFER'){counterDraftOfferId=null;tradeStartRevision=packet.revision+1;}const keepTrade=action.type==='TRADE_OFFER'||action.type==='TRADE_CANCEL';if(keepTrade){sheet.dataset.trade='live';tradeEditing=false;tradeViewKey=String(packet.revision);}else closeSheet();await sync('command',{roomId,expectedRevision:packet.revision,action});
 if(action.type==='BUY_DEVELOPMENT_CARD'&&!error&&packet?.roomId===roomId){const card=ownPlayer(view()).developmentCards.find(c=>!before.has(c.id));if(card){announce(`You drew ${CARD_NAMES[card.type]}.`);openSheet('Your new development card',`<h3>${CARD_NAMES[card.type]}</h3><p>${card.type==='victoryPoint'?'This private point already counts toward your score.':'Saved in your hand. It becomes playable on a later turn.'}</p><div class="sheet-actions">${button('Done','close','primary')}</div>`);}}
}
function choose(candidates,titleText,intro=''){openSheet(titleText,`${intro}<p class="muted">Choose one of the options available to your hand and the bank.</p><form id="choice-form"><label for="move-choice">Your choice</label><select id="move-choice">${candidates.map((c,i)=>`<option value="${i}">${esc(actionLabel(c))}</option>`).join('')}</select><div class="sheet-actions"><button class="primary" type="submit">Confirm choice</button></div></form>`);modalAction=candidates;}
function actionLabel(c){if(c.type==='BANK_TRADE')return `${c.give.amount} ${RESOURCE_NAMES[c.give.resource]} → ${c.receive.amount} ${RESOURCE_NAMES[c.receive.resource]}`;if(c.type==='PLAY_YEAR_OF_PLENTY')return c.resources.map(r=>RESOURCE_NAMES[r]).join(' + ');if(c.type==='PLAY_MONOPOLY')return RESOURCE_NAMES[c.resource];return c.type.toLowerCase().replaceAll('_',' ');}
function buildPanel(){const choices=view().choices,costs={BUILD_ROAD:'1 brick + 1 wood',BUILD_SETTLEMENT:'1 brick + 1 wood + 1 grain + 1 wool',BUILD_CITY:'3 ore + 2 grain',BUY_DEVELOPMENT_CARD:'1 ore + 1 grain + 1 wool'};openSheet('Make your next move',`<p class="muted">Preview a piece before committing it. Unavailable builds need more resources, a legal location, or an available piece.</p><div class="scenario-list">${[['BUILD_ROAD','Road'],['BUILD_SETTLEMENT','Settlement'],['BUILD_CITY','City'],['BUY_DEVELOPMENT_CARD','Development card']].map(([type,label])=>button(`${label}<span class="build-cost">${costs[type]}</span>`,`build:${type}`,'',!choices.some(c=>c.type===type))).join('')}</div>`);}
function tradeResponses(trade){
 if(!trade)return '';
 return `<section class="trade-responses" aria-label="Trade responses" role="status" aria-live="polite"><p>${trade.status==='accepted'?`${esc(name(trade.by))} accepted. Trade completed.`:trade.status==='declined'?'Everyone declined. Edit your offer and try again.':trade.status==='cancelled'?'Offer cancelled.':trade.status==='replaced'?'Offer replaced.':'First acceptance completes one trade.'}</p><ul>${offerRecipients(trade).map(id=>`<li><span>${esc(name(id))}</span><strong>${trade.responses?.[id]==='accepted'?'Accepted':trade.responses?.[id]==='declined'?'Declined':trade.status&&trade.status!=='waiting'?'Closed':'Waiting'}</strong></li>`).join('')}</ul></section>`;
}
function offerPanel(){
 const v=view(),o=v.offer;if(!o)return;const mine=o.from===v.you;
 if(mine){tradeStartRevision=0;tradeDraft={...offerDraft(v),to:o.to,give:{...o.give},receive:{...o.receive}};tradeEditing=false;openSheet('Trade','');sheet.dataset.trade='live';tradeViewKey=null;refreshTradeDialog();return;}
 showReplyOffer(o);
}
function showReplyOffer(offer){
 if(sheet.open&&!sheet.dataset.trade)closeSheet();overlays.closeDrawer();
 if(!incoming()||!canSupplyOffer(view()))return;
 lastIncomingOffer=`${view().id}:${view().you}:${offer.id}`;
 const counter=view().trades?.some(t=>t.status==='replaced'&&t.from===view().you&&t.by===offer.from);
 $('trade-reply-title').textContent=counter?`${name(offer.from)} counteroffers`:`${name(offer.from)} offers a trade`;
 $('trade-reply-body').innerHTML=`<div class="offer-bundle"><span>You give</span><strong>${esc(tradeLabel(offer.receive))}</strong></div><div class="offer-bundle"><span>You receive</span><strong>${esc(tradeLabel(offer.give))}</strong></div><div class="sheet-actions">${button('Decline','reply:TRADE_DECLINE','quiet',blocked())}${button('Accept','reply:TRADE_ACCEPT','primary',blocked())}${button('Counteroffer','counteroffer','quiet',blocked())}</div>`;
 reply.dataset.offerId=offer.id;if(!reply.open)overlays.show(reply,{stack:sheet.open&&!!sheet.dataset.trade});
}
function refreshTradeDialog(){
 const v=view();if(!v||modalRoom!==v.id||modalYou!==v.you){closeSheet();return;}
 if(tradeViewKey===String(v.revision))return;
 tradeViewKey=String(v.revision);modalRevision=v.revision;
 tradeDraft=tradeDraft?.roomId===v.id&&tradeDraft.you===v.you?{...tradeDraft,revision:v.revision}:offerDraft(v);
 if(v.state.game.currentPlayerId!==v.you)tradeDraft.to=v.state.game.currentPlayerId;
 const offer=v.offer;
 if(reply.open&&(reply.dataset.offerId!==offer?.id||!incoming()))reply.close();
 const latest=currentTradeResult(v);
 if(offer&&incoming()&&counterDraftOfferId!==offer.id&&latest?.status==='replaced'&&latest.by===offer.from){renderTradeComposer();showReplyOffer(offer);return;}
 if(latest?.status==='accepted'&&(!offer||offer.from!==v.you)){$('sheet-title').textContent='Trade completed';$('sheet-body').innerHTML=tradeResponses(latest)+`<div class="sheet-actions">${button('Close','close','primary')}</div>`;return;}
 if(offer&&!tradeEditing){
  const mine=offer.from===v.you;
  $('sheet-title').textContent=mine?'Your trade offer':'Trade';
  $('sheet-body').innerHTML=`<p class="muted">${mine?`Offer to ${esc(recipientName(offer.to))}`:`Offer from ${esc(name(offer.from))}`}</p><div class="offer-bundle"><span>${mine?'You give':'They give'}</span><strong>${esc(tradeLabel(offer.give))}</strong></div><div class="offer-bundle"><span>${mine?'You request':'They request'}</span><strong>${esc(tradeLabel(offer.receive))}</strong></div>${tradeResponses(offer)}<p id="trade-status" class="trade-help" role="status"></p><div class="sheet-actions">${mine?tradeButton('Edit offer','trade-edit',false,'quiet')+tradeButton('Cancel offer','trade-cancel',false,'quiet'):incoming()?tradeButton('Decline','offer:TRADE_DECLINE',false,'quiet')+tradeButton('Accept trade','offer:TRADE_ACCEPT',!canSupplyOffer(v),'primary')+tradeButton('Counteroffer','counteroffer',false,'quiet'):''}</div>`;
 }else{
  $('sheet-title').textContent='Trade';renderTradeComposer();
 }
}
const tradeButton=(label,action,disabled=false,classes='')=>`<button type="button" data-trade-control data-base-disabled="${disabled}" data-action="${action}" class="${classes}" ${disabled?'disabled':''}>${label}</button>`;
function updateTradeStatus(){
  const unavailable=blocked()||modalChanged();
  for(const el of sheet.querySelectorAll('[data-trade-control]'))el.disabled=unavailable||el.dataset.baseDisabled==='true';
  const status=$('trade-status');if(status){const text=modalChanged()?'The game changed. Close and reopen Trade to review your cards.':blocked()?'Reconnect and resolve any pending move before trading.':status.dataset.hint||'';if(status.textContent!==text)status.textContent=text;}
}
function selectedTradeBank(){return bankChoices(view()).find(c=>c.give.resource===bankGive&&c.receive.resource===bankReceive&&(!bankRatio||c.give.amount===bankRatio));}
function tradePanel(nextMode='players'){
 tradePages.reset();
  counterDraftOfferId=null;tradeStartRevision=null;const v=view();tradeDraft=offerDraft(v);tradeMode=nextMode;
  bankGive=bankReceive=bankRatio=null;bankRevision=`${v.id}:${v.revision}`;
  openSheet('Trade','');sheet.dataset.trade='composer';modalAction=null;renderTradeComposer(`trade-mode:${nextMode}`);
}
function renderTradeComposer(focusAction=null){
  const scrollTop=sheet.querySelector('.trade-scroll')?.scrollTop||0;
  const v=view(),hand=ownPlayer(v).resources,peers=v.seats.filter(s=>s.id!==v.you),isBank=tradeMode==='bank',choices=bankChoices(v),bank=selectedTradeBank();
  const provisional=bank||choices.find(c=>c.give.resource===bankGive&&(!bankRatio||c.give.amount===bankRatio)),bundles=isBank?bankBundles(provisional):tradeDraft;
  const issue=isBank?(v.offer?'Cancel the pending offer before a bank exchange.':bank?'':!choices.length?'No affordable bank or port trade is available.':!bankGive?'Choose a resource to give.':'Choose a resource to receive.'):offerIssue(v,tradeDraft);
  const rows=RESOURCES.map(r=>{
    const rate=choices.find(c=>c.give.resource===r&&(!(bankGive===r&&bankRatio)||c.give.amount===bankRatio));
    const stepper=side=>{
      const amount=isBank?(side==='give'&&bankGive===r?provisional?.give.amount||0:side==='receive'&&bankReceive===r?bank?.receive.amount||0:0):tradeDraft[side][r];
      const allowed=isBank?(side==='give'?!!rate:!!bankGive&&choices.some(c=>c.give.resource===bankGive&&c.receive.resource===r)):(side==='give'?tradeDraft.give[r]<hand[r]&&!tradeDraft.receive[r]:!tradeDraft.give[r]&&tradeDraft.receive[r]<19&&handCount(tradeDraft.receive)<tradeLimit(v,tradeDraft.to));
      const add=isBank?`trade-bank:${side}:${r}`:`trade-add:${side}:${r}`,remove=isBank?`trade-bank-clear:${side}:${r}`:`trade-remove:${side}:${r}`;
      const words=side==='give'?'give':isBank?'receive':'request';
      const control=(text,action,disabled,label)=>tradeButton(text,action,disabled,'icon-button').replace('data-trade-control',`aria-label="${label}" data-trade-control`);
      return `<div class="trade-stepper ${amount?'has-value':''}">${control('−',remove,!amount,`Remove ${RESOURCE_NAMES[r]} ${side==='give'?'from offer':'from request'}`)}<output aria-label="${RESOURCE_NAMES[r]} ${side==='give'?'offered':'requested'}">${amount}</output>${control('+',add,!allowed,`Add ${RESOURCE_NAMES[r]} to ${words}`)}</div>`;
    };
    return `<div class="trade-row" data-resource="${r}"><span class="trade-row-resource">${art(r)}<span>${RESOURCE_NAMES[r]}</span>${isBank&&rate?`<small>${rate.give.amount}:1</small>`:''}</span><span class="trade-row-hand" aria-label="${RESOURCE_NAMES[r]} in hand">${hand[r]}</span>${stepper('give')}${stepper('receive')}</div>`;
  }).join('');
  const summaryGive=isBank?bankBundles(provisional).give:tradeDraft.give,summaryReceive=isBank?bankBundles(bank).receive:tradeDraft.receive;
  $('sheet-body').innerHTML=`<form id="trade-form" class="trade-composer-form"><div class="trade-scroll"><div class="trade-tabs" role="group" aria-label="Trade type">${tradeButton('Players','trade-mode:players',false,!isBank?'primary':'').replace('data-trade-control',`aria-pressed="${!isBank}" data-trade-control`)}${tradeButton('Bank & ports','trade-mode:bank',false,isBank?'primary':'').replace('data-trade-control',`aria-pressed="${isBank}" data-trade-control`)}</div>${isBank&&bankGive&&new Set(choices.filter(c=>c.give.resource===bankGive).map(c=>c.give.amount)).size>1?`<label>Exchange rate<select id="bank-rate" data-trade-control data-base-disabled="false">${[...new Set(choices.filter(c=>c.give.resource===bankGive).map(c=>c.give.amount))].map(rate=>`<option value="${rate}" ${rate===(bankRatio||provisional?.give.amount)?'selected':''}>${rate}:1</option>`).join('')}</select></label>`:''}${isBank?'':`<label class="trade-recipient">Offer to<select id="trade-target" data-trade-control data-base-disabled="false">${v.state.game.currentPlayerId===v.you?'<option value="all" '+(tradeDraft.to==='all'?'selected':'')+'>All</option>':''}${peers.filter(s=>v.state.game.currentPlayerId===v.you||s.id===v.state.game.currentPlayerId).map(s=>`<option value="${esc(s.id)}" ${s.id===tradeDraft.to?'selected':''}>${esc(s.name)} · ${count(s.id)} cards</option>`).join('')}</select></label>`}<div class="trade-row trade-row-head"><span>Resource</span><span>In hand</span><span>Give</span><span>${isBank?'Receive':'Request'}</span></div>${rows}</div><div class="trade-footer">${tradeResponses(currentTradeResult(v))}<p class="trade-kept-total">${handCount(hand)-handCount(summaryGive)} of your current cards kept</p><p id="trade-status" data-hint="${esc(issue)}" class="trade-help" role="status">${esc(issue)}</p><button class="primary" aria-describedby="trade-status" data-trade-control data-base-disabled="${!!issue}" type="submit" ${issue?'disabled':''}>${isBank?'Trade with bank':'Send offer'}</button></div></form>`;
  const ratio=$('bank-rate');if(ratio)ratio.onchange=()=>{if(blocked()||modalChanged())return;bankRatio=Number(ratio.value);renderTradeComposer();$('bank-rate')?.focus();};
  const recipient=$('trade-target');if(recipient)recipient.onchange=()=>{if(blocked()||modalChanged())return;tradeDraft.to=recipient.value;renderTradeComposer();$('trade-target')?.focus();};
  sheet.querySelector('.trade-scroll').scrollTop=scrollTop;
  updateTradeStatus();tradePages.fit();
  if(focusAction){const el=[...sheet.querySelectorAll('[data-action]')].find(e=>e.dataset.action===focusAction&&!e.disabled);(el||sheet.querySelector('.trade-stepper button:not(:disabled)')||sheet.querySelector('.trade-tabs button:not(:disabled)'))?.focus({preventScroll:true});}
}
async function submitTrade(){
 const v=view(),isBank=tradeMode==='bank',action=isBank?selectedTradeBank():null;
 if(isBank){if(action&&!v.offer)await sendAction(action);return;}
 if(offerIssue(v,tradeDraft))return;
 await sendAction({type:'TRADE_OFFER',to:tradeDraft.to,give:{...tradeDraft.give},receive:{...tradeDraft.receive},...(v.offer?{replaces:v.offer.id}:{})});
}

function updateDiscard(){
 const form=$('discard-form');if(!form||!view())return;const hand=ownPlayer(view()).resources,required=view().state.game.discardAmounts[view().you],values=Object.fromEntries(RESOURCES.map(r=>[r,Number($(`discard-${r}`).value)])),total=handCount(values);
 $('discard-total').textContent=`${total} / ${required} selected`;
 for(const r of RESOURCES){const row=form.querySelector(`[data-discard-resource="${r}"]`);row.querySelector('output').textContent=values[r];row.querySelector('[data-action^="discard-remove:"]').disabled=blocked()||values[r]===0;row.querySelector('[data-action^="discard-add:"]').disabled=blocked()||values[r]>=hand[r]||total>=required;}
 form.querySelector('[type="submit"]').disabled=blocked()||total!==required;
}
function discardPanel(){const v=view(),me=ownPlayer(v);openSheet(`Return ${v.state.game.discardAmounts[v.you]} cards`,`<p class="muted">Choose the required number of cards. Their types stay private.</p><form id="discard-form"><div class="discard-grid">${RESOURCES.map(r=>`<div class="discard-row" data-discard-resource="${r}"><span class="discard-resource">${art(r)}${RESOURCE_NAMES[r]}</span><div class="trade-stepper discard-stepper">${button('−',`discard-remove:${r}`,'icon-button').replace('data-action',`aria-label="Remove ${RESOURCE_NAMES[r]} from return" data-action`)}<output aria-label="${RESOURCE_NAMES[r]} to return">0</output>${button('+',`discard-add:${r}`,'icon-button').replace('data-action',`aria-label="Add ${RESOURCE_NAMES[r]} to return" data-action`)}<input type="hidden" id="discard-${r}" name="${r}" value="0"></div><span>${me.resources[r]} in hand</span></div>`).join('')}</div><p id="discard-total" class="muted">0 selected</p><p id="form-error" class="error-text" role="alert"></p><div class="sheet-actions"><button class="primary" type="submit">Confirm discard</button></div></form>`);itemPages($('discard-form'),'.discard-row',{label:'Resource page',perPage:()=>innerHeight<500?2:5});updateDiscard();}
function cardPanel(index){
 const v=view(),card=ownPlayer(v).developmentCards.filter(c=>!c.isPlayed)[index];if(!card)return;
 const rules=CARD_RULES[card.type],choices=v.choices.filter(c=>c.type===CARD_ACTION[card.type]);
 const text=`<p>${esc(rules.effect)}</p><p>${esc(rules.timing)}</p>${card.type==='victoryPoint'?'':`<p class="muted">${esc(ACTION_CARD_TIMING)}</p>`}`;
 if(card.type==='victoryPoint'){openSheet('A private victory point',text);return;}
 let reason=blocked()?'Resolve any pending move and reconnect before playing.':card.turnBought===v.state.game.turn?'This card was bought this turn. It becomes playable on a later turn.':v.state.game.currentPlayerId!==v.you?'You can only play this card on your own turn.':v.state.game.devCardPlayedThisTurn||ownPlayer(v).hasPlayedDevCard?'You have already played an action development card this turn.':!choices.length?'Finish the current phase, or check that this card has an available effect.':'';
 if(reason){openSheet(CARD_NAMES[card.type],text+`<p class="inline-message">${esc(reason)}</p>`);return;}
 if(choices.length>1){choose(choices,CARD_NAMES[card.type],text);return;}
 openSheet(CARD_NAMES[card.type],text+`<div class="sheet-actions">${button('Not now','close','quiet')}${button(`Play ${CARD_NAMES[card.type]}`,'modal-confirm','primary',blocked())}</div>`);modalAction=choices[0];
}
function helpPanel(){showHelp(openSheet);}
function scorePanel(playerId){showScores(view(),openSheet,playerId);}

function resultPanel(){const v=view(),g=v.state.game;if(g.phase!=='ended')return;openSheet('An evening well played',`<div class="result"><span class="result-icon" aria-hidden="true">✧</span><p class="eyebrow">The island has a winner</p><h1>${g.winnerId===v.you?'You win.':esc(name(g.winnerId))+' wins.'}</h1><p class="muted">Thanks for a game together.</p>${v.state.players.players.map(p=>`<button type="button" data-action="player:${esc(p.id)}" class="result-score ${p.id===g.winnerId?'winner':''}"><span>${esc(p.name)}</span><span>${g.finalScores[p.id]} VP →</span></button>`).join('')}<div class="sheet-actions">${button('Detailed scores','scores','primary')}${button('View the board','close','quiet')}${button('New game','create','primary')}</div></div>`);}
function invitedRoom(){return new URLSearchParams(location.hash.split('?')[1]||'').get('room');}
const accountBlocked=()=>updateReloadPending||accountBusy||busy||!!saved?.pending||!navigator.onLine||!!(error&&error.code!=='AUTH_REQUIRED');
function accountPanel(){
 try{const p=googleAuth.profile();return `<section class="account-section" aria-label="Account"><div><h2>${p?'Google account':'Welcome to Game Shelf'}</h2><p class="muted">${p?esc(p.email||p.name):'Sign in to start a game or join friends. After signing in, Solo also works offline.'}</p></div><div class="account-actions">${p?button('Sign in again','google-sign-in','quiet',accountBlocked())+button('Sign out','google-sign-out','quiet',blocked()||!navigator.onLine):button('Sign in with Google','google-sign-in','',accountBlocked())}</div></section>`;}catch{return '<section class="account-section"><p>Saved account details could not be read. Your data has been kept.</p></section>';}
}
async function changeAccount(work){
 const result=await withUpdateLock(async()=>{
  if(googleAuth.profile()&&!await client.canUpdate(self.OFFLINE_ENGINE))throw new PlayError('ACCOUNT_BUSY','Resolve pending moves before changing account.');
  await work();return true;
 });
 if(result===null)throw new PlayError('ACCOUNT_BUSY','Another window is saving a move. Wait for it to finish before signing in or out.');
}
async function accountAction(signOut=false){
 if(updateReloadPending||accountBusy||busy||saved?.pending||!navigator.onLine)return;
 accountBusy=true;let navigating=false;notice=signOut?'Signing out…':'Opening Google sign-in…';render();
 try{await changeAccount(async()=>{if(signOut){await googleAuth.signOut();history.replaceState(null,'',location.pathname+'#home');location.reload();}else location.assign(await googleAuth.start(location.href));navigating=true;});}
 catch(e){notice=e.message||'Sign-in could not be started. Please try again.';}
 finally{if(!navigating)accountBusy=false;render();}
}
function renderMenu(){
 const playing=!!view(),body=$('sidebar-body'),focused=body.contains(document.activeElement)?document.activeElement.dataset.action:null;const html=`<nav aria-label="Main navigation">${button('Home','home')}${packet?button('Game details','room'):''}${playing?button('Activity','activity'):''}${packet&&!solo()?button('Invitation details','share'):''}${button('Help & rules','help')}${button('Account','account')}</nav>`;
 if(renderedMenu!==html){body.innerHTML=html;renderedMenu=html;if(focused)[...body.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focused)?.focus({preventScroll:true});}
}
function showMenu(){renderMenu();overlays.showDrawer();}
$('app-version').textContent='Version '+self.OFFLINE_RELEASE;
function renderLobby(){
 const l=packet.lobby;
 if(l.full)return `<section class="form-card"><h1>Game full</h1><p class="muted">${l.started?'This game has already started. Its seats are fixed.':'All human seats are taken.'} Ask your friends to create another game.</p>${button('Return to start','home','primary')}</section>`;
 return `<section class="form-card"><p class="eyebrow">${l.playerCount}-player game</p><h1>Game lobby</h1><p class="muted">Invite friends before starting. Any seats still open will be filled by bots.</p>${packet.lobby?.scenario?`<p class="muted">Scenario: ${esc(packet.lobby.scenario)}</p>`:''}<div class="lobby-seats">${packet.members.map(m=>`<div class="lobby-seat"><span class="avatar ${m.kind==='bot'?'bot':''}">${m.kind==='bot'?'B':esc(m.name.slice(0,1))}</span><div><strong>${esc(m.name)}${m.id===packet.you?' · You':m.id===l.creatorId?' · Host':''}</strong><p class="muted">${m.kind==='bot'?`Open seat · ${m.level==='easy'?'Easy':'Standard'} bot if unfilled`:'Joined'}</p></div></div>`).join('')}</div><div class="lobby-buttons">${l.canStart?button('Start game','start-game','primary',blocked()):''}${button('Share invitation','share','',busy)}${button('Check the game','refresh','quiet',busy)}${button('Return to start','home','quiet',busy)}</div><p class="lobby-status">${l.canStart?`${l.openSeats} open ${l.openSeats===1?'seat':'seats'}. Start whenever everyone has joined.`:'Waiting for the host to start the game.'}</p></section>`;
}
function showInvitation(){if(!packet||solo())return;const link=new URL(location.href);link.hash=`join?room=${packet.roomId}&invite=${encodeURIComponent(packet.inviteToken||'')}`;openSheet('Invite friends',`<p class="muted">Share this private room link. Your friend joins from their own browser. Friends need to join before you start. Empty seats become bots.</p><label for="invite-link">Invitation link</label><input id="invite-link" readonly value="${esc(link.href)}"><div class="sheet-actions">${button('Copy invitation','copy','primary')}</div><p id="copy-result" class="copy-result muted" role="status"></p>`);}
function begin(next){
  if(saved?.pending){notice='Resolve the original move before switching games.';render();return;}
  setScreen(next);
}
async function dispatch(action,el){
  if(action==='menu'){showMenu();return;}
  if(action==='menu-close'){overlays.closeDrawer();return;}
  if(action==='cards'){openSheet('Your development cards',cardsPanel()||'<p>No development cards yet.</p>');itemPages($('sheet-body'),'.card-button',{label:'Card page',perPage:()=>innerHeight<500?2:4});return;}
  if(action==='activity'){
 const events=[...tradeFeedback.map(e=>'Trade · '+e.message),...(view()?.history||[]).map(h=>name(h.playerId)+': '+h.message)].reverse();
 openSheet('Activity',events.map(text=>`<article class="activity-item"><p>${esc(text)}</p></article>`).join('')||'<p>No moves yet.</p>');itemPages($('sheet-body'),'.activity-item',{label:'Activity page',perPage:()=>innerHeight<500?1:3});return;}
  if(action==='account'){openSheet('Account',accountPanel()+`${saved?.persistent===false?'<p>Persistent storage was not granted. Keep a copy of important game details.</p>':''}`);return;}
  if(action==='google-sign-in'){await accountAction();return;}
  if(action==='google-sign-out'){if(blocked())return;openSheet('Sign out?',`<p>Sign in again to access your games. Solo saves stay on this device.</p><div class="sheet-actions">${button('Cancel','close','quiet')}${button('Sign out','google-sign-out-confirm','primary')}</div>`);return;}
  if(!googleAuth.profile()&&!['help','google-sign-out-confirm'].includes(action))return;
  if(action==='google-sign-out-confirm'){closeSheet();await accountAction(true);return;}
  if(action==='apply-update'){error=null;ready=true;closeSheet();setScreen('home');return;}
  if(action==='reload-app'){location.reload();return;}
  if(action==='help'){helpPanel();return;}
  if(action==='scores'&&view()){scorePanel();return;}
  if(action.startsWith('player:')&&view()){scorePanel(action.slice(7));return;}
  if(action==='activity-latest'){activityScroll.jump();return;}
  if(action==='trade-edit'){if(blocked())return;tradeEditing=true;tradeViewKey=null;refreshTradeDialog();return;}
  if(action==='trade-cancel'){if(blocked()||staleModal())return;await sendAction({type:'TRADE_CANCEL',offerId:view().offer.id});return;}
  if(action.startsWith('reply:')){if(blocked()||reply.dataset.offerId!==view()?.offer?.id||!incoming())return;const choice=view().choices.find(c=>c.type===action.slice(6)&&c.offerId===reply.dataset.offerId);if(choice)await sendAction(choice);return;}
  if(action==='counteroffer'){if(blocked())return;reply.close();const v=view(),o=v.offer;if(!incoming())return;counterDraftOfferId=o.id;tradeDraft={...offerDraft(v),to:o.from,give:{...o.receive},receive:{...o.give}};tradeEditing=true;openSheet('Counteroffer','');sheet.dataset.trade='live';tradeViewKey=null;refreshTradeDialog();return;}
  if(action.startsWith('trade-')){
    if(blocked()||staleModal())return;
    if(action.startsWith('trade-mode:')){const next=action.slice(11);if(sheet.dataset.trade==='review'){tradePanel(next);return;}tradeMode=next;renderTradeComposer(action);return;}
    if(action.startsWith('trade-to:')){tradeDraft.to=action.slice(9);renderTradeComposer(action);return;}
    const [kind,side,r]=action.split(':');if(!RESOURCES.includes(r)||!['give','receive'].includes(side))return;
    if(kind==='trade-bank-clear'){if(side==='give'){bankGive=bankReceive=null;}else bankReceive=null;renderTradeComposer(action);return;}
    if(kind==='trade-bank'){if(side==='give'){bankGive=r;bankReceive=bankRatio=null;}else bankReceive=r;renderTradeComposer(action);return;}
    if(kind==='trade-add'){
      const hand=ownPlayer(view()).resources;
      if(side==='give'&&(tradeDraft.receive[r]||tradeDraft.give[r]>=hand[r]))return;
      if(side==='receive'&&(tradeDraft.give[r]||tradeDraft.receive[r]>=19||handCount(tradeDraft.receive)>=tradeLimit(view(),tradeDraft.to)))return;
      tradeDraft[side][r]++;
    }else if(kind==='trade-remove')tradeDraft[side][r]=Math.max(0,tradeDraft[side][r]-1);
    renderTradeComposer(action);return;
  }
  if(action.startsWith('discard-add:')||action.startsWith('discard-remove:')){if(blocked()||staleModal())return;const [operation,r]=action.split(':'),input=$(`discard-${r}`);if(!RESOURCES.includes(r)||!input)return;const total=handCount(Object.fromEntries(RESOURCES.map(key=>[key,Number($(`discard-${key}`).value)]))),amount=Number(input.value),limit=view().state.game.discardAmounts[view().you];if(operation==='discard-add'&&amount<ownPlayer(view()).resources[r]&&total<limit)input.value=amount+1;else if(operation==='discard-remove'&&amount>0)input.value=amount-1;updateDiscard();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='start-game'){if(blocked())return;await sync('start',{roomId:packet.roomId});return;}
  if(action==='refresh'){closeSheet();botSince=0;botRevision=-1;await sync();return;}
  if(action.startsWith('resume-game:')){closeSheet();await sync('resume',{roomId:action.slice(12)});if(view()?.state.game.phase==='ended')resultPanel();return;}
  if(action.startsWith('abandon-game:')){const roomId=action.slice(13);if(busy||saved?.pending)return;openSheet('Abandon this game?',`<p>This removes the game from this device’s list and allows future engine updates. You cannot resume it here.</p><p>For online games, this does not notify your friend or delete the server’s history. Bots may pause if you created the game.</p><div class="sheet-actions">${button('Keep game','close','quiet')}${button('Abandon game',`confirm-abandon:${roomId}`,'primary')}</div>`);return;}
  if(action.startsWith('confirm-abandon:')){if(busy||saved?.pending)return;busy=true;render();try{await client.abandon(action.slice(16));closeSheet();const existing=await client.inspect();saved=existing.state;packet=existing.packet;knownGames=await client.games();error=null;ready=true;notice='Game abandoned on this device.';setScreen('home');}catch(e){error=e;ready=false;}finally{busy=false;render();}return;}
  if(action==='home'){overlays.closeDrawer();if(saved?.pending){notice='Your original move still needs to be resolved.';render();return;}closeSheet();knownGames=await client.games();setScreen('home');return;}
  if(action==='resume'){closeSheet();setScreen('table');await sync();return;}
  if(action==='create'||action==='solo'||action==='join'){if(action!=='join')formDraft.gameMode=action==='solo'?'solo':'friends';begin(action==='solo'?'create':action);return;}
  if(action==='room'){openSheet('Your game',`<p class="muted">${esc(packet?.members?.map(m=>m.name).join(', ')||'Your room')}</p><div class="scenario-list">${solo()?`<p class="muted">Solo · you and ${packet.members.filter(m=>m.kind==='bot').length} bots. No invitation is needed.</p>${packet.botPolicy?'<p class="muted">Planner (experimental) · shared build and trade plans.</p>':''}`:button('Invitation details','share')}${button('Check the game','refresh')}${button('Return to start','home')}</div><p class="safe-hint">Keep this browser or installation to retain your player identity. ${client.isLocal()?'This game is saved locally and works offline.':'Internet play pauses without a connection.'}</p>`);return;}
  if(action==='share'){showInvitation();return;}
  if(action==='copy'){try{await navigator.clipboard.writeText($('invite-link').value);$('copy-result').textContent='Invitation copied.';}catch{$('invite-link').select();$('copy-result').textContent='Select and copy the invitation manually.';}return;}
  if(action==='results'){resultPanel();return;}
  if(action.startsWith('card:')){cardPanel(Number(action.split(':')[1]));return;}
  if(action==='skip-offer'){if(!blocked()&&unavailableIncomingOffer(view()))await sync();return;}
  if(action==='offer'){offerPanel();return;}
  if(blocked()||!view())return;
  if(action==='build'){buildPanel();return;}
  if(action.startsWith('build:')){if(staleModal())return;const type=action.slice(6);if(type==='BUY_DEVELOPMENT_CARD'){const choice=view().choices.find(c=>c.type===type);if(choice)await sendAction(choice);return;}mode=type;selection=null;closeSheet();render();return;}
  if(action==='confirm'){if(selectionRevision===packet.revision&&spatial[selection])await sendAction(spatial[selection]);return;}
  if(action==='cancel-preview'){selection=null;mode='';render();return;}
  if(action.startsWith('quick:')){const choice=view().choices.find(c=>c.type===action.slice(6));if(choice)await sendAction(choice);return;}
  if(action==='trade'){tradePanel();return;}
  if(action==='bank'){tradePanel('bank');return;}
  if(action==='discard'){discardPanel();return;}
  if(action==='victim'){const choices=view().choices.filter(c=>c.type==='STEAL_RESOURCE');openSheet('Who will you steal from?',`<p class="muted">Resource types stay hidden.</p><div class="scenario-list">${choices.map((c,i)=>button(`${esc(name(c.victimId))}<span>${count(c.victimId)} resource cards</span>`,`victim:${i}`)).join('')}</div>`);modalAction=choices;return;}
  if(action.startsWith('victim:')){if(staleModal())return;const choice=modalAction?.[Number(action.slice(7))];if(choice)await sendAction(choice);return;}
  if(action.startsWith('offer:')){if(staleModal())return;const choice=view().choices.find(c=>c.type===action.slice(6));if(choice)await sendAction(choice);return;}
  if(action==='modal-confirm'){if(staleModal())return;const choice=modalAction;if(choice&&!Array.isArray(choice))await sendAction(choice);}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;e.preventDefault();dispatch(el.dataset.action,el).catch(()=>{notice='That choice could not be completed. Please check the game.';render();});});
document.addEventListener('submit',e=>{
  const form=e.target;if(!['entry-form','trade-form','discard-form','choice-form'].includes(form.id))return;e.preventDefault();if(blocked())return;
  if(form.id==='entry-form'){const name=googleAuth.profile()?.name;if(!name)return;if(screen==='create')sync('create',{name,scenario:$('scenario').value,playerCount:Number($('player-count').value),botLevel:$('bot-level').value,...($('game-mode').value==='solo'?{mode:'solo'}:{})},{replace:true});else{const roomId=$('room-id').value.trim();if(roomId===saved?.roomId){setScreen('table');sync();return;}let inviteToken=$('invite-token')?.value.trim()||invitationToken;try{if(inviteToken?.startsWith('http'))inviteToken=new URLSearchParams(new URL(inviteToken).hash.split('?')[1]).get('invite');}catch{}if(!inviteToken){notice='Enter the invitation link or token.';render();return;}sync('join',{name,roomId,inviteToken},{replace:true});}return;}
  if(staleModal())return;
  if(form.id==='choice-form'){const choice=modalAction?.[Number($('move-choice').value)];if(choice)sendAction(choice);return;}
  const data=new FormData(form),me=ownPlayer(view());
  if(form.id==='discard-form'){const resources=Object.fromEntries(RESOURCES.map(r=>[r,Number(data.get(r))]));if(handCount(resources)!==view().state.game.discardAmounts[view().you]||RESOURCES.some(r=>!Number.isSafeInteger(resources[r])||resources[r]<0||resources[r]>me.resources[r])){$('form-error').textContent='Select exactly the required number of cards from your hand.';return;}sendAction({type:'DISCARD_RESOURCES',resources});return;}
  if(form.id==='trade-form'){submitTrade();return;}
});
document.addEventListener('input',e=>{if(e.target.id==='room-id')formDraft.room=e.target.value;if(e.target.id==='scenario'){formDraft.scenario=e.target.value;render();}if(e.target.id==='player-count')formDraft.playerCount=Number(e.target.value);if(e.target.id==='bot-level')formDraft.level=e.target.value;if(e.target.id==='game-mode'){formDraft.gameMode=e.target.value;if(formDraft.gameMode!=='solo'&&formDraft.level==='planner')formDraft.level='standard';render();}if(e.target.closest('#discard-form'))$('discard-total').textContent=`${handCount(Object.fromEntries(RESOURCES.map(r=>[r,Number($(`discard-${r}`).value)])))} selected`;});
$('help').onclick=()=>helpPanel();$('refresh').onclick=()=>{if(googleAuth.profile())sync();};$('room').onclick=()=>showMenu();
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#join')){invitationToken=new URLSearchParams(location.hash.split('?')[1]||'').get('invite')||invitationToken;formDraft.room=invitedRoom();if(saved?.pending){notice='Resolve your current move before joining another game.';render();}else setScreen('join');}else if(location.hash==='#home')dispatch('home');});
window.addEventListener('offline',()=>{clearTimeout(timer);if(offlineAllowed()){error=null;render();schedule();return;}ready=false;error=new PlayError('NETWORK_UNAVAILABLE','Internet play is paused. Your data is still here.',{retryable:true});render();});
window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);motion.reset();movePacer.reset();}else sync();});window.addEventListener('pageshow',()=>{if(saved&&!busy)sync();});
async function boot(){
  if(isGoogleReturn(location.href)){const href=location.href;history.replaceState(null,'',location.pathname+'#home');accountBusy=true;notice='Completing Google sign-in…';render();try{await changeAccount(()=>googleAuth.finish(href,path=>history.replaceState(null,'',path)));notice='Signed in with Google.';}catch(e){notice=e.message||'Google sign-in could not be completed. Please try again.';}finally{accountBusy=false;}}
  invitationToken=new URLSearchParams(location.hash.split('?')[1]||'').get('invite')||invitationToken;
  try{knownGames=await client.games();const existing=await client.inspect();saved=existing.state;packet=existing.packet;screen=location.hash==='#home'?'home':location.hash.startsWith('#join')&&invitedRoom()!==saved.roomId?'join':saved.roomId?'table':'home';ready=screen==='home'?!saved.pending:!saved.roomId&&!saved.pending;render();if((navigator.onLine||client.isLocal())&&(saved.roomId||saved.pending)&&(screen!=='home'||saved.pending))await sync();}catch(e){error=e;ready=false;render();}
}
trackViewport();boot();

setupPwa({onReloadPending:()=>{updateReloadPending=true;render();},isIdle:()=>(ready&&!error||['UPDATE_PENDING','UNSUPPORTED_VERSION'].includes(error?.code))&&!busy&&!accountBusy&&!saved?.pending&&screen==='home'&&!sheet.open&&!reply.open&&!$('sidebar').open,canUpdate:async artifact=>!busy&&!accountBusy&&!saved?.pending&&screen==='home'&&!sheet.open&&!reply.open&&!$('sidebar').open&&await client.canUpdate(artifact)});
