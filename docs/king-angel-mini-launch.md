# 国王与天使小程序上线手册

这份手册只服务 `apps/king-angel-mini/`。它记录从当前仓库状态到微信小程序上线必须完成的后台操作和验收项。

## 1. Supabase 后端

1. 应用 migration：`supabase/migrations/20260428131159_king_angel_mini_program.sql`。
2. 在 Supabase Functions secrets 中配置：
   - `WECHAT_MINI_APP_ID`
   - `WECHAT_MINI_APP_SECRET`
   - `MINI_SESSION_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 部署函数：`supabase functions deploy king-angel-mini-api`。
4. 确认 `supabase/config.toml` 中 `king-angel-mini-api` 的 `verify_jwt = false` 已生效；这个 API 使用小程序 session token，不使用 Supabase JWT。
5. 用真实微信 `wx.login` code 调 `mini_login`，确认能返回 `{ token, expiresAt, user }`。

不要把 service role、微信 AppSecret 或真实 session token 写进仓库。

## 2. 微信小程序后台

1. 注册并认证微信小程序。
2. 把 `apps/king-angel-mini/project.config.json` 的 `appid` 改成真实 AppID。
3. 在“开发管理 / 开发设置 / 服务器域名”配置 `request 合法域名`。
4. 如果直接使用 Supabase Functions 域名不满足微信后台要求，改用自有 HTTPS 域名代理到 `king-angel-mini-api`。
5. 在“服务内容声明 / 用户隐私保护指引”中声明会处理：
   - 微信登录标识
   - 昵称和头像
   - 游戏房间成员关系
   - 许愿、交付、猜测、揭晓内容
6. 准备提审材料：小程序名称、头像、简介、类目、功能截图、测试账号或测试说明。

## 3. 小程序工程配置

1. 在 `apps/king-angel-mini/services/config.js` 中替换 `API_BASE_URL`。
2. 用微信开发者工具导入 `apps/king-angel-mini/`。
3. 先关闭“本地设置 / 不校验合法域名”做真机预览，确认线上域名配置真实可用。
4. 上传体验版前检查没有提交真实 AppSecret、service role、个人测试账号。

## 4. 上线前验收

必须用至少 3 个真实微信账号完成一整轮：

1. 创建者创建游戏。
2. 创建者分享游戏，另外 2 个成员从分享进入并加入。
3. 所有人提交匿名愿望。
4. 所有人认领非自己的愿望。
5. 所有人提交匿名交付。
6. 所有人提交天使猜测。
7. 创建者生成并确认揭晓。
8. 揭晓前普通成员不能看到真实作者。
9. 登录过期后重新进入能恢复。
10. 非成员无法直接打开游戏详情。

仓库侧每次发版前至少运行：

```bash
npm run check
```

如果本机装了 Deno，再运行：

```bash
deno check supabase/functions/king-angel-mini-api/index.ts
```

## 5. 已知不能在仓库内完成的事项

- 微信小程序注册、认证、类目选择、隐私指引填写。
- 真实 AppID / AppSecret 获取与配置。
- 微信后台 request 合法域名配置。
- Supabase 线上 migration 应用与 Function secrets 写入。
- 微信开发者工具上传体验版、提交审核、发布。
