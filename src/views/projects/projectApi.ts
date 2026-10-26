import { apiClient } from '../../api/client'
import type { ApiResponse, PageResult } from '../../types/api'

export interface ProjectView {
  id: string
  name: string
  description: string | null
  ownerId: string
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

export interface MemberView {
  userId: string
  username: string
  displayName: string
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
}

export async function listProjects(
  page = 1,
  status?: 'ACTIVE' | 'ARCHIVED',
): Promise<PageResult<ProjectView>> {
  const response = await apiClient.get<ApiResponse<PageResult<ProjectView>>>('/projects', {
    params: { page, status },
  })
  return response.data.data
}

export async function getProject(id: string): Promise<ProjectView> {
  const response = await apiClient.get<ApiResponse<ProjectView>>(`/projects/${id}`)
  return response.data.data
}

export async function createProject(name: string, description: string): Promise<ProjectView> {
  const response = await apiClient.post<ApiResponse<ProjectView>>('/projects', {
    name,
    description,
  })
  return response.data.data
}

export async function archiveProject(id: string): Promise<void> {
  await apiClient.post(`/projects/${id}/archive`)
}

export async function listMembers(projectId: string): Promise<MemberView[]> {
  const response = await apiClient.get<ApiResponse<MemberView[]>>(`/projects/${projectId}/members`)
  return response.data.data
}

export async function addMember(projectId: string, userId: string): Promise<MemberView> {
  const response = await apiClient.post<ApiResponse<MemberView>>(`/projects/${projectId}/members`, {
    userId,
  })
  return response.data.data
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/members/${userId}`)
}
