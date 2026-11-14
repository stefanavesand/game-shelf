import {createEntropy} from '../../play/catan/entropy.js';
// Reproducible effects for headless tests that compare batched and stepped play.
// Production injects WebCrypto instead. Never sample from the authoritative deck.
export function recordedDice(state,command){
 if(state.diceMode!=='host-random-v1'||command.action.type!=='ROLL_DICE')return {};
 const seed=(state.entropy.rngState^Math.imul(state.snapshot.revision+1,0x9e3779b1))>>>0||1;
 const rng=createEntropy({rngState:seed,idCounter:0},state.snapshot.id,state.snapshot.revision);
 return {dice:[rng.randomInt(6)+1,rng.randomInt(6)+1]};
}
