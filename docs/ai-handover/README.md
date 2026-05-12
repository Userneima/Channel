# AI Handover

Audience: 第一次接手当前 Soulmap 工作区的 AI 代理  
Purpose: 用最短阅读路径找到产品定义、当前状态、风险边界和已验证经验  
Last Verified: 2026-04-23

## What To Read First

先读 [PRODUCT_BRIEF.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/ai-handover/PRODUCT_BRIEF.md)，确认这个产品在解决什么问题；再读 [CURRENT_STATE.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/ai-handover/CURRENT_STATE.md)，确认当前工作区真实做到哪一步；开始改动前读 [GUARDRAILS.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/ai-handover/GUARDRAILS.md)；遇到“这条路以前行不行”再读 [LESSONS_LEARNED.md](/Users/yuchao/Documents/GitHub/Soulmap/docs/ai-handover/LESSONS_LEARNED.md)。

## Which Doc Answers Which Question

- `PRODUCT_BRIEF`：这个产品为什么存在，不是什么。
- `CURRENT_STATE`：当前工作区真实实现了什么，入口和模块在哪。
- `GUARDRAILS`：哪些边界不能破，改动时先去哪里。
- `LESSONS_LEARNED`：已经踩过哪些坑，哪些做法已证明有效。

## Source Of Truth Order

handover 文档只是压缩层。若描述冲突，优先级固定为：

1. 当前代码与测试
2. `AGENTS.md`
3. `docs/architecture/*`
4. `docs/product/*`
5. `docs/design/*`

不要反过来用旧文档覆盖当前代码事实。
