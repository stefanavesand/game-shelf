// Original counteroffer gate around the immutable construction/trade policy.
import {decision as buildTradeDecision} from './build-trade-policy.mjs';
import {catanChoices} from '../../play/catan/rules/session.js';
export function decision(view,p,seed,memory=null){
 const result=buildTradeDecision(view,p,seed,memory);
 if(p.enableCounterOffers||result.action.type!=='TRADE_OFFER'||!result.action.replaces)return result;
 const decline=catanChoices(view.state,view.you,view.offer).find(a=>a.type==='TRADE_DECLINE'&&a.offerId===result.action.replaces&&view.choices.some(c=>c.type===a.type&&c.offerId===a.offerId));
 if(!decline)throw Error('No legal response for disabled counteroffer');
 const {tradeGain,...diagnostics}=result.diagnostics;
 return {...result,action:decline,reason:'COUNTER_DISABLED',diagnostics:{...diagnostics,nextStep:decline,counterSuppressed:true,suppressedCounterGain:tradeGain}};
}
