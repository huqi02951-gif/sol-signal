import type {Store} from '../../../packages/storage/src/index';
import type {Rpc} from './rpc';
interface Sig {signature:string;slot:number;blockTime:number|null;err:unknown}
interface Progress {cursor:string|null;before?:string;newest?:string}
export async function backfillAddress(store:Store,rpc:Pick<Rpc,'call'>,address:string,shouldStop=()=>false,maxPages=10){
 const cursor=store.get<string|null>('cursor:'+address,null);
 const previous=store.get<Progress|null>('backfillProgress:'+address,null);
 const progress:Progress=previous?.cursor===cursor?previous:{cursor};let count=0;
 for(let page=0;page<maxPages;page++){
  if(shouldStop())return false;
  const rows=await rpc.call<Sig[]>('getSignaturesForAddress',[address,{limit:cursor?100:10,...(progress.before?{before:progress.before}:{}),...(cursor?{until:cursor}:{})}]);
  const found=!cursor||rows.length<100;
  store.transaction(()=>{
   if(!progress.newest&&rows.length)progress.newest=rows[0].signature;
   for(const r of [...rows].reverse())if(!r.err)store.enqueue({signature:r.signature,slot:r.slot,seen:Date.now(),source:'backfill:'+address,provenance:cursor?'LIVE':'HISTORY'});
   count+=rows.length;progress.before=rows.at(-1)?.signature??progress.before;
   if(found){if(progress.newest)store.set('cursor:'+address,progress.newest);store.db.prepare('DELETE FROM kv WHERE key=?').run('backfillProgress:'+address);}
   else store.set('backfillProgress:'+address,progress);
   store.set('backfill:'+address,{checkedAt:Date.now(),count,firstScan:!cursor,status:found?'complete_to_cursor':'continuing',coverage:'address history only; not full token trade coverage'});
  });
  if(found)return true;
 }
 // Continue from the persisted page on the next scan, not from the head again.
 return false;
}
