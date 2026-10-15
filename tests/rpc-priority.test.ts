import {it,expect,vi} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {Rpc} from '../apps/worker/src/rpc';
it('a live fetch overtakes queued history without increasing the rate budget',async()=>{
 const db=new Store(':memory:');let release!:()=>void;const order:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_u:string,o:{body:string})=>{const j=JSON.parse(o.body);order.push(j.method);if(order.length===1)await new Promise<void>(r=>release=r);return {ok:true,json:async()=>({result:1})};}));
 const rpc=new Rpc('https://primary.invalid',db,0,100);
 const first=rpc.call('getSlot');await new Promise(r=>setTimeout(r,5));
 const background=Array.from({length:10},()=>rpc.call('getSlot'));
 const live=rpc.call('getTransaction',['signature']);release();await Promise.all([first,...background,live]);
 expect(order[1]).toBe('getTransaction');expect(db.get('rpcUsage',{count:0}).count).toBe(12);vi.unstubAllGlobals();db.close();
});
it('fallback consumes the same durable quota and does not leak endpoint credentials',async()=>{
 const db=new Store(':memory:');const urls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(u:string)=>{urls.push(u);return u.includes('primary')?{ok:false,status:429}:{ok:true,json:async()=>({result:42})};}));
 const rpc=new Rpc('https://primary.invalid',db,0,2,{backupUrl:'https://secondary.invalid'});expect(await rpc.call('getSlot')).toBe(42);expect(urls).toHaveLength(2);await expect(rpc.call('getSlot')).rejects.toThrow('budget');expect(db.get('rpcUsage',{count:0}).count).toBe(2);vi.unstubAllGlobals();db.close();
});
it('a rate-limited free provider is cooled down rather than repeatedly hammered',async()=>{
 vi.useFakeTimers();const db=new Store(':memory:');const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:429}).mockResolvedValue({ok:true,json:async()=>({result:1})});vi.stubGlobal('fetch',fetch);
 const rpc=new Rpc('https://single.invalid',db,0,100);await expect(rpc.call('getSlot')).rejects.toThrow('429');const next=rpc.call('getSlot');await vi.advanceTimersByTimeAsync(29999);expect(fetch).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1);expect(await next).toBe(1);vi.useRealTimers();vi.unstubAllGlobals();db.close();
});
it('reserves a concurrent lane for live arrivals while a history request is slow',async()=>{const db=new Store(':memory:');let release!:()=>void;const order:string[]=[];vi.stubGlobal('fetch',async(_u:string,o:{body:string})=>{const j=JSON.parse(o.body);order.push(j.method);if(j.method==='getSlot')await new Promise<void>(r=>release=r);return new Response(JSON.stringify({result:1}));});const rpc=new Rpc('https://example.invalid',db,0,100,{concurrency:2});const first=rpc.call('getSlot');const second=rpc.call('getAccountInfo');await new Promise(r=>setTimeout(r,5));const live=rpc.call('getTransaction',['sig']);await new Promise(r=>setTimeout(r,5));expect(order).toEqual(['getSlot','getTransaction']);release();await Promise.all([first,second,live]);vi.unstubAllGlobals();db.close();});
