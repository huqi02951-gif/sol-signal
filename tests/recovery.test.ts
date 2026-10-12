import {it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../packages/storage/src/index';
it('queued signatures, retries and cursor survive process restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sol-recovery-'));const path=join(dir,'state.sqlite');let db=new Store(path);
 db.enqueue({signature:'sig',slot:12,seen:10,source:'wallet',provenance:'LIVE'});db.enqueue({signature:'sig',slot:12,seen:11,source:'pool',provenance:'LIVE'});expect(db.jobCount()).toBe(1);db.set('cursor:wallet','sig');db.close();db=new Store(path);expect(db.jobCount()).toBe(1);expect(db.get('cursor:wallet',null)).toBe('sig');db.saveRaw('sig',12,100,{});db.enqueue({signature:'sig',slot:12,seen:11,source:'wallet',provenance:'LIVE'});expect(db.jobCount()).toBe(0);db.close();rmSync(dir,{recursive:true});
});
it('core queue excludes unpositioned pools and prioritizes live evidence',()=>{
 const db=new Store(':memory:');db.enqueue({signature:'history',slot:1,seen:1,source:'backfill:wallet',provenance:'HISTORY'});db.enqueue({signature:'pool',slot:2,seen:2,source:'pool',provenance:'LIVE'});db.enqueue({signature:'live',slot:3,seen:3,source:'wallet',provenance:'LIVE'});expect(db.jobs(['wallet']).map(x=>x.signature)).toEqual(['live','history']);expect(db.jobCount(['wallet'])).toBe(2);expect(db.jobCount()).toBe(3);db.close();
});
it('an actual websocket receipt upgrades a queued backfill item without losing deduplication',()=>{
 const db=new Store(':memory:');db.enqueue({signature:'s',slot:1,seen:100,source:'backfill:wallet',provenance:'HISTORY'});db.enqueue({signature:'s',slot:1,seen:120,source:'wallet',provenance:'LIVE'});expect(db.jobCount()).toBe(1);expect(db.job('s')?.source).toBe('wallet');expect(db.job('s')?.provenance).toBe('LIVE');expect(db.job('s')?.seen).toBe(120);db.close();
});
it('genuine websocket work overtakes even LIVE-labelled history repair',()=>{
 const db=new Store(':memory:');db.enqueue({signature:'repair',slot:1,seen:1,source:'backfill:wallet',provenance:'LIVE'});db.enqueue({signature:'ws',slot:2,seen:2,source:'wallet',provenance:'LIVE'});expect(db.jobs(['wallet'])[0].signature).toBe('ws');db.close();
});
