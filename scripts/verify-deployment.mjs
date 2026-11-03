import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const expected=JSON.parse(await readFile(new URL('../dist/site-manifest.json',import.meta.url),'utf8'));
const base=new URL(process.env.GAME_SHELF_DEPLOYMENT_URL||'https://stefanavesand.github.io/game-shelf/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
async function get(relative){const url=new URL(relative,base);url.searchParams.set('release',expected.commit);const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw Error(`${relative}: HTTP ${r.status}`);return r;}
let error;
for(let attempt=0;attempt<12;attempt++){
  try{
    const published=await(await get('site-manifest.json')).json();
    if(published.commit!==expected.commit)throw Error('Pages is still serving an earlier release.');
    if(JSON.stringify(published.files)!==JSON.stringify(expected.files))throw Error('Published manifest differs from this tested source.');
    const pending=[...expected.files];
    await Promise.all(Array.from({length:5},async()=>{while(pending.length){const file=pending.shift(),bytes=new Uint8Array(await(await get(file.path)).arrayBuffer());if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error(`${file.path}: published content differs from tested source`);}}));
    console.log(`Verified ${expected.files.length} public assets for ${expected.commit}. No sign-in, room creation or game mutation was performed.`);process.exit(0);
  }catch(e){error=e;if(attempt<11)await new Promise(resolve=>setTimeout(resolve,5000));}
}
throw error;
