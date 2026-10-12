import {it,expect} from 'vitest';
import {buyerSummary} from '../packages/shared/src/buyers';
import {defaults,type Swap} from '../packages/shared/src/index';
it('counts independent unexcluded owners, reports single maximum, and never invents holdings',()=>{
 const base:Swap={id:'a',signature:'a',index:0,slot:1,time:1,receivedAt:2,owner:'external',mint:'mint',pool:'pool',protocol:'pump',lamports:'1200000000',tokenRaw:'1',success:true,commitment:'confirmed',provenance:'LIVE',buyerClass:'unknown'};
 const r=buyerSummary([base,{...base,id:'b',signature:'b'},{...base,id:'excluded',owner:'confirmed',lamports:'9000000000'}],{...defaults,excluded:[{address:'confirmed',evidence:'explicit user confirmation'}]})[0];
 expect(r.unexcludedIndependentBuyers).toBe(1);expect(r.maximumSingleLamports).toBe('1200000000');expect(r.relatedHoldingsRatio).toBeNull();
});
