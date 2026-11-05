import {withSessionLock} from './lifecycle.js';
import {createOnlineGameClient} from './relay/game-client.js';
import {createLocalClient} from './local/client.js';
const online=createOnlineGameClient(),local=createLocalClient();
export const client={
 isLocal:()=>local.isLocal(),
 get capabilities(){return {...online.capabilities,requiresInternet:!local.isLocal(),commandReturnsCurrentState:true};},
 async inspect(){const value=await local.inspect();return local.isLocal()?value:online.inspect();},
 async games(){const games=await local.games();let remote=[];try{remote=await online.games();}catch(error){if(!games.length)throw error;}return [...games,...remote];},
 async execute(op,args={},options){if(op==='create'&&args.mode==='solo')return local.execute(op,args,options);if(op==='command'&&local.isLocal())return local.execute(op,args,options);const result=await online.execute(op,args,options);if(result?.ok)await local.selectOnline();return result;},
 refresh:options=>local.isLocal()?local.refresh(options):online.refresh(options),
 async resume(roomId,options){const result=await local.resume(roomId,options);if(result)return result;const remote=await online.resume(roomId,options);if(remote.ok)await local.selectOnline();return remote;},
 async abandon(roomId){if((await local.games()).some(g=>g.roomId===roomId))return local.abandon(roomId);return online.abandon(roomId);},
 canUpdate:async artifact=>await local.canUpdate(artifact)&&await online.canUpdate(artifact)
};

// Fence all operations that may persist state or schedule bots against activation.
for(const method of ['execute','refresh','resume','abandon']){
 const operation=client[method].bind(client);
 client[method]=(...args)=>withSessionLock(()=>operation(...args));
}
