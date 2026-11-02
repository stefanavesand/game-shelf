import {readdir,readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}}
for(const dir of ['play','prototype','ui','scripts','tests'])await check(dir);
JSON.parse(await readFile('package.json','utf8'));JSON.parse(await readFile('package-lock.json','utf8'));
async function links(file){
  const text=await readFile(file,'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    const target=match[1];if(/^(https?:|mailto:|#)/.test(target))continue;
    const relative=target.split('#')[0];if(!relative)continue;
    try{await access(path.resolve(path.dirname(file),relative));}catch{throw new Error(`Broken documentation link in ${file}: ${target}`);}
  }
}
async function docs(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await docs(file);else if(file.endsWith('.md'))await links(file);}}
await docs('docs');for(const file of ['README.md','PRD.md','AGENTS.md','SOURCE_PROVENANCE.md','THIRD_PARTY_NOTICES.md'])await links(file);
console.log('Source syntax, package manifests and documentation links checked.');
