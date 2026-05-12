# CURRENT_STATE

Audience: 接手当前 Soulmap 工作区的 AI 代理  
Purpose: 明确当前工作区真实做到哪一步，并快速找到主要代码入口  
Last Verified: 2026-04-23

## Primary App Entry

当前正式 web 入口是 `apps/channel-web/`，主装配从 [src/main.js](../../apps/channel-web/src/main.js) 开始。它根据路由切换四类页面：

- 频道列表
- 单个频道页
- 创建频道页
- demo 页

`prototypes/` 只保留历史参考价值，不是当前实现入口。

## Implemented Capabilities

按用户流看，当前工作区已实现：

- 频道进入与预览：频道列表、进入频道、公开预览、demo 路由
- 登录与门禁：`auth gate`、密码登录、注册、游客态阻断
- 加入与审核：加入申请、审核面板、成员审批状态
- 内容闭环：发帖、评论抽屉、回复评论、点赞、删除、图片灯箱
- 身份与匿名：真实身份编辑、匿名马甲、匿名发帖、匿名保护相关逻辑
- round 机制骨架：阶段切换、愿望认领、交付、猜测、揭晓数据与管理动作
- 频道操作：频道设置、通知中心、搜索、成员列表、频道 intelligence

这些能力已在 `src/test/` 中按 `runtime/auth/membership`、`feed/comments`、`composer/round`、`overlay/ui`、`selectors` 分域验证。

## Current Module Map

旧 architecture 文档已经落后于当前代码，接手时以代码为准。页面装配先看 [src/screens/](../../apps/channel-web/src/screens/)。

行为编排：

- `runtime`
- `auth`
- `membership`
- `feed`
- `composer`
- `round`
- `channel-create`
- `shell`
- `app-actions.js`

主要 UI block：

- feed / composer / comment drawer
- auth gate / join request / membership review
- channel hero / board tabs / search dialog / notification center
- channel settings / channel menu / identity dialog / image lightbox / member list
- channel intelligence / system feedback / sidebar nav

## Data / State / Runtime Shape

当前数据层和状态层采用兼容 shim + 内部分层：

- [src/shared/data/channel-data-service.js](../../apps/channel-web/src/shared/data/channel-data-service.js) 是稳定入口，内部拆成 `auth-session / channel-bootstrap / membership / feed-posts-comments / identity-alias / round / cache`
- [src/shared/state/store.js](../../apps/channel-web/src/shared/state/store.js) 是稳定入口，内部拆成 `runtime / auth / membership / channel-create / round / feed / composer / overlay / ui`
- `channel-round-repository.js` 已单独存在，round 数据逻辑不再混在普通 feed 流程里

运行时仍优先走 `VITE_*`，并兼容 `public/channel-runtime.js` 兜底。

## Validation Baseline

当前仓库默认验证入口：

- `npm run test:web`
- `npm run build:web`
- `npm run check`
- `npm run audit:context`

`audit:context` 会检查 `AGENTS.md` 体量、超大源码文件、超大测试文件，以及搜索噪音是否重新污染上下文。

## Known Gaps Or Incomplete Areas

当前工作区已经能支撑主要交互和 round 骨架，但仍有这些边界：

- 旧的 `docs/architecture/*` 不是全部与当前代码同步，接手时不要直接把旧文档当成真实状态
- 当前工作区本身包含一批未提交改动，`CURRENT_STATE` 以这份工作区为准，不以“最后一次提交”定义真实状态
- 某些 AI、图片、Storage、扩展能力仍是骨架化接法，不应被误判为“整个系统都已落地完毕”
- 当前打包仍有较大的主 chunk，说明“可运行”不等于“已完全优化”

## Source Evidence

- [apps/channel-web/src/main.js](../../apps/channel-web/src/main.js)
- [apps/channel-web/src/features/](../../apps/channel-web/src/features/)
- [apps/channel-web/src/shared/data/channel-data-service.js](../../apps/channel-web/src/shared/data/channel-data-service.js)
- [apps/channel-web/src/shared/state/store.js](../../apps/channel-web/src/shared/state/store.js)
- [apps/channel-web/src/test/](../../apps/channel-web/src/test/)
- [package.json](../../package.json)
