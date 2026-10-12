# 架构、预算与验收计划

先审查后实施，2026-10-12。

## 进程与数据
- apps/worker：三钱包各自 logsSubscribe confirmed；只读 RPC 白名单；持久化 signature job、分页回补、重试、心跳、重订阅。解析以协议证据为准，未知交易保存 raw，不猜测为买入。
- apps/api：Fastify，同源 API、参数版本审计、快照；默认 loopback，写接口检查 Origin。生产远程访问必须在认证代理后部署。
- apps/web：React/TypeScript/Vite/Tailwind，保留 HTML 样式；shadcn Button、React Flow；轻量图只画真实可追溯价格。
- shared：Zod 外部输入和事件类型；strategy：Decimal 严格阈值、BigInt lamports、纯函数状态机；graph：异步转账证据，不自动确认同控制。
- storage：SQLite WAL + busy_timeout；单 worker 写入策略状态，API 只改配置。事件、raw、jobs、参数版本、仓位、边持久化。
- 24h：Docker 两个服务 api/worker，命名卷、restart unless-stopped、健康检查。浏览器关闭不影响 worker。先完成短时故障验证，再做 24h soak；未实测不得声称完成 24h 验证。

## 信号与失败策略
确认级别 confirmed，后续 finalized 校验；失败/回滚标记并撤销由其产生的 paper 状态。单 token 一笔仓位；signature+swap 索引去重。买方来自实际接收 token account 的 owner。SOL 计量为 swap 支付的原始 lamports，不合计独立订单。支持范围逐协议公布；复杂 route 不足以确定收款人时不触发。

市值定义为 USD 价格 × 经来源确认的流通供给；total supply × price 仅为 FDV，不代替。流通供给、可执行双向报价、监控覆盖或窗口数据缺失时禁止入场。外部窗口暂定触发前 30 秒最大单笔 ≤ 1 SOL。网络/租金/滑点/费用应单列估算及来源，不代表实际成交。重放数据禁止污染 LIVE 仓位。

关键外部输入：链上 RPC/日志、配置 JSON、第三方行情；均不可信。无私钥、无签名、无下单方法；服务密钥仅 .env。API 不返回 RPC URL 或错误详情中的密钥。

## 成本预算
[Helius 官方价格](https://www.helius.dev/pricing)：Free $0/月，1M credits，10 RPS；Developer $49/月，10M credits，50 RPS。本期默认免费公共 RPC 或用户已有 Helius Key，不注册、不付费、不自动升级。

粗算：3 地址每分钟回补一次为 129600 次/月；完整交易读取按实际事件数增加，finality 校验/重试也消耗额度。历史/归档调用可能 10 credits，池子流量远大于钱包流量，免费额度不能承诺足够。默认仅 2 RPC/s、每日请求预算 20000（约 600k 月请求，非 credits 保证），超额停止请求并暂停开仓；UI 展示日请求量。RPC 预算只覆盖本应用，服务商控制台的共享用量仍需查看。

本机新增现金成本 $0（不含电费/现有网络）。主机规划 $5–15/月仅内部估算，不是供应商报价；未购买。SQLite/前端库 $0 许可费。实时处理 LLM 成本 $0，禁止逐交易模型调用。AI 代理实际 tokens/cost：平台未提供，不能编造。

## 分模块验收
1. 独立 Git + monorepo，三个真实钱包订阅、raw/job/事件落盘；断线回补、去重、健康接口。
2. 纯函数策略：2.0 不退出，2.0001 一次退出，1.2+1.2 不累计；失败、排除、未知开关、缺估值拒绝、净收益与幂等。
3. API + React：同源实时数据、策略保存版本审计、启停/紧急关闭、PAPER/来源/异常态。
4. 图谱：真实 hash/时间/关系/置信；转账边不自动进入关联排除名单。
5. 历史 raw 交易回放 + 合成边界回放分别报告；漏报计数和异常不能伪造为零。
6. Docker 持久部署、README、安全检查；24h soak 是运行验证任务，不能以配置存在替代。

## 迁移与回滚
初版单机 SQLite；以后 PostgreSQL 使用事务/唯一约束/JSONB 迁移，冻结 worker 后导出 raw、jobs、settings、events、positions，再核对数量/signatures。配置先复制 .env 为本地备份（忽略提交）；参数每次保存旧版本入审计。DB 备份需用 SQLite backup/VACUUM INTO，不能运行中只复制主 db 而忽略 WAL。

## 免费公共 RPC 压力观察后的调整
候选 token 可以存储，但仅对 LIVE open position 的池子订阅。历史候选池队列保留为 deferred，不删除已有证据；核心钱包 LIVE jobs 优先于历史。初次每地址回补最近 10 条，后续增量分页每页 100、最多 10 页，超出上限标缺口。这个边界不是全量历史或外部窗口完整性保证。LIVE entry 仍关闭。
