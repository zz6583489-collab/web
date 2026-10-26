import { apiClient } from '../../api/client'
import type { ApiResponse, PageResult, UserView } from '../../types/api'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  email: string | null
  status: 'ACTIVE' | 'DISABLED'
}

export async function listUsers(page = 1): Promise<PageResult<AdminUser>> {
  const response = await apiClient.get<ApiResponse<PageResult<AdminUser>>>('/admin/users', {
    params: { page },
  })
  return response.data.data
}

export async function createUser(input: {
  username: string
  password: string
  displayName: string
  email?: string
}): Promise<UserView> {
  const response = await apiClient.post<ApiResponse<UserView>>('/admin/users', input)
  return response.data.data
}

export async function changeUserStatus(
  id: string,
  status: 'ACTIVE' | 'DISABLED',
): Promise<UserView> {
  const response = await apiClient.patch<ApiResponse<UserView>>(`/admin/users/${id}/status`, {
    status,
  })
  return response.data.data
}
