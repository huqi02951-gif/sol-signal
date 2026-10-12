import 'dotenv/config';
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import {Store,type Job} from '../../../packages/storage/src/index';
import {WALLETS,type Swap} from '../../../packages/shared/src/index';
import {recordTransfers} from '../../../packages/graph/src/index';
import {parseTransaction,PROGRAMS} from './parser';
import {Rpc} from './rpc';
const store=new Store();
const key=process.env.HELIUS_API_KEY;
const rpc=new Rpc(key?`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`:process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',store,Number(process.env.RPC_REQUEST_INTERVAL_MS||500),Number(process.env.RPC_DAILY_REQUEST_LIMIT||20000));
const wsUrl=key?`wss://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`:process.env.SOLANA_WS_URL||'wss://api.mainnet-beta.solana.com';
let socket:WebSocket|undefined,stopping=false,attempt=0,requestId=1,lastPong=0,openedAt=0,lastSlotAt=0,slot=0,reconnectTimer:ReturnType<typeof setTimeout>|undefined;
const requested=new Map<number,string>();const active=new Map<number,string>();const addresses=new Set(WALLETS);
let connected=false,backfilling=false,gap=false,lastError:string|null=null;
function report(){store.set('health',{connected,subscriptions:[...active.values()].filter(x=>x!=='slot'),walletSubscriptions:[...active.values()].filter(x=>WALLETS.includes(x)).length,slot,lastSlotAt,heartbeat:Date.now(),backfilling,gap,lastError,queue:store.jobCount([...addresses]),deferredQueue:store.jobCount()-store.jobCount([...addresses]),provider:key?'Helius standard':'Solana public',monitorEnabled:store.get('monitorEnabled',true),entryReady:false,entryBlockedReason:'circulating supply, executable quote and complete pool coverage are not yet validated'});}
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
   if(result.value.err){store.event({id:result.value.signature+':failed',kind:'failed_transaction',time:Date.now(),signature:result.value.signature,provenance:'LIVE',detail:{slot:result.context.slot}});return;}
   store.enqueue({signature:result.value.signature,slot:result.context.slot,seen:Date.now(),source,provenance:'LIVE'});
  }catch{fault('invalid websocket message');}
 });
 socket.on('error',()=>{fault('websocket connection error');});
 socket.on('close',()=>{connected=false;active.clear();report();if(!stopping)reconnectTimer=setTimeout(()=>{reconnectTimer=undefined;connect();},Math.min(30000,1000*2**Math.min(attempt++,5))+Math.random()*500);});
}
interface Sig {signature:string;slot:number;blockTime:number|null;err:unknown}
async function backfill(address:string){
 const cursor=store.get<string|null>('cursor:'+address,null);let before:string|undefined;let found=!cursor;const list:Sig[]=[];
 for(let page=0;page<10;page++){if(stopping||!store.get('monitorEnabled',true))return;
  const rows=await rpc.call<Sig[]>('getSignaturesForAddress',[address,{limit:cursor?100:10,...(before?{before}:{}),...(cursor?{until:cursor}:{})}]);
  list.push(...rows);if(!cursor||rows.length<100){found=true;break;}before=rows.at(-1)!.signature;
 }
 if(!found){gap=true;fault('history backfill capped; coverage gap requires deeper history replay');return;}
 // Enqueue before cursor advancement; queued work survives restart.
 store.transaction(()=>{for(const row of [...list].reverse())if(!row.err)store.enqueue({signature:row.signature,slot:row.slot,seen:Date.now(),source:'backfill:'+address,provenance:cursor?'LIVE':'HISTORY'});if(list.length)store.set('cursor:'+address,list[0].signature);});
 store.set('backfill:'+address,{checkedAt:Date.now(),count:list.length,firstScan:!cursor});
}
async function handle(job:Job){
 const tx=await rpc.call<unknown>('getTransaction',[job.signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]);
 if(!tx){store.retry(job);if(job.attempts===4)fault('transaction unavailable; retry retained');return;}
 const parsed=parseTransaction(tx,job.provenance,job.seen);if((tx as {transaction:{signatures:string[]}}).transaction.signatures[0]!==job.signature)throw new Error('RPC signature mismatch');
 // Apply before marking the durable job complete: retries deduplicate committed swaps.
 for(const swap of parsed.swaps)store.apply({...swap,ingestion:job.source.startsWith('backfill:')?'backfill':'websocket'},null,false);
 for(const p of parsed.pools){if(store.positions().some(x=>x.mint===p.mint&&x.provenance==='LIVE'&&x.status==='open')){addresses.add(p.pool);subscribe(p.pool);}const tokens=store.get<Record<string,unknown>>('tokens',{});tokens[p.mint]={...p,updatedAt:Date.now(),sourceSignature:job.signature,provenance:job.provenance,coverage:'partial',marketCapUsd:null};store.set('tokens',tokens);}
 store.transaction(()=>{
  store.saveRaw(job.signature,job.slot,Date.now(),tx);
  store.event({id:job.signature+':parsed',kind:'transaction',time:job.seen,signature:job.signature,provenance:job.provenance,detail:{slot:job.slot,reason:parsed.reason,buys:parsed.swaps.length,source:job.source.replace(/^backfill:/,''),ingestion:job.source.startsWith('backfill:')?'backfill':'websocket',blockTime:(tx as {blockTime:number|null}).blockTime}});
 });
 // Slow graph tasks are drained outside swap processing.
 store.set('graph:'+job.signature,{signature:job.signature,time:(tx as {blockTime:number|null}).blockTime?Number((tx as {blockTime:number}).blockTime)*1000:job.seen,transfers:parsed.transfers,provenance:job.provenance});
}
let busy=false;async function drain(){if(busy||stopping||!store.get('monitorEnabled',true))return;busy=true;try{for(const job of store.jobs([...addresses])){if(stopping||!store.get('monitorEnabled',true))break;try{await handle(job);}catch(e){store.retry(job);const message=e instanceof Error&&/^RPC |^daily RPC/.test(e.message)?e.message:'transaction fetch/parse failed';fault(message+'; durable retry scheduled');}}}finally{busy=false;report();}}
let scanning=false;async function scan(){if(scanning||stopping||!store.get('monitorEnabled',true))return;scanning=true;backfilling=true;report();try{for(const a of addresses){if(stopping||!store.get('monitorEnabled',true))break;await backfill(a);}lastError=null;}catch{fault('backfill RPC unavailable or budget exhausted');}finally{scanning=false;backfilling=false;report();}}
let checking=false;async function finalize(){if(checking||stopping)return;checking=true;try{const swaps=store.swaps(500).filter(s=>s.commitment==='confirmed'&&s.provenance!=='DEMO');const signatures=[...new Set(swaps.map(s=>s.signature))].slice(0,100);if(!signatures.length)return;const statuses=await rpc.call<{value:Array<{err:unknown;confirmationStatus:string}|null>}>('getSignatureStatuses',[signatures,{searchTransactionHistory:true}]);statuses.value.forEach((s,i)=>{if(s?.err||s?.confirmationStatus==='finalized')store.finalize(signatures[i],!!s.err);});}catch{fault('finality check unavailable');}finally{checking=false;}}
function graph(){const rows=store.db.prepare("SELECT key,value FROM kv WHERE key LIKE 'graph:%' LIMIT 10").all();const blocked=new Set([...PROGRAMS,...addresses].filter(a=>!WALLETS.includes(a)).concat((process.env.GRAPH_BLOCKED_ADDRESSES||'').split(',').filter(Boolean)));for(const row of rows){const g=JSON.parse(String(row.value));recordTransfers(store,g.signature,g.time,g.transfers,blocked,g.provenance);store.db.prepare('DELETE FROM kv WHERE key=?').run(String(row.key));}}
// Restore only open-position pools. Candidate history is not a mandate to stream all pools.
const tokens=store.get<Record<string,{pool:string}>>('tokens',{});
for(const position of store.positions())if(position.provenance==='LIVE'&&position.status==='open'&&tokens[position.mint])addresses.add(tokens[position.mint].pool);

connect();void scan();
const timers=[setInterval(()=>{const enabled=store.get('monitorEnabled',true);if(!enabled&&connected)socket?.close();if(enabled&&!connected&&!reconnectTimer&&socket?.readyState!==WebSocket.CONNECTING)connect();if(connected&&socket){if(Date.now()-lastPong>60000||Date.now()-(lastSlotAt||openedAt)>60000){fault('websocket heartbeat stale');socket.terminate();}else socket.ping();}report();},10000),setInterval(()=>void drain(),1000),setInterval(()=>void scan(),60000),setInterval(()=>void finalize(),30000),setInterval(graph,5000)];
function shutdown(){stopping=true;timers.forEach(clearInterval);if(reconnectTimer)clearTimeout(reconnectTimer);socket?.close();store.set('health',{...store.get('health',{}),connected:false,heartbeat:Date.now(),lastError:'worker stopped'});setTimeout(()=>process.exit(0),1000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
console.log('SOL SIGNAL worker started: read-only PAPER mode; keys are not logged.');
