# 可选千问 / GLM 事件摘要

钱包监听、解析、存储和策略全部本地运行，无需 GPT、千问或 GLM。模型仅用于网页“事件日志”中的手动摘要，不参与实时链路，也不改变策略。

在项目根目录的本地 `.env` 中填写以下变量，重启 API（`pnpm api`）。不要把真实密钥发到聊天或提交 Git。

```dotenv
AI_ENABLED=true
AI_PROVIDER=qwen
AI_MODEL=qwen-plus
AI_API_KEY=填写你自己的服务商密钥
```

千问使用国内 DashScope 的 OpenAI 兼容接口，参见[阿里云文档](https://help.aliyun.com/zh/model-studio/model-calling-in-sub-workspace)。GLM 改为 `AI_PROVIDER=glm`，`AI_MODEL` 填写你账户可用的文本模型代码，参见[智谱对话补全文档](https://docs.bigmodel.cn/api-reference/模型-api/对话补全)。模型权限、价格和地区由你的服务商账户决定；不自动订购服务。

其他 OpenAI 兼容服务设置 `AI_PROVIDER=custom` 和 `AI_BASE_URL=https://你的可信服务/v1`（不含 `/chat/completions`）。此地址是服务端管理员配置，会收到你的模型 Key；不要填写陌生代理地址。禁止明文 HTTP、URL 凭据和重定向。GLM Coding Plan 与标准推理 Key 可能使用不同端点，需要依据账户官方文档配置 custom。

每次只发送最近 15 条事件的类型、时间、LIVE/HISTORY/DEMO 来源和交易签名，以及连接/入场就绪布尔值，不发送事件 detail、数据库、配置或原始 RPC 报文。请求输出上限 300 Token；每天最多 5 次、间隔至少 60 秒，失败也计数，计数持久化。提供商可能另计输入/推理 Token；界面显示其返回的 usage，不承诺零费用或固定人民币预算。

默认关闭时模型请求为 0。`AI_ENABLED=false` 并重启 API 即可关闭；不影响 worker。已用模拟响应测试关闭、限额、重启保留、脱敏及接口选择；没有真实 Key，因此未做真实服务商联调。

本项目接入 Key 不会改变开发时 Codex 对话的模型和额度；也不能替代 Solana RPC Key、Jupiter 报价 Key 或流通供给证据。
