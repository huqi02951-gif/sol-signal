import {it,expect,vi} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {createServer} from '../apps/api/src/server';
it('runtime cannot call models even when legacy model credentials are configured',async()=>{
 vi.stubEnv('AI_ENABLED','true');vi.stubEnv('AI_KEY_PURPOSE','standard_api');vi.stubEnv('AI_PROVIDER','custom');vi.stubEnv('AI_API_KEY','test-only');vi.stubEnv('AI_MODEL','legacy');vi.stubEnv('AI_BASE_URL','https://api.openai.com/v1');
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const db=new Store(':memory:');const app=createServer(db);const headers={host:'localhost:8787','content-type':'application/json'};
 try{expect((await app.inject({url:'/api/ai/status',headers})).json()).toMatchObject({enabled:false,modelCalls:0});expect((await app.inject({method:'POST',url:'/api/ai/summary',headers,payload:{}})).statusCode).toBe(503);expect(fetcher).not.toHaveBeenCalled();}finally{await app.close();db.close();vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
