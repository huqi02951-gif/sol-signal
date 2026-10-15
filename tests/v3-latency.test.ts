import {it,expect,vi} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {Rpc} from '../apps/worker/src/rpc';
import {summarizeTimings} from '../packages/shared/src/telemetry';
it('measures local RPC wait independently of request round trip',async()=>{
 const db=new Store(':memory:');vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({result:{ok:true}})));
 await new Rpc('https://example.invalid',db,0).call('getTransaction',['sig']);
 const trace=db.get<any>('rpcTiming:sig',null);expect(trace).not.toBeNull();expect(trace.startedAt).toBeGreaterThanOrEqual(trace.queuedAt);expect(trace.completedAt).toBeGreaterThanOrEqual(trace.headersAt);
 const row={signature:'sig',provenance:'LIVE' as const,ingestion:'websocket' as const,chainTime:900,receivedAt:1000,rpcFetchedAt:1700,parsedAt:1701,decidedAt:1702,rpcQueuedAt:1200,rpcStartedAt:1500,rpcHeadersAt:1600};
 const r=summarizeTimings([row]);expect(r.durableQueue.p50).toBe(200);expect(r.schedulerQueue.p50).toBe(300);expect(r.requestRoundTrip.p50).toBe(200);expect(r.chainToDecision.p50).toBe(802);vi.unstubAllGlobals();db.close();
});
