// Exact component ablations of the frozen resource experiment; no retuning.
import {decision as resources} from './resource-policy.mjs';
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
export function decision(view,parameters,seed){
 if(!view.choices.length||view.choices.length>256||JSON.stringify(view).length>131072)throw Error('Resource component observation exceeds work budget');
 const discard=view.state.game.phase==='discard';
 if(discard&&!parameters.enableGoalDiscard||!discard&&!parameters.enableResourceCards)return {action:baseline(view,'standard'),reason:'FROZEN_COMPONENT'};
 return resources(view,parameters,seed);
}
export const botDecision=(view,_level,parameters,seed)=>decision(view,parameters,seed).action;
