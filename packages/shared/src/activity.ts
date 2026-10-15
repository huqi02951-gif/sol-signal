import {WALLETS,type Swap,type Settings} from './index';
import {firstStatus} from '../../strategy/src/first-buyers';
export interface ActivityRelation {source:string;target:string;signature:string;provenance:string}
export function buyerActivity(swaps:Swap[],settings:Settings,relations:ActivityRelation[],from:number,to:number){
 const valid=swaps.filter(s=>s.provenance!=='DEMO'&&s.success&&s.commitment!=='reverted'&&s.time>=from&&s.time<=to);
 const groups=new Map<string,Swap[]>();for(const s of valid){const a=groups.get(s.mint)??[];a.push(s);groups.set(s.mint,a);}
 const publicSet=new Set(settings.publicServices.map(s=>s.address));const known=new Set([...WALLETS,...settings.excluded.map(s=>s.address)]);
 return [...groups].map(([mint,rows])=>{
  const owners=new Set(rows.map(s=>s.owner));const suspects=new Map<string,string[]>();
  for(const e of relations){if(e.provenance==='DEMO'||publicSet.has(e.source)||publicSet.has(e.target))continue;
   if((owners.has(e.source)||known.has(e.source))&&(owners.has(e.target)||known.has(e.target))){for(const a of [e.source,e.target]){const proofs=suspects.get(a)??[];proofs.push(e.signature);suspects.set(a,proofs);}}
  }
  const buyers=[...owners].map(owner=>{
   const trades=rows.filter(s=>s.owner===owner).sort((a,b)=>a.time-b.time||a.slot-b.slot);const first=trades[0];
   const earlier=swaps.some(s=>s.provenance===first.provenance&&s.mint===mint&&s.owner===owner&&s.success&&s.commitment!=='reverted'&&s.signature!==first.signature&&(s.time<first.time||s.time===first.time&&s.slot<first.slot));
   const evidence=suspects.get(owner)??[];const manual=settings.suspected.find(s=>s.address===owner);
   const classification=known.has(owner)?'KNOWN_RELATED':publicSet.has(owner)?'PUBLIC_SERVICE':evidence.length||manual?'SUSPECTED_RELATED':'NO_KNOWN_LINK';
   return {owner,classification,firstPurchase:firstStatus(first,first.historyEvidence,earlier),buys:new Set(trades.map(s=>s.signature)).size,lastAt:trades.at(-1)!.time,signature:first.signature,evidenceSignatures:[...new Set(evidence)].slice(0,10)};
  });
  return {mint,from,to,lastTradeAt:Math.max(...rows.map(s=>s.time)),tradeCount:new Set(rows.map(s=>s.signature)).size,observedOwners:owners.size,knownRelated:buyers.filter(b=>b.classification==='KNOWN_RELATED').length,suspectedRelated:buyers.filter(b=>b.classification==='SUSPECTED_RELATED').length,noKnownLink:buyers.filter(b=>b.classification==='NO_KNOWN_LINK').length,verifiedExternal:null,verifiedFirst:buyers.filter(b=>b.firstPurchase==='FIRST').length,unknownFirst:buyers.filter(b=>b.firstPurchase==='UNKNOWN').length,completeness:'PARTIAL',buyers:buyers.slice(0,100),scope:'up to 10000 stored supported buys in selected chain-time window; not all-chain buyers; issuer identity unverified'};
 }).sort((a,b)=>b.lastTradeAt-a.lastTradeAt);
}
