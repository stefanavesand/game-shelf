import {readFileSync} from 'node:fs';
const trace=JSON.parse(readFileSync(new URL('../fixtures/setup-trace.json',import.meta.url)));
const main=JSON.parse(readFileSync(new URL('../fixtures/main-view.json',import.meta.url)));
export const roomId=main.p1.roomId;
export const AUTH='spelhyllan-online-auth-v1',STATE='game-shelf-catan-online-v1';
const endpoint='https://stefan-game-shelf.lovable.app/api/public/catan';
export const auth=principal=>({access_token:principal,refresh_token:`refresh-${principal}`,expires_at:9999999999,user:{id:principal}});
export function service({phase='setup',loseReply=false,futureReply=false}={}){
  let host=phase==='main'?'alice':'',guest=phase==='main'?'bob':'',started=phase==='main',index=0,current=phase==='main'?structuredClone(main):null,dropped=false,accepted=0;
  const receipts=new Map(),commands=[];let authCalls=0;
  const packet=seat=>started?structuredClone(current[seat]):{ok:true,apiVersion:1,roomId,status:'waiting',you:seat,revision:0,members:[{id:'p1',name:'Alice',kind:'human',level:'standard'},{id:'p3',name:'Bot',kind:'bot',level:'standard'}],view:null};
  const error=(code,message=code)=>({ok:false,apiVersion:1,error:{code,message}});
  async function attach(context,principal,{legacy=false,identity=true}={}){
    if(legacy)await context.addInitScript(({AUTH,STATE,session,roomId,identity})=>{if(identity&&!localStorage.getItem(AUTH))localStorage.setItem(AUTH,JSON.stringify(session));if(!localStorage.getItem(STATE))localStorage.setItem(STATE,JSON.stringify({schemaVersion:1,roomId,pending:null}));},{AUTH,STATE,session:auth(principal),roomId,identity});
    await context.route('https://ppaixjqaixwnebhxfjeb.supabase.co/**',async route=>{authCalls++;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}await route.fulfill({headers,json:auth(principal)});});
    await context.route(endpoint,async route=>{
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','cache-control':'no-store'};
      if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      const body=route.request().postDataJSON();let seat=principal===host?'p1':principal===guest?'p2':null,reply;
      if(body.op==='create'){host=principal;seat='p1';reply=packet(seat);}
      else if(body.op==='join'){
        if(body.roomId!==roomId)reply=error('room_not_found');else if(guest&&guest!==principal)reply=error('room_full');else{guest=principal;seat='p2';started=true;current=structuredClone(trace[index]);reply=packet(seat);}
      }else if(!seat)reply=error('room_not_found');
      else if(body.op==='command'){
        commands.push(structuredClone(body));const key=`${principal}:${body.commandId}`,prior=receipts.get(key),hash=JSON.stringify(body);
        if(prior){reply=prior.hash===hash?packet(seat):error('command_id_conflict');}
        else if(body.expectedRevision!==current[seat].revision)reply=error('revision_conflict');
        else if(phase==='setup'){
          const next=trace[index].next;if(!next||next.actor!==seat||JSON.stringify(next.action)!==JSON.stringify(body.action))reply=error('rule_rejected');else{index++;current=structuredClone(trace[index]);accepted++;receipts.set(key,{hash});reply=packet(seat);}
        }else{
          if(!current[seat].view.choices.some(c=>JSON.stringify(c)===JSON.stringify(body.action)))reply=error('rule_rejected');else{
            accepted++;receipts.set(key,{hash});
            for(const peer of ['p1','p2']){
              const p=current[peer];p.revision++;p.view.revision=p.revision;
              if(body.action.type==='BUILD_ROAD'){
                p.view.state.board.roads.push({id:`mock-road-${accepted}`,type:'road',playerId:seat,edge:body.action.edge});const actor=p.view.state.players.players.find(s=>s.id===seat);actor.resourceCount-=2;actor.roadsRemaining--;if(peer===seat){actor.resources.brick--;actor.resources.lumber--;}
                p.view.choices=p.view.choices.filter(c=>JSON.stringify(c)!==JSON.stringify(body.action));
              }
            }
            reply=packet(seat);
          }
        }
        if(reply?.ok&&futureReply){await route.fulfill({headers,json:{...reply,apiVersion:99}});return;}
        if(reply?.ok&&loseReply&&!dropped){dropped=true;await route.abort('failed');return;}
      }else reply=packet(seat);
      await route.fulfill({headers,json:reply||error('bad_request')});
    });
  }
  return {attach,get accepted(){return accepted;},get commands(){return commands;},get authCalls(){return authCalls;},get current(){return current;}};
}
