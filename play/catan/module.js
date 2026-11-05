import {botName} from './rules/bot-names.js';
import {pendingTradeRecipients} from './rules/session.js';
import {newCatan,applyCatan,catanView,eligibleActors,botDecision,CatanRuleError,CATAN_ENGINE_VERSION} from './rules/index.js';
import {createEntropy,RANDOM_ALGORITHM} from './entropy.js';
import {RuleRejection} from '../relay/replica.js';
import {invariant,clone} from '../relay/protocol.js';
export function catanConfig(humans,{solo=false,level='standard',seed,playerCount=3}={}) {
  invariant(['easy','standard'].includes(level),'INVALID_CONFIGURATION','Choose Easy or Standard.');
  invariant([3,4].includes(playerCount)&&humans.length>=1&&humans.length<=playerCount&&(!solo||humans.length===1)&&new Set(humans.map(h=>h.id)).size===humans.length,'INVALID_CONFIGURATION','Choose three or four seats and distinct human players.');
  invariant(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff,'INVALID_CONFIGURATION','A nonzero uint32 seed is required.');
  const seats=humans.map(h=>({id:h.id,name:h.name.slice(0,30),kind:'human',level}));
  while(seats.length<playerCount)seats.push({id:`bot:${seats.length}`,name:botName(seed,seats.length-humans.length,seats.map(s=>s.name)),kind:'bot',level});
  return {schemaVersion:1,rulesVersion:CATAN_ENGINE_VERSION,randomAlgorithm:RANDOM_ALGORITHM,seed,seats};
}
function eligibleBot(state){
 const eligible=state.snapshot.offer?pendingTradeRecipients(state.snapshot.offer):eligibleActors(state.snapshot);
 return state.snapshot.seats.find(s=>s.kind==='bot'&&eligible.includes(s.id));
}
export function createCatanModule(artifactDigest) {
  return {
    id:'catan-base',version:2,digest:artifactDigest,
    validateLobby(config){invariant(config&&[3,4].includes(config.playerCount)&&['easy','standard'].includes(config.level)&&Number.isSafeInteger(config.seed)&&config.seed>0&&config.seed<=0xffffffff,'INVALID_CONFIGURATION','Invalid lobby configuration.');return {playerCount:config.playerCount,level:config.level,seed:config.seed};},
    initialize(config,{gameId}={}) {
      invariant(config?.schemaVersion===1&&config.rulesVersion===CATAN_ENGINE_VERSION&&config.randomAlgorithm===RANDOM_ALGORITHM,'UNSUPPORTED_ENGINE','Unsupported Catan configuration.');
      invariant(Array.isArray(config.seats)&&[3,4].includes(config.seats.length)&&config.seats.some(s=>s.kind==='human'),'INVALID_CONFIGURATION','Choose three or four seats with at least one human.');
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
    hasBotWork:state=>!!eligibleBot(state),
    nextBot(state) {
      const bot=eligibleBot(state);
      if(!bot)return null;
      const observation=catanView(state.snapshot,bot.id);
      return {actor:bot.id,action:clone(botDecision(observation,bot.level))};
    }
  };
}
