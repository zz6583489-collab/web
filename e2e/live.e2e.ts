import { expect, test } from '@playwright/test'

const username = process.env.TEAMFLOW_E2E_USERNAME
const password = process.env.TEAMFLOW_E2E_PASSWORD

test('Vue login, project, and task actions call the live Spring Boot API', async ({ page }) => {
  if (!username || !password) {
    throw new Error('Set TEAMFLOW_E2E_USERNAME and TEAMFLOW_E2E_PASSWORD for a test account')
  }

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/login')
  await page.getByRole('textbox', { name: '用户名' }).fill(username)
  await page.getByRole('textbox', { name: '密码' }).fill(password)

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  )
  const meResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/users/me') && response.request().method() === 'GET',
  )
  const projectsResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/projects' &&
      response.request().method() === 'GET',
  )
  await page.getByRole('button', { name: '登录' }).click()
  expect((await loginResponse).status()).toBe(200)
  const me = await (await meResponse).json()
  expect(me.code).toBe('OK')
  expect((await projectsResponse).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'TeamFlow 项目' })).toBeVisible()

  const projectName = `Web 联调 ${Date.now()}`
  await page.getByRole('button', { name: '创建项目' }).click()
  const projectDialog = page.getByRole('dialog', { name: '创建项目' })
  await projectDialog.getByRole('textbox', { name: '项目名称' }).fill(projectName)
  const createProjectResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/projects' &&
      response.request().method() === 'POST',
  )
  await projectDialog.getByRole('button', { name: '创建', exact: true }).click()
  const createdProject = await createProjectResponse
  expect(createdProject.status()).toBe(200)
  expect(createdProject.request().postDataJSON().name).toBe(projectName)
  const project = (await createdProject.json()).data
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`))
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

  await page.getByRole('button', { name: '创建任务' }).click()
  const taskDialog = page.getByRole('dialog', { name: '创建任务' })
  await taskDialog.getByRole('textbox', { name: '标题' }).fill('Web 联调任务')
  await taskDialog.getByText('可暂不指派').click()
  await page.getByRole('option').first().click()
  const createTaskResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/projects/${project.id}/tasks` &&
      response.request().method() === 'POST',
  )
  await taskDialog.getByRole('button', { name: '创建', exact: true }).click()
  const createdTask = await createTaskResponse
  expect(createdTask.status()).toBe(200)
  expect(createdTask.request().postDataJSON().title).toBe('Web 联调任务')
  const task = (await createdTask.json()).data
  expect(task.assigneeId).toBe(me.data.id)

  await page.getByRole('button', { name: '详情' }).click()
  await expect(page.getByRole('dialog', { name: '任务详情' })).toBeVisible()
  const transitionResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/tasks/${task.id}/transitions` &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '流转到 IN_PROGRESS' }).click()
  const moved = await transitionResponse
  expect(moved.status()).toBe(200)
  expect(moved.request().postDataJSON()).toMatchObject({ toStatus: 'IN_PROGRESS', version: '0' })
  await expect(page.getByText('状态：IN_PROGRESS · 版本：1')).toBeVisible()
  expect(pageErrors).toEqual([])
})
