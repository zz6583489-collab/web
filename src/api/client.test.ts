import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiClient, normalizeApiError, observeAccessToken, setAccessToken } from './client'

describe('normalizeApiError', () => {
  it('keeps the server code and traceId for support', () => {
    const error = new AxiosError('unauthorized', 'ERR_BAD_RESPONSE', undefined, undefined, {
      data: { code: 'AUTH.UNAUTHORIZED', message: '请先登录', traceId: 'trace-123' },
      status: 401,
      statusText: 'Unauthorized',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    })
    expect(normalizeApiError(error)).toMatchObject({
      code: 'AUTH.UNAUTHORIZED',
      status: 401,
      traceId: 'trace-123',
    })
  })

  it('does not expose unknown failures', () => {
    expect(normalizeApiError(new Error('internal details')).message).toBe('操作失败，请稍后重试')
  })
})

describe('expired access token', () => {
  it('refreshes once without sending the expired bearer and retries the request', async () => {
    const originalAdapter = apiClient.defaults.adapter
    const seen: string[] = []
    let updatedToken = ''
    observeAccessToken((token) => {
      updatedToken = token ?? ''
    })
    setAccessToken('expired')
    apiClient.defaults.adapter = async (config) => {
      const bearer = config.headers.get('Authorization')?.toString() ?? ''
      seen.push(`${config.url}:${bearer}`)
      if (config.url === '/auth/refresh') {
        return {
          config,
          data: { data: { accessToken: 'fresh' } },
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
        }
      }
      if (bearer === 'Bearer expired') {
        throw new AxiosError('expired', 'ERR_BAD_RESPONSE', config, undefined, {
          config,
          data: { code: 'AUTH.UNAUTHORIZED', message: '请先登录' },
          status: 401,
          statusText: 'Unauthorized',
          headers: new AxiosHeaders(),
        })
      }
      return {
        config,
        data: { code: 'OK', data: { items: [] } },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
      }
    }

    try {
      const response = await apiClient.get('/projects')
      expect(response.data.code).toBe('OK')
      expect(updatedToken).toBe('fresh')
      expect(seen).toEqual(['/projects:Bearer expired', '/auth/refresh:', '/projects:Bearer fresh'])
    } finally {
      apiClient.defaults.adapter = originalAdapter
      setAccessToken(null)
      observeAccessToken(() => undefined)
    }
  })
})
