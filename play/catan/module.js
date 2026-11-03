import {newCatan,applyCatan,catanView,eligibleActors,botDecision,CatanRuleError,CATAN_ENGINE_VERSION} from './rules/index.js';
import {createEntropy,RANDOM_ALGORITHM} from './entropy.js';
import {RuleRejection} from '../relay/replica.js';
import {invariant,clone} from '../relay/protocol.js';
export function catanConfig(humans,{solo=false,level='standard',seed}={}) {
  invariant(['easy','standard'].includes(level),'INVALID_CONFIGURATION','Choose Easy or Standard.');
  invariant(humans.length===(solo?1:2)&&new Set(humans.map(h=>h.id)).size===humans.length,'INVALID_CONFIGURATION','Choose one solo player or two human players.');
  invariant(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff,'INVALID_CONFIGURATION','A nonzero uint32 seed is required.');
  const seats=humans.map(h=>({id:h.id,name:h.name.slice(0,30),kind:'human',level}));
  while(seats.length<3)seats.push({id:`bot:${seats.length}`,name:`Bot ${seats.length-humans.length+1}`,kind:'bot',level});
  return {schemaVersion:1,rulesVersion:CATAN_ENGINE_VERSION,randomAlgorithm:RANDOM_ALGORITHM,seed,seats};
}
export function createCatanModule(artifactDigest) {
  return {
    id:'catan-base',version:2,digest:artifactDigest,
    initialize(config,{gameId}={}) {
      invariant(config?.schemaVersion===1&&config.rulesVersion===CATAN_ENGINE_VERSION&&config.randomAlgorithm===RANDOM_ALGORITHM,'UNSUPPORTED_ENGINE','Unsupported Catan configuration.');
      invariant(Array.isArray(config.seats)&&config.seats.length===3&&[1,2].includes(config.seats.filter(s=>s.kind==='human').length),'INVALID_CONFIGURATION','This pilot supports one or two humans plus bots.');
      const entropy=createEntropy({rngState:config.seed,idCounter:0},gameId,0);
      return {snapshot:newCatan(gameId,config.seats,entropy),entropy:entropy.snapshot()};
    },
    apply(state,sender,command,effects,{coordinatorId}={}) {
      invariant(effects&&Object.keys(effects).length===0,'INVALID_EFFECTS','Catan uses its pinned deterministic entropy, not supplied dice results.');
      const seat=state.snapshot.seats.find(s=>s.id===command?.actor);
      if(!seat||(seat.kind==='human'?seat.id!==sender:sender!==coordinatorId))throw new RuleRejection('You cannot act for this player.');
      const entropy=createEntropy(state.entropy,state.snapshot.id,state.snapshot.revision+1);
      try{return {snapshot:applyCatan(state.snapshot,seat.id,command.action,entropy),entropy:entropy.snapshot()};}
      catch(error){if(error instanceof CatanRuleError)throw new RuleRejection(error.message);throw error;}
    },
    view:(state,seat)=>catanView(state.snapshot,seat),
    nextBot(state) {
      const bot=state.snapshot.seats.find(s=>s.kind==='bot'&&eligibleActors(state.snapshot).includes(s.id));
      if(!bot)return null;
      const observation=catanView(state.snapshot,bot.id);
      return {actor:bot.id,action:clone(botDecision(observation,bot.level))};
    }
  };
}
