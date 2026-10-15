# SOL SIGNAL V3 — incremental review build

2026-10-15. This is a runnable partial delivery, **not a full V3 acceptance pass**. PAPER only. Existing SQLite data, React design, strategy and tests retained. No new runtime dependencies, private keys, signing, model calls or paid API subscriptions.

## Shipped modules

1. **Latency / recovery:** RPC traces separate durable job wait, scheduler wait, time to headers, body decode and total request round trip. Network latency and provider processing are not separable with the evidence available; no fabricated provider-only metric. Real websocket observations, backfill and DEMO remain separate. Current-run metrics avoid presenting old pool backlog as current performance. Chain timestamps ahead of local receipts are counted; negative durations are excluded rather than clamped to zero.
2. **Realtime priority:** regression reproduced: background requests could occupy all concurrent positions. Both RPC scheduler and actual worker dispatcher reserve one position for new live work. Same 500ms start interval, two maximum requests, 20,000 daily request cap and 429 cooldown retained. Backfill continuation persists each page, resumes beyond the previous 1,000-signature cap, and advances cursor only after jobs are durable. Congestion alarm and candidate pause remain visible. Old disabled-pool jobs are preserved in a deferred queue. Repair processes at most one archived job every 5 seconds, only when the core queue is empty and usage is below half the existing daily RPC cap. No subscriptions are reopened. They have not all been replayed.
3. **First-buyer ledger:** additive `first_buys` table, transactionally saved with PAPER decisions. Defaults 0.5 SOL / 1000 USD; count after actual position `openedAt`; signature+mint+owner route dedup and per-position mint+owner repeat exclusion. UNKNOWN history and missing historical USD excluded. Exact Decimal accounting; stored event-time amounts never repriced from a current quote. Three exit rules have independent switches and reason strings. Stale LIVE/backfill buys can update accounting but cannot generate new expired signals. Reverted contributors invalidate the position for manual ledger replay. Unknown chain-time fallback cannot trigger a live decision or contribute historical USD.
4. **Four-token state:** up to four open PAPER mints; per-position ledger isolation. Candidate registry caps distinct mints at four, preserves overflow discoveries in a durable waiting queue and promotes them when space opens. Reducing the cap defers unpinned candidates; existing positions remain protected. Candidate pool subscriptions remain disabled in the free core-wallet configuration, so this is **not four busy real tokens fully observed**.
5. **Console:** first-buyer dashboard, per-token selection/detail, buyer classification bars, proof links, per-rule parameter editing and actual/archived sample toggle. Direct transfers to tracked/known-related addresses or between sampled buyers produce suspected labels. Public services are filtered when configured. “No known link” never becomes “verified external.” Existing graph, wallet console, logs, audit and simulation retained. The public page contains a dated chain-evidence snapshot; local page polls the backend.
6. **Provider framework:** isolated standard Helius logs+RPC and Bitquery parsed-trade adapters share a bounded mint/pool/time/dedup report interface. Operator opt-in required. Default invocation reads existing local measurements and opens no streams. No keys available: both paid providers remain NOT_TESTED; price and omission fields stay null.

## Verification

- `pnpm test`: 70 tests in 26 files passed including chain-time, exclusion-update and multi-owner revert guards (see test runner output; no test replaced).
- `pnpm build`: TypeScript and production web build; Vite bundle-size/annotation warnings remain non-blocking. Final build rerun after generated snapshot updates.
- `node --import tsx scripts/v3-replay.ts`: 15 captured transaction fixtures, one supported PumpSwap buy. Local stored supported-buy replay: 2,271 rows at sampling time; 922 repeat observations had earlier captured purchase evidence, 1,349 histories remained UNKNOWN. Zero verified FIRST and zero valid historical USD values. These are replay-sample counts, not all-chain live buyers. The local sample continues growing.
- Synthetic strategy tests cover 999.99 / 1000.00 / 1000.01, minimum order size, UNKNOWN, missing USD, repeat owners, routed duplicates, event-time immutability, stale history, revert invalidation, switches and four independent positions plus a fifth blocked entry.
- `pnpm pressure:v3`: 200 synthetic events / 4 tokens, 50 processed each, zero remainder, maximum transport concurrency two. Mock transport is 3ms and start interval 1ms. **This is not production RPC latency or a real four-token capacity result.**
- `pnpm providers:compare`: public-only measured report, Helius/Bitquery NOT_TESTED, independent reconciliation unavailable. No paid-speed comparison conclusion.
- Browser inspection checks the local and published dashboards, token details, historical sample switch and read-only cloud notice. No real PAPER position was created for demonstration.

