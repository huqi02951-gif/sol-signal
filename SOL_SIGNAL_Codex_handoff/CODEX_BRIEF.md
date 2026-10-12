# SOL SIGNAL｜Solana 钱包实时监控与模拟策略系统

> 交付对象：Codex。此文档是开发任务书，禁止将界面演示数据视为真实链上数据。

## 目标与边界

开发一个 **服务端实时监听 + 浏览器仪表盘** 的 Solana 研究/模拟交易系统。第一期全部 **只读与纸面交易**，不接入私钥、助记词、交易签名，不允许真实链上下单。浏览器关闭后，后台服务仍独立运行。

目标用户有三个关注地址，只追 Solana：

- `GNWkMRJeBgB2mpqdjcPxP7VJPwqo6jJELjeMDcWgbYkj`
- `AVxhoCCEjdTfYjNm5FkRHCNGARFgv4GaNACpteyHLhr7`
- `DgXZpa31edzYTm4piLYTCeEyfUjreB4G7gLaJ3dh7Xyf`

主要流程：任一跟踪钱包买入某代币 → 判断候选信号和市值、买入条件 → 模拟买入 0.1 SOL → 对当前代币的有效买单实时监听 → 出现 **不在明确关联排除名单内** 的钱包单笔买入 SOL 数量 `> 2.0` 时立即生成「模拟100%清仓」信号；或者达到扣除预估交易成本后的净收益率 `>= 5%` 时生成止盈信号。买入/清仓只生成 paper fills 和 events。所有参数后台可配置，无需修改代码。一个代币同时最多一笔仓位；退出具有幂等性。

## 实时事件判定规则（必须单元测试）

1. `min_market_cap_usd=250000`；市值定义和数据来源写清楚，严禁把 FDV 和流通市值混用；估值/供给缺失时不入场。
2. `paper_buy_size_sol=0.1`；按真实可获取报价估算手续费、滑点、租金/网络费，区分实际成交价和假定价。
3. `entry_external_buy_cap_sol=1.0`，先按**触发前30秒内单笔的最大值不超过1 SOL**作为临时假设，窗口必须可编辑；尚未确认用户最终定义，界面明确标注。
4. `exit_external_single_buy_sol=2.0`；条件 **大于** 阈值（严格 `>`），不取整，不做金额合计。两个独立买单 1.2 SOL、1.2 SOL 不触发，单笔 2.0001 SOL 触发。只按成功的**真实 swap 买入**计算，排除撤销/失败、流动性操作、自转、重复路由事件；按实际 token 接收方对应的 owner 分辨地址。
5. 初始“外部钱包”定义：不在三个监控钱包与已经有充分证据确认的关联排除名单内的实际买入者。其他地址默认为“未识别/可能外部”，应展示不确定性；提供“未识别钱包是否触发保护性退出”的开关，V1 默认开启以避免漏报，须在事件明细说明触发原因。
6. 关联推断 **不能** 仅凭地址间发生转账就认定为同一控制人。标注证据交易 hash、关系类型、置信度；CEX、DEX、公共路由与合约程序必须过滤。聚类作为后台慢任务，不阻塞实时热路径。
7. Pump.fun bonding curve、PumpSwap、Raydium 等从一个场景迁移另一个场景时，检测新的有效池子，保证仍监听该币；不可假设 mint 一定出现在所有 swap 的日志 mentions 中。监控池/程序需要有明确的交易解析逻辑和自动订阅切换。
8. 断线重连、心跳、订阅恢复、基于 slot/signature 的事件去重与历史回补；对 processed / confirmed / finalized 标注层级，交易失败或回滚要更正状态；延迟监控展示 P50/P95 和漏单检查。
9. 除非明确取得授权，**不得**将私钥、助记词、付款 API 密钥写入仓库、前端构建产物或日志。API Key 只存在服务端环境变量。

## 技术方案

- 仓库使用 `pnpm` monorepo：`apps/web` (React + TypeScript + Vite + Tailwind + shadcn/ui)；`apps/api` (Node.js + TypeScript + Fastify/Hono)；`apps/worker` (独立常驻 Solana websocket 监听、解码、事件处理)；`packages/shared` (Zod schemas、统一事件类型)；`packages/strategy` (可测试的纯函数交易规则)；`packages/graph` (关联钱包分析，可异步)。
- **先用 Helius 标准 WebSocket** 的 `logsSubscribe`，针对三个钱包创建独立过滤订阅。接收 signature 后拉完整交易解码；针对开仓 token 的池子/相关合约订阅有效交易；需要补充 REST 获取历史数据。不要在 Web 前端连接 RPC 的付费密钥。
- 数据库存 PostgreSQL 或本地开发 SQLite (由 Codex 选一种优先，说明迁移方案)；可选 Redis 用于事件队列/缓存，但第一阶段不强制上复杂依赖。
- 关系图可以使用 Cytoscape.js 或 React Flow，交易时间图使用 TradingView lightweight-charts；行情/金额/图谱均有 data provenance 和 last-updated。
- AI 仅做低频钱包背景分析、异常事件摘要；**实时策略执行不调用大模型**，减少 Token 消耗与不确定性。
- 生产低延迟场景单独评估 Yellowstone gRPC 和 Helius LaserStream 的费用、过滤精度与延迟，不应把它们说成免费能力或把开发 demo 误写为已上线。

