import {it,expect} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {WALLETS,type Swap,type Quote} from '../packages/shared/src/index';
const s:Swap={id:'entry:0',signature:'entry',index:0,slot:1,time:100000,receivedAt:100001,owner:WALLETS[0],mint:'mint',pool:'pool',protocol:'pump',lamports:'100000000',tokenRaw:'100',success:true,commitment:'confirmed',provenance:'DEMO',buyerClass:'unknown'};
const q:Quote={lifecycle:{mint:'mint',kind:'migration',time:90000,slot:0,signature:'SYNTHETIC-MIGRATION',program:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',source:'synthetic lifecycle fixture',verified:true,provenance:'DEMO',commitment:'confirmed'},mint:'mint',time:100000,provenance:'DEMO',source:'synthetic fixture',circulatingMarketCapUsd:'300000',circulationSource:'synthetic fixture',tokenAmount:'100',buyCostSol:'0.1',sellProceedsSol:'0.1',networkFeeSol:'0.000005',rentSol:'0.002',slippageSol:'0.001',coverageComplete:true};
it('fresh websocket jobs overtake old live debt while all evidence remains durable',()=>{
 const db=new Store(':memory:');const now=Date.now();db.enqueue({signature:'old',slot:1,seen:now-120000,source:WALLETS[0],provenance:'LIVE'});db.enqueue({signature:'new',slot:2,seen:now,source:WALLETS[0],provenance:'LIVE'});expect(db.jobs(WALLETS)[0].signature).toBe('new');expect(db.jobCount()).toBe(2);db.close();
});
it('persistent boundary path opens once, exits once, and audits settings',()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings().value,unknownTriggersExit:true});expect(db.apply(s,q,true).kind).toBe('entry');
 expect(db.apply(s,q,true).reason).toBe('duplicate event');
 expect(db.apply({...s,id:'ext:0',signature:'ext',owner:'unknown',time:101000,lamports:'2000100000'},null,true).kind).toBe('exit');
 expect(db.apply({...s,id:'ext:0',signature:'ext',owner:'unknown',time:101000,lamports:'2000100000'},null,true).reason).toBe('duplicate event');
 expect(db.positions().filter(p=>p.status==='closed')).toHaveLength(1);
 const before=db.settings();db.saveSettings({...before.value,exitExternalSingleBuySol:'3'});expect(db.settings().version).toBe(before.version+1);expect(db.audit()).toHaveLength(3);db.close();
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
 expect(db.apply(n,{...q,time:101000,sellProceedsSol:'0.160'},true).kind).toBe('exit');
 db.finalize('entry',true);expect(db.positions()[0].status).toBe('invalidated');db.close();
});
it('uses decision-time quote freshness rather than rejecting all quotes obtained after blockTime',()=>{
 const db=new Store(':memory:');const d=db.apply({...s,receivedAt:100500},{...q,time:101000},true,101100);
 expect(d.kind).toBe('entry');expect(db.positions()[0].openedAt).toBe(101100);db.close();
});
it('does not enter from an old LIVE queue item despite a current quote',()=>{
 const db=new Store(':memory:');expect(db.apply({...s,provenance:'LIVE'},{...q,provenance:'LIVE',time:200000},true,200001).reason).toContain('stale LIVE');db.close();
});
it('quote refresh can take profit without a new buy and retains prior paper fills after re-entry',()=>{
 const db=new Store(':memory:');db.apply(s,q,true);
 expect(db.markQuote({...q,time:101000,sellProceedsSol:'0.160'},101100).kind).toBe('exit');expect(db.markQuote({...q,time:101000,sellProceedsSol:'0.160'},101100).kind).toBe('ignore');
 expect(db.apply({...s,id:'reentry',signature:'reentry',time:102000,receivedAt:102001},{...q,time:102000},true).kind).toBe('entry');
 expect(db.positionHistory()).toHaveLength(2);expect(db.positions().filter(p=>p.status==='open')).toHaveLength(1);db.close();
});
it('a reverted archived fill does not invalidate a later valid position in the same mint',()=>{
 const db=new Store(':memory:');db.apply(s,q,true);db.markQuote({...q,time:101000,sellProceedsSol:'0.160'},101100);db.apply({...s,id:'new',signature:'new',time:102000,receivedAt:102001},{...q,time:102000},true);db.finalize('entry',true);expect(db.positions()[0].status).toBe('open');expect(db.positionHistory().find(p=>p.id===s.id)?.status).toBe('invalidated');db.close();
});
it('a same-second external order cannot bypass the entry cap because blockTime is coarse',()=>{
 const db=new Store(':memory:');db.apply({...s,id:'before',signature:'before',slot:0,owner:'other',lamports:'1000000001'},null,true);expect(db.apply(s,q,true).kind).toBe('ignore');db.close();
});
