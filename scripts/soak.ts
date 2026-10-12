import 'dotenv/config';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Store} from '../packages/storage/src/index';
import {summarizeTimings} from '../packages/shared/src/telemetry';
const store=new Store();const start=Date.now();const targetMs=72*60*60*1000;
let last=start,samples=0,observedMs=0,consecutiveMs=0,gapMs=0,unhealthySamples=0;
const id=new Date(start).toISOString().replaceAll(':','-');mkdirSync('data/soak',{recursive:true});
function sample(){
 const now=Date.now(),elapsed=now-last;const h=store.get<Record<string,unknown>>('health',{});const fresh=now-Number(h.heartbeat||0)<30000;const healthy=fresh&&h.connected===true&&Number(h.walletSubscriptions)===3&&!h.gap&&!h.lastError;
 samples++;if(elapsed>90000||elapsed<0){gapMs+=Math.max(elapsed,0);consecutiveMs=0;}else {observedMs+=elapsed;consecutiveMs+=elapsed;}if(!healthy)unhealthySamples++;
 const reconciliation=store.get<Record<string,unknown>>('reconciliation',{});
 const report={runId:id,startedAt:start,lastSampleAt:now,targetHours:72,elapsedMs:now-start,observedMs,consecutiveObservedMs:consecutiveMs,gapMs,samples,unhealthySamples,subscriptionHealthy:healthy,health:h,latencies:summarizeTimings(store.timings()),reconciliation,realPaperEntries:store.positionHistory().filter(p=>p.provenance==='LIVE').length,status:consecutiveMs>=targetMs?'observation_window_complete':'running',passed:false,reason:'72h continuous observation, independent reconciliation and real PAPER evidence must all be evaluated; running is not acceptance'};
 store.set('soak',report);writeFileSync('data/soak/'+id+'.json',JSON.stringify(report,null,2));last=now;
 if(consecutiveMs>=targetMs){clearInterval(timer);store.close();console.log('72h observation window reached; report requires acceptance review.');}
}
const timer=setInterval(sample,60000);sample();
function stop(){clearInterval(timer);store.set('soak',{...store.get('soak',{}),status:'interrupted',stoppedAt:Date.now(),passed:false});store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);console.log('72h PAPER read-only soak collector started; does not prevent computer sleep.');
