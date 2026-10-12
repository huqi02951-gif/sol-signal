import 'dotenv/config';
import {mkdirSync,writeFileSync} from 'node:fs';
import {WALLETS} from '../packages/shared/src/index';
import {Store} from '../packages/storage/src/index';
import {Rpc} from '../apps/worker/src/rpc';
import {parseTransaction} from '../apps/worker/src/parser';
const db=new Store(':memory:');const key=process.env.HELIUS_API_KEY;
const rpc=new Rpc(key?`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`:process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',db,1500,100);
const results:unknown[]=[];mkdirSync('fixtures/history',{recursive:true});
for(const wallet of WALLETS){
 try{
  const rows=await rpc.call<Array<{signature:string;err:unknown;blockTime:number}>>('getSignaturesForAddress',[wallet,{limit:5}]);
  for(const row of rows){if(row.err)continue;try{
   const raw=await rpc.call<unknown>('getTransaction',[row.signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:0}]);if(!raw){results.push({wallet,signature:row.signature,status:'unavailable'});continue;}
   writeFileSync(`fixtures/history/${row.signature}.json`,JSON.stringify(raw,null,2));const parsed=parseTransaction(raw,'HISTORY');
   results.push({wallet,signature:row.signature,blockTime:row.blockTime,buys:parsed.swaps.length,reason:parsed.reason,status:'captured',protocols:parsed.swaps.map(x=>x.protocol)});
  }catch{results.push({wallet,signature:row.signature,status:'fetch/parse failed'});}}
 }catch{results.push({wallet,status:'history fetch failed'});}
}
writeFileSync('fixtures/history/manifest.json',JSON.stringify({capturedAt:new Date().toISOString(),source:key?'Helius standard':'Solana public',results},null,2));console.log(JSON.stringify(results,null,2));db.close();
