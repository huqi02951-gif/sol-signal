import {it,expect} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {createServer} from '../apps/api/src/server';
it('API rejects hostile origin/host, invalid fields, and stale strategy writes',async()=>{
 const db=new Store(':memory:');const app=createServer(db);const h={host:'localhost:8787','content-type':'application/json'};
 expect((await app.inject({url:'/api/snapshot',headers:{host:'evil.test:8787'}})).statusCode).toBe(403);
 expect((await app.inject({method:'PUT',url:'/api/settings',headers:{...h,origin:'http://evil.test'},payload:{}})).statusCode).toBe(403);
 expect((await app.inject({method:'PUT',url:'/api/settings',headers:h,payload:{value:{}}})).statusCode).toBe(400);
 const v=db.settings();expect((await app.inject({method:'PUT',url:'/api/settings',headers:h,payload:{expectedVersion:v.version,value:{...v.value,exitExternalSingleBuySol:'2.0001'}}})).statusCode).toBe(200);
 expect((await app.inject({method:'PUT',url:'/api/settings',headers:h,payload:{expectedVersion:v.version,value:v.value}})).statusCode).toBe(409);
 const snapshot=(await app.inject({url:'/api/snapshot',headers:h})).json();expect(snapshot.health.connected).toBe(false);expect(snapshot.mode).toContain('PAPER');expect(JSON.stringify(snapshot)).not.toContain('HELIUS_API_KEY');
 await app.close();db.close();
});
