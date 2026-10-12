import type {Store} from '../../../packages/storage/src/index';
export interface Watch {pool:string;mint:string;protocol:string;signature:string;discoveredAt:number;expiresAt:number;kind:'candidate'|'position'}
export class Watches {
 constructor(private store:Store,private limit=2,private ttlMs=300000){if(!Number.isInteger(limit)||limit<1||limit>8||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>3600000)throw new Error('invalid watch budget');}
 discover(input:Omit<Watch,'expiresAt'|'kind'>,now=Date.now()):boolean {
  const watches=this.list(now);const pinned=this.store.positions().some(p=>p.provenance==='LIVE'&&p.status==='open'&&p.mint===input.mint);
  const found=watches.find(w=>w.pool===input.pool);
  if(found){if(pinned)found.kind='position';this.save(watches);return true;}
  if(watches.length>=this.limit&&!pinned){this.store.set('watchCapacity',{at:now,mint:input.mint,reason:'candidate pool budget reached; entry blocked'});return false;}
  watches.push({...input,expiresAt:now+this.ttlMs,kind:pinned?'position':'candidate'});this.save(watches);return true;
 }
 list(now=Date.now()):Watch[]{
  const open=new Set(this.store.positions().filter(p=>p.provenance==='LIVE'&&p.status==='open').map(p=>p.mint));
  const rows=this.store.get<Watch[]>('poolWatches',[]).filter(w=>open.has(w.mint)||w.expiresAt>now).map(w=>({...w,kind:open.has(w.mint)?'position' as const:'candidate' as const}));
  this.save(rows);return rows;
 }
 private save(rows:Watch[]){this.store.set('poolWatches',rows);}
}
