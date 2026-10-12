import type {Store} from '../../../packages/storage/src/index';
import type {Rpc} from './rpc';
import {WALLETS} from '../../../packages/shared/src/index';
export interface ReferenceSignature {signature:string;slot:number;blockTime:number|null;err:unknown}
export function compareReference(store:Store,rows:ReferenceSignature[]){
 const successful=rows.filter(r=>r.err===null);const pending=successful.filter(r=>!store.hasRaw(r.signature));
 return {referenceSuccessful:successful.length,processed:successful.length-pending.length,pendingOrMissing:pending.map(r=>r.signature),processedFraction:successful.length?(successful.length-pending.length)/successful.length:null};
}
export async function reconcile(store:Store,reference:Rpc|null,sourceLabel:string){
 const at=Date.now();if(!reference){const report={at,status:'unavailable',reason:'independent RPC not configured',missRate:null};store.set('reconciliation',report);return report;}
 const results=[];
 try{
  for(const wallet of WALLETS){
   const rows=await reference.call<ReferenceSignature[]>('getSignaturesForAddress',[wallet,{limit:100,commitment:'finalized'}],'background');
   const startedAt=store.get<number>('monitorRunStartedAt',at);const eligible=rows.filter(r=>r.err===null&&r.blockTime!==null&&r.blockTime*1000>=startedAt+2000&&r.blockTime*1000<=at-120000);
   const missingReceipts=eligible.filter(r=>!store.hasReceipt(r.signature,wallet)).map(r=>r.signature);
   results.push({wallet,...compareReference(store,rows),referenceEligible:eligible.length,missingReceipts,observedMissFraction:eligible.length?missingReceipts.length/eligible.length:null,oldestBlockTime:rows.at(-1)?.blockTime??null,capped:rows.length===100});
   // A missing processed result is not automatically a dropped websocket packet. Persist repair work, label its origin.
   for(const row of rows)if(row.err===null&&!store.hasRaw(row.signature))store.enqueue({signature:row.signature,slot:row.slot,seen:at,source:'backfill:'+wallet,provenance:'HISTORY'});
  }
  const report={at,status:'sampled',source:sourceLabel,scope:'latest <=100 finalized signatures per core wallet, not full-chain accuracy',results,missRate:null,reason:'pending and missing cannot yet be separated; incomplete/capped windows cannot establish accuracy'};store.set('reconciliation',report);store.event({id:'reconcile:'+at,kind:'independent_reconciliation',time:at,provenance:'LIVE',detail:report});return report;
 }catch{const report={at,status:'unavailable',source:sourceLabel,reason:'independent provider unavailable; accuracy not measured',results,missRate:null};store.set('reconciliation',report);return report;}
}
