import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),dist=new URL('dist/',root),manifest=JSON.parse(await readFile(new URL('site-manifest.json',dist),'utf8'));
test('the public package includes required entrypoints and excludes development/private files',async()=>{
  const paths=manifest.files.map(f=>f.path);
  for(const required of ['index.html','recovery/index.html','recovery/recovery.js','play/index.html','play/app.js','play/core/client.js','prototype/index.html','ui/art.js','diagnostics/bots/index.html','diagnostics/bots/worker.js','diagnostics/bots/fixtures.js'])assert.ok(paths.includes(required),required);
  for(const name of paths)assert.match(name,/^(index\.html|(?:play|ui|prototype|recovery|diagnostics\/bots)\/[a-zA-Z0-9_./-]+\.(?:html|css|js|svg|png|webp|webmanifest))$/);
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

test('non-breaking releases retain compatibility identity while breaking is explicit and repeatable',async()=>{
 const {releasePolicy}=await import('../../scripts/release-policy.mjs'),base={version:'1.0.0',compatibilityId:'a'.repeat(64)};
 assert.equal(releasePolicy(base).breaking,false);assert.equal(releasePolicy(base).compatibilityId,base.compatibilityId);
 const breaking=releasePolicy({...base,breaking:true});assert.notEqual(breaking.compatibilityId,base.compatibilityId);assert.deepEqual(releasePolicy(breaking),breaking);assert.equal(releasePolicy({...breaking,version:'1.0.1',breaking:false}).compatibilityId,breaking.compatibilityId);assert.throws(()=>releasePolicy({...base,breaking:'false'}));
});

test('install icons are correctly sized PNGs shipped in the verified offline package',async()=>{
 const appManifest=JSON.parse(await readFile(new URL('play/manifest.webmanifest',dist),'utf8'));
 assert.equal(appManifest.id,'./');assert.equal(appManifest.start_url,'./#home');
 const script=await readFile(new URL('play/offline-assets.js',dist),'utf8'),assets=JSON.parse(script.match(/self\.OFFLINE_ASSETS=(\[.*\]);/)[1]);
 const icons=[...appManifest.icons.map(i=>({path:'play/'+i.src.replace(/^\.\//,''),size:Number(i.sizes.split('x')[0])})),{path:'play/icons/apple-touch-icon.png',size:180},{path:'play/icons/favicon-32.png',size:32}];
 for(const {path,size} of icons){
  assert.ok(assets.some(a=>a.path===path),path+' must be available offline');
  const bytes=await readFile(new URL(path,dist));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 const html=await readFile(new URL('play/index.html',dist),'utf8');assert.match(html,/rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png"/);
});


test('diagnostic policies are explicitly packaged outside the PWA offline cache',async()=>{
 const names=manifest.files.map(f=>f.path).filter(p=>p.startsWith('diagnostics/'));
 assert.deepEqual(names.sort(),['app.js','fixtures.js','index.html','style.css','worker.js','policies/trade-policy.js','policies/planner-policy.js','policies/baselines/heuristic-1.1.0.js'].map(p=>'diagnostics/bots/'+p).sort());
 const offline=await readFile(new URL('play/offline-assets.js',dist),'utf8');assert.doesNotMatch(offline,/diagnostics\//);
 const baseline=await readFile(new URL('diagnostics/bots/policies/baselines/heuristic-1.1.0.js',dist),'utf8');assert.match(baseline,/MIT License/);
});

test('packaged browser policies reproduce every synthetic golden decision',async()=>{
 const {fixtures,metadata}=await import('../../dist/diagnostics/bots/fixtures.js');
 const {decision}=await import('../../dist/diagnostics/bots/policies/trade-policy.js');
 const {botDecision}=await import('../../dist/diagnostics/bots/policies/baselines/heuristic-1.1.0.js');
 assert.equal(fixtures.length,8);assert.equal(createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'),metadata.fixtureHash);
 for(const f of fixtures){
  assert.equal(JSON.stringify(decision(structuredClone(f.view),metadata.profile.parameters,f.seed)),f.expected.candidate,f.id);
  assert.equal(JSON.stringify({action:botDecision(structuredClone(f.view),'standard')}),f.expected.baseline,f.id);
 }
});
