import {it,expect,vi} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {createServer} from '../apps/api/src/server';
it('AI stays disabled by default and never calls a model',async()=>{
 const db=new Store(':memory:');const fetcher=vi.fn();const app=createServer(db,8787,{env:{},fetcher});
 const headers={host:'localhost:8787','content-type':'application/json'};
 expect((await app.inject({method:'POST',url:'/api/ai/summary',headers,payload:{}})).statusCode).toBe(503);
 expect(fetcher).not.toHaveBeenCalled();await app.close();db.close();
});
it('manual summaries use the selected provider, redact secrets, and persist limits across API restarts',async()=>{
 const db=new Store(':memory:');let now=Date.now();const secret='test-secret-only';
 db.event({id:'sensitive-test',kind:'transaction',time:now,provenance:'LIVE',detail:{private:'DO_NOT_SEND'}});
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'摘要 '+secret}}],usage:{prompt_tokens:90,completion_tokens:10,total_tokens:100}}))) as unknown as typeof fetch;
 const options={env:{AI_ENABLED:'true',AI_PROVIDER:'glm',AI_API_KEY:secret,AI_MODEL:'configured-model'},fetcher,now:()=>now};
 const headers={host:'localhost:8787','content-type':'application/json'};let app=createServer(db,8787,options);
 const call=()=>app.inject({method:'POST',url:'/api/ai/summary',headers,payload:{}});
 const first=await call();expect(first.statusCode).toBe(200);expect(first.body).not.toContain(secret);expect(first.json().usage.totalTokens).toBe(100);
 const args=vi.mocked(fetcher).mock.calls[0];expect(args[0]).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');expect(String(args[1]?.body)).not.toContain('DO_NOT_SEND');expect(JSON.parse(String(args[1]?.body)).max_tokens).toBe(300);expect(args[1]?.redirect).toBe('error');
 expect((await call()).statusCode).toBe(429);for(let i=0;i<4;i++){now+=61000;expect((await call()).statusCode).toBe(200);}
 await app.close();app=createServer(db,8787,options);now+=61000;expect((await call()).statusCode).toBe(429);
 expect((await app.inject({url:'/api/ai/status',headers})).body).not.toContain(secret);expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(5);
 now+=86400000;expect((await call()).statusCode).toBe(200);await app.close();db.close();
});
