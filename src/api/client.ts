import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse, LoginView } from '../types/api'

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
let tokenObserver: ((token: string | null) => void) | null = null
let refreshPromise: Promise<string> | null = null

interface RetryableRequest extends InternalAxiosRequestConfig {
  teamflowRetried?: boolean
}

export function observeAccessToken(observer: (token: string | null) => void): void {
  tokenObserver = observer
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  tokenObserver?.(token)
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

export function formatApiError(error: unknown): string {
  const apiError = error instanceof ApiError ? error : normalizeApiError(error)
  return `${apiError.message}${apiError.traceId ? `（TraceId：${apiError.traceId}）` : ''}`
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

apiClient.interceptors.request.use((config) => {
  if (accessToken && config.url !== '/auth/refresh' && config.url !== '/auth/logout') {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 401) {
      const request = error.config as RetryableRequest | undefined
      if (request && !request.teamflowRetried && !request.url?.startsWith('/auth/')) {
        request.teamflowRetried = true
        try {
          refreshPromise ??= apiClient
            .post<ApiResponse<LoginView>>('/auth/refresh', null, {
              headers: { 'X-TeamFlow-CSRF': '1' },
            })
            .then((response) => {
              const token = response.data.data.accessToken
              setAccessToken(token)
              return token
            })
            .finally(() => {
              refreshPromise = null
            })
          const token = await refreshPromise
          request.headers.Authorization = `Bearer ${token}`
          return apiClient.request(request)
        } catch {
          setAccessToken(null)
        }
      }
    }
    return Promise.reject(normalizeApiError(error))
  },
)
