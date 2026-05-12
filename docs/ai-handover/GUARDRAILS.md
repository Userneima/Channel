# GUARDRAILS

Audience: 接手当前 Soulmap 工作区并准备修改代码的 AI 代理  
Purpose: 明确哪些边界不能乱动，避免把产品重新打散或把 UI 改回原型式结构  
Last Verified: 2026-04-23

## Non-Negotiables

- 正式维护入口只有 `apps/channel-web/`
- `prototypes/` 只作参考，不作为继续开发入口
- 默认先读源码，不默认把多份长文档塞进上下文
- 任何改动都必须优先减少用户认知负担，而不是顺手加功能

## File Routing Rules

改动前先判断落点，不要整页乱读：

- 改界面：先看 `src/blocks/<block>/`
- 改页面装配：看 `src/screens/`
- 改行为编排：看 `src/features/`
- 改状态：看 `src/shared/state/`
- 改数据接入：看 `src/shared/data/`
- 改运行时配置：看 `src/shared/config/`
- 改结构规则：写进 `docs/architecture/`

如果一个改动需要同时读四个以上 block，优先怀疑边界是否该重新拆，而不是继续把更多代码塞进当前 block。

## Do Not Break These Boundaries

当前项目最重要的不是“用了什么技术”，而是边界已经被刻意收紧：

- `screen` 负责页面装配，不承载业务细节
- `block` 只负责模板、selector、局部事件出口和局部样式
- `feature` 负责编排行为，不直接操作 DOM
- `state` 是统一状态源，不要绕开 store 自己再造状态层
- `data` 负责 Supabase 与运行时数据访问，不要让 block 直接碰数据源

明确禁止：

- 不要把新功能塞回整页模板
- 不要让 block 直接读 Supabase
- 不要让 feature 直接操作 DOM
- 不要为了“快”把状态字段散回组件局部临时变量
- 不要把截图、临时素材、导出稿堆进正式 app 目录

## UI Constraints

UI 改动必须服从当前产品气质，而不是局部组件自嗨：

- 保持安静、克制、偏编辑感
- 通过 tonal layering 建层级，不靠硬边框切区
- 浮层、弹窗、抽屉默认做小，并贴近触发点
- 不引入多余辅助文案、无意义标签或解释性噪音
- 不允许浏览器默认白色 focus ring、原生 select、系统高亮泄漏到最终界面

读 UI 相关文档时也要收敛：

- 纯视觉一致性任务再读 `docs/design/quiet-curator.md`
- 不要为了普通 UI 修改把 design 长文整篇吞进上下文

## Data / State Constraints

当前数据层和状态层已经被拆成兼容 shim + 内部分层，接手时不要再把它们重新合并回去：

- `channel-data-service.js` 是稳定入口，内部再分 `auth-session / bootstrap / membership / feed-posts-comments / identity-alias / round / cache`
- `store.js` 是稳定入口，内部再分 `runtime / auth / membership / channel-create / round / feed / composer / overlay / ui`

如果改动涉及：

- 频道初始化、身份初始化、成员状态：先看 data service 与 runtime feature
- round 相关字段或流程：先看 `features/round/`、`channel-round-repository.js` 与 `state/store/round.js`
- UI 只读 view model：优先改 selector，而不是把判断塞回模板

## Validation Before Claiming Done

完成前至少跑相关验证，不要把“看起来能用”当成完成：

- UI / 行为 / 状态 / 数据改动：至少跑 `npm run test:web`
- 涉及入口、构建或模块装配：同时跑 `npm run build:web`
- 想确认上下文卫生没有反弹：跑 `npm run audit:context`
- 需要完整基线时：跑 `npm run check`

文档改动虽然不是功能改动，也要校对路径、命名、命令和当前仓库一致。

## Out-Of-Bounds Areas

以下内容默认不在普通实现改动里顺手处理：

- 回到 `prototypes/` 重做页面
- 把产品改成另一种形态，例如论坛、聊天机器人入口、通用 AI 助手
- 在没有明确需求时重做信息架构、视觉语言或部署流程
- 在没有证据时把旧 architecture 文档当成真实当前结构
- 未经明确要求执行 `git push`

## Source Evidence

- [AGENTS.md](/Users/yuchao/Documents/GitHub/Soulmap/AGENTS.md:1)
- [docs/architecture/ai-friendly-ui-editing-rules.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/architecture/ai-friendly-ui-editing-rules.md:1)
- [docs/architecture/repository-structure.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/architecture/repository-structure.md:1)
- [docs/design/quiet-curator.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/design/quiet-curator.md:1)
- [apps/channel-web/src/shared/state/store.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/shared/state/store.js:1)
- [apps/channel-web/src/shared/data/channel-data-service.js](/Users/yuchao/Documents/GitHub/Soulmap/apps/channel-web/src/shared/data/channel-data-service.js:1)
