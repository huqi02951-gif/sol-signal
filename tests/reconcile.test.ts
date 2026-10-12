import {it,expect} from 'vitest';
import {Store} from '../packages/storage/src/index';
import {compareReference} from '../apps/worker/src/reconcile';
it('uses independent successful signatures as denominator and does not call pending data zero misses',()=>{
 const db=new Store(':memory:');db.saveRaw('a',1,1,{});
 const data=compareReference(db,[{signature:'a',slot:1,blockTime:1,err:null},{signature:'b',slot:2,blockTime:1,err:null},{signature:'failed',slot:3,blockTime:1,err:'error'}]);
 expect(data.referenceSuccessful).toBe(2);expect(data.pendingOrMissing).toEqual(['b']);expect(data.processedFraction).toBe(.5);expect(compareReference(db,[]).processedFraction).toBeNull();db.close();
});
