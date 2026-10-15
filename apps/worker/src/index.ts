import 'dotenv/config';
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import {Store,type Job} from '../../../packages/storage/src/index';
import {WALLETS,type Swap} from '../../../packages/shared/src/index';
import {recordTransfers,analyzeFunding} from '../../../packages/graph/src/index';
import {PROGRAMS} from './parser';
import {processFetched} from './processor';
import {Watches} from './watches';
import {Market,type CoverageEvidence} from '../../../packages/market/src/index';
import {reconcile} from './reconcile';
import {readKnownHoldings} from './holdings';
import {Rpc} from './rpc';
import {dispatchable,liveJob,archiveAllowed} from './dispatch';
import {resolveLifecycle} from './lifecycle';
import {backfillAddress} from './backfill';
import {subscriptionPlan} from './subscriptions';
const candidateEnabled=process.env.CANDIDATE_POOL_MONITORING==='true';
const store=new Store();
const key=process.env.HELIUS_API_KEY;
const rpcBudget=Number(process.env.RPC_DAILY_REQUEST_LIMIT||20000);
const rpc=new Rpc(key?`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`:process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',store,Number(process.env.RPC_REQUEST_INTERVAL_MS||500),rpcBudget,{backupUrl:process.env.SOLANA_BACKUP_RPC_URL,concurrency:2});
const watches=new Watches(store,4,Number(process.env.CANDIDATE_WATCH_SECONDS||300)*1000);
const market=new Market(rpc,{jupiterKey:process.env.JUPITER_API_KEY,circulationFile:process.env.CIRCULATION_FILE});
const auditUrl=process.env.AUDIT_RPC_URL;
const primaryUrl=key?'https://mainnet.helius-rpc.com':process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
const independent=auditUrl&&new URL(auditUrl).hostname!==new URL(primaryUrl).hostname?new Rpc(auditUrl,store,1500,2000,{usageKey:'auditRpcUsage'}):null;
store.set('monitorRunStartedAt',Date.now());
const wsUrl=key?`wss://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`:process.env.SOLANA_WS_URL||'wss://api.mainnet-beta.solana.com';
let socket:WebSocket|undefined,stopping=false,attempt=0,requestId=1,lastPong=0,openedAt=0,lastSlotAt=0,slot=0,reconnectTimer:ReturnType<typeof setTimeout>|undefined;
const requested=new Map<number,string>();const active=new Map<number,string>();const addresses=new Set(WALLETS);
let connected=false,backfilling=false,gap=false,lastError:string|null=null;
function healthy(){return connected&&WALLETS.every(w=>[...active.values()].includes(w))&&Date.now()-lastSlotAt<30000&&!gap&&!lastError&&store.jobCount([...addresses])<100;}
function plan(){const rows=watches.list();return subscriptionPlan(rows,candidateEnabled,store.jobCount(WALLETS),rows.length?store.jobCount(rows.map(w=>w.pool)):0,rpc.stats().primaryCoolingDown);}
function report(){const poolPlan=plan();const quotes=watches.list().map(w=>store.get<import('../../../packages/shared/src/index').Quote|null>('quote:'+w.mint,null));const entryReady=healthy()&&candidateEnabled&&!poolPlan.candidatePausedReason&&quotes.some(q=>q?.coverageComplete&&Date.now()-q.time<15000&&(()=>{const e=store.lifecycle(q.mint,'LIVE');return !!e&&e.time<=Date.now()&&Date.now()-e.time<=store.settings().value.entryMaxAgeSeconds*1000;})());store.set('health',{connected,subscriptions:[...active.values()].filter(x=>x!=='slot'),walletSubscriptions:[...active.values()].filter(x=>WALLETS.includes(x)).length,slot,lastSlotAt,heartbeat:Date.now(),backfilling,gap,lastError,queue:store.jobCount([...addresses]),deferredQueue:store.jobCount()-store.jobCount([...addresses]),rpcScheduler:rpc.stats(),candidatePoolMonitoring:candidateEnabled,candidatePausedReason:poolPlan.candidatePausedReason,modelCalls:0,provider:key?'Helius standard':'Solana public',monitorEnabled:store.get('monitorEnabled',true),entryReady,entryBlockedReason:entryReady?null:'verified launch/migration time, circulation, executable quote, complete pool/window evidence or queue health missing',watches:watches.list(),waitingTokens:watches.waiting(),queueAlarm:store.jobCount([...addresses])>=100?'CONGESTED':null,oldestPendingAt:store.db.prepare('SELECT min(seen) t FROM jobs').get()?.t??null,reconciliation:store.get('reconciliation',null)});}
function syncWatches(){
 const wanted=new Set(plan().addresses);
 for(const a of addresses)if(!wanted.has(a)){addresses.delete(a);const sub=[...active].find(([,address])=>address===a);if(sub&&socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({jsonrpc:'2.0',id:requestId++,method:'logsUnsubscribe',params:[sub[0]]}));active.delete(sub[0]);}}
 for(const a of wanted){addresses.add(a);subscribe(a);}
}

