# TeamFlow Web

Vue 3 + TypeScript 前端已接入真实 `/api/v1`：登录与会话恢复、项目/成员、任务创建与流转、活动、审计、项目统计页、组合筛选和站内通知。接口调用分别位于 `src/stores/auth.ts`、`src/views/projects/projectApi.ts`、`src/views/tasks/taskApi.ts` 和 `src/views/notifications/notificationApi.ts`；通知入口位于 `src/views/notifications/NotificationCenter.vue`。

页面通过路由懒加载，Element Plus 组件按页面自动引入。Loading 指令与消息样式显式注册；`vite.config.ts` 预优化当前使用的样式入口，避免首次打开懒加载页面时重新打包依赖。新增 Element Plus 组件时，同步更新该列表并运行冷启动联调。

## 最小前后端联调

先启动独立的 MySQL 8.0.16+ 和 `server/` Spring Boot 服务，准备一个可登录的**测试账号**。在纯 HTTP 本地环境设置后端 `AUTH_COOKIE_SECURE=false`；不要把真实密码写入仓库。

在 `web/` 运行：

```powershell
pnpm install --frozen-lockfile
$env:TEAMFLOW_API_ORIGIN = 'http://127.0.0.1:8081'
$env:TEAMFLOW_E2E_USERNAME = '<测试用户名>'
$env:TEAMFLOW_E2E_PASSWORD = '<测试密码>'
pnpm verify:integration
```

`verify:integration` 自动在 `127.0.0.1:4173` 启动 Vite。`live.e2e.ts` 将 `/api` 代理到**真实** Spring Boot，验证登录、项目、任务、筛选和统计；`design.e2e.ts` 使用模拟响应验证页面交互；提供下面的双账号变量时，`notification.e2e.ts` 再跑真实通知流程，否则跳过该用例。真实用例会创建唯一名称的项目和任务，因此只应指向隔离测试库。

默认使用本机 Chrome；如需改用 Edge，可设置 `TEAMFLOW_E2E_BROWSER_CHANNEL=msedge`。测试浏览器未安装时，按 Playwright 提示安装对应浏览器。

通知的双账号真实联调可单独执行 `pnpm exec playwright test e2e/notification.e2e.ts`。另需设置 `TEAMFLOW_E2E_OWNER_USERNAME`、`TEAMFLOW_E2E_MEMBER_USERNAME`、`TEAMFLOW_E2E_MEMBER_ID` 和 `TEAMFLOW_E2E_PASSWORD`，并确保后端 Flyway 已迁移至 V6。测试在隔离库创建项目和任务，通过前端登录、通知抽屉、未读数和任务跳转验证真实接口，不使用模拟响应。

若后端在默认 `8080` 端口，改 `TEAMFLOW_API_ORIGIN` 即可。需要手动操作页面时，设置 `VITE_API_PROXY_TARGET` 后运行 `pnpm dev`，按终端给出的地址打开浏览器。权限和错误码见独立根仓库的 `docs/api.md`；Web 路由入口见 `src/router/index.ts`。
