import {RESOURCES,RESOURCE_NAMES,ownPlayer,handCount} from './core/protocol.js';
const empty=()=>Object.fromEntries(RESOURCES.map(r=>[r,0]));
export function offerDraft(view,prior){
  if(prior?.roomId===view.id&&prior.revision===view.revision&&prior.you===view.you)return prior;
  return {roomId:view.id,revision:view.revision,you:view.you,to:view.seats.find(s=>s.id!==view.you)?.id,give:empty(),receive:empty()};
}
export function offerIssue(view,draft){
  if(draft.roomId!==view.id||draft.revision!==view.revision||draft.you!==view.you)return 'The game changed. Reopen Trade to review your cards.';
  const target=view.state.players.players.find(p=>p.id===draft.to&&p.id!==view.you),hand=ownPlayer(view).resources;
  if(!target)return 'Choose a player to trade with.';
  if(!target.resourceCount)return `${target.name} has no resource cards to trade.`;
  if(!handCount(hand))return 'You have no resource cards to trade.';
  if(RESOURCES.some(r=>!Number.isSafeInteger(draft.give[r])||!Number.isSafeInteger(draft.receive[r])||draft.give[r]<0||draft.give[r]>hand[r]||draft.receive[r]<0||draft.receive[r]>19))return 'Choose valid quantities from your available cards.';
  if(RESOURCES.some(r=>draft.give[r]&&draft.receive[r]))return 'Choose different resources on each side.';
  if(!handCount(draft.give))return 'Choose cards to give.';
  if(!handCount(draft.receive))return 'Choose what you want in return.';
  if(handCount(draft.receive)>target.resourceCount)return `${target.name} has only ${target.resourceCount} resource cards in total.`;
  return '';
}
export function handAfter(hand,give,receive){return Object.fromEntries(RESOURCES.map(r=>[r,hand[r]-(give[r]||0)+(receive[r]||0)]));}
export const tradeLabel=bundle=>RESOURCES.filter(r=>bundle[r]).map(r=>`${bundle[r]} ${RESOURCE_NAMES[r]}`).join(' + ')||'Choose cards';
export const bankChoices=view=>view.choices.filter(c=>c.type==='BANK_TRADE');
export function bankBundles(action){return {give:{...empty(),...(action?{[action.give.resource]:action.give.amount}:{})},receive:{...empty(),...(action?{[action.receive.resource]:action.receive.amount}:{})}};}
