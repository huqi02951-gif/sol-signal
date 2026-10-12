import Decimal from 'decimal.js';
import { WALLETS, type Swap, type Settings, type Position, type Quote, type Decision } from '../../shared/src/index';
const ignored = (reason:string):Decision=>({kind:'ignore',reason});
export function isExternal(swap:Swap,settings:Settings):boolean {
 return !WALLETS.includes(swap.owner) && !settings.excluded.some(x=>x.address===swap.owner);
}
export function decide(swap:Swap,settings:Settings,position:Position|null,history:Swap[],quote:Quote|null,version:number,healthy:boolean):Decision {
 if (!swap.success || swap.commitment==='reverted') return ignored('failed or reverted transaction');
 if (position?.status==='open') {
  if (position.mint!==swap.mint || position.provenance!==swap.provenance || swap.time < position.openedAt || swap.id===position.openEvent) return ignored('unrelated or stale event');
  if (isExternal(swap,settings) && (swap.buyerClass==='external'||settings.unknownTriggersExit) && new Decimal(swap.lamports).gt(new Decimal(settings.exitExternalSingleBuySol).mul(1e9))) {
   return {kind:'exit',reason:swap.buyerClass==='unknown'?'unknown buyer protective exit':'external single buy exceeds threshold',position:{...position,status:'closed',closedAt:swap.time,closeEvent:swap.id,reason:'external single buy'}};
  }
  if (quote && quote.mint===position.mint && quote.provenance===position.provenance && quote.time>=swap.time-15000 && quote.time<=swap.time && new Decimal(quote.tokenAmount).eq(position.tokenAmount)) {
   const pnl=new Decimal(quote.sellProceedsSol).minus(quote.networkFeeSol).minus(quote.slippageSol).minus(position.buyCostSol);
   if(new Decimal(position.buyCostSol).gt(0) && pnl.div(position.buyCostSol).mul(100).gte(settings.netTakeProfitPct)) return {kind:'exit',reason:'net take profit after estimated costs',position:{...position,status:'closed',closedAt:swap.time,closeEvent:swap.id,netPnlSol:pnl.toString(),reason:'net take profit'}};
  }
  return ignored('hold');
 }
 if(position?.status==='closed' && position.closeEvent===swap.id) return ignored('exit already applied');
 if(!settings.monitoring||!healthy) return ignored('entry paused: unhealthy or stopped');
 if(!WALLETS.includes(swap.owner)) return ignored('not a tracked wallet');
 if(!quote || quote.mint!==swap.mint || quote.provenance!==swap.provenance || quote.time>swap.time || swap.time-quote.time>15000 || !quote.coverageComplete) return ignored('quote or external coverage missing/stale');
 if(!quote.circulatingMarketCapUsd || !quote.circulationSource) return ignored('circulating market cap missing (FDV is not accepted)');
 if(new Decimal(quote.circulatingMarketCapUsd).lt(settings.minMarketCapUsd)) return ignored('market cap below minimum');
 if(new Decimal(quote.tokenAmount).lte(0)||new Decimal(settings.paperBuySizeSol).lte(0))return ignored('invalid quote/size');
 const recent=history.filter(x=>x.mint===swap.mint && x.provenance===swap.provenance && x.success && x.commitment!=='reverted' && x.time<swap.time && x.time>=swap.time-settings.entryWindowSeconds*1000 && isExternal(x,settings));
 if(recent.some(x=>new Decimal(x.lamports).gt(new Decimal(settings.entryExternalBuyCapSol).mul(1e9))))return ignored('prior external single order exceeds entry cap');
 const cost=new Decimal(quote.buyCostSol).plus(quote.networkFeeSol).plus(quote.rentSol).plus(quote.slippageSol);
 if(!new Decimal(quote.buyCostSol).eq(settings.paperBuySizeSol))return ignored('quote size does not match configured size');
 return {kind:'entry',reason:'tracked buy with verified quote, circulation and coverage',position:{id:swap.id,mint:swap.mint,openedAt:swap.time,openEvent:swap.id,buyCostSol:cost.toString(),tokenAmount:quote.tokenAmount,sizeSol:settings.paperBuySizeSol,version,provenance:swap.provenance,status:'open'}};
}
