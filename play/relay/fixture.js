// An original fixture game for network testing, not a Catan rule implementation.
import {RuleRejection} from './replica.js';
export function counterModule(artifactDigest) {
  return {
    id:'relay-counter',version:1,digest:artifactDigest,
    initialize(config){if(config?.start!==0)throw new RuleRejection('Counter starts at zero.');return {value:0};},
    apply(state,actor,command,effects,{coordinatorId}={}) {
      if(command?.type==='ROLL'&&actor!==coordinatorId)throw new RuleRejection('Wait for the coordinator to roll.');
      if(command?.type==='ADD'&&Number.isSafeInteger(command.amount)&&Math.abs(command.amount)<=10)state.value+=command.amount;
      else if(command?.type==='ROLL'&&Number.isSafeInteger(effects?.die)&&effects.die>=1&&effects.die<=6)state.value+=effects.die;
      else throw new RuleRejection('Invalid counter action or die.');
      if(!Number.isSafeInteger(state.value))throw new RuleRejection('Counter overflow.');
      return state;
    }
  };
}