## 推荐开源参考（先阅读代码/许可证，不要大包整库复制）

1. GMGN Agent Skills: https://github.com/GMGNAI/gmgn-skills （辅助代币/钱包数据；源码包含交易能力，但本期禁用）
2. Solana Holder Analyzer: https://github.com/non-contextual/solana-holder-analyzer （持币分析、多层转账追踪、D3）
3. Crypto-Clusters: https://github.com/Kushal-Chandani/Crypto-Clusters （共同注资、Louvain、图谱；小项目，仅作算法启发）
4. Helius SDK: https://github.com/helius-labs/helius-sdk （链上数据 API）
5. Yellowstone gRPC: https://github.com/rpcpool/yellowstone-grpc （后续低延迟通道参考）
6. React Flow: https://github.com/xyflow/xyflow （前端节点图）
7. TradingView Lightweight Charts: https://github.com/tradingview/lightweight-charts （时间序列行情图）
8. shadcn/ui: https://github.com/shadcn-ui/ui （界面组件）

## 界面设计（见同包HTML静态交互示例）

深色专业交易终端，克制的绿/琥珀色重点，高信息密度但不拥挤，桌面三列主要信息、移动端纵向阅读。主入口为“实时监控”，不是聊天界面。产品导航：实时监控、钱包关系图、策略参数、模拟交易、事件日志、数据健康。

1. 顶部固定：**模拟模式**、RPC 连接状态、订阅钱包数、最新区块/事件、数据延迟 P50/P95；数据异常必须红色显示且自动暂停新开仓信号。
2. 左侧：三个跟踪钱包（别名、在线状态、最新交易时间、复制、Solscan链接）；后续添加/删除钱包，关联钱包与核心钱包分层展示。
3. 中央：检测到的 token watchlist（CA、价格/市值、流动性、来源钱包、外部大额单笔、信号状态）+ 时间事件流；以可点击 transaction signature 为证据。
4. 右侧：策略参数 **0.1 SOL、25万 USD、入场外部阈值1 SOL、退出外部阈值2 SOL、净止盈5%**；所有值可调整，小数精准比较；保存生效有时间版本号和审计记录；监控启停与紧急关闭为核心控制。
5. 关联钱包独立页：气泡节点+关系边，支持排除池子/CEX、显示聚类持仓、共同注资路径，并在详情面板给证据链；强关联/弱关联/未知颜色有不同标记。
6. 纸面仓位页：信号时间、假定报价、买入点、退出点、净盈亏和延迟；避免“有信号=能成交”的误导。

## 验收

- 第一阶段只展示模拟仓位，必须有显著的 `PAPER / SIMULATION` 标签；前端 mock data 必须明确 `DEMO`，不能混淆真实数据。
- 对指定三钱包能启动实时订阅；提供真实 signature 与交易时间，识别买入代币，重连回补和异常记录可复现。
- 外部单笔 `2.0001 SOL` 触发一次模拟清仓，`2.0 SOL` 不触发，`1.2+1.2` 两笔不触发；覆盖测试。
- 关联排除名单、未识别钱包处理、阈值修改即时生效（或展示清晰的版本切换）且有完整审计日志。
- 至少完成一组历史交易回放（回放并非实盘盈利证明），记录触发延迟、数据源漏报、策略导致的异常误触发。
- 交付 README、一键本地启动、Docker Compose 或等价持久部署配置、API key 模板、测试脚本、成本预算与安全检查清单。

## 开发节奏与 Token 约束

先提交简短架构与 repo 复用矩阵，再实现 worker 最小链上订阅；随后策略规则及测试；再接 API 与网页；最后实现异步钱包图谱。每个阶段只分析必需源码，不全仓重复阅读；使用针对性测试和增量提交。记录 AI 代理实际可读的 token/cost 数据，若拿不到必须标记“平台未提供”。运行时每一笔链上交易不得调用大模型。

**禁止在本期实现真实自动下单。** 真实资金阶段需另外制定钱包安全、签名隔离、滑点/MEV、防复入及交易失败处理方案，并经用户明确授权。
