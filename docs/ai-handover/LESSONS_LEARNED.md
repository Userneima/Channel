# LESSONS_LEARNED

Audience: 需要继续推进 Soulmap 的 AI 代理  
Purpose: 沉淀这个项目里已经证明有效或无效的做法，避免重复踩坑  
Last Verified: 2026-04-23

## What Already Failed

### 先抽象思考，再让 AI 全盘展开

这条路在这个项目上已经被证明会膨胀。抽象 PRD 很容易越写越多，而 AI 会把所有想法都当成“应该被实现的范围”，最后得到的是一堆没有被组织好的功能，而不是一个认知负担低的产品。

### 先复刻成熟频道，再慢慢塞入自己的判断

这条路的边际收益也很低。成熟产品的复刻会把大量时间花在动效、控件细节和局部还原上，但这些工作并不直接验证 Soulmap 这个产品的核心判断。结果是“花很多时间做像”，但没有更多验证“为什么这样做”。

## What Is Proven To Work

### 真实社区场景驱动

用真实社区、真实角色和真实流程来定义产品，比从抽象命题倒推更有效。这样用户是谁、流程怎么跑、匿名哪里会出问题、AI 适合放在哪一步，都不需要猜。

### 在频道骨架里做机制升级，而不是另起一个壳

这个项目已经证明：保留频道结构、在其中嵌入规则和阶段信息，比重造一个“独立游戏界面”更适合当前目标。它更符合现有使用心智，也更容易持续演进。

### 把系统边界收紧到局部修改单元

当前 block / feature / store / data 的局部分层，已经证明能明显降低 AI 接手成本。评论抽屉、搜索、通知、round 状态这类改动，不需要重新吞整页结构和全局脚本。

## Context Management Lessons

这个仓库之前已经出现过“聊几轮上下文就满”的问题，根因不是单一文档，而是几层叠加：

- 仓库级指令
- 长 architecture / design 文档
- 大单体源码
- 大总测试文件

当前已经证明有效的做法包括：

- 把 `AGENTS.md` 压成短路由器，而不是全局说明书
- 用 `.rgignore` 屏蔽生成产物，避免搜索噪音
- 把 data service 和 store 保持为稳定 shim，但把内部实现拆开
- 把大总测试文件拆成按业务域组织的小 suite
- 用 `audit:context` 把上下文卫生变成可检测基线

## UI / Architecture Lessons

- UI 改动不能回到整页模板思路，否则上下文和改动面会一起失控
- 视觉规则要保持“安静、克制、偏编辑感”，否则局部优化很快会把整页气质拉散
- 复杂动作适合放到弹窗、抽屉和管理面板里，而不是塞回主内容流
- architecture 文档一旦滞后，继续照抄会误导接手者；这也是为什么 handover 文档必须明确“以当前代码为准”

## Testing / Verification Lessons

这个项目已经证明，“有测试”不够，测试结构本身也会影响 AI 接手效率：

- 大总测试文件会让阅读入口重新变重
- 按 `runtime/auth/membership`、`feed/comments`、`composer/round`、`overlay/ui`、`selectors` 分域之后，更适合定位行为来源

验证命令里，`audit:context` 已经不是可选工具，而是 handover 反噬的预警器。它把几件原本容易默默变坏的事显式化了：

- 指令文件是否重新膨胀
- 是否又出现超大源码文件
- 是否又出现超大测试文件
- 搜索结果里是否混入生成物

## Heuristics For Future Changes

- 先问“这次改动服务哪条真实用户流”，再看代码
- 先找 block / feature / state / data 的正确落点，再决定怎么改
- 能在 selector 解决的展示判断，不要塞回模板
- 能从当前测试证明的事实，不要再凭感觉解释
- 旧文档和代码冲突时，先信代码，再决定文档怎么修

## Source Evidence

- [docs/product/soulmap-assignment.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/product/soulmap-assignment.md:1)
- [docs/architecture/channel-web-implementation.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/architecture/channel-web-implementation.md:1)
- [scripts/context-audit.mjs](/Users/yuchao/Documents/GitHub/Soulmap/scripts/context-audit.mjs:1)
- [apps/channel-web/src/shared/data/channel-data-service.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/shared/data/channel-data-service.js:1)
- [apps/channel-web/src/shared/state/store.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/shared/state/store.js:1)
- [apps/channel-web/src/test/actions.runtime-auth-membership.test.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/test/actions.runtime-auth-membership.test.js:1)
- [apps/channel-web/src/test/selectors.composer-feed.test.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/test/selectors.composer-feed.test.js:1)
