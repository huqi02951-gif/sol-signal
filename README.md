# SOL SIGNAL · PAPER ONLY

Solana 三钱包只读监控 + React 仪表盘 + 独立 worker + SQLite 事件存储 + 模拟策略。**当前已完成第一轮审查修正，仍未满足完整产品最终验收。** 无私钥、无真实下单、不自动购买 API。

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
pnpm pressure
pnpm soak
```
`pnpm history` 只读抓取三个钱包各最近 5 笔成功交易（最多 100 次请求），写 fixtures/history，不产生交易或修改 LIVE 仓位。历史抓取与 replay 不调用 LLM。边界 DEMO 回放通过网页按钮执行，存为 DEMO 仓位，不等于历史盈利回测。

## 当前可运行模块
- 独立 Git/pnpm monorepo；React/TypeScript/Vite/Tailwind；原型深色三列布局、六页导航、shadcn Button、React Flow、TradingView 延迟图。
- 三钱包独立 logsSubscribe confirmed、心跳重连、订阅恢复、持久队列、去重、限速、分页历史回补、可见错误/健康/日请求量。
- Pump/PumpSwap/部分 Raydium SOL 买单按协议事件解析；实际 token account owner 核验；raw transaction 与 signature 留证。真实 fixture 已验证 PumpSwap。
- Decimal 金额规则、外部单笔 >2、未知开关、排除名单、净成本止盈纯函数、单仓位及退出幂等；参数版本审计与旧版本冲突防护。
- 转账弱证据图与详情；不自动同控制排除。接收、RPC（含排队）、解析、判断、信号 P50/P95/P99 分开统计，排除回补/DEMO；秒级 blockTime 不证明毫秒级链上速度。

## 尚未验收的能力
**用户当前选择继续免费只读监控，无报价Key或可信流通供给。LIVE 入场保持 fail-closed，直到下列条件获得证据验证：**
1. 已加入只读Jupiter GET双向报价与流通供给证据校验接入，但当前无Key/供给证据/完整coverage，接入未启用；标准SPL租金从RPC取得，网络费为明示假设，Token-2022扩展与优先费未建模。DEX Screener marketCap/FDV仅供展示，不能自动代替流通市值。
2. 全池发现与 Pump→PumpSwap→Raydium 自动迁移覆盖；当前仅解析后发现池子和 Pump migrate 指令；对最近 LIVE 核心买入启动有预算的候选池观察（默认2池/5分钟），持仓池保留，池 mentions coverage 仍为 partial，历史窗口完整性尚未证明。
3. Raydium v4/复杂路由/所有协议真实 fixture、token receiving owner 为路由合约时的归因；不支持则保留 raw。
4. confirmed 消失的完整回滚裁决、重放 ledger 重建；目前 err 标记 invalidated，需要人工 replay。
5. 共同资金源与最多3层已存储路径分析已加入，输出仍为弱证据疑似；尚无完整多层链上抓取/Louvain或完整公共实体库，不会声称同控制。
6. 独立全量数据源对照漏报测量及 24h soak。Docker 配置不代表已跑满 24h。

当前只有合成 DEMO 可以演示入场/清仓全链路；worker不再硬编码空报价/false，而是读取经校验的缓存与健康状态，缺数据仍禁止入场。这个限制防止将不完整数据冒充已完成的策略系统。

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

## 第一轮审查修正与72小时观测

见 [docs/REVIEW_ROUND1.md](docs/REVIEW_ROUND1.md)。`pnpm pressure` 使用合成传输与内存库，不消耗主网RPC，不代表主网延迟。`pnpm soak` 独立采样进程，读取SQLite，每分钟写 `data/soak`；睡眠/停机缺口计入报告并重置连续观察时间。至少72小时窗口结束不等于验收通过。

可选 `SOLANA_BACKUP_RPC_URL` 主备、`AUDIT_RPC_URL` 独立提供商只读对账（必须不同主机，单独日预算2000）；当前测试的PublicNode/dRPC端点返回403，实际漏报率保持未测。不得把未配置或不可用标为零漏报。429触发30秒冷却，无后台自动付费升级。

`JUPITER_API_KEY` 与 `CIRCULATION_FILE` 默认空。接入文件格式见 market模块schema，必须来源URL、观测/到期时间、证据及verified状态；这只是提供商/操作者的供给佐证输入，不是系统自动证明的流通量。代码绝不生成默认verified记录。有效供给+双向报价仍不够：还需完整池集/窗口/未解析计数证据（目前没有权威覆盖输入，保持禁止入场）。v1报价是deprecated兼容接口，只有GET quote；无swap构建、签名、发送操作。

策略区分 confirmed排除（原excluded）、suspected手动疑似（默认不排除）和publicServices公共服务。共同资金源只显示证据，不自动写任何排除名单；真实链上关联持仓比例缺数据时显示未知。

## 可选千问 / GLM

监听和策略不调用模型。网页“事件日志”提供手动 AI 摘要，默认关闭，服务端密钥、每天5次、间隔60秒、300输出Token请求上限。见 [docs/AI_SETUP.md](docs/AI_SETUP.md)。关闭模型不影响24小时worker；模型Key不能替代RPC或报价服务。

## 简化版观察台与免费云前端
默认“我的钱包”可切换A/B/C，展示钱包地址、代币CA、交易证据与资金往来；策略与技术日志在“高级设置与日志”。内置“使用指南”。

`pnpm build:cloud-preview` 生成独立的纯前端预览构建，禁用API/模型请求，不覆盖本机实时构建。部署与常驻后端边界见 [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md)。第三方CLI Key默认未核验，不迁移到网页。
