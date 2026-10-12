import {Store} from '../../storage/src/index';
import {WALLETS,type Swap,type Quote} from '../../shared/src/index';
export function runDemo(store:Store){
 const run=Date.now().toString();const conf=store.settings();const time=Date.now();const mint='DEMO-'+run;
 const base:Swap={id:run+':entry',signature:'DEMO-'+run,index:0,slot:0,time,receivedAt:time,owner:WALLETS[0],mint,pool:'DEMO',protocol:'synthetic fixture',lamports:'100000000',tokenRaw:'100',success:true,commitment:'confirmed',provenance:'DEMO',buyerClass:'unknown'};
 const quote:Quote={mint,time,provenance:'DEMO',source:'synthetic boundary fixture; not executable',circulatingMarketCapUsd:'300000',circulationSource:'DEMO assumed circulating supply',tokenAmount:'100',buyCostSol:conf.value.paperBuySizeSol,sellProceedsSol:conf.value.paperBuySizeSol,networkFeeSol:'0.000005',rentSol:'0.002',slippageSol:'0.001',coverageComplete:true};
 const decisions=[store.apply(base,quote,true)];
 for(const [i,amount] of ['2000000000','1200000000','1200000000','2000100000'].entries())decisions.push(store.apply({...base,id:run+':external:'+i,signature:'DEMO-'+run+'-'+i,time:time+i+1,receivedAt:time+i+1,owner:'DEMO-unknown-buyer',lamports:amount},null,true));
 return {provenance:'DEMO',mint,decisions,warning:'Synthetic fixture; no blockchain transaction or executable quote'};
}
