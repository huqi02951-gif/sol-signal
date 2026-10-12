import {it,expect} from 'vitest';
import {summarizeTimings} from '../packages/shared/src/telemetry';
it('separates receive, RPC, parser, decision and signal percentiles, excluding replay',()=>{
 const live={signature:'a',provenance:'LIVE' as const,ingestion:'websocket' as const,chainTime:1000,receivedAt:1500,rpcFetchedAt:2000,parsedAt:2050,decidedAt:2100,signalAt:2100};
 const result=summarizeTimings([live,{...live,signature:'b',provenance:'HISTORY'},{...live,signature:'c',ingestion:'backfill'}]);
 expect(result.receive.p95).toBe(500);expect(result.rpc.p99).toBe(500);expect(result.parse.p50).toBe(50);expect(result.decision.p95).toBe(50);expect(result.signal.p95).toBe(600);expect(result.signal.samples).toBe(1);
});
it('does not claim signal latency when there is no PAPER signal, or hide clock reversals',()=>{
 const base={signature:'a',provenance:'LIVE' as const,ingestion:'websocket' as const,chainTime:1000,receivedAt:1500,rpcFetchedAt:2000,parsedAt:2050,decidedAt:2100};
 expect(summarizeTimings([base]).signal.samples).toBe(0);expect(summarizeTimings([{...base,parsedAt:1900}]).endToEnd.samples).toBe(0);expect(summarizeTimings([{...base,chainTime:1600}]).receive.samples).toBe(0);
});
