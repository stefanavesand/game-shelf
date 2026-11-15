import {decideBot} from './decision.js';
self.onmessage=async({data})=>{try{self.postMessage(await decideBot(data.view,data.memory,data.policy));}catch(error){self.postMessage({error:String(error.message).slice(0,240)});}};
