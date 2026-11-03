import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const prefix='/game-shelf/';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/'||pathname==='/game-shelf/'){res.writeHead(302,{location:prefix+'play/#home'});res.end();return;}
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
    const relative=decodeURIComponent(pathname.slice(prefix.length));
    if(!/^(prototype|play|ui)\//.test(relative)||!(/\.(html|css|js)$/.test(relative)||relative.endsWith('/'))){res.writeHead(404);res.end('Not found');return;}
    const target=path.resolve(root,relative.endsWith('/')?relative+'index.html':relative);
    if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
    const body=await readFile(target);res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PROTOTYPE_PORT||4176),'127.0.0.1',()=>console.log(`Prototype: http://127.0.0.1:${process.env.PROTOTYPE_PORT||4176}${prefix}`));
