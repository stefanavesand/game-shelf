import {readdir,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {catanManifest} from './catan-manifest.mjs';
await catanManifest();
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'dist');
const files=[];
async function collect(relative){
  const entries=await readdir(path.join(root,relative),{withFileTypes:true});
  for(const entry of entries){
    const name=path.posix.join(relative,entry.name);
    if(entry.isSymbolicLink())throw Error(`Refusing a symbolic link in site assets: ${name}`);
    if(entry.isDirectory())await collect(name);
    else if(entry.isFile()&&/\.(html|css|js|svg|webmanifest)$/.test(name))files.push(name);
  }
}
files.push('play/sw.js','play/offline-assets.js','index.html');for(const folder of ['play','ui','prototype'])await collect(folder);
const unique=[...new Set(files)].sort();files.splice(0,files.length,...unique);
const offline=[];for(const name of files.filter(f=>/^(play|ui)\//.test(f)&&!['play/sw.js','play/offline-assets.js'].includes(f))){const bytes=await readFile(path.join(root,name));offline.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex')});}
const engine=await catanManifest({check:true}),version=createHash('sha256').update(JSON.stringify(offline)).digest('hex');
const offlineCode='// Generated during build.\nself.OFFLINE_VERSION='+JSON.stringify(version)+';self.OFFLINE_ENGINE='+JSON.stringify(engine.digest)+';self.OFFLINE_ASSETS='+JSON.stringify(offline)+';\n';
await writeFile(path.join(root,'play/offline-assets.js'),offlineCode);
const worker=(await readFile(path.join(root,'scripts/sw-template.js'),'utf8')).replace('__OFFLINE_SCRIPT_SHA__',createHash('sha256').update(offlineCode).digest('hex'));
await writeFile(path.join(root,'play/sw.js'),worker);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const manifest={schemaVersion:1,commit:process.env.GITHUB_SHA||'local',files:[]};
for(const name of files){
  const bytes=await readFile(path.join(root,name));await mkdir(path.dirname(path.join(output,name)),{recursive:true});await writeFile(path.join(output,name),bytes);
  manifest.files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(output,'.nojekyll'),'');
await writeFile(path.join(output,'site-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Packaged ${files.length} allowlisted app assets for ${manifest.commit}. Tests, documentation, dependencies and environment files are excluded.`);
