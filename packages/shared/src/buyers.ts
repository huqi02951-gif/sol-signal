import {WALLETS,type Swap,type Settings} from './index';
export function buyerSummary(swaps:Swap[],settings:Settings,holdings:Record<string,{totalRaw:string|null;complete:boolean;source:string}>={}){
 const mints=new Map<string,{mint:string;unknown:Set<string>;excluded:Set<string>;maximum:bigint;large:Array<{signature:string;owner:string;lamports:string;time:number}>;samples:number}>();
 for(const s of swaps){if(s.provenance!=='LIVE'||!s.success||s.commitment==='reverted')continue;let row=mints.get(s.mint);if(!row){row={mint:s.mint,unknown:new Set(),excluded:new Set(),maximum:0n,large:[],samples:0};mints.set(s.mint,row);}row.samples++;
  if(WALLETS.includes(s.owner)||settings.excluded.some(a=>a.address===s.owner)||settings.publicServices.some(a=>a.address===s.owner)||(settings.excludeSuspected&&settings.suspected.some(a=>a.address===s.owner))){row.excluded.add(s.owner);continue;}
  row.unknown.add(s.owner);const amount=BigInt(s.lamports);if(amount>row.maximum)row.maximum=amount;
  // Display a shortlist; this does not aggregate separate trades into the exit condition.
  row.large.push({signature:s.signature,owner:s.owner,lamports:s.lamports,time:s.time});
 }
 return [...mints.values()].map(row=>({mint:row.mint,unexcludedIndependentBuyers:row.unknown.size,confirmedExcludedBuyers:row.excluded.size,maximumSingleLamports:row.maximum.toString(),largeBuys:row.large.sort((a,b)=>BigInt(a.lamports)>BigInt(b.lamports)?-1:1).slice(0,10),samples:row.samples,relatedHoldingsRatio:null,relatedHoldingsRaw:holdings[row.mint]?.totalRaw??null,holdingsScope:holdings[row.mint]?.source??null,holdingsComplete:holdings[row.mint]?.complete??false,scope:'processed LIVE supported swaps in returned sample; unknown buyers are not proven external; holdings unavailable'}));
}
