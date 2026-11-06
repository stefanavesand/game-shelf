import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
const root='/game-shelf/play/',key='spelhyllan-online-auth-v1';
const guest={user:{id:'guest',is_anonymous:true},access_token:'guest-access',refresh_token:'guest-refresh',expires_at:4102444800};
const google={user:{id:'google-player',email:'player@example.test',is_anonymous:false,app_metadata:{provider:'google'}},access_token:'google-access',refresh_token:'google-refresh',expires_at:4102444800};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
async function setup(browser,{initial=guest,cancel=false}={}){
 const context=await browser.newContext(),calls={authorize:0,token:[],logout:0,signup:0};let challenge;
 if(initial)await context.addInitScript(({key,initial})=>{if(!localStorage.getItem('auth-test-initialized')){localStorage.setItem(key,JSON.stringify(initial));localStorage.setItem('auth-test-initialized','yes');}},{key,initial});
 await context.route('https://ppaixjqaixwnebhxfjeb.supabase.co/**',async route=>{
  const r=route.request(),u=new URL(r.url());if(r.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  if(u.pathname.endsWith('/authorize')){calls.authorize++;challenge=u.searchParams.get('code_challenge');const back=u.searchParams.get('redirect_to');expect(new URL(back).pathname).toBe(root);await route.fulfill({status:302,headers:{location:back+(cancel?'?error=access_denied':'?code=fixture-code')}});return;}
  if(u.searchParams.get('grant_type')==='pkce'){calls.token.push(r.postDataJSON());await route.fulfill({json:google,headers:cors});return;}
  if(u.pathname.endsWith('/logout')){calls.logout++;expect(u.searchParams.get('scope')).toBe('local');await route.fulfill({status:204,headers:cors});return;}
  if(u.pathname.endsWith('/signup'))calls.signup++;await route.abort();
 });
 const page=await context.newPage();await page.goto(root+'#home');await expect(page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();return {context,page,calls,challenge:()=>challenge};
}
for(const initial of [guest,null])test(`Google PKCE return signs in from ${initial?'a guest':'a fresh installation'} and sign-out does not create a guest`,async({browser})=>{
 const f=await setup(browser,{initial});try{
  await f.page.getByRole('button',{name:'Sign in with Google',exact:true}).click();await expect(f.page.getByRole('heading',{name:'Google account',exact:true})).toBeVisible();await expect(f.page.getByText('player@example.test',{exact:true})).toBeVisible();expect(f.page.url()).not.toContain('code=');expect(f.page.url()).not.toContain('access_token');
  expect(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,key)).toBe('google-player');expect(f.calls.token).toHaveLength(1);expect(createHash('sha256').update(f.calls.token[0].code_verifier).digest('base64url')).toBe(f.challenge());expect(f.calls.token[0].auth_code).toBe('fixture-code');expect(f.calls.signup).toBe(0);
  await f.page.getByRole('button',{name:'Sign out',exact:true}).click();await f.page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();await expect(f.page.getByRole('button',{name:'Sign in with Google',exact:true})).toBeEnabled();expect(await f.page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();expect(f.calls.logout).toBe(1);expect(f.calls.signup).toBe(0);
 }finally{await f.context.close();}
});
test('cancelled Google sign-in keeps the existing guest and leaves home usable',async({browser})=>{
 const f=await setup(browser,{cancel:true});try{await f.page.getByRole('button',{name:'Sign in with Google',exact:true}).click();await expect(f.page.getByText('Google sign-in was cancelled.',{exact:true})).toBeVisible();await expect(f.page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();expect(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,key)).toBe('guest');expect(f.calls.token).toHaveLength(0);expect(f.page.url()).not.toContain('error=');}finally{await f.context.close();}
});
test('an unsolicited callback cannot replace a player or lock the home screen',async({browser})=>{
 const f=await setup(browser);try{await f.page.goto(root+'?code=unsolicited#home');await expect(f.page.getByText('Start Google sign-in from this app and return to the same browser. Your previous identity has been kept.',{exact:true})).toBeVisible();await expect(f.page.getByRole('button',{name:'New game',exact:true})).toBeEnabled();expect(f.calls.token).toHaveLength(0);expect(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,key)).toBe('guest');expect(f.page.url()).not.toContain('code=');}finally{await f.context.close();}
});
test('a pending delivery in another saved room blocks changing account',async({browser})=>{
 const f=await setup(browser);try{await f.page.evaluate(async()=>{const {createRelayStore}=await import('./relay/store.js'),s=createRelayStore({name:'game-shelf-online-catan-v1'}),index=await s.load('guest','@index');index.rooms={old:{}};index.current=null;await s.save(index);const record=await s.load('guest','old');record.outbox.push({message:{type:'game.command'},request:null});await s.save(record);});await f.page.reload();await f.page.getByRole('button',{name:'Sign in with Google',exact:true}).click();await expect(f.page.getByText('Resolve pending moves before changing account.',{exact:true})).toBeVisible();expect(f.calls.authorize).toBe(0);}finally{await f.context.close();}
});
