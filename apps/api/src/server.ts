import Fastify from 'fastify';
import statics from '@fastify/static';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import {WALLETS,settingsSchema} from '../../../packages/shared/src/index';
import {Store} from '../../../packages/storage/src/index';
import {summarizeTimings} from '../../../packages/shared/src/telemetry';
import {buyerActivity} from '../../../packages/shared/src/activity';
import {buyerSummary} from '../../../packages/shared/src/buyers';
import {runDemo} from '../../../packages/strategy/src/demo';
function quantile(xs:number[],q:number){if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b);return a[Math.ceil(q*a.length)-1];}
export function createServer(store:Store,port=8787){
 const app=Fastify({logger:false,bodyLimit:64*1024});
 const hosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`,...(process.env.API_ALLOWED_HOSTS||'').split(',').filter(Boolean)]);
 app.addHook('onRequest',async(req,reply)=>{
  if(!hosts.has(req.headers.host||''))return reply.code(403).send({error:'host not allowed'});
  if(['POST','PUT','DELETE','PATCH'].includes(req.method)){
   if(!req.headers['content-type']?.startsWith('application/json'))return reply.code(415).send({error:'JSON required'});
   if(req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`,'http://127.0.0.1:5173','http://localhost:5173'].includes(req.headers.origin))return reply.code(403).send({error:'origin not allowed'});
  }
 });
 app.setErrorHandler((error,req,reply)=>{reply.code(error instanceof z.ZodError?400:500).send({error:error instanceof z.ZodError?'invalid request fields':'request failed'});});
 function snapshot(){
  const activitySwaps=store.swaps(10000);const activityRelations=store.relations();const activitySettings=store.settings().value;const now=Date.now();
  const h=store.get<Record<string,unknown>>('health',{});const heartbeat=Number(h.heartbeat||0);const stale=Date.now()-heartbeat>20000;const swaps=store.swaps(300);const live=swaps.filter(s=>s.provenance==='LIVE'&&s.ingestion==='websocket');
  const delays=live.filter(s=>s.time>0&&s.receivedAt>=s.time).map(s=>s.receivedAt-s.time);
  return {mode:'PAPER / SIMULATION',updatedAt:Date.now(),settings:store.settings(),wallets:WALLETS.map((address,i)=>({address,alias:'钱包 '+String.fromCharCode(65+i),subscribed:!stale&&((h.subscriptions as string[]|undefined)||[]).includes(address),lastTransaction:store.events(500).find(e=>e.kind==='transaction'&&(e.detail as {source:string}).source===address)})),health:{...h,stale,connected:!stale&&h.connected===true,p50:quantile(delays,.5),p95:quantile(delays,.95),latencyDefinition:'blockTime → logs receipt; blockTime has second-level precision; excludes HISTORY/DEMO',latencySamples:delays.length,latencies:summarizeTimings(store.timings()),currentRunLatencies:summarizeTimings(store.timings().filter(t=>t.receivedAt>=store.get('monitorRunStartedAt',0))),soak:store.get('soak',null),rpcUsage:store.get('rpcUsage',null),backfills:WALLETS.map(a=>store.get('backfill:'+a,null)),entryReady:!stale&&h.entryReady===true},market:store.db.prepare("SELECT value FROM kv WHERE key LIKE 'market:%'").all().map(r=>JSON.parse(String(r.value))),buyers:buyerSummary(swaps,store.settings().value,Object.fromEntries(store.db.prepare("SELECT key,value FROM kv WHERE key LIKE 'holdings:%'").all().map(r=>[String(r.key).slice(9),JSON.parse(String(r.value))]))),tokens:Object.values(store.get('tokens',{})),lifecycles:Object.keys(store.get('tokens',{})).map(mint=>store.lifecycle(mint,'LIVE')).filter(Boolean),firstBuyerMonitors:store.firstBuyerMonitors(),buyerActivity:buyerActivity(activitySwaps,activitySettings,activityRelations,now-86400000,now),activityArchive:buyerActivity(activitySwaps,activitySettings,activityRelations,Math.min(now,...activitySwaps.filter(s=>s.provenance!=='DEMO').map(s=>s.time)),now),watchQueue:store.get('waitingTokens',[]),positions:store.positionHistory(),events:store.events(),swaps,graph:store.relations(),fundingAnalysis:store.get('fundingAnalysis',null)};
 }
 app.get('/api/snapshot',async()=>snapshot());
 app.get('/api/health',async(_req,reply)=>{const h=snapshot().health;if(!h.connected)reply.code(503);return h;});
 app.get('/api/metrics',async()=>({runStartedAt:store.get('monitorRunStartedAt',0),currentRunLatencies:summarizeTimings(store.timings().filter(t=>t.receivedAt>=store.get('monitorRunStartedAt',0))),latencies:summarizeTimings(store.timings()),reconciliation:store.get('reconciliation',null),soak:store.get('soak',null)}));
 app.get('/api/settings/audit',async()=>store.audit());
 app.get('/api/ai/status',async()=>({enabled:false,modelCalls:0,policy:'no model runtime; legacy keys ignored'}));
 app.post('/api/ai/summary',async(_req,reply)=>reply.code(503).send({error:'当前版本不接入大模型；监听与策略不消耗模型 Token'}));
 app.put('/api/settings',async(req,reply)=>{
  const input=z.object({expectedVersion:z.number().int().positive(),value:settingsSchema}).strict().parse(req.body);
  const saved=store.transaction(()=>{if(store.settings().version!==input.expectedVersion)return null;store.saveSettings(input.value);return store.settings();});
  if(!saved)return reply.code(409).send({error:'strategy changed; reload before saving'});return saved;
 });
 app.post('/api/demo/replay',async()=>runDemo(store));
 app.post('/api/control',async(req)=>{const body=z.object({action:z.enum(['stop','start'])}).strict().parse(req.body);store.set('monitorEnabled',body.action==='start');store.event({id:'control:'+Date.now(),kind:'monitor_control',time:Date.now(),provenance:'LIVE',detail:{action:body.action}});return {monitorEnabled:body.action==='start'};});
 const root=resolve('apps/web/dist');if(existsSync(root)){app.register(statics,{root});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api')?reply.code(404).send({error:'not found'}):reply.sendFile('index.html'));}
 return app;
}
