import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { normalizeApiError } from './client'

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
