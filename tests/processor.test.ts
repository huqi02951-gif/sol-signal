import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Store} from '../packages/storage/src/index';
import {Watches} from '../apps/worker/src/watches';
import {processFetched} from '../apps/worker/src/processor';
const raw=JSON.parse(readFileSync('fixtures/history/oXpJso1AxGqRDokEsu79nvviX6mzbE4oYEqi1wThXYRBRBC21b4xgcUJV9cYNcd5KvnjTm8LeJv9BmVgLQtq2og.json','utf8'));
it('real captured transaction opens a bounded candidate watch before any PAPER position, retaining five timestamps',()=>{
 vi.useFakeTimers();vi.setSystemTime(raw.blockTime*1000+1000);const db=new Store(':memory:');const watches=new Watches(db);const signature=raw.transaction.signatures[0];const now=Date.now();const job={signature,slot:raw.slot,seen:now-50,source:'wallet',provenance:'LIVE' as const,attempts:0,next:0};
 processFetched(db,job,raw,now-10,watches,false);expect(db.positions()).toHaveLength(0);expect(watches.list()).toHaveLength(1);const t=db.timings()[0];expect(t.receivedAt).toBe(now-50);expect(t.rpcFetchedAt).toBe(now-10);expect(t.parsedAt).toBeGreaterThanOrEqual(t.rpcFetchedAt);expect(t.decidedAt).toBeGreaterThanOrEqual(t.parsedAt);expect(t.signalAt).toBeUndefined();expect(db.hasRaw(signature)).toBe(true);db.close();vi.useRealTimers();
});
it('the worker processing path applies an external >2 SOL protective exit once even with no quote or health readiness',async()=>{
 const {default:bs58}=await import('bs58');const {parseTransaction}=await import('../apps/worker/src/parser');
 vi.useFakeTimers();const time=raw.blockTime*1000+1000;vi.setSystemTime(time);const db=new Store(':memory:');const first=parseTransaction(raw,'DEMO',time).swaps[0];
 const quote={mint:first.mint,time,provenance:'DEMO' as const,source:'SYNTHETIC TEST ONLY',circulatingMarketCapUsd:'300000',circulationSource:'SYNTHETIC TEST ONLY',tokenAmount:'100',buyCostSol:'0.1',sellProceedsSol:'0.1',networkFeeSol:'0.000005',rentSol:'0.002',slippageSol:'0',coverageComplete:true};
 expect(db.apply(first,quote,true,time).kind).toBe('entry');
 const copy=structuredClone(raw),owner=bs58.encode(new Uint8Array(32).fill(7));copy.transaction.signatures=['DEMO-EXTERNAL'];copy.blockTime+=2;
 for(const key of copy.transaction.message.accountKeys)if(key.pubkey===first.owner)key.pubkey=owner;
 for(const row of [...copy.meta.preTokenBalances,...copy.meta.postTokenBalances])if(row.owner===first.owner)row.owner=owner;
 const ixs=[...copy.transaction.message.instructions,...copy.meta.innerInstructions.flatMap((r:{instructions:unknown[]})=>r.instructions)];
 for(const ix of ixs)if(ix.accounts)ix.accounts=ix.accounts.map((key:string)=>key===first.owner?owner:key);
 copy.meta.logMessages=copy.meta.logMessages.map((log:string)=>{if(!log.startsWith('Program data: '))return log;const b=Buffer.from(log.slice(14),'base64');if(!b.subarray(0,8).equals(Buffer.from([103,244,82,31,44,245,119,119])))return log;b.writeBigUInt64LE(2000100000n,112);Buffer.from(bs58.decode(owner)).copy(b,152);return 'Program data: '+b.toString('base64');});
 vi.setSystemTime(time+2000);const job={signature:'DEMO-EXTERNAL',slot:copy.slot,seen:time+1500,source:'pool',provenance:'DEMO' as const,attempts:0,next:0};
 const parsed=processFetched(db,job,copy,time+1900,new Watches(db),false);expect(parsed.swaps[0]?.lamports).toBe('2000100000');expect(db.positions()[0].status).toBe('closed');processFetched(db,job,copy,time+1900,new Watches(db),false);expect(db.events().filter(e=>e.kind==='paper_exit')).toHaveLength(1);db.close();vi.useRealTimers();
});
