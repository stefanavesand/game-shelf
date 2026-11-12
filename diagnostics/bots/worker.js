import {decision} from './policies/trade-policy.js';
import {botDecision as baseline} from './policies/baselines/heuristic-1.1.0.js';
import {fixtures,metadata} from './fixtures.js';
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){postMessage({type:'ready',metadata,fixtures:fixtures.map(f=>f.id)});return;}
  if(data.type!=='decision'||!['candidate','baseline'].includes(data.policy)||!Number.isInteger(data.index)||data.index<0||data.index>=fixtures.length)throw Error('Invalid benchmark request');
  const fixture=fixtures[data.index],start=performance.now(),view=freeze(structuredClone(fixture.view));
  const result=data.policy==='candidate'?decision(view,metadata.profile.parameters,fixture.seed):{action:baseline(view,'standard')};
  const decisionMs=performance.now()-start;
  if(JSON.stringify(result)!==fixture.expected[data.policy])throw Error('Decision parity mismatch: '+fixture.id);
  postMessage({type:'decision',requestId:data.requestId,policy:data.policy,fixtureId:fixture.id,decisionMs});
 }catch(error){postMessage({type:'error',message:String(error.message).slice(0,200)});}
};
