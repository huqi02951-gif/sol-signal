# Cloudflare 免费前端与常驻后端

2026-10-12：用户确认暂无云服务器，先准备免费方案与可验收界面。用户随后完成 Cloudflare OAuth 登录，已改用纯静态 Pages 发布。此阶段无常驻云后端、无登录保护、无模型 Key。正式地址与检查结果见下方部署记录。

## 已准备的免费预览

`deploy/cloudflare-preview` 是独立静态前端 Pages 构建配置：提供前端、三个公开钱包地址、使用指南；通过 VITE_CLOUD_PREVIEW 编译开关禁止前端发起 API 请求，页面明确显示未连接后端。绝不把本地钱包数据库、控制接口或模型凭据代理到公网，不显示假实时数据。

登录 Cloudflare 后可发布这一前端预览：

```sh
pnpm build:cloud-preview
npx wrangler@4.149.0 whoami
# 未登录时由账户本人完成 OAuth，不发送密码或 Cloudflare Token 到聊天
npx wrangler@4.149.0 login
npx wrangler@4.149.0 pages deploy deploy/cloudflare-preview/dist --project-name sol-signal-preview --branch codex/sol-signal
```

免费额度以 [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/) 为准，不启用付费套餐。没有常驻后端时，发布前端不代表 24 小时钱包监控上线。

## 完整上线的推荐路径

浏览器 → Cloudflare Access 登录 → 命名 Tunnel → 常驻主机上的 Fastify 前端/API → SQLite；同一主机独立 worker 订阅 Solana。当前版本完全没有模型推理调用或密钥读取。

沿用现有 `compose.yaml`，单 worker + 单 SQLite 数据卷，复用已验证代码；不把长连接 Node worker 直接搬到请求驱动的普通 Worker 中。纯 Cloudflare Durable Objects 方案需要重做调度/存储/连接恢复，出站连接会影响休眠和费用，不是简单改部署命令。

免费阶段可以使用本机 + Cloudflare Tunnel/Access，但本机休眠或关机将中断后端。这是远程访问本机，不是脱离本机的云托管。固定 Tunnel/Access 通常还需自己的域名和账户配置，域名费用不包含在“免费”里。不使用未鉴权的 Quick Tunnel 暴露控制台。

真正 24 小时运行需要现有持续运行主机或选定的云平台。预算先按现有架构的每月 US$5–15 规划（估算，不是报价）；不会自动购买主机。Cloudflare Containers 当前只有 Workers Paid，基础套餐 US$5/月加资源计费，参见[官方价格](https://developers.cloudflare.com/containers/platform/pricing/)，所以本阶段不启用。

## 上线前要落实的配置

1. Cloudflare 账户登录、域名和唯一允许登录的邮箱；Access 策略覆盖网页及全部 API，确认匿名请求被拒绝。
2. 后端部署目标、持久数据卷、自动重启、备份；API 仅在本机或内部网监听，Tunnel 向内转发，不开公共 8787。
3. 正确 `API_ALLOWED_HOSTS`，同源 Origin 校验；禁止浏览器直连绕过 Access 的后端。
4. 当前版本无需模型Key。未来如需模型另行核验第三方用途/计费许可并明确开发，不使用 CLI 套餐包装转发。
5. 验证后台关网页后持续处理、断线回补、数据备份、登录保护及 72h 观测；发布网址不等于通过这些检查。

## 回滚

纯前端可重新部署上一个 Git 提交的构建，无数据迁移。完整 Tunnel 版本发生问题先停 Tunnel（撤销外网入口），保持本地 worker；还原 `.env` 本地备份并重启 API。绝不删除 SQLite 卷。模型调用代码已经移除，不存在环境变量开启入口；本轮未写真实Key。

## 部署诊断记录
最初 Workers 静态资源版本线上返回1101，API和首页都失败，调整 run_worker_first 仍无效。上传脚本已通过官方API核对与源码一致，tail未获得可归因异常，因此根因未证实。改用纯静态Pages，避免在界面预览阶段依赖线上运行时。Wrangler新Pages自动委派在monorepo根目录失败；新建项目采用CLI明确提供的 --force 直接Pages模式，后续部署不再委派。没有因此购买套餐或迁移SQLite。

## 2026-10-13 最终部署记录
正式静态前端：[sol-signal-preview.pages.dev](https://sol-signal-preview.pages.dev/)；初次版本 00556ef3。已用浏览器确认首页，HTTP检查返回200。上线内容仅界面、关注地址和说明，不包含本地数据、模型Key或登录保护；前端预览编译开关阻止API调用。先前失败的Worker入口已关闭（可通过subdomain设置enabled恢复；Pages不受影响）。

自动化回归17文件46项通过；TypeScript与本地构建通过。钱包A/B/C切换、关系图聚焦、中文使用指南、390px手机页面无横向溢出已检查。

2026-10-13 后续复核：运行时模型调用模块移除，新增功能验收页；免费模式仅核心钱包订阅，候选池明确 opt-in 且有队列/冷却保护。新旧观测不能合并为72小时通过。
