# 解析字段元数据
这些 JSON 仅提取公开协议 IDL 的地址、指令标识、账户位置与事件字段。不是签名/交易代码；未执行第三方安装脚本。
- pump-schema / pump_amm-schema：[Pump 官方 IDL](https://github.com/pump-fun/pump-public-docs/tree/main/idl)，抓取日期 2026-10-12。使用 TradeEvent.sol_amount / quote_amount（旧版本 SOL）与 BuyEvent.user_quote_amount_in。SOL 数额定义为协议记录的 swap input；PumpSwap 包含其 user_quote 输入费用，不含额外网络/ATA 成本。
- raydium_cp_swap / raydium_clmm：[Raydium 官方 IDL](https://github.com/raydium-io/raydium-idl)，抓取日期 2026-10-12。仅支持 CPMM swap_base_input/output 与 CLMM swap/v2 的 SOL 输入；AMM v4、复杂 router/多跳 beneficiary 尚未支持。
- 对每个事件按调用栈匹配 program；再匹配已知 buy/swap 指令、池子与 token account 的 owner。不同实际接收方、失败或无法归因交易跳过。

本地文件 SHA256 随版本提交保留，升级 IDL 需重放 fixtures 和新增边界测试。当前 fixtures 仅覆盖真实 PumpSwap，不宣称其他协议已获得真实样本验证。

2026-10-16 增量：从 Pump 官方仓库提交 `639b87fb45c3adeffa6f7c4a1bf0cb85e392bf22` 的 `idl/pump.json` 仅补入 create/create_v2 账户位置与 CreateEvent/CompletePumpAmmMigrationEvent 字段，用于发射/迁移时间证明。要求成功指令、调用栈内事件、mint/池子匹配及链上时间交叉核验；仅有 migrate 指令而没有完成事件不能刷新迁移窗口。新增生命周期解析目前使用合成编码的协议形状测试，尚无真实创建/迁移 fixture，不声称已覆盖所有发射平台。
