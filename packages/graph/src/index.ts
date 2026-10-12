import type {Store} from '../../storage/src/index';
import {WALLETS} from '../../shared/src/index';
export function recordTransfers(store:Store,signature:string,time:number,transfers:Array<{from:string;to:string;lamports:string}>,blocked:Set<string>,provenance:string){
 for(const [i,t] of transfers.entries()){
  if(t.from===t.to||blocked.has(t.from)||blocked.has(t.to)||(!WALLETS.includes(t.from)&&!WALLETS.includes(t.to)))continue;
  store.relation(`${signature}:${i}`,{id:`${signature}:${i}`,source:t.from,target:t.to,signature,time,amountLamports:t.lamports,type:'observed transfer',confidence:'weak',provenance,sameController:false});
 }
}
