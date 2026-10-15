import type {Job} from '../../../packages/storage/src/index';
export function liveJob(job:Job,now=Date.now()){return job.provenance==='LIVE'&&!job.source.startsWith('backfill:')&&now-job.seen<=15000;}
export function dispatchable(jobs:Job[],running:Map<string,boolean>,now=Date.now()):Job[]{
 const out:Job[]=[];let background=[...running.values()].filter(live=>!live).length;
 for(const job of [...jobs].sort((a,b)=>Number(liveJob(b,now))-Number(liveJob(a,now)))){
  if(running.size+out.length>=2)break;if(running.has(job.signature))continue;
  const live=liveJob(job,now);if(!live&&background>=1)continue;if(!live)background++;out.push(job);
 }
 return out;
}
// Archived pool debt may use at most half the existing daily request budget,
// and only while the core-wallet queue is empty. It never opens subscriptions.
export function archiveAllowed(corePending:number,usage:{day:string;count:number},budget:number,lastAt:number,now=Date.now()){
 const count=usage.day===new Date(now).toISOString().slice(0,10)?usage.count:0;
 return corePending===0&&now-lastAt>=5000&&count<Math.floor(budget/2);
}
