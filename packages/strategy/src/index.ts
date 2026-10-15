import Decimal from 'decimal.js';
import { WALLETS, type Swap, type Settings, type Position, type Quote, type Decision } from '../../shared/src/index';
const ignored = (reason:string):Decision=>({kind:'ignore',reason});
export function isExternal(swap:Swap,settings:Settings):boolean {
 return !WALLETS.includes(swap.owner) && !settings.excluded.some(x=>x.address===swap.owner) && !settings.publicServices.some(x=>x.address===swap.owner) && !(settings.excludeSuspected && settings.suspected.some(x=>x.address===swap.owner));
}
export function decide(swap:Swap,settings:Settings,position:Position|null,history:Swap[],quote:Quote|null,version:number,healthy:boolean,evaluatedAt=Math.max(swap.time,swap.receivedAt)):Decision {
 if(swap.provenance==='LIVE'&&swap.chainTimeKnown===false)return ignored('chain time unavailable; accounting only');
 if (!swap.success || swap.commitment==='reverted') return ignored('failed or reverted transaction');
 if (position?.status==='open') {
  if(swap.provenance==='LIVE'&&(swap.ingestion==='backfill'||evaluatedAt-swap.time>15000))return ignored('stale LIVE observation; accounting only');
  if(swap.provenance==='LIVE'&&swap.receivedAt<position.openedAt)return ignored('observation predates PAPER entry');
  if (position.mint!==swap.mint || position.provenance!==swap.provenance || swap.time+999 < position.openedAt || swap.id===position.openEvent) return ignored('unrelated or stale event');
  if (settings.externalSingleBuyEnabled && isExternal(swap,settings) && (swap.buyerClass==='external'||settings.unknownTriggersExit) && new Decimal(swap.lamports).gt(new Decimal(settings.exitExternalSingleBuySol).mul(1e9))) {
   return {kind:'exit',reason:swap.buyerClass==='unknown'?'unknown buyer protective exit':'external single buy exceeds threshold',position:{...position,status:'closed',closedAt:evaluatedAt,closeEvent:swap.id,reason:'external single buy'}};
  }
  if (settings.netTakeProfitEnabled && quote && quote.mint===position.mint && quote.provenance===position.provenance && quote.time>=evaluatedAt-15000 && quote.time<=evaluatedAt && new Decimal(quote.tokenAmount).eq(position.tokenAmount)) {
   const pnl=new Decimal(quote.sellProceedsSol).minus(quote.networkFeeSol).minus(quote.slippageSol).minus(position.buyCostSol);
   if(new Decimal(position.buyCostSol).gt(0) && pnl.div(position.buyCostSol).mul(100).gt(settings.netTakeProfitPct)) return {kind:'exit',reason:'net take profit after estimated costs',position:{...position,status:'closed',closedAt:evaluatedAt,closeEvent:swap.id,netPnlSol:pnl.toString(),reason:'net take profit'}};
  }
  return ignored('hold');
 }
 if(position?.status==='invalidated')return ignored('source invalidated; ledger replay required');
 if(position?.status==='closed' && position.closeEvent===swap.id) return ignored('exit already applied');
 if(!settings.monitoring||!healthy) return ignored('entry paused: unhealthy or stopped');
 if(!WALLETS.includes(swap.owner)) return ignored('not a tracked wallet');
 if(swap.provenance==='LIVE'&&evaluatedAt-swap.time>15000)return ignored('stale LIVE trigger; never enter from backlog');
 if(!quote || quote.mint!==swap.mint || quote.provenance!==swap.provenance || quote.time>evaluatedAt || evaluatedAt-quote.time>15000 || !quote.coverageComplete) return ignored('quote or external coverage missing/stale');
 const lifecycle=quote.lifecycle;
 if(!lifecycle||!lifecycle.verified||lifecycle.mint!==swap.mint||!lifecycle.signature||!lifecycle.program||!lifecycle.source||!['launch','migration'].includes(lifecycle.kind)||!['confirmed','finalized'].includes(lifecycle.commitment)||![lifecycle.time,lifecycle.slot].every(Number.isSafeInteger)||lifecycle.slot<0||lifecycle.time<=0||lifecycle.time>evaluatedAt||lifecycle.slot>=swap.slot||(swap.provenance==='DEMO')!==(lifecycle.provenance==='DEMO'))return ignored('verified launch/migration time missing or unrelated');
 if(swap.protocol==='pumpswap'&&lifecycle.kind!=='migration')return ignored('PumpSwap migration proof missing');
 if(evaluatedAt-lifecycle.time>settings.entryMaxAgeSeconds*1000)return ignored('launch/migration entry window expired');
 if(!quote.circulatingMarketCapUsd || !quote.circulationSource) return ignored('circulating market cap missing (FDV is not accepted)');
 if(new Decimal(quote.circulatingMarketCapUsd).lte(settings.minMarketCapUsd)) return ignored('market cap must strictly exceed minimum');
 if(new Decimal(quote.tokenAmount).lte(0)||new Decimal(settings.paperBuySizeSol).lte(0))return ignored('invalid quote/size');
 const recent=history.filter(x=>x.mint===swap.mint && x.provenance===swap.provenance && x.success && x.commitment!=='reverted' && x.id!==swap.id && x.time<=swap.time && x.time>=swap.time-settings.entryWindowSeconds*1000 && isExternal(x,settings));
 if(recent.some(x=>new Decimal(x.lamports).gt(new Decimal(settings.entryExternalBuyCapSol).mul(1e9))))return ignored('prior external single order exceeds entry cap');
 const cost=new Decimal(quote.buyCostSol).plus(quote.networkFeeSol).plus(quote.rentSol).plus(quote.slippageSol);
 if(!new Decimal(quote.buyCostSol).eq(settings.paperBuySizeSol))return ignored('quote size does not match configured size');
 return {kind:'entry',reason:'tracked buy with verified quote, circulation and coverage',position:{entryLifecycle:lifecycle,id:swap.id,mint:swap.mint,openedAt:evaluatedAt,openEvent:swap.id,buyCostSol:cost.toString(),tokenAmount:quote.tokenAmount,sizeSol:settings.paperBuySizeSol,version,provenance:swap.provenance,status:'open'}};
}
export function quoteExit(position:Position,quote:Quote,settings:Settings,evaluatedAt:number):Decision {
 if(!settings.netTakeProfitEnabled||position.status!=='open'||quote.mint!==position.mint||quote.provenance!==position.provenance||quote.time>evaluatedAt||evaluatedAt-quote.time>15000||!new Decimal(quote.tokenAmount).eq(position.tokenAmount))return ignored('unrelated/stale position quote');
 const pnl=new Decimal(quote.sellProceedsSol).minus(quote.networkFeeSol).minus(quote.slippageSol).minus(position.buyCostSol);
 if(new Decimal(position.buyCostSol).lte(0)||pnl.div(position.buyCostSol).mul(100).lte(settings.netTakeProfitPct))return ignored('net target not reached');
 return {kind:'exit',reason:'net take profit from quote refresh',position:{...position,status:'closed',closedAt:evaluatedAt,closeEvent:'quote:'+position.mint+':'+quote.time,netPnlSol:pnl.toString(),reason:'net take profit'}};
}
