import type {Store} from '../../../packages/storage/src/index';
export interface Watch {pool:string;mint:string;protocol:string;signature:string;discoveredAt:number;expiresAt:number;kind:'candidate'|'position'}
export class Watches {
 constructor(private store:Store,private limit=4,private ttlMs=300000){if(!Number.isInteger(limit)||limit<1||limit>4||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>3600000)throw new Error('invalid watch budget');}
 private capacity(){return Math.min(this.limit,this.store.settings().value.maxActiveTokens);}
 waiting():Watch[]{return this.store.get<Watch[]>('waitingTokens',[]);}
 discover(input:Omit<Watch,'expiresAt'|'kind'>,now=Date.now()):boolean {
  const rows=this.list(now);if(rows.some(w=>w.pool===input.pool))return true;
  const waiting=this.waiting();if(!waiting.some(w=>w.pool===input.pool))waiting.push({...input,expiresAt:now+this.ttlMs,kind:'candidate'});
  this.store.set('waitingTokens',waiting);return this.list(now).some(w=>w.pool===input.pool);
 }
 list(now=Date.now()):Watch[]{
  const open=new Set(this.store.positions().filter(p=>p.provenance==='LIVE'&&p.status==='open').map(p=>p.mint));
  const rows=this.store.get<Watch[]>('poolWatches',[]).filter(w=>open.has(w.mint)||w.expiresAt>now).map(w=>({...w,kind:open.has(w.mint)?'position' as const:'candidate' as const}));
  const waiting=this.waiting();const active=new Set(rows.map(w=>w.mint));const remaining:Watch[]=[];
  // Preserve queued discoveries even after their original TTL; admission starts a fresh bounded observation window.
  for(const w of waiting){if(active.has(w.mint)||active.size<this.capacity()){active.add(w.mint);if(!rows.some(r=>r.pool===w.pool))rows.push({...w,expiresAt:now+this.ttlMs,kind:open.has(w.mint)?'position':'candidate'});}else remaining.push(w);}
  // Lowering a runtime cap defers unpinned candidates, without silently deleting discoveries.
  const admitted=new Set(open);const kept=rows.filter(w=>{if(admitted.has(w.mint)||admitted.size<this.capacity()){admitted.add(w.mint);return true;}remaining.push(w);return false;});
  this.store.set('poolWatches',kept);this.store.set('waitingTokens',remaining);return kept;
 }
}
