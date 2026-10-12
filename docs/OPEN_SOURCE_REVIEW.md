# 开源复用审查
审查日期：2026-10-12。浅克隆固定提交；审查范围为许可证、manifest、列出的关键源码，不是完整第三方安全审计。未运行这些仓库的安装脚本。
| 仓库 / 固定提交 | 许可证 | 实际功能与依赖 | 安全发现与决策 |
|---|---|---|---|
| [GMGNAI/gmgn-skills](https://github.com/GMGNAI/gmgn-skills/tree/4575ef539e6a3115fa0481d41285cb79e77970bf) `4575ef539e6a` | MIT | CLI: market/token/portfolio、swap、策略订单；commander/dotenv/undici/socks | src/commands/swap.ts 可提交交易；src/client/signer.ts 读取 PEM 认证私钥（不是 Solana 钱包签名的证明）。不安装、不复用交易代码。 |
| [non-contextual/solana-holder-analyzer](https://github.com/non-contextual/solana-holder-analyzer/tree/9898c597a46ee17eb00110f79ca7ebec3149f893) `9898c597a46e` | MIT | Hono + web3.js + undici；持币、BFS 转账追踪、OKX/Helius 数据、静态 D3 页面 | src/transfer-scan.ts 过滤 CEX/bridge 等终端实体；src/server.ts 有本地 CORS，但不能替代认证。需要 OKX 多项凭据。仅参考过滤方法。 |
| [Kushal-Chandani/Crypto-Clusters](https://github.com/Kushal-Chandani/Crypto-Clusters/tree/d2d3b7d8d7e3f76ad96651351bfb9bea58e48aaf) `d2d3b7d8d7e3` | MIT | FastAPI/Celery/Redis/Neo4j/NetworkX；共同注资/Louvain/union-find；React/Cytoscape | backend/app/services/analyzer.py 使用当前时间和 flow_ 合成 signature 保存部分资金边。不能满足真实证据链；共同注资不是同一控制人证明。只参考算法概念，不引入重依赖。 |
| [helius-labs/helius-sdk](https://github.com/helius-labs/helius-sdk/tree/23483d6a8c199f6ed6f0113175136c223a8b797f) `23483d6a8c19` | MIT | 当前源码 3.2.0，基于 @solana/kit；bs58/tslib，peer 依赖另核对；RPC/DAS/parsedEvents/交易 helper | src/rpc/createHelius.eager.ts 同时暴露 tx/admin；enhanced 已标注 deprecated。只读标准 RPC 不需要整套 SDK，先用方法白名单适配器；不是按旧 SDK API 编写。 |
| [rpcpool/yellowstone-grpc](https://github.com/rpcpool/yellowstone-grpc/tree/2b920d638545723fb267bf749437d7f0cc5b5f1b) `2b920d638545` | 根 AGPL-3.0；Node/Rust 客户端与 proto Apache-2.0 | Rust Geyser 服务 + gRPC 客户端；Node 包有 protobuf/Solana 类型及原生绑定 | 必须逐目录区分许可证；不复制 AGPL 服务源码。代码开源不代表 mainnet 服务免费；本期不引入。 |
| [xyflow/xyflow](https://github.com/xyflow/xyflow/tree/3d35b57317576b0916c0bfeaaedd573aaacc2839) `3d35b5731757` | MIT | React Flow: @xyflow/system、classcat、zustand；节点/边、缩放、选择、拖拽 | 检查 packages/react/src/container/ReactFlow/index.tsx；UI 库不提供关联证据或聚类算法。复用 npm @xyflow/react，保留 attribution。 |
| [tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts/tree/cb06581a0ae28778de17521b5c3edc8119e46d5d) `cb06581a0ae2` | Apache-2.0 + NOTICE | Canvas 时间序列图；fancy-canvas，当前源码 5.2.1 | 检查 src/api/chart-api.ts；只渲染数据，不供应行情。采用 npm 包；保留 NOTICE、TradingView 可见链接。无报价时不画假行情。 |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/993eb2c3151997ce08a49635c10fd8c8ef3713c7) `993eb2c31519` | MIT | 源码组件/registry/CLI；Button 使用 cva、Radix Slot、cn/Tailwind | 检查 registry/new-york-v4/ui/button.tsx。只适配 Button，不运行任意 registry 安装或复制整库。保留 MIT 原文。 |

发布前必须复核实际 lockfile 依赖漏洞、许可证和程序解析 fixtures。仓库被审查不代表服务获得自动付款授权。
