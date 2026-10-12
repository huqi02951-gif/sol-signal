# SOL SIGNAL · PAPER ONLY

Solana 三钱包只读监控 + React 仪表盘 + 独立 worker + SQLite 事件存储 + 模拟策略。**当前为可验收的增量首版，尚未满足完整产品最终验收。** 无私钥、无真实下单、不自动购买 API。

## 本地运行
需要 Node >=22.17、pnpm 11.1.1。

```sh
pnpm install --frozen-lockfile --ignore-scripts
cp .env.example .env
pnpm dev
```
打开 http://127.0.0.1:5173。已构建版本可 `pnpm build` 后分别运行 `pnpm api`、`pnpm worker`，打开 http://127.0.0.1:8787。API/worker 不依赖浏览器存活。电脑休眠或进程关闭会停止监听。

默认免费公共 Solana RPC；已有 Helius 标准 Key 可只写入 .env 的 HELIUS_API_KEY，不要粘贴聊天或放入 VITE_*。应用不会申请账号、付费或自动升级。

## 验收命令
```sh
pnpm test
pnpm build
pnpm replay
pnpm audit --prod
```
`pnpm history` 只读抓取三个钱包各最近 5 笔成功交易（最多 100 次请求），写 fixtures/history，不产生交易或修改 LIVE 仓位。历史抓取与 replay 不调用 LLM。边界 DEMO 回放通过网页按钮执行，存为 DEMO 仓位，不等于历史盈利回测。

## 当前可运行模块
- 独立 Git/pnpm monorepo；React/TypeScript/Vite/Tailwind；原型深色三列布局、六页导航、shadcn Button、React Flow、TradingView 延迟图。
- 三钱包独立 logsSubscribe confirmed、心跳重连、订阅恢复、持久队列、去重、限速、分页历史回补、可见错误/健康/日请求量。
- Pump/PumpSwap/部分 Raydium SOL 买单按协议事件解析；实际 token account owner 核验；raw transaction 与 signature 留证。真实 fixture 已验证 PumpSwap。
- Decimal 金额规则、外部单笔 >2、未知开关、排除名单、净成本止盈纯函数、单仓位及退出幂等；参数版本审计与旧版本冲突防护。
- 转账弱证据图与详情；不自动同控制排除。实时 P50/P95 排除 HISTORY/DEMO，定义是 blockTime 到日志到达（秒级源时间），不是执行延迟。

## 尚未验收的能力
**LIVE 新开仓永久处于 fail-closed，直到下列适配器获得证据验证：**
1. 流通供给/市值来源（FDV 不代替）、真实双向报价、网络/租金/滑点成本；当前无 LIVE 报价、真实 net PnL 或价格图。
2. 全池发现与 Pump→PumpSwap→Raydium 自动迁移覆盖；当前仅解析后发现池子和 Pump migrate 指令；只对 LIVE 持仓池订阅，未开仓候选不自动大量订阅，池 mentions coverage 仍为 partial，历史窗口完整性尚未证明。
3. Raydium v4/复杂路由/所有协议真实 fixture、token receiving owner 为路由合约时的归因；不支持则保留 raw。
4. confirmed 消失的完整回滚裁决、重放 ledger 重建；目前 err 标记 invalidated，需要人工 replay。
5. 共同注资/Louvain 异步聚类、完整公共实体识别；当前图仅直接转账，不会声称同控制。
6. 独立全量数据源对照漏报测量及 24h soak。Docker 配置不代表已跑满 24h。

只有合成 DEMO 可以演示入场/清仓全链路。这个限制防止将不完整数据冒充已完成的策略系统。

## 常驻部署
```sh
pnpm build
docker compose up -d --build
docker compose logs -f worker
```
端口仅本机 8787，api/worker 两进程、命名卷保存 SQLite、unless-stopped。需不休眠主机。远程访问使用认证 TLS 代理，并设置 API_ALLOWED_HOSTS（不要直接暴露 API）。本环境是否已验证 Docker 见 docs/VALIDATION.md。

## 备份与回滚
```sh
pnpm exec tsx scripts/backup.ts data/backup.sqlite
```
数据库恢复：先停止 worker/API，再将目标备份复制到 `data/sol-signal.sqlite`，删除该数据库旧 `-wal`/`-shm` 文件后重新启动（只在所有连接关闭后）。Docker 命名卷备份需在容器内使用 backup 脚本，恢复同样停两服务。不要使用 `docker compose down -v`，会删除数据。

参数回滚：策略页面读取审计，将旧值作为新版本保存。配置更改前 `cp .env .env.backup`；恢复为 `cp .env.backup .env` 后重启。初版没有更改原始 handoff 文件。

架构和成本：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；逐仓审查：[docs/OPEN_SOURCE_REVIEW.md](docs/OPEN_SOURCE_REVIEW.md)；安全：[docs/SECURITY.md](docs/SECURITY.md)；回放：[docs/REPLAY_REPORT.json](docs/REPLAY_REPORT.json)。代理实际 Token/费用：平台未提供。实时逐笔大模型调用成本：$0。
