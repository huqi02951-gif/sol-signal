import Decimal from 'decimal.js';
import {WALLETS,type Swap,type Settings,type Position,type PurchaseHistory} from '../../shared/src/index';
export type FirstStatus='FIRST'|'NOT_FIRST'|'UNKNOWN';
export interface FirstBuyRecord {signature:string;owner:string;mint:string;time:number;slot:number;lamports:string;status:FirstStatus;usd:string|null;priceSource:string|null;reason:string;reverted?:boolean}
// FIRST requires a complete trade history from token creation through this buy, not a recent-page scan.
export function firstStatus(s:Swap,h:PurchaseHistory|undefined,knownEarlier:boolean):FirstStatus {
 if(s.chainTimeKnown===false)return 'UNKNOWN';
 if(knownEarlier)return 'NOT_FIRST';
 if(!h||h.mint!==s.mint||h.owner!==s.owner||!h.source)return 'UNKNOWN';
 if(h.priorBuys.some(b=>b.signature!==s.signature&&(b.time<s.time||b.time===s.time&&b.slot<=s.slot)))return 'NOT_FIRST';
 if(!h.complete||![h.tokenCreatedAt,h.from,h.through].every(Number.isFinite)||h.from<0||!Number.isFinite(h.tokenCreatedAt)||h.tokenCreatedAt<0||h.from>h.tokenCreatedAt||h.through<s.time||h.tokenCreatedAt>s.time)return 'UNKNOWN';
 return 'FIRST';
}
export function firstRecord(s:Swap,knownEarlier:boolean):FirstBuyRecord {
 const status=firstStatus(s,s.historyEvidence,knownEarlier);const u=s.usdEvidence;
 // Exact event-time value only. Never substitute the latest SOL price for an older trade.
 const valid=s.chainTimeKnown!==false&&!!u&&u.signature===s.signature&&u.at===s.time&&!!u.source&&/^\d+(\.\d+)?$/.test(u.amount)&&new Decimal(u.amount).gt(0);
 return {signature:s.signature,owner:s.owner,mint:s.mint,time:s.time,slot:s.slot,lamports:s.lamports,status,usd:valid?u!.amount:null,priceSource:valid?u!.source:null,reason:status==='UNKNOWN'?'complete purchase history unavailable':status==='NOT_FIRST'?'earlier purchase evidence':'history covers token creation'};
}
export function summarizeFirstBuyers(position:Position,records:FirstBuyRecord[],settings:Settings){
 const owners=new Set<string>();const countedOwners=new Set<string>();let sum=new Decimal(0),orders=0,unknown=0,missingUsd=0;
 const rows=[...records].sort((a,b)=>a.time-b.time||a.slot-b.slot||a.signature.localeCompare(b.signature)).map(r=>{
  let counted=false;const duplicate=owners.has(r.owner);owners.add(r.owner);
  const excluded=WALLETS.includes(r.owner)||settings.excluded.some(a=>a.address===r.owner)||settings.publicServices.some(a=>a.address===r.owner)||(settings.excludeSuspected&&settings.suspected.some(a=>a.address===r.owner));
  if(!excluded&&!r.reverted&&new Decimal(r.lamports).gte(new Decimal(settings.firstBuyMinSol).mul(1e9))){
   if(r.status==='UNKNOWN')unknown++;
   if((!settings.onlyFirstBuyOfToken||r.status==='FIRST')&&(!settings.onlyFirstBuyOfToken||!duplicate)){
    if(r.usd===null)missingUsd++;else {counted=true;countedOwners.add(r.owner);orders++;sum=sum.plus(r.usd);}
   }
  }
  return {...r,counted,excluded};
 });
 const target=new Decimal(settings.firstBuyExitCumulativeUsd);
 return {positionId:position.id,mint:position.mint,provenance:position.provenance,openedAt:position.openedAt,status:position.status,exitReason:position.reason??null,cumulativeUsd:sum.toFixed(2,Decimal.ROUND_DOWN),exactCumulativeUsd:sum.toString(),targetUsd:target.toString(),remainingUsd:Decimal.max(0,target.minus(sum)).toFixed(2,Decimal.ROUND_UP),progressPct:Decimal.min(100,sum.div(target).mul(100)).toNumber(),firstBuyerCount:countedOwners.size,countedOrders:orders,unknownCount:unknown,missingUsdCount:missingUsd,distinctObservedOwners:owners.size,completeness:'PARTIAL' as const,completenessReason:'history/price evidence checked per trade; independent all-pool reconciliation required',records:rows};
}
