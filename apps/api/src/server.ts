import Fastify from 'fastify';
import statics from '@fastify/static';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import {WALLETS,settingsSchema} from '../../../packages/shared/src/index';
import {Store} from '../../../packages/storage/src/index';
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
  const h=store.get<Record<string,unknown>>('health',{});const heartbeat=Number(h.heartbeat||0);const stale=Date.now()-heartbeat>20000;const swaps=store.swaps(300);const live=swaps.filter(s=>s.provenance==='LIVE'&&s.ingestion==='websocket');
  const delays=live.filter(s=>s.time>0&&s.receivedAt>=s.time).map(s=>s.receivedAt-s.time);
  return {mode:'PAPER / SIMULATION',updatedAt:Date.now(),settings:store.settings(),wallets:WALLETS.map((address,i)=>({address,alias:'钱包 '+String.fromCharCode(65+i),subscribed:!stale&&((h.subscriptions as string[]|undefined)||[]).includes(address),lastTransaction:store.events(500).find(e=>e.kind==='transaction'&&(e.detail as {source:string}).source===address)})),health:{...h,stale,connected:!stale&&h.connected===true,p50:quantile(delays,.5),p95:quantile(delays,.95),latencyDefinition:'blockTime → logs receipt; blockTime has second-level precision; excludes HISTORY/DEMO',latencySamples:delays.length,rpcUsage:store.get('rpcUsage',null),backfills:WALLETS.map(a=>store.get('backfill:'+a,null)),entryReady:false},tokens:Object.values(store.get('tokens',{})),positions:store.positions(),events:store.events(),swaps,graph:store.relations()};
 }
 app.get('/api/snapshot',async()=>snapshot());
 app.get('/api/health',async(_req,reply)=>{const h=snapshot().health;if(!h.connected)reply.code(503);return h;});
 app.get('/api/settings/audit',async()=>store.audit());
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
