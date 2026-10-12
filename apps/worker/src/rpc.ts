import type {Store} from '../../../packages/storage/src/index';
const ALLOWED=new Set(['getTransaction','getSignaturesForAddress','getSignatureStatuses','getSlot','getAccountInfo','getTokenSupply']);
export class Rpc {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private url:string,private store:Store,private intervalMs=500,private budget=20000){}
 call<T>(method:string,params:unknown[]=[]):Promise<T>{
  if(!ALLOWED.has(method))return Promise.reject(new Error('RPC method not permitted'));
  const task=this.tail.then(async()=>{
   const day=new Date().toISOString().slice(0,10);const usage=this.store.get('rpcUsage',{day,count:0});if(usage.day!==day){usage.day=day;usage.count=0;}
   if(usage.count>=this.budget)throw new Error('daily RPC budget exhausted');usage.count++;this.store.set('rpcUsage',usage);
   const res=await fetch(this.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:usage.count,method,params}),signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw new Error(`RPC HTTP ${res.status}`);
   const j=await res.json() as {result:T;error?:{code:number}};if(j.error)throw new Error(`RPC error ${j.error.code}`);return j.result;
  });
  this.tail=task.catch(()=>undefined).then(()=>new Promise(resolve=>setTimeout(resolve,this.intervalMs)));return task;
 }
}
