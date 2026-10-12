import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {Store} from '../packages/storage/src/index';
import {runDemo} from '../packages/strategy/src/demo';
import {parseTransaction} from '../apps/worker/src/parser';
const db=new Store(':memory:');const history=[];const start=performance.now();
for(const file of readdirSync('fixtures/history').filter(f=>f.endsWith('.json')&&f!=='manifest.json')){
 const raw=JSON.parse(readFileSync('fixtures/history/'+file,'utf8'));const before=performance.now();const p=parseTransaction(raw,'HISTORY');
 for(const s of p.swaps)db.apply(s,null,false);
 history.push({signature:raw.transaction.signatures[0],blockTime:raw.blockTime,buys:p.swaps.length,protocols:p.swaps.map(s=>s.protocol),decodeMs:performance.now()-before,reason:p.reason});
}
const demo=runDemo(db);const report={generatedAt:new Date().toISOString(),historical:{transactions:history.length,verifiedBuys:history.reduce((n,x)=>n+x.buys,0),entries:0,reason:'no executable quotes, circulation or full coverage: entries correctly blocked',totalReplayMs:performance.now()-start,missedTransactions:'unknown; no independent ground-truth index supplied',misTriggers:'no strategy entry under missing data; parser false negatives not measured',results:history},synthetic:{label:'DEMO; not historical profitability evidence',decisions:demo.decisions.map(x=>({kind:x.kind,reason:x.reason})),closedPositions:db.positions().filter(x=>x.provenance==='DEMO'&&x.status==='closed').length}};
writeFileSync('docs/REPLAY_REPORT.json',JSON.stringify(report,null,2));console.log(JSON.stringify({history:report.historical.transactions,buys:report.historical.verifiedBuys,demo:report.synthetic},null,2));db.close();
