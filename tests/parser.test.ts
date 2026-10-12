import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseTransaction} from '../apps/worker/src/parser';
const raw=JSON.parse(readFileSync('fixtures/history/oXpJso1AxGqRDokEsu79nvviX6mzbE4oYEqi1wThXYRBRBC21b4xgcUJV9cYNcd5KvnjTm8LeJv9BmVgLQtq2og.json','utf8'));
it('decodes captured PumpSwap owner, mint and actual input from protocol evidence',()=>{
 const p=parseTransaction(raw,'HISTORY',1791808120000);expect(p.swaps).toHaveLength(1);const s=p.swaps[0];expect(s.protocol).toBe('pumpswap');expect(s.owner).toBe('GNWkMRJeBgB2mpqdjcPxP7VJPwqo6jJELjeMDcWgbYkj');expect(s.lamports).toBe('114936729');expect(s.tokenRaw).toBe('22194113914');expect(s.mint).toBe('5eave6ZV7fkkDzRp3e156DFmrrqwSTP9VaNXEHj4pump');expect(s.provenance).toBe('HISTORY');expect(p.pools[0].pool).toBe(s.pool);
});
it('fails closed on failed transactions, spoofed program data and mismatched beneficiary',()=>{
 const failed=structuredClone(raw);failed.meta.err={InstructionError:[0,'failed']};expect(parseTransaction(failed,'HISTORY').swaps).toHaveLength(0);
 const spoofed=structuredClone(raw);spoofed.meta.logMessages=spoofed.meta.logMessages.map((s:string)=>s.replace('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA','11111111111111111111111111111111'));expect(parseTransaction(spoofed,'HISTORY').swaps).toHaveLength(0);
 const redirected=structuredClone(raw);for(const b of redirected.meta.postTokenBalances)b.owner='OTHER';for(const b of redirected.meta.preTokenBalances)b.owner='OTHER';expect(parseTransaction(redirected,'HISTORY').swaps).toHaveLength(0);
});
it('does not treat a simple SOL transfer as a swap',()=>{const copy=structuredClone(raw);copy.meta.logMessages=[];expect(parseTransaction(copy,'HISTORY').swaps).toHaveLength(0);});
