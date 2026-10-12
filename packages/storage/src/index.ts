import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaults, settingsSchema, type Settings, type Swap, type Position, type Quote, type Event, type Provenance } from '../../shared/src/index';
import { decide } from '../../strategy/src/index';
export interface Job {signature:string;slot:number;seen:number;source:string;provenance:Provenance;attempts:number;next:number}
export class Store {
 readonly db:DatabaseSync;
 constructor(path=process.env.DB_PATH||'data/sol-signal.sqlite') {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS config(version INTEGER PRIMARY KEY AUTOINCREMENT,time INTEGER NOT NULL,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,time INTEGER NOT NULL,value TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS events_time ON events(time);
   CREATE TABLE IF NOT EXISTS raw(signature TEXT PRIMARY KEY,slot INTEGER,time INTEGER,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS swaps(id TEXT PRIMARY KEY,time INTEGER NOT NULL,mint TEXT NOT NULL,provenance TEXT NOT NULL,value TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS swaps_mint_time ON swaps(mint,provenance,time);
   CREATE TABLE IF NOT EXISTS positions(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS jobs(signature TEXT PRIMARY KEY,slot INTEGER,seen INTEGER,source TEXT,provenance TEXT,attempts INTEGER DEFAULT 0,next INTEGER DEFAULT 0);
   CREATE TABLE IF NOT EXISTS relations(id TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  this.transaction(()=>{if(!this.db.prepare('SELECT version FROM config LIMIT 1').get())this.saveSettings(defaults);});
 }
 transaction<T>(fn:()=>T):T {this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 get<T>(key:string,fallback:T):T {const r=this.db.prepare('SELECT value FROM kv WHERE key=?').get(key);return r?JSON.parse(String(r.value)):fallback;}
 set(key:string,value:unknown){this.db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
 settings():{version:number;time:number;value:Settings}{const r=this.db.prepare('SELECT * FROM config ORDER BY version DESC LIMIT 1').get()!;return {version:Number(r.version),time:Number(r.time),value:JSON.parse(String(r.value))};}
 saveSettings(input:unknown){const v=settingsSchema.parse(input);return this.db.prepare('INSERT INTO config(time,value) VALUES(?,?)').run(Date.now(),JSON.stringify(v));}
 audit(){return this.db.prepare('SELECT * FROM config ORDER BY version DESC LIMIT 100').all().map(r=>({...r,value:JSON.parse(String(r.value))}));}
 event(event:Event){this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?)').run(event.id,event.time,JSON.stringify(event));}
 events(limit=100):Event[]{return this.db.prepare('SELECT value FROM events ORDER BY time DESC LIMIT ?').all(limit).map(r=>JSON.parse(String(r.value)));}
 enqueue(job:Omit<Job,'attempts'|'next'>){if(this.db.prepare('SELECT signature FROM raw WHERE signature=?').get(job.signature))return;this.db.prepare('INSERT OR IGNORE INTO jobs(signature,slot,seen,source,provenance) VALUES(?,?,?,?,?)').run(job.signature,job.slot,job.seen,job.source,job.provenance);}
 jobs(sources?:string[]):Job[]{const filter=sources?.flatMap(s=>[s,'backfill:'+s]);const clause=filter?.length?' AND source IN ('+filter.map(()=>'?').join(',')+')':'';return this.db.prepare('SELECT * FROM jobs WHERE next<=?'+clause+" ORDER BY CASE provenance WHEN 'LIVE' THEN 0 ELSE 1 END, slot, seen LIMIT 20").all(Date.now(),...(filter||[])) as unknown as Job[];}
 jobCount(sources?:string[]){const filter=sources?.flatMap(s=>[s,'backfill:'+s]);const clause=filter?.length?' WHERE source IN ('+filter.map(()=>'?').join(',')+')':'';return Number(this.db.prepare('SELECT count(*) n FROM jobs'+clause).get(...(filter||[]))!.n);}

 retry(job:Job){const n=job.attempts+1;this.db.prepare('UPDATE jobs SET attempts=?,next=? WHERE signature=?').run(n,Date.now()+Math.min(300000,1000*2**Math.min(n,9)),job.signature);}
 saveRaw(signature:string,slot:number,time:number,raw:unknown){this.db.prepare('INSERT OR IGNORE INTO raw VALUES(?,?,?,?)').run(signature,slot,time,JSON.stringify(raw));this.db.prepare('DELETE FROM jobs WHERE signature=?').run(signature);}
 raw(limit=50):{signature:string;value:unknown}[]{return this.db.prepare('SELECT signature,value FROM raw ORDER BY slot DESC LIMIT ?').all(limit).map(r=>({signature:String(r.signature),value:JSON.parse(String(r.value))}));}
 positions():Position[]{return this.db.prepare('SELECT value FROM positions').all().map(r=>JSON.parse(String(r.value)));}
 swaps(limit=100):Swap[]{return this.db.prepare('SELECT value FROM swaps ORDER BY time DESC LIMIT ?').all(limit).map(r=>JSON.parse(String(r.value)));}
 apply(s:Swap,q:Quote|null,healthy:boolean) {
  return this.transaction(()=>{
   const inserted=this.db.prepare('INSERT OR IGNORE INTO swaps VALUES(?,?,?,?,?)').run(s.id,s.time,s.mint,s.provenance,JSON.stringify(s));
   if(!inserted.changes)return {kind:'ignore',reason:'duplicate event'};
   const conf=this.settings();const key=s.provenance+':'+s.mint;
   const row=this.db.prepare('SELECT value FROM positions WHERE key=?').get(key);
   const history=this.db.prepare('SELECT value FROM swaps WHERE mint=? AND provenance=? AND time>=? AND time<?').all(s.mint,s.provenance,s.time-conf.value.entryWindowSeconds*1000,s.time).map(r=>JSON.parse(String(r.value)));
   const d=decide(s,conf.value,row?JSON.parse(String(row.value)):null,history,q,conf.version,healthy);
   if(d.position){this.db.prepare('INSERT INTO positions VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(d.position));}
   this.event({id:s.id,kind:d.kind==='ignore'?'swap':`paper_${d.kind}`,signature:s.signature,time:s.receivedAt,provenance:s.provenance,detail:{swap:s,decision:d.reason,quote:q,configVersion:conf.version}});
   return d;
  });
 }
 finalize(signature:string,reverted:boolean) {
  this.transaction(()=>{
   const rows=this.db.prepare('SELECT id,value FROM swaps WHERE json_extract(value,\'$.signature\')=?').all(signature);
   for(const row of rows){const s:Swap=JSON.parse(String(row.value));s.commitment=reverted?'reverted':'finalized';this.db.prepare('UPDATE swaps SET value=? WHERE id=?').run(JSON.stringify(s),s.id);}
   if(reverted){for(const p of this.positions())if(rows.some(r=>r.id===p.openEvent||r.id===p.closeEvent)){p.status='invalidated';p.reason='source transaction reverted; manual replay required';this.db.prepare('UPDATE positions SET value=? WHERE key=?').run(JSON.stringify(p),p.provenance+':'+p.mint);}}
  });
 }
 relations(){return this.db.prepare('SELECT value FROM relations').all().map(r=>JSON.parse(String(r.value)));}
 relation(id:string,value:unknown){this.db.prepare('INSERT OR IGNORE INTO relations VALUES(?,?)').run(id,JSON.stringify(value));}
 close(){this.db.close();}
}
