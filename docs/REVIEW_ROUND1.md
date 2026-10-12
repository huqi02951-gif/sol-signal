# 第一轮外部审查处理 · 2026-10-12

使用 engineering-change-discipline、receiving-code-review、tdd。修正基于本地源码和可复现行为，不把外部评价当作验收事实。用户已确认：暂无报价Key/可信流通供给，继续免费只读，保持入场保护。

## 本轮修正
- RPC 从单条FIFO改为有界优先级调度，实时可越过回补，最多2个in-flight，仍共享500ms启动间隔及每日20000请求预算。主备可选，共用请求预算；单提供商429/5xx冷却30秒。worker每次领取下一任务时重新查看持久队列，避免20项快照阻挡新消息。
- 候选池观察打破“先开仓才能订阅”的循环：最近LIVE核心买单可建立默认2池、5分钟TTL的观察，持仓池保留；预算满或覆盖不明暂停入场，不扩大订阅到所有历史候选。
- 独立接收记录按signature/source保存；backfill与真实WebSocket碰撞时可升级队列元数据。原始交易、swap、买家观测、策略版本、处理时间均留证。
- 五时点记录 chainTime/receivedAt/rpcFetchedAt/parsedAt/decidedAt，真实PAPER信号另记signalAt；接收、RPC（含队列）、解析、判断、接收→判断和接收→信号分别统计P50/P95/P99，HISTORY/DEMO/backfill排除，负时间/时钟倒退不伪造为0。
- 真实数据接入：DEX Screener池子/展示行情；可选供给佐证文件、只读Jupiter双向报价、size/mint/slot/路由校验、SPL租金；不沿用FDV为流通市值。报价仍需完整coverage证明才允许入场。当前用户无源，实际LIVE入场仍关闭。没有把coverageComplete硬编码为true。
- 修正报价时钟：按判断时间验新鲜度，避免正常新报价被链上秒级旧时间永久拒绝；过时LIVE积压不得补开仓。报价刷新可触发净止盈，无需等新买单。旧paper fills保留，归档源失效不误伤同mint后来的有效仓位。
- 独立RPC对账：不同host、latest <=100 finalized signatures/核心钱包；比较已处理和首次订阅收到的证据，120秒宽限、运行开始前样本排除。未处理不等于WS漏报。当前独立源不可用/未配置，漏报率null，不是0。
- 已确认/手动疑似/公共服务名单分层；疑似排除默认关闭。共同资金源与最多3层已存储路径保留signatures，输出weak suspected，绝不自动同控制。没有宣称完成全链多层抓取或CEX全集识别。
- 外部买家独立页展示去重owner数、单笔最大lamports与大单证据；样本范围明确，关联持仓比例无数据时null。首页订阅/覆盖/开仓/模拟仓位分开显示。

## 验证证据
- 最终自动化与构建结果见本文件后续记录和 VALIDATION.md。
- PRESSURE_REPORT.json：合成200项全部落盘，serial/parallel使用相同启动间隔；并发2。合成传输约20ms，P95降低不等于主网低延迟。生产2RPS下200项至少约100秒，免费RPC无法承诺热门池的即时退出。
- 实际LIVE时点已有记录，signal samples仍可能为0（无真实入场）。必须报告样本量，不能据1个样本推断稳定P95。
- 独立公共来源测试：PublicNode和dRPC在当前环境均HTTP403；不能声称独立对账通过。
- 72h采集已启动，报告在ignored data/soak，每分钟采样；12小时一次聊天跟进，状态无变化保持安静。睡眠/中断会记录缺口。运行未满72h，当前不通过最终验收。

## 仍未完成的验收要求
真实供给、可执行双向报价与权威全池集/迁移覆盖、独立全量对账、复杂路由解析和Token-2022成本、真实PAPER闭环、72h持续结果仍欠证据；不解除保护、不买API、不签名、不发送交易。

来源：[DEX Screener市值定义](https://docs.dexscreener.com/token-listing)、[Jupiter只读quote v1（已deprecated）](https://developers.jup.ag/docs/api-reference/swap/v1/quote)、[PublicNode公开端点](https://solana.publicnode.com/)。没有安装额外第三方运行依赖。

## 回滚
修改前一致SQLite备份：本机 `data/before-review-round1.sqlite`（未上传）。停API、worker与soak后，恢复该备份并清理旧WAL/SHM，再检出本轮之前的 `d2be2d3` 并重启。SQLite新增表为增量，不重写原始事件或原始交易。参数仍可按审计旧值保存新版本回滚。

## 最终本轮检查
- `pnpm test`：16个文件、43项通过。新增实时优先/限流冷却/候选TTL/时点与空信号/独立分母/已存储多层证据/可选疑似过滤/精确持仓raw/报价供给校验/quote时钟/旧LIVE不补仓/归档回滚等行为。
- `pnpm build`：TypeScript与Vite通过（保留Zod注释和bundle体积提醒）；生产audit零已知漏洞。
- `pnpm replay`：15笔历史、1笔已验证PumpSwap；合成DEMO边界链路仍通过。
- 浏览器：新外部买家页、数据健康阶段P95/P99/零信号样本、72h状态与分层名单已手动检查。
- 本轮初期实测聚合与样本数在ROUND1_METRICS_SAMPLE.json，不能代替独立对账或72h结果。
- 已知核心/确认地址持仓可通过RPC按mint读取，最多8地址；只报告已请求地址范围与raw余额，无可信流通供给时不生成比例，更不代表发行者全部地址。
- 对同一秒外部单的入场窗口采取保守纳入；blockTime不足以排序时不能借此绕过上限。先收到后排队的老消息不能事后关闭较晚开的真实PAPER仓位。

处理路径的集成模拟另外验证：原始协议事件改为明确DEMO测试输入，外部2.0001 SOL在报价/健康不可用时保护性退出一次；重复处理不重复退出。该测试不是一笔真实主网大单。

## 可选模型接入
用户希望运行时使用自己的千问/GLM额度。已加入服务端OpenAI兼容接口与手动摘要入口，默认关闭，不进入worker链路。日限额5次持久化，失败也计入；只发送精简事件字段，无自动动作。测试验证关闭零调用、provider选择、脱敏、限额、重启及隔日重置；没有真实Key，未进行收费服务调用。配置/回滚见AI_SETUP.md。

最后一次本地主网快照：8个接收→判断样本，P95/P99 14578ms，PAPER信号0个。样本少且包含公网RPC排队，不能推断稳定低延迟。API单独重启应用模型配置，worker与72h采样进程继续运行。
