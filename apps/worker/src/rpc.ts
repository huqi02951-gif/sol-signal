import type {Store} from '../../../packages/storage/src/index';
const ALLOWED=new Set(['getTransaction','getSignaturesForAddress','getSignatureStatuses','getSlot','getAccountInfo','getTokenSupply','getMultipleAccounts','getTokenAccountsByOwner','getMinimumBalanceForRentExemption']);
export type Priority='live'|'background';
type Task={method:string;params:unknown[];priority:Priority;resolve:(v:unknown)=>void;reject:(e:unknown)=>void;endpoint:number;queuedAt:number};
export class Rpc {
 private queue:Task[]=[];
 private active=0;
 private backgroundActive=0;
 private lastStart=0;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private highRun=0;
 private cooldown=0;
 private urls:string[];
 private concurrency:number;
 private maxQueue:number;
 private usageKey:string;
 constructor(url:string,private store:Store,private intervalMs=500,private budget=20000,options:{backupUrl?:string;concurrency?:number;maxQueue?:number;usageKey?:string}={}){
  this.usageKey=options.usageKey??'rpcUsage';this.urls=[url,...(options.backupUrl&&options.backupUrl!==url?[options.backupUrl]:[])];this.concurrency=options.concurrency??1;this.maxQueue=options.maxQueue??200;
  if(!Number.isFinite(intervalMs)||intervalMs<0||!Number.isSafeInteger(budget)||budget<1||!Number.isSafeInteger(this.concurrency)||this.concurrency<1||this.concurrency>8)throw new Error('invalid RPC limits');
 }
 call<T>(method:string,params:unknown[]=[],priority:Priority=method==='getTransaction'?'live':'background'):Promise<T>{
  if(!ALLOWED.has(method))return Promise.reject(new Error('RPC method not permitted'));
  if(this.queue.length>=this.maxQueue)return Promise.reject(new Error('RPC queue capacity exceeded; durable job must retry'));
  return new Promise<T>((resolve,reject)=>{this.queue.push({method,params,priority,queuedAt:Date.now(),resolve:resolve as (v:unknown)=>void,reject,endpoint:this.cooldown>Date.now()&&this.urls.length>1?1:0});this.pump();});
 }
 stats(){return {queued:this.queue.length,inFlight:this.active,concurrency:this.concurrency,intervalMs:this.intervalMs,backupConfigured:this.urls.length>1,primaryCoolingDown:this.cooldown>Date.now()};}
 private pump(){
  if(this.timer||this.active>=this.concurrency||!this.queue.length)return;
  const wait=Math.max(0,this.lastStart+this.intervalMs-Date.now(),this.urls.length===1?this.cooldown-Date.now():0);
  if(wait){this.timer=setTimeout(()=>{this.timer=undefined;this.pump();},wait);return;}
  const high=this.queue.findIndex(t=>t.priority==='live'),low=this.concurrency>1&&this.backgroundActive>=this.concurrency-1?-1:this.queue.findIndex(t=>t.priority==='background');
  if(high<0&&low<0)return;
  const index=high>=0&&(low<0||this.highRun<8)?high:low>=0?low:0;
  const task=this.queue.splice(index,1)[0];this.highRun=task.priority==='live'?this.highRun+1:0;this.active++;if(task.priority==='background')this.backgroundActive++;this.lastStart=Date.now();
  void this.execute(task).then(task.resolve,error=>{
   const transient=error instanceof Error && /^(RPC HTTP (429|5\d\d)|RPC transport unavailable)/.test(error.message);
   if(transient&&task.endpoint===0&&this.urls.length===1)this.cooldown=Date.now()+30000;
   if(transient&&task.endpoint===0&&this.urls.length>1){this.cooldown=Date.now()+60000;this.queue.push({...task,endpoint:1});}else task.reject(error);
  }).finally(()=>{this.active--;if(task.priority==='background')this.backgroundActive--;this.pump();});
  this.pump();
 }
 private async execute(task:Task){
  const day=new Date().toISOString().slice(0,10);const usage=this.store.get(this.usageKey,{day,count:0});if(usage.day!==day){usage.day=day;usage.count=0;}
  if(usage.count>=this.budget)throw new Error('daily RPC budget exhausted');usage.count++;this.store.set(this.usageKey,usage);
  const startedAt=Date.now();let res:Response;try{res=await fetch(this.urls[task.endpoint],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:usage.count,method:task.method,params:task.params}),signal:AbortSignal.timeout(15000)});}catch{throw new Error('RPC transport unavailable');}
  const headersAt=Date.now();
  if(!res.ok)throw new Error(`RPC HTTP ${res.status}`);
  const j=await res.json() as {result:unknown;error?:{code:number}};if(j.error)throw new Error(`RPC error ${j.error.code}`);if(task.method==='getTransaction'&&typeof task.params[0]==='string')this.store.set('rpcTiming:'+task.params[0],{queuedAt:task.queuedAt,startedAt,headersAt,completedAt:Date.now(),providerTiming:res.headers?.get('server-timing')??null,attemptsIncludeEarlierFailures:false});return j.result;
 }
}
