# SOL SIGNAL 入场与退出增量验证 · 2026-10-16

用户确认默认有效期5分钟，三个退出开关全部开启，任意一条满足清仓。PAPER ONLY，不接入模型、私钥或发送交易。

## 已实现规则

| 条件 | 默认与边界 |
|---|---|
| 发射／迁移年龄 | 决策时刻距成功链上事件≤300秒，超过即拒绝入场 |
| 市值 | 可信流通市值严格>200000 USD；不接受FDV替代 |
| 入场前非关联买单 | 观察窗默认30秒，最大单笔≤1 SOL；不是累计1 SOL |
| 止盈 | 扣除估算成本后净收益严格>50% |
| 外部单笔退出 | 已识别非关联钱包单笔严格>2 SOL；UNKNOWN默认不冒充外部 |
| 首次买家退出 | 有效FIRST买单事件时USD累计≥1000；单笔至少0.5 SOL，钱包+mint去重 |

三条退出开关均为true，实际配置已保存为版本4。仓位退出不受入场年龄过期影响。旧交易回补不触发新过期信号。所有字段在策略页面可修改。

## 时间证据

仅解析可信Pump程序调用栈内成功create/create_v2+匹配CreateEvent，或migrate+CompletePumpAmmMigrationEvent。事件mint、曲线及创建者／池匹配，事件时间须与RPC blockTime相差不超过5秒。事件必须早于入场交易slot；同slot未知排序保守拒绝。PumpSwap入场要求迁移证明。证据签名随模拟仓位保存，回滚时失效。

没有证明时显示UNKNOWN；不会把代币发现时间、最早返回交易或网页创建时间当作发射时间。历史查找每次最多6个免费RPC请求，每mint最多3次，每次至少间隔60秒，仅核心队列健康时启动。只检查有限页，不能保证发现所有历史发射；暂不覆盖其他协议的生命周期。

官方IDL来源、提交号、摘要记录在vendor/SCHEMA_SOURCES.md。新增生命周期解析测试为按官方IDL构造的协议形状样本，尚无真实create/migrate fixture，不能宣称真实识别准确率已验收。

## 验证

- pnpm test：80项测试、29个文件通过。
- pnpm build：类型检查与本机生产构建通过。
- pnpm build:cloud-preview：独立静态前端构建通过。
- 新测试覆盖300秒边界、20万美元严格边界、净50%严格边界、1/2 SOL边界、时间证据缺失／不匹配、重复迁移不刷新窗口、回滚、create与buy同交易不丢买单、有限历史查询失败保持UNKNOWN。
- 本机API确认配置版本4、三个订阅连接、模型调用0、entryReady=false。配置发布期间旧worker因不识别新增字段退出，新版已恢复；此中断不得从连续观测记录中剔除。

## 实测与缺口

前一阶段实测延迟、四币合成压力、真实买单回放及未测试供应商分别保留于V3_LIVE_REPORT.json、V3_PRESSURE_REPORT.json、V3_REPLAY_REPORT.json、V3_PROVIDER_COMPARISON.json；它们不构成本次新入场规则的真实盈利回测。

真实买家的非关联身份、完整首次购买历史、事件时USD、流通供给、可执行双向报价及全池完整性仍缺少权威证据；LIVE模拟入场继续受保护。当前只有核心钱包订阅，四币全池主网吞吐与独立来源漏报对账未验收，付费供应商均未测试。没有数据不等于零买家。72小时连续验收未通过。

线上Cloudflare页面是带日期的只读公开链上快照，不能修改本机配置，也不是24小时云端后端。本机API与worker独立运行，仍依赖电脑在线、不休眠。应用运行时不读取Codex/OpenAI/GLM凭据，模型调用为0；开发聊天额度与应用运行是两件事。

## 回滚

修改参数前已生成一致性备份data/before-entry-rules-2026-10-16.sqlite（不提交）。正常参数调整用策略页生成新审计版本。代码回退至0cff96d2前，必须先停止API、worker及soak全部数据库连接，恢复该备份至data/sol-signal.sqlite，关闭连接后移走旧-wal/-shm，再切回旧提交、构建和重启。旧版严格配置schema不接受entryMaxAgeSeconds，不能只回退代码。整库恢复会丢失备份后的观测，先为当前库另做一致性备份；保留当前代码可继续读取新旧配置。

技能：engineering-change-discipline、diagnosing-bugs、tdd、cloudflare-deploy。

部署验证：稳定地址 https://sol-signal-preview.pages.dev/ ，本次不可变版本 https://a0cf1974.sol-signal-preview.pages.dev/ ，均HTTP 200。浏览器确认300秒、200000 USD、50%、三个退出开关开启；截图ENTRY_RULES_2026-10-16.png。
