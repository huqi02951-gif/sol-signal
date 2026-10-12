import {it,expect,vi} from 'vitest';
import {Rpc} from '../apps/worker/src/rpc';
import {Store} from '../packages/storage/src/index';
import {readKnownHoldings} from '../apps/worker/src/holdings';
it('preserves exact raw balances and does not invent issuer-wide holdings ratios',async()=>{
 const db=new Store(':memory:');vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({result:{context:{slot:2},value:[{account:{data:{parsed:{info:{tokenAmount:{amount:'9007199254740993',decimals:6}}}}}}]}}),{status:200})));
 const r=await readKnownHoldings(new Rpc('https://rpc.invalid',db,0,100),'mint',['A','A','B']);expect(r.totalRaw).toBe('18014398509481986');expect(r.balances).toHaveLength(2);expect(r.ratio).toBeNull();vi.unstubAllGlobals();db.close();
});
