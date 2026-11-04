import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
// Worker-only releases must never stage downloads into the active app's cache.
export const offlineVersion=(assets,workerTemplate)=>sha(JSON.stringify({assets,workerTemplateSha256:sha(workerTemplate)}));