## Observed delay and unresolved P0

The Oct-13 aggregate “RPC” P50 1,111,056ms / P95 4,491,181ms included durable/scheduler queueing. Large candidate-pool intake exceeded the bounded per-transaction fetch throughput; roughly 97k old pool jobs remain deferred. Recovery also found over 1k core-wallet backfill jobs and actual public-provider 429 responses. The old report contains no request-start traces, so its queue/network/provider split cannot be reconstructed.

See [V3_LIVE_REPORT.json](V3_LIVE_REPORT.json) for the actual current-run window, stage P50/P95/P99 and queue count. A small sample with a short local latency does **not** prove the P0 issue is solved. Some second-resolution chain timestamps were ahead of receipt/decision, leaving chain-to-decision percentiles unavailable. No low-latency SLA is claimed. Sustained four-token complete coverage cannot be validated on the current limited public endpoint.


Snapshot at 1792079781615 (Unix ms): 6 fresh websocket observations. Receipt-to-decision P50/P95/P99 = 626/1271/1271ms; request round trip = 308/614/614ms. Chain-to-decision has 3 nonnegative samples, P50/P95/P99 = 826/2084/2084ms; 5 chain timestamps were ahead of receipt. Remaining active debt 830, deferred pool debt 96986. These distributions have too few samples for latency acceptance.

## Costs and deployment

| Component | Observed new API spend | Status |
|---|---:|---|
| Solana public RPC / WS | USD 0 | Rate limited; incomplete coverage |
| Helius / Bitquery | No calls this round | No credentials; cost comparison not available |
| Model APIs / Codex runtime | 0 model requests | No runtime integration; development chat is separate |
| Cloudflare Pages | No paid service activated | Static UI + dated public-chain snapshot |
| Permanent backend | Not provisioned | Node + SQLite running on this Mac; sleep/offline interrupts it |

Backend still needs an always-on host for 24h independence. No free-host guarantee, login protection or full cloud real-time service is claimed. Existing 72h observation was interrupted; a new collector was started, acceptance remains false. Missing independent reconciliation, authoritative lifetime history, event-time USD, executable quote/circulating supply and a real PAPER loop remain blockers.

## Rollback

Consistent pre-change SQLite backup: `data/before-v3.sqlite` (ignored; never uploaded). The migration is additive; the prior application can read the DB while ignoring the new table. Revert the V3 Git commit to roll back code and rebuild with `pnpm build`; keep the current DB to preserve new evidence. For a full data rollback, stop API, worker and collector, move the current DB together with any `-wal` / `-shm` files to a dated backup directory, then restore `data/before-v3.sqlite` as `data/sol-signal.sqlite` before restarting. Do not copy a live SQLite file over an active database. Redeploy the preceding Pages deployment to roll back the public snapshot.

Skills used: engineering-change-discipline, diagnosing-bugs, tdd; cloudflare-deploy for publication. [Research and source review](V3_RESEARCH.md).

Published snapshot: https://sol-signal-preview.pages.dev/ (immutable deployment https://3e5aee59.sol-signal-preview.pages.dev/). Preview excludes backend calls; dashboard and history toggle verified in a real browser.
