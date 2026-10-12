import {z} from 'zod';
import type {Rpc} from './rpc';
const accountSchema=z.object({context:z.object({slot:z.number().int()}),value:z.array(z.object({account:z.object({data:z.object({parsed:z.object({info:z.object({tokenAmount:z.object({amount:z.string().regex(/^\d+$/).max(20),decimals:z.number().int().min(0).max(18)})})})})})}))});
export async function readKnownHoldings(rpc:Rpc,mint:string,owners:string[]){
 const unique=[...new Set(owners)],selected=unique.slice(0,8);const balances=[];let decimals:number|null=null,total=0n;
 try{
  for(const owner of selected){const response=accountSchema.parse(await rpc.call('getTokenAccountsByOwner',[owner,{mint},{encoding:'jsonParsed',commitment:'confirmed'}],'background'));let raw=0n;for(const row of response.value){const t=row.account.data.parsed.info.tokenAmount;if(decimals!==null&&decimals!==t.decimals)throw new Error('inconsistent token decimals');decimals=t.decimals;raw+=BigInt(t.amount);}total+=raw;balances.push({owner,raw:raw.toString(),slot:response.context.slot});}
  return {mint,time:Date.now(),totalRaw:total.toString(),decimals,balances,complete:selected.length===unique.length,requested:unique.length,source:'RPC token accounts for core/explicit confirmed owners only; not issuer-wide ownership',ratio:null};
 }catch{return {mint,time:Date.now(),totalRaw:null,decimals,balances,complete:false,requested:unique.length,source:'RPC holdings incomplete/unavailable',ratio:null};}
}
