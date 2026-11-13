// Explicit browser runtime assets; no Node experiment controller is published.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {hash,validateProfile} from './profiles.mjs';
export async function preparePlanner(root=fileURLToPath(new URL('../../',import.meta.url))){
 const files=['planner-policy.mjs','resource-policy.mjs','trade-policy.mjs','shared-plan-policy.mjs','build-trade-policy.mjs','build-trade-components.mjs','baselines/heuristic-1.1.0.js'];
 for(const name of files){const source=await readFile(path.join(root,'scripts/bots',name),'utf8'),target=path.join(root,'play/bots/policies',name.replace(/\.mjs$/,'.js'));
  const output=source.replace(/(from\s+['"][^'"]+)\.mjs(['"])/g,'$1.js$2').replaceAll('../../play/','../../');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,output);
 }
 const profile=validateProfile(JSON.parse(await readFile(path.join(root,'experiments/bots/counter-on.json'),'utf8')));
 await writeFile(path.join(root,'play/bots/profile.js'),'// Generated from the tested, fixed counter-on experiment profile.\nexport const profile='+JSON.stringify(profile)+';\nexport const profileHash='+JSON.stringify(hash(profile))+';\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await preparePlanner();
