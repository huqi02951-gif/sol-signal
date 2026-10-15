import { z } from 'zod';
export const WALLETS = ['GNWkMRJeBgB2mpqdjcPxP7VJPwqo6jJELjeMDcWgbYkj','AVxhoCCEjdTfYjNm5FkRHCNGARFgv4GaNACpteyHLhr7','DgXZpa31edzYTm4piLYTCeEyfUjreB4G7gLaJ3dh7Xyf'];
const decimal = z.string().regex(/^\d+(\.\d{1,9})?$/).max(30);
export const address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
export const settingsSchema = z.object({
 entryMaxAgeSeconds:z.number().int().min(1).max(86400).default(300),
 firstBuyMinSol:decimal.default('0.5'),firstBuyExitCumulativeUsd:decimal.refine(v=>Number(v)>0).default('1000'),onlyFirstBuyOfToken:z.boolean().default(true),firstBuyerExitEnabled:z.boolean().default(true),externalSingleBuyEnabled:z.boolean().default(true),netTakeProfitEnabled:z.boolean().default(true),maxActiveTokens:z.number().int().min(1).max(4).default(4),startCountingAt:z.literal('PAPER_OPENED_AT').default('PAPER_OPENED_AT'),deduplicateBy:z.literal('mint+owner').default('mint+owner'),
 minMarketCapUsd: decimal, paperBuySizeSol: decimal, entryExternalBuyCapSol: decimal,
 exitExternalSingleBuySol: decimal, netTakeProfitPct: decimal,
 entryWindowSeconds: z.number().int().min(1).max(3600), unknownTriggersExit: z.boolean(),
 monitoring: z.boolean(), suspected: z.array(z.object({address,evidence:z.string().min(10).max(500)})).max(500).default([]), excludeSuspected:z.boolean().default(false), publicServices:z.array(z.object({address,evidence:z.string().min(10).max(500)})).max(500).default([]), excluded: z.array(z.object({address, evidence: z.string().min(10).max(500)})).max(500)
}).strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = {entryMaxAgeSeconds:300,firstBuyMinSol:'0.5',firstBuyExitCumulativeUsd:'1000',onlyFirstBuyOfToken:true,firstBuyerExitEnabled:true,externalSingleBuyEnabled:true,netTakeProfitEnabled:true,maxActiveTokens:4,startCountingAt:'PAPER_OPENED_AT',deduplicateBy:'mint+owner',minMarketCapUsd:'200000',paperBuySizeSol:'0.1',entryExternalBuyCapSol:'1',exitExternalSingleBuySol:'2',netTakeProfitPct:'50',entryWindowSeconds:30,unknownTriggersExit:false,monitoring:true,excluded:[],suspected:[],excludeSuspected:false,publicServices:[]};
export type Provenance = 'LIVE' | 'HISTORY' | 'DEMO';
export interface Swap {
 id: string; signature: string; index: number; slot: number; time: number; receivedAt: number;
 owner: string; mint: string; pool: string; protocol: string; lamports: string; tokenRaw: string;
 success: boolean; commitment: 'confirmed'|'finalized'|'reverted'; provenance: Provenance;
 chainTimeKnown?:boolean;historyEvidence?:PurchaseHistory;usdEvidence?:{signature:string;amount:string;at:number;source:string};
 buyerClass: 'unknown'|'external'; ingestion?: 'websocket'|'backfill'|'fixture';
}
export interface Quote {
 mint: string; time: number; provenance: Provenance; source: string;
 circulatingMarketCapUsd: string | null; circulationSource: string | null;
 tokenAmount: string; buyCostSol: string; sellProceedsSol: string;
 networkFeeSol: string; rentSol: string; slippageSol: string; coverageComplete: boolean; lifecycle?:TokenLifecycle|null; evidence?:unknown;
}
export interface Position {
 id: string; mint: string; openedAt: number; openEvent: string; closedAt?: number; closeEvent?: string;
 buyCostSol: string; tokenAmount: string; sizeSol: string; version: number;
 entryLifecycle?:TokenLifecycle; provenance: Provenance; status: 'open'|'closed'|'invalidated'; reason?: string; netPnlSol?: string;
}
export interface Decision {kind:'entry'|'exit'|'ignore'; reason:string; position?:Position}
export interface Event {id:string; kind:string; time:number; signature?:string; provenance:Provenance; detail:unknown}

export interface PurchaseHistory {source:string;mint:string;owner:string;tokenCreatedAt:number;from:number;through:number;complete:boolean;priorBuys:Array<{signature:string;time:number;slot:number}>}

export interface TokenLifecycle {mint:string;kind:'launch'|'migration';time:number;slot:number;signature:string;program:string;source:string;verified:boolean;provenance:Provenance;commitment:'confirmed'|'finalized'|'reverted'}
