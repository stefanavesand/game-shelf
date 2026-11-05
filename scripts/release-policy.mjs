import {createHash} from 'node:crypto';
export function releasePolicy(input){
 const config={breaking:false,...input};
 if(typeof config.breaking!=='boolean'||typeof config.version!=='string'||!config.version||!/^\w[\w.+-]*$/.test(config.version)||!/^[a-f0-9]{64}$/.test(config.compatibilityId||''))throw Error('Invalid release policy');
 if(config.breaking&&config.lastBreakingVersion!==config.version){
  config.compatibilityId=createHash('sha256').update(JSON.stringify([config.compatibilityId,config.version])).digest('hex');
  config.lastBreakingVersion=config.version;
 }
 return config;
}
