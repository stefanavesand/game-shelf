import {readFileSync} from 'node:fs';
const trace=JSON.parse(readFileSync(new URL('../fixtures/setup-trace.json',import.meta.url)));
const main=JSON.parse(readFileSync(new URL('../fixtures/main-view.json',import.meta.url)));
export const roomId=main.p1.roomId;
export const AUTH='spelhyllan-online-auth-v1',STATE='game-shelf-catan-online-v1';
const endpoint='https://stefan-game-shelf.lovable.app/api/public/catan';
export const auth=principal=>({access_token:principal,refresh_token:`refresh-${principal}`,expires_at:9999999999,user:{id:principal}});
export function service({phase='setup',loseReply=false,futureReply=false,loseCreateReply=false,expectedAction=null}={}){
  let host=phase==='main'?'alice':'',guest=phase==='main'?'bob':'',started=phase==='main',index=0,current=phase==='main'?structuredClone(main):null,dropped=false,accepted=0;
  let solo=false,createDropped=false;const creates=[],createReceipts=new Map();
  const receipts=new Map(),commands=[];let authCalls=0;
  const packet=seat=>started?structuredClone(current[seat]):{ok:true,apiVersion:1,roomId,status:'waiting',you:seat,revision:0,members:[{id:'p1',name:'Alice',kind:'human',level:'standard'},{id:'p3',name:'Bot',kind:'bot',level:'standard'}],view:null};
  const error=(code,message=code)=>({ok:false,apiVersion:1,error:{code,message}});
  async function attach(context,principal,{legacy=false,identity=true}={}){
    // UI fixture port only. Real local/relay sessions are covered separately.
    await context.route('**/play/session.js',route=>route.fulfill({contentType:'text/javascript',body:"import {createClient} from './core/client.js';export const client=createClient();client.isLocal=()=>false;client.canUpdate=async()=>true;"}));
    if(legacy)await context.addInitScript(({AUTH,STATE,session,roomId,identity})=>{if(identity&&!localStorage.getItem(AUTH))localStorage.setItem(AUTH,JSON.stringify(session));if(!localStorage.getItem(STATE))localStorage.setItem(STATE,JSON.stringify({schemaVersion:1,roomId,pending:null}));},{AUTH,STATE,session:auth(principal),roomId,identity});
    await context.route('https://ppaixjqaixwnebhxfjeb.supabase.co/**',async route=>{authCalls++;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}await route.fulfill({headers,json:auth(principal)});});
    await context.route(endpoint,async route=>{
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','cache-control':'no-store'};
      if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      const body=route.request().postDataJSON();let seat=principal===host?'p1':principal===guest?'p2':null,reply;
      if(body.op==='create'){
        creates.push(structuredClone(body));const key=`${principal}:${body.commandId}`,hash=JSON.stringify(body),prior=createReceipts.get(key);
        if(prior&&prior!==hash)reply=error('command_id_conflict');else{
          if(!prior){
            host=principal;solo=body.mode==='solo';
            if(solo){
              started=true;current=structuredClone(main);
              for(const peer of ['p1','p2'])for(const seats of [current[peer].members,current[peer].view.seats])for(const s of seats)if(s.id!=='p1'){s.kind='bot';s.name=s.id==='p2'?'Bot 1':'Bot 2';s.level=body.botLevel;}
            }
            createReceipts.set(key,hash);
          }
          seat='p1';reply=packet(seat);
          if(loseCreateReply&&!createDropped){createDropped=true;await route.abort('failed');return;}
        }
      }
      else if(body.op==='join'){
        if(body.roomId!==roomId)reply=error('room_not_found');else if(solo)reply=error('room_full');else if(guest&&guest!==principal)reply=error('room_full');else{guest=principal;seat='p2';started=true;current=structuredClone(trace[index]);reply=packet(seat);}
      }else if(!seat)reply=error('room_not_found');
      else if(body.op==='command'){
        commands.push(structuredClone(body));const key=`${principal}:${body.commandId}`,prior=receipts.get(key),hash=JSON.stringify(body);
        if(prior){reply=prior.hash===hash?packet(seat):error('command_id_conflict');}
        else if(body.expectedRevision!==current[seat].revision)reply=error('revision_conflict');
        else if(phase==='setup'){
          const next=trace[index].next;if(!next||next.actor!==seat||JSON.stringify(next.action)!==JSON.stringify(body.action))reply=error('rule_rejected');else{index++;current=structuredClone(trace[index]);accepted++;receipts.set(key,{hash});reply=packet(seat);}
        }else{
          if(!(expectedAction&&JSON.stringify(body.action)===JSON.stringify(expectedAction))&&!current[seat].view.choices.some(c=>JSON.stringify(c)===JSON.stringify(body.action)))reply=error('rule_rejected');else{
            accepted++;receipts.set(key,{hash});
            for(const peer of ['p1','p2']){
              const p=current[peer];p.revision++;p.view.revision=p.revision;
              if(body.action.type==='TRADE_OFFER'){
                const {to,give,receive}=body.action;p.view.offer={id:`mock-offer-${accepted}`,from:seat,to,give,receive,recipients:to==='all'?p.view.seats.filter(s=>s.id!==seat).map(s=>s.id):[to],responses:{}};p.view.choices=peer===seat?[{type:'TRADE_CANCEL'}]:[{type:'TRADE_ACCEPT'},{type:'TRADE_DECLINE'}];
              }
              if(body.action.type==='BANK_TRADE'){
                const {give,receive}=body.action,actor=p.view.state.players.players.find(s=>s.id===seat);actor.resourceCount+=receive.amount-give.amount;if(peer===seat){actor.resources[give.resource]-=give.amount;actor.resources[receive.resource]+=receive.amount;}
              }
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
      await route.fulfill({headers,json:reply?.ok?{...reply,inviteToken:'fixture-token'}:reply||error('bad_request')});
    });
  }
  return {attach,get creates(){return creates;},get accepted(){return accepted;},get commands(){return commands;},get authCalls(){return authCalls;},get current(){return current;}};
}
