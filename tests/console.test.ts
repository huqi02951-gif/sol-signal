import {it,expect} from 'vitest';
import {solAmount,walletSample} from '../packages/shared/src/console';
import type {Swap,Event} from '../packages/shared/src/index';
it('display amounts retain the single-lamport threshold distinction',()=>{expect(solAmount('2000000001')).toBe('2.000000001');expect(solAmount('2000000000')).toBe('2');expect(solAmount('9007199254740993')).toBe('9007199.254740993');});
it('wallet view excludes other wallets, reverted trades and demo data',()=>{
 const swap={owner:'A',success:true,commitment:'confirmed',provenance:'LIVE',time:100} as Swap;
 const events=[{kind:'transaction',provenance:'LIVE',time:100,detail:{source:'A'}},{kind:'transaction',provenance:'DEMO',time:200,detail:{source:'A'}}] as Event[];
 const result=walletSample('A',[swap,{...swap,owner:'B'},{...swap,commitment:'reverted'},{...swap,provenance:'DEMO'}],events);
 expect(result.buys).toHaveLength(1);expect(result.transactions).toHaveLength(1);
});
