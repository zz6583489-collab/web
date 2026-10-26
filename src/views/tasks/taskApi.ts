import { apiClient } from '../../api/client'
import type { ApiResponse, PageResult } from '../../types/api'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TaskView {
  id: string
  projectId: string
  title: string
  description: string | null
  assigneeId: string | null
  reporterId: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: string | null
  version: string
  createdAt: string
  updatedAt: string
}

export interface ActivityView {
  id: string
  actorId: string
  action: string
  fromValue: string | null
  toValue: string | null
  createdAt: string
}

export interface AuditView {
  id: string
  actorId: string
  resourceType: string
  resourceId: string | null
  action: string
  traceId: string
  createdAt: string
}

export interface TaskFilter {
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
}

export interface AuditFilter {
  actorId?: string
  from?: string
  to?: string
  action?: string
}

export interface TaskStats {
  total: number
  todo: number
  inProgress: number
  inReview: number
  done: number
  overdue: number
  completionRatePercent: number
}

export async function listTasks(
  projectId: string,
  page = 1,
  filter: TaskFilter = {},
): Promise<PageResult<TaskView>> {
  const response = await apiClient.get<ApiResponse<PageResult<TaskView>>>(
    `/projects/${projectId}/tasks`,
    { params: { page, ...filter } },
  )
  return response.data.data
}

export async function getTaskStats(projectId: string): Promise<TaskStats> {
  const response = await apiClient.get<ApiResponse<TaskStats>>(`/projects/${projectId}/stats`)
  return response.data.data
}

export async function createTask(
  projectId: string,
  input: {
    title: string
    description?: string
    assigneeId?: string
    priority: TaskPriority
    dueAt?: string
  },
): Promise<TaskView> {
  const response = await apiClient.post<ApiResponse<TaskView>>(
    `/projects/${projectId}/tasks`,
    input,
  )
  return response.data.data
}

export async function getTask(id: string): Promise<TaskView> {
  const response = await apiClient.get<ApiResponse<TaskView>>(`/tasks/${id}`)
  return response.data.data
}

export async function editTask(
  id: string,
  input: {
    version: string
    title?: string
    description?: string
    assigneeId?: string
    unassign?: boolean
    priority?: TaskPriority
    dueAt?: string
    clearDueAt?: boolean
  },
): Promise<TaskView> {
  const response = await apiClient.patch<ApiResponse<TaskView>>(`/tasks/${id}`, input)
  return response.data.data
}

export async function transitionTask(
  id: string,
  version: string,
  toStatus: TaskStatus,
): Promise<TaskView> {
  const response = await apiClient.post<ApiResponse<TaskView>>(`/tasks/${id}/transitions`, {
    version,
    toStatus,
  })
  return response.data.data
}

export async function listActivities(id: string, page = 1): Promise<PageResult<ActivityView>> {
  const response = await apiClient.get<ApiResponse<PageResult<ActivityView>>>(
    `/tasks/${id}/activities`,
    { params: { page } },
  )
  return response.data.data
}

export async function listAudit(
  projectId: string,
  page = 1,
  filter: AuditFilter = {},
): Promise<PageResult<AuditView>> {
  const response = await apiClient.get<ApiResponse<PageResult<AuditView>>>(
    `/projects/${projectId}/audit-logs`,
    { params: { page, ...filter } },
  )
  return response.data.data
}
