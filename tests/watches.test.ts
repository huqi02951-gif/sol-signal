import {it,expect} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {Watches} from '../apps/worker/src/watches';
it('observes candidates before entry with a finite pool budget and expiry',()=>{
 const db=new Store(':memory:');const registry=new Watches(db,1,1000);const pool={pool:'a',mint:'m',protocol:'pump',signature:'real-signature',discoveredAt:100};
 expect(registry.discover(pool,100)).toBe(true);expect(registry.list(200)[0].kind).toBe('candidate');expect(registry.discover({...pool,pool:'b'},200)).toBe(false);expect(registry.list(1101)).toHaveLength(0);expect(registry.discover({...pool,pool:'b'},1101)).toBe(true);db.close();
});
