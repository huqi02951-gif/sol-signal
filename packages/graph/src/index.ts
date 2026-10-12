import type {Store} from '../../storage/src/index';
import {WALLETS} from '../../shared/src/index';
export function recordTransfers(store:Store,signature:string,time:number,transfers:Array<{from:string;to:string;lamports:string}>,blocked:Set<string>,provenance:string){
 for(const [i,t] of transfers.entries()){
  if(t.from===t.to||blocked.has(t.from)||blocked.has(t.to)||(!WALLETS.includes(t.from)&&!WALLETS.includes(t.to)))continue;
  store.relation(`${signature}:${i}`,{id:`${signature}:${i}`,source:t.from,target:t.to,signature,time,amountLamports:t.lamports,type:'observed transfer',confidence:'weak',provenance,sameController:false});
 }
}
export interface Relation {id:string;source:string;target:string;signature:string;time:number;amountLamports:string;provenance:string;type:string;confidence:string}
export function analyzeFunding(relations:Relation[],roots:string[],publicServices:string[],maxDepth=3){
 const blocked=new Set(publicServices);const edges=relations.filter(e=>e.signature&&!blocked.has(e.source)&&!blocked.has(e.target)&&e.provenance!=='DEMO');
 const incoming=new Map<string,Relation[]>();for(const e of edges){const a=incoming.get(e.target)||[];a.push(e);incoming.set(e.target,a);}
 const paths:Array<{root:string;ancestor:string;signatures:string[];wallets:string[]}>=[];
 for(const root of roots){const queue=[{address:root,signatures:[] as string[],wallets:[root]}];const seen=new Set([root]);let cursor=0;
  while(cursor<queue.length&&cursor<1000){const node=queue[cursor++];if(node.signatures.length>=maxDepth)continue;for(const edge of incoming.get(node.address)||[]){if(seen.has(edge.source))continue;seen.add(edge.source);const next={address:edge.source,signatures:[edge.signature,...node.signatures],wallets:[edge.source,...node.wallets]};paths.push({root,ancestor:edge.source,signatures:next.signatures,wallets:next.wallets});queue.push(next);}}
 }
 const common=new Map<string,typeof paths>();for(const p of paths){const a=common.get(p.ancestor)||[];a.push(p);common.set(p.ancestor,a);}
 const suspects=[...common].filter(([,a])=>new Set(a.map(p=>p.root)).size>1).map(([ancestor,paths])=>({ancestor,roots:[...new Set(paths.map(p=>p.root))],paths,status:'suspected',confidence:'weak',sameController:false,evidenceSignatures:[...new Set(paths.flatMap(p=>p.signatures))]}));
 return {paths,suspects,scope:'stored transfer evidence only; missing paths are not evidence of no relationship; public-services list is explicit, not exhaustive',maxDepth};
}
