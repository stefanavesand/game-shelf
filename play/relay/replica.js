// Pure session transitions apart from injected hashing. No provider or UI imports.
import {clone,digest,invariant,canonical} from './protocol.js';
export const SESSION_SCHEMA='game-shelf/session/1';
export class RuleRejection extends Error {}
const envelope=(type,payload)=>({schema:SESSION_SCHEMA,type,payload});
export async function beginMessage(module,config,gameId) {
  const state=module.initialize(clone(config),{gameId});
  return envelope('game.begin',{gameId,moduleId:module.id,moduleVersion:module.version,moduleDigest:module.digest,config:clone(config),resultHash:await digest(state)});
}
export function configureMessage(module,config){
 invariant(typeof module.validateLobby==='function','UNSUPPORTED_ENGINE','This module does not support lobbies.');
 return envelope('game.configure',{moduleId:module.id,moduleVersion:module.version,moduleDigest:module.digest,config:module.validateLobby(clone(config))});
}
export async function commandMessage(record,module,command,effects,intentId,context={}) {
  invariant(record.game&&!record.halt,'NOT_PLAYING','Start a game before proposing a move.');
  const game=record.game,next=module.apply(clone(game.state),record.principalId,clone(command),clone(effects),context);
  return envelope('game.command',{gameId:game.id,intentId,baseGameRevision:game.revision,beforeHash:game.hash,command:clone(command),effects:clone(effects),resultHash:await digest(next)});
}
export async function applyMessage(saved,item,{module,creatorId,members}) {
  const record=clone(saved),notifications=[];
  invariant(members.includes(item.senderId),'INVALID_SENDER','A message came from outside this channel.');
  const {schema,type,payload:p}=item.message;
  invariant(schema===SESSION_SCHEMA,'UNSUPPORTED_PROTOCOL','Unsupported session message schema.');
  invariant(p&&typeof p==='object'&&!Array.isArray(p),'INVALID_MESSAGE','Missing session payload.');
  const halt=reason=>{if(!record.halt){record.halt={code:'DESYNC_DETECTED',reason,sequence:item.sequence,gameRevision:record.game?.revision??0};notifications.push(envelope('game.halt',{gameId:record.game?.id??null,sequence:item.sequence,reason}));}};
  if(type==='game.halt') {
    invariant(record.game&&p.gameId===record.game.id,'INVALID_MESSAGE','Halt belongs to a different game.');
    record.halt??={code:'DESYNC_DETECTED',reason:'peer_report',sequence:item.sequence,gameRevision:record.game.revision};
  } else if(record.halt) {
    // Consume transport history for diagnostics but never continue a halted game.
  } else if(type==='game.configure') {
    invariant(item.senderId===creatorId&&!record.game&&!record.lobby,'INVALID_MESSAGE','Only the creator may configure an unstarted lobby once.');
    invariant(p.moduleId===module.id&&p.moduleVersion===module.version&&p.moduleDigest===module.digest&&typeof module.validateLobby==='function','UNSUPPORTED_ENGINE','Update the app to join this lobby.');
    record.lobby=module.validateLobby(clone(p.config));
  } else if(type==='game.begin') {
    invariant(item.senderId===creatorId&&!record.game,'INVALID_MESSAGE','Only the creator may initialize a game once.');
    invariant(p.moduleId===module.id&&p.moduleVersion===module.version&&p.moduleDigest===module.digest,'UNSUPPORTED_ENGINE','This game requires a compatible engine release.');
    invariant(typeof p.gameId==='string'&&p.gameId.length>0,'INVALID_MESSAGE','Missing game identity.');
    const state=module.initialize(clone(p.config),{gameId:p.gameId}),hash=await digest(state);
    record.game={id:p.gameId,revision:0,state,hash,moduleId:module.id,moduleVersion:module.version,moduleDigest:module.digest,hashes:{0:hash},seen:{},peerVerified:{}};
    if(hash!==p.resultHash)halt('initial_hash_mismatch');
    else notifications.push(envelope('game.verify',{gameId:p.gameId,revision:0,resultHash:hash}));
  } else if(type==='game.command') {
    const g=record.game;
    invariant(g&&p.gameId===g.id&&typeof p.intentId==='string'&&Number.isSafeInteger(p.baseGameRevision),'INVALID_MESSAGE','Invalid game command metadata.');
    // Re-enveloping the same intent after a transport CAS conflict must not apply twice.
    const fingerprint=canonical({sender:item.senderId,...p});
    if(Object.hasOwn(g.seen,p.intentId)) {
      invariant(g.seen[p.intentId]===fingerprint,'INTENT_CONFLICT','A game intent ID was reused with different content.');
    } else {
      Object.defineProperty(g.seen,p.intentId,{value:fingerprint,writable:true,enumerable:true,configurable:true});
      if(p.baseGameRevision===g.revision) {
        if(p.beforeHash!==g.hash)halt('base_hash_mismatch');
        else {
          try {
            const next=module.apply(clone(g.state),item.senderId,clone(p.command),clone(p.effects),{coordinatorId:creatorId}),hash=await digest(next);
            if(hash!==p.resultHash)halt('result_hash_mismatch');
            else {g.state=next;g.hash=hash;g.revision++;g.hashes[g.revision]=hash;notifications.push(envelope('game.verify',{gameId:g.id,revision:g.revision,resultHash:hash}));}
          } catch(error) {
            if(error instanceof RuleRejection)halt('proposed_acceptance_was_rejected');
            else halt('engine_exception');
          }
        }
      }
      // A stale command is rejected by ordering, not a divergence or an extra move.
    }
  } else if(type==='game.verify') {
    const g=record.game;
    invariant(g&&p.gameId===g.id&&Number.isSafeInteger(p.revision)&&Object.hasOwn(g.hashes,p.revision),'INVALID_MESSAGE','Verification refers to an unknown revision.');
    if(g.hashes[p.revision]!==p.resultHash)halt('peer_hash_mismatch');
    else g.peerVerified[item.senderId]=Math.max(g.peerVerified[item.senderId]??-1,p.revision);
  } else invariant(false,'UNSUPPORTED_PROTOCOL','Unsupported session message type.');
  record.cursor=item.sequence;
  return {record,notifications};
}
