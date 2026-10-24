import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '../types/api'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | undefined,
    public readonly traceId: string | undefined,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as Partial<ApiResponse<unknown>> | undefined
    return new ApiError(
      typeof payload?.code === 'string' ? payload.code : 'NETWORK.ERROR',
      typeof payload?.message === 'string' ? payload.message : '网络请求失败，请稍后重试',
      error.response?.status,
      typeof payload?.traceId === 'string'
        ? payload.traceId
        : error.response?.headers['x-trace-id'],
    )
  }
  return new ApiError('CLIENT.ERROR', '操作失败，请稍后重试', undefined, undefined)
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
)
