# 验证记录 · 2026-10-12

## 已验证
- `pnpm test`：6 文件、17 测试通过。包括严格金额/失败/排除/未知/参数即时切换/原子去重/成本止盈/源失效/持久队列恢复/核心 LIVE 优先/读 RPC 白名单与日预算/API Origin/Host/输入/版本冲突/真实 PumpSwap 解析。
- `pnpm build`：TypeScript 检查与 Vite 生产构建成功；最后 CSS 修正另执行 `pnpm --filter @sol/web build` 成功。仍有 Zod pure annotation 与大 bundle 提醒，非构建失败。
- `pnpm peers check`：无 peer dependency 问题。
- `pnpm audit --prod`：0 已知漏洞；机器可读记录 DEPENDENCY_AUDIT.json。初始 static 8.x 有漏洞，升级为 10.1.6 后重新通过。审计不等于完整安全保证。
- `pnpm history`：三个真实钱包各 5 笔，15 笔成功抓取；原始 JSON/时间/signature 留在 fixtures/history。
- `pnpm replay`：15 笔真实 raw 回放，识别 1 笔 PumpSwap SOL 买入；由于缺报价/流通供给/覆盖不入场。合成 DEMO 入场→2.0保持→1.2保持→1.2保持→2.0001退出一次。漏报无独立基准，标 unknown。
- 已解析真实样本：`oXpJso1AxGqRDokEsu79nvviX6mzbE4oYEqi1wThXYRBRBC21b4xgcUJV9cYNcd5KvnjTm8LeJv9BmVgLQtq2og`，slot 456046896，swap 输入 114936729 lamports，token raw 输出 22194113914；owner=钱包 A。
- 实际 WebSocket：公共 RPC 对 3 钱包分别确认订阅；观测 slot 456052813，数据库真实事件及原始交易已保存。运行中观察到 HTTP 429、重试队列；没有把 socket 已连接误认为数据健康。
- 浏览器手动：DEMO 回放闭仓；阈值2→2.0001保存为v2，恢复2保存v3，审计可见；紧急关闭后订阅0，启动后3；LIVE/HISTORY/DEMO 标签与数据不足告警可见。
- 移动布局390px：修正导航 intrinsic width 后 document scrollWidth=390，clientWidth=390；桌面与移动截图保留。不是完整 WCAG 审计。
- SQLite 一致备份脚本运行成功：本地 ignored `data/acceptance-backup.sqlite`。

## 限制与待验收
- 没有运行满24小时；当前API与worker是独立本地进程，电脑休眠/重启会停止。机器无docker命令，因此compose未构建/运行，不能声称部署验证完成。
- LIVE 新开仓故意关闭：未完成流通供给/真实双向报价/完整外部买单窗口覆盖。策略纯函数通过不等于实时模拟全链路完成。
- 协议支持说明见 vendor/SCHEMA_SOURCES.md；除PumpSwap外缺真实fixtures；复杂路由和所有迁移池发现未完成。
- 图谱仅有转账弱证据，公共实体识别/共同注资/Louvain尚未完成；不会自动同控制或自动排除。
- confirmed消失的完整回滚裁决和仓位ledger重建未完成；err能标invalidated。
- 生产免费RPC吞吐不足不能用程序修复；候选池订阅已收窄为LIVE持仓池。调试阶段捕获的其他池jobs保留为deferred，不删除证据。

使用技能：engineering-change-discipline → tdd（策略/持久化/API行为）与 redesign-existing-projects（原型迁移及状态完善）。没有调用逐交易大模型。代理实际token/cost平台未提供。

## 第一轮审查修正（2026-10-12）
最终41测试/15文件、构建、历史回放通过，生产依赖audit零已知漏洞。详见REVIEW_ROUND1.md、PRESSURE_REPORT.json、ROUND1_METRICS_SAMPLE.json。本轮启动72h独立采集，未完成72h；用户确认暂时无报价Key/供给，继续免费只读，LIVE入场保持关闭。初版17测试记录是当时结果，不代表当前数量。

2026-10-12 本轮最终检查：16个测试文件/43项通过，TypeScript与Vite通过。AI两项集成测试只使用模拟模型响应，无真实Key调用；网页已检查默认关闭与禁用按钮。主网延迟样本见ROUND1_METRICS_SAMPLE.json，不代表72h通过。

2026-10-13 简化界面/用途保护：17文件46项通过；pnpm build通过。Cloudflare Pages静态预览已上线，浏览器及HTTP200确认；不存在全天候云后端或登录保护。Worker先前1101未确定根因，改用纯静态Pages并关闭失败入口。主网72h观测因采样缺口与大量不健康样本未通过，见SOAK_INTERIM_2026-10-13.json。
