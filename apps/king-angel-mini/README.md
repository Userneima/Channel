# King Angel Mini Program

这是“国王与天使”首版微信小程序工程。它不是 `apps/channel-web/` 的 WebView 包壳，而是围绕一轮游戏重新组织的小程序前端。

## 首版范围

- 创建游戏、加入游戏、查看我的游戏。
- 完成 `wish -> claim -> delivery -> guess -> reveal` 一轮流程。
- 创建者/管理员可推进阶段、生成揭晓、确认揭晓。
- 小程序只调用 `king-angel-mini-api` 中间层，不直接持有 Supabase service role 或微信 `AppSecret`。

## 本地配置

1. 在微信开发者工具中导入本目录。
2. 把 `project.config.json` 里的 `appid` 替换为真实小程序 AppID。
3. 把 `services/config.js` 里的 `API_BASE_URL` 替换为 Supabase Edge Function 或自有 HTTPS API 域名。

不要提交 `AppSecret`、service role、真实测试账号密码或微信后台配置截图。

## 上线手册

从当前工程到微信提审的后台配置、部署步骤和真机验收项记录在 `docs/king-angel-mini-launch.md`。
