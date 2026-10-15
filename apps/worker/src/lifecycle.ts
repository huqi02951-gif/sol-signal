import type {Store} from '../../../packages/storage/src/index';import type {Rpc} from './rpc';import {parseTransaction} from './parser';
export async function resolveLifecycle(store:Store,rpc:Pick<Rpc,'call'>,mint:string,pool:string,needsMigration:boolean,now=Date.now()){
 const known=store.lifecycle(mint,'LIVE');if(known&&(!needsMigration||known.kind==='migration'))return {status:'verified',evidence:known};
 let requests=0;const checked=new Set<string>();
 // Bounded investigation, not a full history claim. Never substitute oldest returned timestamp for launch time.
 for(const address of [...new Set([mint,pool])]){
  const rows=await rpc.call<Array<{signature:string;err:unknown}>>('getSignaturesForAddress',[address,{limit:100}],'background');requests++;
  for(const row of [...rows].reverse().filter(r=>!r.err).slice(0,2)){
   if(checked.has(row.signature))continue;checked.add(row.signature);
   const raw=await rpc.call<unknown>('getTransaction',[row.signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}],'background');requests++;
   if(!raw)continue;const p=parseTransaction(raw,'HISTORY',now);
   if((raw as {transaction:{signatures:string[]}}).transaction.signatures[0]!==row.signature)throw new Error('lifecycle signature mismatch');
   for(const evidence of p.lifecycles.filter(e=>e.mint===mint)){store.recordLifecycle(evidence);store.set('lifecycleProof:'+evidence.signature,raw);}
   const found=store.lifecycle(mint,'LIVE');if(found&&(!needsMigration||found.kind==='migration')){const result={status:'verified',checkedAt:now,requests,evidence:found};store.set('lifecycleLookup:'+mint,result);return result;}
  }
 }
 const result={status:'UNKNOWN',checkedAt:now,requests,reason:'bounded pages did not provide a matching successful launch/migration event; no inferred timestamp'};store.set('lifecycleLookup:'+mint,result);return result;
}
