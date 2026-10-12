import {it,expect} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {WALLETS,type Swap,type Quote} from '../packages/shared/src/index';
const s:Swap={id:'entry:0',signature:'entry',index:0,slot:1,time:100000,receivedAt:100001,owner:WALLETS[0],mint:'mint',pool:'pool',protocol:'pump',lamports:'100000000',tokenRaw:'100',success:true,commitment:'confirmed',provenance:'DEMO',buyerClass:'unknown'};
const q:Quote={mint:'mint',time:100000,provenance:'DEMO',source:'synthetic fixture',circulatingMarketCapUsd:'300000',circulationSource:'synthetic fixture',tokenAmount:'100',buyCostSol:'0.1',sellProceedsSol:'0.1',networkFeeSol:'0.000005',rentSol:'0.002',slippageSol:'0.001',coverageComplete:true};
it('persistent boundary path opens once, exits once, and audits settings',()=>{
 const db=new Store(':memory:');expect(db.apply(s,q,true).kind).toBe('entry');
 expect(db.apply(s,q,true).reason).toBe('duplicate event');
 expect(db.apply({...s,id:'ext:0',signature:'ext',owner:'unknown',time:101000,lamports:'2000100000'},null,true).kind).toBe('exit');
 expect(db.apply({...s,id:'ext:0',signature:'ext',owner:'unknown',time:101000,lamports:'2000100000'},null,true).reason).toBe('duplicate event');
 expect(db.positions().filter(p=>p.status==='closed')).toHaveLength(1);
 const before=db.settings();db.saveSettings({...before.value,exitExternalSingleBuySol:'3'});expect(db.settings().version).toBe(before.version+1);expect(db.audit()).toHaveLength(2);db.close();
});
it('missing circulation, FDV-only, stale quotes or incomplete coverage cannot open',()=>{
 for(const quote of [null,{...q,circulatingMarketCapUsd:null},{...q,circulationSource:null},{...q,time:1},{...q,coverageComplete:false}]){
  const db=new Store(':memory:');expect(db.apply(s,quote,true).kind).toBe('ignore');expect(db.positions()).toHaveLength(0);db.close();
 }
});
it('entry external window uses per-order maximum and excludes trigger itself',()=>{
 const db=new Store(':memory:');db.apply({...s,id:'ext',owner:'other',time:90000,lamports:'1000000001'},null,true);expect(db.apply(s,q,true).kind).toBe('ignore');db.close();
});
it('net take profit deducts costs and invalidates reverted source',()=>{
 const db=new Store(':memory:');db.apply(s,q,true);
 const n={...s,id:'next',signature:'next',time:101000,owner:WALLETS[1]};
 expect(db.apply(n,{...q,time:101000,sellProceedsSol:'0.110'},true).kind).toBe('exit');
 db.finalize('entry',true);expect(db.positions()[0].status).toBe('invalidated');db.close();
});
