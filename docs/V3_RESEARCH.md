# V3 data source and open-source review — 2026-10-15

No third-party scripts were installed or executed. No accounts were registered or services purchased. No model runtime is used.

## GMGN: field evidence, not an invented endpoint

- [Official Agent API introduction](https://docs.gmgn.ai/index/gmgn-agent-api): requires official credentials for stable API calls. No GMGN credentials were available; **authenticated response shape was not tested**.
- [Official earliest-70 explanation](https://docs.gmgn.ai/index/insider-traders-snipers-first-70-buyers.md) concerns the first 70 wallets after opening. It is not a per-transaction guarantee that an owner has never bought a mint before.
- [Official SDK holder documentation](https://github.com/GMGNAI/gmgn-skills/blob/24ccedc5024c9e27251e281f68b799d76349ac34/skills/gmgn-holder-analysis/SKILL.md) documents `start_holding_at`, `buy_tx_count_cur`, `native_transfer` and tags. It cautions that zero buy counts can reflect incomplete indexing. `start_holding_at` alone does not identify the first swap signature or prove lifetime coverage. The client returns `Promise<unknown>`, not a validated first-purchase response type.
- Rechecked upstream commit `24ccedc5024c9e27251e281f68b799d76349ac34`. The token command tag enum does not document a per-buy `is_first_buy` field. **This is not proof the API can never provide one.** No web endpoint scraping, auth workaround, or fabricated mapping was added.
- Implemented alternative: earlier successful local purchase is sufficient to prove NOT_FIRST. FIRST requires complete history covering mint creation through the specific trade, with mint/owner/source/bounds recorded. Partial recent pages cannot prove FIRST. Current free RPC ingestion supplies neither complete lifetime histories nor historical USD evidence, so unknown observations stay UNKNOWN. The evidence seam exists; an authoritative history producer remains missing.

## Stream comparison design

[Helius standard logsSubscribe](https://www.helius.dev/docs/api-reference/rpc/websocket/logssubscribe) provides signature/logs, not a normalized swap row. Its comparison adapter fetches and parses transactions with the existing read-only parser.

[Bitquery Solana DEXTrades](https://docs.bitquery.io/docs/blockchain/Solana/solana-dextrades/) documents buy-account owner, mint, market, signature and time. An isolated adapter subscribes to selected mint+pool trades without an extra per-trade RPC fetch. It does not feed PAPER execution. Current schema/auth availability remains **unverified without a token**. [Authentication](https://docs.bitquery.io/docs/authorization/websocket/) uses a server-only token in the WS URL; errors never print the URL. [Stream billing](https://docs.bitquery.io/docs/subscriptions/websockets/) is subscription based. No subscription was opened this round.

`pnpm providers:compare` defaults to local report-only mode. An operator can explicitly enable the bounded benchmark after obtaining permitted credits. Both adapters share mint/pool/time scope and signature+mint+owner deduplication. Missing rates require a complete independent reference; absence of observations is not zero misses. Current public-wallet metrics have different scope and are not a fair speed comparison to four-token streams. Paid prices/plan rates are unavailable: monetary cost remains null, not estimated as zero.

## Research repositories

| Repository | Reviewed evidence / dependencies | License | Decision |
|---|---|---|---|
| [Crypto-Clusters](https://github.com/Kushal-Chandani/Crypto-Clusters) | README, tree, requirements and analyzer. FastAPI, Neo4j, Celery/Redis, NetworkX and Solana Python stack. Top-holder funding heuristics/community detection. Analyzer generates `flow_...` substitute signatures and uses analysis time for some graph edges. | MIT | Useful investigation ideas; unsuitable as factual transaction provenance. Do not import its backend or add its large dependency stack. No production/security test was run. |
| [find-the-insiders](https://github.com/karidasd/find-the-insiders) | README, tree, dependency lists. FastAPI/requests; early-block/funding-concentration heuristics and visualization. Mostly unbounded dependency minimums. | GitHub metadata has no license | Research reference only; do not copy unlicensed implementation. Claims of insider/organic labels are not independently validated. |
| [solana-memecoin-dataset](https://github.com/ian05012/solana-memecoin-dataset) | README and license; repository describes wallet funding, repeated buyer cohorts, historical trades and forward return labels. Full 9.5M-row data not downloaded or validated. | MIT | Potential offline evaluation data, not a live data provider. Forward returns must not leak into signal features; historical tags are not ground-truth owner identity. Collection permission/API terms need separate review before reuse. |

Useful next research signals: direct funding edges, shared funders after excluding public services, same-slot cohorts, recurring cross-token cohorts, and buy/sell symmetry. Preserve proof signatures and event times. Scores are leads, not proof of common ownership. P2 advanced clustering is not claimed complete. No model API, wallet signing code or new runtime dependency was introduced.