let lastFaultAt=0;function fault(reason:string){const repeat=lastError===reason&&Date.now()-lastFaultAt<60000;lastError=reason;if(repeat){report();return;}lastFaultAt=Date.now();store.event({id:randomUUID(),kind:'worker_error',time:Date.now(),provenance:'LIVE',detail:{reason}});report();}
function subscribe(address:string){if(!socket||socket.readyState!==WebSocket.OPEN||[...requested.values(),...active.values()].includes(address))return;const id=requestId++;requested.set(id,address);socket.send(JSON.stringify({jsonrpc:'2.0',id,method:address==='slot'?'slotSubscribe':'logsSubscribe',params:address==='slot'?[]:[{mentions:[address]},{commitment:'confirmed'}]}));}
function connect(){
 if(stopping||!store.get('monitorEnabled',true))return;
 active.clear();requested.clear();connected=false;report();
 socket=new WebSocket(wsUrl,{handshakeTimeout:15000,maxPayload:4*1024*1024});
 socket.on('open',()=>{connected=true;attempt=0;openedAt=Date.now();lastPong=Date.now();lastSlotAt=0;for(const a of addresses)subscribe(a);subscribe('slot');report();});
 socket.on('pong',()=>{lastPong=Date.now();});
 socket.on('message',data=>{
  try{
   const msg=JSON.parse(data.toString());
   if(msg.id){const a=requested.get(msg.id);if(a){requested.delete(msg.id);if(msg.error){fault('subscription rejected');socket?.close();}else if(typeof msg.result==='number'){active.set(msg.result,a);report();}}return;}
   if(msg.method==='slotNotification'){slot=msg.params.result.slot;lastSlotAt=Date.now();return;}
   if(msg.method!=='logsNotification')return;
   const result=msg.params.result;const source=active.get(msg.params.subscription);if(!source)return;
   store.receipt(result.value.signature,source,Date.now(),result.context.slot);
   if(result.value.err){store.event({id:result.value.signature+':failed',kind:'failed_transaction',time:Date.now(),signature:result.value.signature,provenance:'LIVE',detail:{slot:result.context.slot}});return;}
   store.enqueue({signature:result.value.signature,slot:result.context.slot,seen:Date.now(),source,provenance:'LIVE'});
  }catch{fault('invalid websocket message');}
 });
 socket.on('error',()=>{fault('websocket connection error');});
 socket.on('close',()=>{connected=false;active.clear();report();if(!stopping)reconnectTimer=setTimeout(()=>{reconnectTimer=undefined;connect();},Math.min(30000,1000*2**Math.min(attempt++,5))+Math.random()*500);});
}
async function backfill(address:string){return backfillAddress(store,rpc,address,()=>stopping||!store.get('monitorEnabled',true));}
async function handle(job:Job){
 const tx=await rpc.call<unknown>('getTransaction',[job.signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}],job.source.startsWith('backfill:')||Date.now()-job.seen>15000?'background':'live');
 if(!tx){store.retry(job);if(job.attempts===4)fault('transaction unavailable; retry retained');return;}
 processFetched(store,job,tx,Date.now(),watches,healthy()&&candidateEnabled&&!plan().candidatePausedReason);syncWatches();
}
const runningJobs=new Map<string,boolean>();let lastArchiveAt=0;function drain(){if(stopping||!store.get('monitorEnabled',true))return;
 const jobs=store.jobs([...addresses]);
 if(![...runningJobs.values()].includes(false)&&archiveAllowed(store.jobCount([...addresses]),store.get('rpcUsage',{day:'',count:0}),rpcBudget,lastArchiveAt)){const archived=store.jobs().find(j=>!runningJobs.has(j.signature)&&!liveJob(j));if(archived){jobs.push(archived);lastArchiveAt=Date.now();}}
 for(const job of dispatchable(jobs,runningJobs)){
  runningJobs.set(job.signature,liveJob(job));
  void handle(job).catch(e=>{store.retry(job);const message=e instanceof Error&&/^RPC |^daily RPC/.test(e.message)?e.message:'transaction fetch/parse failed';fault(message+'; durable retry scheduled');}).finally(()=>{runningJobs.delete(job.signature);report();});
 }
}

