import {createHash} from 'node:crypto';
import {botDecision as baseline} from './baselines/heuristic-1.1.0.js';
import {botDecision as parameterized} from './parameter-policy.js';
export function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const bytesHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function keys(value,expected,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!expected.includes(k))||expected.some(k=>!Object.hasOwn(value,k)))throw Error(`Invalid keys: ${label}`);}
export function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(`Invalid ${label}`);}
export function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const registry=freeze({
 settlementBase:{type:'number',unit:'legacy score',min:0,max:300,default:140},
 cityBase:{type:'number',unit:'legacy score',min:0,max:300,default:135},
 roadBase:{type:'number',unit:'legacy score',min:0,max:100,default:35},
 developmentBase:{type:'number',unit:'legacy score',min:0,max:200,default:80},
 bankTradeBase:{type:'number',unit:'legacy score',min:0,max:100,default:45},
 tradeAcceptBase:{type:'number',unit:'legacy score',min:0,max:100,default:25},
 noiseAmplitude:{type:'number',unit:'legacy score',min:0,max:35,default:0.01}
});
export function template(id='heuristic-candidate',policyVersion='heuristic-params-0.1.0'){
 return {schemaVersion:1,id,policyVersion,featureSchemaVersion:1,level:'standard',parameters:policyVersion==='heuristic-1.1.0'?{}:Object.fromEntries(Object.entries(registry).map(([k,v])=>[k,v.default]))};
}
export function validateProfile(input){
 keys(input,['schemaVersion','id','policyVersion','featureSchemaVersion','level','parameters'],'profile');
 if(input.schemaVersion!==1||input.featureSchemaVersion!==1||!['heuristic-1.1.0','heuristic-params-0.1.0'].includes(input.policyVersion)||!['easy','standard'].includes(input.level)||typeof input.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.id))throw Error('Unsupported profile');
 const expected=input.policyVersion==='heuristic-1.1.0'?[]:Object.keys(registry);keys(input.parameters,expected,'parameters');
 for(const key of expected){const value=input.parameters[key],r=registry[key];if(typeof value!=='number'||!Number.isFinite(value)||value<r.min||value>r.max)throw Error(`Invalid parameter: ${key}`);}
 if(Buffer.byteLength(canonical(input))>16384)throw Error('Profile too large');
 return freeze(structuredClone(input));
}
// Policy receives a cloned, frozen seat observation, never the authority snapshot.
export function decide(view,profile,decisionSeed){
 const observation=freeze(structuredClone(view));
 return profile.policyVersion==='heuristic-1.1.0'?baseline(observation,profile.level):parameterized(observation,profile.level,profile.parameters,decisionSeed);
}
