import {withSessionLock} from './lifecycle.js';
import {createOnlineGameClient} from './relay/game-client.js';
import {createIdentity,isAccount,accountName} from './core/identity.js';
import {PlayError} from './core/errors.js';
import {createLocalStorage,createLocalClient} from './local/client.js';
const auth=createIdentity(),account=()=>{const s=auth.savedIdentity();return isAccount(s?.user)?s.user:null;};
const online=createOnlineGameClient({auth}),local=createLocalClient({storage:createLocalStorage({owner:()=>account()?.id})});
const empty=()=>({state:{roomId:null,pending:null},packet:null});
export const client={
 isLocal:()=>!!account()&&local.isLocal(),
 get capabilities(){return {...online.capabilities,requiresInternet:!local.isLocal(),commandReturnsCurrentState:true};},
 async inspect(){if(!account())return empty();const value=await local.inspect();return local.isLocal()?value:online.inspect();},
 async games(){if(!account())return [];const games=await local.games();let remote=[];try{remote=await online.games();}catch(error){if(!games.length)throw error;}return [...games,...remote];},
 async execute(op,args={},options){if(['create','join'].includes(op))args={...args,name:accountName(account())};if(op==='create'&&args.mode==='solo')return local.execute(op,args,options);if(op==='command'&&local.isLocal())return local.execute(op,args,options);const result=await online.execute(op,args,options);if(result?.ok)await local.selectOnline();return result;},
 refresh:options=>local.isLocal()?local.refresh(options):online.refresh(options),
 async resume(roomId,options){const result=await local.resume(roomId,options);if(result)return result;const remote=await online.resume(roomId,options);if(remote.ok)await local.selectOnline();return remote;},
 async abandon(roomId){if((await local.games()).some(g=>g.roomId===roomId))return local.abandon(roomId);return online.abandon(roomId);},
 canUpdate:async artifact=>await local.canUpdate(artifact)&&await online.canUpdate(artifact)
};

// Fence all operations that may persist state or schedule bots against activation.
for(const method of ['execute','refresh','resume','abandon']){
 const operation=client[method].bind(client);
 client[method]=(...args)=>withSessionLock(()=>{if(!account())throw new PlayError('AUTH_REQUIRED','Sign in with Google to play.');return operation(...args);});
}
