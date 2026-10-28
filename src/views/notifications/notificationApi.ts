import { apiClient } from '../../api/client'
import type { ApiResponse, PageResult } from '../../types/api'

export type NotificationType =
  | 'MEMBER_ADDED'
  | 'TASK_ASSIGNED'
  | 'TASK_REVIEW_REQUESTED'
  | 'TASK_REVIEW_REJECTED'
  | 'TASK_COMPLETED'
  | 'TASK_REOPENED'

export interface NotificationView {
  id: string
  type: NotificationType
  projectId: string
  projectName: string
  taskId: string | null
  taskTitle: string | null
  actorName: string
  createdAt: string
  readAt: string | null
}

export async function listNotifications(
  page = 1,
  unreadOnly = false,
): Promise<PageResult<NotificationView>> {
  const response = await apiClient.get<ApiResponse<PageResult<NotificationView>>>(
    '/notifications',
    { params: { page, unreadOnly } },
  )
  return response.data.data
}

export async function getUnreadCount(): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ count: number }>>(
    '/notifications/unread-count',
  )
  return response.data.data.count
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`)
}

export async function markAllRead(): Promise<void> {
  await apiClient.post('/notifications/read-all')
}

export function notificationText(item: NotificationView): { title: string; description: string } {
  switch (item.type) {
    case 'MEMBER_ADDED':
      return {
        title: '你已加入项目',
        description: `${item.actorName} 将你加入「${item.projectName}」`,
      }
    case 'TASK_ASSIGNED':
      return {
        title: '你收到一项新任务',
        description: `${item.actorName} 将「${item.taskTitle}」指派给你`,
      }
    case 'TASK_REVIEW_REQUESTED':
      return {
        title: '有任务等待你评审',
        description: `${item.actorName} 提交了「${item.taskTitle}」`,
      }
    case 'TASK_REVIEW_REJECTED':
      return {
        title: '任务评审已驳回',
        description: `${item.actorName} 将「${item.taskTitle}」退回进行中`,
      }
    case 'TASK_COMPLETED':
      return { title: '任务已完成', description: `「${item.taskTitle}」已完成验收` }
    case 'TASK_REOPENED':
      return { title: '任务已重开', description: `${item.actorName} 重开了「${item.taskTitle}」` }
  }
}
