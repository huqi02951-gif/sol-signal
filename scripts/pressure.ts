import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {Store} from '../packages/storage/src/index';
import {Rpc} from '../apps/worker/src/rpc';
// Synthetic transport only. No mainnet requests and no fabricated LIVE latency report.
const original=globalThis.fetch;
async function run(concurrency:number){
 const db=new Store(':memory:');let inFlight=0,maxInFlight=0;const processed=new Set<string>();
 globalThis.fetch=async(_url,options)=>{const req=JSON.parse(String(options?.body));inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(r=>setTimeout(r,20));inFlight--;return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result:req.params[0]}),{status:200,headers:{'Content-Type':'application/json'}});};
 const count=200;for(let i=0;i<count;i++)db.enqueue({signature:'SYNTHETIC-'+i,slot:i,seen:Date.now(),source:'wallet',provenance:'DEMO'});
 const rpc=new Rpc('https://synthetic.invalid',db,5,1000,{concurrency});const start=performance.now();const durations:number[]=[];
 while(db.jobCount()){
  await Promise.all(db.jobs().map(async j=>{const a=performance.now();const signature=await rpc.call<string>('getTransaction',[j.signature]);processed.add(signature);db.saveRaw(signature,j.slot,Date.now(),{synthetic:true});durations.push(performance.now()-a);}));
 }
 durations.sort((a,b)=>a-b);const result={concurrency,startIntervalMs:5,simulatedTransportMs:20,intakeBurst:count,processed:processed.size,remaining:db.jobCount(),durationMs:performance.now()-start,maxInFlight,rpcCompletedP95Ms:durations[Math.ceil(durations.length*.95)-1],rawRows:db.raw(1000).length};db.close();return result;
}
try{const serial=await run(1),parallel=await run(2);const report={label:'SYNTHETIC LOAD; not production/mainnet latency',generatedAt:new Date().toISOString(),sameRateLimit:true,serial,parallel,warning:'production default remains 500ms between request starts; a 200-event burst at 2 RPS requires at least about 100 seconds, before retries'};writeFileSync('docs/PRESSURE_REPORT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(parallel.processed!==200||parallel.remaining!==0||parallel.maxInFlight>2)process.exitCode=1;}finally{globalThis.fetch=original;}
