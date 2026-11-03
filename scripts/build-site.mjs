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
    else if(entry.isFile()&&/\.(html|css|js)$/.test(name))files.push(name);
  }
}
files.push('index.html');for(const folder of ['play','ui','prototype'])await collect(folder);
files.sort();
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const manifest={schemaVersion:1,commit:process.env.GITHUB_SHA||'local',files:[]};
for(const name of files){
  const bytes=await readFile(path.join(root,name));await mkdir(path.dirname(path.join(output,name)),{recursive:true});await writeFile(path.join(output,name),bytes);
  manifest.files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(output,'.nojekyll'),'');
await writeFile(path.join(output,'site-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Packaged ${files.length} allowlisted app assets for ${manifest.commit}. Tests, documentation, dependencies and environment files are excluded.`);
