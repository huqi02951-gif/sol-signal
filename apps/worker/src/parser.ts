import bs58 from 'bs58';
import { z } from 'zod';
import pump from '../../../vendor/pump-schema.json';
import amm from '../../../vendor/pump_amm-schema.json';
import cp from '../../../vendor/raydium_cp_swap-schema.json';
import clmm from '../../../vendor/raydium_clmm-schema.json';
import type { Swap, Provenance } from '../../../packages/shared/src/index';
export const WSOL='So11111111111111111111111111111111111111112';
const schemas=[pump,amm,cp,clmm];
export const PROGRAMS=schemas.map(x=>x.address);
// Narrow RPC envelope validation; protocol bytes below are separately bounds checked.
const txSchema=z.object({slot:z.number(),blockTime:z.number().nullable(),transaction:z.object({signatures:z.array(z.string()),message:z.object({accountKeys:z.array(z.union([z.string(),z.object({pubkey:z.string()}).passthrough()])),instructions:z.array(z.unknown())}).passthrough()}),meta:z.object({err:z.unknown(),logMessages:z.array(z.string()).nullable(),postTokenBalances:z.array(z.unknown()).optional(),preTokenBalances:z.array(z.unknown()).optional(),innerInstructions:z.array(z.unknown()).nullable().optional()}).passthrough()}).passthrough();
type Ix={programId?:string;programIdIndex?:number;accounts?:Array<string|number>;data?:string;parsed?:{type:string;info:Record<string,unknown>};stackHeight?:number};
type Balance={accountIndex:number;mint:string;owner?:string;uiTokenAmount:{amount:string;decimals:number}};
type Field={name:string;type:unknown};
type Schema={address:string;instructions:Array<{name:string;discriminator:number[];accounts:Array<{name:string}>}>;events:Array<{name:string;discriminator:number[]}>;types:Record<string,Field[]>};
function decode(buf:Buffer,fields:Field[],types:Record<string,Field[]>):Record<string,unknown>{
 let o=8;
 const take=(n:number)=>{if(o+n>buf.length)throw new Error('event truncated');const b=buf.subarray(o,o+n);o+=n;return b;};
 const read=(t:unknown):unknown=>{
  if(t==='pubkey')return bs58.encode(take(32));
  if(t==='bool'){const b=take(1)[0];if(b>1)throw new Error('invalid bool');return b===1;}
  if(t==='string'){const n=take(4).readUInt32LE();if(n>1024)throw new Error('oversize event');return take(n).toString();}
  if(typeof t==='string'&&/^[ui](8|16|32|64|128)$/.test(t)){
   const n=Number(t.slice(1))/8;const b=take(n);let x=0n;for(let i=n-1;i>=0;i--)x=x*256n+BigInt(b[i]);if(t[0]==='i'&&(b[n-1]&128))x-=1n<<BigInt(n*8);return x.toString();
  }
  const v=t as {vec?:unknown;defined?:{name:string}};
  if(v.vec){const n=take(4).readUInt32LE();if(n>100)throw new Error('oversize vector');return Array.from({length:n},()=>read(v.vec));}
  if(v.defined)return Object.fromEntries(types[v.defined.name].map(f=>[f.name,read(f.type)]));
  throw new Error('unsupported field');
 };
 const out:Record<string,unknown>={};
 for(const f of fields){if(o===buf.length)break;out[f.name]=read(f.type);} // append-only old event layouts supported
 return out;
}
export function parseTransaction(raw:unknown,provenance:Provenance,receivedAt=Date.now()):{swaps:Swap[];pools:Array<{mint:string;pool:string;protocol:string}>;reason:string;transfers:Array<{from:string;to:string;lamports:string}>}{
 const tx=txSchema.parse(raw);const signature=tx.transaction.signatures[0];
 if(tx.meta.err!==null)return {swaps:[],pools:[],transfers:[],reason:'failed transaction'};
 const keys=tx.transaction.message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey);
 const instructions:Ix[]=[...tx.transaction.message.instructions as Ix[],...(tx.meta.innerInstructions||[]).flatMap(x=>(x as {instructions:Ix[]}).instructions)];
 const balances=[...(tx.meta.preTokenBalances||[]),...(tx.meta.postTokenBalances||[])] as Balance[];
 const ownerOf=(account:string)=>balances.filter(b=>keys[b.accountIndex]===account).at(-1);
 const matched:Array<{schema:Schema;ix:Ix;name:string;accounts:Record<string,string>}> = [];
 const pools:Array<{mint:string;pool:string;protocol:string}>=[];
 for(const ix of instructions){
  const schema=schemas.find(x=>x.address===(ix.programId??keys[ix.programIdIndex??-1])) as Schema|undefined;if(!schema||!ix.data||!ix.accounts)continue;
  let b:Uint8Array;try{b=bs58.decode(ix.data);}catch{continue;}
  const method=schema.instructions.find(m=>Buffer.from(m.discriminator).equals(Buffer.from(b.slice(0,8))));if(!method)continue;
  const accounts=Object.fromEntries(method.accounts.map((a,i)=>[a.name,typeof ix.accounts![i]==='number'?keys[ix.accounts![i] as number]:ix.accounts![i] as string]));
  matched.push({schema,ix,name:method.name,accounts});
  if(schema.address===pump.address&&method.name==='migrate'&&accounts.mint&&accounts.pool)pools.push({mint:accounts.mint,pool:accounts.pool,protocol:'pumpswap'});
 }
 const events:Array<{program:string;name:string;value:Record<string,unknown>}>=[];const stack:string[]=[];
 for(const log of tx.meta.logMessages||[]){
  const start=log.match(/^Program (\w+) invoke \[\d+\]/);if(start){stack.push(start[1]);continue;}
  const end=log.match(/^Program (\w+) (success|failed:)/);if(end){const at=stack.lastIndexOf(end[1]);if(at>=0)stack.splice(at);continue;}
  if(!log.startsWith('Program data: '))continue;
  const schema=schemas.find(x=>x.address===stack.at(-1)) as Schema|undefined;if(!schema)continue;
  const b=Buffer.from(log.slice(14),'base64');const event=schema.events.find(x=>Buffer.from(x.discriminator).equals(b.subarray(0,8)));if(!event)continue;
  try{events.push({program:schema.address,name:event.name,value:decode(b,schema.types[event.name],schema.types)});}catch{/* malformed event never becomes a buy */}
 }
 const swaps:Swap[]=[];const consumed=new Set<number>();
 for(const [index,event] of events.entries()){
  const v=event.value;const candidates=matched.map((m,i)=>({m,i})).filter(({m,i})=>m.schema.address===event.program&&!consumed.has(i)&&m.name!=='migrate');
  const match=candidates.find(({m})=>{
   if(event.program===pump.address)return m.accounts.mint===v.mint&&m.accounts.user===v.user;
   if(event.program===amm.address)return m.accounts.pool===v.pool&&m.accounts.user===v.user;
   return m.accounts.pool_state===(v.pool_id??v.pool_state);
  });if(!match)continue;
  const a=match.m.accounts;let mint:string|undefined,pool:string|undefined,owner:string|undefined,amount:unknown,tokens:unknown,receiver:string|undefined,protocol:string;
  if(event.program===pump.address){
   if(v.is_buy!==true||v.quote_mint&&v.quote_mint!==WSOL&&v.quote_mint!=='11111111111111111111111111111111')continue;
   mint=String(v.mint);owner=String(v.user);pool=a.bonding_curve;amount=v.quote_amount??v.sol_amount;tokens=v.token_amount;receiver=a.associated_user;protocol='pump';
  }else if(event.program===amm.address){
   if(a.quote_mint!==WSOL)continue;mint=a.base_mint;pool=a.pool;owner=a.user;amount=v.user_quote_amount_in;tokens=v.base_amount_out;receiver=a.user_base_token_account;protocol='pumpswap';
  }else {
   const input=ownerOf(a.input_token_account),output=ownerOf(a.output_token_account);
   if(!input||input.mint!==WSOL||!output||input.owner!==output.owner)continue;
   mint=output.mint;owner=output.owner;pool=a.pool_state;receiver=a.output_token_account;protocol=event.program===cp.address?'raydium-cpmm':'raydium-clmm';
   if(event.program===cp.address){amount=v.input_amount;tokens=v.output_amount;}
   else {amount=v.zero_for_one?v.amount_0:v.amount_1;tokens=v.zero_for_one?v.amount_1:v.amount_0;}
  }
  const balance=receiver?ownerOf(receiver):undefined;
  if(!owner||!mint||!pool||balance?.owner!==owner||balance.mint!==mint||!/^[0-9]+$/.test(String(amount))||!/^[0-9]+$/.test(String(tokens))||BigInt(String(tokens))===0n)continue;
  consumed.add(match.i);pools.push({mint,pool,protocol});
  swaps.push({chainTimeKnown:tx.blockTime!==null,id:`${signature}:${index}`,signature,index,slot:tx.slot,time:(tx.blockTime??Math.floor(receivedAt/1000))*1000,receivedAt,owner,mint,pool,protocol,lamports:String(amount),tokenRaw:String(tokens),success:true,commitment:'confirmed',provenance,buyerClass:'unknown'});
 }
 const transfers=instructions.filter(ix=>ix.programId==='11111111111111111111111111111111'&&ix.parsed?.type==='transfer').map(ix=>({from:String(ix.parsed!.info.source),to:String(ix.parsed!.info.destination),lamports:String(ix.parsed!.info.lamports)}));
 return {swaps,pools,transfers,reason:swaps.length?'verified protocol buy':'no supported verified SOL swap buy'};
}
