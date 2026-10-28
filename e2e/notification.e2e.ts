import { expect, test } from '@playwright/test'

const ownerName = process.env.TEAMFLOW_E2E_OWNER_USERNAME
const memberName = process.env.TEAMFLOW_E2E_MEMBER_USERNAME
const memberId = process.env.TEAMFLOW_E2E_MEMBER_ID
const password = process.env.TEAMFLOW_E2E_PASSWORD

test('real member notifications link to a task and mark as read', async ({
  browser,
  page,
  request,
}) => {
  if (!ownerName || !memberName || !memberId || !password) {
    test.skip(true, 'Set owner/member test account environment variables')
    return
  }

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/login')
  await page.getByRole('textbox', { name: '用户名' }).fill(ownerName)
  await page.getByRole('textbox', { name: '密码' }).fill(password)
  const ownerLogin = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/login'),
  )
  await page.getByRole('button', { name: /登录工作空间/ }).click()
  const ownerToken = (await (await ownerLogin).json()).data.accessToken as string
  await expect(page.getByRole('heading', { name: '项目空间' })).toBeVisible()

  const headers = { Authorization: `Bearer ${ownerToken}` }
  const projectName = `通知联调 ${Date.now()}`
  const createdProject = await request.post('/api/v1/projects', {
    headers,
    data: { name: projectName, description: '真实通知联调' },
  })
  expect(createdProject.status()).toBe(200)
  const projectId = (await createdProject.json()).data.id as string
  const addedMember = await request.post(`/api/v1/projects/${projectId}/members`, {
    headers,
    data: { userId: memberId },
  })
  expect(addedMember.status()).toBe(200)
  const taskTitle = `通知任务 ${Date.now()}`
  const createdTask = await request.post(`/api/v1/projects/${projectId}/tasks`, {
    headers,
    data: { title: taskTitle, assigneeId: memberId, priority: 'HIGH' },
  })
  expect(createdTask.status()).toBe(200)
  const taskId = (await createdTask.json()).data.id as string

  const memberPage = await browser.newPage()
  memberPage.on('pageerror', (error) => pageErrors.push(error.message))
  await memberPage.goto('/login')
  await memberPage.getByRole('textbox', { name: '用户名' }).fill(memberName)
  await memberPage.getByRole('textbox', { name: '密码' }).fill(password)
  const memberLogin = memberPage.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/login'),
  )
  await memberPage.getByRole('button', { name: /登录工作空间/ }).click()
  const memberToken = (await (await memberLogin).json()).data.accessToken as string
  await expect(memberPage.getByRole('heading', { name: '项目空间' })).toBeVisible()

  const memberHeaders = { Authorization: `Bearer ${memberToken}` }
  const unreadResponse = await request.get('/api/v1/notifications/unread-count', {
    headers: memberHeaders,
  })
  expect(unreadResponse.status()).toBe(200)
  const unreadBefore = (await unreadResponse.json()).data.count as number
  expect(unreadBefore).toBeGreaterThanOrEqual(2)

  const notificationsResponse = memberPage.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/notifications' &&
      response.request().method() === 'GET',
  )
  await memberPage.getByRole('button', { name: '消息通知' }).click()
  const listed = await notificationsResponse
  expect(listed.status()).toBe(200)
  const notice = (await listed.json()).data.items.find(
    (item: { taskTitle: string }) => item.taskTitle === taskTitle,
  )
  expect(notice).toBeTruthy()
  const denied = await request.post(`/api/v1/notifications/${notice.id}/read`, { headers })
  expect(denied.status()).toBe(404)
  expect((await denied.json()).code).toBe('NOTIFICATION.NOT_FOUND')
  await expect(memberPage.getByText(taskTitle)).toBeVisible()
  const markResponse = memberPage.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/read') && response.request().method() === 'POST',
  )
  await memberPage.getByRole('button', { name: new RegExp(taskTitle) }).click()
  expect((await markResponse).status()).toBe(200)
  await expect(memberPage).toHaveURL(new RegExp(`/projects/${projectId}\\?taskId=${taskId}`))
  await expect(memberPage.getByRole('dialog', { name: '任务详情' })).toBeVisible()
  const afterResponse = await request.get('/api/v1/notifications/unread-count', {
    headers: memberHeaders,
  })
  expect((await afterResponse.json()).data.count).toBe(unreadBefore - 1)
  await memberPage.keyboard.press('Escape')
  await expect(memberPage.getByRole('dialog', { name: '任务详情' })).toBeHidden()
  await memberPage.getByRole('button', { name: '消息通知' }).click()
  const filteredResponse = memberPage.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/notifications' && url.searchParams.get('unreadOnly') === 'true'
  })
  await memberPage.getByText('未读', { exact: true }).click()
  expect((await filteredResponse).status()).toBe(200)
  const readAllResponse = memberPage.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/notifications/read-all') &&
      response.request().method() === 'POST',
  )
  await memberPage.getByRole('button', { name: '全部标为已读' }).click()
  expect((await readAllResponse).status()).toBe(200)
  await expect(memberPage.getByText('暂时没有新消息')).toBeVisible()
  const finalCount = await request.get('/api/v1/notifications/unread-count', {
    headers: memberHeaders,
  })
  expect((await finalCount.json()).data.count).toBe(0)
  expect(pageErrors).toEqual([])
})
