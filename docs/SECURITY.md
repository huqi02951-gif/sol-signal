# 安全边界与检查
- 第一阶段无 Solana 私钥/助记词加载、签名器或提交交易 API；RPC 方法硬白名单，单测拒绝 sendTransaction。
- 不装 GMGN CLI 或真实交易 SDK；仅官方协议字段元数据用于解码，来源见 vendor/SCHEMA_SOURCES.md。
- API 服务默认 127.0.0.1，Host 白名单防 DNS rebinding；JSON 写请求 + Origin 检查；参数 Zod 校验及乐观版本控制。
- 当前无多用户认证。Docker 端口只绑定 loopback；远程访问须使用认证反向代理/TLS，不可直接暴露公网。CORS 不是身份认证。
- .env、数据、node_modules 不提交；Helius URL 不输出到日志/API。只有 worker 可读服务密钥；Docker API 不注入密钥。
- Graph 转账是 observed transfer 弱证据，绝不自动同控制聚类或排除。公共实体名单仍需人工维护，程序账户过滤尚需完善。
- 标准 RPC + 2 请求/秒 + 日预算保护；日请求不是信用额度账单保证。免费公共 RPC 可限速或不稳定。
- 依赖审查是源码范围检查 + lockfile audit，不是第三方完整安全审计。检查命令 pnpm audit --prod；使用官方 registry，镜像 audit 曾不支持。
- 未支持协议、事件截断、接收 owner 不匹配、非 WSOL 计价、失败交易不生成买单。
- confirmed 事件升级 finalized；err 撤销源仓位。confirmed 消失但 RPC 返回 null 的完整回滚裁决尚未实现，入口保持关闭。
- 24h soak、全池迁移发现、全协议路由解析、真实双向报价/费用估算与流通供给校验尚未通过生产验证。

## 第一轮更新
可选Jupiter读取仅GET quote，密钥只在服务端header，不会写返回JSON或日志；不调用swap构建或发送。流通供给佐证要求来源/期限/证据并核对链上total，未配置不自造。完全池集/窗口佐证仍缺，保持关闭。疑似名单排除默认关闭，公共服务地址仅明确配置，不宣称自动识别CEX全集。主备共享应用请求限额，独立对账使用独立限额，网络失败/限流不自动付费升级。
