import { describe, it, expect } from 'vitest';
import { decide } from '../packages/strategy/src/index';
import { defaults, WALLETS, type Swap, type Position } from '../packages/shared/src/index';
const s:Swap={id:'tx:0',signature:'tx',index:0,slot:1,time:100000,receivedAt:100001,owner:'other',mint:'mint',pool:'pool',protocol:'pump',lamports:'2000100000',tokenRaw:'100',success:true,commitment:'confirmed',provenance:'DEMO',buyerClass:'unknown'};
const p:Position={id:'p',mint:'mint',openedAt:90000,openEvent:'entry',buyCostSol:'0.101',tokenAmount:'100',sizeSol:'0.1',version:1,provenance:'DEMO',status:'open'};
describe('external single order protection',()=>{
 it('exits strictly above two SOL',()=>expect(decide(s,defaults,p,[],null,1,true).kind).toBe('exit'));
});
it('2.0 and independent 1.2 orders do not exit',()=>{
 for(const n of ['2000000000','1200000000','1200000000'])expect(decide({...s,lamports:n},defaults,p,[],null,1,true).kind).toBe('ignore');
});
it('tracked and excluded buyers do not exit',()=>{
 expect(decide({...s,owner:WALLETS[0]},defaults,p,[],null,1,true).kind).toBe('ignore');
 expect(decide(s,{...defaults,excluded:[{address:s.owner,evidence:'verified evidence'}]},p,[],null,1,true).kind).toBe('ignore');
});
it('unknown switch and failed/reverted/stale events cannot exit',()=>{
 expect(decide(s,{...defaults,unknownTriggersExit:false},p,[],null,1,true).kind).toBe('ignore');
 for(const patch of [{success:false},{commitment:'reverted' as const},{time:80000},{provenance:'LIVE' as const}])expect(decide({...s,...patch},defaults,p,[],null,1,true).kind).toBe('ignore');
});
it('threshold changes apply immediately without rounding',()=>{
 expect(decide(s,{...defaults,exitExternalSingleBuySol:'2.0001'},p,[],null,2,true).kind).toBe('ignore');
 expect(decide({...s,lamports:'2000100001'},defaults,p,[],null,1,true).kind).toBe('exit');
});
it('exit remains protective while new entries paused',()=>expect(decide(s,{...defaults,monitoring:false},p,[],null,1,false).kind).toBe('exit'));
it('suspected exclusion is opt-in and public services never trigger protective exits',()=>{
 expect(decide(s,{...defaults,suspected:[{address:s.owner,evidence:'weak transfer evidence'}]},p,[],null,1,true).kind).toBe('exit');
 expect(decide(s,{...defaults,suspected:[{address:s.owner,evidence:'weak transfer evidence'}],excludeSuspected:true},p,[],null,1,true).kind).toBe('ignore');
 expect(decide(s,{...defaults,publicServices:[{address:s.owner,evidence:'verified public service'}]},p,[],null,1,true).kind).toBe('ignore');
});
it('a queued observation from before real PAPER entry cannot retroactively trigger an exit',()=>{
 expect(decide({...s,provenance:'LIVE',time:100000,receivedAt:100010},defaults,{...p,provenance:'LIVE',openedAt:100100},[],null,1,true,100200).kind).toBe('ignore');
});
it('supports configurable strict one-SOL and half-SOL thresholds',()=>{
 for(const [limit,equal,above] of [['1','1000000000','1000000001'],['0.5','500000000','500000001']]){const settings={...defaults,exitExternalSingleBuySol:limit};expect(decide({...s,lamports:equal},settings,p,[],null,1,true).kind).toBe('ignore');expect(decide({...s,lamports:above},settings,p,[],null,1,true).kind).toBe('exit');}
});
