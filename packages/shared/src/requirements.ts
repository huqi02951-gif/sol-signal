export const requirements=[
 {name:'V3 首次买家资金账本与四币队列',status:'部分完成',evidence:'Decimal 累计、UNKNOWN 保护、路由/钱包去重、独立退出开关、四币状态与等待队列已有测试；缺完整历史与交易时 USD 来源，未完成真实 PAPER 闭环。'},
 {name:'V3 延迟拆分与供应商对比',status:'部分完成',evidence:'新增本地持久/调度等待、请求往返和链上到判断指标；保留实时并发槽、可续页回补。Helius/Bitquery 无凭据未实测，免费 RPC 仍限流；四币压力测试为合成。'},
 {name:'运行时零模型 Token',status:'已实现',evidence:'模型网络调用已移除；旧模型环境变量不会启用调用。无需 Codex、OpenAI 或 GLM Key。'},
 {name:'三个钱包真实监听与落盘',status:'部分完成',evidence:'本机已验证 WebSocket、解析及持久事件。免费 RPC 有限流、断线和历史积压，长期稳定性尚未通过。'},
 {name:'策略参数与严格单笔阈值',status:'已实现',evidence:'参数版本审计；2 SOL 不退出，2.0001 SOL 退出，两笔 1.2 SOL 不累计。已用合成回放测试。'},
 {name:'真实 PAPER 买入到清仓闭环',status:'尚未完成',evidence:'缺可信流通供给、双向报价与完整池/窗口证据；入场继续保护。DEMO 不代替真实验证。'},
 {name:'钱包资金关系与买家页',status:'部分完成',evidence:'真实转账、共同资金源弱线索、单笔金额与交易链接已展示。未完成全链多层归因、完整公共服务过滤和关联持仓比例。'},
 {name:'全池发现与迁移覆盖',status:'尚未完成',evidence:'仅部分协议解析。免费模式默认只订阅核心钱包；候选池需明确启用且受队列/限流保护，不代表全池覆盖。'},
 {name:'延迟与历史回放',status:'部分完成',evidence:'阶段 P50/P95/P99、历史 fixture 和策略边界回放已有；没有可用独立来源，漏报率未知。'},
 {name:'全天候云后端与登录',status:'尚未完成',evidence:'Cloudflare 当前只有静态前端。没有持续运行云主机，没有 Access 登录或云端实时数据。'},
 {name:'72 小时持续验证',status:'尚未完成',evidence:'已有运行中断及大量不健康样本；不能标为验收通过。'},
];
