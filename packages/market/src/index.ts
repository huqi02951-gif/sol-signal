import Decimal from 'decimal.js';
import {z} from 'zod';
import {readFileSync} from 'node:fs';
import {address,type Quote,type Position} from '../../shared/src/index';
import type {Rpc} from '../../../apps/worker/src/rpc';
const WSOL='So11111111111111111111111111111111111111112';
const raw=z.string().regex(/^\d+$/).max(20).refine(s=>BigInt(s)<=18446744073709551615n);
const amount=z.string().regex(/^\d+(\.\d+)?$/);
export const circulationSchema=z.object({mint:address,circulatingSupply:amount,source:z.string().url().refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&![...u.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k));}),observedAt:z.number().int(),expiresAt:z.number().int(),evidence:z.string().min(16),status:z.literal('verified')}).strict();
const pairSchema=z.object({chainId:z.literal('solana'),pairAddress:address,dexId:z.string(),baseToken:z.object({address}),quoteToken:z.object({address}),priceUsd:z.string().nullable().optional(),marketCap:z.number().nullable().optional(),fdv:z.number().nullable().optional()}).passthrough();
const routeSchema=z.object({swapInfo:z.object({ammKey:address,inputMint:address,outputMint:address,feeAmount:raw,feeMint:address}).passthrough()}).passthrough();
const jupiterSchema=z.object({inputMint:address,outputMint:address,inAmount:raw,outAmount:raw,otherAmountThreshold:raw,swapMode:z.literal('ExactIn'),contextSlot:z.number().int(),routePlan:z.array(routeSchema).min(1)}).passthrough();
export interface CoverageEvidence {mint:string;complete:boolean;pools:string[];source:string;checkedAt:number;windowStart:number;unresolved:number;signatures:string[]}
export interface MarketResult {quote:Quote|null;reason:string;pairs:z.infer<typeof pairSchema>[];observedAt:number;displayMarketCapUsd?:number|null;displayFdvUsd?:number|null}
export class Market {
 constructor(private rpc:Rpc,private options:{jupiterKey?:string;circulationFile?:string;maxQuoteRequestsPerDay?:number}={}){}
 private day='';private requests=0;
 private async get(url:string,headers:Record<string,string>={}){
  const day=new Date().toISOString().slice(0,10);if(day!==this.day){this.day=day;this.requests=0;}
  if(this.requests++>=(this.options.maxQuoteRequestsPerDay??2000))throw new Error('market daily request budget exhausted');
  const res=await fetch(url,{headers,signal:AbortSignal.timeout(8000),redirect:'error'});if(!res.ok)throw new Error(`market HTTP ${res.status}`);return res.json();
 }
 async observe(mint:string,sizeSol:string,slot:number,coverage:CoverageEvidence|null,position:Position|null=null):Promise<MarketResult>{
  address.parse(mint);const now=Date.now();let pairs:z.infer<typeof pairSchema>[]=[];
  try{
   pairs=z.array(pairSchema).parse(await this.get(`https://api.dexscreener.com/token-pairs/v1/solana/${mint}`)).filter(p=>p.baseToken.address===mint&&p.quoteToken.address===WSOL);
   const result:MarketResult={quote:null,reason:'verified circulation source not configured',pairs,observedAt:now,displayMarketCapUsd:pairs[0]?.marketCap,displayFdvUsd:pairs[0]?.fdv};
   if(!this.options.circulationFile)return result;
   const records=z.array(circulationSchema).parse(JSON.parse(readFileSync(this.options.circulationFile,'utf8')));const supply=records.find(r=>r.mint===mint);
   if(!supply||supply.observedAt>now||supply.expiresAt<=now)return {...result,reason:'circulation evidence missing/stale'};
   if(!this.options.jupiterKey)return {...result,reason:'read-only Jupiter quote key not configured'};
   const tokenSupply=z.object({value:z.object({amount:raw,decimals:z.number().int().min(0).max(18)})}).parse(await this.rpc.call<{value:{amount:string;decimals:number}}>('getTokenSupply',[mint,{commitment:'confirmed'}],'background'));
   const total=new Decimal(tokenSupply.value.amount).div(new Decimal(10).pow(tokenSupply.value.decimals));
   if(new Decimal(supply.circulatingSupply).lte(0)||new Decimal(supply.circulatingSupply).gt(total))return {...result,reason:'circulation exceeds on-chain supply or is zero'};
   const usd=pairs.map(p=>p.priceUsd).find(p=>p&&new Decimal(p).gt(0));if(!usd)return {...result,reason:'USD price missing'};
   const inRaw=new Decimal(sizeSol).mul(1e9);if(!inRaw.isInteger()||inRaw.lte(0))return {...result,reason:'invalid SOL quote size'};
   const requestQuote=async(inputMint:string,outputMint:string,amountRaw:string)=>{
    const query=new URLSearchParams({inputMint,outputMint,amount:amountRaw,slippageBps:'100',swapMode:'ExactIn',onlyDirectRoutes:'true'});
    const value=jupiterSchema.parse(await this.get('https://api.jup.ag/swap/v1/quote?'+query,{'x-api-key':this.options.jupiterKey!}));
    if(value.inputMint!==inputMint||value.outputMint!==outputMint||value.inAmount!==amountRaw||Math.abs(value.contextSlot-slot)>150||BigInt(value.otherAmountThreshold)<=0n||BigInt(value.otherAmountThreshold)>BigInt(value.outAmount))throw new Error('quote identity/amount/slot validation failed');return value;
   };
   const buy=await requestQuote(WSOL,mint,inRaw.toFixed(0));const tokenRaw=position?.tokenAmount??buy.otherAmountThreshold;
   const sell=await requestQuote(mint,WSOL,tokenRaw);
   const routes=[...new Set([...buy.routePlan,...sell.routePlan].map(r=>r.swapInfo.ammKey))];
   const ready=!!coverage?.complete&&coverage.mint===mint&&coverage.unresolved===0&&coverage.checkedAt<=now&&now-coverage.checkedAt<60000&&routes.every(pool=>coverage.pools.includes(pool))&&pairs.every(p=>coverage.pools.includes(p.pairAddress));
   // Base fee is an explicit one-signature estimate, not an observed fill. Priority/MEV execution is not simulated.
   const mintInfo=await this.rpc.call<{value:{owner:string}|null}>('getAccountInfo',[mint,{encoding:'base64',commitment:'confirmed'}],'background');
   if(mintInfo.value?.owner!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')return {...result,reason:'Token-2022 rent/transfer extensions are not modeled'};
   const rent=position?0:await this.rpc.call<number>('getMinimumBalanceForRentExemption',[165],'background');
   if(!Number.isSafeInteger(rent)||rent<0)throw new Error('invalid rent estimate');
   const quote:Quote={mint,time:Date.now(),provenance:'LIVE',source:'Jupiter quote v1 ExactIn, direct routes; conservative minimum output; not guaranteed fill',circulatingMarketCapUsd:new Decimal(usd).mul(supply.circulatingSupply).toString(),circulationSource:supply.source,tokenAmount:tokenRaw,buyCostSol:sizeSol,sellProceedsSol:new Decimal(sell.otherAmountThreshold).div(1e9).toString(),networkFeeSol:'0.000005',rentSol:new Decimal(rent).div(1e9).toString(),slippageSol:'0',coverageComplete:ready,evidence:{circulation:supply,contextSlot:Math.min(buy.contextSlot,sell.contextSlot),routes,buy,sell,costAssumptions:'one-signature base fee 5000 lamports, standard SPL ATA rent from RPC; AMM fees and 100bps minimum output already in quotes; no execution/priority fee guarantee'}};
   return {...result,quote,observedAt:quote.time,reason:ready?'ready':'pool set/window evidence incomplete'};
  }catch(e){return {quote:null,pairs,observedAt:now,reason:e instanceof Error&&/^market HTTP |^market daily/.test(e.message)?e.message:'market evidence unavailable or failed validation'};}
 }
}
