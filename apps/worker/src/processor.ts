import type {Job,Store} from '../../../packages/storage/src/index';
import {WALLETS,type Quote} from '../../../packages/shared/src/index';
import {parseTransaction} from './parser';
import type {Watches} from './watches';
export function processFetched(store:Store,job:Job,raw:unknown,rpcFetchedAt:number,watches:Watches,ready:boolean){
 job=store.job(job.signature)??job;
 const parsed=parseTransaction(raw,job.provenance,job.seen);const parsedAt=Date.now();
 if((raw as {transaction:{signatures:string[]}}).transaction.signatures[0]!==job.signature)throw new Error('RPC signature mismatch');
 const ingestion=job.source.startsWith('backfill:')?'backfill' as const:'websocket' as const;
 let signalAt:number|undefined;
 for(const swap of parsed.swaps){
  // Quotes are populated by a slow task. Protection never waits for network pricing calls.
  const quote=store.get<Quote|null>('quote:'+swap.mint,null);
  const evaluatedAt=Date.now();const d=store.apply({...swap,ingestion},quote,ready,evaluatedAt);
  if(d.kind==='entry'||d.kind==='exit')signalAt=Date.now();
  if(!WALLETS.includes(swap.owner))store.event({id:swap.id+':external-observation',kind:'buyer_observation',time:evaluatedAt,signature:swap.signature,provenance:swap.provenance,detail:{owner:swap.owner,mint:swap.mint,lamports:swap.lamports,buyerClass:swap.buyerClass,positionAction:d.kind,reason:d.reason}});
 }
 const decidedAt=Date.now();
 for(const p of parsed.pools){
  const tokens=store.get<Record<string,unknown>>('tokens',{});tokens[p.mint]={...p,updatedAt:decidedAt,sourceSignature:job.signature,provenance:job.provenance,coverage:'partial',marketCapUsd:null};store.set('tokens',tokens);
  if(job.provenance==='LIVE'&&parsed.swaps.some(s=>s.mint===p.mint&&WALLETS.includes(s.owner)&&decidedAt-s.time<=300000))watches.discover({...p,signature:job.signature,discoveredAt:decidedAt},decidedAt);
 }
 store.transaction(()=>{
  store.saveRaw(job.signature,job.slot,decidedAt,raw);
  store.event({id:job.signature+':parsed',kind:'transaction',time:job.seen,signature:job.signature,provenance:job.provenance,detail:{slot:job.slot,reason:parsed.reason,buys:parsed.swaps.length,source:job.source.replace(/^backfill:/,''),ingestion,blockTime:(raw as {blockTime:number|null}).blockTime,rpcFetchedAt,parsedAt,decidedAt}});
  const trace=store.get<{queuedAt:number;startedAt:number;headersAt:number}|null>('rpcTiming:'+job.signature,null);
  store.db.prepare('DELETE FROM kv WHERE key=?').run('rpcTiming:'+job.signature);
  store.timing({rpcQueuedAt:trace?.queuedAt,rpcStartedAt:trace?.startedAt,rpcHeadersAt:trace?.headersAt,signature:job.signature,provenance:job.provenance,ingestion,chainTime:(raw as {blockTime:number|null}).blockTime?Number((raw as {blockTime:number}).blockTime)*1000:null,receivedAt:job.seen,rpcFetchedAt,parsedAt,decidedAt,signalAt});
  store.set('graph:'+job.signature,{signature:job.signature,time:(raw as {blockTime:number|null}).blockTime?Number((raw as {blockTime:number}).blockTime)*1000:job.seen,transfers:parsed.transfers,provenance:job.provenance});
 });
 return parsed;
}