let scanning=false;async function scan(){if(scanning||stopping||!store.get('monitorEnabled',true))return;scanning=true;backfilling=true;report();try{for(const a of addresses){if(stopping||!store.get('monitorEnabled',true))break;await backfill(a);}gap=[...addresses].some(a=>store.get('backfillProgress:'+a,null)!==null);if(gap)lastError='history coverage gap; paginated recovery continuing';else lastError=null;}catch(e){const message=e instanceof Error&&/^RPC |^daily RPC/.test(e.message)?e.message:'backfill RPC unavailable';fault(message);}finally{scanning=false;backfilling=false;report();}}
let checking=false;async function finalize(){if(checking||stopping)return;checking=true;try{const swaps=store.swaps(500).filter(s=>s.commitment==='confirmed'&&s.provenance!=='DEMO');const signatures=[...new Set(swaps.map(s=>s.signature))].slice(0,100);if(!signatures.length)return;const statuses=await rpc.call<{value:Array<{err:unknown;confirmationStatus:string}|null>}>('getSignatureStatuses',[signatures,{searchTransactionHistory:true}]);statuses.value.forEach((s,i)=>{if(s?.err||s?.confirmationStatus==='finalized')store.finalize(signatures[i],!!s.err);});}catch{fault('finality check unavailable');}finally{checking=false;}}
function graph(){const rows=store.db.prepare("SELECT key,value FROM kv WHERE key LIKE 'graph:%' LIMIT 10").all();const blocked=new Set([...PROGRAMS,...addresses].filter(a=>!WALLETS.includes(a)).concat((process.env.GRAPH_BLOCKED_ADDRESSES||'').split(',').filter(Boolean)));for(const row of rows){const g=JSON.parse(String(row.value));recordTransfers(store,g.signature,g.time,g.transfers,blocked,g.provenance);store.db.prepare('DELETE FROM kv WHERE key=?').run(String(row.key));}store.set('fundingAnalysis',analyzeFunding(store.relations(),WALLETS,store.settings().value.publicServices.map(a=>a.address)));}
// Candidate windows are bounded; open position pools remain pinned across restart.
for(const a of plan().addresses)addresses.add(a);
let pricing=false;async function refreshMarket(){if(pricing||stopping||!store.get('monitorEnabled',true))return;pricing=true;try{for(const w of watches.list()){const position=store.positions().find(p=>p.mint===w.mint&&p.provenance==='LIVE'&&p.status==='open')??null;const coverage=store.get<CoverageEvidence|null>('coverage:'+w.mint,null);const result=await market.observe(w.mint,store.settings().value.paperBuySizeSol,slot,coverage,position);store.set('market:'+w.mint,result);store.set('quote:'+w.mint,result.quote);if(position&&result.quote)store.markQuote(result.quote);}}finally{pricing=false;report();}}
let lifecycleBusy=false;async function refreshLifecycle(){if(lifecycleBusy||stopping||!healthy()||!store.get('monitorEnabled',true))return;lifecycleBusy=true;try{
 const now=Date.now();const tokens=Object.values(store.get<Record<string,{mint:string;pool:string;protocol:string;lastBuyAt?:number}>>('tokens',{}));
 for(const t of tokens){const lookup=store.get<{checkedAt:number;attempts:number;pool?:string}>('lifecycleAttempts:'+t.mint,{checkedAt:0,attempts:0});if(!t.lastBuyAt||now-t.lastBuyAt>300000||now-lookup.checkedAt<60000||lookup.attempts>=3)continue;const known=store.lifecycle(t.mint,'LIVE');if(known&&(t.protocol!=='pumpswap'||known.kind==='migration'))continue;
  store.set('lifecycleAttempts:'+t.mint,{checkedAt:now,attempts:lookup.attempts+1});await resolveLifecycle(store,rpc,t.mint,t.pool,t.protocol==='pumpswap',now);break;
 }
}catch{fault('launch/migration proof lookup unavailable; entry remains blocked');}finally{lifecycleBusy=false;}}
let readingHoldings=false;async function holdings(){if(readingHoldings||stopping||!healthy())return;readingHoldings=true;try{for(const w of watches.list()){const owners=[...WALLETS,...store.settings().value.excluded.map(x=>x.address)].filter(a=>!store.settings().value.publicServices.some(p=>p.address===a));store.set('holdings:'+w.mint,await readKnownHoldings(rpc,w.mint,owners));}}finally{readingHoldings=false;}}
let auditing=false;async function audit(){if(auditing||stopping)return;auditing=true;try{await reconcile(store,independent,auditUrl?'independent RPC':'not configured');}finally{auditing=false;}}

connect();void scan();void audit();
const timers=[setInterval(()=>{const enabled=store.get('monitorEnabled',true);if(!enabled&&connected)socket?.close();if(enabled&&!connected&&!reconnectTimer&&socket?.readyState!==WebSocket.CONNECTING)connect();if(connected&&socket){if(Date.now()-lastPong>60000||Date.now()-(lastSlotAt||openedAt)>60000){fault('websocket heartbeat stale');socket.terminate();}else socket.ping();}report();syncWatches();},10000),setInterval(()=>void drain(),1000),setInterval(()=>void scan(),60000),setInterval(()=>void finalize(),30000),setInterval(graph,5000),setInterval(()=>void refreshMarket(),10000),setInterval(()=>void audit(),900000),setInterval(()=>void holdings(),60000),setInterval(()=>void refreshLifecycle(),15000)];
function shutdown(){stopping=true;timers.forEach(clearInterval);if(reconnectTimer)clearTimeout(reconnectTimer);socket?.close();store.set('health',{...store.get('health',{}),connected:false,heartbeat:Date.now(),lastError:'worker stopped'});setTimeout(()=>process.exit(0),1000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
console.log('SOL SIGNAL worker started: read-only PAPER mode; keys are not logged.');
