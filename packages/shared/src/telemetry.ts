import type {Provenance} from './index';
export interface Timing {signature:string;provenance:Provenance;ingestion:'websocket'|'backfill'|'fixture';chainTime:number|null;receivedAt:number;rpcFetchedAt:number;parsedAt:number;decidedAt:number;signalAt?:number}
function percentiles(values:number[]){const a=values.filter(Number.isFinite).filter(x=>x>=0).sort((x,y)=>x-y);const p=(q:number)=>a.length?a[Math.ceil(a.length*q)-1]:null;return {samples:a.length,p50:p(.5),p95:p(.95),p99:p(.99)};}
export function summarizeTimings(rows:Timing[]){
 const live=rows.filter(t=>t.provenance==='LIVE'&&t.ingestion==='websocket'&&t.receivedAt<=t.rpcFetchedAt&&t.rpcFetchedAt<=t.parsedAt&&t.parsedAt<=t.decidedAt);
 return {receive:percentiles(live.filter(t=>t.chainTime!==null).map(t=>t.receivedAt-t.chainTime!)),rpc:percentiles(live.map(t=>t.rpcFetchedAt-t.receivedAt)),parse:percentiles(live.map(t=>t.parsedAt-t.rpcFetchedAt)),decision:percentiles(live.map(t=>t.decidedAt-t.parsedAt)),endToEnd:percentiles(live.map(t=>t.decidedAt-t.receivedAt)),signal:percentiles(live.filter(t=>t.signalAt!==undefined&&t.signalAt>=t.parsedAt).map(t=>t.signalAt!-t.receivedAt)),definition:'receive uses second-resolution blockTime; other durations use local wall clock milliseconds; signal samples only actual PAPER entry/exit',window:rows.length};
}
