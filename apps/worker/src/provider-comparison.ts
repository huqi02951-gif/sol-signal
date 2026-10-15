import {address} from '../../../packages/shared/src/index';
export interface ProviderObservation {provider:string;signature:string;mint:string;owner:string;pool:string;chainTime:number;receivedAt:number;readyAt:number}
export function bitquerySubscription(mints:string[],pools:string[]){
 if(!mints.length||mints.length>4||!pools.length||pools.length>16)throw new Error('comparison scope must be 1–4 tokens and 1–16 pools');mints.forEach(v=>address.parse(v));pools.forEach(v=>address.parse(v));
 return `subscription { Solana { DEXTrades(where: {Transaction: {Result: {Success: true}}, Trade: {Buy: {Currency: {MintAddress: {in: ${JSON.stringify(mints)}}}}, Market: {MarketAddress: {in: ${JSON.stringify(pools)}}}}}) { Block { Time Slot } Transaction { Signature Result { Success } } Trade { Market { MarketAddress } Buy { Account { Owner } AmountInUSD Currency { MintAddress } } Sell { Amount Currency { MintAddress } } } } } }`;
}
export function compareProviders(rows:ProviderObservation[],providers:string[],from:number,to:number,reference?:{provider:string;complete:boolean}){
 const eligible=rows.filter(r=>r.chainTime>=from&&r.chainTime<=to&&r.readyAt>=r.receivedAt&&r.receivedAt>=r.chainTime);
 const key=(r:ProviderObservation)=>[r.signature,r.mint,r.owner].join(':');
 const quantile=(a:number[],q:number)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(a.length*q)-1]:null;
 const referenceKeys=reference?.complete?new Set(eligible.filter(r=>r.provider===reference.provider).map(key)):null;
 return providers.map(provider=>{const unique=[...new Map(eligible.filter(r=>r.provider===provider).map(r=>[key(r),r])).values()];const times=unique.map(r=>r.readyAt-r.chainTime);const keys=new Set(unique.map(key));return {provider,samples:unique.length,chainToReadyMs:{p50:quantile(times,.5),p95:quantile(times,.95),p99:quantile(times,.99)},missingAgainstCompleteReference:referenceKeys?[...referenceKeys].filter(k=>!keys.has(k)).length:null,missRate:referenceKeys?.size?[...referenceKeys].filter(k=>!keys.has(k)).length/referenceKeys.size:null,costUsd:null,scope:'same configured mint+pool+chain-time window; route dedup signature+mint+owner; chainTime second precision'};});
}
