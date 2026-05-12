# Channel Project Guide

## Purpose
- 正式维护入口只有 `apps/channel-web/`。
- 目标是持续演进频道产品骨架，不回到原型式整页改动。

## Working Defaults
- 默认回复语言：Chinese
- 代码、命令、变量：English
- 结论先行，不说空话，不做无意义恭维
- 能安全继续就直接检查、修改、验证，不把可执行步骤回退给用户

## Repo Routing
- 改界面：先看 `apps/channel-web/src/blocks/<block>/`
- 改页面装配：看 `apps/channel-web/src/screens/`
- 改行为编排：看 `apps/channel-web/src/features/`
- 改状态：看 `apps/channel-web/src/shared/state/`
- 改数据接入：看 `apps/channel-web/src/shared/data/`
- 改运行时配置：看 `apps/channel-web/src/shared/config/`
- 改结构规则：写进 `docs/architecture/`
- `prototypes/` 只参考，不继续开发

## Context Control
- 默认先读源码，不默认吞多份文档
- 纯 UI 视觉一致性任务：按需读 `docs/design/quiet-curator.md`
- 架构/边界问题：按需只读一份对应的 `docs/architecture/*`
- 非测试任务先不要把大测试文件整段读进上下文

## Product Constraints
- 用户体验优先于技术洁癖
- 保持安静、克制、偏编辑感
- 浮层、弹窗、抽屉默认做小并贴近触发点
- 不引入多余文案、辅助标签、浏览器默认白色 focus ring

## Validation
- 功能改动后至少运行相关验证
- 常用命令：
  - `npm run test:web`
  - `npm run build:web`
  - `npm run check`
  - `npm run audit:context`
- 文档改动也要校对路径、命名、命令是否与仓库一致

## Safety
- 不写入 secrets 或 credentials
- 不改无关文件
- 高风险、不可逆、涉及权限/费用/删除数据时才停下来确认

## Git
- Commit message 用 English
- 不要假设部署流程，先看项目文档
- 未经明确要求，不执行 `git push`
