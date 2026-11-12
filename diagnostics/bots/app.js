const $=id=>document.getElementById(id),status=$('status');
let active=null,report=null;
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
function stop(message){if(!active)return;const run=active;active=null;clearTimeout(run.timer);cancelAnimationFrame(run.frame);run.worker.terminate();$('start').disabled=false;$('cancel').disabled=true;status.textContent=message;}
function watch(run,message,ms=60000){clearTimeout(run.timer);run.timer=setTimeout(()=>stop(message),ms);}
$('cancel').onclick=()=>stop('Cancelled. Partial results are not reported as a pass.');
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('Stopped because the page became hidden. Run again in the foreground.');});
$('start').onclick=()=>{
 if(active||document.hidden)return;
 report=null;$('result').textContent='';$('download').disabled=true;$('start').disabled=true;$('cancel').disabled=false;$('progress').value=0;status.textContent='Loading worker and verifying synthetic fixtures…';
 if(!globalThis.Worker){$('start').disabled=false;$('cancel').disabled=true;status.textContent='Web Workers are unavailable in this browser.';return;}
 let worker;try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch{stop('Could not create the benchmark worker.');$('start').disabled=false;$('cancel').disabled=true;status.textContent='Could not create the benchmark worker.';return;}
 const run=active={worker,timer:null,frame:null,lastFrame:performance.now(),gaps:[],jobs:[],samples:[],cursor:0,sentAt:0};
 const frame=now=>{if(active!==run)return;run.gaps.push(now-run.lastFrame);run.lastFrame=now;run.frame=requestAnimationFrame(frame);};run.frame=requestAnimationFrame(frame);
 function next(){
  if(active!==run)return;
  if(run.cursor===run.jobs.length){
   const policies={};for(const policy of ['baseline','candidate']){const rows=run.samples.filter(s=>s.policy===policy);policies[policy]={decisionMs:stats(rows.map(s=>s.decisionMs)),roundTripMs:stats(rows.map(s=>s.roundTripMs))};}
   report={schemaVersion:1,createdAt:new Date().toISOString(),deviceNotes:$('notes').value.trim(),userAgent:navigator.userAgent,metadata:run.metadata,fixtureIds:run.fixtures,warmupRounds:1,measuredRounds:3,policies,animationFrameGapsMs:run.gaps.length?stats(run.gaps):null,memory:{measured:false,reason:'No portable per-worker incremental memory API; this is not a memory gate result.'},parity:true,samples:run.samples};
   $('result').textContent=JSON.stringify(report,null,2);$('download').disabled=false;$('progress').value=1;stop('Complete. All decisions matched the expected results. Download the report.');return;
  }
  const job=run.jobs[run.cursor];run.sentAt=performance.now();watch(run,'Stopped: a decision exceeded the 10-second diagnostic timeout.',10000);worker.postMessage({type:'decision',index:job.index,policy:job.policy,requestId:run.cursor});
 }
 worker.onerror=()=>{if(active===run)stop('Worker failed. Check the connection and reload this page.');};
 worker.onmessage=({data})=>{
  if(active!==run)return;
  if(data.type==='error'){stop('Failed: '+data.message);return;}
  if(data.type==='ready'){
   run.metadata=data.metadata;run.fixtures=data.fixtures;
   for(let round=0;round<4;round++)for(let index=0;index<data.fixtures.length;index++)for(const policy of round%2?['candidate','baseline']:['baseline','candidate'])run.jobs.push({index,policy,warmup:round===0});
   status.textContent='Running both policies in a worker. You can cancel at any time.';next();return;
  }
  if(data.type!=='decision'||data.requestId!==run.cursor){stop('Failed: unexpected worker response.');return;}
  const job=run.jobs[run.cursor];if(!job.warmup)run.samples.push({...data,roundTripMs:performance.now()-run.sentAt});
  run.cursor++;$('progress').value=run.cursor/run.jobs.length;next();
 };
 watch(run,'Could not load the benchmark within 60 seconds. Check the connection and try again.');worker.postMessage({type:'init'});
};
$('download').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='game-shelf-bot-benchmark.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
