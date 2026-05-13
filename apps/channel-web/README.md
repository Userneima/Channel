# Channel Web App

这是当前维护中的社区频道 web app。

文件职责：
- `index.html`：只保留根挂载点和运行时脚本入口
- `public/`：只保留实际会被应用消费的静态资源和运行时兜底配置
- `src/main.js`：应用入口
- `src/screens/channel-page/`：页面装配层
- `src/blocks/`：稳定 UI block
- `src/entities/`：频道、身份、帖子相关配置
- `src/features/`：用例编排层
- `src/shared/`：store、数据源、共享工具函数、样式

当前数据边界：
- `src/shared/config/runtime-config.js`：统一读取 `VITE_*` 环境变量和可选运行时兜底配置
- `public/channel-runtime.js`：可选运行时兜底文件，不再放正式环境配置
- `src/shared/data/channel-data-service.js`：Supabase data service，负责 `initialize / list / get / publish / update`
- `src/shared/state/store.js`：统一状态源，按 `runtime / feed / composer / overlays / ui` 分 slice
- `src/features/*`：只做动作编排，不直接写 DOM
- `src/blocks/*`：只消费 view model 和 action，不直接读 Supabase

维护规则：
- 继续开发时优先改这里，不再回到旧的 Stitch 导出目录和 `prototypes/`
- 如果只改某个界面区域，优先只动对应 `src/blocks/<block>/`
- 如果改的是行为或数据流，优先动 `src/features/` 和 `src/shared/state/`
- 如果只改视觉规则，优先同步 `docs/design/quiet-curator.md`
- 不要把截图、对照稿、临时素材堆到 `public/`，这些应留在 `prototypes/` 或文档目录
- 产品背景和作业说明放 `docs/product/`，不要回填进 app 目录

AI 读码建议：
- 默认从 `src/screens/`、`src/blocks/`、`src/features/` 的局部入口读起，不要先吞全量 state 或 data 层
- 非数据层任务默认不要先读 `../data-service-support/core.js`
- `src/features/round/actions.js`、`src/features/composer/index.js` 是高上下文成本文件，只有任务直接命中对应域时再打开
- 小程序端 `../king-angel-mini/`、原型目录 `../../prototypes/`、handover 文档 `../../docs/ai-handover/` 都不是当前主维护面
