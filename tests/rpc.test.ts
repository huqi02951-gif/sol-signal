import {it,expect,vi} from 'vitest';
import {Rpc} from '../apps/worker/src/rpc';
import {Store} from '../packages/storage/src/index';
it('denies transaction submission and stops requests at durable daily budget',async()=>{
 const db=new Store(':memory:');const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({result:12})});vi.stubGlobal('fetch',fetch);
 const rpc=new Rpc('https://example.invalid',db,0,1);await expect(rpc.call('sendTransaction',[])).rejects.toThrow('not permitted');expect(fetch).not.toHaveBeenCalled();expect(await rpc.call('getSlot')).toBe(12);await expect(rpc.call('getSlot')).rejects.toThrow('budget');expect(fetch).toHaveBeenCalledTimes(1);vi.unstubAllGlobals();db.close();
});
