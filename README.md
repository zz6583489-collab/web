# TeamFlow Web

Vue 3 + TypeScript 前端已接入真实 `/api/v1`：登录与会话恢复、项目/成员、任务创建与流转、活动、审计、项目统计页及组合筛选。接口调用分别位于 `src/stores/auth.ts`、`src/views/projects/projectApi.ts` 和 `src/views/tasks/taskApi.ts`；统计页位于 `src/views/dashboard/ProjectDashboardView.vue`。

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

`verify:integration` 自动在 `127.0.0.1:4173` 启动 Vite，将 `/api` 代理到**真实** Spring Boot。浏览器会依次登录、创建项目、筛选项目状态、创建并指派任务、流转任务，随后核对任务状态筛选、审计动作筛选与独立统计页的真实响应，并检查 390px 视口无页面横向溢出。测试创建唯一名称的项目和任务，因此只应指向隔离测试库。缺少后端或账号时命令失败，不会使用模拟数据。

默认使用本机 Chrome；如需改用 Edge，可设置 `TEAMFLOW_E2E_BROWSER_CHANNEL=msedge`。测试浏览器未安装时，按 Playwright 提示安装对应浏览器。

若后端在默认 `8080` 端口，改 `TEAMFLOW_API_ORIGIN` 即可。需要手动操作页面时，设置 `VITE_API_PROXY_TARGET` 后运行 `pnpm dev`，按终端给出的地址打开浏览器。权限和错误码见独立根仓库的 `docs/api.md`；Web 路由入口见 `src/router/index.ts`。
