import { expect, test } from '@playwright/test'

test('designed project workflow keeps real API calls and permissions', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const traceId = 'test-trace-id'
  let authenticated = false
  let projectVisible = true
  let conflictOnNextPatch = false
  let notificationRead = false
  const project = {
    id: '1',
    name: 'Atlas 应用升级',
    description: '让核心工作流更顺畅。',
    ownerId: '1',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-28T00:00:00Z',
  }
  const members = [
    {
      userId: '1',
      username: 'linyue',
      displayName: '林悦',
      role: 'OWNER',
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      userId: '2',
      username: 'chenxi',
      displayName: '陈曦',
      role: 'MEMBER',
      joinedAt: '2026-10-02T00:00:00Z',
    },
  ]
  let task = {
    id: '11',
    projectId: '1',
    title: '完善权限校验',
    description: '覆盖项目成员授权。',
    assigneeId: '2',
    reporterId: '1',
    status: 'TODO',
    priority: 'HIGH',
    dueAt: null,
    version: '0',
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-28T00:00:00Z',
  }
  const accounts = [
    { id: '1', username: 'linyue', displayName: '林悦', email: null, status: 'ACTIVE' },
    { id: '2', username: 'chenxi', displayName: '陈曦', email: null, status: 'ACTIVE' },
  ]
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const method = request.method()
    const ok = async (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'OK', message: 'success', data, traceId }),
      })
    if (pathname === '/api/v1/auth/refresh') {
      if (authenticated)
        await ok({ accessToken: 'mock-token', tokenType: 'Bearer', expiresInSeconds: 900 })
      else
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'AUTH.SESSION_REVOKED',
            message: '会话不可用',
            data: null,
            traceId,
          }),
        })
    } else if (pathname === '/api/v1/auth/login' && method === 'POST') {
      authenticated = true
      await ok({ accessToken: 'mock-token', tokenType: 'Bearer', expiresInSeconds: 900 })
    } else if (pathname === '/api/v1/users/me') {
      await ok({ id: '1', username: 'linyue', displayName: '林悦', email: null, systemAdmin: true })
    } else if (pathname === '/api/v1/notifications/unread-count' && method === 'GET') {
      await ok({ count: notificationRead ? 0 : 1 })
    } else if (pathname === '/api/v1/notifications' && method === 'GET') {
      await ok({
        items: [
          {
            id: '12',
            type: 'TASK_ASSIGNED',
            projectId: '1',
            projectName: project.name,
            taskId: '11',
            taskTitle: task.title,
            actorName: '陈曦',
            createdAt: '2026-10-28T10:00:00Z',
            readAt: notificationRead ? '2026-10-28T11:00:00Z' : null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })
    } else if (pathname === '/api/v1/notifications/12/read' && method === 'POST') {
      notificationRead = true
      await ok(null)
    } else if (pathname === '/api/v1/projects' && method === 'GET') {
      await ok({
        items: projectVisible ? [project] : [],
        total: projectVisible ? 1 : 0,
        page: 1,
        pageSize: 20,
      })
    } else if (pathname === '/api/v1/projects/1' && method === 'GET') {
      if (projectVisible) await ok(project)
      else
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'PROJECT.NOT_FOUND',
            message: '项目不存在',
            data: null,
            traceId,
          }),
        })
    } else if (pathname === '/api/v1/projects/1/members' && method === 'GET') {
      await ok(members)
    } else if (pathname === '/api/v1/projects/1/members' && method === 'POST') {
      const input = request.postDataJSON() as { userId: string }
      expect(input.userId).toBe('3')
      members.push({
        userId: '3',
        username: 'wangli',
        displayName: '王莉',
        role: 'MEMBER',
        joinedAt: '2026-10-28T00:00:00Z',
      })
      await ok(members[2])
    } else if (pathname === '/api/v1/projects/1/stats') {
      await ok({
        total: 1,
        todo: 1,
        inProgress: 0,
        inReview: 0,
        done: 0,
        overdue: 0,
        completionRatePercent: 0,
      })
    } else if (pathname === '/api/v1/projects/1/tasks' && method === 'GET') {
      await ok({ items: [task], total: 1, page: 1, pageSize: 20 })
    } else if (pathname === '/api/v1/projects/1/audit-logs' && method === 'GET') {
      await ok({ items: [], total: 0, page: 1, pageSize: 20 })
    } else if (pathname === '/api/v1/tasks/11' && method === 'GET') {
      await ok(task)
    } else if (pathname === '/api/v1/tasks/11/activities' && method === 'GET') {
      await ok({ items: [], total: 0, page: 1, pageSize: 20 })
    } else if (pathname === '/api/v1/tasks/11' && method === 'PATCH') {
      const input = request.postDataJSON() as { version: string; title: string }
      expect(input.version).toBe(task.version)
      if (conflictOnNextPatch) {
        conflictOnNextPatch = false
        task = { ...task, version: String(Number(task.version) + 1) }
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'TASK.VERSION_CONFLICT',
            message: '任务版本冲突',
            data: null,
            traceId,
          }),
        })
      } else {
        task = { ...task, title: input.title, version: String(Number(task.version) + 1) }
        await ok(task)
      }
    } else if (pathname === '/api/v1/admin/users' && method === 'GET') {
      await ok({ items: accounts, total: accounts.length, page: 1, pageSize: 20 })
    } else if (pathname === '/api/v1/admin/users' && method === 'POST') {
      const input = request.postDataJSON() as { username: string; displayName: string }
      accounts.push({
        id: '3',
        username: input.username,
        displayName: input.displayName,
        email: null,
        status: 'ACTIVE',
      })
      await ok({
        id: '3',
        username: input.username,
        displayName: input.displayName,
        email: null,
        systemAdmin: false,
      })
    } else {
      throw new Error('Unexpected API request: ' + method + ' ' + pathname)
    }
  })

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '登录 TeamFlow' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png') })
  await page.getByRole('textbox', { name: '用户名' }).fill('linyue')
  await page.getByRole('textbox', { name: '密码' }).fill('example-password')
  await page.getByRole('button', { name: '登录工作空间' }).click()
  await expect(page.getByRole('heading', { name: '项目空间' })).toBeVisible()
  await expect(page.locator('.project-card').first()).toContainText('Atlas 应用升级')
  await page.screenshot({ path: testInfo.outputPath('projects-desktop.png') })

  await page.locator('.tf-side-nav').getByText('统计概览').click()
  await expect(page.getByRole('heading', { name: '统计概览' })).toBeVisible()
  await expect(page.locator('.insights-kpis')).toContainText('全部任务')
  await expect(page.locator('.project-bars')).toContainText('Atlas 应用升级')
  await page.screenshot({ path: testInfo.outputPath('insights-desktop.png') })
  await page.locator('.tf-side-nav').getByText('项目空间').click()

  await page.getByRole('button', { name: '消息通知' }).click()
  await page.locator('.notification-item').first().click()
  await expect(page).toHaveURL(/projects\/1\?taskId=11/)
  await expect(page.locator('.task-detail-drawer')).toContainText('完善权限校验')
  await page.locator('.task-detail-drawer .el-drawer__close-btn').click()
  await page.locator('.project-breadcrumb').getByRole('link', { name: '项目空间' }).click()

  await page.locator('.project-card').first().click()
  await expect(page.getByRole('heading', { name: 'Atlas 应用升级' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('project-board-desktop.png') })
  await page.locator('.task-card').first().click()
  await expect(page.locator('.task-detail-drawer')).toContainText('完善权限校验')
  await page.waitForTimeout(250)
  await page.screenshot({ path: testInfo.outputPath('task-drawer-desktop.png') })
  await page.getByRole('button', { name: '编辑任务' }).click()
  await page.getByRole('textbox', { name: '任务标题' }).fill('完善项目权限校验')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.locator('.task-detail-drawer')).toContainText('完善项目权限校验')
  await page.getByRole('button', { name: '编辑任务' }).click()
  await page.getByRole('textbox', { name: '任务标题' }).fill('完善项目权限与冲突处理')
  conflictOnNextPatch = true
  await page.getByRole('button', { name: '保存修改' }).click()
  const conflictDialog = page.getByRole('dialog', { name: '任务版本冲突' })
  await expect(conflictDialog).toBeVisible()
  await conflictDialog.getByRole('button', { name: '以最新版本继续编辑' }).click()
  await expect(page.getByRole('textbox', { name: '任务标题' })).toHaveValue(
    '完善项目权限与冲突处理',
  )
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.locator('.task-detail-drawer')).toContainText('完善项目权限与冲突处理')
  await page.locator('.task-detail-drawer .el-drawer__close-btn').click()

  await page
    .locator('.project-tabs')
    .getByRole('button', { name: /项目成员/ })
    .click()
  await page.getByRole('button', { name: '＋ 添加成员' }).click()
  const memberDialog = page.getByRole('dialog', { name: /添加项目成员/ })
  await memberDialog.getByRole('textbox', { name: '用户 ID' }).fill('3')
  await memberDialog.getByRole('button', { name: '添加成员' }).click()
  await expect(page.locator('.member-table')).toContainText('王莉')

  await page.locator('.tf-side-nav').getByText('账号管理').click()
  await expect(page.getByRole('heading', { name: '账号管理' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('admin-desktop.png') })
  await page.getByRole('button', { name: '＋ 创建账号' }).click()
  const userDialog = page.getByRole('dialog', { name: /创建账号/ })
  await userDialog.getByRole('textbox', { name: '用户名' }).fill('wangli')
  await userDialog.getByRole('textbox', { name: '显示姓名' }).fill('王莉')
  await userDialog.getByRole('textbox', { name: '初始密码' }).fill('example-password')
  await userDialog.getByRole('button', { name: '创建账号' }).click()
  await expect(page.locator('.admin-table')).toContainText('王莉')
  await expect(userDialog).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: testInfo.outputPath('admin-mobile.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(
    await page
      .locator('.admin-table')
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true)

  project.ownerId = '2'
  members[0]!.role = 'MEMBER'
  members[1]!.role = 'OWNER'
  await page.goto('/projects/1')
  await expect(page.getByRole('heading', { name: 'Atlas 应用升级' })).toBeVisible()
  await expect(page.getByRole('button', { name: '项目设置' })).toHaveCount(0)
  await expect(page.locator('.project-tabs').getByRole('button', { name: '操作审计' })).toHaveCount(
    0,
  )
  await page
    .locator('.project-tabs')
    .getByRole('button', { name: /项目成员/ })
    .click()
  await expect(page.getByRole('button', { name: '＋ 添加成员' })).toHaveCount(0)

  task.projectId = '2'
  await page.goto('/projects/1?taskId=11')
  await expect(page.locator('.task-detail-drawer')).toContainText('任务无法访问')
  await expect(page.locator('.task-detail-drawer')).not.toContainText('完善项目权限与冲突处理')

  projectVisible = false
  await page.goto('/projects/1')
  await expect(page.getByRole('heading', { name: '项目无法访问' })).toBeVisible()
  await expect(page.locator('.tf-recent-list')).not.toContainText('Atlas 应用升级')
  expect(pageErrors).toEqual([])
})
