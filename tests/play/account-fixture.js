import {test as base,expect} from '@playwright/test';
// Gameplay tests start after Google authentication. OAuth itself is tested separately.
export const test=base.extend({browser:async({browser},use)=>{
 await use(new Proxy(browser,{get(target,key){if(key==='newContext')return async(...args)=>{const context=await target.newContext(...args);await context.addInitScript(()=>{const key='spelhyllan-online-auth-v1';if(!localStorage.getItem('account-fixture-initialized')){if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({user:{id:'alice',is_anonymous:false,app_metadata:{provider:'google'},user_metadata:{full_name:'Alice'}},access_token:'alice',refresh_token:'fixture',expires_at:4102444800}));localStorage.setItem('account-fixture-initialized','yes');}});return context;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}));
}});
export {expect};
