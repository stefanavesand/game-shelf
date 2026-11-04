import {createOnlineGameClient} from './relay/game-client.js';
import {createLocalClient} from './local/client.js';
const online=createOnlineGameClient(),local=createLocalClient();
export const client={
 isLocal:()=>local.isLocal(),
 get capabilities(){return {...online.capabilities,requiresInternet:!local.isLocal()};},
 async inspect(){const value=await local.inspect();return local.isLocal()?value:online.inspect();},
 async games(){const games=await local.games();let remote=[];try{remote=await online.games();}catch(error){if(!games.length)throw error;}return [...games,...remote];},
 async execute(op,args={},options){if(op==='create'&&args.mode==='solo')return local.execute(op,args);if(op==='command'&&local.isLocal())return local.execute(op,args);const result=await online.execute(op,args,options);if(result?.ok)await local.selectOnline();return result;},
 refresh:()=>local.isLocal()?local.refresh():online.refresh(),
 async resume(roomId){const result=await local.resume(roomId);if(result)return result;const remote=await online.resume(roomId);if(remote.ok)await local.selectOnline();return remote;},
 async abandon(roomId){if((await local.games()).some(g=>g.roomId===roomId))return local.abandon(roomId);return online.abandon(roomId);},
 canUpdate:async artifact=>await local.canUpdate(artifact)&&await online.canUpdate(artifact)
};
