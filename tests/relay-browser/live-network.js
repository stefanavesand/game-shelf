// Real HTTPS egress for managed executors. No fake responses or TLS bypass.
export async function configureLiveEgress(contexts) {
 if(process.env.GAME_SHELF_RELAY_NODE_PROXY!=='1')return;
 for(const context of contexts)await context.route(/^https:\/\//,async route=>{
  const req=route.request();try{
   const response=await fetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})});
   const headers=Object.fromEntries(response.headers);for(const name of ['content-encoding','content-length','transfer-encoding'])delete headers[name];
   await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
  }catch{await route.abort();}
 });
}
