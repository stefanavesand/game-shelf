import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}}
for(const dir of ['play','prototype','ui','scripts','tests'])await check(dir);
JSON.parse(await readFile('package.json','utf8'));JSON.parse(await readFile('package-lock.json','utf8'));
console.log('Source syntax and package manifests checked.');
