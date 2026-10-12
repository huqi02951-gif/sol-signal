import {it,expect,vi} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Market} from '../packages/market/src/index';
import {Store} from '../packages/storage/src/index';
import {Rpc} from '../apps/worker/src/rpc';
const mint='5eave6ZV7fkkDzRp3e156DFmrrqwSTP9VaNXEHj4pump',pool='8Ke7GEZBqqiN4e3WeoLUzkeAGQqeqe96StMvXYkoN1Q5',sol='So11111111111111111111111111111111111111112';
const pair={chainId:'solana',pairAddress:pool,dexId:'pumpswap',baseToken:{address:mint},quoteToken:{address:sol},priceUsd:'0.15',marketCap:999999,fdv:150000000};
it('provider marketCap/FDV alone never permits entry',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[pair]})));const db=new Store(':memory:');const data=await new Market(new Rpc('https://rpc.invalid',db,0,100)).observe(mint,'0.1',10,null);expect(data.quote).toBeNull();expect(data.reason).toContain('circulation');vi.unstubAllGlobals();db.close();
});
it('validated circulation and both exact-size quotes remain blocked without complete coverage evidence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sol-market-'));const file=join(dir,'circulation.json');const now=Date.now();writeFileSync(file,JSON.stringify([{mint,circulatingSupply:'2000000',source:'https://example.invalid/circulation',observedAt:now-1000,expiresAt:now+60000,evidence:'SYNTHETIC TEST ATTESTATION ONLY',status:'verified'}]));
 vi.stubGlobal('fetch',vi.fn(async(u:string,o?:{body?:string})=>{
  let value:unknown;if(u.includes('dexscreener'))value=[pair];else if(u.includes('jup.ag')){const url=new URL(u);const inputMint=url.searchParams.get('inputMint')!,outputMint=url.searchParams.get('outputMint')!,inAmount=url.searchParams.get('amount')!;const out=inputMint===sol?'200':'95000000';value={inputMint,outputMint,inAmount,outAmount:out,otherAmountThreshold:out,swapMode:'ExactIn',contextSlot:10,routePlan:[{swapInfo:{ammKey:pool,inputMint,outputMint,feeAmount:'0',feeMint:inputMint}}]};}else{const method=JSON.parse(o!.body!).method;value={result:method==='getTokenSupply'?{value:{amount:'1000000000000000',decimals:6}}:method==='getAccountInfo'?{value:{owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}}:2039280};}
  return {ok:true,json:async()=>value};
 }));
 const db=new Store(':memory:');const data=await new Market(new Rpc('https://rpc.invalid',db,0,100),{circulationFile:file,jupiterKey:'TEST_ONLY'}).observe(mint,'0.1',10,null);
 expect(data.quote?.circulatingMarketCapUsd).toBe('300000');expect(data.quote?.coverageComplete).toBe(false);expect(data.quote?.rentSol).toBe('0.00203928');expect(data.quote?.tokenAmount).toBe('200');expect(data.quote?.sellProceedsSol).toBe('0.095');
 vi.unstubAllGlobals();db.close();rmSync(dir,{recursive:true});
});
