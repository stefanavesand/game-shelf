import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),dist=new URL('dist/',root),manifest=JSON.parse(await readFile(new URL('site-manifest.json',dist),'utf8'));
test('the public package includes required entrypoints and excludes development/private files',async()=>{
  const paths=manifest.files.map(f=>f.path);
  for(const required of ['index.html','play/index.html','play/app.js','play/core/client.js','prototype/index.html','ui/art.js'])assert.ok(paths.includes(required),required);
  for(const name of paths)assert.match(name,/^(index\.html|(?:play|ui|prototype)\/[a-zA-Z0-9_./-]+\.(?:html|css|js|svg|webmanifest))$/);
  const actual=[];
  async function walk(relative=''){for(const entry of await readdir(new URL(relative,dist),{withFileTypes:true})){assert.equal(entry.isSymbolicLink(),false);const name=relative+entry.name;if(entry.isDirectory())await walk(name+'/');else actual.push(name);}}
  await walk();assert.deepEqual(actual.sort(),[...paths,'.nojekyll','site-manifest.json'].sort());
  assert.equal(manifest.commit,process.env.GITHUB_SHA||'local');
});
test('every packaged asset and manifest hash matches the source tested in this run',async()=>{
  for(const file of manifest.files){const bytes=await readFile(new URL(file.path,dist));assert.deepEqual(bytes,await readFile(new URL(file.path,root)),file.path);assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
});

test('offline version includes the worker template and the generated worker matches its manifest',async()=>{
 const {offlineVersion}=await import('../../scripts/offline-version.mjs');
 const script=await readFile(new URL('play/offline-assets.js',dist),'utf8'),template=await readFile(new URL('scripts/sw-template.js',root),'utf8');
 const assets=JSON.parse(script.match(/self\.OFFLINE_ASSETS=(\[.*\]);/)[1]),version=JSON.parse(script.match(/self\.OFFLINE_VERSION=("[^"]*")/)[1]);
 assert.equal(version,offlineVersion(assets,template));assert.notEqual(version,offlineVersion(assets,template+'\n// changed worker'));
 assert.equal(await readFile(new URL('play/sw.js',dist),'utf8'),template.replace('__OFFLINE_SCRIPT_SHA__',createHash('sha256').update(script).digest('hex')));
});
